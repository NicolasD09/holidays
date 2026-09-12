import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { PageShell } from '@/components/common/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTrip } from '@/features/trip/api/createTrip'
import {
  createDefaultSelection,
  toCategoryDrafts,
  validateDatesConfig,
  type CategorySelection,
} from '@/features/trip/components/category-catalogue'
import { CategoryPicker } from '@/features/trip/components/CategoryPicker'
import { EmojiPicker } from '@/features/trip/components/EmojiPicker'
import { ShareSheet } from '@/features/trip/components/ShareSheet'
import { toUserMessage } from '@/lib/errors'
import { labels } from '@/lib/labels'
import { routes } from '@/lib/routes'
import { tripUrl } from '@/lib/share'

/**
 * É2 — création d'un sondage (doc 05 §5.3).
 *
 * Une seule page qui défile, pas un assistant : l'objectif est un lien
 * partageable en moins de 90 secondes, et chaque étape supplémentaire est une
 * occasion d'abandonner.
 *
 * Les bornes de saisie reprennent celles des contraintes de table (120 et 40
 * caractères) : mieux vaut le dire avant l'envoi qu'après un aller-retour.
 */

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, labels.create.errorTitleRequired)
    .max(120, labels.create.errorTitleTooLong),
  displayName: z
    .string()
    .trim()
    .min(1, labels.create.errorNameRequired)
    .max(40, labels.create.errorNameTooLong),
})

type FormValues = z.infer<typeof formSchema>

export function CreateTripPage() {
  const navigate = useNavigate()
  const [emoji, setEmoji] = useState('🏖️')
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategorySelection>(createDefaultSelection)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: '', displayName: '' },
  })

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      createTrip({
        title: values.title,
        emoji,
        displayName: values.displayName,
        categories: toCategoryDrafts(categories),
      }),
    onSuccess: (trip) => setCreatedSlug(trip.slug),
  })

  /**
   * Le sélecteur de catégories vit hors de react-hook-form : son état n'est
   * pas un champ mais une petite structure. Sa seule règle de validation —
   * une catégorie libre cochée doit porter un nom — est donc vérifiée ici.
   */
  function validateCategories(): boolean {
    if (categories.kinds.includes('dates')) {
      const problem = validateDatesConfig(categories.dates)
      if (problem) {
        setCategoryError(labels.create[problem])
        return false
      }
    }

    if (!categories.custom.enabled) return true
    const label = categories.custom.label.trim()
    if (!label) {
      setCategoryError(labels.create.errorCustomLabelRequired)
      return false
    }
    if (label.length > 60) {
      setCategoryError(labels.create.errorCustomLabelTooLong)
      return false
    }
    return true
  }

  // En cas d'échec réseau, le formulaire conserve sa saisie et propose de
  // réessayer (doc 05 §5.3) : on ne réinitialise rien, on relance la mutation
  // avec les mêmes valeurs.
  const onSubmit = handleSubmit((values) => {
    if (!validateCategories()) return
    create.mutate(values)
  })

  return (
    <PageShell className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{labels.create.title}</h1>
        <p className="text-text-muted">{labels.create.subtitle}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="trip-title" className="font-medium">
            {labels.create.titleLabel}
          </label>
          <Input
            id="trip-title"
            autoFocus
            maxLength={120}
            enterKeyHint="next"
            placeholder={labels.create.titlePlaceholder}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'trip-title-error' : 'trip-title-hint'}
            {...register('title')}
          />
          {errors.title ? (
            <p id="trip-title-error" role="alert" className="text-sm text-no">
              {errors.title.message}
            </p>
          ) : (
            <p id="trip-title-hint" className="text-sm text-text-muted">
              {labels.create.titleHint}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium">{labels.create.emojiLabel}</span>
          <EmojiPicker value={emoji} onChange={setEmoji} label={labels.create.emojiLabel} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-medium">{labels.create.categoryLabel}</span>
          <p className="text-sm text-text-muted">{labels.create.categoryHint}</p>
          <CategoryPicker
            value={categories}
            onChange={(next) => {
              setCategories(next)
              setCategoryError(null)
            }}
            error={categoryError ?? undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="trip-name" className="font-medium">
            {labels.create.nameLabel}
          </label>
          <Input
            id="trip-name"
            autoComplete="given-name"
            maxLength={40}
            enterKeyHint="go"
            placeholder={labels.create.namePlaceholder}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? 'trip-name-error' : 'trip-name-hint'}
            {...register('displayName')}
          />
          {errors.displayName ? (
            <p id="trip-name-error" role="alert" className="text-sm text-no">
              {errors.displayName.message}
            </p>
          ) : (
            <p id="trip-name-hint" className="text-sm text-text-muted">
              {labels.create.nameHint}
            </p>
          )}
        </div>

        {create.isError ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-no">{toUserMessage(create.error)}</p>
            <Button type="button" variant="outline" onClick={() => create.mutate(getValues())}>
              {labels.error.tryAgain}
            </Button>
          </div>
        ) : null}

        <Button type="submit" size="lg" block disabled={create.isPending}>
          {create.isPending ? labels.create.submitting : labels.create.submit}
        </Button>
      </form>

      {createdSlug ? (
        <ShareSheet
          open
          title={getValues('title')}
          url={tripUrl(createdSlug)}
          onContinue={() => void navigate(routes.trip(createdSlug))}
        />
      ) : null}
    </PageShell>
  )
}
