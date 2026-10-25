/** X.509 certificate parsing (RFC 5280) for BIMI mark certificates. */
import {
  DerError,
  TAG,
  type Tlv,
  bytes,
  children,
  expect,
  oid,
  raw,
  readTlv,
  string,
  time,
} from './der';

export const OID = {
  EKU: '2.5.29.37',
  SAN: '2.5.29.17',
  BASIC_CONSTRAINTS: '2.5.29.19',
  LOGOTYPE: '1.3.6.1.5.5.7.1.12',
  EKU_BIMI: '1.3.6.1.5.5.7.3.31',
  MARK_TYPE: '1.3.6.1.4.1.53087.1.13',
  COMMON_NAME: '2.5.4.3',
  ORGANIZATION: '2.5.4.10',
} as const;

export interface Certificate {
  der: Uint8Array;
  tbs: Uint8Array;
  sigAlg: string;
  /** DER of the signatureAlgorithm parameters (for RSASSA-PSS), if present. */
  sigAlgParams?: Uint8Array;
  signature: Uint8Array;
  issuerRaw: Uint8Array;
  subjectRaw: Uint8Array;
  issuer: Map<string, string>;
  subject: Map<string, string>;
  notBefore: Date;
  notAfter: Date;
  /** SubjectPublicKeyInfo DER, for crypto.subtle.importKey('spki'). */
  spki: Uint8Array;
  keyAlg: string;
  /** Named curve OID for EC keys. */
  keyCurve?: string;
  extensions: Map<string, { critical: boolean; value: Uint8Array }>;
}

function parseName(buf: Uint8Array, t: Tlv): Map<string, string> {
  const out = new Map<string, string>();
  for (const rdn of children(buf, expect(t, TAG.SEQUENCE, 'Name'))) {
    for (const atv of children(buf, expect(rdn, TAG.SET, 'RDN'))) {
      const [type, value] = children(buf, expect(atv, TAG.SEQUENCE, 'AttributeTypeAndValue'));
      if (!type || !value) continue;
      const k = oid(buf, type);
      if (!out.has(k)) out.set(k, string(buf, value));
    }
  }
  return out;
}

export function parseCertificate(der: Uint8Array): Certificate {
  const top = expect(readTlv(der, 0), TAG.SEQUENCE, 'Certificate');
  if (top.end !== der.length) throw new DerError('DER: trailing data');
  const [tbsT, algT, sigT] = children(der, top);
  const tbsSeq = expect(tbsT, TAG.SEQUENCE, 'TBSCertificate');
  const alg = children(der, expect(algT, TAG.SEQUENCE, 'AlgorithmIdentifier'));
  const sigBits = bytes(der, expect(sigT, TAG.BIT_STRING, 'signature'));
  if (sigBits[0] !== 0) throw new DerError('DER: unused bits in signature');

  const f = children(der, tbsSeq);
  let i = 0;
  if (f[0] && f[0].tag === 0xa0) i++; // [0] version
  i++; // serialNumber
  i++; // signature (inner AlgorithmIdentifier)
  const issuerT = f[i++];
  const validityT = f[i++];
  const subjectT = f[i++];
  const spkiT = expect(f[i++], TAG.SEQUENCE, 'SubjectPublicKeyInfo');
  const [nb, na] = children(der, expect(validityT, TAG.SEQUENCE, 'Validity'));
  if (!nb || !na) throw new DerError('DER: bad validity');

  const keyAlgSeq = children(der, expect(children(der, spkiT)[0], TAG.SEQUENCE, 'key algorithm'));
  const cert: Certificate = {
    der,
    tbs: raw(der, tbsSeq),
    sigAlg: oid(der, alg[0] as Tlv),
    signature: sigBits.subarray(1),
    issuerRaw: raw(der, expect(issuerT, TAG.SEQUENCE, 'issuer')),
    subjectRaw: raw(der, expect(subjectT, TAG.SEQUENCE, 'subject')),
    issuer: parseName(der, issuerT as Tlv),
    subject: parseName(der, subjectT as Tlv),
    notBefore: time(der, nb),
    notAfter: time(der, na),
    spki: raw(der, spkiT),
    keyAlg: oid(der, keyAlgSeq[0] as Tlv),
    extensions: new Map(),
  };
  if (alg[1] && alg[1].tag !== TAG.NULL) cert.sigAlgParams = raw(der, alg[1]);
  if (keyAlgSeq[1]?.tag === TAG.OID) cert.keyCurve = oid(der, keyAlgSeq[1]);

  // [3] extensions
  const extWrap = f.slice(i).find((x) => x.tag === 0xa3);
  if (extWrap) {
    const seq = expect(children(der, extWrap)[0], TAG.SEQUENCE, 'Extensions');
    for (const ext of children(der, seq)) {
      const parts = children(der, ext);
      const id = oid(der, parts[0] as Tlv);
      const critical = parts[1]?.tag === TAG.BOOLEAN && (bytes(der, parts[1])[0] ?? 0) !== 0;
      const valueT = expect(parts[parts.length - 1], TAG.OCTET_STRING, 'extnValue');
      if (!cert.extensions.has(id))
        cert.extensions.set(id, { critical, value: bytes(der, valueT) });
    }
  }
  return cert;
}

/** Split a PEM bundle into DER certificates. */
export function pemToDer(pem: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  const re = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
  for (const m of pem.matchAll(re)) {
    const bin = atob((m[1] as string).replace(/\s+/g, ''));
    out.push(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  return out;
}

export function extendedKeyUsages(c: Certificate): string[] {
  const ext = c.extensions.get(OID.EKU);
  if (!ext) return [];
  const t = readTlv(ext.value, 0);
  return children(ext.value, expect(t, TAG.SEQUENCE, 'EKU')).map((x) => oid(ext.value, x));
}

export function isCa(c: Certificate): boolean {
  const ext = c.extensions.get(OID.BASIC_CONSTRAINTS);
  if (!ext) return false;
  const first = children(ext.value, readTlv(ext.value, 0))[0];
  return first?.tag === TAG.BOOLEAN && (bytes(ext.value, first)[0] ?? 0) !== 0;
}

export function dnsNames(c: Certificate): string[] {
  const ext = c.extensions.get(OID.SAN);
  if (!ext) return [];
  return children(ext.value, readTlv(ext.value, 0))
    .filter((x) => x.tag === 0x82) // [2] dNSName
    .map((x) => new TextDecoder('ascii').decode(bytes(ext.value, x)).toLowerCase());
}

/**
 * Find the logotype image URI (RFC 3709). BIMI certificates embed the logo as
 * `data:image/svg+xml;base64,<gzip>`; we look for the first IA5String URI in the
 * extension that is an SVG data URI.
 */
export function logotypeDataUri(c: Certificate): string | null {
  const ext = c.extensions.get(OID.LOGOTYPE);
  if (!ext) return null;
  const walk = (t: Tlv, depth: number): string | null => {
    if (depth > 12) return null;
    if (t.tag === TAG.IA5_STRING) {
      const s = string(ext.value, t);
      return /^data:image\/svg\+xml/i.test(s) ? s : null;
    }
    if (t.tag & 0x20) {
      for (const ch of children(ext.value, t)) {
        const r = walk(ch, depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(readTlv(ext.value, 0), 0);
}
