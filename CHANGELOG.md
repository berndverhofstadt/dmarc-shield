# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - unreleased

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
