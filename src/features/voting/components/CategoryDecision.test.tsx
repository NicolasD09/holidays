import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryDecision } from '@/features/voting/components/CategoryDecision'
import { labels } from '@/lib/labels'
import type { Category, Participant } from '@/types/domain'

const fetchTripProgress = vi.hoisted(() => vi.fn())
const listParticipants = vi.hoisted(() => vi.fn<() => Promise<Participant[]>>())
vi.mock('@/features/trip/api/tripProgress', () => ({ fetchTripProgress }))
vi.mock('@/features/participant/api/listParticipants', () => ({ listParticipants }))
vi.mock('@/features/trip/api/decisions', () => ({
  listDecisions: vi.fn().mockResolvedValue([]),
  closeCategory: vi.fn(),
  reopenCategory: vi.fn(),
}))
vi.mock('@/features/voting/api/options', () => ({ listOptions: vi.fn().mockResolvedValue([]) }))
vi.mock('@/features/voting/api/categoryResults', () => ({
  fetchCategoryResults: vi.fn().mockResolvedValue([]),
}))

const category: Category = {
  id: 'c1',
  trip_id: 'trip',
  kind: 'destination',
  label: 'Destination',
  description: null,
  vote_mode: 'approval',
  status: 'open',
  position: 0,
  allow_participant_options: true,
  max_choices: null,
  window_start: null,
  window_end: null,
  nights: null,
  currency: 'EUR',
  created_at: '2026-01-01T00:00:00Z',
}

const participant = (id: string, name: string): Participant => ({
  id,
  trip_id: 'trip',
  display_name: name,
  avatar_emoji: null,
  avatar_color: null,
  auth_uid: null,
  is_organizer: id === 'marie',
  created_at: '',
  last_seen_at: '',
})

describe('CategoryDecision — l’avertissement de la modale', () => {
  beforeEach(() => {
    listParticipants.mockResolvedValue([participant('marie', 'Marie'), participant('thomas', 'Thomas')])
    fetchTripProgress.mockResolvedValue({
      c1: { optionCount: 2, votedByMe: false, voterIds: ['thomas'], leader: null },
    })
  })

  it('compte les participants à l’ouverture, pas d’après l’aperçu en cache', async () => {
    // Le cas de l'E2E : l'aperçu de Marie date de la création du sondage, quand
    // elle était seule. Thomas a rejoint depuis, et voté. Le composant ne
    // reçoit plus ce compte : il le relit.
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <CategoryDecision
            category={category}
            categories={[category]}
            slug="abc"
            tripId="trip"
            participantId="marie"
            isOrganizer
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: labels.closure.closeCta }))
    expect(await screen.findByText(labels.closure.nonVoters(1))).toBeInTheDocument()
  })
})
