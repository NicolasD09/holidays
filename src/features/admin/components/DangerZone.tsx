import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { labels } from '@/lib/labels'

/**
 * Zone sensible de l'écran de réglages (doc 05 §5.3 É7).
 *
 * La suppression est **définitive et collective** : elle efface le sondage
 * pour tous les participants, pas seulement pour l'organisateur. Trois
 * frictions délibérées, et aucune n'est de la décoration :
 *
 * 1. la zone est visuellement à part, en bas, bordée de la couleur du refus ;
 * 2. un premier bouton ouvre une modale — on ne supprime pas d'un seul tap ;
 * 3. la modale exige de **recopier le titre** du sondage. C'est la seule
 *    friction qui résiste au clic réflexe, parce qu'elle demande de lire.
 *
 * La modale ne se ferme ni au clic extérieur ni à Échap tant qu'une
 * suppression est en cours : perdre le retour d'une action irréversible
 * laisserait l'organisateur sans savoir ce qui s'est passé.
 */
export function DangerZone({
  tripTitle,
  pending,
  onDelete,
}: {
  tripTitle: string
  pending: boolean
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')

  const matches = typed.trim() === tripTitle.trim()

  function close() {
    if (pending) return
    setOpen(false)
    setTyped('')
  }

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-no bg-surface-2 p-4">
      <h2 className="text-lg font-semibold text-no">{labels.danger.title}</h2>
      <p className="text-sm text-text-muted">{labels.danger.consequences}</p>

      <Button
        variant="outline"
        className="self-start border-no text-no"
        onClick={() => setOpen(true)}
      >
        {labels.danger.deleteCta}
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
          onPointerDownOutside={(event) => pending && event.preventDefault()}
          onInteractOutside={(event) => pending && event.preventDefault()}
        >
          <DialogTitle className="text-xl font-semibold">
            {labels.danger.dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {labels.danger.consequences}
          </DialogDescription>

          <div className="flex flex-col gap-2">
            <label htmlFor="delete-confirm" className="text-sm font-medium">
              {labels.danger.confirmPrompt(tripTitle)}
            </label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              aria-label={labels.danger.confirmLabel}
              value={typed}
              disabled={pending}
              onChange={(event) => setTyped(event.target.value)}
            />
            {typed.length > 0 && !matches ? (
              <p className="text-sm text-text-muted">{labels.danger.mismatch}</p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={pending} onClick={close}>
              {labels.danger.cancel}
            </Button>
            <Button
              className="bg-no text-vote-fg hover:bg-no"
              disabled={!matches || pending}
              onClick={onDelete}
            >
              {pending ? labels.danger.deleting : labels.danger.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
