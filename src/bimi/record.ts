/** BIMI assertion record parsing (draft-brand-indicators-for-message-identification §4.2). */

export interface BimiRecord {
  /** Logo URI (https), or null for a declination record (`l=` empty). */
  l: string | null;
  /** Evidence (certificate) URI (https), if any. */
  a: string | null;
}

const https = (v: string | undefined): string | null => {
  const s = v?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

export function isBimiRecord(txt: string): boolean {
  return /^v\s*=\s*BIMI1\s*(;|$)/i.test(txt.trim());
}

export function parseBimiRecord(txt: string): BimiRecord | null {
  if (!isBimiRecord(txt)) return null;
  const tags: Record<string, string> = {};
  for (const part of txt.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim().toLowerCase();
    if (k && !(k in tags)) tags[k] = part.slice(eq + 1).trim();
  }
  // Only the first URI of a comma-separated list is used.
  return { l: https(tags.l?.split(',')[0]), a: https(tags.a?.split(',')[0]) };
}

/** A record with neither a usable logo nor evidence means the domain declines BIMI. */
export function isDeclination(r: BimiRecord): boolean {
  return r.l === null && r.a === null;
}
