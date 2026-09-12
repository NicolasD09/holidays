/**
 * Fabrique centralisée des clés de cache TanStack Query (doc 04 §4.5).
 *
 * Une seule source pour les clés : c'est ce qui permet aux événements temps
 * réel d'invalider précisément la bonne requête, sans deviner la forme de la
 * clé à l'autre bout du code.
 */
export const qk = {
  trip: (slug: string) => ['trip', slug] as const,
  tripPreview: (slug: string) => ['trip', slug, 'preview'] as const,
  categories: (tripId: string) => ['trip', tripId, 'categories'] as const,
  participants: (tripId: string) => ['trip', tripId, 'participants'] as const,
  /** Agrégat du hub : propositions, votants et meneur par catégorie. */
  progress: (tripId: string) => ['trip', tripId, 'progress'] as const,
  /** Ma fiche de participant sur ce sondage — l'identité de cet appareil. */
  me: (tripId: string) => ['trip', tripId, 'participants', 'me'] as const,
  options: (categoryId: string) => ['category', categoryId, 'options'] as const,
  results: (categoryId: string) => ['category', categoryId, 'results'] as const,
  myVotes: (categoryId: string) => ['category', categoryId, 'my-votes'] as const,
  /**
   * Les disponibilités d'une catégorie dates : les miennes **et** celles des
   * autres, dans la même requête. Une seule clé suffit parce que la policy
   * `availabilities_select` filtre déjà pour nous — en mode aveugle, la même
   * requête renvoie simplement moins de lignes.
   */
  availabilities: (categoryId: string) => ['category', categoryId, 'availabilities'] as const,
  comments: (optionId: string) => ['option', optionId, 'comments'] as const,
} as const
