# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately** via
[GitHub security advisories](https://github.com/berndverhofstadt/dmarc-shield/security/advisories/new),
not in public issues. Include the Outlook client and version, steps to
reproduce, and (redacted) headers if relevant. You'll get an acknowledgement
within 7 days. Please allow a reasonable time to fix before disclosure.

In scope: anything that makes DMARC Shield show a **more trusted verdict than
the evidence supports** (e.g. a forged header producing *Verified*), any way
message data could leave the client, XSS or script injection via message
content, and CSP bypasses.

Only the latest release, as served from
`https://berndverhofstadt.github.io/dmarc-shield/`, is supported.

## Threat model and mitigations

| Threat | Mitigation |
| --- | --- |
| Sender inserts a fake `Authentication-Results: <your provider>; dmarc=pass` | Only the topmost A-R is trusted (plus directly adjacent headers with the same authserv-id, for receivers that split results). A repeated `dmarc`/`spf`/`arc`/`compauth` inside that block, a lower header with the same authserv-id, or a lower header claiming `pass` when the trusted one doesn't → **Not protected**. |
| Forged ARC headers claiming a pass | ARC is only used when the *receiver* vouches for it: `arc=` in the trusted A-R, Exchange `compauth` reason 130, or a receiver ARC-Authentication-Results above the trusted A-R. The chain must be structurally complete, and the i=1 `header.from` must match the visible From. |
| Fake "internal" mail | `X-MS-Exchange-Organization-AuthAs: Internal` is only honoured if it appears exactly once and the trusted A-R comes from Microsoft (or is absent). Exchange Online strips `X-MS-Exchange-Organization-*` from inbound external mail. |
| Lookalike / homoglyph domains | Punycode decoding, mixed-script and whole-script-confusable detection, confusable skeleton comparison with the user's own domain, Reply-To and `header.from`. |
| Display-name tricks (`"ceo@corp" <x@evil>`) | The address is always taken from the angle-addr; embedded addresses in the display name are flagged. |
| XSS through header content | All dynamic text is written with `textContent`; no `innerHTML`, no `eval`. |
| Data exfiltration / supply chain | No runtime npm dependencies (everything is bundled source from this repo). Strict CSP (below). ESLint forbids network APIs outside `src/dns/`. |
| Forged BIMI logo header | `BIMI-Indicator` is only used when the trusted A-R contains `bimi=pass`. Receivers without BIMI support, such as Exchange Online, don't strip sender-supplied BIMI headers. |
| Fake or stolen-name mark certificate | The chain must verify (WebCrypto signatures) up to one of three bundled roots (DigiCert Verified Mark Root CA, SSL.com VMC RSA Root CA 2024, GlobalSign Verified Mark Root R42; fingerprints in `src/bimi/roots.ts`). Roots inside the downloaded PEM are never trusted. Also checked: the BIMI EKU, CA flags, validity dates, the SAN domain. Not checked: revocation (OCSP/CRL) and CT SCTs. |
| Logo shown on spoofed mail | BIMI is only evaluated when DMARC passed under `p=reject` or `p=quarantine` with pct=100 (draft-brand-indicators §7.1). |
| Malicious SVG logo | Logos are rendered only as `<img src="data:image/svg+xml;base64,…">`. SVG in an image context runs no scripts and loads no external resources. Downloads are capped (certificate 256 KB, logo 64 KB) and time out. |
| Malicious DNS answers | DoH responses are parsed defensively (bounds-checked, compression-loop-safe). Only the policy fields are used, so a spoofed record can at most change the colour between green and blue, never hide a forgery finding. The resolver is trusted; DNSSEC isn't validated client-side. |

### Trust assumption

DMARC Shield relies on your mail provider stripping or overriding forged
`Authentication-Results` headers that carry its own authserv-id (RFC 8601 §5)
and adding its own header at the top. Major providers do this. If your provider
doesn't add an A-R header at all, the result is **Not protected**.

## Content Security Policy

Task pane (`src/taskpane.html`, also sent as an HTTP header by
`public/staticwebapp.config.json` on Azure Static Web Apps):

```
default-src 'none';
script-src 'self' https://appsforoffice.microsoft.com;
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src https:;
frame-src 'none'; worker-src 'none'; manifest-src 'none'; media-src 'none';
object-src 'none'; form-action 'none'; base-uri 'none'; upgrade-insecure-requests
```

- `script-src` allows Office.js, which Microsoft requires to be loaded from its
  CDN (Marketplace policy 1120.1). Office.js loads its own helper scripts from
  the same origin.
- `connect-src https:` is needed because the opt-in BIMI check downloads
  logos and certificates from whatever HTTPS address the sender's BIMI record
  names. Network code lives only in `src/dns/` (DoH to the three fixed resolvers)
  and `src/bimi/lookup.ts`. ESLint forbids `fetch` elsewhere, and both only run
  after the user opts in. `img-src` stays `'self' data:`, so the pane never
  loads remote images.
- The website pages (`index`, `privacy`, `terms`, `support`) run no script at
  all: `default-src 'none'; style-src 'self'; img-src 'self'`.

GitHub Pages can't set response headers, so there the CSP is delivered as a
`<meta>` tag (which can't express `frame-ancestors`; Outlook must be able to
frame the task pane anyway).

## Dependencies

There are no runtime dependencies. Dev tooling only: `npm audit` reports
`node-forge` advisories through Microsoft's `office-addin-dev-certs` (used to
create the localhost development certificate). That code never runs in the
add-in or in CI builds of `dist/`.
