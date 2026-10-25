/**
 * ARC (RFC 8617) analysis without cryptographic verification.
 *
 * We can't verify ARC signatures in the client (no raw MIME body, no DNS by
 * default), so we only use ARC when the *receiving* server vouches for the
 * chain, and we treat every other ARC header as forgeable.
 */
import { type AuthResults, type ResInfo, firstResult, parseAuthResults } from './authres';
import type { Header } from './headers';

export interface ArcSet {
  instance: number;
  seals: Header[];
  signatures: Header[];
  results: (AuthResults & { index: number })[];
  cv?: string;
}

export type ArcStructure = 'none' | 'valid' | 'broken' | 'failed';
export type ArcReceiverSource = 'top-ar' | 'compauth' | 'receiver-aar';

export interface ArcAnalysis {
  structure: ArcStructure;
  sets: ArcSet[];
  /** The receiving server's own ARC verdict, if it recorded one we can trust. */
  receiver: { result: 'pass' | 'fail' | 'none'; source: ArcReceiverSource } | null;
  /** First sealer's (i=1) view of the original message. */
  original?: { authservId: string | null; dmarc?: ResInfo; headerFrom?: string };
}

/** Parse a DKIM-style tag list (`i=1; a=rsa-sha256; cv=none; …`). */
export function parseTagList(value: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim().toLowerCase();
    if (k && !(k in tags)) tags[k] = part.slice(eq + 1).replace(/\s+/g, '');
  }
  return tags;
}

function instanceOf(value: string): number | null {
  const m = /(?:^|;)\s*i\s*=\s*(\d+)\s*(?:;|$)/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 50 ? n : null;
}

function normalizeArcResult(r: string | undefined): 'pass' | 'fail' | 'none' {
  return r === 'pass' ? 'pass' : r === 'fail' ? 'fail' : 'none';
}

const MAX_INSTANCES = 50;

/** @param topAr the trusted Authentication-Results of the receiving hop (with its header index) */
export function analyzeArc(
  headers: readonly Header[],
  topAr: (AuthResults & { index: number }) | null,
): ArcAnalysis {
  const byInstance = new Map<number, ArcSet>();
  let unnumbered = false;
  const get = (i: number) => {
    let s = byInstance.get(i);
    if (!s) {
      s = { instance: i, seals: [], signatures: [], results: [] };
      byInstance.set(i, s);
    }
    return s;
  };

  for (const h of headers) {
    if (h.lname === 'arc-seal' || h.lname === 'arc-message-signature') {
      const i = instanceOf(h.value);
      if (i === null) {
        unnumbered = true;
        continue;
      }
      const set = get(i);
      if (h.lname === 'arc-seal') {
        set.seals.push(h);
        set.cv ??= parseTagList(h.value).cv?.toLowerCase();
      } else {
        set.signatures.push(h);
      }
    } else if (h.lname === 'arc-authentication-results') {
      const ar = parseAuthResults(h.value, { arc: true });
      if (ar.instance === undefined) {
        unnumbered = true;
        continue;
      }
      get(ar.instance).results.push({ ...ar, index: h.index });
    }
  }

  const sets = [...byInstance.values()].sort((a, b) => a.instance - b.instance);
  const out: ArcAnalysis = { structure: 'none', sets, receiver: null };

  if (sets.length > 0 || unnumbered) {
    const n = sets.length;
    const contiguous = sets.every((s, k) => s.instance === k + 1) && n <= MAX_INSTANCES;
    const complete = sets.every(
      (s) => s.seals.length === 1 && s.signatures.length === 1 && s.results.length === 1,
    );
    const cvOk = sets.every((s) => (s.instance === 1 ? s.cv === 'none' : s.cv === 'pass'));
    const failed = sets.some((s) => s.cv === 'fail');
    out.structure = failed
      ? 'failed'
      : !unnumbered && contiguous && complete && cvOk
        ? 'valid'
        : 'broken';
  }

  // Receiver verdict, in order of trust.
  // Gmail writes `arc=` as its own resinfo; some receivers append it as a property of dmarc.
  const topArc = firstResult(topAr, 'arc')?.result ?? firstResult(topAr, 'dmarc')?.props.arc;
  const compauth = firstResult(topAr, 'compauth');
  if (topArc) {
    out.receiver = { result: normalizeArcResult(topArc.toLowerCase()), source: 'top-ar' };
  } else if (compauth?.result === 'pass' && /^13\d$/.test(compauth.reason ?? '')) {
    // Exchange Online: compauth reason 130 = "ARC result used to override DMARC failure".
    out.receiver = { result: 'pass', source: 'compauth' };
  } else if (topAr && sets.length > 0) {
    const highest = sets[sets.length - 1] as ArcSet;
    const aar = highest.results[0];
    // Only trust it if the receiving hop added it, i.e. it sits above the trusted A-R.
    if (aar && highest.results.length === 1 && aar.index < topAr.index) {
      const arc = firstResult(aar, 'arc');
      if (arc) out.receiver = { result: normalizeArcResult(arc.result), source: 'receiver-aar' };
    }
  }

  const first = sets[0];
  const firstAar =
    first?.instance === 1 && first.results.length === 1 ? first.results[0] : undefined;
  if (firstAar) {
    const dmarc = firstResult(firstAar, 'dmarc');
    out.original = { authservId: firstAar.authservId };
    if (dmarc) {
      out.original.dmarc = dmarc;
      const hf = dmarc.props['header.from'];
      if (hf) out.original.headerFrom = hf.toLowerCase();
    }
  }

  return out;
}
