# Privacy

**DMARC Shield does not collect, store, sell or transmit any personal data or
email content. There is no DMARC Shield server, account, analytics or
telemetry.**

The hosted version of this statement is at
<https://berndverhofstadt.github.io/dmarc-shield/privacy.html>.

## What happens to your email

When you open DMARC Shield on a message, Outlook gives the add-in that
message's internet headers and sender address. The add-in analyses them in its
own code, inside Outlook on your device. Nothing is sent to the publisher or
any third party, and nothing is stored. The result is discarded when you switch
messages or close the pane.

The add-in requests Outlook's **read item** permission, the lowest level that
can read headers. It can't read other messages, send mail or change your
mailbox.

## The one optional network request: DNS lookup (off by default)

If your mail provider didn't record the sender's DMARC policy (common with
Microsoft 365), you can click **Look up policy** or enable automatic lookups in
settings. The add-in then asks a DNS-over-HTTPS resolver for the sender's DMARC
record:

- **Sent:** only DNS names such as `_dmarc.example.com` (the sender's domain and,
  if needed, its parent domains). No content, addresses, subjects or identifiers.
- **To:** the resolver you choose: Quad9 (default), Cloudflare or Google. The
  resolver necessarily sees your IP address. See their policies:
  [Quad9](https://quad9.net/privacy/policy/),
  [Cloudflare](https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/),
  [Google](https://developers.google.com/speed/public-dns/privacy).
- **Kept:** in memory only, while the pane is open.

## Settings

Your settings are stored in Outlook **roaming settings**, i.e. in your own
mailbox at Microsoft, so they follow you across Outlook apps. The publisher has
no access to them.

## Microsoft and hosting

- Outlook add-ins load Microsoft's `office.js` from Microsoft's CDN and run
  inside Outlook ([Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement)).
- The add-in's static files are hosted on GitHub Pages; GitHub processes your IP
  address to serve them
  ([GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)).
  The publisher has no access to those logs and adds no analytics.

## Enforcement

A strict Content Security Policy restricts the add-in to its own code,
Office.js, and the three DNS resolvers above. See [SECURITY.md](SECURITY.md).
The source is public, so anyone can verify this.

## Contact

Questions: <https://github.com/berndverhofstadt/dmarc-shield/issues>
