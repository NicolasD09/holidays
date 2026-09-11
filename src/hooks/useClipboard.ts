import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copie dans le presse-papiers, avec un repli.
 *
 * `navigator.clipboard` n'existe qu'en contexte sécurisé : absent sur un
 * `http://192.168.x.x` de test réseau local, et absent de certains navigateurs
 * intégrés (WhatsApp, Instagram) — précisément là où nos utilisateurs ouvrent
 * le lien. D'où le repli par `execCommand`, déprécié mais universel, et l'aveu
 * honnête quand rien ne marche : l'appelant affiche alors « sélectionne le
 * lien et copie-le à la main » plutôt qu'un faux « copié ».
 */
export function useClipboard(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await writeToClipboard(text)
      if (ok) {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetAfterMs)
      }
      return ok
    },
    [resetAfterMs],
  )

  return { copy, copied }
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission refusée ou contexte non sécurisé : on tente le repli.
    }
  }

  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)

  try {
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
