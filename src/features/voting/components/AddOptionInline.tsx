import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { labels } from '@/lib/labels'

/**
 * Ajout d'une proposition, en bas de liste (doc 05 §5.3).
 *
 * Replié par défaut : la liste des propositions doit rester lisible, et
 * l'action principale de cet écran est de voter, pas de proposer.
 *
 * La contrainte d'URL reprend celle de la table (`^https?://`) — la dire ici
 * évite un aller-retour réseau pour une faute de frappe.
 */

const schema = z.object({
  title: z.string().trim().min(1, labels.addOption.errorTitleRequired).max(120),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine(
      (value) => value === '' || /^https?:\/\//.test(value),
      labels.addOption.errorUrl,
    ),
})

type Values = z.infer<typeof schema>

export function AddOptionInline({
  pending,
  onAdd,
}: {
  pending: boolean
  onAdd: (values: { title: string; url: string | null }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', url: '' },
  })

  if (!open) {
    return (
      <Button variant="outline" block onClick={() => setOpen(true)}>
        {labels.addOption.open}
      </Button>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    await onAdd({ title: values.title, url: values.url === '' ? null : values.url })
    reset()
    setOpen(false)
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface-2 p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="option-title" className="text-sm font-medium">
          {labels.addOption.titleLabel}
        </label>
        <Input
          id="option-title"
          autoFocus
          maxLength={120}
          placeholder={labels.addOption.titlePlaceholder}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'option-title-error' : undefined}
          {...register('title')}
        />
        {errors.title ? (
          <p id="option-title-error" role="alert" className="text-sm text-no">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="option-url" className="text-sm font-medium">
          {labels.addOption.urlLabel}
        </label>
        <Input
          id="option-url"
          type="url"
          inputMode="url"
          placeholder={labels.addOption.urlPlaceholder}
          aria-invalid={Boolean(errors.url)}
          aria-describedby={errors.url ? 'option-url-error' : undefined}
          {...register('url')}
        />
        {errors.url ? (
          <p id="option-url-error" role="alert" className="text-sm text-no">
            {errors.url.message}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? labels.addOption.submitting : labels.addOption.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {labels.addOption.cancel}
        </Button>
      </div>
    </form>
  )
}
