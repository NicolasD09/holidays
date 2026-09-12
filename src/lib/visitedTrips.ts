/**
 * Les sondages vus depuis **cet appareil** (tâche 2.6).
 *
 * Rien ne part au serveur : la liste est purement locale, et c'est voulu. Une
 * liste côté serveur voudrait dire relier entre eux les sondages d'un même
 * appareil — exactement ce que le modèle « un lien = une capacité » évite.
 *
 * Trois précautions, toutes dictées par Safari iOS :
 * - `localStorage` peut **lever** en navigation privée, y compris en lecture ;
 * - son contenu peut avoir été écrit par une version précédente, ou à la
 *   main : on ne fait jamais confiance à sa forme ;
 * - une écriture qui échoue ne doit jamais empêcher de créer un sondage.
 *
 * D'où : tout est enveloppé, et l'échec est silencieux. Une liste vide est un
 * résultat acceptable ; une page blanche, non.
 */

const STORAGE_KEY = 'holidays.visited-trips'
/** Au-delà, on oublie les plus anciens : personne ne remonte à 50 sondages. */
const MAX_ENTRIES = 30

export type VisitedTrip = {
  slug: string
  title: string
  emoji: string | null
  /** ISO 8601. Sert au tri, du plus récent au plus ancien. */
  lastSeenAt: string
}

function isVisitedTrip(value: unknown): value is VisitedTrip {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.slug === 'string' &&
    candidate.slug.length > 0 &&
    typeof candidate.title === 'string' &&
    typeof candidate.lastSeenAt === 'string' &&
    (candidate.emoji === null || typeof candidate.emoji === 'string')
  )
}

export function readVisitedTrips(): VisitedTrip[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isVisitedTrip)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  } catch {
    // Stockage indisponible, JSON illisible, quota : dans tous les cas la
    // bonne réponse est « aucun sondage connu sur cet appareil ».
    return []
  }
}

/** Enregistre ou rafraîchit un sondage. Idempotent sur le slug. */
export function rememberTrip(trip: Omit<VisitedTrip, 'lastSeenAt'>): void {
  try {
    const others = readVisitedTrips().filter((item) => item.slug !== trip.slug)
    const next = [{ ...trip, lastSeenAt: new Date().toISOString() }, ...others].slice(
      0,
      MAX_ENTRIES,
    )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Écrire est un confort, jamais une condition : on n'interrompt pas une
    // création de sondage parce que l'historique local est indisponible.
  }
}

export function forgetTrip(slug: string): void {
  try {
    const next = readVisitedTrips().filter((item) => item.slug !== slug)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Voir ci-dessus.
  }
}
