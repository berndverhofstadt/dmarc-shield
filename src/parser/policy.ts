/** Where a DMARC policy came from, and how it's derived. */
import { orgDomainGuess } from './address';
import type { ResInfo } from './authres';
import { type DmarcPolicy, type DmarcRecord, asPolicy } from './dmarcrecord';

export type PolicySource = 'header' | 'arc' | 'dns';

export interface PolicyInfo {
  p: DmarcPolicy;
  pct?: number;
  testing?: boolean;
  source: PolicySource;
  /** Domain the DNS record was found at (DNS only). */
  recordDomain?: string;
  /** Resolver used (DNS only). */
  resolver?: string;
}

const STRENGTH: Record<DmarcPolicy, number> = { none: 0, quarantine: 1, reject: 2 };

export function weaker(a: DmarcPolicy, b: DmarcPolicy): DmarcPolicy {
  return STRENGTH[a] <= STRENGTH[b] ? a : b;
}

/**
 * Read the policy a receiver recorded in a dmarc resinfo:
 * - Gmail:   `dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=…`
 * - Yahoo:   `dmarc=pass(p=REJECT) header.from=…`
 * - Fastmail/Cyrus: `policy.published-domain-policy=reject` and `(p=reject,d=none,…)`
 *
 * If the From domain looks like a subdomain and both p and sp are shown, we
 * use the weaker one: we don't know where the record was found, and we must
 * never overstate protection.
 */
export function policyFromResInfo(
  r: ResInfo,
  headerFrom: string | undefined,
  source: 'header' | 'arc',
): PolicyInfo | undefined {
  const text = r.comments.join(' ');
  const tag = (name: string) => new RegExp(`(?:^|[\\s,])${name}=([a-z0-9]+)`, 'i').exec(text)?.[1];
  const p = asPolicy(r.props['policy.published-domain-policy']) ?? asPolicy(tag('p'));
  if (!p) return undefined;
  const sp = asPolicy(r.props['policy.published-subdomain-policy']) ?? asPolicy(tag('sp'));
  const isSub = headerFrom !== undefined && orgDomainGuess(headerFrom) !== headerFrom.toLowerCase();
  const info: PolicyInfo = { p: isSub && sp ? weaker(p, sp) : p, source };
  const pct = tag('pct');
  if (pct !== undefined && /^\d+$/.test(pct)) info.pct = Math.min(100, Number(pct));
  if (tag('t')?.toLowerCase() === 'y') info.testing = true;
  return info;
}

/** Effective policy from a DNS record found at `recordDomain` for `fromDomain`. */
export function policyFromRecord(
  rec: DmarcRecord,
  recordDomain: string,
  fromDomain: string,
  resolver: string,
): PolicyInfo {
  const p = recordDomain === fromDomain ? rec.p : (rec.sp ?? rec.p);
  const info: PolicyInfo = { p, source: 'dns', recordDomain, resolver };
  if (rec.pct !== undefined) info.pct = rec.pct;
  if (rec.testing) info.testing = true;
  return info;
}

export function isEnforcedReject(p: PolicyInfo): boolean {
  return p.p === 'reject' && (p.pct === undefined || p.pct >= 100) && !p.testing;
}
