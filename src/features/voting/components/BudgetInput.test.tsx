import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BudgetInput } from '@/features/voting/components/BudgetInput'
import { labels } from '@/lib/labels'

function setup(overrides: Partial<Parameters<typeof BudgetInput>[0]> = {}) {
  const onSave = vi.fn()
  const onClear = vi.fn()
  render(
    <BudgetInput
      saved={null}
      disabled={false}
      pending={false}
      error={null}
      onSave={onSave}
      onClear={onClear}
      {...overrides}
    />,
  )
  return { onSave, onClear, field: screen.getByLabelText(labels.budget.question) }
}

describe('BudgetInput', () => {
  it('affiche la promesse de confidentialité, rattachée au champ', () => {
    const { field } = setup()

    // La promesse n'est pas une mention en pied de page : un lecteur d'écran
    // doit l'entendre en arrivant sur le champ.
    expect(field).toHaveAccessibleDescription(expect.stringContaining(labels.budget.promise))
  })

  it('ouvre le pavé numérique sans être un champ number', () => {
    const { field } = setup()

    expect(field).toHaveAttribute('inputmode', 'numeric')
    expect(field).toHaveAttribute('type', 'text')
  })

  it('enregistre un montant entier', async () => {
    const { field, onSave } = setup()

    await userEvent.type(field, '750')
    await userEvent.click(screen.getByRole('button', { name: labels.budget.save }))

    expect(onSave).toHaveBeenCalledWith(750)
  })

  it('valide à la touche Entrée', async () => {
    const { field, onSave } = setup()

    await userEvent.type(field, '1 200{Enter}')

    expect(onSave).toHaveBeenCalledWith(1200)
  })

  it('refuse une saisie qui n’est pas un montant, et le dit', async () => {
    const { field, onSave } = setup()

    await userEvent.type(field, '750,50')
    await userEvent.click(screen.getByRole('button', { name: labels.budget.save }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(labels.budget.errorInvalid)
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('refuse un champ vide plutôt que d’enregistrer zéro', async () => {
    const { onSave } = setup()

    await userEvent.click(screen.getByRole('button', { name: labels.budget.save }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('reprend le montant déjà enregistré et propose de le modifier', () => {
    const { field } = setup({ saved: 900 })

    expect(field).toHaveValue('900')
    // Rien à enregistrer tant que le chiffre n'a pas changé.
    expect(screen.getByRole('button', { name: labels.budget.update })).toBeDisabled()
  })

  it('permet de retirer sa réponse', async () => {
    const { field, onClear } = setup({ saved: 900 })

    await userEvent.click(screen.getByRole('button', { name: labels.budget.clear }))

    expect(onClear).toHaveBeenCalledOnce()
    expect(field).toHaveValue('')
  })

  it('ne propose pas de retirer une réponse qui n’existe pas', () => {
    setup()

    expect(screen.queryByRole('button', { name: labels.budget.clear })).toBeNull()
  })

  it('devient inerte dans une catégorie clôturée', () => {
    const { field } = setup({ saved: 900, disabled: true })

    expect(field).toBeDisabled()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('affiche l’échec d’enregistrement', () => {
    setup({ error: labels.budget.failed })

    expect(screen.getByRole('alert')).toHaveTextContent(labels.budget.failed)
  })
})
