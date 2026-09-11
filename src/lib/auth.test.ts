import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const signInAnonymously = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, signInAnonymously } },
}))

const session = { access_token: 'jwt', user: { id: 'device-1' } }

async function loadAuth() {
  vi.resetModules()
  return import('@/lib/auth')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureSession', () => {
  it('réutilise la session existante sans en créer une nouvelle', async () => {
    getSession.mockResolvedValue({ data: { session } })
    const { ensureSession } = await loadAuth()

    await expect(ensureSession()).resolves.toBe(session)
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('crée une session anonyme quand il n’y en a aucune', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signInAnonymously.mockResolvedValue({ data: { session }, error: null })
    const { ensureSession } = await loadAuth()

    await expect(ensureSession()).resolves.toBe(session)
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('ne crée qu’une seule session quand deux écrans la demandent en même temps', async () => {
    // Le cas qui compte : deux JWT concurrents, c'est un participant orphelin
    // et des votes perdus.
    getSession.mockResolvedValue({ data: { session: null } })
    signInAnonymously.mockResolvedValue({ data: { session }, error: null })
    const { ensureSession } = await loadAuth()

    const [first, second] = await Promise.all([ensureSession(), ensureSession()])

    expect(first).toBe(session)
    expect(second).toBe(session)
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('remonte une erreur explicite quand l’auth anonyme est refusée', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signInAnonymously.mockResolvedValue({ data: { session: null }, error: { message: 'disabled' } })
    const { ensureSession, AuthUnavailableError } = await loadAuth()

    await expect(ensureSession()).rejects.toBeInstanceOf(AuthUnavailableError)
  })

  it('retente après un échec plutôt que de rester bloqué', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    signInAnonymously.mockResolvedValueOnce({ data: { session: null }, error: { message: 'réseau' } })
    signInAnonymously.mockResolvedValueOnce({ data: { session }, error: null })
    const { ensureSession } = await loadAuth()

    await expect(ensureSession()).rejects.toThrow()
    await expect(ensureSession()).resolves.toBe(session)
  })
})

describe('getCurrentUserId', () => {
  it('renvoie l’identifiant de l’appareil sans créer de session', async () => {
    getSession.mockResolvedValue({ data: { session } })
    const { getCurrentUserId } = await loadAuth()

    await expect(getCurrentUserId()).resolves.toBe('device-1')
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('renvoie null quand l’appareil n’est pas encore connu', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const { getCurrentUserId } = await loadAuth()

    await expect(getCurrentUserId()).resolves.toBeNull()
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
})
