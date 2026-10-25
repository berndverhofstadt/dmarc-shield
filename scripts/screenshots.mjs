#!/usr/bin/env node
/**
 * Render 1280×720 Store/website screenshots from demo mode.
 * Requires the dev server (`npm run dev`) and a Chromium-based browser:
 *   BROWSER=microsoft-edge node scripts/screenshots.mjs
 *
 * The frame (mock Outlook window) and the task pane are captured separately and
 * composited, because Office.js won't run inside an iframe outside Outlook.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.env.BROWSER ?? 'microsoft-edge';
const base = process.env.DEV_URL ?? 'https://localhost:3000/';
const states = ['verified', 'authenticated', 'arc', 'unprotected', 'lookalike'];
const PANE = { x: 860, y: 136, w: 380, h: 560 };

function capture(url, width, height, out) {
  const profile = mkdtempSync(join(tmpdir(), 'ds-shot-'));
  try {
    execFileSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--hide-scrollbars',
        // Local dev certificate only; never use this flag against real sites.
        '--ignore-certificate-errors',
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        '--virtual-time-budget=8000',
        `--screenshot=${out}`,
        url,
      ],
      { stdio: 'ignore' },
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'ds-shots-'));
for (const state of states) {
  const frame = join(tmp, `${state}-frame.png`);
  const pane = join(tmp, `${state}-pane.png`);
  capture(`${base}screenshot.html?state=${state}`, 1280, 720, frame);
  capture(`${base}taskpane.html?demo=${state}&lang=en&clean=1`, PANE.w, PANE.h, pane);
  const b64 = (f) => readFileSync(f).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="720">
    <image href="data:image/png;base64,${b64(frame)}" x="0" y="0" width="1280" height="720"/>
    <image href="data:image/png;base64,${b64(pane)}" x="${PANE.x}" y="${PANE.y}" width="${PANE.w}" height="${PANE.h}"/>
  </svg>`;
  const out = resolve(root, `public/assets/screenshots/${state}.png`);
  writeFileSync(out, new Resvg(svg).render().asPng());
  console.log(out);
}
rmSync(tmp, { recursive: true, force: true });
