import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Session anonyme : création paresseuse, persistance déléguée au SDK
 * (doc 03 §3.1, doc 04 §4.5).
 *
 * Paresseuse, parce qu'ouvrir la page d'accueil ne doit créer aucun compte :
 * on ne fabrique une identité qu'au moment où quelqu'un crée un sondage ou en
 * rejoint un. C'est aussi ce qui évite d'accumuler des `auth.users` fantômes
 * à chaque visite d'un moteur d'indexation.
 */

/**
 * Garde-fou contre les appels concurrents : `TripLayout` et `JoinGate` peuvent
 * demander la session au même instant au premier rendu. Sans ce verrou, deux
 * `signInAnonymously()` partiraient en parallèle et l'un des deux JWT serait
 * écrasé — donc des votes rattachés à une identité orpheline.
 */
let pending: Promise<Session> | null = null

export class AuthUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('anonymous_sign_in_failed', { cause })
    this.name = 'AuthUnavailableError'
  }
}

/** Session existante, ou nouvelle session anonyme. */
export async function ensureSession(): Promise<Session> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  pending ??= createAnonymousSession()
  try {
    return await pending
  } finally {
    pending = null
  }
}

async function createAnonymousSession(): Promise<Session> {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw new AuthUnavailableError(error)
  if (!data.session) throw new AuthUnavailableError()
  return data.session
}

/**
 * Identifiant de l'appareil, sans jamais créer de session.
 * À utiliser partout où l'on veut savoir « suis-je déjà connu ? » sans
 * provoquer d'inscription : lecture d'un aperçu, écran `/mine`.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
