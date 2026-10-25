import { afterEach, describe, expect, it } from 'vitest';
import { LOCALES, getLocale, hasKey, isLocale, resolveLocale, setLocale, t } from '../src/i18n';
import { en } from '../src/i18n/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  afterEach(() => setLocale('en'));

  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} has every key with the same placeholders`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(en)) {
        expect(placeholders(messages[k as keyof typeof en]), `${locale}:${k}`).toEqual(
          placeholders(v),
        );
        expect(messages[k as keyof typeof en].trim(), `${locale}:${k}`).not.toBe('');
      }
    });

    it(`${locale} info-bar texts fit in 150 characters with a 60-char domain`, () => {
      setLocale(locale as keyof typeof LOCALES);
      for (const k of [
        'infobar.verified',
        'infobar.authenticated',
        'infobar.unprotected',
        'infobar.internal',
      ] as const) {
        expect(t(k, { domain: 'x'.repeat(60) }).length).toBeLessThanOrEqual(150);
      }
    });
  }

  it('resolves locales', () => {
    expect(resolveLocale('de', 'nl-NL')).toBe('de');
    expect(resolveLocale(undefined, 'nl-BE')).toBe('nl');
    expect(resolveLocale('auto', 'fr_CA')).toBe('fr');
    expect(resolveLocale(undefined, 'ja-JP')).toBe('en');
    expect(resolveLocale(undefined, undefined)).toBe('en');
    expect(isLocale('xx')).toBe(false);
  });

  it('interpolates and leaves unknown placeholders', () => {
    setLocale('nl');
    expect(getLocale()).toBe('nl');
    expect(t('footer.version', { version: '1.2.3' })).toBe('Versie 1.2.3');
    expect(t('footer.version')).toBe('Versie {version}');
    expect(hasKey('footer.version')).toBe(true);
    expect(hasKey('nope')).toBe(false);
  });
});
