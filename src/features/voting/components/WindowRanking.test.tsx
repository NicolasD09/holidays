import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WindowRanking } from '@/features/voting/components/WindowRanking'
import { labels } from '@/lib/labels'
import type { AvailabilityEntry } from '@/lib/scoring'
import type { Participant } from '@/types/domain'

/**
 * Le classement lui-même est prouvé au sprint 4 (`scoring.test.ts`, 100 %).
 * Ce qui se teste ici est la mise en mots : le bon créneau en tête, et les
 * absents **nommés** — sans le nom, l'information n'est pas exploitable.
 */

function participant(id: string, name: string): Participant {
  return {
    id,
    trip_id: 'trip',
    display_name: name,
    avatar_emoji: null,
    avatar_color: null,
    auth_uid: null,
    is_organizer: false,
    created_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
  }
}

const people = [
  participant('p1', 'Marie'),
  participant('p2', 'Thomas'),
  participant('p3', 'Julien'),
]

/**
 * Marie et Thomas sont libres du 10 au 12 ; Julien y est indisponible le 11.
 * Ce créneau marque 4 (deux sûrs) et sort devant les créneaux où personne ne
 * s'est prononcé, qui ne marquent que 3 (trois « peut-être »).
 */
const entries: AvailabilityEntry[] = [
  { participantId: 'p1', day: '2027-07-10', status: 'yes' },
  { participantId: 'p1', day: '2027-07-11', status: 'yes' },
  { participantId: 'p1', day: '2027-07-12', status: 'yes' },
  { participantId: 'p2', day: '2027-07-10', status: 'yes' },
  { participantId: 'p2', day: '2027-07-11', status: 'yes' },
  { participantId: 'p2', day: '2027-07-12', status: 'yes' },
  { participantId: 'p3', day: '2027-07-11', status: 'no' },
]

function renderRanking(over: Partial<Parameters<typeof WindowRanking>[0]> = {}) {
  return render(
    <WindowRanking
      windowStart="2027-07-01"
      windowEnd="2027-07-20"
      nights={2}
      entries={entries}
      participants={people}
      {...over}
    />,
  )
}

describe('WindowRanking', () => {
  it('met le meilleur créneau en tête, en toutes lettres', () => {
    renderRanking()

    const [first] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('sam. 10 → lun. 12 juillet')
    expect(first).toHaveTextContent(labels.ranking.top)
  })

  it('nomme qui bloque le créneau', () => {
    renderRanking()

    expect(screen.getByText('Julien n’est pas dispo.')).toBeInTheDocument()
  })

  it('compte les sûrs et les peut-être séparément', () => {
    renderRanking()

    const [first] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent(labels.ranking.counts(2, 0))
  })

  it('s’arrête à cinq créneaux — les montrer tous, c’est cacher la réponse', () => {
    renderRanking()

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('ne classe rien tant que personne n’a répondu', () => {
    renderRanking({ entries: [] })

    expect(screen.getByText(labels.ranking.empty)).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('le dit quand la fenêtre ne peut plus contenir le séjour', () => {
    renderRanking({ windowEnd: '2027-07-02', nights: 30 })

    expect(screen.getByText(labels.ranking.none)).toBeInTheDocument()
  })

  it('n’affiche pas un nom qu’il ne connaît pas', () => {
    // Un participant supprimé entre deux chargements : on tait son absence
    // plutôt que d'afficher un identifiant brut.
    renderRanking({ participants: [participant('p1', 'Marie')] })

    expect(screen.queryByText(/n’est pas dispo/)).not.toBeInTheDocument()
  })
})
