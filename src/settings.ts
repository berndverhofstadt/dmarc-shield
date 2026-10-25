/**
 * User settings, stored in Office roaming settings: the user's own mailbox,
 * never sent anywhere else.
 */
import { type ResolverId, isResolverId, normalizeDohUrl } from './dns/lookup';
import { type Locale, isLocale } from './i18n';

export interface Settings {
  showInfoBar: boolean;
  dnsLookup: boolean;
  /** Opt-in BIMI check: DNS + downloading logo/certificate from the sender's logo host. */
  bimiLookup: boolean;
  /** A preset, or 'custom' to use `customResolver`. */
  resolver: ResolverId | 'custom';
  /** Custom DoH endpoint (RFC 8484), e.g. the organisation's resolver. */
  customResolver: string;
  language: 'auto' | Locale;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  showInfoBar: true,
  dnsLookup: false,
  bimiLookup: false,
  resolver: 'quad9',
  customResolver: '',
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
  const custom = typeof r.customResolver === 'string' ? normalizeDohUrl(r.customResolver) : null;
  if (custom) s.customResolver = custom;
  if (isResolverId(r.resolver)) s.resolver = r.resolver;
  else if (r.resolver === 'custom' && custom) s.resolver = 'custom';
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
