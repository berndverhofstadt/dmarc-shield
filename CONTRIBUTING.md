# Contributing to DMARC Shield

Thanks for helping! Bug reports, header fixtures, translations and code are all
welcome.

## Ground rules

DMARC Shield's promise is that **message data never leaves the client**. Every
change must keep that true:

- No backend, analytics, telemetry, error reporting, CDN fonts or third-party
  scripts. Office.js from Microsoft's CDN is the only external script.
- Network access lives only in `src/dns/`, runs only after the user opts in,
  and sends only `_dmarc.<domain>` names. ESLint blocks `fetch`, `XMLHttpRequest`,
  `WebSocket`, `EventSource` and `sendBeacon` elsewhere in `src/`.
- Never put header content into the DOM as HTML. Use `textContent` (the `h()`
  helper in `src/ui/dom.ts` does this). No `innerHTML`.
- If you touch the CSP (`src/*.html`, `public/staticwebapp.config.json`), update
  SECURITY.md and PRIVACY.md in the same PR.
- Be honest in the UI: never claim a policy or a result the headers (or the
  user-requested DNS lookup) don't show.

## Setup

```sh
npm install        # .npmrc sets legacy-peer-deps (works around an npm 10 resolver bug)
npm run dev        # https://localhost:3000 + manifest.dev.xml
npm test
```

See the README for sideloading and the `?demo=` mode.

## Before you open a PR

```sh
npm run lint
npm run typecheck
npm run test:coverage   # parser + DNS must stay ≥ 90% (lines/branches/functions)
npm run build && npm run validate
```

CI runs the same steps.

## Adding a header fixture

Real-world headers that produce a wrong or surprising verdict are the most
valuable contribution.

1. Copy only the header block (no body) into `test/fixtures/<provider>-<case>.txt`.
2. **Redact:** replace personal addresses, names and domains with RFC 2606 names
   (`example.com`, `example.net`, `example.org`, `*.example`), IP addresses with
   RFC 5737 ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), and
   drop `Message-ID`, tracking headers and signature `b=` values. Keep the
   *structure* (order, folding, authserv-ids, comments) exactly as received,
   because that is what the parser is tested on.
3. Add a row to `CASES` in `test/fixtures.test.ts` with the expected state,
   reason and findings.

Don't paste unredacted headers into public issues.

## Translations

Strings live in `src/i18n/<locale>.ts`. `en.ts` is the source; other locales are
typed against it, and `test/i18n.test.ts` checks that every key exists with the
same `{placeholders}` and that info-bar texts fit Outlook's 150-character limit.
To add a locale, create the file, register it in `src/i18n/index.ts`, and add
manifest overrides in `manifest/manifest.template.xml`.

## Code style

- TypeScript strict, no framework, small pure modules. Keep Office.js behind
  `src/office/` so the logic stays testable without Office.
- Prettier formats, ESLint lints. Match the surrounding comment density: explain
  *why*, especially for security decisions.
- Commits: imperative subject line (≤ 72 chars), body explaining the reason.

## Releases

Maintainers: see [RELEASING.md](RELEASING.md).

By contributing you agree your contributions are licensed under the [MIT licence](LICENSE).
