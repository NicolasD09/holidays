import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/router'
import { labels } from '@/lib/labels'

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
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

  it('affiche l’écran de création sur /new', () => {
    renderAt('/new')
    expect(
      screen.getByRole('heading', { name: labels.create.title }),
    ).toBeInTheDocument()
  })

  it('attend l’aperçu avant de décider quoi montrer sous /t/:slug', () => {
    // La garde de participation interroge d'abord `app_trip_preview` : tant
    // qu'elle n'a pas répondu, l'écran est en chargement — jamais blanc.
    renderAt('/t/abc123/results')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
