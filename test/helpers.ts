import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyze, type AnalysisContext } from '../src/parser/analyze';
import { decide } from '../src/parser/verdict';
import type { PolicyInfo } from '../src/parser/policy';

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

export function verdictFor(name: string, ctx: AnalysisContext = {}, dns?: PolicyInfo) {
  const a = analyze(fixture(name), ctx);
  return { a, v: decide(a, dns) };
}
