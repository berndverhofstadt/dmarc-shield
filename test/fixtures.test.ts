import { describe, expect, it } from 'vitest';
import type { FindingCode } from '../src/parser/analyze';
import type { ReasonCode, VerdictState } from '../src/parser/verdict';
import { fixture, verdictFor } from './helpers';
import { analyze } from '../src/parser/analyze';
import { decide } from '../src/parser/verdict';

interface Case {
  file: string;
  state: VerdictState;
  reason: ReasonCode;
  via?: 'direct' | 'arc' | 'internal' | null;
  findings?: FindingCode[];
  user?: string;
}

const CASES: Case[] = [
  // Exchange Online
  {
    file: 'exo-pass-no-policy.txt',
    state: 'authenticated',
    reason: 'policy-unknown',
    via: 'direct',
  },
  { file: 'exo-fail-oreject.txt', state: 'unprotected', reason: 'dmarc-fail' },
  { file: 'exo-internal.txt', state: 'verified', reason: 'internal', via: 'internal' },
  { file: 'exo-bestguesspass.txt', state: 'unprotected', reason: 'dmarc-none' },
  { file: 'exo-arc-override.txt', state: 'verified', reason: 'policy-reject', via: 'arc' },
  // Gmail
  { file: 'gmail-pass-reject.txt', state: 'verified', reason: 'policy-reject', via: 'direct' },
  { file: 'gmail-pass-quarantine.txt', state: 'authenticated', reason: 'policy-quarantine' },
  { file: 'gmail-arc-forwarded.txt', state: 'verified', reason: 'policy-reject', via: 'arc' },
  { file: 'dmarc-none-policy.txt', state: 'authenticated', reason: 'policy-none' },
  { file: 'dmarc-no-record.txt', state: 'unprotected', reason: 'dmarc-none' },
  // Fastmail, Proton, Yahoo
  { file: 'fastmail-pass-reject.txt', state: 'verified', reason: 'policy-reject', via: 'direct' },
  { file: 'proton-pass-quarantine.txt', state: 'authenticated', reason: 'policy-quarantine' },
  { file: 'yahoo-pass-reject.txt', state: 'verified', reason: 'policy-reject' },
  // Forged / inconsistent
  {
    file: 'forged-duplicate-authserv.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['ar-duplicate-authserv'],
  },
  {
    file: 'forged-lower-ar.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['ar-contradiction'],
  },
  { file: 'forged-arc.txt', state: 'unprotected', reason: 'dmarc-fail', findings: ['arc-failed'] },
  { file: 'arc-untrusted-position.txt', state: 'unprotected', reason: 'dmarc-fail' },
  { file: 'internal-forged-gmail.txt', state: 'unprotected', reason: 'dmarc-fail' },
  // Malformed
  {
    file: 'malformed-unclosed.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['ar-unparseable'],
  },
  {
    file: 'malformed-garbage.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['ar-unparseable'],
  },
  { file: 'no-auth-results.txt', state: 'unprotected', reason: 'no-auth-results' },
  // Address checks
  {
    file: 'header-from-mismatch.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['header-from-mismatch'],
  },
  {
    file: 'multiple-from.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['multiple-from'],
  },
  {
    file: 'lookalike-idn.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['from-mixed-script'],
  },
  {
    file: 'lookalike-user-domain.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['from-lookalike'],
    user: 'bernd@contoso.example',
  },
  {
    file: 'replyto-lookalike.txt',
    state: 'unprotected',
    reason: 'forgery',
    findings: ['replyto-lookalike'],
  },
  {
    file: 'replyto-differs.txt',
    state: 'verified',
    reason: 'policy-reject',
    findings: ['replyto-differs'],
  },
  {
    file: 'display-name-trick.txt',
    state: 'verified',
    reason: 'policy-reject',
    findings: ['display-name-address'],
  },
];

describe('real-world fixtures', () => {
  for (const c of CASES) {
    it(`${c.file} → ${c.state} (${c.reason})`, () => {
      const { a, v } = verdictFor(c.file, c.user ? { userEmail: c.user } : {});
      expect(v.state).toBe(c.state);
      expect(v.reason).toBe(c.reason);
      if (c.via !== undefined) expect(v.via).toBe(c.via);
      for (const f of c.findings ?? []) expect(a.findings.map((x) => x.code)).toContain(f);
    });
  }

  it('also parses fixtures with CRLF line endings', () => {
    const raw = fixture('gmail-pass-reject.txt').replace(/\n/g, '\r\n');
    expect(decide(analyze(raw)).state).toBe('verified');
  });

  it('EXO pass without visible policy becomes verified with a DNS p=reject', () => {
    const { v } = verdictFor(
      'exo-pass-no-policy.txt',
      {},
      { p: 'reject', source: 'dns', resolver: 'Quad9' },
    );
    expect(v.state).toBe('verified');
    expect(v.policy?.source).toBe('dns');
  });

  it('EXO pass with DNS p=quarantine stays authenticated', () => {
    const { v } = verdictFor('exo-pass-no-policy.txt', {}, { p: 'quarantine', source: 'dns' });
    expect(v).toMatchObject({ state: 'authenticated', reason: 'policy-quarantine' });
  });

  it('header policy wins over DNS policy', () => {
    const { v } = verdictFor('gmail-pass-quarantine.txt', {}, { p: 'reject', source: 'dns' });
    expect(v.state).toBe('authenticated');
    expect(v.policy?.source).toBe('header');
    expect(v.needsPolicy).toBe(false);
  });

  it('requests a policy lookup for the header.from domain on EXO', () => {
    const { v } = verdictFor('exo-pass-no-policy.txt');
    expect(v.needsPolicy).toBe(true);
    expect(v.policyDomain).toBe('example.com');
  });

  it('records the ARC sealer for ARC-derived results', () => {
    const { v, a } = verdictFor('gmail-arc-forwarded.txt');
    expect(v.sealer).toBe('lists.example.org');
    expect(a.arc.structure).toBe('valid');
    expect(a.arc.receiver).toEqual({ result: 'pass', source: 'top-ar' });
    expect(v.policy?.source).toBe('arc');
  });

  it('EXO ARC override is detected via compauth reason 130', () => {
    const { a } = verdictFor('exo-arc-override.txt');
    expect(a.arc.receiver).toEqual({ result: 'pass', source: 'compauth' });
  });

  it('ignores ARC sets below the trusted A-R', () => {
    const { a } = verdictFor('arc-untrusted-position.txt');
    expect(a.arc.receiver).toBeNull();
    expect(a.arcRescue).toBeUndefined();
  });

  it('merges Proton-style split A-R headers', () => {
    const { a } = verdictFor('proton-pass-quarantine.txt');
    expect(a.topAr?.results.map((r) => r.method).sort()).toEqual(['arc', 'dkim', 'dmarc', 'spf']);
    expect(a.otherArs).toHaveLength(0);
    expect(a.dkim[0]).toMatchObject({ result: 'pass', domain: 'example.org' });
  });

  it('extracts EXO details', () => {
    const { a } = verdictFor('exo-pass-no-policy.txt');
    expect(a.spf).toEqual({ result: 'pass', mailfrom: 'mail.example.com' });
    expect(a.dkim).toEqual([{ result: 'pass', domain: 'example.com' }]);
    expect(a.dmarc).toMatchObject({ result: 'pass', action: 'none', headerFrom: 'example.com' });
    expect(a.compauth).toEqual({ result: 'pass', reason: '100' });
    expect(a.secondary.map((s) => s.name)).toContain('X-MS-Exchange-Authentication-Results');
  });

  it('flags compauth failure as a notice', () => {
    const { a } = verdictFor('exo-fail-oreject.txt');
    expect(a.findings).toContainEqual({
      code: 'compauth-fail',
      severity: 'notice',
      params: { result: 'fail', reason: '000' },
    });
    expect(a.dmarc?.action).toBe('oreject');
  });

  it('uses the visible From address from Outlook when given', () => {
    const { v } = verdictFor('gmail-pass-reject.txt', { fromAddress: 'someone@other.example' });
    expect(v.reason).toBe('forgery');
  });

  it('notes multiple consistent hops without changing the verdict', () => {
    const raw =
      'Authentication-Results: mx.example.net; dmarc=pass (p=reject) header.from=example.com\n' +
      'Received: from relay.example.org by mx.example.net\n' +
      'Authentication-Results: relay.example.org; dmarc=pass (p=reject) header.from=example.com\n' +
      'From: a@example.com\n';
    const a = analyze(raw);
    expect(a.findings).toContainEqual({
      code: 'multiple-hops',
      severity: 'notice',
      params: { count: '2' },
    });
    expect(decide(a).state).toBe('verified');
  });
});
