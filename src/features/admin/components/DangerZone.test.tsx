import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DangerZone } from '@/features/admin/components/DangerZone'
import { labels } from '@/lib/labels'

/**
 * La suppression est définitive et collective. Ce qui est testé ici n'est pas
 * l'apparence mais la **friction** : tant qu'elle tient, un clic réflexe ne
 * peut pas effacer le sondage de tout un groupe.
 */
describe('DangerZone', () => {
  async function ouvrir(titre = 'Vacances test', onDelete = vi.fn()) {
    render(<DangerZone tripTitle={titre} pending={false} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: labels.danger.deleteCta }))
    return {
      onDelete,
      champ: screen.getByLabelText(labels.danger.confirmLabel),
      bouton: screen.getByRole('button', { name: labels.danger.confirm }),
    }
  }

  it('ne supprime pas d’un seul tap : le premier bouton ouvre une confirmation', async () => {
    const onDelete = vi.fn()
    render(<DangerZone tripTitle="Vacances test" pending={false} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: labels.danger.deleteCta }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('garde le bouton inerte tant que le titre n’est pas recopié', async () => {
    const { bouton } = await ouvrir()

    expect(bouton).toBeDisabled()
  })

  it('reste inerte sur un titre approchant', async () => {
    const { champ, bouton } = await ouvrir()

    await userEvent.type(champ, 'Vacances tes')

    expect(bouton).toBeDisabled()
    expect(screen.getByText(labels.danger.mismatch)).toBeInTheDocument()
  })

  it('libère la suppression quand le titre correspond exactement', async () => {
    const { champ, bouton, onDelete } = await ouvrir()

    await userEvent.type(champ, 'Vacances test')
    expect(bouton).toBeEnabled()

    await userEvent.click(bouton)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('tolère les espaces autour, pas une faute de frappe', async () => {
    const { champ, bouton } = await ouvrir()

    await userEvent.type(champ, '  Vacances test  ')

    expect(bouton).toBeEnabled()
  })

  it('n’affiche aucune confirmation tant qu’on n’a rien demandé', () => {
    render(<DangerZone tripTitle="Vacances test" pending={false} onDelete={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
