/**
 * Presentation logic: verdict + analysis → localised strings. Pure (no DOM, no
 * Office), so it is unit-tested alongside the parser.
 */
import { type MessageKey, hasKey, t } from '../i18n';
import type { Analysis, Finding } from '../parser/analyze';
import type { PolicyInfo } from '../parser/policy';
import { toUnicode } from '../parser/punycode';
import type { Verdict, VerdictState } from '../parser/verdict';

export type DisplayState = VerdictState | 'loading' | 'noitem' | 'error';

/** Visual treatment per state; colour is never the only signal (icon + text too). */
export const SHIELD: Record<
  DisplayState,
  { tone: 'green' | 'blue' | 'red' | 'grey'; glyph: 'check' | 'cross' | 'question' | 'dots' }
> = {
  verified: { tone: 'green', glyph: 'check' },
  authenticated: { tone: 'blue', glyph: 'check' },
  unprotected: { tone: 'red', glyph: 'cross' },
  unsupported: { tone: 'grey', glyph: 'question' },
  noitem: { tone: 'grey', glyph: 'question' },
  error: { tone: 'grey', glyph: 'question' },
  loading: { tone: 'grey', glyph: 'dots' },
};

export interface VerdictView {
  state: DisplayState;
  title: string;
  summary: string;
  via?: string;
}

/** Unicode form for reading; IDNs also show the ASCII form, so homoglyphs are visible. */
const display = (domain: string | undefined): string => {
  if (!domain) return '?';
  const u = toUnicode(domain);
  return u === domain.toLowerCase() ? u : `${u} (${domain.toLowerCase()})`;
};

/** The domain the verdict is about, for messages. */
export function subjectDomain(v: Verdict, a: Analysis): string {
  return display(v.policyDomain ?? a.dmarc?.headerFrom ?? a.from?.domain);
}

export function verdictView(v: Verdict, a: Analysis): VerdictView {
  const domain = subjectDomain(v, a);
  const view: VerdictView = {
    state: v.state,
    title: t(`state.${v.state}`),
    summary: t(`reason.${v.reason}`, { domain, result: a.dmarc?.result ?? '' }),
  };
  if (v.via === 'arc') view.via = t('via.arc', { sealer: v.sealer ?? t('via.arc.unknown') });
  return view;
}

export function simpleView(
  state: 'loading' | 'noitem' | 'error' | 'unsupported',
  message?: string,
): VerdictView {
  const reason: Record<typeof state, MessageKey> = {
    loading: 'state.loading',
    noitem: 'reason.noitem',
    error: 'reason.error',
    unsupported: 'reason.unsupported',
  };
  return {
    state,
    title: t(`state.${state}`),
    summary: state === 'loading' ? '' : t(reason[state], { message: message ?? '' }),
  };
}

export function findingText(f: Finding): string {
  const key = `finding.${f.code}`;
  const params = Object.fromEntries(
    Object.entries(f.params ?? {}).map(([k, v]) => [
      k,
      /domain|from|replyTo|other|headerFrom/i.test(k) ? display(v) : v,
    ]),
  );
  return hasKey(key) ? t(key, params) : f.code;
}

export function resultLabel(result: string): string {
  const key = `result.${result}`;
  return hasKey(key) ? t(key) : result;
}

export function policyText(p: PolicyInfo | undefined): string {
  if (!p) return t('policy.unknown');
  const base = t(`policy.${p.p}`);
  const partial = (p.pct !== undefined && p.pct < 100) || p.testing;
  const value = partial ? t('policy.partial', { policy: base }) : base;
  const source =
    p.source === 'dns'
      ? t('policy.source.dns', { resolver: p.resolver ?? 'DNS' })
      : t(`policy.source.${p.source}`);
  return `${value} (${source})`;
}

export type Tone = 'pass' | 'fail' | 'neutral';

export interface DetailRow {
  label: string;
  /** Raw result for styling; undefined for info-only rows. */
  result?: string;
  tone?: Tone;
  badge?: string;
  info: { label: string; value: string }[];
}

function tone(result: string): Tone {
  if (result === 'pass') return 'pass';
  if (result === 'fail' || result === 'softfail' || result === 'permerror') return 'fail';
  return 'neutral';
}

function row(label: string, result: string | undefined, info: DetailRow['info']): DetailRow {
  if (result === undefined) {
    return { label, result: 'missing', tone: 'neutral', badge: t('details.notPresent'), info };
  }
  return { label, result, tone: tone(result), badge: resultLabel(result), info };
}

export function detailRows(a: Analysis, v: Verdict): DetailRow[] {
  const rows: DetailRow[] = [];
  if (a.from) {
    rows.push({ label: t('details.sender'), info: [{ label: '', value: a.from.address }] });
  }

  const dmarcInfo: DetailRow['info'] = [];
  if (a.dmarc?.headerFrom)
    dmarcInfo.push({ label: t('details.domain'), value: display(a.dmarc.headerFrom) });
  if (v.state === 'verified' || v.state === 'authenticated' || a.dmarc?.policy) {
    dmarcInfo.push({ label: t('details.policy'), value: policyText(v.policy ?? a.dmarc?.policy) });
  }
  if (a.dmarc?.action) dmarcInfo.push({ label: t('details.action'), value: a.dmarc.action });
  rows.push(row(t('details.dmarc'), a.dmarc?.result, dmarcInfo));

  rows.push(
    row(
      t('details.spf'),
      a.spf?.result,
      a.spf?.mailfrom ? [{ label: t('details.mailfrom'), value: a.spf.mailfrom }] : [],
    ),
  );

  if (a.dkim.length === 0) rows.push(row(t('details.dkim'), undefined, []));
  for (const d of a.dkim) {
    rows.push(
      row(
        t('details.dkim'),
        d.result,
        d.domain ? [{ label: t('details.signedBy'), value: display(d.domain) }] : [],
      ),
    );
  }

  if (a.arc.receiver || a.arc.structure !== 'none') {
    const info: DetailRow['info'] = [];
    if (a.arc.original?.authservId)
      info.push({ label: t('details.forwarder'), value: a.arc.original.authservId });
    rows.push(
      row(
        t('details.arc'),
        a.arc.receiver?.result ?? (a.arc.structure === 'valid' ? 'none' : a.arc.structure),
        info,
      ),
    );
  }

  if (a.compauth) {
    rows.push(
      row(
        t('details.compauth'),
        a.compauth.result,
        a.compauth.reason ? [{ label: t('details.reason'), value: a.compauth.reason }] : [],
      ),
    );
  }
  return rows;
}

/** Info-bar text, ≤150 characters as required by notificationMessages. */
export function infobarText(v: Verdict, a: Analysis): string {
  let domain = subjectDomain(v, a);
  if (domain.length > 60) domain = domain.slice(0, 57) + '…';
  const key: MessageKey =
    v.reason === 'internal'
      ? 'infobar.internal'
      : v.state === 'verified'
        ? 'infobar.verified'
        : v.state === 'authenticated'
          ? 'infobar.authenticated'
          : 'infobar.unprotected';
  const text = t(key, { domain });
  return text.length <= 150 ? text : text.slice(0, 149) + '…';
}
