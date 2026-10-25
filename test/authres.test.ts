import { describe, expect, it } from 'vitest';
import { firstResult, parseAuthResults, resultsFor } from '../src/parser/authres';

describe('parseAuthResults', () => {
  it('parses an RFC 8601 example', () => {
    const ar = parseAuthResults(
      'example.com 1; dkim=pass reason="good signature" header.i=@mail-router.example.net; ' +
        'dkim=fail reason="bad signature" header.i=@newyork.example.com',
    );
    expect(ar.authservId).toBe('example.com');
    expect(ar.version).toBe('1');
    expect(ar.valid).toBe(true);
    expect(resultsFor(ar, 'dkim').map((r) => [r.result, r.reason, r.props['header.i']])).toEqual([
      ['pass', 'good signature', '@mail-router.example.net'],
      ['fail', 'bad signature', '@newyork.example.com'],
    ]);
  });

  it('handles the explicit no-result form', () => {
    const ar = parseAuthResults('example.org 1; none');
    expect(ar).toMatchObject({
      authservId: 'example.org',
      noResult: true,
      valid: true,
      results: [],
    });
  });

  it('parses Exchange Online style without authserv-id', () => {
    const ar = parseAuthResults(
      'spf=pass (sender IP is 192.0.2.1) smtp.mailfrom=example.com; dkim=pass (signature was verified) header.d=example.com;dmarc=pass action=none header.from=example.com;compauth=pass reason=100',
    );
    expect(ar.authservId).toBeNull();
    expect(ar.results.map((r) => r.method)).toEqual(['spf', 'dkim', 'dmarc', 'compauth']);
    expect(firstResult(ar, 'spf')?.comments).toEqual(['sender IP is 192.0.2.1']);
    expect(firstResult(ar, 'dmarc')?.props.action).toBe('none');
    expect(firstResult(ar, 'compauth')?.reason).toBe('100');
  });

  it('attaches comments that touch the result (Yahoo)', () => {
    const ar = parseAuthResults('atlas.yahoo.com; dmarc=pass(p=REJECT) header.from=example.com;');
    const d = firstResult(ar, 'dmarc');
    expect(d?.result).toBe('pass');
    expect(d?.comments).toEqual(['p=REJECT']);
    expect(d?.props['header.from']).toBe('example.com');
  });

  it('handles nested comments, escapes and quoted strings with semicolons', () => {
    const ar = parseAuthResults(
      'mx.example.net; dkim=pass (outer (inner) \\) done) reason="a; b" header.d=example.com',
    );
    const d = firstResult(ar, 'dkim');
    expect(d?.comments).toEqual(['outer (inner) ) done']);
    expect(d?.reason).toBe('a; b');
    expect(ar.results).toHaveLength(1);
  });

  it('parses method versions and lower-cases keys/results', () => {
    const ar = parseAuthResults('mx.example.net; DKIM/1=PASS Header.D=Example.com');
    expect(firstResult(ar, 'dkim')).toMatchObject({ version: '1', result: 'pass' });
    expect(firstResult(ar, 'dkim')?.props['header.d']).toBe('Example.com');
  });

  it('accepts a resinfo directly after the authserv-id without a separator', () => {
    const ar = parseAuthResults('mx.example.net spf=pass smtp.mailfrom=example.com');
    expect(ar.authservId).toBe('mx.example.net');
    expect(firstResult(ar, 'spf')?.result).toBe('pass');
  });

  it('keeps the first occurrence of a repeated property and reason', () => {
    const ar = parseAuthResults('x; spf=pass reason=a reason=b smtp.mailfrom=a smtp.mailfrom=b');
    expect(firstResult(ar, 'spf')).toMatchObject({ reason: 'a', props: { 'smtp.mailfrom': 'a' } });
  });

  it('rejects garbage and unterminated constructs', () => {
    expect(parseAuthResults(';;; === ;;').valid).toBe(false);
    expect(parseAuthResults('').valid).toBe(false);
    expect(parseAuthResults('mx.example.net; dkim=pass (unterminated').valid).toBe(false);
    expect(parseAuthResults('mx.example.net; dkim=pass reason="open').valid).toBe(false);
    expect(parseAuthResults('mx.example.net; =pass; dkim=; spf=p@ss').results).toEqual([]);
    expect(parseAuthResults('mx.example.net; none').valid).toBe(true);
    expect(parseAuthResults('none').valid).toBe(false);
  });

  it('parses ARC-Authentication-Results instances', () => {
    const ar = parseAuthResults('i=2; mx.google.com; dmarc=pass header.from=example.com', {
      arc: true,
    });
    expect(ar.instance).toBe(2);
    expect(ar.authservId).toBe('mx.google.com');
    expect(firstResult(ar, 'dmarc')?.result).toBe('pass');
    expect(parseAuthResults('i=0; x; spf=pass', { arc: true }).instance).toBeUndefined();
    expect(parseAuthResults('x; spf=pass', { arc: true })).toMatchObject({ authservId: 'x' });
  });

  it('helpers tolerate missing input', () => {
    expect(resultsFor(null, 'dkim')).toEqual([]);
    expect(firstResult(undefined, 'dkim')).toBeUndefined();
  });
});
