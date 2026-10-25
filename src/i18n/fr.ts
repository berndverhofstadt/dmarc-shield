import type { Messages } from './en';

export const fr: Messages = {
  'app.title': 'DMARC Shield',
  'app.demo': 'Démo avec des en-têtes d’exemple. Aucun e-mail n’est lu.',

  'state.verified': 'Vérifié',
  'state.authenticated': 'Authentifié',
  'state.unprotected': 'Non protégé',
  'state.unsupported': 'Non pris en charge',
  'state.loading': 'Vérification…',
  'state.noitem': 'Aucun message sélectionné',
  'state.error': 'Vérification impossible',

  'reason.internal': 'Message interne, authentifié par votre organisation.',
  'reason.policy-reject':
    'L’expéditeur a réussi DMARC et {domain} demande aux serveurs de messagerie de rejeter les usurpations.',
  'reason.policy-partial':
    'L’expéditeur a réussi DMARC, mais {domain} n’applique que partiellement sa politique de rejet (mode test ou pourcentage).',
  'reason.policy-quarantine':
    'L’expéditeur a réussi DMARC. {domain} demande de placer les usurpations en spam plutôt que de les rejeter.',
  'reason.policy-none':
    'L’expéditeur a réussi DMARC, mais {domain} se contente de surveiller (p=none) et ne bloque pas les usurpations.',
  'reason.policy-unknown':
    'L’expéditeur a réussi DMARC. Votre fournisseur n’a pas enregistré la politique de {domain} ; on ne sait donc pas si les usurpations seraient rejetées.',
  'reason.forgery': 'Des signes de falsification ont été détectés. Méfiez-vous de ce message.',
  'reason.no-auth-results':
    'Votre serveur de messagerie n’a enregistré aucun résultat d’authentification pour ce message.',
  'reason.dmarc-missing': 'Aucun résultat DMARC n’a été enregistré pour ce message.',
  'reason.dmarc-none':
    'Le domaine de l’expéditeur ne publie pas de politique DMARC : n’importe qui peut envoyer des e-mails en son nom.',
  'reason.dmarc-fail':
    'Ce message a échoué à DMARC : impossible de prouver qu’il provient de {domain}.',
  'reason.dmarc-error':
    'DMARC n’a pas pu être évalué en raison d’une erreur temporaire ou permanente.',
  'reason.dmarc-other': 'DMARC a renvoyé un résultat inattendu : {result}.',
  'reason.unsupported':
    'Cette version d’Outlook ne permet pas aux compléments de lire les en-têtes ; l’expéditeur ne peut pas être vérifié ici.',
  'reason.noitem': 'Sélectionnez un message pour vérifier son expéditeur.',
  'reason.error': 'Outlook a renvoyé une erreur : {message}',
  'reason.outside':
    'Ouvrez DMARC Shield depuis un message dans Outlook pour vérifier son expéditeur.',

  'via.arc':
    'Vérifié via ARC : transféré par {sealer}. Votre serveur a fait confiance à l’enregistrement de la vérification d’origine par ce relais.',
  'via.arc.unknown': 'un relais non identifié',

  'policy.reject': 'rejet (reject)',
  'policy.quarantine': 'quarantaine',
  'policy.none': 'aucune (surveillance seule)',
  'policy.partial': '{policy}, appliquée partiellement',
  'policy.source.header': 'd’après les en-têtes du message',
  'policy.source.arc': 'enregistrée par le relais',
  'policy.source.dns': 'd’après le DNS via {resolver}',
  'policy.unknown': 'non visible dans les en-têtes',

  'dns.offer':
    'DMARC Shield peut consulter l’enregistrement DMARC de {domain}. Seul le nom de domaine est envoyé à {resolver}, rien sur le message.',
  'dns.button': 'Consulter la politique',
  'dns.always': 'Toujours consulter automatiquement',
  'dns.checking': 'Consultation de l’enregistrement DMARC de {domain}…',
  'dns.failed': 'La requête DNS a échoué : {message}',
  'dns.norecord': 'Aucun enregistrement DMARC trouvé pour {domain}.',

  'findings.heading': 'Avertissements et remarques',
  'finding.ar-unparseable':
    'L’en-tête d’authentification ajouté par votre serveur n’a pas pu être lu.',
  'finding.ar-duplicate-authserv':
    'Le message contient des résultats d’authentification contradictoires prétendant venir de votre serveur.',
  'finding.ar-contradiction':
    'Un en-tête antérieur affirme que ce message a réussi DMARC, mais votre serveur dit le contraire. Cet en-tête est peut-être falsifié.',
  'finding.arc-broken': 'La chaîne de transfert (ARC) est incomplète ou incohérente.',
  'finding.arc-from-mismatch':
    'Le relais a enregistré un autre expéditeur ({headerFrom}) que celui affiché ({from}).',
  'finding.header-from-mismatch':
    'Le domaine authentifié {headerFrom} n’est pas le domaine d’expéditeur affiché ({from}).',
  'finding.multiple-from': 'Le message comporte plus d’une adresse d’expéditeur.',
  'finding.from-mixed-script':
    'Le domaine {domain} mélange des alphabets (par exemple latin et cyrillique), une technique courante d’imitation.',
  'finding.from-confusable':
    'Le domaine {domain} utilise des caractères qui imitent des lettres ordinaires.',
  'finding.from-lookalike': 'Le domaine {domain} ressemble à votre propre domaine {other}.',
  'finding.replyto-lookalike':
    'Les réponses vont à {replyTo}, qui imite le domaine de l’expéditeur {from}.',
  'finding.multiple-hops':
    'Ce message est passé par {count} serveurs ayant vérifié l’authentification. C’est normal pour un message transféré.',
  'finding.arc-failed': 'Votre serveur n’a pas pu vérifier la chaîne de transfert (ARC).',
  'finding.replyto-differs': 'Les réponses vont vers un autre domaine : {replyTo}.',
  'finding.display-name-address':
    'Le nom de l’expéditeur affiche {shown}, mais l’adresse réelle est {actual}.',
  'finding.compauth-fail': 'Authentification composite Microsoft : {result} (raison {reason}).',
  'finding.dkim-unaligned': 'La signature provient de {domain}, pas du domaine de l’expéditeur.',
  'finding.idn-from':
    'Le domaine de l’expéditeur utilise des caractères internationaux : {domain} ({ascii}).',

  'details.heading': 'Détails',
  'details.sender': 'Expéditeur',
  'details.dmarc': 'DMARC',
  'details.spf': 'SPF',
  'details.dkim': 'DKIM',
  'details.arc': 'ARC',
  'details.compauth': 'Microsoft compauth',
  'details.policy': 'Politique',
  'details.domain': 'Domaine',
  'details.mailfrom': 'Expéditeur d’enveloppe',
  'details.signedBy': 'Signé par',
  'details.action': 'Action',
  'details.reason': 'Raison',
  'details.forwarder': 'Transféré par',
  'details.notPresent': 'non enregistré',

  'result.pass': 'réussi',
  'result.fail': 'échec',
  'result.softfail': 'échec partiel',
  'result.none': 'aucun',
  'result.neutral': 'neutre',
  'result.temperror': 'erreur temporaire',
  'result.permerror': 'erreur permanente',
  'result.bestguesspass': 'pas de politique',

  'raw.heading': 'En-têtes d’authentification bruts',
  'raw.trusted': 'Fiable : ajouté par votre serveur',
  'raw.other': 'Non fiable : ajouté auparavant, peut être falsifié',
  'raw.secondary': 'À titre d’information',

  'help.heading': 'Qu’est-ce que cela signifie ?',
  'help.states': 'Les trois résultats',
  'help.verified':
    'Vérifié : le message provient réellement du domaine de l’expéditeur, et ce domaine demande de rejeter les usurpations. Les messages internes à votre organisation sont aussi vérifiés.',
  'help.authenticated':
    'Authentifié : le message provient réellement du domaine de l’expéditeur, mais le domaine ne bloque pas (entièrement) les usurpations ou sa politique est inconnue.',
  'help.unprotected':
    'Non protégé : l’expéditeur n’a pas pu être vérifié, le domaine n’a pas de politique DMARC ou il y a des signes de falsification.',
  'help.terms': 'Les vérifications',
  'help.dmarc':
    'DMARC relie un message au domaine de l’adresse De. Il réussit lorsque SPF ou DKIM réussit pour ce même domaine.',
  'help.spf': 'SPF liste les serveurs autorisés à envoyer des e-mails pour un domaine.',
  'help.dkim': 'DKIM est une signature numérique ajoutée par le domaine d’envoi.',
  'help.arc':
    'ARC permet aux listes de diffusion et aux relais d’enregistrer le résultat d’origine, car le transfert casse souvent SPF et DKIM.',
  'help.policy':
    'La politique DMARC indique quoi faire des usurpations : rejeter (reject), mettre en quarantaine (spam) ou rien (surveillance seule).',
  'help.limits':
    'DMARC Shield lit les résultats enregistrés par votre serveur ; il ne revérifie pas les signatures. Un expéditeur vérifié peut tout de même envoyer du contenu indésirable : restez vigilant.',
  'help.privacy':
    'Tout est vérifié dans Outlook. Les en-têtes ne quittent jamais votre appareil. La requête DNS facultative n’envoie que le nom de domaine de l’expéditeur.',

  'settings.heading': 'Paramètres',
  'settings.infobar': 'Afficher le résultat dans la barre d’informations du message',
  'settings.dns': 'Consulter automatiquement les politiques DMARC dans le DNS',
  'settings.dnsHelp':
    'Utilisé uniquement si les en-têtes n’indiquent pas la politique. Seul le nom de domaine de l’expéditeur est envoyé au résolveur ci-dessous : aucun contenu, adresse ou identifiant. Le résolveur voit votre adresse IP.',
  'settings.resolver': 'Résolveur DNS',
  'settings.language': 'Langue',
  'settings.language.auto': 'Comme Outlook',
  'settings.save': 'Enregistrer',
  'settings.saved': 'Paramètres enregistrés.',
  'settings.saveFailed': 'Impossible d’enregistrer les paramètres : {message}',
  'settings.storage':
    'Les paramètres sont stockés dans votre propre boîte aux lettres et vous suivent dans toutes les applications Outlook. Ils ne nous sont jamais envoyés.',

  'bimi.heading': 'Logo de marque (BIMI)',
  'bimi.badge.verified': 'Logo vérifié',
  'bimi.badge.logo': 'Logo, sans certificat',
  'bimi.badge.none': 'Pas de BIMI',
  'bimi.badge.unchecked': 'Non vérifié',
  'bimi.badge.invalid': 'Rejeté',
  'bimi.off':
    'Non vérifié. La vérification contacte votre résolveur DNS et le serveur qui héberge le logo de l’expéditeur, qui voit votre adresse IP.',
  'bimi.button': 'Vérifier le logo',
  'bimi.always': 'Toujours vérifier automatiquement',
  'bimi.checking': 'Vérification BIMI de {domain}…',
  'bimi.none': '{domain} ne publie pas de logo de marque (BIMI).',
  'bimi.declined': '{domain} a choisi de ne pas afficher de logo.',
  'bimi.not-authenticated': 'Pas de logo : BIMI exige un message ayant réussi DMARC.',
  'bimi.weak-policy':
    'Pas de logo : BIMI exige une politique DMARC quarantaine ou rejet, appliquée entièrement.',
  'bimi.verified.VMC':
    'Verified Mark Certificate : le logo de {holder} correspond à une marque déposée, vérifiée par {root}.',
  'bimi.verified.CMC': 'Common Mark Certificate : le logo de {holder} est vérifié par {root}.',
  'bimi.verified.receiver': 'Votre fournisseur a vérifié ce logo et son certificat.',
  'bimi.logo.nocert':
    '{domain} publie ce logo sans certificat de marque : personne n’a vérifié qu’il lui appartient.',
  'bimi.logo.unreachable':
    '{domain} publie un logo avec certificat, mais celui-ci n’a pas pu être vérifié : son serveur n’autorise pas les compléments à le télécharger.',
  'bimi.logo.missing': 'Le logo lui-même n’a pas pu être téléchargé.',
  'bimi.invalid':
    'Le certificat BIMI de {domain} a été rejeté : {reason}. Aucun logo n’est affiché.',
  'bimi.reason.malformed': 'il est illisible',
  'bimi.reason.no-bimi-certificate': 'ce n’est pas un certificat BIMI',
  'bimi.reason.untrusted': 'il n’est pas émis par une autorité reconnue',
  'bimi.reason.bad-signature': 'sa signature est invalide',
  'bimi.reason.expired': 'il a expiré',
  'bimi.reason.not-yet-valid': 'il n’est pas encore valide',
  'bimi.reason.domain-mismatch': 'il a été émis pour un autre domaine',
  'bimi.reason.no-logo': 'il ne contient pas de logo',
  'bimi.reason.receiver-fail': 'votre fournisseur n’a pas pu le valider',
  'bimi.error': 'Échec de la vérification BIMI : {message}',
  'bimi.logoAlt': 'Logo de marque de {domain}',
  'settings.bimi': 'Vérifier automatiquement les logos de marque (BIMI)',
  'settings.bimiHelp':
    'Uniquement pour les messages ayant réussi DMARC avec une politique appliquée. Consulte l’enregistrement BIMI via le résolveur DNS ci-dessus, puis télécharge le logo et le certificat depuis l’adresse indiquée. Ce serveur voit votre adresse IP. Le certificat est vérifié dans le complément.',
  'help.bimi':
    'BIMI permet à un domaine d’afficher son logo à côté de ses e-mails. Vert : le logo est garanti par un Verified ou Common Mark Certificate d’une autorité reconnue. Bleu : le domaine publie un logo sans certificat (vérifiable). Gris : pas de BIMI, ou non vérifié.',

  'tip.pin':
    'Astuce : épinglez ce volet (icône en haut) pour vérifier automatiquement chaque message. L’épinglage est disponible pour les comptes professionnels et scolaires Microsoft 365.',

  'footer.privacy': 'Confidentialité',
  'footer.about': 'À propos',
  'footer.version': 'Version {version}',

  'infobar.verified': 'DMARC Shield : expéditeur vérifié ({domain}).',
  'infobar.internal': 'DMARC Shield : message interne de votre organisation.',
  'infobar.authenticated':
    'DMARC Shield : expéditeur authentifié ({domain}), usurpations pas entièrement bloquées.',
  'infobar.unprotected':
    'DMARC Shield : cet expéditeur n’a pas pu être vérifié. Prudence avec les liens et pièces jointes.',
};
