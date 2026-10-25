import { describe, expect, it } from 'vitest';
import {
  analyzeDomain,
  isMixedScript,
  looksLike,
  scriptsOf,
  skeleton,
} from '../src/parser/lookalike';

describe('lookalike detection', () => {
  it('builds skeletons', () => {
    expect(skeleton('pаypal')).toBe('paypal');
    expect(skeleton('rnicrosoft')).toBe('microsoft');
    expect(skeleton('ＰａｙＰａｌ')).toBe('paypal');
    expect(skeleton('paypa1')).toBe('paypal');
  });

  it('detects mixed scripts but allows CJK combinations', () => {
    expect(isMixedScript('pаypal')).toBe(true);
    expect(isMixedScript('paypal')).toBe(false);
    expect(isMixedScript('例えtest')).toBe(false);
    expect(isMixedScript('ﬀ')).toBe(false);
    expect([...scriptsOf('aא')]).toEqual(['Latin', 'Hebrew']);
    expect([...scriptsOf('ᚠ')]).toEqual(['Other']);
  });

  it('analyses domains', () => {
    expect(analyzeDomain('xn--pypal-4ve.com')).toMatchObject({ isIdn: true, mixedScript: true });
    expect(analyzeDomain('xn--80ak6aa92e.com')).toMatchObject({
      unicode: 'аррӏе.com',
      mixedScript: false,
      wholeScriptConfusable: true,
    });
    expect(analyzeDomain('xn--mnchen-3ya.de')).toMatchObject({
      isIdn: true,
      mixedScript: false,
      wholeScriptConfusable: false,
    });
    expect(analyzeDomain('пример.рф').wholeScriptConfusable).toBe(false);
    expect(analyzeDomain('example.com')).toMatchObject({ isIdn: false, mixedScript: false });
  });

  it('compares domains', () => {
    expect(looksLike('paypa1.com', 'paypal.com')).toBe(true);
    expect(looksLike('xn--pypal-4ve.com', 'paypal.com')).toBe(true);
    expect(looksLike('paypal.com', 'PayPal.com')).toBe(false);
    expect(looksLike('example.com', 'example.net')).toBe(false);
  });
});
