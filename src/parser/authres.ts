/**
 * Authentication-Results parser (RFC 8601), tolerant of the real-world
 * variants we see in practice:
 *
 *  - Exchange Online omits the authserv-id:
 *      `spf=pass (sender IP is …) smtp.mailfrom=x; dkim=pass …; dmarc=pass action=none header.from=x;compauth=pass reason=100`
 *  - Comments directly attached to results: `dmarc=pass(p=REJECT)` (Yahoo)
 *  - Non-ptype properties such as `action=` (EXO) and `x-bits=` (Fastmail)
 *  - ARC-Authentication-Results, which prefix the payload with `i=N;`
 */

export interface ResInfo {
  /** Lower-cased method keyword, e.g. "dmarc", "spf", "dkim". */
  method: string;
  /** Method version, if given as `method/1`. */
  version?: string;
  /** Lower-cased result, e.g. "pass", "fail", "none". */
  result: string;
  reason?: string;
  /** Lower-cased property keys (`header.from`, `smtp.mailfrom`, `action`, …); first occurrence wins. */
  props: Record<string, string>;
  /** Comment text attached to this resinfo, without parentheses. */
  comments: string[];
}

export interface AuthResults {
  /** Authserv-id, lower-cased; null if the header omitted it (Exchange Online). */
  authservId: string | null;
  version?: string;
  /** ARC instance (`i=`), only for ARC-Authentication-Results. */
  instance?: number;
  results: ResInfo[];
  /** True if the header explicitly said `; none`. */
  noResult: boolean;
  /** False if the header couldn't be understood at all. */
  valid: boolean;
}

interface Segment {
  text: string;
  comments: string[];
}

type Token = { t: 'word'; v: string } | { t: 'eq' } | { t: 'quoted'; v: string };

/** Split on top-level `;`, extracting (possibly nested) comments and keeping quoted strings intact. */
function splitSegments(value: string): { segments: Segment[]; malformed: boolean } {
  const segments: Segment[] = [];
  let text = '';
  let comments: string[] = [];
  let malformed = false;
  let i = 0;

  while (i < value.length) {
    const c = value[i] as string;
    if (c === '"') {
      let j = i + 1;
      while (j < value.length && value[j] !== '"') j += value[j] === '\\' ? 2 : 1;
      if (j >= value.length) malformed = true;
      text += value.slice(i, j + 1);
      i = j + 1;
    } else if (c === '(') {
      let depth = 1;
      let j = i + 1;
      let buf = '';
      while (j < value.length && depth > 0) {
        const d = value[j] as string;
        if (d === '\\') {
          buf += value[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (d === '(') depth++;
        else if (d === ')') depth--;
        if (depth > 0) buf += d;
        j++;
      }
      if (depth > 0) malformed = true;
      comments.push(buf.trim());
      text += ' ';
      i = j;
    } else if (c === ';') {
      segments.push({ text, comments });
      text = '';
      comments = [];
      i++;
    } else {
      text += c;
      i++;
    }
  }
  segments.push({ text, comments });
  return { segments, malformed };
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i] as string;
    if (c === ' ' || c === '\t') {
      i++;
    } else if (c === '=') {
      tokens.push({ t: 'eq' });
      i++;
    } else if (c === '"') {
      let j = i + 1;
      let v = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') j++;
        v += text[j] ?? '';
        j++;
      }
      tokens.push({ t: 'quoted', v });
      i = j + 1;
    } else {
      let j = i;
      while (j < text.length && !' \t="'.includes(text[j] as string)) j++;
      tokens.push({ t: 'word', v: text.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

const METHOD = /^([a-z0-9][a-z0-9_-]*)(?:\/([0-9]+))?$/i;
const RESULT = /^[a-z0-9_.-]+$/i;

/** Read `key = value` pairs from a token stream. Stray tokens are skipped. */
function pairs(tokens: Token[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < tokens.length; i++) {
    const k = tokens[i];
    const eq = tokens[i + 1];
    const v = tokens[i + 2];
    if (k?.t === 'word' && eq?.t === 'eq' && v && v.t !== 'eq') {
      out.push([k.v, v.v]);
      i += 2;
    }
  }
  return out;
}

function parseResInfo(tokens: Token[], comments: string[]): ResInfo | null {
  const kv = pairs(tokens);
  const head = kv[0];
  if (!head) return null;
  const m = METHOD.exec(head[0]);
  if (!m || !RESULT.test(head[1])) return null;
  const info: ResInfo = {
    method: (m[1] as string).toLowerCase(),
    result: head[1].toLowerCase(),
    props: {},
    comments,
  };
  if (m[2]) info.version = m[2];
  for (const [k, v] of kv.slice(1)) {
    const key = k.toLowerCase();
    if (key === 'reason' && info.reason === undefined) info.reason = v;
    else if (!(key in info.props)) info.props[key] = v;
  }
  return info;
}

export interface ParseOptions {
  /** Parse as ARC-Authentication-Results (leading `i=N;`). */
  arc?: boolean;
}

export function parseAuthResults(value: string, opts: ParseOptions = {}): AuthResults {
  const { segments, malformed } = splitSegments(value);
  const out: AuthResults = { authservId: null, results: [], noResult: false, valid: false };
  let idx = 0;

  if (opts.arc) {
    const t = tokenize(segments[0]?.text ?? '');
    const k = t[0];
    const n = t[2];
    if (
      t.length === 3 &&
      k?.t === 'word' &&
      k.v.toLowerCase() === 'i' &&
      t[1]?.t === 'eq' &&
      n &&
      n.t !== 'eq'
    ) {
      const num = Number(n.v);
      if (Number.isInteger(num) && num > 0) out.instance = num;
      idx = 1;
    }
  }

  const first = segments[idx];
  if (first) {
    const tokens = tokenize(first.text);
    const id = tokens[0];
    if (id && id.t !== 'eq' && tokens[1]?.t !== 'eq') {
      // authserv-id [version] — optionally followed by a resinfo without a separating ";"
      out.authservId = id.v.toLowerCase();
      let rest = tokens.slice(1);
      const ver = rest[0];
      if (ver?.t === 'word' && /^[0-9]+$/.test(ver.v) && rest[1]?.t !== 'eq') {
        out.version = ver.v;
        rest = rest.slice(1);
      }
      const ri = parseResInfo(rest, first.comments);
      if (ri) out.results.push(ri);
      idx++;
    }
  }

  for (const seg of segments.slice(idx)) {
    const tokens = tokenize(seg.text);
    if (tokens.length === 0) continue;
    const only = tokens[0];
    if (tokens.length === 1 && only?.t === 'word' && only.v.toLowerCase() === 'none') {
      out.noResult = true;
      continue;
    }
    const ri = parseResInfo(tokens, seg.comments);
    if (ri) out.results.push(ri);
  }

  out.valid = !malformed && (out.results.length > 0 || (out.noResult && out.authservId !== null));
  return out;
}

export function resultsFor(ar: AuthResults | null | undefined, method: string): ResInfo[] {
  return ar ? ar.results.filter((r) => r.method === method) : [];
}

export function firstResult(
  ar: AuthResults | null | undefined,
  method: string,
): ResInfo | undefined {
  return ar?.results.find((r) => r.method === method);
}
