import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/app/router'
import { labels } from '@/lib/labels'

/**
 * Depuis le découpage par route (tâche 7.3), chaque écran arrive de façon
 * **asynchrone** : au premier rendu, c'est le repli de la frontière d'attente
 * qui s'affiche. Les assertions passent donc par `findBy*`, qui attend.
 *
 * Ce n'est pas une concession au test : c'est ce que voit un vrai visiteur.
 */

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
  it('affiche l’accueil sur /', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('heading', { name: labels.app.tagline }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: labels.home.createCta }),
    ).toBeInTheDocument()
  })

  it('affiche une page dédiée sur un lien inconnu, sans écran blanc', async () => {
    renderAt('/t/lien-qui-nexiste-pas/nimporte-quoi')
    expect(
      await screen.findByRole('heading', { name: labels.notFound.title }),
    ).toBeInTheDocument()
  })

  it('affiche l’écran de création sur /new', async () => {
    renderAt('/new')
    expect(
      await screen.findByRole('heading', { name: labels.create.title }),
    ).toBeInTheDocument()
  })

  it('n’affiche jamais de blanc sous /t/:slug, chargement compris', () => {
    /*
      Deux attentes se superposent ici, et c'est voulu : le morceau de l'écran
      qui se télécharge, et `app_trip_preview` qui n'a pas encore répondu. Peu
      importe laquelle arrive en premier — dans les deux cas l'utilisateur voit
      un état de chargement, jamais rien.

      L'assertion est **synchrone** exprès : elle vérifie le tout premier
      rendu, celui où il serait le plus facile de laisser un écran vide.
    */
    renderAt('/t/abc123/results')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
