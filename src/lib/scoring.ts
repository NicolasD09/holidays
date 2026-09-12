import type { AvailabilityStatus } from '@/types/domain'

/**
 * Classement des créneaux de la catégorie dates (doc 02 §2.5, tâche 3.5).
 *
 * Fonction pure, sans réseau ni React : c'est la pièce du sprint 4 qui doit
 * être **prouvée** avant qu'on dessine la moindre grille. Couverture visée
 * 100 % (doc 06 §6.5).
 *
 * Aucune dépendance de dates. Tout se fait en UTC sur des chaînes
 * `YYYY-MM-DD` : `new Date('2027-07-01')` est interprété comme minuit UTC, et
 * `setUTCDate` ignore les heures d'été. Une librairie de dates ne servirait
 * ici qu'à réintroduire un risque de fuseau — et à peser sur le bundle.
 */

export type AvailabilityEntry = {
  participantId: string
  /** `YYYY-MM-DD`. */
  day: string
  status: AvailabilityStatus
}

export type WindowScore = {
  /** Premier jour du séjour, `YYYY-MM-DD`. */
  start: string
  /** Dernier jour du séjour — `start + nights` (doc 05 : « sam. 11 → sam. 18 »). */
  end: string
  score: number
  /** Participants disponibles sur toute la durée. */
  fullyAvailable: string[]
  /** Participants sans refus mais pas certains sur tout. */
  tentative: string[]
  /** Participants indisponibles au moins un jour — les absents nommés à l'écran. */
  blocked: string[]
}

export type RankInput = {
  /** Bornes de la fenêtre de recherche, incluses. */
  windowStart: string
  windowEnd: string
  /** Durée du séjour en nuits. Un séjour de N nuits occupe N + 1 jours. */
  nights: number
  availabilities: AvailabilityEntry[]
}

/**
 * Les répondants sont **déduits des disponibilités saisies**, jamais de la
 * liste des participants.
 *
 * Quelqu'un qui n'a rien peint n'a pas dit « je ne suis pas libre » : il n'a
 * rien dit. Le compter comme bloquant mettrait tous les créneaux à zéro tant
 * que le dernier retardataire n'a pas répondu — et transformerait le
 * classement en levier de pression, ce que le produit s'interdit (ADR-009).
 */
export function respondents(availabilities: AvailabilityEntry[]): string[] {
  return [...new Set(availabilities.map((entry) => entry.participantId))].sort()
}

/**
 * Classe tous les créneaux possibles, du meilleur au moins bon.
 *
 * Renvoie un tableau vide si la fenêtre ne peut pas contenir un séjour
 * entier — `app_create_trip` refuse déjà ce cas à la création, mais un
 * organisateur peut resserrer la fenêtre après coup.
 */
export function rankWindows({
  windowStart,
  windowEnd,
  nights,
  availabilities,
}: RankInput): WindowScore[] {
  if (nights < 1) return []

  const first = toUtc(windowStart)
  const last = toUtc(windowEnd)
  if (Number.isNaN(first) || Number.isNaN(last)) return []

  const span = daysBetween(first, last)
  if (span < nights) return []

  // Trié par identifiant pour que la sortie soit reproductible : deux appels
  // sur les mêmes données doivent donner exactement le même tableau.
  const painted = [...groupByParticipant(availabilities).entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )

  const windows: WindowScore[] = []

  for (let offset = 0; offset + nights <= span; offset += 1) {
    const start = addDays(first, offset)
    const end = addDays(start, nights)
    const days = daysOf(start, nights)

    const fullyAvailable: string[] = []
    const tentative: string[] = []
    const blocked: string[] = []

    for (const [participant, calendar] of painted) {
      const verdict = judge(calendar, days)
      if (verdict === 'blocked') blocked.push(participant)
      else if (verdict === 'full') fullyAvailable.push(participant)
      else tentative.push(participant)
    }

    windows.push({
      start: toIso(start),
      end: toIso(end),
      // Barème du doc 02 §2.5 : 2 si dispo partout, 1 si aucun refus, 0 sinon.
      score: fullyAvailable.length * 2 + tentative.length,
      fullyAvailable,
      tentative,
      blocked,
    })
  }

  return windows.sort(compareWindows)
}

/**
 * Départage, dans l'ordre :
 * 1. le meilleur score ;
 * 2. **le moins de gens bloqués**. À score égal, quatre personnes « peut-être »
 *    valent mieux que deux personnes sûres et deux absentes : le créneau qui
 *    n'exclut personne est toujours préférable ;
 * 3. le plus tôt, pour que l'ordre soit stable et reproductible.
 */
function compareWindows(a: WindowScore, b: WindowScore): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.blocked.length !== b.blocked.length) return a.blocked.length - b.blocked.length
  return a.start.localeCompare(b.start)
}

/**
 * Le sort d'un participant sur un créneau.
 *
 * Le doc 02 §2.5 énumère trois cas mais laisse un trou : le jour **non
 * renseigné**, qu'il qualifie d'« inconnu » sans dire comment le compter.
 * Tranché ici, et c'est l'unique endroit à changer si l'arbitrage évolue :
 * un jour inconnu **ne bloque pas** mais **ne confirme pas** — il vaut
 * « peut-être ». Sur une fenêtre de plusieurs mois, personne ne peint tout ;
 * compter l'inconnu comme un refus rendrait tous les créneaux nuls.
 */
function judge(
  painted: Map<string, AvailabilityStatus>,
  days: string[],
): 'full' | 'tentative' | 'blocked' {
  let allYes = true

  for (const day of days) {
    const status = painted.get(day)
    if (status === 'no') return 'blocked'
    if (status !== 'yes') allYes = false
  }

  return allYes ? 'full' : 'tentative'
}

function groupByParticipant(
  availabilities: AvailabilityEntry[],
): Map<string, Map<string, AvailabilityStatus>> {
  const byParticipant = new Map<string, Map<string, AvailabilityStatus>>()

  for (const entry of availabilities) {
    const days = byParticipant.get(entry.participantId) ?? new Map()
    days.set(entry.day, entry.status)
    byParticipant.set(entry.participantId, days)
  }

  return byParticipant
}

/** Les jours occupés par un séjour de `nights` nuits : `nights + 1` jours. */
function daysOf(start: number, nights: number): string[] {
  const days: string[] = []
  for (let index = 0; index <= nights; index += 1) days.push(toIso(addDays(start, index)))
  return days
}

const DAY_MS = 86_400_000

function toUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function addDays(time: number, days: number): number {
  return time + days * DAY_MS
}

function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS)
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}
