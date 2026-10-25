/**
 * BIMI may only be shown for mail that passed DMARC under an enforcing policy
 * (draft-brand-indicators §7.1): p=reject, or p=quarantine with pct=100, and
 * never with sp=none or testing. Otherwise a spoofed message could show a real
 * brand logo.
 */
import type { Verdict } from '../parser/verdict';

export type BimiEligibility = 'eligible' | 'needs-policy' | 'not-authenticated' | 'weak-policy';

export function bimiEligibility(v: Verdict): BimiEligibility {
  if (v.via === 'internal' || v.via === null) return 'not-authenticated';
  if (v.state !== 'verified' && v.state !== 'authenticated') return 'not-authenticated';
  const p = v.policy;
  if (!p) return 'needs-policy';
  if (p.testing || (p.pct !== undefined && p.pct < 100)) return 'weak-policy';
  return p.p === 'reject' || p.p === 'quarantine' ? 'eligible' : 'weak-policy';
}
