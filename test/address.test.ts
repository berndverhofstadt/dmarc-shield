import { describe, expect, it } from 'vitest';
import {
  addressInDisplayName,
  decodeEncodedWords,
  domainOf,
  orgDomainGuess,
  parseMailbox,
  parseMailboxList,
  relaxedAligned,
} from '../src/parser/address';

describe('address parsing', () => {
  it('takes the address from the angle-addr, never the display name', () => {
    expect(parseMailbox('"security@bank.example" <x@Evil.Example.>')).toEqual({
      address: 'x@Evil.Example.',
      domain: 'evil.example',
      displayName: 'security@bank.example',
    });
  });

  it('parses bare addresses, comments and route syntax', () => {
    expect(parseMailbox('a@example.com (Alice)')?.domain).toBe('example.com');
    expect(parseMailbox('<@relay.example:bob@example.org>')?.address).toBe('bob@example.org');
    expect(parseMailbox('no address here')).toBeNull();
    expect(parseMailbox('<user@>')).toBeNull();
  });

  it('splits lists, respecting quotes, comments and groups', () => {
    const list = parseMailboxList(
      '"Doe, John" <j@example.com>, (x, y) b@example.org, "q\\"x" <c@example.net>',
    );
    expect(list.map((m) => m.domain)).toEqual(['example.com', 'example.org', 'example.net']);
    expect(list[2]?.displayName).toBe('q"x');
    expect(parseMailboxList('Team: a@example.com, b@example.com;').map((m) => m.address)).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('decodes RFC 2047 encoded words (B and Q, adjacent words joined)', () => {
    expect(decodeEncodedWords('=?UTF-8?B?SsO8cmdlbg==?=')).toBe('Jürgen');
    expect(decodeEncodedWords('=?iso-8859-1?Q?Caf=E9_Bar?=')).toBe('Café Bar');
    expect(decodeEncodedWords('=?UTF-8?Q?a?= =?UTF-8?Q?b?=')).toBe('ab');
    expect(decodeEncodedWords('=?x-unknown?Q?plain?=')).toBe('plain');
    expect(decodeEncodedWords('=?UTF-8?B?***?=')).toBe('=?UTF-8?B?***?=');
    expect(decodeEncodedWords('=?UTF-8*en?Q?hi?=')).toBe('hi');
    expect(parseMailbox('=?UTF-8?B?SsO8cmdlbg==?= <j@example.com>')?.displayName).toBe('Jürgen');
  });

  it('normalises IDN domains to punycode', () => {
    expect(domainOf('x@Bücher.example')).toBe('xn--bcher-kva.example');
    expect(domainOf('x@[192.0.2.1]')).toBe('192.0.2.1');
    expect(domainOf('nobody')).toBe('');
  });

  it('finds addresses embedded in display names', () => {
    expect(addressInDisplayName('Support (help@bank.example)')).toBe('help@bank.example');
    expect(addressInDisplayName('Alice')).toBeNull();
  });

  it('guesses organisational domains', () => {
    expect(orgDomainGuess('mail.example.com')).toBe('example.com');
    expect(orgDomainGuess('a.b.example.co.uk')).toBe('example.co.uk');
    expect(orgDomainGuess('example.com')).toBe('example.com');
    expect(orgDomainGuess('www.example.de')).toBe('example.de');
    expect(relaxedAligned('news.example.com', 'example.com')).toBe(true);
    expect(relaxedAligned('example.net', 'example.com')).toBe(false);
  });
});
