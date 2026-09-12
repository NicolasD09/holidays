import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

/**
 * `.env.local` est lu par Vite, pas par le process Node de Playwright : sans
 * ce pont, `npm run test:e2e` en local s'annonçait « skipped » — dix tests
 * ignorés ressemblant de très près à dix tests verts.
 *
 * En CI les deux variables viennent des secrets GitHub et sont déjà dans
 * `process.env` : le `??=` les laisse gagner, et `.env.local` n'y existe pas
 * de toute façon. Aucune dépendance ajoutée, `loadEnv` vient de Vite.
 */
const env = loadEnv('development', process.cwd(), 'VITE_')
process.env.VITE_SUPABASE_URL ??= env.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * E2E — le parcours complet à deux participants (doc 08, tâche 1.12).
 *
 * Ces tests parlent au **vrai** `holidays-dev` : c'est le seul moyen de
 * prouver que la RLS, les RPC et l'interface s'accordent. Ils ne tournent donc
 * qu'avec les deux variables d'environnement ; sans elles, la suite s'annonce
 * ignorée plutôt que rouge, pour qu'une PR venue d'un fork reste lisible.
 *
 * Le projet de référence est **Safari mobile** : c'est là que ça casse
 * (doc 08 §8.5).
 */
export default defineConfig({
  testDir: './e2e',
  // Deux participants qui votent sur le même sondage : la parallélisation
  // ferait courir deux scénarios sur les mêmes données.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    locale: 'fr-FR',
  },

  projects: [
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
