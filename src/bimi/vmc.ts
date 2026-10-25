/**
 * Validate a BIMI mark certificate (VMC or CMC) entirely in the client.
 *
 * Checks: a leaf with the BIMI extended key usage; a chain whose signatures
 * verify (WebCrypto) up to one of the bundled roots (never a root supplied in
 * the PEM); CA flags on intermediates; validity dates; the sender's domain in
 * the SAN; and an embedded SVG logo. Not checked: revocation (OCSP/CRL) and
 * Certificate Transparency SCTs, which would need more network requests.
 */
import { DerError, TAG, bytes, children, equalBytes, readTlv } from './der';
import { MARK_ROOTS } from './roots';
import {
  type Certificate,
  OID,
  dnsNames,
  extendedKeyUsages,
  isCa,
  logotypeDataUri,
  parseCertificate,
  pemToDer,
} from './x509';

export type MarkKind = 'VMC' | 'CMC';

export type MarkFailure =
  | 'malformed'
  | 'no-bimi-certificate'
  | 'untrusted'
  | 'bad-signature'
  | 'expired'
  | 'not-yet-valid'
  | 'domain-mismatch'
  | 'no-logo';

export type MarkResult =
  | {
      ok: true;
      kind: MarkKind;
      /** Name of the trusted root CA the chain ends in. */
      root: string;
      /** Organisation the mark was issued to. */
      holder: string;
      notAfter: Date;
      /** Decompressed SVG source of the logo embedded in the certificate. */
      logoSvg: string;
    }
  | { ok: false; reason: MarkFailure };

const roots: Certificate[] = MARK_ROOTS.map((r) =>
  parseCertificate(Uint8Array.from(atob(r.der), (c) => c.charCodeAt(0))),
);

// Mark types (BIMI): registered/government marks are VMCs; the rest are CMCs.
const VMC_MARK_TYPES = new Set(['registered mark', 'government mark']);

function hashFor(sigAlg: string): string | null {
  switch (sigAlg) {
    case '1.2.840.113549.1.1.11': // sha256WithRSAEncryption
    case '1.2.840.10045.4.3.2': // ecdsa-with-SHA256
      return 'SHA-256';
    case '1.2.840.113549.1.1.12':
    case '1.2.840.10045.4.3.3':
      return 'SHA-384';
    case '1.2.840.113549.1.1.13':
    case '1.2.840.10045.4.3.4':
      return 'SHA-512';
    default:
      return null;
  }
}

const CURVES: Record<string, { name: string; size: number }> = {
  '1.2.840.10045.3.1.7': { name: 'P-256', size: 32 },
  '1.3.132.0.34': { name: 'P-384', size: 48 },
};

/** ECDSA signatures are DER SEQUENCE{r,s}; WebCrypto wants fixed-size r||s. */
function ecdsaRaw(sig: Uint8Array, size: number): Uint8Array {
  const seq = readTlv(sig, 0);
  const [r, s] = children(sig, seq);
  const out = new Uint8Array(size * 2);
  [r, s].forEach((t, i) => {
    if (!t || t.tag !== TAG.INTEGER) throw new DerError('bad ECDSA signature');
    let v = bytes(sig, t);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new DerError('bad ECDSA signature');
    out.set(v, i * size + (size - v.length));
  });
  return out;
}

const buf = (u: Uint8Array): ArrayBuffer => u.slice().buffer as ArrayBuffer;

export async function verifySignature(child: Certificate, issuer: Certificate): Promise<boolean> {
  const hash = hashFor(child.sigAlg);
  if (!hash) return false;
  const subtle = globalThis.crypto.subtle;
  try {
    if (
      issuer.keyAlg === '1.2.840.113549.1.1.1' &&
      child.sigAlg.startsWith('1.2.840.113549.1.1.')
    ) {
      const key = await subtle.importKey(
        'spki',
        buf(issuer.spki),
        { name: 'RSASSA-PKCS1-v1_5', hash },
        false,
        ['verify'],
      );
      return await subtle.verify('RSASSA-PKCS1-v1_5', key, buf(child.signature), buf(child.tbs));
    }
    const curve = issuer.keyCurve ? CURVES[issuer.keyCurve] : undefined;
    if (
      issuer.keyAlg === '1.2.840.10045.2.1' &&
      curve &&
      child.sigAlg.startsWith('1.2.840.10045.4.3.')
    ) {
      const key = await subtle.importKey(
        'spki',
        buf(issuer.spki),
        { name: 'ECDSA', namedCurve: curve.name },
        false,
        ['verify'],
      );
      return await subtle.verify(
        { name: 'ECDSA', hash },
        key,
        buf(ecdsaRaw(child.signature, curve.size)),
        buf(child.tbs),
      );
    }
  } catch {
    return false;
  }
  return false;
}

function sameName(a: Certificate['issuerRaw'], b: Certificate['subjectRaw']): boolean {
  return equalBytes(a, b);
}

async function gunzipIfNeeded(data: Uint8Array): Promise<Uint8Array> {
  if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
  const stream = new Blob([buf(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function svgFromDataUri(uri: string): Promise<string | null> {
  const m = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/is.exec(uri);
  if (!m) return null;
  let data: Uint8Array;
  if (/;base64/i.test(m[1] ?? '')) {
    const bin = atob((m[2] as string).replace(/\s+/g, ''));
    data = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } else {
    data = new TextEncoder().encode(decodeURIComponent(m[2] as string));
  }
  const text = new TextDecoder('utf-8').decode(await gunzipIfNeeded(data));
  return /<svg[\s>]/i.test(text) ? text : null;
}

export interface ValidateOptions {
  /** Domains the certificate may be for: the From domain and its organisational domain. */
  domains: string[];
  now?: Date;
}

export async function validateMarkCertificate(
  pem: string,
  opts: ValidateOptions,
): Promise<MarkResult> {
  const now = opts.now ?? new Date();
  let certs: Certificate[];
  try {
    certs = pemToDer(pem).map(parseCertificate);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (certs.length === 0) return { ok: false, reason: 'malformed' };

  const leaf = certs.find((c) => extendedKeyUsages(c).includes(OID.EKU_BIMI) && !isCa(c));
  if (!leaf) return { ok: false, reason: 'no-bimi-certificate' };

  // Build the chain: follow issuer names through the supplied intermediates until a bundled root.
  const chain: Certificate[] = [leaf];
  let rootName: string | null = null;
  for (let depth = 0; depth < 5 && rootName === null; depth++) {
    const child = chain[chain.length - 1] as Certificate;
    const root = roots.find((r) => sameName(child.issuerRaw, r.subjectRaw));
    if (root) {
      if (!(await verifySignature(child, root))) return { ok: false, reason: 'bad-signature' };
      rootName = root.subject.get(OID.COMMON_NAME) ?? 'unknown root';
      break;
    }
    const parent = certs.find(
      (c) => c !== child && !chain.includes(c) && sameName(child.issuerRaw, c.subjectRaw),
    );
    if (!parent || !isCa(parent)) return { ok: false, reason: 'untrusted' };
    if (!(await verifySignature(child, parent))) return { ok: false, reason: 'bad-signature' };
    chain.push(parent);
  }
  if (rootName === null) return { ok: false, reason: 'untrusted' };

  for (const c of chain) {
    if (now > c.notAfter) return { ok: false, reason: 'expired' };
    if (now < c.notBefore) return { ok: false, reason: 'not-yet-valid' };
  }

  const names = dnsNames(leaf);
  const wanted = opts.domains.map((d) => d.toLowerCase());
  if (!wanted.some((d) => names.includes(d))) return { ok: false, reason: 'domain-mismatch' };

  const uri = logotypeDataUri(leaf);
  const logoSvg = uri ? await svgFromDataUri(uri).catch(() => null) : null;
  if (!logoSvg) return { ok: false, reason: 'no-logo' };

  const markType = leaf.subject.get(OID.MARK_TYPE)?.trim().toLowerCase();
  return {
    ok: true,
    kind: markType === undefined || VMC_MARK_TYPES.has(markType) ? 'VMC' : 'CMC',
    root: rootName,
    holder: leaf.subject.get(OID.ORGANIZATION) ?? leaf.subject.get(OID.COMMON_NAME) ?? '',
    notAfter: leaf.notAfter,
    logoSvg,
  };
}
