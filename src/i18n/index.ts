import { de } from './de';
import { type MessageKey, type Messages, en } from './en';
import { fr } from './fr';
import { nl } from './nl';

export type { MessageKey } from './en';

export const LOCALES = { en, nl, fr, de } as const satisfies Record<string, Messages>;
export type Locale = keyof typeof LOCALES;
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  nl: 'Nederlands',
  fr: 'Français',
  de: 'Deutsch',
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && Object.hasOwn(LOCALES, v);
}

/** Pick a locale from an explicit preference, then Outlook's display language (e.g. "nl-BE"). */
export function resolveLocale(
  preference: string | undefined,
  displayLanguage: string | undefined,
): Locale {
  if (isLocale(preference)) return preference;
  const base = displayLanguage?.toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : 'en';
}

let current: Messages = en;
let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  current = LOCALES[locale];
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = current[key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}

export function hasKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key);
}
