import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useClipboard } from '@/hooks/useClipboard'
import { labels } from '@/lib/labels'
import { canShareNatively, shareMessage, shareNatively } from '@/lib/share'

/**
 * Modale de partage, affichée juste après la création (doc 05 §5.3).
 *
 * Volontairement **non passable par erreur** : pas de fermeture au clic
 * extérieur ni à Échap. Perdre ce lien à ce moment précis, c'est perdre le
 * sondage — l'organisateur est le seul à l'avoir, et il n'a pas de compte où
 * le retrouver.
 */
export function ShareSheet({
  open,
  title,
  url,
  onContinue,
}: {
  open: boolean
  title: string
  url: string
  onContinue: () => void
}) {
  const { copy, copied } = useClipboard()
  const [copyFailed, setCopyFailed] = useState(false)

  async function onCopy() {
    const ok = await copy(shareMessage(title, url))
    setCopyFailed(!ok)
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="text-xl font-semibold">{labels.share.title}</DialogTitle>
        <DialogDescription className="text-text-muted">
          {labels.share.body}
        </DialogDescription>

        <div className="flex flex-col gap-1">
          <label htmlFor="share-url" className="text-sm font-medium">
            {labels.share.linkLabel}
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full rounded-[var(--radius-control)] border border-border-strong bg-surface-2 px-3 text-sm text-text"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={() => void onCopy()}>
            {copied ? labels.share.copied : labels.share.copy}
          </Button>

          {canShareNatively() ? (
            <Button
              variant="outline"
              block
              onClick={() => void shareNatively(title, shareMessage(title, url), url)}
            >
              {labels.share.nativeShare}
            </Button>
          ) : null}

          <Button variant="ghost" block onClick={onContinue}>
            {labels.share.continue}
          </Button>
        </div>

        {copyFailed ? (
          <p role="alert" className="text-sm text-no">
            {labels.share.copyFailed}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
