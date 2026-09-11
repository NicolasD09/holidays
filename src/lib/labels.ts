/**
 * Toutes les chaînes visibles de l'application.
 *
 * Règle (doc 04 §4.6) : aucun texte affiché n'est écrit en dur dans un
 * composant. C'est ce qui rendra l'i18n possible sans réécriture, et c'est
 * aussi le seul endroit où relire le ton du produit d'un coup d'œil.
 *
 * Ton : tutoiement, phrases courtes, aucun jargon. Les messages d'erreur
 * disent quoi faire, pas ce qui a planté (doc 05 §5.6).
 */
export const labels = {
  app: {
    name: 'Vacances',
    tagline: 'Décidez des vacances du groupe en une soirée.',
    description:
      'Un lien à balancer dans le groupe, un prénom, et chacun se prononce sur la destination, les dates et le budget. Sans créer de compte.',
  },

  home: {
    createCta: 'Créer un sondage',
    myTrips: 'Mes sondages',
    sellingPoints: [
      {
        title: 'Sans compte',
        body: 'Tes potes cliquent sur le lien, mettent leur prénom, et votent. C’est tout.',
      },
      {
        title: 'Un seul lien',
        body: 'Tout se décide au même endroit : destination, dates, budget, logement, activités.',
      },
      {
        title: 'Sans pression',
        body: 'Aucune date limite, aucun compte à rebours. Le sondage reste ouvert tant que vous n’avez pas tranché.',
      },
    ],
  },

  nav: {
    backToHome: 'Retour à l’accueil',
    skipToContent: 'Aller au contenu',
  },

  notFound: {
    title: 'Ce lien ne mène nulle part',
    body: 'Le sondage a peut-être été supprimé, ou l’adresse est incomplète. Vérifie le lien qu’on t’a envoyé.',
    cta: 'Créer ton propre sondage',
  },

  error: {
    title: 'Quelque chose s’est mal passé',
    body: 'On n’a pas réussi à afficher cette page. Recharge pour réessayer.',
    retry: 'Recharger',
    tryAgain: 'Réessayer',
    voteFailed: 'Impossible d’enregistrer ton vote. Vérifie ta connexion et réessaie.',
    offline: 'Connexion perdue — tes derniers votes ne sont peut-être pas enregistrés.',
  },

  loading: {
    default: 'Chargement…',
  },

  empty: {
    noOptions: 'Aucune proposition pour l’instant. Lance-toi !',
  },

  /** É2 — création d'un sondage. */
  create: {
    title: 'Nouveau sondage',
    subtitle: 'Trois champs, et tu as un lien à balancer dans le groupe.',
    titleLabel: 'Le titre de ton sondage',
    titlePlaceholder: 'Vacances d’été',
    titleHint: 'C’est ce que tes potes verront en ouvrant le lien.',
    emojiLabel: 'Emoji de couverture',
    categoryLabel: 'Ce qu’on décide',
    categoryFixed: 'Destination',
    categoryFixedHint:
      'Pour l’instant on décide de la destination. Les dates, le budget et le reste arrivent bientôt.',
    nameLabel: 'Ton prénom',
    namePlaceholder: 'Marie',
    nameHint: 'Tu seras l’organisateur du sondage.',
    submit: 'Créer et obtenir le lien',
    submitting: 'Création…',
    errorTitleRequired: 'Donne un titre à ton sondage.',
    errorTitleTooLong: '120 caractères maximum.',
    errorNameRequired: 'Indique ton prénom.',
    errorNameTooLong: '40 caractères maximum.',
  },

  /** Modale de partage, affichée juste après la création. */
  share: {
    title: 'Ton sondage est prêt 🎉',
    body: 'Envoie ce lien dans le groupe. Tes potes n’ont rien à installer ni à créer.',
    copy: 'Copier le lien',
    copied: 'Lien copié',
    copyFailed: 'Copie impossible. Sélectionne le lien et copie-le à la main.',
    nativeShare: 'Partager…',
    linkLabel: 'Lien du sondage',
    continue: 'Voir mon sondage',
    /** Message pré-rempli — le lien est collé à la suite. */
    message: (title: string) =>
      `Salut ! On décide des vacances ici 👉 ${title} — ça prend 2 min, sans créer de compte.`,
  },

  /** É3 — adhésion. L'écran le plus important de l'app. */
  join: {
    heading: 'Rejoindre le sondage',
    nameLabel: 'Ton prénom',
    namePlaceholder: 'Ton prénom',
    submit: 'Rejoindre',
    submitting: 'On y va…',
    noAccount: 'Pas de compte à créer.',
    errorNameRequired: 'Indique ton prénom pour rejoindre.',
    categories: 'Ce qu’on décide ensemble',
    /** Ligne de présence, sous le titre du sondage. */
    participants: (count: number) =>
      count === 0
        ? 'Personne n’a encore rejoint — tu seras le premier.'
        : count === 1
          ? '1 personne participe déjà.'
          : `${count} personnes participent déjà.`,
  },

  /** É5a — vote d'une catégorie. */
  voting: {
    yes: 'Oui',
    maybe: 'Peut-être',
    no: 'Non',
    groupLabel: (option: string) => `Ton vote pour ${option}`,
    /** Annonces de la région aria-live (doc 05 §5.5). */
    recorded: (option: string, choice: string) =>
      `Vote enregistré : ${choice} pour ${option}`,
    retracted: (option: string) => `Vote retiré pour ${option}`,
    proposedBy: (name: string) => `proposé par ${name}`,
    tally: (yes: number, maybe: number, no: number) =>
      `${yes} oui · ${maybe} ~ · ${no} non`,
    blocking: (count: number) =>
      count === 1
        ? 'Ne convient pas à 1 personne'
        : `Ne convient pas à ${count} personnes`,
    blindNotice: 'Vote à l’aveugle : les résultats apparaîtront après ton vote.',
    resort: 'Reclasser',
    closed: 'Cette catégorie est clôturée. Les votes n’y sont plus modifiables.',
    progress: (voted: number, total: number) =>
      `Tu t’es prononcé sur ${voted} proposition${voted > 1 ? 's' : ''} sur ${total}.`,
    allVoted: 'Tu t’es prononcé sur tout 🎉',
  },

  /** Ajout de proposition inline. */
  addOption: {
    open: 'Proposer une destination',
    titleLabel: 'Ta proposition',
    titlePlaceholder: 'Lisbonne',
    urlLabel: 'Un lien (facultatif)',
    urlPlaceholder: 'https://…',
    submit: 'Ajouter',
    submitting: 'Ajout…',
    cancel: 'Annuler',
    errorTitleRequired: 'Donne un nom à ta proposition.',
    errorUrl: 'Ce lien doit commencer par http:// ou https://.',
  },

  trip: {
    share: 'Partager',
    noCategories: 'Ce sondage n’a encore rien à décider.',
  },

  /** Écrans pas encore construits — remplacés au fil des sprints. */
  soon: {
    badge: 'Bientôt',
    body: 'Cet écran arrive dans un prochain sprint.',
    results: 'Le récapitulatif arrive au sprint 7.',
    settings: 'Les réglages arrivent au sprint 7.',
    myTrips: 'La liste de tes sondages arrive au sprint 3.',
  },
} as const
