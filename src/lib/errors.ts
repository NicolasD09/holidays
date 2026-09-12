/**
 * Traduction des codes d'erreur levés par les RPC Postgres (doc 04 §4.6).
 *
 * Les RPC lèvent des identifiants stables en anglais (`trip_not_found`,
 * `blind_mode_active`…) ; c'est ici, et nulle part ailleurs, qu'ils deviennent
 * des phrases. Un message dit ce qu'il faut faire, pas ce qui a planté
 * (doc 05 §5.6).
 */

const messages: Record<string, string> = {
  auth_required: 'Impossible de t’identifier sur cet appareil. Recharge la page et réessaie.',
  anonymous_sign_in_failed:
    'La connexion au service a échoué. Recharge la page — si ça persiste, reviens dans quelques minutes.',

  trip_not_found: 'Ce sondage n’existe pas. Vérifie le lien qu’on t’a envoyé.',
  trip_archived: 'Ce sondage est trop ancien et a été archivé.',
  invalid_title: 'Donne un titre à ton sondage (120 caractères maximum).',
  invalid_display_name: 'Indique ton prénom (40 caractères maximum).',
  invalid_categories: 'Choisis au moins une chose à décider.',
  too_many_categories: 'Dix catégories maximum par sondage.',
  unsupported_vote_mode: 'Ce type de vote n’est pas encore disponible.',
  slug_generation_failed: 'On n’a pas réussi à créer le lien du sondage. Réessaie.',

  participant_limit_reached: 'Ce sondage a atteint 50 participants.',
  not_participant: 'Rejoins d’abord le sondage pour pouvoir voter.',

  option_not_found: 'Cette proposition vient d’être supprimée.',
  option_limit_reached: 'Cette catégorie a atteint 100 propositions.',
  category_not_found: 'Cette catégorie n’existe plus.',
  category_closed: 'Cette catégorie est clôturée : les votes n’y sont plus modifiables.',
  invalid_vote_value: 'Ce vote n’est pas valide pour cette catégorie.',
  max_choices_reached: 'Tu as déjà utilisé tous tes choix ici. Retire-en un pour en ajouter un autre.',

  blind_mode_active: 'Vote d’abord : les résultats s’affichent ensuite.',

  invalid_date_window:
    'Choisis une période de recherche valide, plus longue que la durée du séjour.',
  invalid_nights: 'Indique une durée entre 1 et 60 nuits.',
  window_too_short: 'La période est trop courte pour un séjour de cette durée.',
  invalid_days: 'Ces dates ne sont pas valides.',
  too_many_days: 'Trop de jours d’un coup. Réessaie sur une période plus courte.',
  day_out_of_window: 'Ce jour est en dehors de la période de recherche.',
  invalid_availability_status: 'Cette disponibilité n’est pas valide.',

  trip_delete_refused:
    'Le sondage n’a pas été supprimé : seul son organisateur peut le faire, depuis l’appareil qui l’a créé.',
}

/** Message utilisateur pour une erreur venue de Supabase, du réseau ou du code. */
export function toUserMessage(error: unknown, fallback = 'Une erreur est survenue. Réessaie.'): string {
  const code = extractCode(error)
  if (code && messages[code]) return messages[code]
  return fallback
}

/** Code métier porté par l'erreur, s'il y en a un. */
export function extractCode(error: unknown): string | null {
  const raw = rawMessage(error)
  if (!raw) return null

  // PostgREST renvoie le texte du `raise exception` tel quel, parfois préfixé.
  for (const code of Object.keys(messages)) {
    if (raw.includes(code)) return code
  }
  return null
}

function rawMessage(error: unknown): string | null {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message?: unknown }
    return typeof message === 'string' ? message : null
  }
  return null
}
