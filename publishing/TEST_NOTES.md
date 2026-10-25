# Notes for certification (paste into Partner Center)

DMARC Shield is a read-mode Outlook add-in. It needs no account, sign-in,
licence or test credentials.

How to test:
1. Install the add-in in Outlook on the web, new Outlook for Windows, classic
   Outlook for Windows or Outlook for Mac.
2. Open any received email and select "Check sender" (Apps → DMARC Shield).
3. The pane shows one of three results with an explanation:
   - Verified (green): DMARC passed and the sender's domain publishes p=reject
     (e.g. mail from google.com or microsoft.com addresses), or internal mail from your own tenant.
   - Authenticated (blue): DMARC passed but the policy is quarantine/none or not
     visible. Exchange Online does not record the policy, so most external mail
     received by a Microsoft 365 mailbox shows blue. Click "Look up policy" to fetch
     it via DNS-over-HTTPS. This is optional and off by default; it sends only the
     domain name. The result then turns green for p=reject domains. Note that
     personal gmail.com and outlook.com addresses are correctly blue: those
     domains publish p=none.
   - Not protected (red): no DMARC policy, DMARC fail, or signs of forgery (e.g.
     a test message sent from an external server with a spoofed From address).
4. The information bar above the message shows the same result. It can be turned
   off under Settings.
5. Pin the pane and select other messages: the result updates for each message.
6. Without Outlook, sample results can be viewed in a browser:
   https://berndverhofstadt.github.io/dmarc-shield/taskpane.html?demo=verified
   (also demo=authenticated, arc, unprotected, lookalike, internal).

Notes:
- Not offered on Outlook for iOS/Android on purpose: mobile clients do not provide
  getAllInternetHeadersAsync (Mailbox 1.8), so the manifest has no MobileFormFactor.
- Permission is ReadItem. The add-in does not modify messages or the mailbox.
- The only network requests besides Office.js are the optional DNS-over-HTTPS
  lookups to dns.quad9.net (default), cloudflare-dns.com or dns.google, enforced
  by a Content Security Policy. Source code: https://github.com/berndverhofstadt/dmarc-shield
