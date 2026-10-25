/**
 * Minimal RFC 5322 mailbox extraction for From / Reply-To.
 *
 * We deliberately take the address from the angle-addr, never from the
 * display name: `"security@bank.example" <x@evil.example>` is x@evil.example.
 */
import { toASCII } from './punycode';

export interface Mailbox {
  address: string;
  /** Lower-cased ASCII (punycode) domain, no trailing dot. */
  domain: string;
  /** Decoded display name, if any. */
  displayName: string;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset.toLowerCase(), { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Decode RFC 2047 encoded-words (`=?charset?B|Q?…?=`). */
export function decodeEncodedWords(s: string): string {
  return s
    .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?[^?]+\?[bBqQ]\?[^?]*\?=)/g, '$1')
    .replace(
      /=\?([^?*]+)(?:\*[^?]*)?\?([bBqQ])\?([^?]*)\?=/g,
      (whole, charset: string, enc: string, text: string) => {
        try {
          let bytes: Uint8Array;
          if (enc.toUpperCase() === 'B') {
            const bin = atob(text);
            bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          } else {
            const t = text.replace(/_/g, ' ');
            const arr: number[] = [];
            for (let i = 0; i < t.length; i++) {
              const hex = t.slice(i + 1, i + 3);
              if (t[i] === '=' && /^[0-9a-f]{2}$/i.test(hex)) {
                arr.push(parseInt(hex, 16));
                i += 2;
              } else {
                arr.push(t.charCodeAt(i) & 0xff);
              }
            }
            bytes = Uint8Array.from(arr);
          }
          return decodeBytes(bytes, charset);
        } catch {
          return whole;
        }
      },
    );
}

/** Split on top-level commas (outside quotes, comments and angle brackets). */
function splitList(value: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  let angle = false;
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i] as string;
    if (quoted) {
      cur += c;
      if (c === '\\') cur += value[++i] ?? '';
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"' && depth === 0) quoted = true;
    else if (c === '(') depth++;
    else if (c === ')' && depth > 0) depth--;
    else if (c === '<' && depth === 0) angle = true;
    else if (c === '>' && depth === 0) angle = false;
    else if (c === ',' && depth === 0 && !angle) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function stripComments(s: string): string {
  let out = '';
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (quoted) {
      out += c;
      if (c === '\\') out += s[++i] ?? '';
      else if (c === '"') quoted = false;
    } else if (c === '"' && depth === 0) {
      quoted = true;
      out += c;
    } else if (c === '(') depth++;
    else if (c === ')' && depth > 0) depth--;
    else if (depth === 0) out += c;
  }
  return out;
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 0) return '';
  let d = address
    .slice(at + 1)
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!d) return '';
  try {
    d = toASCII(d);
  } catch {
    d = d.toLowerCase();
  }
  return d;
}

export function parseMailbox(part: string): Mailbox | null {
  const s = stripComments(part).trim();
  const lt = s.lastIndexOf('<');
  const gt = s.lastIndexOf('>');
  let address: string;
  let display = '';
  if (lt >= 0 && gt > lt) {
    address = s.slice(lt + 1, gt).trim();
    // obsolete route syntax: <@a,@b:user@host>
    const colon = address.lastIndexOf(':');
    if (address.startsWith('@') && colon > 0) address = address.slice(colon + 1);
    display = s.slice(0, lt).trim();
  } else {
    address = s;
  }
  address = address.replace(/\s+/g, '');
  if (!address.includes('@')) return null;
  display = decodeEncodedWords(display)
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\(.)/g, '$1')
    .trim();
  const domain = domainOf(address);
  if (!domain) return null;
  return { address, domain, displayName: display };
}

export function parseMailboxList(value: string): Mailbox[] {
  // Strip group syntax: `Group name: a@b, c@d;`
  const v = value.replace(/^[^"<@(]*:\s*/, '').replace(/;\s*$/, '');
  return splitList(v)
    .map(parseMailbox)
    .filter((m): m is Mailbox => m !== null);
}

/** Return the first address embedded in a display name, if any (e.g. `"ceo@corp.example"`). */
export function addressInDisplayName(displayName: string): string | null {
  const m = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(displayName);
  return m ? m[0] : null;
}

// Second-level labels commonly used under ccTLDs (co.uk, com.au, ne.jp, …).
const GENERIC_SLD = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gob',
  'gov',
  'go',
  'gv',
  'ltd',
  'me',
  'mil',
  'ne',
  'net',
  'nhs',
  'nic',
  'or',
  'org',
  'plc',
  'sch',
]);

/**
 * Heuristic organisational domain, used only for notices (Reply-To, DKIM
 * alignment) and for choosing between p= and sp= in header comments. DMARC
 * policy discovery itself uses the DNS tree walk, which needs no suffix list.
 */
export function orgDomainGuess(domain: string): string {
  const labels = domain.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1] as string;
  const sld = labels[labels.length - 2] as string;
  const n = tld.length === 2 && GENERIC_SLD.has(sld) ? 3 : 2;
  return labels.slice(-n).join('.');
}

export function relaxedAligned(a: string, b: string): boolean {
  return orgDomainGuess(a) === orgDomainGuess(b);
}
