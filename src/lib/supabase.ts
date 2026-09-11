import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Client Supabase unique de l'application (doc 04 §4.2).
 *
 * Règle d'architecture : ce module n'est importé que depuis les dossiers
 * `api/` des features (doc 04 §4.6). Aucun composant ne parle directement à
 * la base.
 *
 * La clé publiable est publique par nature — toute la sécurité repose sur la
 * RLS (doc 04 §4.9). La clé `service_role` n'apparaît nulle part dans le front,
 * sous aucun prétexte.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Configuration Supabase absente. Copie .env.example en .env.local et renseigne VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    // La session anonyme est l'identité de l'appareil : la perdre, c'est
    // perdre ses votes. Elle est donc persistée et rafraîchie.
    persistSession: true,
    autoRefreshToken: true,
    // Aucun flux de redirection OAuth dans ce produit : inutile de scruter
    // l'URL, et ça évite que le SDK touche au fragment d'un lien partagé.
    detectSessionInUrl: false,
    storageKey: 'holidays-auth',
  },
})
