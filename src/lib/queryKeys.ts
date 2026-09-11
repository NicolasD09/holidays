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
  options: (categoryId: string) => ['category', categoryId, 'options'] as const,
  results: (categoryId: string) => ['category', categoryId, 'results'] as const,
  myVotes: (categoryId: string) => ['category', categoryId, 'my-votes'] as const,
  comments: (optionId: string) => ['option', optionId, 'comments'] as const,
} as const
