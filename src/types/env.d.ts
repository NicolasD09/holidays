/// <reference types="vite/client" />

/**
 * Variables d'environnement du front (doc 04 §4.9).
 *
 * Toutes optionnelles côté types : `import.meta.env` n'offre aucune garantie à
 * la compilation. C'est `lib/supabase.ts` qui échoue tôt et explicitement si
 * elles manquent, plutôt que de laisser passer un `undefined` jusqu'au premier
 * appel réseau.
 *
 * `VITE_SUPABASE_PUBLISHABLE_KEY` est le nom des nouvelles clés d'API Supabase
 * (`sb_publishable_…`) ; `VITE_SUPABASE_ANON_KEY` reste accepté pour les
 * projets qui utilisent encore l'ancienne clé JWT `anon`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
