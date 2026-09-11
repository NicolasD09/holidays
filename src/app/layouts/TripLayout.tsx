import { Outlet, useParams } from 'react-router'

/**
 * Enveloppe des écrans d'un sondage.
 *
 * À ce stade, elle ne fait que rendre ses enfants. Elle portera au sprint 2 la
 * garde de participation : si l'appareil courant n'est pas participant du
 * sondage, afficher `JoinGate` par-dessus l'aperçu — sans jamais rediriger,
 * pour que le lien partagé reste stable (doc 04 §4.4).
 */
export function TripLayout() {
  const { slug } = useParams<{ slug: string }>()
  return <Outlet context={{ slug }} />
}
