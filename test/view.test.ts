import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '../src/i18n';
import { analyze } from '../src/parser/analyze';
import { decide } from '../src/parser/verdict';
import {
  detailRows,
  findingText,
  infobarText,
  policyText,
  resultLabel,
  simpleView,
  verdictView,
} from '../src/ui/view';
import { verdictFor } from './helpers';

describe('view model', () => {
  afterEach(() => setLocale('en'));

  it('describes a verified message', () => {
    const { a, v } = verdictFor('gmail-pass-reject.txt');
    expect(verdictView(v, a)).toEqual({
      state: 'verified',
      title: 'Verified',
      summary:
        'The sender passed DMARC and example.com tells mail servers to reject anyone who fakes it.',
    });
    expect(infobarText(v, a)).toBe('DMARC Shield: verified sender (example.com).');
  });

  it('labels ARC-derived results with the forwarder', () => {
    const { a, v } = verdictFor('gmail-arc-forwarded.txt');
    expect(verdictView(v, a).via).toContain('lists.example.org');
    const unknown = { ...v, sealer: null };
    expect(verdictView(unknown, a).via).toContain('an unnamed forwarder');
  });

  it('localises', () => {
    setLocale('de');
    const { a, v } = verdictFor('exo-fail-oreject.txt');
    expect(verdictView(v, a).title).toBe('Nicht geschützt');
    expect(infobarText(v, a)).toMatch(/^DMARC Shield: Dieser Absender/);
  });

  it('builds detail rows for EXO, including missing and compauth rows', () => {
    const { a, v } = verdictFor('exo-fail-oreject.txt');
    const rows = detailRows(a, v);
    expect(rows.map((r) => r.label)).toEqual([
      'Sender',
      'DMARC',
      'SPF',
      'DKIM',
      'Microsoft compauth',
    ]);
    const dkim = rows.find((r) => r.label === 'DKIM');
    expect(dkim).toMatchObject({ tone: 'neutral', badge: 'none', info: [] });
    expect(rows.find((r) => r.label === 'DMARC')?.info).toContainEqual({
      label: 'Action',
      value: 'oreject',
    });
  });

  it('shows ARC rows, policy sources and placeholders for absent methods', () => {
    const { a, v } = verdictFor('gmail-arc-forwarded.txt');
    const rows = detailRows(a, v);
    expect(rows.find((r) => r.label === 'ARC')).toMatchObject({ badge: 'pass' });
    expect(rows.find((r) => r.label === 'DMARC')?.info).toContainEqual({
      label: 'Policy',
      value: 'reject (recorded by the forwarder)',
    });
    const bare = analyze('Authentication-Results: mx; dmarc=pass\n');
    const bareRows = detailRows(bare, decide(bare));
    expect(bareRows.find((r) => r.label === 'SPF')).toMatchObject({
      result: 'missing',
      badge: 'not recorded',
    });
    expect(bareRows.find((r) => r.label === 'DKIM')).toMatchObject({ result: 'missing' });
  });

  it('formats policies', () => {
    expect(policyText(undefined)).toBe('not visible in the headers');
    expect(policyText({ p: 'reject', source: 'dns', resolver: 'Quad9' })).toBe(
      'reject (from DNS via Quad9)',
    );
    expect(policyText({ p: 'reject', source: 'dns' })).toBe('reject (from DNS via DNS)');
    expect(policyText({ p: 'reject', pct: 20, source: 'header' })).toBe(
      'reject, partly enforced (from the message headers)',
    );
    expect(policyText({ p: 'none', testing: true, source: 'header' })).toContain('partly enforced');
  });

  it('formats findings and results', () => {
    expect(
      findingText({
        code: 'from-mixed-script',
        severity: 'forgery',
        params: { domain: 'xn--pypal-4ve.com' },
      }),
    ).toBe(
      'The sender domain pаypal.com (xn--pypal-4ve.com) mixes alphabets (for example Latin and Cyrillic), a common lookalike trick.',
    );
    expect(findingText({ code: 'multiple-from', severity: 'forgery' })).toBe(
      'The message has more than one sender address.',
    );
    expect(findingText({ code: 'unknown-code' as never, severity: 'notice' })).toBe('unknown-code');
    expect(resultLabel('softfail')).toBe('soft fail');
    expect(resultLabel('weird')).toBe('weird');
  });

  it('has simple states', () => {
    expect(simpleView('loading')).toEqual({ state: 'loading', title: 'Checking…', summary: '' });
    expect(simpleView('error', 'boom').summary).toBe('Outlook returned an error: boom');
    expect(simpleView('noitem').title).toBe('No message selected');
    expect(simpleView('unsupported').state).toBe('unsupported');
  });

  it('truncates long domains in the info bar', () => {
    const raw = `Authentication-Results: mx; dmarc=pass (p=reject) header.from=${'a'.repeat(80)}.example\nFrom: x@${'a'.repeat(80)}.example\n`;
    const a = analyze(raw);
    const text = infobarText(decide(a), a);
    expect(text.length).toBeLessThanOrEqual(150);
    expect(text).toContain('…');
    expect(infobarText(decide(analyze('X: y\n')), analyze('X: y\n'))).toContain(
      'could not be verified',
    );
  });

  it('describes internal and authenticated info bars', () => {
    const internal = verdictFor('exo-internal.txt');
    expect(infobarText(internal.v, internal.a)).toBe(
      'DMARC Shield: internal message from your organisation.',
    );
    const auth = verdictFor('gmail-pass-quarantine.txt');
    expect(infobarText(auth.v, auth.a)).toContain("doesn't fully block fakes");
  });
});
