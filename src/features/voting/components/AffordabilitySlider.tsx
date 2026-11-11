import { useId, useState } from 'react'
import { comfortableStep, followersAt, formatEuros } from '@/lib/budget'
import { labels } from '@/lib/labels'
import type { BudgetCurvePoint } from '@/types/domain'

/**
 * Le curseur d'accessibilité (doc 05 §5.3 5.c, tâche 4.3).
 *
 * « À 750 €, 7 personnes sur 8 suivent » — combien, jamais qui. Le composant
 * ne **peut pas** nommer quelqu'un : il ne reçoit qu'une courbe de paliers,
 * sans identifiant ni prénom. La garantie est dans ses props.
 *
 * Un `<input type="range">` natif : clavier, lecteur d'écran et tactile sont
 * gérés par le navigateur, et `aria-valuetext` lui fait dire la phrase entière
 * plutôt qu'un nombre nu.
 */
export function AffordabilitySlider({
  curve,
  step,
  respondents,
}: {
  curve: BudgetCurvePoint[]
  step: number
  respondents: number
}) {
  const id = useId()
  const min = curve[0]?.amount ?? 0
  const max = curve.at(-1)?.amount ?? min
  // On ouvre sur le plus haut montant que tout le monde suit : la bonne
  // nouvelle d'abord, pas un chiffre qui exclut déjà quelqu'un.
  const [amount, setAmount] = useState(() => comfortableStep(curve, respondents) ?? min)

  const sentence = labels.budget.affordability(
    formatEuros(amount),
    followersAt(curve, amount),
    respondents,
  )

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="font-medium">
        {labels.budget.sliderLabel}
      </label>

      <input
        id={id}
        type="range"
        className="h-11 w-full accent-[var(--color-brand)]"
        min={min}
        max={max}
        step={step}
        value={amount}
        aria-valuetext={sentence}
        onChange={(event) => setAmount(Number(event.target.value))}
      />

      <div aria-hidden="true" className="flex justify-between text-sm text-text-muted">
        <span>{formatEuros(min)}</span>
        <span>{formatEuros(max)}</span>
      </div>

      <p className="text-lg font-semibold" aria-live="polite">
        {sentence}
      </p>
    </div>
  )
}
