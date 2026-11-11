import { formatEuros } from '@/lib/budget'
import { formatCompactRange, formatRange } from '@/lib/dates'
import type { Category, CloseChoice, Decision } from '@/types/domain'

/**
 * Tout ce qui transforme une décision en mots, et un choix en appel de RPC.
 * Pur : le récap, le hub, l'écran de vote et le message partagé disent la
 * même chose parce qu'ils passent tous ici.
 */

/** Longueur d'un élément du bandeau de synthèse avant d'être coupé. */
export const SUMMARY_ITEM_MAX = 32

/** Le texte limite que la base accepte pour une décision libre. */
export const DECISION_TEXT_MAX = 200

/**
 * La décision, en toutes lettres.
 *
 * Le budget prend un « ~ » : c'est un ordre de grandeur pour le groupe, pas
 * un prix (doc 05 §5.3 É6 — « 💶 ~750 € »).
 */
export function describeDecision(decision: Decision, { compact = false } = {}): string {
  if (decision.freeText) return decision.freeText
  if (decision.range) {
    const { start, end } = decision.range
    return compact ? formatCompactRange(start, end) : formatRange(start, end)
  }
  if (decision.amount !== null) return `~${formatEuros(decision.amount)}`
  return decision.title ?? ''
}

/**
 * Le bandeau du récap : une décision par catégorie tranchée, dans l'ordre du
 * sondage, chacune précédée de l'emoji de sa catégorie.
 *
 * Il doit tenir **en une ligne lisible** (recette du sprint 7, étape 5) : un
 * texte libre peut faire 200 caractères, donc chaque élément est coupé, et
 * les dates prennent leur forme courte. À l'écran, sur un téléphone étroit,
 * le bandeau peut passer à la ligne — mais seulement **entre** deux éléments,
 * jamais entre un emoji et sa décision : d'où les éléments séparés.
 */
export function summaryItems(
  categories: Category[],
  decisions: Decision[],
  emojiOf: (category: Category) => string,
): string[] {
  const byCategory = new Map(decisions.map((decision) => [decision.categoryId, decision]))

  return categories.flatMap((category) => {
    const decision = byCategory.get(category.id)
    if (!decision || category.status !== 'closed') return []
    const text = truncate(describeDecision(decision, { compact: true }), SUMMARY_ITEM_MAX)
    return [`${emojiOf(category)} ${text}`]
  })
}

/** Le bandeau en une chaîne — c'est la ligne du message partagé. */
export function summaryLine(
  categories: Category[],
  decisions: Decision[],
  emojiOf: (category: Category) => string,
): string {
  return summaryItems(categories, decisions, emojiOf).join(' · ')
}

export function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

/**
 * Un choix de l'écran → arguments de `app_close_category`.
 *
 * Les arguments absents ne sont **pas envoyés**, plutôt qu'envoyés à `null` :
 * la RPC les déclare `default null`, et c'est l'absence qui dit « pas cette
 * forme-là ».
 */
export function toCloseArgs(
  categoryId: string,
  choice: CloseChoice,
): {
  p_category: string
  p_option?: string
  p_free_text?: string
  p_payload?: { start: string; end: string } | { amount: number }
} {
  switch (choice.kind) {
    case 'option':
      return { p_category: categoryId, p_option: choice.optionId }
    case 'range':
      return { p_category: categoryId, p_payload: { start: choice.start, end: choice.end } }
    case 'amount':
      return { p_category: categoryId, p_payload: { amount: choice.amount } }
    case 'text':
      return { p_category: categoryId, p_free_text: choice.text.trim() }
  }
}

/** Le choix est-il envoyable tel quel ? L'écran désactive le bouton sinon. */
export function isCompleteChoice(choice: CloseChoice | null): choice is CloseChoice {
  if (!choice) return false
  if (choice.kind === 'text') {
    const text = choice.text.trim()
    return text.length > 0 && text.length <= DECISION_TEXT_MAX
  }
  if (choice.kind === 'amount') {
    return Number.isInteger(choice.amount) && choice.amount >= 0 && choice.amount <= 1_000_000
  }
  return true
}
