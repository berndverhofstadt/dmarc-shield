/**
 * Opt-in DMARC policy discovery over DNS-over-HTTPS (RFC 8484).
 *
 * This is the ONLY place in DMARC Shield that performs network requests, and
 * it only runs when the user has enabled it in settings. What leaves the
 * client: the names `_dmarc.<sender domain>` (and its parents, for the
 * tree walk), sent to one of three fixed resolvers. Nothing else.
 *
 * The resolver origins must match `connect-src` in the task pane's CSP.
 */
import { type DmarcRecord, isDmarcRecord, parseDmarcRecord } from '../parser/dmarcrecord';
import { type PolicyInfo, policyFromRecord } from '../parser/policy';
import { toASCII } from '../parser/punycode';
import {
  RCODE_NOERROR,
  RCODE_NXDOMAIN,
  TYPE_TXT,
  decodeResponse,
  encodeQuery,
  isValidQueryName,
  toBase64Url,
  txtValue,
} from './wire';

export const RESOLVERS = {
  quad9: { name: 'Quad9', url: 'https://dns.quad9.net/dns-query' },
  cloudflare: { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
  google: { name: 'Google', url: 'https://dns.google/dns-query' },
} as const;

export type ResolverId = keyof typeof RESOLVERS;

export function isResolverId(v: unknown): v is ResolverId {
  return typeof v === 'string' && Object.hasOwn(RESOLVERS, v);
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface LookupOptions {
  fetchFn?: FetchFn;
  timeoutMs?: number;
}

/**
 * - network: the request never got an answer (blocked by a firewall, DNS filter
 *   or extension, offline, or CORS). Browsers only report "Failed to fetch".
 * - timeout: no answer within the time limit.
 * - http / dns: the resolver answered with an error.
 * - invalid: the domain can't be queried.
 */
export type DnsErrorKind = 'network' | 'timeout' | 'http' | 'dns' | 'invalid';

export class DnsError extends Error {
  constructor(
    message: string,
    readonly kind: DnsErrorKind,
    readonly resolver?: ResolverId,
  ) {
    super(message);
  }
}

export async function queryTxt(
  name: string,
  resolver: ResolverId,
  { fetchFn = (u, i) => fetch(u, i), timeoutMs = 5000 }: LookupOptions = {},
): Promise<{ rcode: number; txt: string[] }> {
  const url = `${RESOLVERS[resolver].url}?dns=${toBase64Url(encodeQuery(name))}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { accept: 'application/dns-message' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new DnsError(`resolver returned HTTP ${res.status}`, 'http', resolver);
    const msg = decodeResponse(new Uint8Array(await res.arrayBuffer()));
    return {
      rcode: msg.rcode,
      txt: msg.answers.filter((a) => a.type === TYPE_TXT).map((a) => txtValue(a.data)),
    };
  } catch (e) {
    if (e instanceof DnsError) throw e;
    const timedOut = ctrl.signal.aborted;
    throw new DnsError(
      timedOut ? 'timed out' : e instanceof Error ? e.message : String(e),
      timedOut ? 'timeout' : 'network',
      resolver,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** DMARCbis-style tree walk candidates: the domain itself, then parents, never the TLD; at most 8. */
export function treeWalk(domain: string): string[] {
  const labels = domain.replace(/\.$/, '').split('.');
  const out: string[] = [labels.join('.')];
  // Long names jump straight to 7 labels (DMARCbis §4.10.1).
  let n = Math.min(labels.length - 1, 7);
  while (n >= 2 && out.length < 8) {
    out.push(labels.slice(-n).join('.'));
    n--;
  }
  return out;
}

export interface DmarcLookupResult {
  record: DmarcRecord | null;
  recordDomain?: string;
  policy?: PolicyInfo;
}

const cache = new Map<string, Promise<DmarcLookupResult>>();

export function clearDnsCache(): void {
  cache.clear();
}

export function lookupDmarcPolicy(
  fromDomain: string,
  resolver: ResolverId,
  opts: LookupOptions = {},
): Promise<DmarcLookupResult> {
  const domain = toASCII(fromDomain);
  const key = `${resolver}|${domain}`;
  let p = cache.get(key);
  if (!p) {
    p = walk(domain, resolver, opts);
    cache.set(key, p);
    // Don't cache failures; a later retry may succeed.
    p.catch(() => cache.delete(key));
  }
  return p;
}

async function walk(
  domain: string,
  resolver: ResolverId,
  opts: LookupOptions,
): Promise<DmarcLookupResult> {
  if (!isValidQueryName(`_dmarc.${domain}`)) {
    throw new DnsError(`invalid domain: ${domain}`, 'invalid', resolver);
  }
  for (const candidate of treeWalk(domain)) {
    const { rcode, txt } = await queryTxt(`_dmarc.${candidate}`, resolver, opts);
    if (rcode !== RCODE_NOERROR && rcode !== RCODE_NXDOMAIN) {
      throw new DnsError(`DNS error (rcode ${rcode}) for _dmarc.${candidate}`, 'dns', resolver);
    }
    const records = txt.filter(isDmarcRecord);
    // Exactly one DMARC record is required; zero or several means "no record here".
    if (records.length === 1) {
      const record = parseDmarcRecord(records[0] as string);
      if (record) {
        return {
          record,
          recordDomain: candidate,
          policy: policyFromRecord(record, candidate, domain, RESOLVERS[resolver].name),
        };
      }
    }
  }
  return { record: null };
}
