#!/usr/bin/env node
/**
 * Render manifest/manifest.template.xml.
 *
 *   node scripts/build-manifest.mjs            → dist/manifest.xml (production URL)
 *   node scripts/build-manifest.mjs --dev      → manifest.dev.xml  (https://localhost:3000/)
 *
 * The production base URL defaults to GitHub Pages and can be overridden with
 * ADDIN_BASE_URL (e.g. for Azure Static Web Apps). It must be https and end with "/".
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const dev = process.argv.includes('--dev');

// Separate IDs so a dev sideload never collides with an installed release.
const ID = dev ? '5a06a6cf-4fbe-46fd-ae61-c573e9c11513' : '4fd5f78f-a5a3-4fb8-a41d-420cd2b4e01f';
export const DEFAULT_BASE_URL = 'https://berndverhofstadt.github.io/dmarc-shield/';
const baseUrl = dev ? 'https://localhost:3000/' : (process.env.ADDIN_BASE_URL ?? DEFAULT_BASE_URL);

if (!/^https:\/\/[^\s"<>]+\/$/.test(baseUrl)) {
  console.error(`ADDIN_BASE_URL must be an https URL ending in "/": ${baseUrl}`);
  process.exit(1);
}
// Office manifests use a four-part version; package.json uses semver.
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!m) {
  console.error(`package.json version must be MAJOR.MINOR.PATCH, got ${pkg.version}`);
  process.exit(1);
}
const version = `${m[1]}.${m[2]}.${m[3]}.0`;

const xml = readFileSync(resolve(root, 'manifest/manifest.template.xml'), 'utf8')
  .replaceAll('{{BASE_URL}}', baseUrl)
  .replaceAll('{{ID}}', ID)
  .replaceAll('{{VERSION}}', version)
  .replaceAll('{{NAME_SUFFIX}}', dev ? ' (dev)' : '');

const out = dev ? resolve(root, 'manifest.dev.xml') : resolve(root, 'dist/manifest.xml');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, xml);
console.log(`Wrote ${out} (${baseUrl}, v${version})`);
