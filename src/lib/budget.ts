import type { BudgetCurvePoint } from '@/types/domain'

/**
 * Calculs du budget, purs (doc 04 §4.7 : cœur métier, couverture 100 %).
 *
 * Tout ce qui est ici travaille sur des **agrégats** déjà calculés par
 * `app_budget_summary`. Aucune fonction ne reçoit de montant individuel, et
 * ce n'est pas un hasard : le navigateur n'en reçoit jamais (ADR-006).
 */

/** Bornes de `budget_answers.amount` — les mêmes que la contrainte de table. */
export const BUDGET_MIN = 0
export const BUDGET_MAX = 1_000_000

const euros = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** « 1 200 € » — jamais de centimes : on parle d'un budget, pas d'un ticket. */
export function formatEuros(amount: number): string {
  return euros.format(amount)
}

/**
 * Saisie → montant entier, ou `null` si ce n'en est pas un.
 *
 * Tolère ce qu'un clavier de téléphone produit vraiment : espaces (y compris
 * insécables) en séparateur de milliers, et un « € » collé derrière. Refuse
 * les décimales plutôt que de les arrondir en silence — « 750,50 » arrondi à
 * 750 ou à 751, c'est une décision qu'on n'a pas à prendre pour quelqu'un.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '').replace(/€$/, '')
  if (!/^\d+$/.test(cleaned)) return null

  const amount = Number(cleaned)
  if (amount < BUDGET_MIN || amount > BUDGET_MAX) return null
  return amount
}

/**
 * Combien de personnes suivent à ce montant.
 *
 * La courbe est en paliers : entre deux paliers, on prend celui **du
 * dessus**. C'est le seul arrondi honnête — annoncer « 7 suivent » à 760 €
 * d'après le palier de 750 € serait faux pour quelqu'un dont le maximum est
 * 755 €. Dans le doute, on sous-compte.
 */
export function followersAt(curve: BudgetCurvePoint[], amount: number): number {
  for (const point of curve) {
    if (point.amount >= amount) return point.followers
  }
  return 0
}

/**
 * Le plus haut palier que **tout le monde** peut suivre.
 *
 * C'est la valeur de départ du curseur : on ouvre sur la bonne nouvelle, pas
 * sur un montant qui exclut déjà quelqu'un.
 */
export function comfortableStep(curve: BudgetCurvePoint[], respondents: number): number | null {
  let best: number | null = null
  for (const point of curve) {
    if (point.followers >= respondents) best = point.amount
  }
  return best
}
