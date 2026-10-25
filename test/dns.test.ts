import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DnsError,
  RESOLVERS,
  clearDnsCache,
  isResolverId,
  lookupDmarcPolicy,
  queryTxt,
  treeWalk,
} from '../src/dns/lookup';
import {
  decodeResponse,
  encodeQuery,
  isValidQueryName,
  toBase64Url,
  txtValue,
} from '../src/dns/wire';

/** Build a DNS response for one TXT question. */
function response(name: string, txts: string[][], rcode = 0, flagsExtra = 0): Uint8Array {
  const q = encodeQuery(name);
  const out = [...q];
  out[2] = 0x81 | (flagsExtra >> 8); // QR=1, RD=1
  out[3] = 0x80 | rcode | (flagsExtra & 0xff);
  out[6] = 0;
  out[7] = txts.length;
  for (const strings of txts) {
    const rdata = strings.flatMap((s) => [s.length, ...Array.from(s, (c) => c.charCodeAt(0))]);
    out.push(
      0xc0,
      12,
      0,
      16,
      0,
      1,
      0,
      0,
      1,
      0x2c,
      rdata.length >> 8,
      rdata.length & 0xff,
      ...rdata,
    );
  }
  return Uint8Array.from(out);
}

function fetchFrom(map: Record<string, { txt?: string[][]; rcode?: number; status?: number }>) {
  return vi.fn(async (url: string) => {
    const b64 = new URL(url).searchParams.get('dns') as string;
    const name = Object.keys(map).find((n) => toBase64Url(encodeQuery(n)) === b64);
    const entry = name ? map[name]! : { rcode: 3 };
    const body = response(name ?? '_dmarc.unknown.example', entry.txt ?? [], entry.rcode ?? 0);
    return new Response(body.buffer as ArrayBuffer, { status: entry.status ?? 200 });
  });
}

describe('DNS wire format', () => {
  it('encodes RFC 8484 queries with ID 0', () => {
    const q = encodeQuery('_dmarc.example.com');
    expect([...q.slice(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(toBase64Url(q)).toBe('AAABAAABAAAAAAAABl9kbWFyYwdleGFtcGxlA2NvbQAAEAAB');
  });

  it('validates names', () => {
    expect(isValidQueryName('_dmarc.example.com')).toBe(true);
    expect(isValidQueryName('example.com.')).toBe(true);
    expect(isValidQueryName('com')).toBe(false);
    expect(isValidQueryName('-bad.example')).toBe(false);
    expect(isValidQueryName('default._bimi.example.com')).toBe(true);
    expect(isValidQueryName('example._tld')).toBe(false);
    expect(isValidQueryName('a'.repeat(64) + '.example')).toBe(false);
    expect(() => encodeQuery('bad name.example')).toThrow();
  });

  it('decodes TXT answers and joins character-strings', () => {
    const r = decodeResponse(response('_dmarc.example.com', [['v=DMARC1; ', 'p=reject']]));
    expect(r.rcode).toBe(0);
    expect(r.answers.map((a) => txtValue(a.data))).toEqual(['v=DMARC1; p=reject']);
  });

  it('reports truncation and rejects bad packets', () => {
    expect(decodeResponse(response('_dmarc.example.com', [], 0, 0x0200)).truncated).toBe(true);
    expect(() => decodeResponse(new Uint8Array(4))).toThrow(/short/);
    expect(() => decodeResponse(encodeQuery('_dmarc.example.com'))).toThrow(/not a response/);
    const r = response('_dmarc.example.com', [['v=DMARC1; p=reject']]);
    expect(() => decodeResponse(r.slice(0, r.length - 3))).toThrow(/truncated/);
    expect(() => decodeResponse(r.slice(0, 20))).toThrow(/truncated/);
    const loop = response('_dmarc.example.com', []);
    expect(() =>
      decodeResponse(Uint8Array.from([...loop.slice(0, 12), ...new Array(200).fill(1)])),
    ).toThrow();
  });
});

describe('DMARC lookup', () => {
  beforeEach(() => clearDnsCache());

  it('knows its resolvers', () => {
    expect(isResolverId('quad9')).toBe(true);
    expect(isResolverId('evil')).toBe(false);
    expect(isResolverId(undefined)).toBe(false);
    expect(RESOLVERS.quad9.url).toBe('https://dns.quad9.net/dns-query');
  });

  it('walks the tree up to, but excluding, the TLD', () => {
    expect(treeWalk('a.b.example.com')).toEqual([
      'a.b.example.com',
      'b.example.com',
      'example.com',
    ]);
    expect(treeWalk('example.com')).toEqual(['example.com']);
    const long = 'a.b.c.d.e.f.g.h.i.example.com';
    const walk = treeWalk(long);
    expect(walk[0]).toBe(long);
    expect(walk[1]?.split('.')).toHaveLength(7);
    expect(walk.length).toBeLessThanOrEqual(8);
  });

  it('finds the record at the exact domain and uses p', async () => {
    const fetchFn = fetchFrom({ '_dmarc.example.com': { txt: [['v=DMARC1; p=reject; sp=none']] } });
    const r = await lookupDmarcPolicy('example.com', 'quad9', { fetchFn });
    expect(r.policy).toEqual({
      p: 'reject',
      source: 'dns',
      recordDomain: 'example.com',
      resolver: 'Quad9',
    });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith('https://dns.quad9.net/dns-query?dns=')).toBe(true);
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('falls back to a parent record and uses sp', async () => {
    const fetchFn = fetchFrom({
      '_dmarc.mail.example.com': { rcode: 3 },
      '_dmarc.example.com': { txt: [['v=spf1 -all'], ['v=DMARC1; p=reject; sp=quarantine']] },
    });
    const r = await lookupDmarcPolicy('mail.example.com', 'google', { fetchFn });
    expect(r.recordDomain).toBe('example.com');
    expect(r.policy?.p).toBe('quarantine');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('treats multiple records as no record and keeps walking', async () => {
    const fetchFn = fetchFrom({
      '_dmarc.a.example.com': { txt: [['v=DMARC1; p=none'], ['v=DMARC1; p=reject']] },
    });
    const r = await lookupDmarcPolicy('a.example.com', 'cloudflare', { fetchFn });
    expect(r).toEqual({ record: null });
  });

  it('caches results per resolver and domain, but not failures', async () => {
    const fetchFn = fetchFrom({ '_dmarc.example.com': { txt: [['v=DMARC1; p=reject']] } });
    await lookupDmarcPolicy('example.com', 'quad9', { fetchFn });
    await lookupDmarcPolicy('EXAMPLE.com', 'quad9', { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const failing = fetchFrom({ '_dmarc.fail.example': { status: 500 } });
    await expect(lookupDmarcPolicy('fail.example', 'quad9', { fetchFn: failing })).rejects.toThrow(
      /HTTP 500/,
    );
    await expect(
      lookupDmarcPolicy('fail.example', 'quad9', { fetchFn: failing }),
    ).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('surfaces resolver errors and invalid domains', async () => {
    const servfail = fetchFrom({ '_dmarc.example.com': { rcode: 2 } });
    await expect(lookupDmarcPolicy('example.com', 'quad9', { fetchFn: servfail })).rejects.toThrow(
      /rcode 2/,
    );
    await expect(
      lookupDmarcPolicy('not a domain', 'quad9', { fetchFn: servfail }),
    ).rejects.toBeInstanceOf(DnsError);
    const network = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(queryTxt('_dmarc.example.com', 'quad9', { fetchFn: network })).rejects.toThrow(
      'Failed to fetch',
    );
    const weird = vi.fn(async () => {
      throw 'boom';
    });
    await expect(queryTxt('_dmarc.example.com', 'quad9', { fetchFn: weird })).rejects.toThrow(
      'boom',
    );
  });

  it('aborts slow resolvers', async () => {
    const slow = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    await expect(
      queryTxt('_dmarc.example.com', 'quad9', { fetchFn: slow, timeoutMs: 5 }),
    ).rejects.toThrow('aborted');
  });

  it('converts IDN domains before querying', async () => {
    const fetchFn = fetchFrom({
      '_dmarc.xn--bcher-kva.example': { txt: [['v=DMARC1; p=quarantine']] },
    });
    const r = await lookupDmarcPolicy('bücher.example', 'quad9', { fetchFn });
    expect(r.policy?.p).toBe('quarantine');
  });
});
