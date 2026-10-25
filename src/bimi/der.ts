/**
 * Minimal, bounds-checked DER reader: just enough ASN.1 to parse X.509 mark
 * certificates. Every read is checked against the buffer length, so malformed
 * input throws instead of reading out of range.
 */

export interface Tlv {
  /** Full identifier octet (class + constructed bit + tag number < 31). */
  tag: number;
  /** Offset of the identifier octet. */
  start: number;
  /** Offset of the first content octet. */
  valueStart: number;
  /** Offset just past the content. */
  end: number;
}

export class DerError extends Error {}

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  T61_STRING: 0x14,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  BMP_STRING: 0x1e,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

export function readTlv(buf: Uint8Array, offset: number, limit = buf.length): Tlv {
  if (offset + 2 > limit) throw new DerError('DER: truncated header');
  const tag = buf[offset] as number;
  if ((tag & 0x1f) === 0x1f) throw new DerError('DER: high tag numbers not supported');
  let len = buf[offset + 1] as number;
  let p = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new DerError('DER: unsupported length');
    if (p + n > limit) throw new DerError('DER: truncated length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + (buf[p + i] as number);
    p += n;
  }
  if (p + len > limit) throw new DerError('DER: content exceeds buffer');
  return { tag, start: offset, valueStart: p, end: p + len };
}

/** Children of a constructed TLV. */
export function children(buf: Uint8Array, tlv: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = tlv.valueStart; p < tlv.end;) {
    const c = readTlv(buf, p, tlv.end);
    out.push(c);
    p = c.end;
  }
  return out;
}

export function expect(t: Tlv | undefined, tag: number, what: string): Tlv {
  if (!t || t.tag !== tag) throw new DerError(`DER: expected ${what}`);
  return t;
}

export function bytes(buf: Uint8Array, t: Tlv): Uint8Array {
  return buf.subarray(t.valueStart, t.end);
}

/** The complete encoding (header + content), e.g. to compare names or import keys. */
export function raw(buf: Uint8Array, t: Tlv): Uint8Array {
  return buf.subarray(t.start, t.end);
}

export function oid(buf: Uint8Array, t: Tlv): string {
  const b = bytes(buf, expect(t, TAG.OID, 'OID'));
  if (b.length === 0) throw new DerError('DER: empty OID');
  const first = b[0] as number;
  const parts = [
    Math.min(2, Math.floor(first / 40)),
    first - 40 * Math.min(2, Math.floor(first / 40)),
  ];
  let v = 0;
  for (let i = 1; i < b.length; i++) {
    const x = b[i] as number;
    v = v * 128 + (x & 0x7f);
    if (!(x & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join('.');
}

export function string(buf: Uint8Array, t: Tlv): string {
  const b = bytes(buf, t);
  if (t.tag === TAG.BMP_STRING) {
    let s = '';
    for (let i = 0; i + 1 < b.length; i += 2)
      s += String.fromCharCode(((b[i] as number) << 8) | (b[i + 1] as number));
    return s;
  }
  return new TextDecoder('utf-8').decode(b);
}

export function time(buf: Uint8Array, t: Tlv): Date {
  const s = new TextDecoder('ascii').decode(bytes(buf, t));
  const m =
    t.tag === TAG.UTC_TIME
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
      : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) throw new DerError('DER: bad time');
  let year = Number(m[1]);
  if (t.tag === TAG.UTC_TIME) year += year < 50 ? 2000 : 1900;
  return new Date(
    Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])),
  );
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
