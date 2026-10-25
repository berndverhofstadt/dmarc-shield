import type { Messages } from './en';

export const nl: Messages = {
  'app.title': 'DMARC Shield',
  'app.demo': 'Demo met voorbeeldheaders. Er wordt geen e-mail gelezen.',

  'state.verified': 'Geverifieerd',
  'state.authenticated': 'Geauthenticeerd',
  'state.unprotected': 'Niet beschermd',
  'state.unsupported': 'Niet ondersteund',
  'state.loading': 'Bezig met controleren…',
  'state.noitem': 'Geen bericht geselecteerd',
  'state.error': 'Controle mislukt',

  'reason.internal': 'Intern bericht, geauthenticeerd door uw organisatie.',
  'reason.policy-reject':
    'De afzender is geslaagd voor DMARC en {domain} vraagt mailservers om vervalsingen te weigeren.',
  'reason.policy-partial':
    'De afzender is geslaagd voor DMARC, maar {domain} past het weigerbeleid maar gedeeltelijk toe (testmodus of een percentage).',
  'reason.policy-quarantine':
    'De afzender is geslaagd voor DMARC. {domain} vraagt mailservers om vervalsingen naar spam te sturen in plaats van ze te weigeren.',
  'reason.policy-none':
    'De afzender is geslaagd voor DMARC, maar {domain} monitort alleen (p=none) en blokkeert geen vervalsingen.',
  'reason.policy-unknown':
    'De afzender is geslaagd voor DMARC. Uw e-mailprovider heeft het beleid van {domain} niet vastgelegd, dus het is onbekend of vervalsingen geweigerd worden.',
  'reason.forgery': 'Er zijn tekenen van vervalsing gevonden. Wees voorzichtig met dit bericht.',
  'reason.no-auth-results':
    'Uw mailserver heeft geen authenticatieresultaat voor dit bericht vastgelegd.',
  'reason.dmarc-missing': 'Er is geen DMARC-resultaat voor dit bericht vastgelegd.',
  'reason.dmarc-none':
    'Het domein van de afzender publiceert geen DMARC-beleid, dus iedereen kan namens dit domein mailen.',
  'reason.dmarc-fail':
    'Dit bericht is niet geslaagd voor DMARC: niet aantoonbaar afkomstig van {domain}.',
  'reason.dmarc-error': 'DMARC kon niet worden beoordeeld door een tijdelijke of permanente fout.',
  'reason.dmarc-other': 'DMARC gaf een onverwacht resultaat: {result}.',
  'reason.unsupported':
    'Deze versie van Outlook laat invoegtoepassingen geen berichtheaders lezen, dus de afzender kan hier niet worden gecontroleerd.',
  'reason.noitem': 'Selecteer een bericht om de afzender te controleren.',
  'reason.error': 'Outlook gaf een fout: {message}',
  'reason.outside':
    'Open DMARC Shield vanuit een bericht in Outlook om de afzender te controleren.',

  'via.arc':
    'Geverifieerd via ARC: doorgestuurd door {sealer}. Uw mailserver vertrouwde de vastlegging van de oorspronkelijke controle door deze doorstuurder.',
  'via.arc.unknown': 'een onbekende doorstuurder',

  'policy.reject': 'weigeren (reject)',
  'policy.quarantine': 'quarantaine',
  'policy.none': 'geen (alleen monitoren)',
  'policy.partial': '{policy}, gedeeltelijk toegepast',
  'policy.source.header': 'uit de berichtheaders',
  'policy.source.arc': 'vastgelegd door de doorstuurder',
  'policy.source.dns': 'uit DNS via {resolver}',
  'policy.unknown': 'niet zichtbaar in de headers',

  'dns.offer':
    'DMARC Shield kan het DMARC-record van {domain} opzoeken. Daarbij wordt alleen de domeinnaam naar {resolver} gestuurd, niets over het bericht.',
  'dns.button': 'Beleid opzoeken',
  'dns.always': 'Altijd automatisch opzoeken',
  'dns.checking': 'DMARC-record van {domain} opzoeken…',
  'dns.failed': 'De DNS-opzoeking is mislukt: {message}',
  'dns.failed.network':
    '{resolver} ({host}) is niet bereikbaar. Een firewall, DNS-filter (zoals Pi-hole of NextDNS), antivirus of browserextensie blokkeert mogelijk DNS-over-HTTPS.',
  'dns.failed.timeout': '{resolver} antwoordde niet op tijd.',
  'dns.tryOther': 'Probeer {resolver}',
  'dns.norecord': 'Er is geen DMARC-record gevonden voor {domain}.',

  'findings.heading': 'Waarschuwingen en opmerkingen',
  'finding.ar-unparseable': 'De authenticatieheader van uw mailserver kon niet worden gelezen.',
  'finding.ar-duplicate-authserv':
    'Het bericht bevat tegenstrijdige authenticatieresultaten die van uw mailserver zouden komen.',
  'finding.ar-contradiction':
    'Een eerdere header beweert dat dit bericht voor DMARC is geslaagd, maar uw mailserver zegt van niet. Die header is mogelijk vervalst.',
  'finding.arc-broken': 'De doorstuurketen (ARC) is onvolledig of klopt niet.',
  'finding.arc-from-mismatch':
    'De doorstuurder heeft een andere afzender vastgelegd ({headerFrom}) dan getoond wordt ({from}).',
  'finding.header-from-mismatch':
    'Het geauthenticeerde domein {headerFrom} is niet het getoonde afzenderdomein ({from}).',
  'finding.multiple-from': 'Het bericht heeft meer dan één afzenderadres.',
  'finding.from-mixed-script':
    'Het afzenderdomein {domain} mengt alfabetten (bijvoorbeeld Latijns en Cyrillisch), een bekende truc met lookalike-domeinen.',
  'finding.from-confusable':
    'Het afzenderdomein {domain} gebruikt tekens die gewone letters nabootsen.',
  'finding.from-lookalike': 'Het afzenderdomein {domain} lijkt op uw eigen domein {other}.',
  'finding.replyto-lookalike':
    'Antwoorden gaan naar {replyTo}, dat het afzenderdomein {from} nabootst.',
  'finding.multiple-hops':
    'Dit bericht passeerde {count} servers die authenticatie controleerden. Dat is normaal bij doorgestuurde mail.',
  'finding.arc-failed': 'Uw mailserver kon de doorstuurketen (ARC) niet verifiëren.',
  'finding.replyto-differs': 'Antwoorden gaan naar een ander domein: {replyTo}.',
  'finding.display-name-address':
    'De afzendernaam toont {shown}, maar het echte adres is {actual}.',
  'finding.compauth-fail': 'Samengestelde authenticatie van Microsoft: {result} (reden {reason}).',
  'finding.dkim-unaligned': 'De handtekening is van {domain}, niet van het afzenderdomein.',
  'finding.idn-from': 'Het afzenderdomein gebruikt internationale tekens: {domain} ({ascii}).',

  'details.heading': 'Details',
  'details.sender': 'Afzender',
  'details.dmarc': 'DMARC',
  'details.spf': 'SPF',
  'details.dkim': 'DKIM',
  'details.arc': 'ARC',
  'details.compauth': 'Microsoft compauth',
  'details.policy': 'Beleid',
  'details.domain': 'Domein',
  'details.mailfrom': 'Envelop-afzender',
  'details.signedBy': 'Ondertekend door',
  'details.action': 'Actie',
  'details.reason': 'Reden',
  'details.forwarder': 'Doorgestuurd door',
  'details.notPresent': 'niet vastgelegd',

  'result.pass': 'geslaagd',
  'result.fail': 'mislukt',
  'result.softfail': 'zacht mislukt',
  'result.none': 'geen',
  'result.neutral': 'neutraal',
  'result.temperror': 'tijdelijke fout',
  'result.permerror': 'permanente fout',
  'result.bestguesspass': 'geen beleid',

  'raw.heading': 'Ruwe authenticatieheaders',
  'raw.trusted': 'Vertrouwd: toegevoegd door uw mailserver',
  'raw.other': 'Niet vertrouwd: eerder toegevoegd, mogelijk vervalst',
  'raw.secondary': 'Alleen ter informatie',

  'help.heading': 'Wat betekent dit?',
  'help.states': 'De drie uitkomsten',
  'help.verified':
    'Geverifieerd: het bericht komt echt van het afzenderdomein, en dat domein vraagt mailservers om vervalsingen te weigeren. Mail van binnen uw eigen organisatie is ook geverifieerd.',
  'help.authenticated':
    'Geauthenticeerd: het bericht komt echt van het afzenderdomein, maar het domein blokkeert vervalsingen niet (volledig) of het beleid is onbekend.',
  'help.unprotected':
    'Niet beschermd: de afzender kon niet worden geverifieerd, het domein heeft geen DMARC-beleid of er zijn tekenen van vervalsing.',
  'help.terms': 'De controles',
  'help.dmarc':
    'DMARC koppelt een bericht aan het domein in het Van-adres. DMARC slaagt als SPF of DKIM slaagt voor datzelfde domein.',
  'help.spf': 'SPF somt de servers op die namens een domein mogen mailen.',
  'help.dkim': 'DKIM is een digitale handtekening die het verzendende domein toevoegt.',
  'help.arc':
    'Met ARC kunnen mailinglijsten en doorstuurders het oorspronkelijke resultaat vastleggen, omdat doorsturen SPF en DKIM vaak breekt.',
  'help.policy':
    'Het DMARC-beleid zegt wat er met vervalsingen moet gebeuren: weigeren (reject), quarantaine (spammap) of niets (alleen monitoren).',
  'help.limits':
    'DMARC Shield leest de resultaten die uw mailserver heeft vastgelegd en controleert handtekeningen niet opnieuw. Ook een geverifieerde afzender kan ongewenste inhoud sturen, dus blijf alert.',
  'help.privacy':
    'Alles wordt binnen Outlook gecontroleerd. De headers verlaten uw apparaat nooit. De optionele DNS-opzoeking verstuurt alleen de domeinnaam van de afzender.',

  'settings.heading': 'Instellingen',
  'settings.infobar': 'Toon het resultaat in de informatiebalk van het bericht',
  'settings.dns': 'DMARC-beleid automatisch opzoeken in DNS',
  'settings.dnsHelp':
    'Alleen gebruikt als de headers het beleid niet tonen. Verstuurt alleen de domeinnaam van de afzender naar de resolver hieronder: geen berichtinhoud, adressen of identificatoren. De resolver ziet wel uw IP-adres.',
  'settings.resolver': 'DNS-resolver',
  'settings.resolver.custom': 'Aangepast (DNS-over-HTTPS-URL)',
  'settings.customUrl': 'Resolver-URL',
  'settings.customHelp':
    'Het DNS-over-HTTPS-adres van uw organisatie (RFC 8484), bijvoorbeeld https://doh.example.com/dns-query. Het moet verzoeken vanuit browsers toestaan (CORS).',
  'settings.customInvalid': 'Voer een geldige https://-URL in voor de resolver.',
  'settings.orgResolver':
    'DNS-resolver ingesteld door uw organisatie: {host}. Domeinnamen worden alleen naar deze resolver gestuurd.',
  'settings.language': 'Taal',
  'settings.language.auto': 'Zelfde als Outlook',
  'settings.save': 'Opslaan',
  'settings.saved': 'Instellingen opgeslagen.',
  'settings.saveFailed': 'Instellingen konden niet worden opgeslagen: {message}',
  'settings.storage':
    'Instellingen worden in uw eigen mailbox bewaard, zodat ze u volgen in alle Outlook-apps. Ze worden nooit naar ons gestuurd.',

  'bimi.heading': 'Merklogo (BIMI)',
  'bimi.badge.verified': 'Geverifieerd logo',
  'bimi.badge.logo': 'Logo, geen certificaat',
  'bimi.badge.none': 'Geen BIMI',
  'bimi.badge.unchecked': 'Niet gecontroleerd',
  'bimi.badge.invalid': 'Afgewezen',
  'bimi.off':
    'Niet gecontroleerd. De controle neemt contact op met uw DNS-resolver en met de server van het logo van de afzender; die ziet uw IP-adres.',
  'bimi.button': 'Merklogo controleren',
  'bimi.always': 'Altijd automatisch controleren',
  'bimi.checking': 'BIMI van {domain} controleren…',
  'bimi.none': '{domain} publiceert geen merklogo (BIMI).',
  'bimi.declined': '{domain} heeft gekozen geen merklogo te tonen.',
  'bimi.not-authenticated': 'Geen merklogo: BIMI vereist een bericht dat voor DMARC is geslaagd.',
  'bimi.weak-policy':
    'Geen merklogo: BIMI vereist een volledig toegepast DMARC-beleid quarantaine of weigeren.',
  'bimi.verified.VMC':
    'Verified Mark Certificate: het logo van {holder} is gekoppeld aan een geregistreerd merk, geverifieerd door {root}.',
  'bimi.verified.CMC':
    'Common Mark Certificate: het logo van {holder} is geverifieerd door {root}.',
  'bimi.verified.receiver': 'Uw e-mailprovider heeft dit merklogo en het certificaat geverifieerd.',
  'bimi.logo.nocert':
    '{domain} publiceert dit logo zonder merkcertificaat; niemand heeft gecontroleerd of het van hen is.',
  'bimi.logo.unreachable':
    '{domain} publiceert een logo met merkcertificaat, maar het certificaat kon niet worden gecontroleerd: de server staat downloaden door invoegtoepassingen niet toe.',
  'bimi.logo.missing': 'Het logo zelf kon niet worden gedownload.',
  'bimi.invalid':
    'Het BIMI-certificaat van {domain} is afgewezen: {reason}. Er wordt geen logo getoond.',
  'bimi.reason.malformed': 'het is onleesbaar',
  'bimi.reason.no-bimi-certificate': 'het is geen BIMI-certificaat',
  'bimi.reason.untrusted': 'het is niet uitgegeven door een erkende uitgever van merkcertificaten',
  'bimi.reason.bad-signature': 'de handtekening is ongeldig',
  'bimi.reason.expired': 'het is verlopen',
  'bimi.reason.not-yet-valid': 'het is nog niet geldig',
  'bimi.reason.domain-mismatch': 'het is uitgegeven voor een ander domein',
  'bimi.reason.no-logo': 'het bevat geen logo',
  'bimi.reason.receiver-fail': 'uw e-mailprovider kon het niet valideren',
  'bimi.error': 'BIMI-controle mislukt: {message}',
  'bimi.logoAlt': 'Merklogo van {domain}',
  'settings.bimi': "Merklogo's (BIMI) automatisch controleren",
  'settings.bimiHelp':
    'Alleen voor berichten die voor DMARC zijn geslaagd met een afdwingend beleid. Zoekt het BIMI-record van de afzender op via de DNS-resolver hierboven en downloadt daarna het logo en certificaat van het adres in dat record. Die server ziet uw IP-adres. Het certificaat wordt in de invoegtoepassing gecontroleerd.',
  'help.bimi':
    'Met BIMI kan een domein zijn logo naast zijn mail tonen. Groen: het logo wordt ondersteund door een Verified of Common Mark Certificate van een erkende uitgever. Blauw: het domein publiceert een logo zonder (controleerbaar) certificaat. Grijs: geen BIMI, of niet gecontroleerd.',

  'tip.pin':
    'Tip: maak dit deelvenster vast (punaise bovenaan) om elk bericht automatisch te controleren. Vastmaken is beschikbaar voor Microsoft 365-werk- en schoolaccounts.',

  'footer.refresh': 'Vernieuwen',
  'footer.privacy': 'Privacy',
  'footer.about': 'Over',
  'footer.version': 'Versie {version}',

  'infobar.verified': 'DMARC Shield: geverifieerde afzender ({domain}).',
  'infobar.internal': 'DMARC Shield: intern bericht van uw organisatie.',
  'infobar.authenticated':
    'DMARC Shield: afzender echt ({domain}), maar vervalsingen worden niet volledig geblokkeerd.',
  'infobar.unprotected':
    'DMARC Shield: deze afzender kon niet worden geverifieerd. Wees voorzichtig met links en bijlagen.',
};
