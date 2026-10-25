/**
 * Tiny DOM helpers. All dynamic text goes through textContent: untrusted
 * header content is never parsed as HTML.
 */
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const GLYPHS: Record<string, string> = {
  check: 'M38 63 56 81 91 45',
  cross: 'M44 44 84 84M84 44 44 84',
  question: 'M50 50c0-9 6-15 14-15s14 6 14 14c0 11-14 12-14 24M64 89v1',
  dots: 'M44 64h1M64 64h1M84 64h1',
};

/** Large shield icon. Decorative: the state is always also given as text. */
export function shield(glyph: keyof typeof GLYPHS): SVGElement {
  const root = svg('svg', { viewBox: '0 0 128 128', 'aria-hidden': 'true', focusable: 'false' });
  root.append(
    svg('path', {
      class: 'shield-body',
      d: 'M64 6 113 22v38c0 33-21 54-49 63C36 114 15 93 15 60V22Z',
    }),
    svg('path', {
      class: 'shield-glyph',
      d: GLYPHS[glyph] as string,
      fill: 'none',
      'stroke-width': '13',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return root;
}

export function clear(el: Element): void {
  el.replaceChildren();
}
