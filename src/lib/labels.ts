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
    voteFailed: 'Impossible d’enregistrer ton vote. Vérifie ta connexion et réessaie.',
    offline: 'Connexion perdue — tes derniers votes ne sont peut-être pas enregistrés.',
  },

  loading: {
    default: 'Chargement…',
  },

  empty: {
    noOptions: 'Aucune proposition pour l’instant. Lance-toi !',
  },

  /** Écrans pas encore construits — remplacés au fil des sprints. */
  soon: {
    badge: 'Bientôt',
    body: 'Cet écran arrive dans un prochain sprint.',
    createTrip: 'La création de sondage arrive au sprint 2.',
    tripHub: 'Le tableau de bord du sondage arrive au sprint 3.',
    category: 'L’écran de vote arrive au sprint 2.',
    results: 'Le récapitulatif arrive au sprint 7.',
    settings: 'Les réglages arrivent au sprint 7.',
    myTrips: 'La liste de tes sondages arrive au sprint 3.',
  },
} as const
