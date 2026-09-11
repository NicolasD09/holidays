import { BrowserRouter } from 'react-router'
import { Providers } from '@/app/providers'
import { AppRoutes } from '@/app/router'

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  )
}
