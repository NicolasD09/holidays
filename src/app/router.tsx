import { Route, Routes } from 'react-router'
import { RootLayout } from '@/app/layouts/RootLayout'
import { TripLayout } from '@/app/layouts/TripLayout'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { TripSettingsPage } from '@/features/admin/pages/TripSettingsPage'
import { ResultsPage } from '@/features/results/pages/ResultsPage'
import { CreateTripPage } from '@/features/trip/pages/CreateTripPage'
import { HomePage } from '@/features/trip/pages/HomePage'
import { MyTripsPage } from '@/features/trip/pages/MyTripsPage'
import { TripHubPage } from '@/features/trip/pages/TripHubPage'
import { CategoryPage } from '@/features/voting/pages/CategoryPage'

/** Routes de l'application — doc 04 §4.4. */
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
