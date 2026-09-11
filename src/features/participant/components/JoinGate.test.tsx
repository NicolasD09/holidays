import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinGate } from '@/features/participant/components/JoinGate'
import { labels } from '@/lib/labels'
import type { TripPreview } from '@/types/domain'

const joinTrip = vi.hoisted(() => vi.fn())
vi.mock('@/features/participant/api/joinTrip', () => ({ joinTrip }))

const preview: TripPreview = {
  trip_id: '11111111-1111-4111-8111-111111111111',
  slug: 'abc123',
  title: 'Vacances test',
  description: null,
  cover_emoji: '🏖️',
  status: 'open',
  participant_count: 3,
  is_participant: false,
  categories: [],
}

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <JoinGate preview={preview} slug="abc123" />
    </QueryClientProvider>,
  )
}

describe('JoinGate', () => {
  beforeEach(() => {
    joinTrip.mockReset()
    joinTrip.mockResolvedValue({
      trip_id: preview.trip_id,
      participant_id: '22222222-2222-4222-8222-222222222222',
      display_name: 'Thomas',
      is_organizer: false,
      created: true,
    })
  })

  it('ne demande qu’un prénom — ni mot de passe, ni email', () => {
    renderGate()

    expect(screen.getByLabelText(labels.join.nameLabel)).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByText(new RegExp(labels.join.noAccount))).toBeInTheDocument()
  })

  it('dit qui est déjà là, pour donner envie d’entrer', () => {
    renderGate()
    expect(screen.getByText(new RegExp(labels.join.participants(3)))).toBeInTheDocument()
  })

  it('refuse un prénom vide sans appeler le serveur', async () => {
    renderGate()

    await userEvent.click(screen.getByRole('button', { name: labels.join.submit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      labels.join.errorNameRequired,
    )
    expect(joinTrip).not.toHaveBeenCalled()
  })

  it('rejoint le sondage avec le prénom saisi, espaces rognés', async () => {
    renderGate()

    await userEvent.type(screen.getByLabelText(labels.join.nameLabel), '  Thomas  ')
    await userEvent.click(screen.getByRole('button', { name: labels.join.submit }))

    expect(joinTrip).toHaveBeenCalledWith('abc123', 'Thomas')
  })
})
