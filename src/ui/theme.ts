/** Follow Outlook's theme when Office exposes it (Mailbox 1.14+); otherwise prefers-color-scheme. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1] as string, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function themeFor(bodyBackground: string | undefined): 'dark' | 'light' | null {
  const l = bodyBackground ? luminance(bodyBackground) : null;
  return l === null ? null : l < 0.2 ? 'dark' : 'light';
}

export function applyOfficeTheme(): void {
  const apply = () => {
    const theme = themeFor(Office.context.officeTheme?.bodyBackgroundColor);
    if (theme) document.documentElement.dataset.theme = theme;
  };
  apply();
  // Theme changes while the pane is open (Mailbox 1.14 OfficeThemeChanged).
  const ev = (Office.EventType as unknown as Record<string, Office.EventType | undefined>)
    .OfficeThemeChanged;
  if (ev) Office.context.mailbox?.addHandlerAsync?.(ev, apply);
}
