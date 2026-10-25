/**
 * Turn a raw header block into evidence: trusted results, ARC, addresses and
 * findings. Pure and synchronous; the verdict is derived in verdict.ts.
 */
import {
  type Mailbox,
  addressInDisplayName,
  domainOf,
  parseMailbox,
  parseMailboxList,
  relaxedAligned,
} from './address';
import { type ArcAnalysis, analyzeArc } from './arc';
import { type AuthResults, firstResult, parseAuthResults, resultsFor } from './authres';
import { type Header, findHeaders, parseHeaders } from './headers';
import { analyzeDomain, looksLike } from './lookalike';
import { type PolicyInfo, policyFromResInfo } from './policy';
import { toASCII } from './punycode';

export type FindingCode =
  // forgery: always makes the verdict red
  | 'ar-unparseable'
  | 'ar-duplicate-authserv'
  | 'ar-contradiction'
  | 'arc-broken'
  | 'arc-from-mismatch'
  | 'header-from-mismatch'
  | 'multiple-from'
  | 'from-mixed-script'
  | 'from-confusable'
  | 'from-lookalike'
  | 'replyto-lookalike'
  // notices: shown, don't change the verdict
  | 'multiple-hops'
  | 'arc-failed'
  | 'replyto-differs'
  | 'display-name-address'
  | 'compauth-fail'
  | 'dkim-unaligned'
  | 'idn-from';

export interface Finding {
  code: FindingCode;
  severity: 'forgery' | 'notice';
  params?: Record<string, string>;
}

export type IndexedAuthResults = AuthResults & { index: number; raw: string };

export interface Analysis {
  internal: boolean;
  topAr: IndexedAuthResults | null;
  otherArs: IndexedAuthResults[];
  dmarc?: { result: string; headerFrom?: string; action?: string; policy?: PolicyInfo };
  spf?: { result: string; mailfrom?: string };
  dkim: { result: string; domain?: string; selector?: string }[];
  compauth?: { result: string; reason?: string };
  arc: ArcAnalysis;
  arcRescue?: { sealer: string | null; headerFrom: string; policy?: PolicyInfo };
  from?: Mailbox;
  replyTo: Mailbox[];
  findings: Finding[];
  /** Headers shown for information only. */
  secondary: { name: string; value: string }[];
}

export interface AnalysisContext {
  /** Visible From address, as Outlook shows it (item.from.emailAddress). */
  fromAddress?: string;
  /** The mailbox owner's address, to catch lookalikes of their own domain. */
  userEmail?: string;
}

const SECONDARY = new Set([
  'x-ms-exchange-authentication-results',
  'authentication-results-original',
  'arc-authentication-results',
]);

function sameDomain(a: string, b: string): boolean {
  try {
    return toASCII(a) === toASCII(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

export function analyze(input: string | readonly Header[], ctx: AnalysisContext = {}): Analysis {
  const headers = typeof input === 'string' ? parseHeaders(input) : input;
  const findings: Finding[] = [];
  const forgery = (code: FindingCode, params?: Record<string, string>) =>
    findings.push(params ? { code, severity: 'forgery', params } : { code, severity: 'forgery' });
  const notice = (code: FindingCode, params?: Record<string, string>) =>
    findings.push(params ? { code, severity: 'notice', params } : { code, severity: 'notice' });

  const ars: IndexedAuthResults[] = findHeaders(headers, 'authentication-results').map((h) => ({
    ...parseAuthResults(h.value),
    index: h.index,
    raw: h.value,
  }));

  // Only the topmost A-R is trusted. Some receivers (Proton) split one result over
  // several A-R headers; we merge headers *directly adjacent* to the topmost one with
  // the same (non-empty) authserv-id. A method appearing twice in that block is
  // treated as forgery, so an injected `dmarc=pass` next to a real result can't win.
  const first = ars[0];
  const trusted: IndexedAuthResults[] = [];
  if (first) {
    trusted.push(first);
    for (const r of ars.slice(1)) {
      const prev = trusted[trusted.length - 1] as IndexedAuthResults;
      if (
        first.authservId === null ||
        r.authservId !== first.authservId ||
        r.index !== prev.index + 1
      )
        break;
      trusted.push(r);
    }
  }
  const topAr: IndexedAuthResults | null = first
    ? {
        ...first,
        results: trusted.flatMap((r) => r.results),
        noResult: trusted.every((r) => r.noResult),
        valid: trusted.every((r) => r.valid),
        raw: trusted.map((r) => r.raw).join('\n'),
      }
    : null;
  const otherArs = ars.filter((r) => !trusted.includes(r));

  // Exchange marks mail from its own organisation. It strips X-MS-Exchange-Organization-*
  // from inbound external mail, so this can't be injected by an outside sender. As
  // defence in depth we require exactly one such header and no non-Microsoft receiver.
  const authAs = findHeaders(headers, 'x-ms-exchange-organization-authas');
  const microsoftReceiver =
    !topAr || topAr.authservId === null || /(^|\.)(microsoft|outlook)\.com$/.test(topAr.authservId);
  const internal =
    authAs.length === 1 &&
    authAs[0]?.value.trim().toLowerCase() === 'internal' &&
    microsoftReceiver;

  // Addresses
  const fromHeaders = findHeaders(headers, 'from');
  const rawFrom = fromHeaders[0] ? parseMailboxList(fromHeaders[0].value) : [];
  if (fromHeaders.length > 1 || rawFrom.length > 1) forgery('multiple-from');
  const from = (ctx.fromAddress ? parseMailbox(ctx.fromAddress) : null) ?? rawFrom[0];
  const replyTo = findHeaders(headers, 'reply-to').flatMap((h) => parseMailboxList(h.value));

  const a: Analysis = {
    internal,
    topAr,
    otherArs,
    dkim: [],
    arc: analyzeArc(headers, topAr),
    replyTo,
    findings,
    secondary: headers
      .filter((h) => SECONDARY.has(h.lname))
      .map((h) => ({ name: h.name, value: h.value })),
  };
  if (from) a.from = from;

  // Trusted results (topmost A-R only)
  if (topAr) {
    if (!topAr.valid) forgery('ar-unparseable');
    const dmarc = firstResult(topAr, 'dmarc');
    if (dmarc) {
      const headerFrom = dmarc.props['header.from']?.toLowerCase();
      a.dmarc = { result: dmarc.result };
      if (headerFrom) a.dmarc.headerFrom = headerFrom;
      if (dmarc.props.action) a.dmarc.action = dmarc.props.action.toLowerCase();
      const policy = policyFromResInfo(dmarc, headerFrom ?? from?.domain, 'header');
      if (policy) a.dmarc.policy = policy;
      if (headerFrom && from && !sameDomain(headerFrom, from.domain)) {
        forgery('header-from-mismatch', { headerFrom, from: from.domain });
      }
    }
    const spf = firstResult(topAr, 'spf');
    if (spf) {
      a.spf = { result: spf.result };
      const mf = spf.props['smtp.mailfrom'];
      if (mf) a.spf.mailfrom = mf;
    }
    for (const d of resultsFor(topAr, 'dkim')) {
      const domain =
        d.props['header.d'] ?? (d.props['header.i'] ? domainOf(d.props['header.i']) : '');
      const entry: Analysis['dkim'][number] = { result: d.result };
      if (domain) entry.domain = domain.toLowerCase();
      if (d.props['header.s']) entry.selector = d.props['header.s'];
      a.dkim.push(entry);
    }
    const compauth = firstResult(topAr, 'compauth');
    if (compauth) {
      a.compauth = { result: compauth.result };
      if (compauth.reason) a.compauth.reason = compauth.reason;
      if (compauth.result === 'fail' || compauth.result === 'softfail') {
        notice('compauth-fail', { result: compauth.result, reason: compauth.reason ?? '' });
      }
    }

    // Consistency of the trusted block and the other A-R headers
    const methods = topAr.results.map((r) => r.method);
    const repeated = methods.find(
      (m, i) => ['dmarc', 'spf', 'arc', 'compauth'].includes(m) && methods.indexOf(m) !== i,
    );
    if (repeated)
      forgery('ar-duplicate-authserv', { authservId: topAr.authservId ?? '', method: repeated });
    if (topAr.authservId) {
      const dup = otherArs.find((o) => o.authservId === topAr.authservId);
      if (dup) forgery('ar-duplicate-authserv', { authservId: topAr.authservId });
    }
    if (otherArs.length > 0) notice('multiple-hops', { count: String(otherArs.length + 1) });
  }

  // ARC
  const arc = a.arc;
  if (arc.receiver?.result === 'fail') notice('arc-failed');
  if (a.dmarc?.result !== 'pass' && arc.receiver?.result === 'pass') {
    const orig = arc.original;
    if (arc.structure !== 'valid') {
      forgery('arc-broken');
    } else if (orig?.dmarc?.result === 'pass' && orig.headerFrom) {
      if (from && !sameDomain(orig.headerFrom, from.domain)) {
        forgery('arc-from-mismatch', { headerFrom: orig.headerFrom, from: from.domain });
      } else {
        a.arcRescue = { sealer: orig.authservId, headerFrom: orig.headerFrom };
        const policy = policyFromResInfo(orig.dmarc, orig.headerFrom, 'arc');
        if (policy) a.arcRescue.policy = policy;
      }
    }
  }
  if (topAr && a.dmarc?.result !== 'pass' && !a.arcRescue) {
    const claimsPass = otherArs.find((o) => firstResult(o, 'dmarc')?.result === 'pass');
    if (claimsPass) forgery('ar-contradiction', { authservId: claimsPass.authservId ?? '' });
  }

  // From-domain lookalikes
  if (from) {
    const risk = analyzeDomain(from.domain);
    if (risk.mixedScript) forgery('from-mixed-script', { domain: risk.unicode });
    else if (risk.wholeScriptConfusable) forgery('from-confusable', { domain: risk.unicode });
    else if (risk.isIdn) notice('idn-from', { domain: risk.unicode, ascii: from.domain });

    const userDomain = ctx.userEmail ? domainOf(ctx.userEmail) : '';
    if (userDomain && looksLike(from.domain, userDomain)) {
      forgery('from-lookalike', { domain: from.domain, other: userDomain });
    }

    for (const rt of replyTo) {
      if (looksLike(rt.domain, from.domain)) {
        forgery('replyto-lookalike', { replyTo: rt.domain, from: from.domain });
      } else if (!relaxedAligned(rt.domain, from.domain)) {
        notice('replyto-differs', { replyTo: rt.domain, from: from.domain });
      }
    }

    const embedded = addressInDisplayName(from.displayName);
    if (embedded) {
      const d = domainOf(embedded);
      if (d && !relaxedAligned(d, from.domain)) {
        notice('display-name-address', { shown: embedded, actual: from.address });
      }
    }

    const passing = a.dkim.filter((d) => d.result === 'pass' && d.domain);
    if (
      passing.length > 0 &&
      !passing.some((d) => relaxedAligned(d.domain as string, from.domain))
    ) {
      notice('dkim-unaligned', { domain: (passing[0] as { domain: string }).domain });
    }
  }

  return a;
}
