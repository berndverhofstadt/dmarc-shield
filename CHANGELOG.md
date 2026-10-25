# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-10-25

### Added

- Custom DNS-over-HTTPS resolver URL in settings, for networks that block the
  public resolvers.
- Organisation resolver for admins: `npm run manifest:org -- --org-doh=<url>`
  builds a manifest whose task pane only uses that resolver (public resolvers
  and retry buttons are hidden).

## [1.1.1] - 2026-10-25

### Fixed

- A blocked or unreachable DNS-over-HTTPS resolver now shows which resolver
  couldn't be reached and why (firewall, DNS filter, extension), instead of
  "Failed to fetch", with one-click retries via the other resolvers.

## [1.1.0] - 2026-10-25

### Added

- Brand logo check (BIMI), opt-in and off by default. Uses the receiving
  server's result when present; otherwise looks up the BIMI record over DoH,
  downloads the mark certificate/logo and validates VMC/CMC chains in the
  add-in against bundled DigiCert, SSL.com and GlobalSign roots. Green for a
  verified certificate, blue for a logo without one, grey for no BIMI.

### Changed

- Content Security Policy `connect-src` is now `https:`, because BIMI hosts are
  arbitrary. Network code remains confined to two opt-in modules.
- DNS name validation accepts service labels such as `_bimi` in any position.
- The BIMI section is shown below the details.

### Fixed

- The pane now updates when another message is selected even if it isn't
  pinned (Outlook only sends ItemChanged to pinned panes, and Outlook.com can't
  pin). A Refresh link reloads the pane as a last resort.

## [1.0.0] - 2026-10-25

### Added

- Outlook add-in (add-in only manifest, Mailbox 1.8, `ReadItem`) for Outlook on
  the web, new and classic Outlook for Windows, and Outlook for Mac.
- RFC 8601 `Authentication-Results` parser with Exchange Online, Gmail,
  Fastmail, Proton and Yahoo formats. Trusts only the topmost result block and
  flags duplicate or contradicting headers.
- ARC support via the receiver's own verdict (`arc=`, Exchange compauth 130,
  receiver ARC-Authentication-Results).
- Verdicts: Verified, Authenticated, Not protected; plus Not supported.
- Lookalike detection: punycode, mixed scripts, confusables, own-domain and
  Reply-To lookalikes, display-name addresses.
- Opt-in DNS-over-HTTPS policy lookup (Quad9 / Cloudflare / Google).
- Info bar notification, pinnable task pane, roaming settings.
- English, Dutch, French and German.
- Website with privacy policy, terms and support pages; Marketplace listing
  assets.
