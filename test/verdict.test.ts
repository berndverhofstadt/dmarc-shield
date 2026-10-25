import { describe, expect, it } from 'vitest';
import { analyze } from '../src/parser/analyze';
import { decide, unsupportedVerdict } from '../src/parser/verdict';

const msg = (ar: string, extra = '') =>
  `Authentication-Results: ${ar}\n${extra}From: A <a@example.com>\n`;

describe('verdict edge cases', () => {
  it('has an unsupported state', () => {
    expect(unsupportedVerdict()).toMatchObject({
      state: 'unsupported',
      reason: 'unsupported',
      findings: [],
    });
  });

  it.each([
    ['mx; spf=pass', 'dmarc-missing'],
    ['mx; dmarc=temperror header.from=example.com', 'dmarc-error'],
    ['mx; dmarc=permerror header.from=example.com', 'dmarc-error'],
    ['mx; dmarc=policy header.from=example.com', 'dmarc-other'],
  ])('%s → %s', (ar, reason) => {
    expect(decide(analyze(msg(ar)))).toMatchObject({ state: 'unprotected', reason });
  });

  it('partial or testing reject is blue', () => {
    expect(
      decide(analyze(msg('mx; dmarc=pass (p=reject pct=50) header.from=example.com'))).reason,
    ).toBe('policy-partial');
    expect(
      decide(analyze(msg('mx; dmarc=pass header.from=example.com')), {
        p: 'reject',
        testing: true,
        source: 'dns',
      }),
    ).toMatchObject({ state: 'authenticated', reason: 'policy-partial' });
  });

  it('a null DNS result leaves the policy unknown', () => {
    expect(decide(analyze(msg('mx; dmarc=pass header.from=example.com')), null)).toMatchObject({
      state: 'authenticated',
      reason: 'policy-unknown',
      needsPolicy: true,
    });
  });

  it('uses the From domain when header.from is absent', () => {
    expect(decide(analyze(msg('mx; dmarc=pass'))).policyDomain).toBe('example.com');
  });

  it('flags broken ARC chains the receiver claims pass for', () => {
    const raw = msg(
      'mx.example.net; arc=pass; dmarc=fail header.from=example.com',
      'ARC-Seal: i=2; cv=pass; d=x\n',
    );
    expect(analyze(raw).findings.map((f) => f.code)).toContain('arc-broken');
  });

  it('flags an ARC original whose From differs from the visible From', () => {
    const raw = msg(
      'mx.example.net; arc=pass; dmarc=fail header.from=example.com',
      'ARC-Seal: i=1; cv=none; d=x\nARC-Message-Signature: i=1; d=x\n' +
        'ARC-Authentication-Results: i=1; lists.example.org; dmarc=pass header.from=other.example\n',
    );
    expect(analyze(raw).findings.map((f) => f.code)).toContain('arc-from-mismatch');
  });

  it('notes whole-script confusables, IDN senders and unaligned DKIM', () => {
    const conf = analyze('Authentication-Results: mx; dmarc=pass\nFrom: a@xn--80ak6aa92e.com\n');
    expect(conf.findings.map((f) => f.code)).toContain('from-confusable');
    const idn = analyze('Authentication-Results: mx; dmarc=pass\nFrom: a@xn--mnchen-3ya.de\n');
    expect(idn.findings).toContainEqual({
      code: 'idn-from',
      severity: 'notice',
      params: { domain: 'münchen.de', ascii: 'xn--mnchen-3ya.de' },
    });
    const dkim = analyze(
      msg('mx; dkim=pass header.d=esp.example; dmarc=pass header.from=example.com'),
    );
    expect(dkim.findings.map((f) => f.code)).toContain('dkim-unaligned');
  });

  it('requires a single Microsoft-receiver AuthAs header for internal mail', () => {
    const twice =
      'X-MS-Exchange-Organization-AuthAs: Internal\nX-MS-Exchange-Organization-AuthAs: Anonymous\nFrom: a@example.com\n';
    expect(decide(analyze(twice)).reason).toBe('no-auth-results');
    const msReceiver =
      'Authentication-Results: mx.microsoft.com; dmarc=none\nX-MS-Exchange-Organization-AuthAs: Internal\nFrom: a@example.com\n';
    expect(decide(analyze(msReceiver)).reason).toBe('internal');
  });

  it('works without any From header', () => {
    const a = analyze('Authentication-Results: mx; dmarc=pass (p=reject)\n');
    expect(a.from).toBeUndefined();
    expect(decide(a).state).toBe('verified');
  });
});
