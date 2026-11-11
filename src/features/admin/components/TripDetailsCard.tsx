import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TripPatch } from '@/features/admin/api/updateTrip'
import { EmojiPicker } from '@/features/trip/components/EmojiPicker'
import { labels } from '@/lib/labels'
import type { Trip } from '@/types/domain'

/** Assez pour une phrase de contexte ; la table en accepte 2000. */
export const TRIP_DESCRIPTION_MAX = 500

/**
 * Titre, emoji, description et mode aveugle (doc 05 §5.3 É7).
 *
 * **Le mode aveugle se bascule à tout moment** et n'efface rien. Activé en
 * cours de route, il masque les résultats d'une catégorie à qui n'y a pas
 * encore voté ; ceux qui ont voté continuent de voir. Désactivé, tout
 * redevient visible. C'est une policy (ADR-007) : l'écran n'a rien à cacher
 * lui-même.
 *
 * Le hub, lui, ne ment plus en aveugle : la participation se compte en base
 * depuis la migration 9.
 */
export function TripDetailsCard({
  trip,
  pending,
  saved,
  onSave,
}: {
  trip: Trip
  pending: boolean
  saved: boolean
  onSave: (patch: TripPatch) => void
}) {
  const ids = useId()
  const [title, setTitle] = useState(trip.title)
  const [emoji, setEmoji] = useState(trip.cover_emoji ?? '🏖️')
  const [description, setDescription] = useState(trip.description ?? '')
  const [blind, setBlind] = useState(trip.blind_mode)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    title !== trip.title ||
    emoji !== (trip.cover_emoji ?? '🏖️') ||
    description !== (trip.description ?? '') ||
    blind !== trip.blind_mode

  function save() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError(labels.tripSettings.errorTitleRequired)
      return
    }
    setError(null)
    onSave({
      title: trimmed,
      cover_emoji: emoji,
      description: description.trim() || null,
      blind_mode: blind,
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4">
      <h2 className="text-lg font-semibold">{labels.tripSettings.sectionTrip}</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-title`} className="font-medium">
          {labels.tripSettings.titleField}
        </label>
        <Input
          id={`${ids}-title`}
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">{labels.tripSettings.emojiField}</span>
        <EmojiPicker value={emoji} onChange={setEmoji} label={labels.tripSettings.emojiField} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-description`} className="font-medium">
          {labels.tripSettings.descriptionField}
        </label>
        <textarea
          id={`${ids}-description`}
          rows={3}
          maxLength={TRIP_DESCRIPTION_MAX}
          placeholder={labels.tripSettings.descriptionPlaceholder}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 py-2 text-base text-text placeholder:text-text-muted"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--color-brand)]"
          checked={blind}
          onChange={(event) => setBlind(event.target.checked)}
        />
        <span className="flex flex-col">
          <span className="text-text">{labels.tripSettings.blindMode}</span>
          <span className="text-sm text-text-muted">{labels.tripSettings.blindModeHint}</span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-no">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? labels.tripSettings.saving : labels.tripSettings.save}
        </Button>
        {saved && !dirty ? (
          <p role="status" className="text-sm text-text-muted">
            {labels.tripSettings.saved}
          </p>
        ) : null}
      </div>
    </section>
  )
}
