/**
 * User settings, stored in Office roaming settings: the user's own mailbox,
 * never sent anywhere else.
 */
import { type ResolverId, isResolverId } from './dns/lookup';
import { type Locale, isLocale } from './i18n';

export interface Settings {
  showInfoBar: boolean;
  dnsLookup: boolean;
  /** Opt-in BIMI check: DNS + downloading logo/certificate from the sender's logo host. */
  bimiLookup: boolean;
  resolver: ResolverId;
  language: 'auto' | Locale;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  showInfoBar: true,
  dnsLookup: false,
  bimiLookup: false,
  resolver: 'quad9',
  language: 'auto',
};

const KEY = 'ds.settings';

/** Validate untrusted stored data; unknown or invalid fields fall back to defaults. */
export function parseSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (raw === null || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  if (typeof r.showInfoBar === 'boolean') s.showInfoBar = r.showInfoBar;
  if (typeof r.dnsLookup === 'boolean') s.dnsLookup = r.dnsLookup;
  if (typeof r.bimiLookup === 'boolean') s.bimiLookup = r.bimiLookup;
  if (isResolverId(r.resolver)) s.resolver = r.resolver;
  if (r.language === 'auto' || isLocale(r.language)) s.language = r.language;
  return s;
}

export interface SettingsStore {
  load(): Settings;
  save(s: Settings): Promise<void>;
}

export function roamingStore(rs: Office.RoamingSettings): SettingsStore {
  return {
    load: () => parseSettings(rs.get(KEY)),
    save: (s) =>
      new Promise((resolve, reject) => {
        rs.set(KEY, { ...s });
        rs.saveAsync((r) =>
          r.status === Office.AsyncResultStatus.Succeeded
            ? resolve()
            : reject(new Error(r.error?.message ?? 'saveAsync failed')),
        );
      }),
  };
}

export function memoryStore(initial: Partial<Settings> = {}): SettingsStore {
  let current = parseSettings(initial);
  return {
    load: () => ({ ...current }),
    save: async (s) => {
      current = parseSettings(s);
    },
  };
}
