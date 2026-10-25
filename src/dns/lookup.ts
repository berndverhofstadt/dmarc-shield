/**
 * Opt-in DMARC policy discovery over DNS-over-HTTPS (RFC 8484).
 *
 * Web pages have no API for DNS lookups through the operating system's
 * resolver, so every query is DoH: to one of three public resolvers, a custom
 * URL from the user's settings, or the organisation's resolver set by IT in
 * the deployed manifest. Only runs after the user opts in. What leaves the
 * client: the names `_dmarc.<sender domain>` (and its parents, for the tree
 * walk) and `default._bimi.<domain>`. Nothing else.
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

/** A DoH endpoint: a preset, a user's custom URL, or the organisation's. */
export interface Resolver {
  id: ResolverId | 'custom' | 'org';
  name: string;
  url: string;
}

export type ResolverRef = ResolverId | Resolver;

export function resolverOf(r: ResolverRef): Resolver {
  return typeof r === 'string' ? { id: r, ...RESOLVERS[r] } : r;
}

/**
 * Validate a DoH endpoint URL (RFC 8484 GET with `?dns=`): https only, no
 * credentials or fragment, and no existing `dns` parameter. Returns the
 * normalised URL, or null.
 */
export function normalizeDohUrl(input: string | null | undefined): string | null {
  const s = input?.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.searchParams.has('dns')) {
    return null;
  }
  return u.href;
}

export function customResolver(url: string, id: 'custom' | 'org' = 'custom'): Resolver {
  return { id, name: new URL(url).host, url };
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
    readonly resolver?: Resolver,
  ) {
    super(message);
  }
}

export async function queryTxt(
  name: string,
  ref: ResolverRef,
  { fetchFn = (u, i) => fetch(u, i), timeoutMs = 5000 }: LookupOptions = {},
): Promise<{ rcode: number; txt: string[] }> {
  const resolver = resolverOf(ref);
  const sep = resolver.url.includes('?') ? '&' : '?';
  const url = `${resolver.url}${sep}dns=${toBase64Url(encodeQuery(name))}`;
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
  ref: ResolverRef,
  opts: LookupOptions = {},
): Promise<DmarcLookupResult> {
  const resolver = resolverOf(ref);
  const domain = toASCII(fromDomain);
  const key = `${resolver.url}|${domain}`;
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
  resolver: Resolver,
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
          policy: policyFromRecord(record, candidate, domain, resolver.name),
        };
      }
    }
  }
  return { record: null };
}
