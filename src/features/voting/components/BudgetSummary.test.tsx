import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BudgetSummary } from '@/features/voting/components/BudgetSummary'
import { labels } from '@/lib/labels'
import type { BudgetSummary as Summary } from '@/types/domain'

/**
 * Ce qui se teste ici est la mise en mots des trois états et du curseur. Que
 * le composant ne nomme personne n'a pas besoin de test : il ne reçoit aucun
 * prénom. C'est `app_budget_summary` qui en répond (harnais RLS, section 8).
 */

/** `Intl` sépare les milliers et l'unité par des espaces insécables. */
const texte = (element: HTMLElement) => (element.textContent ?? '').replace(/\s/g, ' ')

const ready: Summary = {
  status: 'ready',
  respondents: 8,
  answered: true,
  min: 700,
  median: 850,
  max: 1200,
  step: 50,
  curve: [
    { amount: 700, followers: 8 },
    { amount: 750, followers: 7 },
    { amount: 800, followers: 7 },
    { amount: 850, followers: 5 },
    { amount: 900, followers: 2 },
    { amount: 1200, followers: 1 },
    { amount: 1250, followers: 0 },
  ],
}

describe('BudgetSummary', () => {
  it('invite à répondre d’abord, sans rien montrer', () => {
    render(<BudgetSummary summary={{ status: 'answer_first', respondents: 5, answered: false }} />)

    expect(screen.getByText(labels.budget.answerFirst)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('annonce le seuil de 3 réponses (RM-10)', () => {
    render(<BudgetSummary summary={{ status: 'insufficient', respondents: 2, answered: true }} />)

    expect(screen.getByText(labels.budget.insufficient)).toBeInTheDocument()
    expect(screen.getByText(labels.budget.respondents(2))).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('montre le budget confortable, la médiane et le maximum', () => {
    render(<BudgetSummary summary={ready} />)

    expect(texte(screen.getByText(labels.budget.min).parentElement!)).toContain('700 €')
    expect(texte(screen.getByText(labels.budget.median).parentElement!)).toContain('850 €')
    expect(texte(screen.getByText(labels.budget.max).parentElement!)).toContain('1 200 €')
  })

  it('ouvre le curseur sur le montant que tout le monde suit', () => {
    render(<BudgetSummary summary={ready} />)

    const slider = screen.getByRole('slider', { name: labels.budget.sliderLabel })
    expect(slider).toHaveValue('700')
    expect(slider.getAttribute('aria-valuetext')?.replace(/\s/g, ' ')).toBe(
      'À 700 €, tout le monde suit.',
    )
  })

  it('dit combien suivent quand on déplace le curseur — « 7 personnes sur 8 »', () => {
    render(<BudgetSummary summary={ready} />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '750' } })

    expect(slider.getAttribute('aria-valuetext')?.replace(/\s/g, ' ')).toBe(
      'À 750 €, 7 personnes sur 8 suivent.',
    )
  })

  it('accorde au singulier, et sait dire que plus personne ne suit', () => {
    render(<BudgetSummary summary={ready} />)
    const slider = screen.getByRole('slider')

    fireEvent.change(slider, { target: { value: '1200' } })
    expect(slider.getAttribute('aria-valuetext')?.replace(/\s/g, ' ')).toBe(
      'À 1 200 €, 1 personne sur 8 suit.',
    )

    fireEvent.change(slider, { target: { value: '1250' } })
    expect(slider.getAttribute('aria-valuetext')?.replace(/\s/g, ' ')).toBe(
      'À 1 250 €, plus personne ne suit.',
    )
  })

  it('borne le curseur à la courbe reçue', () => {
    render(<BudgetSummary summary={ready} />)
    const slider = screen.getByRole('slider')

    expect(slider).toHaveAttribute('min', '700')
    expect(slider).toHaveAttribute('max', '1250')
    expect(slider).toHaveAttribute('step', '50')
  })
})
