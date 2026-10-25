/**
 * RFC 5322 header block parsing.
 *
 * `getAllInternetHeadersAsync` returns the raw header block in message order,
 * so index 0 is the topmost header — the one added by the last receiving hop.
 */

export interface Header {
  /** Header field name as written. */
  name: string;
  /** Lower-cased name, for lookups. */
  lname: string;
  /** Unfolded, trimmed value. */
  value: string;
  /** Position in the header block (0 = topmost). */
  index: number;
}

// ftext = %d33-57 / %d59-126 (printable ASCII except ":")
const FIELD_LINE = /^([!-9;-~]+)[ \t]*:(.*)$/;

export function parseHeaders(raw: string): Header[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const out: Header[] = [];
  let name: string | null = null;
  let parts: string[] = [];

  const flush = () => {
    if (name !== null) {
      out.push({
        name,
        lname: name.toLowerCase(),
        value: parts
          .join('')
          .replace(/[ \t]+/g, ' ')
          .trim(),
        index: out.length,
      });
    }
    name = null;
    parts = [];
  };

  for (const line of lines) {
    if (line.trim() === '') {
      // A blank line ends the header block; leading blank lines are tolerated.
      if (out.length > 0 || name !== null) break;
      continue;
    }
    if (/^[ \t]/.test(line)) {
      // Continuation line (folding). Orphans before the first field are ignored.
      if (name !== null) parts.push(line);
      continue;
    }
    flush();
    const m = FIELD_LINE.exec(line);
    if (m) {
      name = m[1] as string;
      parts = [m[2] as string];
    }
  }
  flush();
  return out;
}

export function findHeaders(headers: readonly Header[], name: string): Header[] {
  const lname = name.toLowerCase();
  return headers.filter((h) => h.lname === lname);
}

export function firstHeader(headers: readonly Header[], name: string): Header | undefined {
  const lname = name.toLowerCase();
  return headers.find((h) => h.lname === lname);
}
