import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/router'
import { labels } from '@/lib/labels'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('routage', () => {
  it('affiche l’accueil sur /', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { name: labels.app.tagline }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: labels.home.createCta }),
    ).toBeInTheDocument()
  })

  it('affiche une page dédiée sur un lien inconnu, sans écran blanc', () => {
    renderAt('/t/lien-qui-nexiste-pas/nimporte-quoi')
    expect(
      screen.getByRole('heading', { name: labels.notFound.title }),
    ).toBeInTheDocument()
  })

  it('rend les écrans d’un sondage sous /t/:slug', () => {
    renderAt('/t/abc123/results')
    expect(screen.getByRole('heading', { name: labels.soon.badge })).toBeInTheDocument()
  })
})
