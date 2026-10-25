/**
 * Evidence → one of three verdicts (plus "unsupported").
 *
 *   verified       green  — DMARC pass + enforced p=reject, or internal mail
 *   authenticated  blue   — DMARC pass, policy weaker or unknown
 *   unprotected    red    — no policy, fail, no results, or any forgery finding
 *   unsupported    grey   — this client can't read headers
 */
import type { Analysis, Finding } from './analyze';
import { type PolicyInfo, isEnforcedReject } from './policy';

export type VerdictState = 'verified' | 'authenticated' | 'unprotected' | 'unsupported';

export type ReasonCode =
  | 'internal'
  | 'policy-reject'
  | 'policy-partial'
  | 'policy-quarantine'
  | 'policy-none'
  | 'policy-unknown'
  | 'forgery'
  | 'no-auth-results'
  | 'dmarc-missing'
  | 'dmarc-none'
  | 'dmarc-fail'
  | 'dmarc-error'
  | 'dmarc-other'
  | 'unsupported';

export interface Verdict {
  state: VerdictState;
  reason: ReasonCode;
  via: 'direct' | 'arc' | 'internal' | null;
  /** Effective policy and its source, if known. */
  policy?: PolicyInfo;
  /** True when DMARC passed but the headers didn't reveal the policy. */
  needsPolicy: boolean;
  /** Domain whose `_dmarc` record would answer `needsPolicy`. */
  policyDomain?: string;
  /** ARC sealer, when via === 'arc'. */
  sealer?: string | null;
  findings: Finding[];
}

export function unsupportedVerdict(): Verdict {
  return {
    state: 'unsupported',
    reason: 'unsupported',
    via: null,
    needsPolicy: false,
    findings: [],
  };
}

function failReason(result: string | undefined): ReasonCode {
  switch (result) {
    case undefined:
      return 'dmarc-missing';
    case 'none':
    case 'bestguesspass': // EXO: no DMARC record, but would have passed
      return 'dmarc-none';
    case 'fail':
      return 'dmarc-fail';
    case 'temperror':
    case 'permerror':
      return 'dmarc-error';
    default:
      return 'dmarc-other';
  }
}

export function decide(a: Analysis, dnsPolicy?: PolicyInfo | null): Verdict {
  const findings = a.findings;
  const base = { needsPolicy: false, findings };

  if (findings.some((f) => f.severity === 'forgery')) {
    return { ...base, state: 'unprotected', reason: 'forgery', via: null };
  }
  if (a.internal) {
    return { ...base, state: 'verified', reason: 'internal', via: 'internal' };
  }
  if (!a.topAr) {
    return { ...base, state: 'unprotected', reason: 'no-auth-results', via: null };
  }

  let via: 'direct' | 'arc';
  let headerPolicy: PolicyInfo | undefined;
  let policyDomain: string | undefined;
  if (a.dmarc?.result === 'pass') {
    via = 'direct';
    headerPolicy = a.dmarc.policy;
    policyDomain = a.dmarc.headerFrom ?? a.from?.domain;
  } else if (a.arcRescue) {
    via = 'arc';
    headerPolicy = a.arcRescue.policy;
    policyDomain = a.arcRescue.headerFrom;
  } else {
    return { ...base, state: 'unprotected', reason: failReason(a.dmarc?.result), via: null };
  }

  const v: Verdict = {
    ...base,
    state: 'authenticated',
    reason: 'policy-unknown',
    via,
    needsPolicy: headerPolicy === undefined,
  };
  if (policyDomain) v.policyDomain = policyDomain;
  if (via === 'arc') v.sealer = a.arcRescue?.sealer ?? null;

  const policy = headerPolicy ?? dnsPolicy ?? undefined;
  if (!policy) return v;
  v.policy = policy;

  if (isEnforcedReject(policy)) {
    v.state = 'verified';
    v.reason = 'policy-reject';
  } else if (policy.p === 'reject') {
    v.reason = 'policy-partial';
  } else if (policy.p === 'quarantine') {
    v.reason = 'policy-quarantine';
  } else {
    v.reason = 'policy-none';
  }
  return v;
}
