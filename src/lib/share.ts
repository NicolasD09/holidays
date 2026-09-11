import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'

/**
 * Partage du lien d'un sondage.
 *
 * Le lien est le produit : c'est le seul objet qui circule dans le groupe.
 * Il est donc construit ici, à un seul endroit, à partir de l'origine réelle
 * de la page — pas d'une variable d'environnement qui divergerait entre la
 * prévisualisation Cloudflare et la production.
 */

export function tripUrl(slug: string, origin = window.location.origin): string {
  return new URL(routes.trip(slug), origin).toString()
}

/** Message prêt à coller : une phrase, puis le lien. */
export function shareMessage(title: string, url: string): string {
  return `${labels.share.message(title)}\n${url}`
}

export function canShareNatively(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Partage natif. `false` si l'utilisateur annule ou si l'API refuse : le
 * bouton « Copier le lien » reste le chemin principal, celui-ci est un bonus.
 */
export async function shareNatively(
  title: string,
  text: string,
  url: string,
): Promise<boolean> {
  if (!canShareNatively()) return false
  try {
    await navigator.share({ title, text, url })
    return true
  } catch {
    return false
  }
}
