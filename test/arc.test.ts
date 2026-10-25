import { describe, expect, it } from 'vitest';
import { analyzeArc, parseTagList } from '../src/parser/arc';
import { parseAuthResults } from '../src/parser/authres';
import { parseHeaders } from '../src/parser/headers';

const set = (
  i: number,
  cv: string,
  aar = `i=${i}; hop${i}.example; dmarc=pass header.from=example.com`,
) =>
  `ARC-Seal: i=${i}; a=rsa-sha256; cv=${cv}; d=hop${i}.example; s=s; b=x\n` +
  `ARC-Message-Signature: i=${i}; a=rsa-sha256; d=hop${i}.example; s=s; h=from; bh=x; b=x\n` +
  `ARC-Authentication-Results: ${aar}\n`;

function run(raw: string, topIndex: number | null = null) {
  const headers = parseHeaders(raw);
  const top =
    topIndex === null ? null : { ...parseAuthResults(headers[topIndex]!.value), index: topIndex };
  return analyzeArc(headers, top);
}

describe('ARC analysis', () => {
  it('parses tag lists', () => {
    expect(parseTagList('i=1; a=rsa-sha256; cv=none; b=ab cd\n ef; junk')).toEqual({
      i: '1',
      a: 'rsa-sha256',
      cv: 'none',
      b: 'abcdef',
    });
  });

  it('reports no ARC', () => {
    expect(run('From: a@example.com\n')).toMatchObject({ structure: 'none', receiver: null });
  });

  it('validates a two-hop chain', () => {
    expect(run(set(2, 'pass') + set(1, 'none')).structure).toBe('valid');
  });

  it('detects gaps, duplicates, bad cv and unnumbered headers', () => {
    expect(run(set(2, 'pass')).structure).toBe('broken');
    expect(run(set(1, 'none') + set(1, 'none')).structure).toBe('broken');
    expect(run(set(1, 'pass')).structure).toBe('broken');
    expect(run(set(2, 'fail') + set(1, 'none')).structure).toBe('failed');
    expect(run('ARC-Seal: a=rsa-sha256; cv=none\n').structure).toBe('broken');
    expect(run('ARC-Authentication-Results: hop.example; dmarc=pass\n').structure).toBe('broken');
    expect(run('ARC-Seal: i=99; cv=none\n').structure).toBe('broken');
  });

  it('trusts the receiver AAR only above the trusted A-R', () => {
    const above =
      set(2, 'pass', 'i=2; mx.microsoft.com 1; arc=pass (0 oda=1)') +
      'Authentication-Results: spf=fail smtp.mailfrom=x;dmarc=fail header.from=example.com\n' +
      set(1, 'none');
    expect(run(above, 3).receiver).toEqual({ result: 'pass', source: 'receiver-aar' });

    const below =
      'Authentication-Results: spf=fail smtp.mailfrom=x;dmarc=fail header.from=example.com\n' +
      set(2, 'pass', 'i=2; mx.microsoft.com 1; arc=pass') +
      set(1, 'none');
    expect(run(below, 0).receiver).toBeNull();
  });

  it('reads arc= as a dmarc property and normalises results', () => {
    const raw =
      'Authentication-Results: mx.example.net; dmarc=fail arc=PASS header.from=example.com\n' +
      set(1, 'none');
    expect(run(raw, 0).receiver).toEqual({ result: 'pass', source: 'top-ar' });
    const neutral = 'Authentication-Results: mx.example.net; arc=neutral\n';
    expect(run(neutral, 0).receiver?.result).toBe('none');
    const fail = 'Authentication-Results: mx.example.net; arc=fail\n';
    expect(run(fail, 0).receiver?.result).toBe('fail');
  });

  it('exposes the original (i=1) results', () => {
    const r = run(set(1, 'none', 'i=1; lists.example.org; spf=pass smtp.mailfrom=x'));
    expect(r.original).toEqual({ authservId: 'lists.example.org' });
  });
});
