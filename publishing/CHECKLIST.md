# Microsoft Marketplace (AppSource) submission checklist

Checked against the [Commercial marketplace certification policies](https://learn.microsoft.com/legal/marketplace/certification-policies)
(sections 100, 1100, 1120) and the Office Add-ins validation guidance, as of
2026-10-25. Re-read the policies before each submission; they change.

Legend: ✅ done in this repo · ☐ manual step in Partner Center · ⚠ needs your decision/attention

## Account and offer

- ☐ Partner Center account enrolled in the *Microsoft 365 and Copilot* program
  (individual or company). Publisher display name: Bernd Verhofstadt.
- ☐ New offer → *Office add-in*. Upload `dist/manifest.xml` from the release tag.
- ☐ Availability: all markets (or restrict), free.
- ✅ No in-app purchases, trials or up-sell (1100.1, 1120.2).

## Manifest and hosting (1120.1, 1100.5)

- ✅ Add-in only manifest, latest released schema (VersionOverrides 1.0 + 1.1).
- ✅ Passes `office-addin-manifest validate` (also in CI).
- ✅ Loads Office.js from `https://appsforoffice.microsoft.com/lib/1/hosted/office.js`.
- ✅ All URLs HTTPS with a trusted certificate (GitHub Pages).
- ✅ `SupportUrl` set to a working page.
- ✅ `IconUrl` 64 px and `HighResolutionIconUrl` 128 px PNG; ribbon icons 16/32/80.
- ✅ Version ≥ 1.0 and incremented for every update (`package.json` → manifest).
- ✅ Minimal permission: `ReadItem` (1100.5 "no unreasonably high permissions").
- ✅ Localised `Description` and button strings (nl-NL, fr-FR, de-DE) (1100.7).

## Outlook-specific (1120.4)

- ✅ Works in modern Outlook on the web (required).
- ✅ No `CustomPane` extension point; no `ItemSend` event.
- ✅ Add-in commands (ribbon button) on Message Read.
- ✅ Pinnable task pane content changes per selected message (`ItemChanged`).
- ✅ Not offered on mobile (no `MobileFormFactor`), so the mobile rules (1120.2)
  and the extra mobile design review don't apply.

## Functionality and quality (1120.3, 100.12)

- ✅ Fully functional in the Office browsers (Edge, Chrome, Firefox, Safari):
  standard DOM/ES2022 only. ☐ Manually smoke-test Firefox and Safari (Mac) before
  submitting.
- ✅ Works across all platforms implied by the manifest's requirement sets (web,
  Windows, Mac). ☐ Verify on each (see RELEASING.md test matrix).
- ✅ Touch-only usable: native buttons, `<details>`, checkboxes; 44 px targets
  on panel headers.
- ✅ Loading state while headers are read; clear states for unsupported
  clients, no selection and errors (100.12 "no unfinished UI").
- ✅ No external navigation without user action; footer links open in a new
  window (1100.4).
- ✅ First-run experience: the pane shows a result immediately; *What does this
  mean?* explains it (1100.1 "seamless FRE").

## Listing (100.1–100.3, 100.5, 100.6)

- ✅ Name, summary (≤ 100 chars) and description: `publishing/LISTING.md`.
  The description states supported products, requirements and **limitations**
  (no mobile, no on-prem, runs when opened/pinned) (100.1.3).
- ✅ Keywords relevant, no competitor names (100.2.2).
- ✅ Logo 300×300 PNG: `brand/store/logo-300.png` (216–350 px required).
- ✅ Screenshots 1280×720 PNG: `public/assets/screenshots/*.png`.
- ✅ Privacy policy URL, terms of use URL, support URL (100.5, 100.6).
- ⚠ Terms of use: generic MIT-based terms without a governing-law clause. Have
  them reviewed if you want jurisdiction-specific terms.
- ✅ Privacy policy discloses the only transmission (opt-in DNS lookup), the
  resolver choice, roaming settings, Office.js and hosting (1100.5).

## Certification

- ✅ Test notes: `publishing/TEST_NOTES.md`. Paste them into *Notes for
  certification*. No credentials needed (100.14, 100.15).
- ☐ Cryptography/export disclosure: "No" own cryptography (see LISTING.md).
- ☐ Submit. Expect questions about the DNS lookup. Point reviewers to the
  privacy policy and the off-by-default setting.

## After publishing

- ☐ Note the Marketplace asset ID (`WA…`) in RELEASING.md.
- ☐ Updates to *web content* (task pane code) go live when Pages deploys.
  Functional changes visible to users still require following the policies.
  **Manifest changes require a new submission.**
