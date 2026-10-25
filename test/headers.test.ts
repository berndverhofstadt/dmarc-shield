import { describe, expect, it } from 'vitest';
import { findHeaders, firstHeader, parseHeaders } from '../src/parser/headers';

describe('parseHeaders', () => {
  it('unfolds continuation lines and keeps order', () => {
    const h = parseHeaders('A: one\r\n two\r\nB:\tthree\r\nA: four\r\n\r\nbody: not a header');
    expect(h.map((x) => [x.name, x.value, x.index])).toEqual([
      ['A', 'one two', 0],
      ['B', 'three', 1],
      ['A', 'four', 2],
    ]);
  });

  it('skips leading blank lines, orphan continuations and malformed lines', () => {
    const h = parseHeaders('\n\n  orphan\nnot a header line\nX-Ok: yes\n');
    expect(h).toEqual([{ name: 'X-Ok', lname: 'x-ok', value: 'yes', index: 0 }]);
  });

  it('handles bare CR line endings', () => {
    expect(parseHeaders('A: 1\rB: 2').map((x) => x.value)).toEqual(['1', '2']);
  });

  it('finds headers case-insensitively', () => {
    const h = parseHeaders('From: a\nfrom: b\nTo: c');
    expect(findHeaders(h, 'FROM').map((x) => x.value)).toEqual(['a', 'b']);
    expect(firstHeader(h, 'to')?.value).toBe('c');
    expect(firstHeader(h, 'cc')).toBeUndefined();
  });
});
