import { describe, expect, it } from 'vitest'
import { shareMessage, tripUrl } from '@/lib/share'

describe('partage du lien', () => {
  it('construit une URL absolue à partir de l’origine réelle', () => {
    expect(tripUrl('abc123', 'https://holidays.pages.dev')).toBe(
      'https://holidays.pages.dev/t/abc123',
    )
  })

  it('fonctionne sur une prévisualisation, sans variable d’environnement', () => {
    expect(tripUrl('xyz789', 'https://sprint-02.holidays.pages.dev')).toBe(
      'https://sprint-02.holidays.pages.dev/t/xyz789',
    )
  })

  it('met le lien en fin de message, pour qu’il reste cliquable', () => {
    const message = shareMessage('Vacances test', 'https://exemple.test/t/abc123')

    expect(message).toContain('Vacances test')
    expect(message.endsWith('https://exemple.test/t/abc123')).toBe(true)
  })
})
