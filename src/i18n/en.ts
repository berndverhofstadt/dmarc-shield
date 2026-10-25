/** English source strings. Placeholders use {name}; every locale must use the same ones. */
export const en = {
  'app.title': 'DMARC Shield',
  'app.demo': 'Demo with sample headers. No mail is being read.',

  'state.verified': 'Verified',
  'state.authenticated': 'Authenticated',
  'state.unprotected': 'Not protected',
  'state.unsupported': 'Not supported',
  'state.loading': 'Checking…',
  'state.noitem': 'No message selected',
  'state.error': 'Could not check',

  'reason.internal': 'Internal message, authenticated by your organisation.',
  'reason.policy-reject':
    'The sender passed DMARC and {domain} tells mail servers to reject anyone who fakes it.',
  'reason.policy-partial':
    'The sender passed DMARC, but {domain} only partly enforces its reject policy (testing mode or a percentage).',
  'reason.policy-quarantine':
    'The sender passed DMARC. {domain} asks mail servers to send fakes to spam rather than reject them.',
  'reason.policy-none':
    "The sender passed DMARC, but {domain} only monitors (p=none) and doesn't block fakes.",
  'reason.policy-unknown':
    "The sender passed DMARC. Your mail provider didn't record {domain}'s policy, so it's unknown whether fakes would be rejected.",
  'reason.forgery': 'Signs of forgery were found. Treat this message with suspicion.',
  'reason.no-auth-results':
    "Your mail server didn't record any authentication result for this message.",
  'reason.dmarc-missing': 'No DMARC result was recorded for this message.',
  'reason.dmarc-none':
    "The sender's domain doesn't publish a DMARC policy, so anyone could send mail in its name.",
  'reason.dmarc-fail': "This message failed DMARC: it can't be proven to come from {domain}.",
  'reason.dmarc-error': 'DMARC could not be evaluated because of a temporary or permanent error.',
  'reason.dmarc-other': 'DMARC returned an unexpected result: {result}.',
  'reason.unsupported':
    "This version of Outlook doesn't let add-ins read message headers, so the sender can't be checked here.",
  'reason.noitem': 'Select a message to check its sender.',
  'reason.error': 'Outlook returned an error: {message}',
  'reason.outside': 'Open DMARC Shield from a message in Outlook to check its sender.',

  'via.arc':
    'Verified via ARC: forwarded by {sealer}. Your mail server trusted this forwarder’s record of the original check.',
  'via.arc.unknown': 'an unnamed forwarder',

  'policy.reject': 'reject',
  'policy.quarantine': 'quarantine',
  'policy.none': 'none (monitor only)',
  'policy.partial': '{policy}, partly enforced',
  'policy.source.header': 'from the message headers',
  'policy.source.arc': 'recorded by the forwarder',
  'policy.source.dns': 'from DNS via {resolver}',
  'policy.unknown': 'not visible in the headers',

  'dns.offer':
    'DMARC Shield can look up the DMARC record of {domain}. This sends only the domain name to {resolver}; nothing about the message.',
  'dns.button': 'Look up policy',
  'dns.always': 'Always look up automatically',
  'dns.checking': 'Looking up the DMARC record of {domain}…',
  'dns.failed': 'The DNS lookup failed: {message}',
  'dns.failed.network':
    "Couldn't reach {resolver} ({host}). A firewall, a DNS filter (such as Pi-hole or NextDNS), antivirus or a browser extension may be blocking DNS-over-HTTPS.",
  'dns.failed.timeout': "{resolver} didn't answer in time.",
  'dns.tryOther': 'Try {resolver}',
  'dns.norecord': 'No DMARC record was found for {domain}.',

  'findings.heading': 'Warnings and notes',
  'finding.ar-unparseable': "The authentication header added by your mail server couldn't be read.",
  'finding.ar-duplicate-authserv':
    'The message contains conflicting authentication results that claim to come from your mail server.',
  'finding.ar-contradiction':
    "An earlier header claims this message passed DMARC, but your mail server says it didn't. That header may be forged.",
  'finding.arc-broken': 'The forwarding (ARC) chain is incomplete or out of order.',
  'finding.arc-from-mismatch':
    'The forwarder recorded a different sender ({headerFrom}) than the one shown ({from}).',
  'finding.header-from-mismatch':
    'The authenticated domain {headerFrom} is not the sender domain shown ({from}).',
  'finding.multiple-from': 'The message has more than one sender address.',
  'finding.from-mixed-script':
    'The sender domain {domain} mixes alphabets (for example Latin and Cyrillic), a common lookalike trick.',
  'finding.from-confusable':
    'The sender domain {domain} uses characters that imitate ordinary letters.',
  'finding.from-lookalike': 'The sender domain {domain} looks like your own domain {other}.',
  'finding.replyto-lookalike': 'Replies go to {replyTo}, which imitates the sender domain {from}.',
  'finding.multiple-hops':
    'This message passed {count} servers that checked authentication. That is normal for forwarded mail.',
  'finding.arc-failed': "Your mail server couldn't verify the forwarding (ARC) chain.",
  'finding.replyto-differs': 'Replies go to a different domain: {replyTo}.',
  'finding.display-name-address':
    'The sender name shows {shown}, but the real address is {actual}.',
  'finding.compauth-fail': 'Microsoft composite authentication: {result} (reason {reason}).',
  'finding.dkim-unaligned': 'The signature is from {domain}, not from the sender domain.',
  'finding.idn-from': 'The sender domain uses international characters: {domain} ({ascii}).',

  'details.heading': 'Details',
  'details.sender': 'Sender',
  'details.dmarc': 'DMARC',
  'details.spf': 'SPF',
  'details.dkim': 'DKIM',
  'details.arc': 'ARC',
  'details.compauth': 'Microsoft compauth',
  'details.policy': 'Policy',
  'details.domain': 'Domain',
  'details.mailfrom': 'Envelope sender',
  'details.signedBy': 'Signed by',
  'details.action': 'Action',
  'details.reason': 'Reason',
  'details.forwarder': 'Forwarded by',
  'details.notPresent': 'not recorded',

  'result.pass': 'pass',
  'result.fail': 'fail',
  'result.softfail': 'soft fail',
  'result.none': 'none',
  'result.neutral': 'neutral',
  'result.temperror': 'temporary error',
  'result.permerror': 'permanent error',
  'result.bestguesspass': 'no policy',

  'raw.heading': 'Raw authentication headers',
  'raw.trusted': 'Trusted: added by your mail server',
  'raw.other': 'Not trusted: added earlier, may be forged',
  'raw.secondary': 'For information only',

  'help.heading': 'What does this mean?',
  'help.states': 'The three results',
  'help.verified':
    'Verified: the message really comes from the sender domain, and that domain tells mail servers to reject fakes. Mail from inside your own organisation is also verified.',
  'help.authenticated':
    "Authenticated: the message really comes from the sender domain, but the domain doesn't (fully) block fakes, or its policy isn't known.",
  'help.unprotected':
    'Not protected: the sender could not be verified, the domain has no DMARC policy, or there are signs of forgery.',
  'help.terms': 'The checks',
  'help.dmarc':
    'DMARC ties a message to the domain in the From address. It passes when SPF or DKIM passes for that same domain.',
  'help.spf': 'SPF lists the servers that may send mail for a domain.',
  'help.dkim': 'DKIM is a digital signature added by the sending domain.',
  'help.arc':
    'ARC lets mailing lists and forwarders record the original result, because forwarding often breaks SPF and DKIM.',
  'help.policy':
    'The DMARC policy says what to do with fakes: reject (block), quarantine (spam folder) or none (monitor only).',
  'help.limits':
    "DMARC Shield reads the results your mail server recorded; it doesn't re-check signatures. A verified sender can still send unwanted content, so stay alert.",
  'help.privacy':
    'Everything is checked inside Outlook. The headers never leave your device. The optional DNS lookup sends only the sender’s domain name.',

  'settings.heading': 'Settings',
  'settings.infobar': "Show the result in the message's information bar",
  'settings.dns': 'Look up DMARC policies in DNS automatically',
  'settings.dnsHelp':
    "Only used when the headers don't show the policy. Sends only the sender's domain name to the resolver below: no message content, addresses or identifiers. Your IP address is visible to the resolver.",
  'settings.resolver': 'DNS resolver',
  'settings.resolver.custom': 'Custom (DNS-over-HTTPS URL)',
  'settings.customUrl': 'Resolver URL',
  'settings.customHelp':
    "Your organisation's DNS-over-HTTPS endpoint (RFC 8484), for example https://doh.example.com/dns-query. It must allow requests from browsers (CORS).",
  'settings.customInvalid': 'Enter a valid https:// URL for the resolver.',
  'settings.orgResolver':
    'DNS resolver set by your organisation: {host}. Domain names are only sent to this resolver.',
  'settings.language': 'Language',
  'settings.language.auto': 'Same as Outlook',
  'settings.save': 'Save',
  'settings.saved': 'Settings saved.',
  'settings.saveFailed': 'Settings could not be saved: {message}',
  'settings.storage':
    'Settings are stored in your own mailbox, so they follow you across Outlook apps. They are never sent to us.',

  'bimi.heading': 'Brand logo (BIMI)',
  'bimi.badge.verified': 'Verified logo',
  'bimi.badge.logo': 'Logo, no certificate',
  'bimi.badge.none': 'No BIMI',
  'bimi.badge.unchecked': 'Not checked',
  'bimi.badge.invalid': 'Rejected',
  'bimi.off':
    "Not checked. Checking contacts your DNS resolver and the server that hosts the sender's logo, which can see your IP address.",
  'bimi.button': 'Check brand logo',
  'bimi.always': 'Always check automatically',
  'bimi.checking': 'Checking BIMI for {domain}…',
  'bimi.none': "{domain} doesn't publish a brand logo (BIMI).",
  'bimi.declined': '{domain} has chosen not to show a brand logo.',
  'bimi.not-authenticated': 'No brand logo: BIMI requires a message that passed DMARC.',
  'bimi.weak-policy':
    'No brand logo: BIMI requires a fully enforced DMARC policy of quarantine or reject.',
  'bimi.verified.VMC':
    'Verified Mark Certificate: the logo of {holder} is backed by a registered trademark, verified by {root}.',
  'bimi.verified.CMC': 'Common Mark Certificate: the logo of {holder} is verified by {root}.',
  'bimi.verified.receiver': 'Your mail provider verified this brand logo and its certificate.',
  'bimi.logo.nocert':
    '{domain} publishes this logo without a mark certificate, so nobody has verified it belongs to them.',
  'bimi.logo.unreachable':
    "{domain} publishes a logo with a mark certificate, but the certificate couldn't be checked: its server doesn't let add-ins download it.",
  'bimi.logo.missing': "The logo itself couldn't be downloaded.",
  'bimi.invalid': 'The BIMI certificate of {domain} was rejected: {reason}. No logo is shown.',
  'bimi.reason.malformed': "it can't be read",
  'bimi.reason.no-bimi-certificate': "it isn't a BIMI certificate",
  'bimi.reason.untrusted': "it isn't issued by a recognised mark certificate authority",
  'bimi.reason.bad-signature': 'its signature is invalid',
  'bimi.reason.expired': 'it has expired',
  'bimi.reason.not-yet-valid': "it isn't valid yet",
  'bimi.reason.domain-mismatch': 'it was issued for a different domain',
  'bimi.reason.no-logo': 'it contains no logo',
  'bimi.reason.receiver-fail': "your mail provider couldn't validate it",
  'bimi.error': 'BIMI check failed: {message}',
  'bimi.logoAlt': 'Brand logo of {domain}',
  'settings.bimi': 'Check brand logos (BIMI) automatically',
  'settings.bimiHelp':
    "Only for messages that passed DMARC with an enforcing policy. Looks up the sender's BIMI record through the DNS resolver above, then downloads the logo and certificate from the address in that record. That server can see your IP address. The certificate is checked in the add-in.",
  'help.bimi':
    'BIMI lets a domain show its logo next to its mail. Green: the logo is backed by a Verified or Common Mark Certificate from a recognised authority. Blue: the domain publishes a logo without a (checkable) certificate. Grey: no BIMI, or not checked.',

  'tip.pin':
    'Tip: pin this pane (pin icon at the top) to check every message automatically. Pinning is available for Microsoft 365 work and school accounts.',

  'footer.refresh': 'Refresh',
  'footer.privacy': 'Privacy',
  'footer.about': 'About',
  'footer.version': 'Version {version}',

  'infobar.verified': 'DMARC Shield: verified sender ({domain}).',
  'infobar.internal': 'DMARC Shield: internal message from your organisation.',
  'infobar.authenticated':
    "DMARC Shield: sender authenticated ({domain}), but the domain doesn't fully block fakes.",
  'infobar.unprotected':
    'DMARC Shield: this sender could not be verified. Be careful with links and attachments.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
