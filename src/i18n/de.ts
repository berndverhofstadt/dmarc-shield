import type { Messages } from './en';

export const de: Messages = {
  'app.title': 'DMARC Shield',
  'app.demo': 'Demo mit Beispiel-Headern. Es werden keine E-Mails gelesen.',

  'state.verified': 'Verifiziert',
  'state.authenticated': 'Authentifiziert',
  'state.unprotected': 'Nicht geschützt',
  'state.unsupported': 'Nicht unterstützt',
  'state.loading': 'Wird geprüft…',
  'state.noitem': 'Keine Nachricht ausgewählt',
  'state.error': 'Prüfung nicht möglich',

  'reason.internal': 'Interne Nachricht, von Ihrer Organisation authentifiziert.',
  'reason.policy-reject':
    'Der Absender hat DMARC bestanden, und {domain} weist Mailserver an, Fälschungen abzulehnen.',
  'reason.policy-partial':
    'Der Absender hat DMARC bestanden, aber {domain} setzt seine Ablehnungsrichtlinie nur teilweise durch (Testmodus oder Prozentsatz).',
  'reason.policy-quarantine':
    'Der Absender hat DMARC bestanden. {domain} bittet darum, Fälschungen in den Spam zu verschieben statt sie abzulehnen.',
  'reason.policy-none':
    'Der Absender hat DMARC bestanden, aber {domain} überwacht nur (p=none) und blockiert keine Fälschungen.',
  'reason.policy-unknown':
    'Der Absender hat DMARC bestanden. Ihr Mailanbieter hat die Richtlinie von {domain} nicht vermerkt, daher ist unklar, ob Fälschungen abgelehnt würden.',
  'reason.forgery':
    'Es wurden Anzeichen einer Fälschung gefunden. Seien Sie bei dieser Nachricht vorsichtig.',
  'reason.no-auth-results':
    'Ihr Mailserver hat für diese Nachricht kein Authentifizierungsergebnis vermerkt.',
  'reason.dmarc-missing': 'Für diese Nachricht wurde kein DMARC-Ergebnis vermerkt.',
  'reason.dmarc-none':
    'Die Domain des Absenders veröffentlicht keine DMARC-Richtlinie, daher kann jeder in ihrem Namen E-Mails senden.',
  'reason.dmarc-fail':
    'Diese Nachricht hat DMARC nicht bestanden: Es ist nicht nachweisbar, dass sie von {domain} stammt.',
  'reason.dmarc-error':
    'DMARC konnte wegen eines vorübergehenden oder dauerhaften Fehlers nicht geprüft werden.',
  'reason.dmarc-other': 'DMARC lieferte ein unerwartetes Ergebnis: {result}.',
  'reason.unsupported':
    'Diese Outlook-Version erlaubt Add-ins nicht, Nachrichten-Header zu lesen, daher kann der Absender hier nicht geprüft werden.',
  'reason.noitem': 'Wählen Sie eine Nachricht aus, um den Absender zu prüfen.',
  'reason.error': 'Outlook hat einen Fehler gemeldet: {message}',
  'reason.outside':
    'Öffnen Sie DMARC Shield aus einer Nachricht in Outlook, um den Absender zu prüfen.',

  'via.arc':
    'Über ARC verifiziert: weitergeleitet von {sealer}. Ihr Mailserver hat der Aufzeichnung der ursprünglichen Prüfung durch diese Weiterleitung vertraut.',
  'via.arc.unknown': 'einer unbekannten Weiterleitung',

  'policy.reject': 'ablehnen (reject)',
  'policy.quarantine': 'Quarantäne',
  'policy.none': 'keine (nur Überwachung)',
  'policy.partial': '{policy}, teilweise durchgesetzt',
  'policy.source.header': 'aus den Nachrichten-Headern',
  'policy.source.arc': 'von der Weiterleitung vermerkt',
  'policy.source.dns': 'aus dem DNS über {resolver}',
  'policy.unknown': 'in den Headern nicht sichtbar',

  'dns.offer':
    'DMARC Shield kann den DMARC-Eintrag von {domain} nachschlagen. Dabei wird nur der Domainname an {resolver} gesendet, nichts über die Nachricht.',
  'dns.button': 'Richtlinie nachschlagen',
  'dns.always': 'Immer automatisch nachschlagen',
  'dns.checking': 'DMARC-Eintrag von {domain} wird nachgeschlagen…',
  'dns.failed': 'Die DNS-Abfrage ist fehlgeschlagen: {message}',
  'dns.norecord': 'Für {domain} wurde kein DMARC-Eintrag gefunden.',

  'findings.heading': 'Warnungen und Hinweise',
  'finding.ar-unparseable':
    'Der Authentifizierungs-Header Ihres Mailservers konnte nicht gelesen werden.',
  'finding.ar-duplicate-authserv':
    'Die Nachricht enthält widersprüchliche Authentifizierungsergebnisse, die angeblich von Ihrem Mailserver stammen.',
  'finding.ar-contradiction':
    'Ein früherer Header behauptet, die Nachricht habe DMARC bestanden, aber Ihr Mailserver sagt nein. Dieser Header ist möglicherweise gefälscht.',
  'finding.arc-broken': 'Die Weiterleitungskette (ARC) ist unvollständig oder fehlerhaft.',
  'finding.arc-from-mismatch':
    'Die Weiterleitung hat einen anderen Absender vermerkt ({headerFrom}) als angezeigt wird ({from}).',
  'finding.header-from-mismatch':
    'Die authentifizierte Domain {headerFrom} ist nicht die angezeigte Absenderdomain ({from}).',
  'finding.multiple-from': 'Die Nachricht hat mehr als eine Absenderadresse.',
  'finding.from-mixed-script':
    'Die Absenderdomain {domain} mischt Alphabete (zum Beispiel lateinisch und kyrillisch), ein häufiger Trick für Doppelgänger-Domains.',
  'finding.from-confusable':
    'Die Absenderdomain {domain} verwendet Zeichen, die normale Buchstaben imitieren.',
  'finding.from-lookalike': 'Die Absenderdomain {domain} ähnelt Ihrer eigenen Domain {other}.',
  'finding.replyto-lookalike':
    'Antworten gehen an {replyTo}, das die Absenderdomain {from} imitiert.',
  'finding.multiple-hops':
    'Diese Nachricht hat {count} Server passiert, die die Authentifizierung geprüft haben. Das ist bei weitergeleiteten E-Mails normal.',
  'finding.arc-failed': 'Ihr Mailserver konnte die Weiterleitungskette (ARC) nicht verifizieren.',
  'finding.replyto-differs': 'Antworten gehen an eine andere Domain: {replyTo}.',
  'finding.display-name-address':
    'Der Absendername zeigt {shown}, die tatsächliche Adresse ist aber {actual}.',
  'finding.compauth-fail':
    'Zusammengesetzte Authentifizierung von Microsoft: {result} (Grund {reason}).',
  'finding.dkim-unaligned': 'Die Signatur stammt von {domain}, nicht von der Absenderdomain.',
  'finding.idn-from': 'Die Absenderdomain verwendet internationale Zeichen: {domain} ({ascii}).',

  'details.heading': 'Details',
  'details.sender': 'Absender',
  'details.dmarc': 'DMARC',
  'details.spf': 'SPF',
  'details.dkim': 'DKIM',
  'details.arc': 'ARC',
  'details.compauth': 'Microsoft compauth',
  'details.policy': 'Richtlinie',
  'details.domain': 'Domain',
  'details.mailfrom': 'Umschlag-Absender',
  'details.signedBy': 'Signiert von',
  'details.action': 'Aktion',
  'details.reason': 'Grund',
  'details.forwarder': 'Weitergeleitet von',
  'details.notPresent': 'nicht vermerkt',

  'result.pass': 'bestanden',
  'result.fail': 'fehlgeschlagen',
  'result.softfail': 'weich fehlgeschlagen',
  'result.none': 'keine',
  'result.neutral': 'neutral',
  'result.temperror': 'vorübergehender Fehler',
  'result.permerror': 'dauerhafter Fehler',
  'result.bestguesspass': 'keine Richtlinie',

  'raw.heading': 'Rohe Authentifizierungs-Header',
  'raw.trusted': 'Vertrauenswürdig: von Ihrem Mailserver hinzugefügt',
  'raw.other': 'Nicht vertrauenswürdig: früher hinzugefügt, möglicherweise gefälscht',
  'raw.secondary': 'Nur zur Information',

  'help.heading': 'Was bedeutet das?',
  'help.states': 'Die drei Ergebnisse',
  'help.verified':
    'Verifiziert: Die Nachricht stammt wirklich von der Absenderdomain, und diese Domain weist Mailserver an, Fälschungen abzulehnen. E-Mails aus Ihrer eigenen Organisation gelten ebenfalls als verifiziert.',
  'help.authenticated':
    'Authentifiziert: Die Nachricht stammt wirklich von der Absenderdomain, aber die Domain blockiert Fälschungen nicht (vollständig) oder ihre Richtlinie ist unbekannt.',
  'help.unprotected':
    'Nicht geschützt: Der Absender konnte nicht verifiziert werden, die Domain hat keine DMARC-Richtlinie oder es gibt Anzeichen einer Fälschung.',
  'help.terms': 'Die Prüfungen',
  'help.dmarc':
    'DMARC verknüpft eine Nachricht mit der Domain in der Von-Adresse. DMARC ist bestanden, wenn SPF oder DKIM für genau diese Domain besteht.',
  'help.spf': 'SPF listet die Server auf, die für eine Domain E-Mails senden dürfen.',
  'help.dkim': 'DKIM ist eine digitale Signatur, die die sendende Domain hinzufügt.',
  'help.arc':
    'Mit ARC können Mailinglisten und Weiterleitungen das ursprüngliche Ergebnis festhalten, da Weiterleiten SPF und DKIM oft bricht.',
  'help.policy':
    'Die DMARC-Richtlinie legt fest, was mit Fälschungen passiert: ablehnen (reject), Quarantäne (Spam-Ordner) oder nichts (nur Überwachung).',
  'help.limits':
    'DMARC Shield liest die Ergebnisse, die Ihr Mailserver vermerkt hat, und prüft Signaturen nicht erneut. Auch ein verifizierter Absender kann unerwünschte Inhalte senden: Bleiben Sie aufmerksam.',
  'help.privacy':
    'Alles wird innerhalb von Outlook geprüft. Die Header verlassen Ihr Gerät nie. Die optionale DNS-Abfrage sendet nur den Domainnamen des Absenders.',

  'settings.heading': 'Einstellungen',
  'settings.infobar': 'Ergebnis in der Infoleiste der Nachricht anzeigen',
  'settings.dns': 'DMARC-Richtlinien automatisch im DNS nachschlagen',
  'settings.dnsHelp':
    'Wird nur verwendet, wenn die Header die Richtlinie nicht zeigen. Sendet nur den Domainnamen des Absenders an den unten gewählten Resolver: keine Inhalte, Adressen oder Kennungen. Der Resolver sieht Ihre IP-Adresse.',
  'settings.resolver': 'DNS-Resolver',
  'settings.language': 'Sprache',
  'settings.language.auto': 'Wie Outlook',
  'settings.save': 'Speichern',
  'settings.saved': 'Einstellungen gespeichert.',
  'settings.saveFailed': 'Einstellungen konnten nicht gespeichert werden: {message}',
  'settings.storage':
    'Einstellungen werden in Ihrem eigenen Postfach gespeichert und folgen Ihnen in allen Outlook-Apps. Sie werden nie an uns gesendet.',

  'footer.privacy': 'Datenschutz',
  'footer.about': 'Info',
  'footer.version': 'Version {version}',

  'infobar.verified': 'DMARC Shield: verifizierter Absender ({domain}).',
  'infobar.internal': 'DMARC Shield: interne Nachricht Ihrer Organisation.',
  'infobar.authenticated':
    'DMARC Shield: Absender authentifiziert ({domain}), aber die Domain blockiert Fälschungen nicht vollständig.',
  'infobar.unprotected':
    'DMARC Shield: Dieser Absender konnte nicht verifiziert werden. Vorsicht bei Links und Anhängen.',
};
