import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, memoryStore, parseSettings, roamingStore } from '../src/settings';

describe('settings', () => {
  it('validates stored values', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(
      parseSettings({
        showInfoBar: false,
        dnsLookup: true,
        bimiLookup: true,
        resolver: 'google',
        language: 'fr',
        extra: 1,
      }),
    ).toEqual({
      showInfoBar: false,
      dnsLookup: true,
      bimiLookup: true,
      resolver: 'google',
      language: 'fr',
    });
    expect(
      parseSettings({ showInfoBar: 'yes', dnsLookup: 1, resolver: 'evil', language: 'xx' }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps all network features off by default', () => {
    expect(DEFAULT_SETTINGS.dnsLookup).toBe(false);
    expect(DEFAULT_SETTINGS.bimiLookup).toBe(false);
  });

  it('memory store round-trips', async () => {
    const s = memoryStore({ language: 'nl' });
    expect(s.load().language).toBe('nl');
    await s.save({ ...DEFAULT_SETTINGS, dnsLookup: true });
    expect(s.load().dnsLookup).toBe(true);
  });

  it('roaming store uses a single key and reports save errors', async () => {
    vi.stubGlobal('Office', { AsyncResultStatus: { Succeeded: 'succeeded', Failed: 'failed' } });
    const data: Record<string, unknown> = {};
    let ok = true;
    const rs = {
      get: (k: string) => data[k],
      set: (k: string, v: unknown) => (data[k] = v),
      saveAsync: (cb: (r: { status: string; error?: { message: string } }) => void) =>
        cb(ok ? { status: 'succeeded' } : { status: 'failed', error: { message: 'quota' } }),
    } as unknown as Office.RoamingSettings;
    const store = roamingStore(rs);
    await store.save({ ...DEFAULT_SETTINGS, resolver: 'cloudflare' });
    expect(Object.keys(data)).toEqual(['ds.settings']);
    expect(store.load().resolver).toBe('cloudflare');
    ok = false;
    await expect(store.save(DEFAULT_SETTINGS)).rejects.toThrow('quota');
    vi.unstubAllGlobals();
  });
});
