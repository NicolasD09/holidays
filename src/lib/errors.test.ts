import { describe, expect, it } from 'vitest'
import { extractCode, toUserMessage } from '@/lib/errors'

describe('extractCode', () => {
  it('reconnaît un code levé tel quel par une RPC', () => {
    expect(extractCode(new Error('trip_not_found'))).toBe('trip_not_found')
  })

  it('reconnaît un code préfixé par PostgREST', () => {
    expect(extractCode({ message: 'P0002: trip_not_found' })).toBe('trip_not_found')
  })

  it('renvoie null sur une erreur réseau quelconque', () => {
    expect(extractCode(new Error('Failed to fetch'))).toBeNull()
    expect(extractCode(null)).toBeNull()
    expect(extractCode({})).toBeNull()
  })
})

describe('toUserMessage', () => {
  it('traduit un code connu', () => {
    expect(toUserMessage({ message: 'blind_mode_active' })).toContain('Vote d’abord')
  })

  it('retombe sur un message générique pour un code inconnu', () => {
    expect(toUserMessage(new Error('boom'))).toBe('Une erreur est survenue. Réessaie.')
  })

  it('accepte un message de repli sur mesure', () => {
    expect(toUserMessage(new Error('boom'), 'Pas réussi à voter.')).toBe('Pas réussi à voter.')
  })

  it('ne laisse jamais fuiter le texte brut de Postgres', () => {
    const message = toUserMessage({ message: 'new row violates row-level security policy for table "votes"' })
    expect(message).not.toContain('row-level security')
  })
})
