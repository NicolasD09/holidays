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
    noDateWindow: 'Cette catégorie n’a pas de période de recherche.',
  },

  /** Noms des catégories, partagés entre la création, le hub et les réglages. */
  categories: {
    destination: 'Destination',
    dates: 'Dates',
    budget: 'Budget',
    lodging: 'Logement',
    activity: 'Activités',
    custom: 'Autre…',
  },

  /** Modes de vote — libellé court, et ce que ça change pour le votant. */
  voteModes: {
    approval: {
      label: 'Approbation',
      hint: 'Chacun dit oui, peut-être ou non sur chaque proposition.',
    },
    single: { label: 'Choix unique', hint: 'Chacun ne retient qu’une seule proposition.' },
    multiple: {
      label: 'Choix multiple',
      hint: 'Chacun en retient plusieurs, avec un plafond si tu veux.',
    },
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
    categoryHint:
      'La destination est toujours là. Coche ce que vous voulez décider en plus.',
    categorySoon: 'Bientôt',
    categorySoonHint: 'Le budget arrive dans un prochain sprint.',
    datesWindowLabel: 'Entre quelles dates on cherche ?',
    datesFrom: 'À partir du',
    datesTo: 'Jusqu’au',
    datesNights: 'Combien de nuits ?',
    datesNightsSuffix: 'nuits',
    datesHint:
      'Chacun peindra ses disponibilités sur cette période, et l’app classera les meilleurs créneaux.',
    categoryLocked: 'Toujours incluse',
    customLabelField: 'Nom de la catégorie',
    customLabelPlaceholder: 'Restaurant du dernier soir',
    customModeLabel: 'Comment on vote',
    invalid_date_window: 'Choisis une période valide (jusqu’à 400 jours).',
    invalid_nights: 'Indique une durée entre 1 et 60 nuits.',
    window_too_short: 'La période est plus courte que le séjour demandé.',
    errorCustomLabelRequired: 'Donne un nom à ta catégorie, ou décoche-la.',
    errorCustomLabelTooLong: '60 caractères maximum.',
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
    /** Modes `single` et `multiple` : on retient une proposition, on ne la note pas. */
    choose: 'Je choisis',
    chosen: 'Mon choix',
    keep: 'Je retiens',
    kept: 'Retenu',
    chooseLabel: (option: string) => `Choisir ${option}`,
    keepLabel: (option: string) => `Retenir ${option}`,
    votes: (count: number) =>
      count === 0 ? 'aucune voix' : count === 1 ? '1 voix' : `${count} voix`,
    singleHint: 'Une seule proposition : en choisir une autre remplace ton choix.',
    multipleHint: (max: number | null) =>
      max === null
        ? 'Tu peux en retenir autant que tu veux.'
        : `Tu peux en retenir ${max} au maximum.`,
    multipleRemaining: (left: number) =>
      left === 0
        ? 'Tu as utilisé tous tes choix. Retires-en un pour en retenir un autre.'
        : left === 1
          ? 'Il te reste 1 choix.'
          : `Il te reste ${left} choix.`,
    blindNotice: 'Vote à l’aveugle : les résultats apparaîtront après ton vote.',
    resort: 'Reclasser',
    closed: 'Cette catégorie est clôturée. Les votes n’y sont plus modifiables.',
    progress: (voted: number, total: number) =>
      `Tu t’es prononcé sur ${voted} proposition${voted > 1 ? 's' : ''} sur ${total}.`,
    allVoted: 'Tu t’es prononcé sur tout 🎉',
  },

  /** É5b — grille de disponibilités (doc 05 §5.3 5.b). */
  availability: {
    window: (from: string, to: string, nights: number) =>
      `Recherche du ${from} au ${to}, pour ${nights} nuit${nights > 1 ? 's' : ''}.`,
    brushLabel: 'Ton pinceau',
    brushes: {
      yes: 'Dispo',
      maybe: 'Peut-être',
      no: 'Pas dispo',
      erase: 'Gomme',
    },
    hint: 'Choisis un pinceau, puis peins tes jours. Glisse le doigt pour en peindre plusieurs d’un coup.',
    gridLabel: 'Calendrier de tes disponibilités',
    allAvailable: 'Tout dispo',
    clearAll: 'Effacer',
    statuses: {
      yes: 'disponible',
      maybe: 'peut-être disponible',
      no: 'pas disponible',
    },
    statusUnset: 'non renseigné',
    /**
     * Le libellé complet d'une case, tel qu'un lecteur d'écran l'annonce.
     * L'initiale de colonne ne suffit pas : la date entière est dans le label.
     */
    dayLabel: (day: string, status: string, others: string | null) =>
      others === null ? `${day}, ${status}` : `${day}, ${status}, ${others}`,
    density: (available: number, total: number) =>
      `${available} personne${available > 1 ? 's' : ''} sur ${total} disponible${available > 1 ? 's' : ''}`,
    /** Annonces de la région aria-live après un coup de pinceau. */
    announceDay: (day: string, brush: string) => `${day} : ${brush}`,
    /** Bascule grille ↔ liste (doc 05 §5.5). */
    listView: 'Voir en liste',
    gridView: 'Voir la grille',
    listHint: 'Retape le même choix pour effacer le jour.',
    dayGroupLabel: (day: string) => `Ta disponibilité le ${day}`,
    announceStroke: (count: number, brush: string) =>
      `${count} jour${count > 1 ? 's' : ''} peint${count > 1 ? 's' : ''} : ${brush}`,
    failed:
      'Impossible d’enregistrer tes disponibilités. Vérifie ta connexion et réessaie.',
    /**
     * Aucune formulation ne suggère de retard : on dit qui a répondu, jamais
     * qui manquerait à l'appel (ADR-009, doc 05 §5.1-5).
     */
    respondents: (count: number) =>
      count === 0
        ? 'Personne n’a encore renseigné ses disponibilités.'
        : count === 1
          ? '1 personne a renseigné ses disponibilités.'
          : `${count} personnes ont renseigné leurs disponibilités.`,
  },

  /** Classement des créneaux, sous la grille (doc 05 §5.3 5.b). */
  ranking: {
    title: 'Les meilleurs créneaux',
    empty: 'Le classement apparaîtra dès que quelqu\u2019un aura renseigné ses disponibilités.',
    none: 'Aucun créneau de cette durée ne tient dans la période de recherche.',
    top: 'En tête',
    counts: (available: number, tentative: number) => {
      const sure =
        available === 0 ? 'Personne de certain' : `${available} dispo${available > 1 ? 's' : ''}`
      return tentative === 0 ? sure : `${sure} \u00b7 ${tentative} peut-être`
    },
    /**
     * Nommer qui bloque un créneau est factuel : sans le nom, l'information
     * n'est pas exploitable. Aucune notion de retard (ADR-009).
     */
    blocked: (names: string[]) =>
      names.length === 1
        ? `${names[0]} n\u2019est pas dispo.`
        : `${names.slice(0, -1).join(', ')} et ${names.at(-1)} ne sont pas dispo.`,
  },

  /** Ajout de proposition inline. */
  addOption: {
    // Générique depuis le sprint 3 : ce champ sert dans toutes les catégories,
    // pas seulement la destination.
    open: 'Ajouter une proposition',
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

  /** É4 — hub du sondage. */
  hub: {
    /**
     * Bandeau de progression. Aucune formulation ne doit suggérer du retard :
     * on montre où en est le groupe, jamais qu'il serait en retard
     * (doc 05 §5.1-5).
     */
    progress: (done: number, total: number) =>
      `Tu as répondu à ${done} catégorie${done > 1 ? 's' : ''} sur ${total}.`,
    upToDate: 'Tu es à jour 🎉',
    upToDateWithMissing: (names: string[]) =>
      names.length === 1
        ? `Tu es à jour 🎉 — il manque encore ${names[0]}.`
        : `Tu es à jour 🎉 — il manque encore ${names.slice(0, -1).join(', ')} et ${names.at(-1)}.`,
    continue: 'Continuer à voter',
    seeResults: 'Voir le récap',
    statusToVote: 'À voter',
    statusVoted: 'Voté',
    statusClosed: 'Clôturée',
    options: (count: number) =>
      count === 0
        ? 'Aucune proposition'
        : count === 1
          ? '1 proposition'
          : `${count} propositions`,
    participation: (voted: number, total: number) => `${voted}/${total} ont répondu`,
    leader: (title: string) => `En tête : ${title}`,
    noOptionsYet: 'Personne n’a encore rien proposé ici.',
    /** Catégorie dates : ni proposition à compter, ni meneur tant que rien n'est peint. */
    stayLength: (nights: number | null) =>
      nights === null ? 'Dates du séjour' : `Séjour de ${nights} nuit${nights > 1 ? 's' : ''}`,
    noAvailabilityYet: 'Personne n’a encore renseigné ses disponibilités.',
    organizerNudge:
      'Aucune proposition pour l’instant. Ouvre une catégorie et lance la première.',
    settings: 'Réglages',
  },

  /** Barre de navigation basse, entre catégories. */
  categoryNav: {
    previous: 'Précédent',
    next: 'Suivant',
    position: (index: number, total: number) => `${index}/${total}`,
    backToHub: 'Toutes les catégories',
    ariaLabel: 'Navigation entre les catégories',
  },

  /** `/mine` — les sondages vus depuis cet appareil. */
  myTrips: {
    title: 'Mes sondages',
    subtitle: 'Les sondages ouverts depuis ce téléphone ou ce navigateur.',
    empty: 'Aucun sondage sur cet appareil pour l’instant.',
    emptyHint:
      'Les sondages créés ou rejoints avant aujourd’hui n’y sont pas : cette liste commence maintenant.',
    forget: 'Retirer de la liste',
    forgetLabel: (title: string) => `Retirer ${title} de la liste`,
    localOnly: 'Cette liste ne quitte jamais cet appareil.',
  },

  /** É7 partiel — réglages des catégories (le reste arrive au sprint 7). */
  categorySettings: {
    title: 'Réglages des catégories',
    subtitle: 'Tu es l’organisateur : toi seul vois cet écran.',
    labelField: 'Nom de la catégorie',
    modeField: 'Comment on vote',
    maxChoicesField: 'Nombre de choix maximum',
    maxChoicesHint: 'Laisse vide pour ne pas plafonner.',
    allowOptions: 'Les participants peuvent proposer',
    allowOptionsHint:
      'Décoché, seul toi peux ajouter des propositions dans cette catégorie.',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    moveUpLabel: (label: string) => `Monter ${label}`,
    moveDownLabel: (label: string) => `Descendre ${label}`,
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    votesWarning:
      'Des votes existent déjà ici. Changer le mode ne les efface pas, mais ils peuvent devenir incohérents — par exemple plusieurs choix dans une catégorie passée en choix unique.',
    restSoon: 'Le titre du sondage, les participants et la clôture arrivent au sprint 7.',
    errorLabelRequired: 'Donne un nom à la catégorie.',
    errorMaxChoices: 'Indique un nombre supérieur à zéro.',
  },

  /** Zone sensible de l'écran de réglages (doc 05 §5.3 É7). */
  danger: {
    title: 'Zone sensible',
    deleteCta: 'Supprimer ce sondage',
    dialogTitle: 'Supprimer définitivement ce sondage ?',
    /** Dire ce qui part, pour tout le monde, et que rien ne revient. */
    consequences:
      'Le sondage, ses catégories, toutes les propositions et tous les votes seront effacés — pour toi comme pour les autres participants. Le lien cessera de fonctionner. Cette action est définitive : il n’y a pas de corbeille.',
    confirmPrompt: (title: string) => `Pour confirmer, écris le titre du sondage : ${title}`,
    confirmLabel: 'Titre du sondage',
    cancel: 'Annuler',
    confirm: 'Supprimer définitivement',
    deleting: 'Suppression…',
    mismatch: 'Le titre ne correspond pas.',
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
