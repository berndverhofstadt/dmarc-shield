/**
 * Punycode (RFC 3492) and minimal IDNA label conversion, vendored so we don't
 * depend on Node's deprecated `punycode` module or on network-loaded tables.
 * Used for display, lookalike comparison and building DNS query names.
 */

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function digitToBasic(d: number): number {
  return d + 22 + 75 * (d < 26 ? 1 : 0);
}

function basicToDigit(cp: number): number {
  if (cp >= 0x30 && cp <= 0x39) return cp - 22;
  if (cp >= 0x41 && cp <= 0x5a) return cp - 0x41;
  if (cp >= 0x61 && cp <= 0x7a) return cp - 0x61;
  return BASE;
}

/** Decode a punycode string (without the `xn--` prefix). Throws on invalid input. */
export function decode(input: string): string {
  const output: number[] = [];
  const delim = input.lastIndexOf('-');
  const basicEnd = delim < 0 ? 0 : delim;
  for (let j = 0; j < basicEnd; j++) {
    const cp = input.charCodeAt(j);
    if (cp >= 0x80) throw new RangeError('punycode: non-basic code point');
    output.push(cp);
  }

  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let idx = basicEnd > 0 ? basicEnd + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (idx >= input.length) throw new RangeError('punycode: truncated input');
      const digit = basicToDigit(input.charCodeAt(idx++));
      if (digit >= BASE) throw new RangeError('punycode: invalid digit');
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
      if (i > 0x7fffffff) throw new RangeError('punycode: overflow');
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) throw new RangeError('punycode: code point out of range');
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** Encode a Unicode string as punycode (without the `xn--` prefix). */
export function encode(input: string): string {
  const cps = Array.from(input, (c) => c.codePointAt(0) as number);
  const output: string[] = [];
  for (const cp of cps) if (cp < 0x80) output.push(String.fromCharCode(cp));
  const basicLen = output.length;
  let h = basicLen;
  if (basicLen > 0) output.push('-');

  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  while (h < cps.length) {
    let m = 0x10ffff;
    for (const cp of cps) if (cp >= n && cp < m) m = cp;
    delta += (m - n) * (h + 1);
    n = m;
    for (const cp of cps) {
      if (cp < n) delta++;
      if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          output.push(String.fromCharCode(digitToBasic(t + ((q - t) % (BASE - t)))));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(String.fromCharCode(digitToBasic(q)));
        bias = adapt(delta, h + 1, h === basicLen);
        delta = 0;
        h++;
      }
    }
    delta++;
    n++;
  }
  return output.join('');
}

function labels(domain: string): string[] {
  return domain.trim().replace(/\.$/, '').split('.');
}

/** `xn--` labels → Unicode. Invalid labels are left as-is. */
export function toUnicode(domain: string): string {
  return labels(domain)
    .map((l) => {
      if (!/^xn--/i.test(l)) return l.toLowerCase();
      try {
        return decode(l.slice(4).toLowerCase());
      } catch {
        return l.toLowerCase();
      }
    })
    .join('.');
}

/** Unicode labels → `xn--` ASCII form (lower-cased, NFC). */
export function toASCII(domain: string): string {
  return labels(domain)
    .map((l) => {
      const label = l.normalize('NFC').toLowerCase();
      // eslint-disable-next-line no-control-regex
      return /^[\x00-\x7f]*$/.test(label) ? label : 'xn--' + encode(label);
    })
    .join('.');
}
