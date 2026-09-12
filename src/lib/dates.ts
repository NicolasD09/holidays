/**
 * Calendrier et formatage de dates, sans librairie (tâches 3.3 et 3.6).
 *
 * Même règle que `lib/scoring.ts`, et pour la même raison : arithmétique **UTC**
 * sur des chaînes `YYYY-MM-DD`. `new Date('2027-07-01')` est interprété comme
 * minuit UTC, et les fonctions `getUTC*` ignorent les heures d'été. Un
 * calendrier construit en heure locale décalerait d'un jour pour la moitié de
 * l'Europe une nuit de fin mars.
 *
 * Le formatage passe par `Intl` — présent partout, et déjà chargé par le
 * navigateur. Aucune dépendance ajoutée.
 */

const DAY_MS = 86_400_000

/*
  Les formateurs sont déclarés **avant** tout ce qui les utilise : `weekdayHeaders`
  s'évalue au chargement du module, et un `const` plus bas dans le fichier serait
  encore dans sa zone morte temporelle à ce moment-là. Les déclarer ici plutôt
  qu'en pied de fichier est la seule position sûre.

  Ils sont construits une fois pour toutes : `Intl.DateTimeFormat` coûte cher à
  instancier, et la grille formate plusieurs centaines de dates.
*/
const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const shortDayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const dayOnlyFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const narrowWeekdayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'narrow',
  timeZone: 'UTC',
})

const longWeekdayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  timeZone: 'UTC',
})

export function toUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

export function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

export function addDays(time: number, days: number): number {
  return time + days * DAY_MS
}

/** Une semaine de la grille : 7 cases, lundi → dimanche. `null` = hors fenêtre. */
export type CalendarWeek = (string | null)[]

export type CalendarMonth = {
  /** `2027-07`, stable — sert de clé React. */
  key: string
  /** « juillet 2027 ». */
  label: string
  weeks: CalendarWeek[]
}

/**
 * Tous les jours de la fenêtre, dans l'ordre. Sert aux actions rapides
 * (« Tout dispo », « Effacer ») et au déplacement au clavier.
 */
export function daysInWindow(windowStart: string, windowEnd: string): string[] {
  const first = toUtc(windowStart)
  const last = toUtc(windowEnd)
  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return []

  const days: string[] = []
  for (let time = first; time <= last; time = addDays(time, 1)) days.push(toIso(time))
  return days
}

/**
 * Découpe la fenêtre en mois affichables, semaine par semaine.
 *
 * Les cases hors fenêtre sont `null` plutôt qu'absentes : la grille garde ses
 * 7 colonnes alignées, et un jour reste sous le même doigt d'un mois à l'autre.
 */
export function buildCalendar(windowStart: string, windowEnd: string): CalendarMonth[] {
  const first = toUtc(windowStart)
  const last = toUtc(windowEnd)
  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return []

  const months: CalendarMonth[] = []
  const start = new Date(first)
  let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)

  while (cursor <= last) {
    const year = new Date(cursor).getUTCFullYear()
    const month = new Date(cursor).getUTCMonth()
    // Le jour 0 du mois suivant est le dernier jour de celui-ci.
    const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    const weeks: CalendarWeek[] = []
    let week: CalendarWeek = emptyWeek()

    for (let dayOfMonth = 1; dayOfMonth <= dayCount; dayOfMonth += 1) {
      const time = Date.UTC(year, month, dayOfMonth)
      const column = mondayIndex(new Date(time).getUTCDay())

      if (column === 0 && dayOfMonth > 1) {
        weeks.push(week)
        week = emptyWeek()
      }

      week[column] = time >= first && time <= last ? toIso(time) : null
    }
    weeks.push(week)

    months.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: monthFormatter.format(cursor),
      weeks,
    })

    cursor = Date.UTC(year, month + 1, 1)
  }

  return months
}

/** « mardi 14 juillet » — ce qu'annonce un lecteur d'écran sur la case. */
export function formatDay(day: string): string {
  return dayFormatter.format(toUtc(day))
}

/** « 14 » — ce qu'on lit dans la case. */
export function formatDayNumber(day: string): string {
  return String(new Date(toUtc(day)).getUTCDate())
}

/** « sam. 11 juillet » — format court, pour le classement des créneaux. */
export function formatShortDay(day: string): string {
  return shortDayFormatter.format(toUtc(day))
}

/**
 * Un créneau, en toutes lettres : « sam. 11 → sam. 18 juillet ».
 *
 * Le mois n'est écrit qu'une fois quand les deux bornes le partagent — c'est ce
 * que le doc 05 §5.3 5.b donne en exemple, et ce qu'on écrirait à la main. À
 * cheval sur deux mois, les deux sont nommés : « sam. 28 juin → sam. 5 juillet ».
 */
export function formatRange(start: string, end: string): string {
  const from = toUtc(start)
  const to = toUtc(end)
  if (Number.isNaN(from) || Number.isNaN(to)) return ''

  const sameMonth =
    new Date(from).getUTCFullYear() === new Date(to).getUTCFullYear() &&
    new Date(from).getUTCMonth() === new Date(to).getUTCMonth()

  const left = sameMonth ? dayOnlyFormatter.format(from) : shortDayFormatter.format(from)
  return `${left} \u2192 ${shortDayFormatter.format(to)}`
}

/**
 * Les sept en-têtes de colonne. L'initiale seule ne suffit pas — deux « M »,
 * deux « S » — donc chaque en-tête porte aussi son nom complet pour les
 * lecteurs d'écran.
 *
 * Le 2024-01-01 était un lundi : il sert d'origine pour laisser `Intl` nommer
 * les jours plutôt que de les écrire en dur.
 */
export const weekdayHeaders: { key: string; narrow: string; long: string }[] = Array.from(
  { length: 7 },
  (_, index) => {
    const time = Date.UTC(2024, 0, 1 + index)
    return {
      key: String(index),
      narrow: narrowWeekdayFormatter.format(time),
      long: longWeekdayFormatter.format(time),
    }
  },
)

/** `Date.getUTCDay()` compte à partir de dimanche ; la grille part du lundi. */
function mondayIndex(utcDay: number): number {
  return (utcDay + 6) % 7
}

function emptyWeek(): CalendarWeek {
  return [null, null, null, null, null, null, null]
}
