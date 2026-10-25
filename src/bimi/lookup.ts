/**
 * Opt-in BIMI check. Besides src/dns/, this is the only module allowed to make
 * network requests, and it only runs after the user asks for it.
 *
 * What leaves the client:
 *  1. `default._bimi.<domain>` TXT queries, to the user's chosen DoH resolver.
 *  2. GET requests for the certificate (`a=`) and/or logo (`l=`) URLs published
 *     in that record. The hosting server sees the user's IP address and the time.
 *     The URLs come from DNS, so they're the same for every recipient and
 *     carry no per-message information.
 */
import { type Resolver, type ResolverRef, queryTxt, resolverOf } from '../dns/lookup';
import { orgDomainGuess } from '../parser/address';
import type { Analysis } from '../parser/analyze';
import { toASCII } from '../parser/punycode';
import { type BimiRecord, isBimiRecord, isDeclination, parseBimiRecord } from './record';
import { type MarkFailure, type MarkResult, validateMarkCertificate } from './vmc';

export type BimiOutcome =
  | { kind: 'none'; domain: string }
  | { kind: 'declined'; domain: string }
  /** Green: a VMC/CMC validated (by us, or by the receiving mail server). */
  | {
      kind: 'verified';
      domain: string;
      source: 'client' | 'receiver';
      logoSvg: string;
      mark?: Extract<MarkResult, { ok: true }>;
    }
  /** Blue: a logo without a (checkable) certificate. */
  | {
      kind: 'logo';
      domain: string;
      source: 'client' | 'receiver';
      logoSvg: string | null;
      /** Why there's no verified certificate. */
      cert: 'none' | 'unreachable';
    }
  /** Grey with a warning: a certificate was offered but failed validation. */
  | { kind: 'invalid'; domain: string; reason: MarkFailure | 'receiver-fail' };

/** BIMI recorded by a BIMI-aware receiver (Gmail, Yahoo, Fastmail…), if any. No network. */
export function bimiFromReceiver(a: Analysis, fallbackDomain: string): BimiOutcome | null {
  const b = a.bimi;
  if (!b) return null;
  const domain = b.domain ?? fallbackDomain;
  if (b.result === 'pass') {
    if (b.authority === 'pass' && b.indicatorSvg) {
      return { kind: 'verified', domain, source: 'receiver', logoSvg: b.indicatorSvg };
    }
    return {
      kind: 'logo',
      domain,
      source: 'receiver',
      logoSvg: b.indicatorSvg ?? null,
      cert: 'none',
    };
  }
  if (b.result === 'fail') return { kind: 'invalid', domain, reason: 'receiver-fail' };
  if (b.result === 'declined') return { kind: 'declined', domain };
  if (b.result === 'none') return { kind: 'none', domain };
  return null; // skipped / temperror: let the client check if the user wants
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface BimiLookupOptions {
  fetchFn?: FetchFn;
  now?: Date;
  timeoutMs?: number;
}

const MAX_CERT_BYTES = 256 * 1024;
const MAX_LOGO_BYTES = 64 * 1024;

async function fetchText(
  url: string,
  maxBytes: number,
  fetchFn: FetchFn,
  timeoutMs: number,
): Promise<string> {
  if (!url.startsWith('https://')) throw new Error('not https');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors',
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > maxBytes) throw new Error('response too large');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function findRecord(
  domain: string,
  resolver: Resolver,
  fetchFn: FetchFn | undefined,
): Promise<{ record: BimiRecord; at: string } | null> {
  // The From domain first, then its organisational domain (§4.4).
  const candidates = [...new Set([domain, orgDomainGuess(domain)])];
  for (const d of candidates) {
    const { txt } = await queryTxt(`default._bimi.${d}`, resolver, fetchFn ? { fetchFn } : {});
    const records = txt.filter(isBimiRecord);
    if (records.length === 1) {
      const record = parseBimiRecord(records[0] as string);
      if (record) return { record, at: d };
    }
  }
  return null;
}

const cache = new Map<string, Promise<BimiOutcome>>();

export function clearBimiCache(): void {
  cache.clear();
}

export function lookupBimi(
  fromDomain: string,
  ref: ResolverRef,
  opts: BimiLookupOptions = {},
): Promise<BimiOutcome> {
  const resolver = resolverOf(ref);
  const domain = toASCII(fromDomain);
  const key = `${resolver.url}|${domain}`;
  let p = cache.get(key);
  if (!p) {
    p = check(domain, resolver, opts);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

async function check(
  domain: string,
  resolver: Resolver,
  opts: BimiLookupOptions,
): Promise<BimiOutcome> {
  const fetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init));
  const timeoutMs = opts.timeoutMs ?? 8000;
  const found = await findRecord(domain, resolver, opts.fetchFn);
  if (!found) return { kind: 'none', domain };
  const { record } = found;
  if (isDeclination(record)) return { kind: 'declined', domain };

  let cert: 'none' | 'unreachable' = 'none';
  if (record.a) {
    let pem: string | null = null;
    try {
      pem = await fetchText(record.a, MAX_CERT_BYTES, fetchFn, timeoutMs);
    } catch {
      // Typically CORS: the host doesn't send Access-Control-Allow-Origin.
      cert = 'unreachable';
    }
    if (pem !== null) {
      const mark = await validateMarkCertificate(pem, {
        domains: [domain, orgDomainGuess(domain)],
        ...(opts.now ? { now: opts.now } : {}),
      });
      if (!mark.ok) return { kind: 'invalid', domain, reason: mark.reason };
      return { kind: 'verified', domain, source: 'client', logoSvg: mark.logoSvg, mark };
    }
  }

  let logoSvg: string | null = null;
  if (record.l) {
    try {
      const text = await fetchText(record.l, MAX_LOGO_BYTES, fetchFn, timeoutMs);
      logoSvg = /<svg[\s>]/i.test(text) ? text : null;
    } catch {
      logoSvg = null;
    }
  }
  return { kind: 'logo', domain, source: 'client', logoSvg, cert };
}
