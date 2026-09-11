import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalButtons } from '@/features/voting/components/ApprovalButtons'
import { labels } from '@/lib/labels'

describe('ApprovalButtons', () => {
  it('expose un groupe de radios nommé par la proposition', () => {
    render(<ApprovalButtons optionTitle="Lisbonne" value={null} onVote={vi.fn()} />)

    expect(
      screen.getByRole('radiogroup', { name: labels.voting.groupLabel('Lisbonne') }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('enregistre un vote au premier tap', async () => {
    const onVote = vi.fn()
    render(<ApprovalButtons optionTitle="Lisbonne" value={null} onVote={onVote} />)

    await userEvent.click(screen.getByRole('radio', { name: labels.voting.yes }))

    expect(onVote).toHaveBeenCalledWith(1)
  })

  it('retire le vote quand on retape le choix déjà sélectionné', async () => {
    const onVote = vi.fn()
    render(<ApprovalButtons optionTitle="Lisbonne" value={1} onVote={onVote} />)

    const yes = screen.getByRole('radio', { name: labels.voting.yes })
    expect(yes).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(yes)

    // `null` = « je ne me prononce plus », qui n'est pas « non ».
    expect(onVote).toHaveBeenCalledWith(null)
  })

  it('se parcourt aux flèches, un seul bouton dans l’ordre de tabulation', async () => {
    render(<ApprovalButtons optionTitle="Lisbonne" value={null} onVote={vi.fn()} />)

    const [yes, maybe] = screen.getAllByRole('radio')
    expect(yes).toHaveAttribute('tabindex', '0')
    expect(maybe).toHaveAttribute('tabindex', '-1')

    yes?.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(maybe).toHaveFocus()
  })

  it('ne laisse plus voter dans une catégorie clôturée', () => {
    render(
      <ApprovalButtons optionTitle="Lisbonne" value={null} disabled onVote={vi.fn()} />,
    )

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})
