import { describe, expect, it } from 'vitest';
import { decode, encode, toASCII, toUnicode } from '../src/parser/punycode';

// Reference values computed with Python's built-in punycode codec.
const VECTORS: [string, string][] = [
  ['pаypal', 'pypal-4ve'],
  ['аррӏе', '80ak6aa92e'],
  ['münchen', 'mnchen-3ya'],
  ['bücher', 'bcher-kva'],
  ['例え', 'r8jz45g'],
];

describe('punycode', () => {
  it.each(VECTORS)('round-trips %s', (u, p) => {
    expect(encode(u)).toBe(p);
    expect(decode(p)).toBe(u);
  });

  it('converts whole domains', () => {
    expect(toASCII('Bücher.Example.')).toBe('xn--bcher-kva.example');
    expect(toUnicode('XN--bcher-kva.example')).toBe('bücher.example');
    expect(toUnicode('xn--!!!.example')).toBe('xn--!!!.example');
  });

  it('rejects invalid input', () => {
    expect(() => decode('abcé-x')).toThrow(RangeError);
    expect(() => decode('a-!')).toThrow(RangeError);
    expect(() => decode('a-9')).toThrow(RangeError);
    expect(() => decode('99999999')).toThrow(/overflow/);
  });
});
