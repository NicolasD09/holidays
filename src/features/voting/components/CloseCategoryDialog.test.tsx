import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CloseCategoryDialog } from '@/features/voting/components/CloseCategoryDialog'
import { labels } from '@/lib/labels'
import { qk } from '@/lib/queryKeys'
import type { BudgetSummary, Category, Option, OptionResult } from '@/types/domain'

const listOptions = vi.hoisted(() => vi.fn<() => Promise<Option[]>>())
const fetchCategoryResults = vi.hoisted(() => vi.fn<() => Promise<OptionResult[] | null>>())
const fetchBudgetSummary = vi.hoisted(() => vi.fn<() => Promise<BudgetSummary>>())
vi.mock('@/features/voting/api/options', () => ({ listOptions }))
vi.mock('@/features/voting/api/categoryResults', () => ({ fetchCategoryResults }))
vi.mock('@/features/voting/api/budget', () => ({ fetchBudgetSummary }))
vi.mock('@/features/voting/api/availabilities', () => ({ listAvailabilities: vi.fn() }))

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    trip_id: 'trip',
    kind: 'destination',
    label: 'Destination',
    description: null,
    vote_mode: 'approval',
    status: 'open',
    position: 0,
    allow_participant_options: true,
    max_choices: null,
    window_start: null,
    window_end: null,
    nights: null,
    currency: 'EUR',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function option(id: string, title: string): Option {
  return {
    id,
    trip_id: 'trip',
    category_id: 'c1',
    title,
    description: null,
    url: null,
    image_url: null,
    meta: {},
    created_by: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
  }
}

const row = (id: string, title: string, yes: number, score: number): OptionResult => ({
  option_id: id,
  title,
  yes_count: yes,
  maybe_count: 0,
  no_count: 0,
  score,
  voter_count: yes,
})

function renderDialog(
  props: Partial<Parameters<typeof CloseCategoryDialog>[0]> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const onConfirm = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <CloseCategoryDialog
        category={category()}
        nonVoters={null}
        pending={false}
        error={null}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onConfirm }
}

const confirmButton = () => screen.getByRole('button', { name: labels.closure.confirm })

describe('CloseCategoryDialog', () => {
  beforeEach(() => {
    listOptions.mockResolvedValue([option('o1', 'Lisbonne'), option('o2', 'Porto')])
    fetchCategoryResults.mockResolvedValue([row('o2', 'Porto', 3, 6), row('o1', 'Lisbonne', 1, 2)])
  })

  it('pré-sélectionne la tête de liste', async () => {
    const { onConfirm } = renderDialog()

    const porto = await screen.findByRole('radio', { name: /Porto/ })
    expect(porto).toBeChecked()
    expect(screen.getByText(labels.closure.leading)).toBeInTheDocument()

    await userEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'option', optionId: 'o2' })
  })

  it('relit les scores à l’ouverture, même avec un cache encore « frais »', async () => {
    // Le cas de l'E2E : l'écran de vote a mis les scores en cache avant que
    // Thomas vote. Avec le `staleTime` de l'app (30 s), on trancherait sur
    // des chiffres périmés.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    })
    queryClient.setQueryData(qk.options('c1'), [option('o1', 'Lisbonne'), option('o2', 'Porto')])
    queryClient.setQueryData(qk.results('c1'), [row('o1', 'Lisbonne', 0, 0), row('o2', 'Porto', 0, 0)])

    renderDialog({}, queryClient)

    expect(await screen.findByRole('radio', { name: /Porto/ })).toBeChecked()
    expect(screen.getByText('3 oui · 0 ~ · 0 non')).toBeInTheDocument()
  })

  it('laisse l’organisateur trancher contre la tête de liste', async () => {
    const { onConfirm } = renderDialog()

    await userEvent.click(await screen.findByRole('radio', { name: /Lisbonne/ }))
    await userEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'option', optionId: 'o1' })
  })

  it('accepte une décision libre, mais pas vide', async () => {
    const { onConfirm } = renderDialog()

    await userEvent.click(await screen.findByRole('radio', { name: labels.closure.other }))
    expect(confirmButton()).toBeDisabled()

    await userEvent.type(screen.getByLabelText(labels.closure.otherLabel), 'On reste ici')
    await userEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'text', text: 'On reste ici' })
  })

  it('avertit des non-votants par un nombre, sans nommer personne', async () => {
    renderDialog({ nonVoters: 2 })
    expect(await screen.findByText(labels.closure.nonVoters(2))).toBeInTheDocument()
  })

  it('n’avertit de rien quand tout le monde s’est prononcé', async () => {
    renderDialog({ nonVoters: 0 })
    await screen.findByRole('radio', { name: /Porto/ })
    expect(screen.queryByText(/pas encore prononc/)).not.toBeInTheDocument()
  })

  it('ne suggère rien en mode aveugle : rien n’est coché, il faut choisir', async () => {
    fetchCategoryResults.mockResolvedValue(null)
    const { onConfirm } = renderDialog()

    const lisbonne = await screen.findByRole('radio', { name: /Lisbonne/ })
    expect(screen.getByText(labels.closure.blindHint)).toBeInTheDocument()
    expect(screen.getAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    )
    expect(confirmButton()).toBeDisabled()

    await userEvent.click(lisbonne)
    await userEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'option', optionId: 'o1' })
  })

  it('budget : propose le montant que tout le monde suit, et le dit', async () => {
    fetchBudgetSummary.mockResolvedValue({
      status: 'ready',
      respondents: 3,
      answered: true,
      min: 700,
      median: 900,
      max: 1200,
      step: 25,
      curve: [
        { amount: 700, followers: 3 },
        { amount: 900, followers: 2 },
        { amount: 1200, followers: 1 },
      ],
    })
    const { onConfirm } = renderDialog({
      category: category({ id: 'b1', kind: 'budget', label: 'Budget', vote_mode: 'amount' }),
    })

    const field = await screen.findByLabelText(labels.closure.amountLabel, { selector: 'input[inputmode]' })
    expect(field).toHaveValue('700')
    expect(screen.getByText(/tout le monde suit/)).toBeInTheDocument()

    await userEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'amount', amount: 700 })
  })
})
