/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'

/**
 * Configuration dédiée aux tests de sécurité (doc 04 §4.7).
 *
 * Séparée de `vite.config.ts` pour une raison simple : ces tests parlent à un
 * vrai projet Supabase. Les laisser dans la suite unitaire, c'est rendre
 * `npm run test` dépendant du réseau — et donc, tôt ou tard, le désactiver.
 *
 * En l'absence de configuration, les tests s'annoncent ignorés plutôt que
 * d'échouer : un poste sans `.env.local` doit pouvoir lancer la CI locale.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    // Chaque test crée de vrais sondages via le réseau : les 5 s par défaut
    // sont trop courts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Les tests partagent un projet Supabase : en parallèle, les assertions
    // « je ne vois que mon sondage » deviendraient instables.
    fileParallelism: false,
    env: loadEnv('', process.cwd(), ''),
  },
})
