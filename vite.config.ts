/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Budget de performance (doc 04 §4.10) : le build échoue si un chunk
    // initial dépasse la limite. Volontairement bas — on le tient dès le début.
    chunkSizeWarningLimit: 200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // `lib/supabase.ts` refuse de démarrer sans configuration — c'est voulu en
    // production. Les tests de composants n'appellent jamais le réseau (les
    // modules `api/` sont remplacés), mais le client doit pouvoir s'instancier.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pour_les_tests',
    },
    // Bornée à `src` : les tests de sécurité vivent dans `supabase/tests/` et
    // parlent à un vrai projet Supabase. Ils ont leur propre configuration
    // (`vitest.security.config.ts`) pour que `npm run test` reste hors réseau.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/labels.ts'],
    },
  },
})
