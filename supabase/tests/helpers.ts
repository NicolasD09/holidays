import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

/**
 * Outillage des tests de sécurité (doc 04 §4.7).
 *
 * Ces tests parlent à `holidays-dev` avec la clé publiable — exactement les
 * droits d'un navigateur. C'est le point : vérifier la RLS depuis la position
 * d'un attaquant, pas depuis celle du propriétaire de la base.
 */

export const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
export const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Faux sans configuration : les tests s'annoncent ignorés au lieu d'échouer. */
export const configured = Boolean(supabaseUrl && supabaseKey)

export type Client = SupabaseClient<Database>

/** Un appareil : client isolé, sans session. */
export function device(): Client {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Un appareil déjà identifié — l'état d'un navigateur qui a ouvert un lien. */
export async function signedInDevice(): Promise<Client> {
  const client = device()
  const { error } = await client.auth.signInAnonymously()
  if (error) {
    throw new Error(
      `Auth anonyme refusée par le projet Supabase (${error.message}). ` +
        'Active « Anonymous sign-ins » dans Authentication → Sign In / Providers.',
    )
  }
  return client
}

type Rpc = Record<string, unknown>

/**
 * Appel de RPC par son nom. Les types générés n'exposent qu'un `Json` en
 * retour ; le harnais de test reprend la main dessus plutôt que de propager un
 * `Json` inexploitable dans chaque assertion.
 */
type LooseRpcClient = {
  rpc: (fn: string, args: Rpc) => Promise<{ data: unknown; error: { message: string } | null }>
}

async function rpc(client: Client, fn: string, args: Rpc): Promise<Rpc> {
  const { data, error } = await (client as unknown as LooseRpcClient).rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return (data ?? {}) as Rpc
}

export async function expectRpcToFail(client: Client, fn: string, args: Rpc): Promise<string> {
  const { error } = await (client as unknown as LooseRpcClient).rpc(fn, args)
  if (!error) throw new Error(`${fn} a réussi alors qu'elle devait être refusée`)
  return error.message
}

export type Fixture = {
  client: Client
  tripId: string
  slug: string
  participantId: string
  categoryId: string
  optionIds: string[]
}

/**
 * Un sondage complet créé par un appareil : organisateur, une catégorie
 * d'approbation, `titles.length` propositions.
 */
export async function createTrip(titles: string[] = ['Lisbonne', 'Porto']): Promise<Fixture> {
  const client = await signedInDevice()
  const created = await rpc(client, 'app_create_trip', {
    p_title: `Test sécurité ${crypto.randomUUID().slice(0, 8)}`,
    p_emoji: '🔒',
    p_display_name: 'Marie',
  })

  const tripId = String(created.trip_id)
  const slug = String(created.slug)
  const participantId = String(created.participant_id)

  const { data: categories, error } = await client
    .from('categories')
    .select('id')
    .eq('trip_id', tripId)
  if (error) throw new Error(error.message)

  const categoryId = categories?.[0]?.id
  if (!categoryId) throw new Error('Catégorie introuvable après création du sondage')

  const { data: options, error: optionError } = await client
    .from('options')
    .insert(titles.map((title, index) => ({
      trip_id: tripId,
      category_id: categoryId,
      title,
      created_by: participantId,
      position: index,
    })))
    .select('id')
  if (optionError) throw new Error(optionError.message)

  return {
    client,
    tripId,
    slug,
    participantId,
    categoryId,
    optionIds: (options ?? []).map((option) => option.id),
  }
}

/** Un second appareil qui rejoint le sondage par son lien. */
export async function joinTrip(slug: string, name: string): Promise<Client> {
  const client = await signedInDevice()
  await rpc(client, 'app_join_trip', { p_slug: slug, p_display_name: name })
  return client
}

export async function castVote(client: Client, optionId: string, value: number): Promise<void> {
  await rpc(client, 'app_cast_vote', { p_option_id: optionId, p_value: value })
}

/** Nettoyage : l'organisateur a le droit de supprimer son sondage (cascade). */
export async function destroyTrip(fixture: Fixture): Promise<void> {
  await fixture.client.from('trips').delete().eq('id', fixture.tripId)
}
