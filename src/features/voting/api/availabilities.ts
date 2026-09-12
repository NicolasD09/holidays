import { z } from 'zod'
import type { AvailabilityEntry } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import { availabilityStatuses, type AvailabilityStatus } from '@/types/domain'

/**
 * Lecture et écriture des disponibilités d'une catégorie dates (doc 03 §3.5,
 * tâches 3.1 et 3.3).
 *
 * Deux choses à savoir sur ce fichier, et elles expliquent tout le reste :
 *
 * 1. **La lecture ne connaît pas le mode aveugle.** Contrairement à
 *    `fetchCategoryResults`, qui doit rattraper un `blind_mode_active`, il n'y
 *    a rien à rattraper ici : la policy `availabilities_select` renvoie
 *    simplement moins de lignes quand on n'a pas encore peint. Pas d'erreur,
 *    pas de `null`, pas de cas particulier — la règle vit en base (ADR-007) et
 *    l'écran affiche ce qu'il reçoit.
 *
 * 2. **L'écriture se fait par lot.** `app_set_availability` prend un tableau de
 *    jours parce que c'est ce qu'un glissement du doigt produit : douze jours
 *    d'un coup, pas douze appels. Un `status` nul efface le jour — c'est le
 *    pinceau gomme, et c'est aussi le bouton « Effacer ».
 */

/** Un jour envoyé au serveur. `status: null` **efface** le jour. */
export type AvailabilityDraft = {
  /** `YYYY-MM-DD`. */
  day: string
  status: AvailabilityStatus | null
}

/** Ce que `app_set_availability` renvoie : de quoi vérifier qu'un lot a porté. */
export type AvailabilityOutcome = {
  written: number
  cleared: number
}

/**
 * `date` revient de PostgREST en `YYYY-MM-DD`, jamais en ISO complet. On le
 * vérifie plutôt que de le supposer : `lib/scoring.ts` fait de l'arithmétique
 * sur ces chaînes, et un format inattendu y produirait un `NaN` silencieux
 * plutôt qu'une erreur.
 */
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'jour attendu au format YYYY-MM-DD')

const rowsSchema = z.array(
  z.object({
    participant_id: z.uuid(),
    day: isoDay,
    status: z.enum(availabilityStatuses),
  }),
)

const outcomeSchema = z.object({
  written: z.number().int(),
  cleared: z.number().int(),
})

/**
 * Toutes les disponibilités visibles d'une catégorie — les miennes, et celles
 * des autres si le mode aveugle le permet.
 *
 * Renvoie directement la forme qu'attend `rankWindows` : le classement des
 * créneaux consomme ce tableau sans transformation, et c'est la seule
 * conversion `snake_case` → `camelCase` du parcours.
 */
export async function listAvailabilities(categoryId: string): Promise<AvailabilityEntry[]> {
  const { data, error } = await supabase
    .from('availabilities')
    .select('participant_id, day, status')
    .eq('category_id', categoryId)

  if (error) throw error

  return rowsSchema.parse(data).map((row) => ({
    participantId: row.participant_id,
    day: row.day,
    status: row.status,
  }))
}

/**
 * Enregistre un lot de jours — RPC `app_set_availability`.
 *
 * Le serveur refuse le lot **en bloc** si un seul jour sort de la fenêtre
 * (`day_out_of_window`) : c'est tout ou rien, donc le retour arrière optimiste
 * l'est aussi. Un lot vide n'est pas envoyé — relâcher le doigt sans avoir rien
 * peint ne doit pas produire d'appel réseau.
 */
export async function setAvailability(
  categoryId: string,
  days: AvailabilityDraft[],
): Promise<AvailabilityOutcome> {
  if (days.length === 0) return { written: 0, cleared: 0 }

  const { data, error } = await supabase.rpc('app_set_availability', {
    p_category: categoryId,
    p_days: days,
  })

  if (error) throw error

  return outcomeSchema.parse(data)
}
