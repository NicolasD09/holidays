import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvailabilityGrid } from '@/features/voting/components/AvailabilityGrid'
import { labels } from '@/lib/labels'

/**
 * **Ce que ces tests ne couvrent pas, et pourquoi.** La peinture par glissement
 * repose sur la capture du pointeur et sur `elementFromPoint`, dont jsdom n'a
 * pas d'implémentation utile : tout y est à coordonnées nulles. Le geste réel
 * — le doigt qui suit les cases — est donc prouvé par l'E2E, sur un vrai
 * moteur. Seul l'**ordre des événements** du geste est tenu ici, en fin de
 * fichier.
 *
 * Reste ici tout ce qui se teste honnêtement en unitaire : le choix du pinceau,
 * le chemin clavier — qui est la seule façon de peindre sans viser — et le lot
 * produit dans chaque cas.
 */

function renderGrid(over: Partial<Parameters<typeof AvailabilityGrid>[0]> = {}) {
  const onPaint = vi.fn()
  render(
    <AvailabilityGrid
      windowStart="2027-07-01"
      windowEnd="2027-07-03"
      entries={[]}
      participantId="me"
      onPaint={onPaint}
      {...over}
    />,
  )
  return { onPaint }
}

const firstDay = () => screen.getByRole('gridcell', { name: /jeudi 1 juillet/ })

describe('AvailabilityGrid', () => {
  it('propose les trois états et la gomme', () => {
    renderGrid()

    expect(
      screen.getByRole('radiogroup', { name: labels.availability.brushLabel }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  it('part sur le pinceau « Dispo » — le geste majoritaire', () => {
    renderGrid()

    expect(screen.getByRole('radio', { name: labels.availability.brushes.yes })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('peint la case focalisée à la barre d’espace', async () => {
    const { onPaint } = renderGrid()

    firstDay().focus()
    await userEvent.keyboard(' ')

    expect(onPaint).toHaveBeenCalledWith([{ day: '2027-07-01', status: 'yes' }])
  })

  it('peint avec le pinceau courant, pas avec celui d’avant', async () => {
    const { onPaint } = renderGrid()

    await userEvent.click(screen.getByRole('radio', { name: labels.availability.brushes.no }))
    firstDay().focus()
    await userEvent.keyboard(' ')

    expect(onPaint).toHaveBeenCalledWith([{ day: '2027-07-01', status: 'no' }])
  })

  it('se déplace aux flèches, une case à la fois', async () => {
    renderGrid()

    firstDay().focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('gridcell', { name: /vendredi 2 juillet/ })).toHaveFocus()
  })

  it('ne sort pas de la fenêtre en butant sur son bord', async () => {
    renderGrid()

    firstDay().focus()
    await userEvent.keyboard('{ArrowLeft}')

    // Le 1er juillet est le premier jour : la flèche gauche ne mène nulle part.
    expect(firstDay()).toHaveFocus()
  })

  it('n’a qu’une seule case dans l’ordre de tabulation', () => {
    renderGrid()

    const cells = screen.getAllByRole('gridcell')
    const focusable = cells.filter((cell) => cell.getAttribute('tabindex') === '0')
    expect(focusable).toHaveLength(1)
  })

  it('remplit la fenêtre entière avec « Tout dispo »', async () => {
    const { onPaint } = renderGrid()

    await userEvent.click(
      screen.getByRole('button', { name: labels.availability.allAvailable }),
    )

    expect(onPaint).toHaveBeenCalledWith([
      { day: '2027-07-01', status: 'yes' },
      { day: '2027-07-02', status: 'yes' },
      { day: '2027-07-03', status: 'yes' },
    ])
  })

  it('n’envoie rien quand le lot ne changerait rien', async () => {
    const { onPaint } = renderGrid({
      entries: [
        { participantId: 'me', day: '2027-07-01', status: 'yes' },
        { participantId: 'me', day: '2027-07-02', status: 'yes' },
        { participantId: 'me', day: '2027-07-03', status: 'yes' },
      ],
    })

    await userEvent.click(
      screen.getByRole('button', { name: labels.availability.allAvailable }),
    )

    expect(onPaint).not.toHaveBeenCalled()
  })

  it('n’efface que ce qui était peint', async () => {
    const { onPaint } = renderGrid({
      entries: [{ participantId: 'me', day: '2027-07-02', status: 'no' }],
    })

    await userEvent.click(screen.getByRole('button', { name: labels.availability.clearAll }))

    expect(onPaint).toHaveBeenCalledWith([{ day: '2027-07-02', status: null }])
  })

  it('se tait dans une catégorie clôturée', async () => {
    const { onPaint } = renderGrid({ disabled: true })

    firstDay().focus()
    await userEvent.keyboard(' ')

    expect(onPaint).not.toHaveBeenCalled()
    expect(firstDay()).toBeDisabled()
  })
})

/**
 * Le glissement, reproduit **sans `act`**.
 *
 * jsdom n'a pas de mise en page : `elementFromPoint` est remplacé par une
 * table « coordonnée → case ». Ce n'est pas ce que ce test prouve. Il prouve
 * l'ordre des événements : un navigateur peut livrer `pointerup` avant que
 * React ait rendu le dernier `pointermove` — WebKit le fait, et c'est ce qui a
 * fait échouer l'E2E des dates sur `mobile-safari` (la dernière case du geste
 * manquait au lot). Sous `act`, chaque événement est suivi d'un rendu, et ce
 * cas ne peut jamais se produire.
 */
describe('AvailabilityGrid · glissement', () => {
  function pointer(type: string, x: number) {
    return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 0 })
  }

  it('garde la dernière case même si le doigt se lève avant le rendu', async () => {
    const { onPaint } = renderGrid()
    const grid = screen.getByRole('grid')
    const cells = ['2027-07-01', '2027-07-02', '2027-07-03'].map(
      (day) => grid.querySelector<HTMLElement>(`[data-day="${day}"]`)!,
    )

    document.elementFromPoint = (x: number) => cells[x] ?? null
    grid.setPointerCapture = () => {}
    grid.hasPointerCapture = () => false
    grid.releasePointerCapture = () => {}

    const { act } = await import('react')
    // Le doigt se pose : celui-là, on laisse React le rendre.
    act(() => {
      cells[0]!.dispatchEvent(pointer('pointerdown', 0))
    })

    // Puis glisse sur deux cases et se lève, dans la même tâche.
    const previous = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    try {
      grid.dispatchEvent(pointer('pointermove', 1))
      grid.dispatchEvent(pointer('pointermove', 2))
      grid.dispatchEvent(pointer('pointerup', 2))
    } finally {
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous
    }

    expect(onPaint).toHaveBeenCalledWith([
      { day: '2027-07-01', status: 'yes' },
      { day: '2027-07-02', status: 'yes' },
      { day: '2027-07-03', status: 'yes' },
    ])
  })
})
