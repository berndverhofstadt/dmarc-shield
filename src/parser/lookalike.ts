/**
 * Offline lookalike / homoglyph detection for domains.
 *
 * - Mixed-script labels (e.g. Latin + Cyrillic in "pаypal") are flagged.
 * - Whole-script confusables (a non-Latin label whose skeleton is plain
 *   ASCII, e.g. all-Cyrillic "аррӏе") are flagged.
 * - Two different domains with the same skeleton are lookalikes
 *   ("paypa1.com" vs "paypal.com", "rnicrosoft.com" vs "microsoft.com").
 *
 * The confusables map is a compact subset of Unicode TR39 `confusables.txt`
 * covering the characters actually abused in domain spoofing.
 */
import { toUnicode } from './punycode';

const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  а: 'a',
  с: 'c',
  ԁ: 'd',
  е: 'e',
  ё: 'e',
  һ: 'h',
  і: 'i',
  ї: 'i',
  ј: 'j',
  ӏ: 'l',
  о: 'o',
  р: 'p',
  ԛ: 'q',
  г: 'r',
  ѕ: 's',
  ѵ: 'v',
  ԝ: 'w',
  х: 'x',
  у: 'y',
  ү: 'y',
  з: '3',
  ь: 'b',
  // Greek
  α: 'a',
  β: 'b',
  ε: 'e',
  η: 'n',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  γ: 'y',
  ϲ: 'c',
  ϳ: 'j',
  // Armenian
  օ: 'o',
  ս: 'u',
  հ: 'h',
  ո: 'n',
  ց: 'g',
  զ: 'q',
  // Latin look-alikes outside ASCII
  ı: 'i',
  ȷ: 'j',
  ɑ: 'a',
  ɡ: 'g',
  ɩ: 'i',
  ɪ: 'i',
  ʏ: 'y',
  ᴅ: 'd',
  ᴋ: 'k',
  ᴍ: 'm',
  ᴏ: 'o',
  ᴘ: 'p',
  ᴛ: 't',
  ᴜ: 'u',
  ᴠ: 'v',
  ᴡ: 'w',
  ᴢ: 'z',
  ł: 'l',
  đ: 'd',
  ħ: 'h',
  ŀ: 'l',
  ø: 'o',
  // ASCII digits
  '0': 'o',
  '1': 'l',
};

// Multi-character ASCII confusables, applied after single-character mapping.
const ASCII_SEQUENCES: [RegExp, string][] = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/cl/g, 'd'],
];

/** TR39-style skeleton: NFKD, drop marks, lower-case, map confusables. */
export function skeleton(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()) {
    out += CONFUSABLES[ch] ?? ch;
  }
  for (const [re, rep] of ASCII_SEQUENCES) out = out.replace(re, rep);
  return out;
}

const SCRIPTS: [string, RegExp][] = [
  ['Latin', /\p{Script=Latin}/u],
  ['Cyrillic', /\p{Script=Cyrillic}/u],
  ['Greek', /\p{Script=Greek}/u],
  ['Armenian', /\p{Script=Armenian}/u],
  ['Hebrew', /\p{Script=Hebrew}/u],
  ['Arabic', /\p{Script=Arabic}/u],
  ['Georgian', /\p{Script=Georgian}/u],
  ['Han', /\p{Script=Han}/u],
  ['Hiragana', /\p{Script=Hiragana}/u],
  ['Katakana', /\p{Script=Katakana}/u],
  ['Hangul', /\p{Script=Hangul}/u],
  ['Bopomofo', /\p{Script=Bopomofo}/u],
  ['Thai', /\p{Script=Thai}/u],
  ['Devanagari', /\p{Script=Devanagari}/u],
  ['Cherokee', /\p{Script=Cherokee}/u],
];

// TR39 "highly restrictive" allowed combinations.
const ALLOWED_COMBOS = [
  new Set(['Latin', 'Han', 'Hiragana', 'Katakana']),
  new Set(['Latin', 'Han', 'Bopomofo']),
  new Set(['Latin', 'Han', 'Hangul']),
];

export function scriptsOf(label: string): Set<string> {
  const found = new Set<string>();
  for (const ch of label) {
    if (!/\p{L}/u.test(ch)) continue;
    const s = SCRIPTS.find(([, re]) => re.test(ch));
    found.add(s ? s[0] : 'Other');
  }
  return found;
}

export function isMixedScript(label: string): boolean {
  const s = scriptsOf(label);
  if (s.size <= 1) return false;
  return !ALLOWED_COMBOS.some((combo) => [...s].every((x) => combo.has(x)));
}

export interface DomainRisk {
  unicode: string;
  isIdn: boolean;
  mixedScript: boolean;
  /** Non-Latin label that renders like plain ASCII. */
  wholeScriptConfusable: boolean;
}

export function analyzeDomain(domain: string): DomainRisk {
  const unicode = toUnicode(domain);
  const labels = unicode.split('.');
  // eslint-disable-next-line no-control-regex
  const isIdn = !/^[\x00-\x7f]*$/.test(unicode);
  const mixedScript = labels.some(isMixedScript);
  const wholeScriptConfusable = labels.some((l) => {
    const scripts = scriptsOf(l);
    if (scripts.size === 0 || scripts.has('Latin')) return false;
    return /^[a-z0-9-]+$/.test(skeleton(l));
  });
  return { unicode, isIdn, mixedScript, wholeScriptConfusable };
}

/** True if two *different* domains look the same once rendered. */
export function looksLike(a: string, b: string): boolean {
  const ua = toUnicode(a);
  const ub = toUnicode(b);
  if (ua === ub) return false;
  return skeleton(ua) === skeleton(ub);
}
