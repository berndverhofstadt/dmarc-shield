# DMARC Shield — Design

Status: draft for review (decisions Q1–Q9 resolved) · Researched against Microsoft Learn on 2026-10-25.

DMARC Shield is an Outlook add-in that reads the current message's internet
headers, parses `Authentication-Results` (RFC 8601) **in the task pane's own
JavaScript**, and shows one of three verdicts. There is no backend, no
telemetry and no analytics. The only network request the add-in can make is
an **opt-in, off-by-default** DNS-over-HTTPS lookup of the sender's
`_dmarc` TXT record (§4b). It is the only way to learn the DMARC policy when
the mail provider (notably Exchange Online) doesn't record it in the headers.
Header contents and message content never leave the client.

Hosted at `https://berndverhofstadt.github.io/dmarc-shield/`.

---

## 1. Manifest choice: add-in only (XML) manifest

| | Add-in only (XML) | Unified (JSON) |
|---|---|---|
| Outlook on the web (modern) | ✅ | ✅ |
| New Outlook on Windows | ✅ | ✅ |
| Classic Outlook on Windows | ✅ | ✅ (2307+, M365 only) |
| Outlook on Mac | ✅ | ❌ *"Outlook on Mac — No"* |
| Outlook on iOS / Android | ✅ (`MobileFormFactor`) | ❌ *"Office on mobile — No"* |
| Exchange on-premises mailboxes | ✅ | ❌ |
| AppSource / Centralized Deployment | ✅ | ✅ |

Source: *Office Add-ins with the unified app manifest → Client and platform
support* (updated 2026-10-14). Microsoft says that to reach Mac and mobile
*"you must create a second version that uses the add-in only manifest"*.

**Decision:** ship one `manifest.xml` (VersionOverrides 1.0 + 1.1, so we get
`SupportsPinning`). There's no `MobileFormFactor` (see §2). A unified manifest can be added
later once Mac and mobile support it. Keeping two manifests now would double
the validation and submission work for no extra reach.

## 2. Requirement-set support per client

From *Outlook JavaScript API requirement sets* (updated 2026-09-16) and
*Outlook JavaScript APIs supported in Outlook on mobile devices*:

| Client | Highest Mailbox set | Headers (`getAllInternetHeadersAsync`, 1.8) | Info bar (`notificationMessages`, 1.3) | Categories (1.8) | Pinning (1.5) |
|---|---|---|---|---|---|
| Outlook on the web (modern, EXO) | 1.16 | ✅ | ✅ | ✅ | ✅ |
| New Outlook on Windows | 1.16 | ✅ | ✅ | ✅ | ✅ |
| Classic Outlook Win (M365) | 1.16 | ✅ (≥ v1910) | ✅ | ✅ | ✅ |
| Outlook on Mac (new UI) | 1.14 | ✅ | ✅ | ✅ | ✅ |
| Outlook on Mac (classic UI) | 1.8 | ✅ | ✅ | ✅ | ✅ |
| Outlook iOS / Android | 1.5 (+ selected APIs) | ❌ not on the mobile allow-list | ✅ (read mode) | ❌ | n/a (pane is full-screen) |
| OWA against Exchange on-prem (SE/2019/2016) | 1.5–1.6 | ❌ | ✅ | ❌ | — |

**Manifest `MinVersion`: 1.8, no `MobileFormFactor`** (decision Q1). The
add-in only appears on clients that can read headers, so it won't show up on
iOS/Android or on Exchange on-premises. The task pane still checks
`isSetSupported('Mailbox','1.8')` and that `getAllInternetHeadersAsync`
exists. If either is missing, it shows the *"not supported on this client"*
state instead of failing, as a defensive fallback.

**Permission: `ReadItem`** (least privilege). That covers headers,
from/reply-to, notifications and roaming settings. The category feature has
been dropped (decision Q2), so we never need `ReadWriteItem`.

## 3. Architecture

```
src/
  parser/            pure, DOM-free, Office-free — 100% unit-testable
    headers.ts       unfold RFC 5322 header block → ordered [name, value][]
    authres.ts       RFC 8601 tokenizer/parser (comments, quoted strings, ptype.property)
    address.ts       From / Reply-To mailbox + domain extraction
    arc.ts           ARC set grouping (i=), receiver arc verdict, i=1 original results
    lookalike.ts     punycode decode (vendored, ~100 LOC), mixed-script + confusables skeleton
    dmarcrecord.ts   parse "v=DMARC1; p=…" TXT records (pure)
    verdict.ts       evidence (+ optional DNS policy) → {state, reasons[]}
  dns/               RFC 8484 wire-format encoder/decoder (pure) + fetch to a fixed resolver allow-list
  office/            thin adapter: Office.js → plain strings; capability detection
  ui/                vanilla TS + small h() helper (no framework); renders verdict
  i18n/              en, nl, fr, de JSON + t() lookup, picks Office.context.displayLanguage
  taskpane.html      single static page, strict CSP
```

Build: **Vite** with a TypeScript, multi-page static build to `dist/`. Tests:
**Vitest** with v8 coverage, gated at ≥ 90% lines and branches on
`src/parser/**`. Lint: ESLint (typescript-eslint) + Prettier. Office.js types
come from `@types/office-js`. Office.js itself is **never bundled**: Microsoft
requires it to be loaded from their CDN (Store policy 1120.1).

## 4. Trust model and parsing rules

1. Headers come back in message order, so index 0 is the **topmost** header,
   added by the last receiving MTA, i.e. the user's own provider.
2. **Only the topmost `Authentication-Results` header is trusted.** Anyone
   upstream, including the sender, can add these headers. RFC 8601 §5 expects
   the border MTA to strip forged copies that carry its own authserv-id, but
   we can't confirm that it did. Some receivers (Proton) split one result
   over several headers. So A-R headers **directly adjacent** to the topmost
   one, with the same non-empty authserv-id, are merged into the trusted
   block. If `dmarc`, `spf`, `arc` or `compauth` appears twice in that block,
   it counts as forgery (red). A position boundary based on `Received`
   headers is *not* used, because Gmail writes its A-R below its own
   `Received` line.
3. Exchange Online writes its A-R **without an authserv-id**
   (`Authentication-Results: spf=pass (sender IP is …) smtp.mailfrom=…`). The
   parser detects that a first token containing `=` is a method, not an
   authserv-id.
4. **Suspicious** (decision Q4):
   - *Inconsistent* → **Red**. A lower A-R uses the same authserv-id as the
     top one, or contradicts it (for example, a lower header says
     `dmarc=pass` while the top one says `fail`/`none`), or the topmost header
     can't be parsed.
   - *Multiple, consistent* → shown as a notice ("this message passed through
     N authenticating hops"). This is normal for forwarded mail and mailing
     lists, so it doesn't change the verdict.
5. `X-MS-Exchange-Authentication-Results` and `Authentication-Results-Original`
   are **displayed as secondary info only**. ARC is handled under the
   stricter rules in §4a.
6. Extracted: `dmarc` result + `action=` (EXO: `none|quarantine|reject|oreject|pct.*`)
   + policy from comments/properties (Gmail `(p=REJECT sp=… dis=…)`, Yahoo
   `(p=REJECT)`, Fastmail/Cyrus `policy.published-domain-policy=`), `header.from`;
   `spf` + `smtp.mailfrom`; every `dkim` + `header.d`/`header.i`/`header.s`;
   `compauth` + `reason=`.

### 4a. ARC (forwarded / mailing-list mail)

Without DNS and the raw MIME body we can't verify ARC signatures
ourselves. ARC-Message-Signature covers the body, and Office.js doesn't give
us raw MIME. So we **rely on the receiving server's own ARC verdict** and
treat every ARC header as forgeable unless that verdict vouches for it.

1. **Receiver ARC verdict.** We take `arc=pass|fail|none`, in order of
   preference:
   1. from the trusted topmost A-R (Gmail, Fastmail, Yahoo style:
      `arc=pass (i=2 spf=pass …)`), or
   2. from the **highest-instance** `ARC-Authentication-Results` (EXO
      style: `arc=pass (0 oda=1 ltdi=1 spf=[1,1,…] dkim=[1,1,…] dmarc=[1,1,…])`),
      but only if it sits **above the topmost A-R**, which means the receiving
      hop added it. If it sits lower, any upstream party could have added it,
      so we ignore it.
2. **ARC is only consulted when the direct result isn't `pass`**, typically
   `dmarc=fail` caused by a forwarder that broke SPF or DKIM.
3. If the receiver says `arc=pass` and the chain is structurally sound
   (contiguous i=1…N, one AAR/AMS/AS per instance, highest `cv=` not
   `fail`), we read the **i=1 `ARC-Authentication-Results`**, which records
   the first sealer's view of the original message. If that shows
   `dmarc=pass` and its `header.from` matches the visible From domain, the
   effective DMARC result is **pass (via ARC)**.
4. An ARC-derived pass **can reach green** (decision Q7). The UI always labels
   it: *"Verified via ARC — forwarded by ⟨i=1 authserv-id⟩. Your mail server
   trusted this forwarder's record of the original check."*
5. If the receiver says `arc=fail`, the chain has gaps or duplicates, or the
   i=1 `header.from` doesn't match the visible From domain, the message is
   flagged **suspicious → Red**.

### 4b. Policy source and optional DNS (decision Q6)

The effective policy (`p`, or `sp` for subdomains) comes from, in order:

1. **The header**: Gmail `(p=REJECT sp=… dis=…)`, Yahoo/Proton `(p=…)`,
   Fastmail/Cyrus `policy.published-domain-policy=`, the EXO `action=` on
   failures (`oreject` = policy was reject and the receiver overrode it). For
   ARC-derived passes, the policy in the i=1 AAR comment is used.
2. **Opt-in DNS-over-HTTPS** (setting `dnsLookup`, **off by default**). We
   only make this request when the header didn't reveal the policy, and only
   after the user has enabled it:
   - Query: `TXT _dmarc.<From domain>`, sent as an RFC 8484
     `application/dns-message` GET. If no DMARC1 record is found, we do a
     DMARCbis-style **tree walk** up to the organisational domain (at most 8
     queries, never the TLD). This avoids bundling the Public Suffix List.
     The `sp=` value applies when the record was found on an ancestor.
   - Resolvers form a **fixed allow-list**, because CSP can only allow
     origins known at build time. The options are Quad9 `dns.quad9.net`
     (default), Cloudflare `cloudflare-dns.com` and Google `dns.google`. All
     three were checked on 2026-10-25 and return RFC 8484 responses with
     `Access-Control-Allow-Origin: *`.
   - What leaves the client: the sender's domain name, and (inevitably) the
     user's IP address, sent to the chosen resolver. Nothing else is sent:
     no headers, addresses, subjects or identifiers.
   - Results are cached **in memory only** for the life of the task pane.
     Nothing is persisted.
   - The resolver is trusted. We don't validate DNSSEC ourselves, and the UI
     says *"policy from DNS (via Quad9)"*.
3. **Unknown**: the header doesn't show the policy and DNS is off or failed.
   The verdict can't be green. The UI explains why and offers a link to
   enable the lookup in settings.

Honesty rule: the UI states the policy *and where it came from* (header /
DNS / ARC). It never claims a policy it hasn't seen.

### 4c. BIMI (opt-in)

Researched 2026-10-25 against draft-brand-indicators-for-message-identification-14
and BIMI Group's provider list ("Does not support BIMI: Microsoft").

- **Separate indicator.** BIMI is a separate indicator below the verdict. It
  doesn't change the DMARC verdict.
  - **Green:** a VMC or CMC (mark type *Registered/Government Mark* = VMC,
    *Prior Use/Modified Registered* = CMC) validated.
  - **Blue:** a published logo without a certificate, or the certificate
    couldn't be downloaded.
  - **Grey:** no BIMI, declined, not eligible, not checked, or the certificate
    was rejected (grey + warning).
- **Eligibility (§7.1):** effective DMARC pass, and policy `reject`, or
  `quarantine` at pct=100, with no testing mode. If the policy is unknown (EXO),
  the BIMI check first does the DMARC DNS lookup.
- **Receiver first:** `bimi=` + `policy.authority` from the trusted A-R block.
  `BIMI-Indicator` is used only when that says `bimi=pass`, because receivers
  that don't do BIMI pass forged ones through.
- **Client check** (Microsoft mailboxes; setting `bimiLookup`, off by default,
  or the one-off button):
  1. DoH `default._bimi.<from>`, then `<org domain>`.
  2. GET `a=` (≤ 256 KB) and validate.
  3. Only if there's no usable certificate, GET `l=` (≤ 64 KB).
  - Requests use `credentials: omit` and `no-referrer`, and results are cached
    in memory.
- **Validation** (`src/bimi/vmc.ts`):
  - parse DER (bounds-checked);
  - leaf with EKU `1.3.6.1.5.5.7.3.31`;
  - chain by exact issuer/subject DER up to a **bundled** root (DigiCert,
    SSL.com, GlobalSign; Sectigo issues under the SSL.com root);
  - WebCrypto RSA PKCS#1 / ECDSA signatures;
  - CA flag on intermediates, validity, SAN contains the From or
    organisational domain;
  - logo from the RFC 3709 logotype `data:` URI (gzip).
  - Not checked: OCSP/CRL, CT SCTs, `l=` vs logotype hash (the certificate's
    logo is shown instead).
- **CORS reality** (tested in Edge): PayPal, LinkedIn, Dropbox and Booking
  hosts allow it; `vmc.digicert.com`, Apple and Valimail don't → blue,
  "couldn't be checked". A proxy would fix this but violates "no backend".
- **CSP:** `connect-src https:` (hosts are arbitrary). `img-src 'self' data:`
  stays. Logos are only rendered as `<img>` data URLs.

## 5. Verdicts (decisions Q5–Q8)

Three outcomes. "DMARC pass" means standard DMARC semantics: SPF **or**
DKIM passes **and** is aligned with the From domain (decision Q8). We report
the effective result, either direct or via ARC (§4a).

| State | Icon | Condition |
|---|---|---|
| **Verified** | green shield + ✓ | effective DMARC pass **and** policy = `reject`, fully enforced (no `pct<100`, no `t=y`); **or** internal message (`AuthAs: Internal`) |
| **Authenticated** | blue shield + ✓ | effective DMARC pass **and** policy is `quarantine`, `none`, partially enforced, or unknown |
| **Not protected** | red shield + ✕ | no DMARC policy (`dmarc=none`/no record), `dmarc=fail` (not rescued by ARC), `temperror`/`permerror`, no Authentication-Results at all, **or** any forgery warning (inconsistent A-R, broken/failed ARC, header.from ≠ visible From, lookalike/homoglyph From domain) |

Forgery warnings always win. A message that passes DMARC but has a lookalike
From domain is red.

**Internal mail is green Verified.** When the topmost
`X-MS-Exchange-Organization-AuthAs` header says `Internal`, Exchange itself
authenticated the sender as a member of your organisation. EXO removes
`X-MS-Exchange-Organization-*` headers from inbound external mail, so
outsiders can't forge this. The pane labels it *"Internal message —
authenticated by your organisation"*. Forgery warnings such as a lookalike
From domain still turn it red.

There is one non-verdict state, shown as a **grey** shield: *Not supported
on this client*. That covers a missing header API or no item.

Notices that don't change the state: the Reply-To domain differs from From,
`compauth=fail/softfail`, a DKIM signature from a non-aligned domain,
multiple consistent A-R hops, and `p=none` published ("monitors but doesn't
enforce").

**Lookalike detection** runs offline:
- Decodes `xn--` labels with a vendored RFC 3492 implementation.
- Flags mixed-script labels using Unicode script properties (`\p{Script=…}`).
- Maps confusables to a skeleton using a compact table derived from Unicode
  TR39 `confusables.txt`, then compares it with the Reply-To,
  `header.from` and DKIM `d=` domains.
- There's no list of known brands, because that would need external data.
  Documented as a limitation.

## 6. Platform behaviour and limitations (documented in README)

- **Nothing runs until the user opens the task pane.** Read-mode
  event-based activation (`OnMessageReadWithCustomHeader`) is preview-only
  and classic-Windows-only, so there is no "on open" hook in web, new
  Outlook or Mac. With **`SupportsPinning`**, a pinned pane re-evaluates on
  every `ItemChanged`. The info bar therefore appears only on messages viewed
  while the pane is open or pinned.
- **Automatic checks (roadmap):** `OnMessageReadWithCustomHeader` (preview,
  classic Windows only, as of 2026-10) could start the add-in in the background
  when a message carries `Authentication-Results` and set the info bar without
  user action. Adopt it once it reaches a numbered requirement set and the
  web/new Outlook/Mac clients. Until then, the pane shows a pinning tip (pinning
  isn't available for Outlook.com).
- **Mobile:** not offered. Outlook iOS/Android stop at Mailbox 1.5 and can't
  read internet headers. README explains this, and DESIGN tracks it so it can
  be revisited if Microsoft adds `getAllInternetHeadersAsync` to the mobile
  allow-list.
- **Notifications:** one `InformationalMessage` per item (key
  `dmarc-shield`, replaced on re-evaluation, not persistent), using the
  verdict text and a 16/32/80 px icon.
- **CSP** (meta tag, because GitHub Pages can't set headers. Azure SWA also
  gets the same policy as a real header via `staticwebapp.config.json`):
  ```
  default-src 'none';
  script-src 'self' https://appsforoffice.microsoft.com;
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src https://dns.quad9.net https://cloudflare-dns.com https://dns.google;
  frame-src 'none';
  form-action 'none';
  base-uri 'none';
  ```
  Office.js is the one allowed external origin (Microsoft, required by Store
  policy). It talks to its host over `postMessage`, which CSP doesn't
  govern. If Office.js turns out to need more CDN origins at runtime (for
  example, locale bundles), I'll add them only after watching real network
  traffic, and list each one in PRIVACY.md. `connect-src` allows only the
  three DoH resolvers. The code calls them only when `dnsLookup` is on, so
  with the setting off no request goes out.
- **Fixtures:** modelled on documented header formats from Exchange Online,
  Gmail, Fastmail, Proton and Yahoo, with addresses and IPs replaced by
  RFC 2606/5737 values. They're representative, not captured traffic.
  CONTRIBUTING explains how to submit redacted real headers.
- **DNS off (default)** means the add-in never fetches the sender's DMARC
  record. EXO mail that passes DMARC then shows **blue**, because EXO doesn't
  write `p=` into its headers. The pane says so and suggests enabling the
  lookup.

## 7. Settings

Stored in `Office.context.roamingSettings` under one key, `ds.settings`
(decision Q3). The data lives in the user's own Exchange mailbox and roams
between their Outlook clients. It is never sent to the add-in's host or to
anyone else. PRIVACY.md says this in exactly these terms.

- `showInfoBar: boolean` (default **on**): add the info-bar notification.
- `dnsLookup: boolean` (default **off**): allow the DoH policy lookup (§4b)
- `resolver: "quad9" | "cloudflare" | "google"` (default `quad9`)
- `language: "auto" | "en" | "nl" | "fr" | "de"` (default `auto` =
  `Office.context.displayLanguage`)

## 8. Distribution

1. GitHub release containing `manifest.xml`, to sideload via
   *aka.ms/olksideload*.
2. M365 admin center → Integrated apps → Upload custom apps → *Office
   Add-in* (centralized deployment).
3. AppSource via Partner Center: checklist against policies 100.x, 1100.x,
   1120.1/1120.2/1120.3/1120.4. Assets: 300×300 store logo, 1280×720 PNG
   screenshots, manifest icons 16/32/64/80/128.

## 9. Decisions log

- **Q1 Mobile:** excluded. `MinVersion=1.8`, no `MobileFormFactor`. This
  lowers AppSource risk under 1120.3.
- **Q2 Categories:** dropped. We stay at `ReadItem`.
- **Q3 Settings:** `roamingSettings`, documented as "stored in your own
  mailbox".
- **Q4 Multiple A-R:** consistent → notice; inconsistent → Red.
- **Q5 Verdicts:** three outcomes (green Verified / blue Authenticated /
  red Not protected). Internal mail = green. Grey only for *Not supported*.
- **Q6 DNS:** opt-in DoH, off by default, fixed resolver allow-list.
- **Q7 ARC:** an ARC-derived pass can reach green, always labelled with the
  forwarder.
- **Q8 Green rule:** standard DMARC pass (SPF or DKIM aligned) + p=reject.
- **Q9 Resolver default:** Quad9.
- **Q10 BIMI:** opt-in client-side check (no proxy); VMC and CMC both green;
  blue shows the `l=` logo.
- **Hosting:** `https://berndverhofstadt.github.io/dmarc-shield/`. The build
  can override this with `ADDIN_BASE_URL`, for example for Azure SWA.
