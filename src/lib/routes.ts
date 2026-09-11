/**
 * Chemins de l'application (doc 04 §4.4). Centralisés pour qu'aucune URL ne
 * soit écrite en dur dans un composant.
 */
export const routes = {
  home: '/',
  createTrip: '/new',
  myTrips: '/mine',
  trip: (slug: string) => `/t/${slug}`,
  category: (slug: string, categoryId: string) => `/t/${slug}/c/${categoryId}`,
  results: (slug: string) => `/t/${slug}/results`,
  settings: (slug: string) => `/t/${slug}/settings`,
} as const
