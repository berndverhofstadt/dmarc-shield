import { describe, expect, it } from 'vitest';
import { parseAuthResults, firstResult } from '../src/parser/authres';
import { asPolicy, isDmarcRecord, parseDmarcRecord } from '../src/parser/dmarcrecord';
import {
  isEnforcedReject,
  policyFromRecord,
  policyFromResInfo,
  weaker,
} from '../src/parser/policy';

const dmarc = (v: string) => firstResult(parseAuthResults(v), 'dmarc')!;

describe('DMARC records', () => {
  it('parses tags', () => {
    expect(
      parseDmarcRecord('v=DMARC1; p=reject; sp=quarantine; np=none; pct=50; t=n; rua=mailto:x'),
    ).toEqual({
      p: 'reject',
      sp: 'quarantine',
      np: 'none',
      pct: 50,
      testing: false,
    });
    expect(parseDmarcRecord('v=DMARC1;p=reject;t=y')?.testing).toBe(true);
    expect(parseDmarcRecord('v=DMARC1; pct=500; p=reject')?.pct).toBe(100);
    expect(parseDmarcRecord('v=DMARC1; pct=abc; p=reject')?.pct).toBeUndefined();
  });

  it('treats missing or invalid p as none', () => {
    expect(parseDmarcRecord('v=DMARC1; rua=mailto:x')?.p).toBe('none');
    expect(parseDmarcRecord('v=DMARC1; p=bogus; junk')?.p).toBe('none');
  });

  it('rejects non-DMARC records', () => {
    expect(parseDmarcRecord('v=spf1 -all')).toBeNull();
    expect(isDmarcRecord('  v = DMARC1 ')).toBe(true);
    expect(isDmarcRecord('v=DMARC10; p=reject')).toBe(false);
    expect(asPolicy(undefined)).toBeUndefined();
  });
});

describe('policy extraction', () => {
  it('reads Gmail comments, using the weaker of p/sp for subdomains', () => {
    const r = dmarc(
      'mx.google.com; dmarc=pass (p=REJECT sp=NONE dis=NONE) header.from=example.com',
    );
    expect(policyFromResInfo(r, 'example.com', 'header')).toEqual({
      p: 'reject',
      source: 'header',
    });
    expect(policyFromResInfo(r, 'news.example.com', 'header')?.p).toBe('none');
  });

  it('reads Fastmail properties, pct and testing flags', () => {
    const r = dmarc(
      'mx; dmarc=pass policy.published-domain-policy=reject policy.published-subdomain-policy=quarantine (pct=25 t=y) header.from=a.example.com',
    );
    expect(policyFromResInfo(r, 'a.example.com', 'arc')).toEqual({
      p: 'quarantine',
      pct: 25,
      testing: true,
      source: 'arc',
    });
  });

  it('returns undefined when no policy is visible', () => {
    expect(
      policyFromResInfo(dmarc('dmarc=pass action=none header.from=x.com'), 'x.com', 'header'),
    ).toBeUndefined();
  });

  it('derives policies from DNS records', () => {
    const rec = { p: 'reject' as const, sp: 'none' as const, pct: 100 };
    expect(policyFromRecord(rec, 'example.com', 'example.com', 'Quad9')).toEqual({
      p: 'reject',
      pct: 100,
      source: 'dns',
      recordDomain: 'example.com',
      resolver: 'Quad9',
    });
    expect(policyFromRecord(rec, 'example.com', 'mail.example.com', 'Quad9').p).toBe('none');
    expect(policyFromRecord({ p: 'reject', testing: true }, 'a.b', 'x.a.b', 'Q')).toMatchObject({
      p: 'reject',
      testing: true,
    });
  });

  it('knows what counts as enforced reject', () => {
    expect(isEnforcedReject({ p: 'reject', source: 'dns' })).toBe(true);
    expect(isEnforcedReject({ p: 'reject', pct: 100, source: 'dns' })).toBe(true);
    expect(isEnforcedReject({ p: 'reject', pct: 50, source: 'dns' })).toBe(false);
    expect(isEnforcedReject({ p: 'reject', testing: true, source: 'dns' })).toBe(false);
    expect(isEnforcedReject({ p: 'quarantine', source: 'dns' })).toBe(false);
    expect(weaker('reject', 'quarantine')).toBe('quarantine');
    expect(weaker('none', 'reject')).toBe('none');
  });
});
