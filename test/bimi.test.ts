import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bimiEligibility } from '../src/bimi/eligibility';
import { bimiFromReceiver, clearBimiCache, lookupBimi } from '../src/bimi/lookup';
import { isDeclination, parseBimiRecord } from '../src/bimi/record';
import { MARK_ROOTS } from '../src/bimi/roots';
import { svgFromDataUri, validateMarkCertificate, verifySignature } from '../src/bimi/vmc';
import {
  dnsNames,
  extendedKeyUsages,
  isCa,
  logotypeDataUri,
  parseCertificate,
  pemToDer,
} from '../src/bimi/x509';
import { DerError, readTlv, oid, string, time } from '../src/bimi/der';
import { encodeQuery, toBase64Url } from '../src/dns/wire';
import { clearDnsCache } from '../src/dns/lookup';
import { analyze } from '../src/parser/analyze';
import { decide } from '../src/parser/verdict';
import { setLocale } from '../src/i18n';
import { bimiView, svgDataUrl } from '../src/ui/bimiview';

const pem = (n: string) => readFileSync(new URL(`./fixtures/bimi/${n}`, import.meta.url), 'utf8');
// Fixed dates so the tests don't depend on certificate expiry.
const OCT_2026 = new Date('2026-10-25T00:00:00Z');
const JUN_2026 = new Date('2026-06-01T00:00:00Z');

describe('bundled roots', () => {
  it('match the official root certificates and their documented fingerprints', () => {
    const files = {
      'DigiCert Verified Mark Root CA': 'root-digicert.pem',
      'SSL.com VMC RSA Root CA 2024': 'root-sslcom.pem',
      'GlobalSign Verified Mark Root R42': 'root-globalsign.pem',
    } as Record<string, string>;
    expect(MARK_ROOTS).toHaveLength(3);
    for (const r of MARK_ROOTS) {
      const der = Buffer.from(r.der, 'base64');
      expect(createHash('sha256').update(der).digest('hex').toUpperCase()).toBe(r.sha256);
      expect(Buffer.from(pemToDer(pem(files[r.name]!))[0]!)).toEqual(der);
    }
  });
});

describe('mark certificate validation (real chains)', () => {
  it.each([
    [
      'ebay-digicert.pem',
      'ebay.com',
      OCT_2026,
      'VMC',
      'DigiCert Verified Mark Root CA',
      'eBay, Inc.',
    ],
    [
      'zalando-digicert-eu.pem',
      'zalando.de',
      OCT_2026,
      'VMC',
      'DigiCert Verified Mark Root CA',
      'Zalando SE',
    ],
    ['x-sslcom.pem', 'x.com', OCT_2026, 'VMC', 'SSL.com VMC RSA Root CA 2024', 'X Corp.'],
    [
      'globalsign.pem',
      'globalsign.com',
      OCT_2026,
      'VMC',
      'GlobalSign Verified Mark Root R42',
      'GMO GlobalSign Pte. Ltd.',
    ],
    [
      'sslcom-cmc.pem',
      'ssl.com',
      JUN_2026,
      'CMC',
      'SSL.com VMC RSA Root CA 2024',
      'SSL.com (SSL Corp.)',
    ],
  ])('%s validates for %s', async (file, domain, now, kind, root, holder) => {
    const r = await validateMarkCertificate(pem(file), { domains: [domain], now });
    expect(r).toMatchObject({ ok: true, kind, root, holder });
    if (r.ok) expect(r.logoSvg).toMatch(/<svg[\s>]/);
  });

  it.each([
    ['booking-expired.pem', 'booking.com', OCT_2026, 'expired'],
    ['ebay-digicert.pem', 'ebay.com', JUN_2026, 'not-yet-valid'],
    ['ebay-digicert.pem', 'paypal.com', OCT_2026, 'domain-mismatch'],
    ['forged-digicert-name.pem', 'ebay.com', OCT_2026, 'bad-signature'],
  ])('%s for %s → %s', async (file, domain, now, reason) => {
    expect(await validateMarkCertificate(pem(file), { domains: [domain], now })).toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects chains that end in an unknown root', async () => {
    // Leaf without the intermediate: its issuer is neither bundled nor supplied.
    const leafOnly =
      pem('ebay-digicert.pem').split('-----END CERTIFICATE-----')[0] +
      '-----END CERTIFICATE-----\n';
    expect(
      await validateMarkCertificate(leafOnly, { domains: ['ebay.com'], now: OCT_2026 }),
    ).toEqual({ ok: false, reason: 'untrusted' });
  });

  it('rejects non-BIMI and malformed input', async () => {
    expect(await validateMarkCertificate(pem('root-digicert.pem'), { domains: ['x'] })).toEqual({
      ok: false,
      reason: 'no-bimi-certificate',
    });
    expect(await validateMarkCertificate('nothing here', { domains: ['x'] })).toEqual({
      ok: false,
      reason: 'malformed',
    });
    const broken = '-----BEGIN CERTIFICATE-----\nMIIBAAAA\n-----END CERTIFICATE-----';
    expect(await validateMarkCertificate(broken, { domains: ['x'] })).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('defaults to the current date', async () => {
    const r = await validateMarkCertificate(pem('booking-expired.pem'), {
      domains: ['booking.com'],
    });
    expect(r.ok).toBe(false);
  });
});

describe('X.509 helpers', () => {
  const leaf = parseCertificate(pemToDer(pem('ebay-digicert.pem'))[0]!);

  it('extracts EKU, SAN and the logotype', async () => {
    expect(extendedKeyUsages(leaf)).toContain('1.3.6.1.5.5.7.3.31');
    expect(dnsNames(leaf)).toContain('ebay.com');
    const uri = logotypeDataUri(leaf);
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,H4sI/);
    expect(await svgFromDataUri(uri!)).toMatch(/<svg/);
  });

  it('decodes plain and percent-encoded SVG data URIs', async () => {
    expect(await svgFromDataUri('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe('<svg></svg>');
    expect(await svgFromDataUri(`data:image/svg+xml;base64,${btoa('<svg/>')}`)).toBeNull();
    expect(await svgFromDataUri(`data:image/svg+xml;base64,${btoa('<svg x="1"></svg>')}`)).toBe(
      '<svg x="1"></svg>',
    );
    expect(await svgFromDataUri('data:image/png;base64,AAAA')).toBeNull();
  });

  it('refuses unsupported signature algorithms', async () => {
    const root = parseCertificate(pemToDer(pem('root-digicert.pem'))[0]!);
    expect(await verifySignature({ ...leaf, sigAlg: '1.2.840.113549.1.1.5' }, root)).toBe(false);
    expect(await verifySignature(leaf, { ...root, keyAlg: '1.3.101.112' })).toBe(false);
    expect(await verifySignature(leaf, { ...root, spki: new Uint8Array([1, 2, 3]) })).toBe(false);
  });

  it('verifies ECDSA signatures', async () => {
    const { subtle } = globalThis.crypto;
    const kp = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const spki = new Uint8Array(await subtle.exportKey('spki', kp.publicKey));
    const tbs = new TextEncoder().encode('to be signed');
    const rawSig = new Uint8Array(
      await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, tbs),
    );
    // Encode r||s as DER SEQUENCE { INTEGER r, INTEGER s }.
    const int = (b: Uint8Array) => {
      let v = Array.from(b);
      while (v.length > 1 && v[0] === 0) v = v.slice(1);
      if (v[0]! & 0x80) v = [0, ...v];
      return [0x02, v.length, ...v];
    };
    const body = [...int(rawSig.slice(0, 32)), ...int(rawSig.slice(32))];
    const der = new Uint8Array([0x30, body.length, ...body]);
    const issuer = { ...leaf, keyAlg: '1.2.840.10045.2.1', keyCurve: '1.2.840.10045.3.1.7', spki };
    const child = { ...leaf, sigAlg: '1.2.840.10045.4.3.2', signature: der, tbs };
    expect(await verifySignature(child, issuer)).toBe(true);
    expect(
      await verifySignature({ ...child, tbs: new TextEncoder().encode('tampered') }, issuer),
    ).toBe(false);
    expect(
      await verifySignature(
        { ...child, signature: new Uint8Array([0x30, 0x03, 0x05, 0x01, 0x00]) },
        issuer,
      ),
    ).toBe(false);
  });

  it('handles certificates without the optional extensions', () => {
    const root = parseCertificate(pemToDer(pem('root-digicert.pem'))[0]!);
    expect(extendedKeyUsages(root)).toEqual([]);
    expect(dnsNames(root)).toEqual([]);
    expect(logotypeDataUri(root)).toBeNull();
    const bare = { ...root, extensions: new Map() };
    expect(isCa(bare)).toBe(false);
    expect(isCa(root)).toBe(true);
    expect(() =>
      parseCertificate(new Uint8Array([...pemToDer(pem('root-digicert.pem'))[0]!, 0])),
    ).toThrow(/trailing/);
  });

  it('decodes BMP strings', () => {
    const b = new Uint8Array([0x1e, 4, 0x00, 0x48, 0x00, 0x69]);
    expect(string(b, readTlv(b, 0))).toBe('Hi');
  });

  it('DER reader is bounds-checked', () => {
    expect(() => readTlv(new Uint8Array([0x30]), 0)).toThrow(DerError);
    expect(() => readTlv(new Uint8Array([0x30, 0x05, 0x00]), 0)).toThrow(/exceeds/);
    expect(() => readTlv(new Uint8Array([0x30, 0x85, 0, 0, 0, 0, 1]), 0)).toThrow(/length/);
    expect(() => readTlv(new Uint8Array([0x3f, 0x00]), 0)).toThrow(/high tag/);
    expect(() => readTlv(new Uint8Array([0x30, 0x82, 0x01]), 0)).toThrow(/truncated/);
    expect(() =>
      oid(new Uint8Array([0x06, 0x00]), readTlv(new Uint8Array([0x06, 0x00]), 0)),
    ).toThrow(/empty OID/);
    const gt = new Uint8Array([0x18, 15, ...new TextEncoder().encode('20501231235959Z')]);
    expect(time(gt, readTlv(gt, 0)).toISOString()).toBe('2050-12-31T23:59:59.000Z');
    const bad = new Uint8Array([0x17, 3, 0x31, 0x32, 0x33]);
    expect(() => time(bad, readTlv(bad, 0))).toThrow(/bad time/);
  });
});

describe('BIMI records', () => {
  it('parses records and keeps only https URIs', () => {
    expect(
      parseBimiRecord('v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem'),
    ).toEqual({
      l: 'https://example.com/logo.svg',
      a: 'https://example.com/vmc.pem',
    });
    expect(parseBimiRecord('v=BIMI1;l=http://example.com/x.svg;a=')).toEqual({ l: null, a: null });
    expect(parseBimiRecord('v=BIMI1; l=https://a.example/1.svg,https://b.example/2.svg')?.l).toBe(
      'https://a.example/1.svg',
    );
    expect(parseBimiRecord('v=BIMI1; l=not a url')?.l).toBeNull();
    expect(parseBimiRecord('v=spf1 -all')).toBeNull();
    expect(isDeclination({ l: null, a: null })).toBe(true);
    expect(isDeclination({ l: 'https://x', a: null })).toBe(false);
  });
});

describe('BIMI eligibility', () => {
  const v = (ar: string) =>
    decide(analyze(`Authentication-Results: mx; ${ar}\nFrom: a@example.com\n`));
  it.each([
    ['dmarc=pass (p=reject) header.from=example.com', 'eligible'],
    ['dmarc=pass (p=quarantine) header.from=example.com', 'eligible'],
    ['dmarc=pass (p=quarantine pct=50) header.from=example.com', 'weak-policy'],
    ['dmarc=pass (p=reject t=y) header.from=example.com', 'weak-policy'],
    ['dmarc=pass (p=none) header.from=example.com', 'weak-policy'],
    ['dmarc=pass header.from=example.com', 'needs-policy'],
    ['dmarc=fail (p=reject) header.from=example.com', 'not-authenticated'],
  ])('%s → %s', (ar, expected) => {
    expect(bimiEligibility(v(ar))).toBe(expected);
  });

  it('internal mail is not BIMI-eligible', () => {
    const internal = decide(
      analyze('X-MS-Exchange-Organization-AuthAs: Internal\nFrom: a@contoso.example\n'),
    );
    expect(bimiEligibility(internal)).toBe('not-authenticated');
  });
});

describe('BIMI from the receiving server', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const msg = (bimi: string, extra = '') =>
    analyze(
      `Authentication-Results: mx.example.net; dmarc=pass (p=reject) header.from=example.com; ${bimi}\n${extra}From: a@example.com\n`,
    );

  it('uses a receiver-validated certificate and the BIMI-Indicator header', () => {
    const a = msg(
      'bimi=pass header.d=example.com header.selector=default policy.authority=pass',
      `BIMI-Indicator: ${btoa(svg)}\n`,
    );
    expect(bimiFromReceiver(a, 'example.com')).toEqual({
      kind: 'verified',
      domain: 'example.com',
      source: 'receiver',
      logoSvg: svg,
    });
  });

  it('is blue without a validated certificate', () => {
    const a = msg(
      'bimi=pass header.d=example.com policy.authority=none',
      `BIMI-Indicator: ${btoa(svg)}\n`,
    );
    expect(bimiFromReceiver(a, 'example.com')).toMatchObject({
      kind: 'logo',
      logoSvg: svg,
      cert: 'none',
    });
  });

  it('ignores BIMI-Indicator unless the trusted A-R says bimi=pass', () => {
    const forged = analyze(
      `Authentication-Results: mx.example.net; dmarc=pass (p=reject) header.from=example.com\nBIMI-Indicator: ${btoa(svg)}\nFrom: a@example.com\n`,
    );
    expect(forged.bimi).toBeUndefined();
    expect(bimiFromReceiver(forged, 'example.com')).toBeNull();
    const failing = msg('bimi=fail', `BIMI-Indicator: ${btoa(svg)}\n`);
    expect(failing.bimi?.indicatorSvg).toBeUndefined();
    expect(bimiFromReceiver(failing, 'example.com')).toEqual({
      kind: 'invalid',
      domain: 'example.com',
      reason: 'receiver-fail',
    });
  });

  it('maps other receiver results', () => {
    expect(bimiFromReceiver(msg('bimi=declined'), 'example.com')).toEqual({
      kind: 'declined',
      domain: 'example.com',
    });
    expect(bimiFromReceiver(msg('bimi=none'), 'example.com')).toEqual({
      kind: 'none',
      domain: 'example.com',
    });
    expect(bimiFromReceiver(msg('bimi=skipped'), 'example.com')).toBeNull();
    expect(msg('bimi=pass', 'BIMI-Indicator: !!!\n').bimi?.indicatorSvg).toBeUndefined();
  });
});

/** Fake network: DoH answers by query name, plus plain HTTP resources. */
function network(dns: Record<string, string[]>, http: Record<string, string | Error>) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    void _init;
    const u = new URL(url);
    if (u.searchParams.has('dns')) {
      const name =
        Object.keys(dns).find((n) => toBase64Url(encodeQuery(n)) === u.searchParams.get('dns')) ??
        '';
      const q = [...encodeQuery(name || '_x.example.com')];
      q[2] = 0x81;
      q[3] = name ? 0x80 : 0x83;
      const answers = name ? dns[name]! : [];
      q[7] = answers.length;
      for (const txt of answers) {
        const chunks: number[] = [];
        for (let i = 0; i < txt.length; i += 255) {
          const part = txt.slice(i, i + 255);
          chunks.push(part.length, ...Array.from(part, (c) => c.charCodeAt(0)));
        }
        q.push(
          0xc0,
          12,
          0,
          16,
          0,
          1,
          0,
          0,
          0,
          60,
          chunks.length >> 8,
          chunks.length & 0xff,
          ...chunks,
        );
      }
      return new Response(Uint8Array.from(q).buffer as ArrayBuffer);
    }
    const body = http[url];
    if (body === undefined) return new Response('not found', { status: 404 });
    if (body instanceof Error) throw body;
    return new Response(body);
  });
}

describe('BIMI lookup', () => {
  beforeEach(() => {
    clearBimiCache();
    clearDnsCache();
  });

  const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'.replace(
    '/>',
    '></svg>',
  );

  it('validates the certificate and uses its embedded logo', async () => {
    const fetchFn = network(
      {
        '_bimi.x': [],
        'default._bimi.ebay.com': [
          'v=BIMI1; l=https://cdn.example/logo.svg; a=https://cdn.example/vmc.pem',
        ],
      },
      { 'https://cdn.example/vmc.pem': pem('ebay-digicert.pem') },
    );
    const r = await lookupBimi('ebay.com', 'quad9', { fetchFn, now: OCT_2026 });
    expect(r).toMatchObject({
      kind: 'verified',
      domain: 'ebay.com',
      source: 'client',
      mark: { kind: 'VMC' },
    });
    // The l= logo isn't needed when the certificate supplies one.
    expect(fetchFn.mock.calls.some(([u]) => u === 'https://cdn.example/logo.svg')).toBe(false);
    const [, init] = fetchFn.mock.calls.find(([u]) => u === 'https://cdn.example/vmc.pem')!;
    expect(init).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors',
    });
    // Cached per domain and resolver.
    await lookupBimi('ebay.com', 'quad9', { fetchFn, now: OCT_2026 });
    expect(fetchFn.mock.calls.filter(([u]) => u === 'https://cdn.example/vmc.pem')).toHaveLength(1);
  });

  it('falls back to the organisational domain and shows a logo without certificate', async () => {
    const fetchFn = network(
      { 'default._bimi.example.org': ['v=BIMI1; l=https://cdn.example/logo.svg'] },
      { 'https://cdn.example/logo.svg': LOGO },
    );
    expect(await lookupBimi('news.example.org', 'quad9', { fetchFn })).toEqual({
      kind: 'logo',
      domain: 'news.example.org',
      source: 'client',
      logoSvg: LOGO,
      cert: 'none',
    });
  });

  it('reports an unreachable certificate (CORS) as blue', async () => {
    const fetchFn = network(
      {
        'default._bimi.example.com': [
          'v=BIMI1; l=https://cdn.example/logo.svg; a=https://vmc.example/x.pem',
        ],
      },
      {
        'https://vmc.example/x.pem': new TypeError('Failed to fetch'),
        'https://cdn.example/logo.svg': '<html>not svg</html>',
      },
    );
    expect(await lookupBimi('example.com', 'quad9', { fetchFn })).toMatchObject({
      kind: 'logo',
      cert: 'unreachable',
      logoSvg: null,
    });
  });

  it('rejects invalid certificates, declinations and missing records', async () => {
    const fetchFn = network(
      {
        'default._bimi.booking.com': [
          'v=BIMI1; l=https://cdn.example/b.svg; a=https://cdn.example/b.pem',
        ],
        'default._bimi.declined.example': ['v=BIMI1; l=; a='],
      },
      { 'https://cdn.example/b.pem': pem('booking-expired.pem') },
    );
    expect(await lookupBimi('booking.com', 'quad9', { fetchFn, now: OCT_2026 })).toEqual({
      kind: 'invalid',
      domain: 'booking.com',
      reason: 'expired',
    });
    expect(await lookupBimi('declined.example', 'quad9', { fetchFn })).toEqual({
      kind: 'declined',
      domain: 'declined.example',
    });
    expect(await lookupBimi('nothing.example', 'quad9', { fetchFn })).toEqual({
      kind: 'none',
      domain: 'nothing.example',
    });
  });

  it('enforces size limits and https', async () => {
    const fetchFn = network(
      { 'default._bimi.big.example': ['v=BIMI1; l=https://cdn.example/big.svg'] },
      { 'https://cdn.example/big.svg': '<svg>' + 'x'.repeat(70 * 1024) + '</svg>' },
    );
    expect(await lookupBimi('big.example', 'quad9', { fetchFn })).toMatchObject({
      kind: 'logo',
      logoSvg: null,
    });
  });

  it('propagates DNS failures without caching them', async () => {
    const failing = vi.fn(async () => new Response('', { status: 503 }));
    await expect(lookupBimi('example.com', 'quad9', { fetchFn: failing })).rejects.toThrow(/503/);
    await expect(lookupBimi('example.com', 'quad9', { fetchFn: failing })).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('BIMI view', () => {
  beforeEach(() => setLocale('en'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  it('green with logo for a verified mark', () => {
    const v = bimiView({
      kind: 'outcome',
      outcome: {
        kind: 'verified',
        domain: 'ebay.com',
        source: 'client',
        logoSvg: svg,
        mark: {
          ok: true,
          kind: 'CMC',
          root: 'SSL.com VMC RSA Root CA 2024',
          holder: '',
          notAfter: OCT_2026,
          logoSvg: svg,
        },
      },
    });
    expect(v).toMatchObject({
      tone: 'green',
      badge: 'Verified logo',
      logoSvg: svg,
      logoAlt: 'Brand logo of ebay.com',
      offer: false,
    });
    expect(v.text[0]).toBe(
      'Common Mark Certificate: the logo of ebay.com is verified by SSL.com VMC RSA Root CA 2024.',
    );
    expect(
      bimiView({
        kind: 'outcome',
        outcome: { kind: 'verified', domain: 'x.example', source: 'receiver', logoSvg: svg },
      }).text[0],
    ).toBe('Your mail provider verified this brand logo and its certificate.');
  });

  it('blue with or without a logo', () => {
    const withLogo = bimiView({
      kind: 'outcome',
      outcome: {
        kind: 'logo',
        domain: 'a.example',
        source: 'client',
        logoSvg: svg,
        cert: 'unreachable',
      },
    });
    expect(withLogo).toMatchObject({ tone: 'blue', logoSvg: svg });
    expect(withLogo.text[0]).toContain("couldn't be checked");
    const noLogo = bimiView({
      kind: 'outcome',
      outcome: { kind: 'logo', domain: 'a.example', source: 'client', logoSvg: null, cert: 'none' },
    });
    expect(noLogo.logoSvg).toBeUndefined();
    expect(noLogo.text).toHaveLength(2);
  });

  it('grey states', () => {
    expect(bimiView({ kind: 'off', domain: 'a.example' })).toMatchObject({
      tone: 'grey',
      offer: true,
      badge: 'Not checked',
    });
    expect(bimiView({ kind: 'checking', domain: 'xn--bcher-kva.example' }).text[0]).toBe(
      'Checking BIMI for bücher.example…',
    );
    expect(bimiView({ kind: 'error', message: 'x', retry: ['google'] }).offer).toBe(false);
    expect(bimiView({ kind: 'error', message: 'boom' })).toMatchObject({
      offer: true,
      text: ['BIMI check failed: boom'],
    });
    expect(bimiView({ kind: 'ineligible', reason: 'weak-policy' }).text[0]).toContain(
      'quarantine or reject',
    );
    expect(
      bimiView({ kind: 'outcome', outcome: { kind: 'none', domain: 'a.example' } }).badge,
    ).toBe('No BIMI');
    expect(
      bimiView({ kind: 'outcome', outcome: { kind: 'declined', domain: 'a.example' } }).text[0],
    ).toContain('chosen not');
    expect(
      bimiView({
        kind: 'outcome',
        outcome: { kind: 'invalid', domain: 'a.example', reason: 'expired' },
      }),
    ).toMatchObject({
      tone: 'grey',
      warn: true,
      text: ['The BIMI certificate of a.example was rejected: it has expired. No logo is shown.'],
    });
  });

  it('renders logos as base64 data URLs', () => {
    expect(svgDataUrl('<svg>é</svg>')).toBe(
      `data:image/svg+xml;base64,${Buffer.from('<svg>é</svg>').toString('base64')}`,
    );
  });
});
