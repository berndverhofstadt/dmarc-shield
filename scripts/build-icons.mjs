#!/usr/bin/env node
/**
 * Render brand/logo*.svg to every PNG size the manifest, the Store listing and
 * the website need. Output is committed (public/assets, brand/store) so the build
 * doesn't depend on native tooling.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logo = readFileSync(resolve(root, 'brand/logo.svg'), 'utf8');
const small = readFileSync(resolve(root, 'brand/logo-small.svg'), 'utf8');

function png(svg, size, background) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background,
  });
  return r.render().asPng();
}

const targets = [
  // Manifest ribbon icons (16/32/80) and IconUrl/HighResolutionIconUrl (64/128)
  ...[16, 20, 24, 32, 40, 48].map((s) => ({
    out: `public/assets/icon-${s}.png`,
    svg: small,
    size: s,
  })),
  ...[64, 80, 128, 256].map((s) => ({ out: `public/assets/icon-${s}.png`, svg: logo, size: s })),
  // Partner Center logo: PNG between 216 and 350 px square (policy 100.3)
  { out: 'brand/store/logo-300.png', svg: logo, size: 300 },
  { out: 'brand/store/logo-300-white.png', svg: logo, size: 300, background: '#ffffff' },
];

for (const t of targets) {
  const file = resolve(root, t.out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(t.svg, t.size, t.background));
  console.log(`${t.out} (${t.size}px)`);
}
writeFileSync(resolve(root, 'public/assets/logo.svg'), logo);
