import { QueryClient } from '@tanstack/react-query'

/**
 * Cache unique pour toute la durée de vie de l'application.
 *
 * `retry: 1` sur les requêtes : en cas d'échec réseau on retente une fois,
 * puis on rend la main à l'utilisateur avec un message actionnable plutôt que
 * de boucler en silence.
 * `retry: 0` sur les mutations : un vote qui échoue revient à son état
 * précédent et propose un bouton Réessayer (doc 04 §4.5).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
