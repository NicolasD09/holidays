import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { RootLayout } from '@/app/layouts/RootLayout'
import { TripLayout } from '@/app/layouts/TripLayout'
import { NotFoundPage } from '@/app/pages/NotFoundPage'

/**
 * Routes de l'application — doc 04 §4.4, découpage de la tâche 7.3.
 *
 * **Chaque écran est chargé à la demande.** Sans ça, quelqu'un qui ouvre un
 * lien pour voter télécharge aussi l'écran de création, les réglages, la zone
 * sensible et le récapitulatif — du code qu'il n'atteindra peut-être jamais.
 *
 * **Ce qui reste chargé d'entrée, et pourquoi.**
 *
 * - `RootLayout` et `NotFoundPage` : la coquille et le filet. Les charger à la
 *   demande ferait clignoter la page pour économiser deux kilo-octets.
 * - `TripLayout` : c'est la porte d'entrée réelle du produit — *« le lien est
 *   le produit »* (doc 07 Q2). Le rendre paresseux ajouterait une cascade de
 *   trois requêtes sur le chemin le plus fréquenté, pour alléger `/` qui l'est
 *   beaucoup moins. Mauvais échange.
 *
 * Les écrans, eux, sont des feuilles : chacun part dans son propre morceau.
 * Les frontières d'attente vivent dans les deux layouts, pour que l'entête du
 * sondage ne disparaisse pas pendant qu'un écran se charge.
 */

const HomePage = lazy(async () => ({
  default: (await import('@/features/trip/pages/HomePage')).HomePage,
}))

const CreateTripPage = lazy(async () => ({
  default: (await import('@/features/trip/pages/CreateTripPage')).CreateTripPage,
}))

const MyTripsPage = lazy(async () => ({
  default: (await import('@/features/trip/pages/MyTripsPage')).MyTripsPage,
}))

const TripHubPage = lazy(async () => ({
  default: (await import('@/features/trip/pages/TripHubPage')).TripHubPage,
}))

const CategoryPage = lazy(async () => ({
  default: (await import('@/features/voting/pages/CategoryPage')).CategoryPage,
}))

const ResultsPage = lazy(async () => ({
  default: (await import('@/features/results/pages/ResultsPage')).ResultsPage,
}))

const TripSettingsPage = lazy(async () => ({
  default: (await import('@/features/admin/pages/TripSettingsPage')).TripSettingsPage,
}))

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<CreateTripPage />} />
        <Route path="mine" element={<MyTripsPage />} />
        <Route path="t/:slug" element={<TripLayout />}>
          <Route index element={<TripHubPage />} />
          <Route path="c/:categoryId" element={<CategoryPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="settings" element={<TripSettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
