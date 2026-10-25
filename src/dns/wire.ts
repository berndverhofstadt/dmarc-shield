/** Minimal DNS wire format (RFC 1035) for RFC 8484 DoH: one TXT question, parse TXT answers. */

export const TYPE_TXT = 16;
export const RCODE_NOERROR = 0;
export const RCODE_NXDOMAIN = 3;

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;
const UNDERSCORE_LABEL = /^_[a-z0-9-]{1,62}$/i;

export function isValidQueryName(name: string): boolean {
  const labels = name.replace(/\.$/, '').split('.');
  return (
    name.length <= 253 &&
    labels.length >= 2 &&
    // Service labels such as `_dmarc` and `_bimi` may appear anywhere but the TLD.
    labels.every((l, i) => LABEL.test(l) || (i < labels.length - 1 && UNDERSCORE_LABEL.test(l)))
  );
}

export function encodeQuery(name: string, qtype = TYPE_TXT): Uint8Array {
  if (!isValidQueryName(name)) throw new Error(`invalid DNS name: ${name}`);
  const labels = name.replace(/\.$/, '').split('.');
  const qname = labels.flatMap((l) => [l.length, ...Array.from(l, (c) => c.charCodeAt(0))]);
  // ID 0 (RFC 8484 §4.1, cache-friendly), flags: RD=1
  const header = [0, 0, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0];
  return Uint8Array.from([...header, ...qname, 0, qtype >> 8, qtype & 0xff, 0, 1]);
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface DnsAnswer {
  type: number;
  data: Uint8Array;
}

export interface DnsResponse {
  rcode: number;
  truncated: boolean;
  answers: DnsAnswer[];
}

function skipName(buf: Uint8Array, off: number): number {
  for (let guard = 0; guard < 128; guard++) {
    const len = buf[off];
    if (len === undefined) throw new Error('DNS: truncated name');
    if (len === 0) return off + 1;
    if ((len & 0xc0) === 0xc0) return off + 2; // compression pointer ends the name
    off += len + 1;
  }
  throw new Error('DNS: name too long');
}

export function decodeResponse(buf: Uint8Array): DnsResponse {
  if (buf.length < 12) throw new Error('DNS: short response');
  const u16 = (o: number) => {
    if (o + 1 >= buf.length) throw new Error('DNS: truncated');
    return ((buf[o] as number) << 8) | (buf[o + 1] as number);
  };
  const flags = u16(2);
  if (!(flags & 0x8000)) throw new Error('DNS: not a response');
  const qd = u16(4);
  const an = u16(6);
  let off = 12;
  for (let i = 0; i < qd; i++) off = skipName(buf, off) + 4;
  const answers: DnsAnswer[] = [];
  for (let i = 0; i < an; i++) {
    off = skipName(buf, off);
    const type = u16(off);
    const rdlen = u16(off + 8);
    off += 10;
    if (off + rdlen > buf.length) throw new Error('DNS: truncated rdata');
    answers.push({ type, data: buf.slice(off, off + rdlen) });
    off += rdlen;
  }
  return { rcode: flags & 0x000f, truncated: (flags & 0x0200) !== 0, answers };
}

/** A TXT RR is one or more <character-string>s; concatenate them (RFC 7208 §3.3 / RFC 7489 §6.6.3). */
export function txtValue(data: Uint8Array): string {
  const bytes: number[] = [];
  for (let off = 0; off < data.length;) {
    const len = data[off] as number;
    bytes.push(...data.slice(off + 1, off + 1 + len));
    off += len + 1;
  }
  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
}
