/** DMARC TXT record parsing (RFC 7489 §6.3, with DMARCbis `t=`/`np=`/`psd=`). */

export type DmarcPolicy = 'none' | 'quarantine' | 'reject';

export interface DmarcRecord {
  p: DmarcPolicy;
  sp?: DmarcPolicy;
  np?: DmarcPolicy;
  pct?: number;
  /** DMARCbis testing flag (`t=y`). */
  testing?: boolean;
}

export function asPolicy(v: string | undefined): DmarcPolicy | undefined {
  const s = v?.trim().toLowerCase();
  return s === 'none' || s === 'quarantine' || s === 'reject' ? s : undefined;
}

export function isDmarcRecord(txt: string): boolean {
  return /^v\s*=\s*DMARC1\s*(;|$)/i.test(txt.trim());
}

export function parseDmarcRecord(txt: string): DmarcRecord | null {
  if (!isDmarcRecord(txt)) return null;
  const tags: Record<string, string> = {};
  for (const part of txt.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim().toLowerCase();
    if (k && !(k in tags)) tags[k] = part.slice(eq + 1).trim();
  }
  // A missing or invalid p= is treated as "none" (RFC 7489 §6.6.3, DMARCbis).
  const rec: DmarcRecord = { p: asPolicy(tags.p) ?? 'none' };
  const sp = asPolicy(tags.sp);
  if (sp) rec.sp = sp;
  const np = asPolicy(tags.np);
  if (np) rec.np = np;
  if (tags.pct !== undefined && /^\d{1,3}$/.test(tags.pct))
    rec.pct = Math.min(100, Number(tags.pct));
  if (tags.t !== undefined) rec.testing = tags.t.toLowerCase() === 'y';
  return rec;
}
