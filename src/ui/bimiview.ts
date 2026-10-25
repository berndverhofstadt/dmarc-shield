/** BIMI section view model: outcome → tone, badge, text and logo. Pure. */
import type { BimiEligibility } from '../bimi/eligibility';
import type { BimiOutcome } from '../bimi/lookup';
import { type MessageKey, t } from '../i18n';
import { toUnicode } from '../parser/punycode';

export type BimiState =
  | { kind: 'ineligible'; reason: Exclude<BimiEligibility, 'eligible' | 'needs-policy'> }
  | { kind: 'off'; domain: string }
  | { kind: 'checking'; domain: string }
  /** `message` is already localised; `retry` lists other resolvers to offer. */
  | { kind: 'error'; message: string; retry?: readonly string[] }
  | { kind: 'outcome'; outcome: BimiOutcome };

export interface BimiView {
  tone: 'green' | 'blue' | 'grey';
  badge: string;
  text: string[];
  /** SVG source to render as an image (never inline). */
  logoSvg?: string;
  logoAlt?: string;
  /** Show the "check" / "always" buttons. */
  offer: boolean;
  /** A rejected certificate is worth a warning style. */
  warn?: boolean;
}

export function bimiView(s: BimiState): BimiView {
  switch (s.kind) {
    case 'ineligible':
      return {
        tone: 'grey',
        badge: t('bimi.badge.none'),
        text: [t(`bimi.${s.reason}`)],
        offer: false,
      };
    case 'off':
      return { tone: 'grey', badge: t('bimi.badge.unchecked'), text: [t('bimi.off')], offer: true };
    case 'checking':
      return {
        tone: 'grey',
        badge: t('bimi.badge.unchecked'),
        text: [t('bimi.checking', { domain: toUnicode(s.domain) })],
        offer: false,
      };
    case 'error':
      return {
        tone: 'grey',
        badge: t('bimi.badge.unchecked'),
        text: [t('bimi.error', { message: s.message })],
        // With alternative resolvers on offer, those buttons replace the generic ones.
        offer: !s.retry?.length,
      };
    case 'outcome':
      return outcomeView(s.outcome);
  }
}

function outcomeView(o: BimiOutcome): BimiView {
  const domain = toUnicode(o.domain);
  const alt = t('bimi.logoAlt', { domain });
  switch (o.kind) {
    case 'none':
      return {
        tone: 'grey',
        badge: t('bimi.badge.none'),
        text: [t('bimi.none', { domain })],
        offer: false,
      };
    case 'declined':
      return {
        tone: 'grey',
        badge: t('bimi.badge.none'),
        text: [t('bimi.declined', { domain })],
        offer: false,
      };
    case 'invalid':
      return {
        tone: 'grey',
        badge: t('bimi.badge.invalid'),
        text: [t('bimi.invalid', { domain, reason: t(`bimi.reason.${o.reason}` as MessageKey) })],
        offer: false,
        warn: true,
      };
    case 'verified': {
      const text = o.mark
        ? t(`bimi.verified.${o.mark.kind}`, { holder: o.mark.holder || domain, root: o.mark.root })
        : t('bimi.verified.receiver');
      return {
        tone: 'green',
        badge: t('bimi.badge.verified'),
        text: [text],
        logoSvg: o.logoSvg,
        logoAlt: alt,
        offer: false,
      };
    }
    case 'logo': {
      const text = [
        t(o.cert === 'unreachable' ? 'bimi.logo.unreachable' : 'bimi.logo.nocert', { domain }),
      ];
      if (!o.logoSvg) text.push(t('bimi.logo.missing'));
      const v: BimiView = { tone: 'blue', badge: t('bimi.badge.logo'), text, offer: false };
      if (o.logoSvg) {
        v.logoSvg = o.logoSvg;
        v.logoAlt = alt;
      }
      return v;
    }
  }
}

/**
 * Render an SVG as an <img> data URL. Images never run scripts or load external
 * resources, so an untrusted logo can't do anything but be displayed.
 */
export function svgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}
