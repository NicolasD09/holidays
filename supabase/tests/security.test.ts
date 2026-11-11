import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type BudgetFixture,
  budgetSummary,
  castVote,
  closeCategory,
  configured,
  createBudgetTrip,
  createTrip,
  destroyTrip,
  device,
  expectRpcToFail,
  type Fixture,
  joinTrip,
  reopenCategory,
  setBudget,
  signedInDevice,
  supabaseUrl,
} from './helpers'

/**
 * Tests de sécurité obligatoires — doc 04 §4.7.
 *
 * Ils ne testent pas l'interface : ils attaquent l'API avec les droits d'un
 * navigateur. Un `if` dans un composant n'a jamais protégé personne.
 *
 * Rappel doc 08 §8.2 : si l'un de ces tests échoue, je ne contourne pas, je
 * remonte.
 */

if (!configured) {
  console.warn(
    '⚠️  Tests de sécurité ignorés : VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY absents.',
  )
}

describe.skipIf(!configured)(`Sécurité RLS · ${supabaseUrl}`, () => {
  const toClean: Array<Pick<Fixture, 'client' | 'tripId'>> = []

  afterAll(async () => {
    for (const fixture of toClean) await destroyTrip(fixture)
  })

  // ───────────────────────────────────────────────────────────────── n° 1
  describe('1. Un appareil non participant ne lit rien, même en connaissant les UUID', () => {
    let target: Fixture
    let intruder: Awaited<ReturnType<typeof signedInDevice>>

    beforeAll(async () => {
      target = await createTrip(['Lisbonne', 'Porto'])
      toClean.push(target)
      await castVote(target.client, target.optionIds[0]!, 1)
      intruder = await signedInDevice()
    })

    it('ne lit pas le sondage', async () => {
      const { data, error } = await intruder.from('trips').select('*').eq('id', target.tripId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('ne lit pas les participants', async () => {
      const { data } = await intruder.from('participants').select('*').eq('trip_id', target.tripId)
      expect(data).toHaveLength(0)
    })

    it('ne lit ni les catégories, ni les propositions, ni les votes', async () => {
      const [categories, options, votes] = await Promise.all([
        intruder.from('categories').select('*').eq('trip_id', target.tripId),
        intruder.from('options').select('*').eq('trip_id', target.tripId),
        intruder.from('votes').select('*').eq('trip_id', target.tripId),
      ])
      expect(categories.data).toHaveLength(0)
      expect(options.data).toHaveLength(0)
      expect(votes.data).toHaveLength(0)
    })

    it('ne lit aucun score agrégé', async () => {
      const { data } = await intruder.from('option_scores').select('*').eq('trip_id', target.tripId)
      expect(data).toHaveLength(0)
    })

    it('ne peut pas voter', async () => {
      const message = await expectRpcToFail(intruder, 'app_cast_vote', {
        p_option_id: target.optionIds[0],
        p_value: 1,
      })
      expect(message).toContain('not_participant')
    })

    it('ne peut pas s’inscrire lui-même dans la table participants', async () => {
      const { error } = await intruder.from('participants').insert({
        trip_id: target.tripId,
        display_name: 'Intrus',
      })
      expect(error).not.toBeNull()
    })

    it('ne peut pas fabriquer un sondage en écrivant directement dans trips', async () => {
      const { error } = await intruder.from('trips').insert({
        slug: 'intrusintrusintrus',
        title: 'Sondage forgé',
      })
      expect(error).not.toBeNull()
    })

    it('n’obtient que l’aperçu public, et seulement avec le slug', async () => {
      const anonymous = device()
      const { data, error } = await anonymous.rpc('app_trip_preview', { p_slug: target.slug })
      expect(error).toBeNull()
      const preview = data as Record<string, unknown>
      expect(preview.title).toEqual(expect.any(String))
      expect(preview).not.toHaveProperty('options')
      expect(preview).not.toHaveProperty('votes')
      expect(preview.is_participant).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────── n° 2
  describe('2. Deux sondages sont hermétiques l’un à l’autre', () => {
    let tripA: Fixture
    let tripB: Fixture

    beforeAll(async () => {
      tripA = await createTrip(['Athènes'])
      tripB = await createTrip(['Oslo'])
      toClean.push(tripA, tripB)
      await castVote(tripA.client, tripA.optionIds[0]!, 1)
      await castVote(tripB.client, tripB.optionIds[0]!, 1)
    })

    it('l’organisateur de A ne voit que A', async () => {
      const { data } = await tripA.client.from('trips').select('id')
      expect(data?.map((trip) => trip.id)).toEqual([tripA.tripId])
    })

    it('l’organisateur de A ne lit aucun vote de B', async () => {
      const { data } = await tripA.client.from('votes').select('*').eq('trip_id', tripB.tripId)
      expect(data).toHaveLength(0)
    })

    it('l’organisateur de A ne peut pas ajouter de proposition dans B', async () => {
      const { error } = await tripA.client.from('options').insert({
        trip_id: tripB.tripId,
        category_id: tripB.categoryId,
        title: 'Proposition injectée',
        created_by: tripA.participantId,
      })
      expect(error).not.toBeNull()
    })
  })

  // ───────────────────────────────────────────────────────────────── n° 2 bis
  //
  // Le « n° 2 » du doc 04 §4.7, dans sa numérotation : `budget_answers` d'un
  // autre participant est illisible, **y compris pour l'organisateur**. Il
  // ne pouvait pas exister avant la table (sprint 6).
  describe('2 bis. Budget : le montant d’autrui est illisible, organisateur compris', () => {
    let trip: BudgetFixture
    let thomas: Awaited<ReturnType<typeof joinTrip>>
    let sarah: Awaited<ReturnType<typeof joinTrip>>
    let julien: Awaited<ReturnType<typeof joinTrip>>

    beforeAll(async () => {
      trip = await createBudgetTrip()
      toClean.push(trip)
      thomas = await joinTrip(trip.slug, 'Thomas')
      sarah = await joinTrip(trip.slug, 'Sarah')
      julien = await joinTrip(trip.slug, 'Julien')
      await setBudget(thomas, trip.categoryId, 950)
      await setBudget(sarah, trip.categoryId, 700)
    })

    it('l’organisateur ne lit aucune ligne de budget_answers', async () => {
      const { data, error } = await trip.client
        .from('budget_answers')
        .select('*')
        .eq('trip_id', trip.tripId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('l’organisateur ne lit rien non plus sans aucun filtre', async () => {
      const { data } = await trip.client.from('budget_answers').select('amount')
      expect(data).toHaveLength(0)
    })

    it('un participant ne lit que sa propre ligne', async () => {
      const { data } = await sarah.from('budget_answers').select('amount').eq('trip_id', trip.tripId)
      expect(data).toEqual([{ amount: 700 }])
    })

    it('personne n’écrit directement dans la table, pas même sa propre ligne', async () => {
      const { error } = await trip.client.from('budget_answers').insert({
        trip_id: trip.tripId,
        category_id: trip.categoryId,
        participant_id: trip.participantId,
        amount: 1,
      })
      expect(error).not.toBeNull()
    })

    it('l’organisateur ne modifie ni ne supprime le montant d’autrui', async () => {
      await trip.client.from('budget_answers').update({ amount: 1 }).eq('trip_id', trip.tripId)
      await trip.client.from('budget_answers').delete().eq('trip_id', trip.tripId)

      const { data } = await thomas.from('budget_answers').select('amount')
      expect(data).toEqual([{ amount: 950 }])
    })

    it('sans avoir répondu, l’organisateur n’obtient pas le résumé', async () => {
      const summary = await budgetSummary(trip.client, trip.categoryId)
      expect(summary.status).toBe('answer_first')
      expect(summary).not.toHaveProperty('min')
      expect(summary).not.toHaveProperty('curve')
    })

    it('à 2 réponses, le résumé ne contient aucun montant (RM-10)', async () => {
      const summary = await budgetSummary(sarah, trip.categoryId)
      expect(summary).toEqual({ status: 'insufficient', respondents: 2, answered: true })
    })

    it('à 3 réponses, le résumé s’ouvre — en agrégats, sans prénom ni identifiant', async () => {
      await setBudget(julien, trip.categoryId, 1200)

      const summary = await budgetSummary(julien, trip.categoryId)
      expect(summary).toMatchObject({
        status: 'ready',
        respondents: 3,
        min: 700,
        median: 950,
        max: 1200,
      })

      const raw = JSON.stringify(summary)
      expect(raw).not.toMatch(/Thomas|Sarah|Julien|Marie/)
      expect(raw).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
      expect(raw).not.toContain('participant')
    })

    it('même à 3 réponses, l’organisateur ne lit toujours aucune ligne', async () => {
      const { data } = await trip.client.from('budget_answers').select('*')
      expect(data).toHaveLength(0)
    })

    it('un appareil étranger au sondage n’obtient ni ligne ni résumé', async () => {
      const intruder = await signedInDevice()
      const { data } = await intruder.from('budget_answers').select('*').eq('trip_id', trip.tripId)
      expect(data).toHaveLength(0)

      const message = await expectRpcToFail(intruder, 'app_budget_summary', {
        p_category: trip.categoryId,
      })
      expect(message).toContain('not_participant')
    })

    it('refuse un montant hors bornes', async () => {
      const message = await expectRpcToFail(thomas, 'app_set_budget', {
        p_category: trip.categoryId,
        p_amount: -1,
      })
      expect(message).toContain('invalid_amount')
    })
  })

  // ───────────────────────────────────────────────────────────────── n° 3
  describe('3. Mode aveugle : les votes d’autrui restent invisibles avant d’avoir voté', () => {
    let trip: Fixture
    let guest: Awaited<ReturnType<typeof joinTrip>>

    beforeAll(async () => {
      trip = await createTrip(['Lisbonne', 'Porto'])
      toClean.push(trip)

      const { error } = await trip.client
        .from('trips')
        .update({ blind_mode: true })
        .eq('id', trip.tripId)
      expect(error).toBeNull()

      await castVote(trip.client, trip.optionIds[0]!, 1)
      await castVote(trip.client, trip.optionIds[1]!, -1)

      guest = await joinTrip(trip.slug, 'Thomas')
    })

    it('ne renvoie aucun vote d’autrui via l’API brute', async () => {
      const { data, error } = await guest.from('votes').select('*').eq('trip_id', trip.tripId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('ne laisse pas fuiter les scores par la vue agrégée', async () => {
      const { data } = await guest.from('option_scores').select('*').eq('trip_id', trip.tripId)
      for (const row of data ?? []) {
        expect(row.yes_count).toBe(0)
        expect(row.no_count).toBe(0)
        expect(row.score).toBe(0)
      }
    })

    it('refuse les résultats avec une erreur explicite', async () => {
      const message = await expectRpcToFail(guest, 'app_category_results', {
        p_category: trip.categoryId,
      })
      expect(message).toContain('blind_mode_active')
    })

    it('compte qui a voté sans rien dire de ce qu’il a voté', async () => {
      // La participation se compte en base (migration 9) : sans ça, le hub
      // affichait « 0 a répondu » à qui n'avait pas encore voté.
      const { data, error } = await guest.rpc('app_trip_participation', { p_trip: trip.tripId })
      expect(error).toBeNull()

      const entry = (data as Record<string, { respondents: string[]; count: number }>)[
        trip.categoryId
      ]
      expect(entry).toEqual({ respondents: [trip.participantId], count: 1 })
    })

    it('ouvre les résultats dès le premier vote, et pas avant', async () => {
      await castVote(guest, trip.optionIds[0]!, 1)

      const { data, error } = await guest.rpc('app_category_results', {
        p_category: trip.categoryId,
      })
      expect(error).toBeNull()

      const results = data as Array<Record<string, number>>
      const winner = results[0]
      expect(winner?.yes_count).toBe(2)
      expect(results.some((row) => row.no_count === 1)).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────────── n° 4
  describe('4. Un participant non organisateur ne touche pas à la structure du sondage', () => {
    let trip: Fixture
    let guest: Awaited<ReturnType<typeof joinTrip>>

    beforeAll(async () => {
      trip = await createTrip(['Lisbonne'])
      toClean.push(trip)
      guest = await joinTrip(trip.slug, 'Thomas')
    })

    it('ne renomme pas le sondage', async () => {
      const { data } = await guest
        .from('trips')
        .update({ title: 'Détourné' })
        .eq('id', trip.tripId)
        .select('id')
      expect(data).toHaveLength(0)

      const { data: unchanged } = await trip.client
        .from('trips')
        .select('title')
        .eq('id', trip.tripId)
        .single()
      expect(unchanged?.title).not.toBe('Détourné')
    })

    it('n’active pas le mode aveugle', async () => {
      const { data } = await guest
        .from('trips')
        .update({ blind_mode: true })
        .eq('id', trip.tripId)
        .select('id')
      expect(data).toHaveLength(0)
    })

    it('ne clôture pas une catégorie, ni par la RPC ni par un update direct', async () => {
      const message = await expectRpcToFail(guest, 'app_close_category', {
        p_category: trip.categoryId,
        p_option: trip.optionIds[0],
      })
      expect(message).toContain('not_organizer')

      // Depuis la migration 9, `status` n'est plus inscriptible directement,
      // pour personne : le refus tombe avant même la policy.
      const { data, error } = await guest
        .from('categories')
        .update({ status: 'closed' })
        .eq('id', trip.categoryId)
        .select('id')
      expect(error).not.toBeNull()
      expect(data ?? []).toHaveLength(0)
    })

    it('ne lit ni n’écrit de décision hors de la clôture', async () => {
      const { error } = await guest.from('decisions').insert({
        trip_id: trip.tripId,
        category_id: trip.categoryId,
        free_text: 'Détourné',
      })
      expect(error).not.toBeNull()
    })

    it('ne supprime pas le sondage', async () => {
      const { data } = await guest.from('trips').delete().eq('id', trip.tripId).select('id')
      expect(data).toHaveLength(0)
    })

    it('ne se promeut pas organisateur', async () => {
      const { error } = await guest
        .from('participants')
        .update({ is_organizer: true })
        .eq('trip_id', trip.tripId)
        .select('id')
      // L'index unique « un seul organisateur » verrouille la promotion même si
      // la policy « je modifie ma propre ligne » laissait passer l'écriture.
      expect(error).not.toBeNull()
    })

    it('ne vote pas à la place d’un autre participant', async () => {
      const { error } = await guest.from('votes').insert({
        trip_id: trip.tripId,
        category_id: trip.categoryId,
        option_id: trip.optionIds[0]!,
        participant_id: trip.participantId,
        value: 1,
      })
      expect(error).not.toBeNull()
    })
  })

  // ───────────────────────────────────────────────────────────────── règles
  describe('Règles métier appliquées côté serveur, pas côté écran', () => {
    let trip: Fixture

    beforeAll(async () => {
      trip = await createTrip(['Lisbonne'])
      toClean.push(trip)
    })

    it('refuse une valeur de vote hors -1 / 0 / 1', async () => {
      const message = await expectRpcToFail(trip.client, 'app_cast_vote', {
        p_option_id: trip.optionIds[0],
        p_value: 5,
      })
      expect(message).toMatch(/invalid_vote_value|value/)
    })

    it('refuse tout vote dans une catégorie clôturée', async () => {
      await closeCategory(trip.client, trip.categoryId, trip.optionIds[0]!)

      const message = await expectRpcToFail(trip.client, 'app_cast_vote', {
        p_option_id: trip.optionIds[0],
        p_value: 1,
      })
      expect(message).toContain('category_closed')

      await reopenCategory(trip.client, trip.categoryId)
    })

    it('même l’organisateur ne clôture pas par un update direct', async () => {
      const { error } = await trip.client
        .from('categories')
        .update({ status: 'closed' })
        .eq('id', trip.categoryId)
      expect(error).not.toBeNull()

      const { error: tripError } = await trip.client
        .from('trips')
        .update({ status: 'closed' })
        .eq('id', trip.tripId)
      expect(tripError).not.toBeNull()
    })

    it('clôturer la dernière catégorie clôture le sondage, rouvrir le rouvre', async () => {
      const closed = await closeCategory(trip.client, trip.categoryId, trip.optionIds[0]!)
      expect(closed.trip_status).toBe('closed')

      const { data } = await trip.client
        .from('decisions')
        .select('option_id, payload')
        .eq('category_id', trip.categoryId)
        .single()
      expect(data?.option_id).toBe(trip.optionIds[0])

      const reopened = await reopenCategory(trip.client, trip.categoryId)
      expect(reopened.trip_status).toBe('open')

      const { data: gone } = await trip.client
        .from('decisions')
        .select('id')
        .eq('category_id', trip.categoryId)
      expect(gone).toHaveLength(0)
    })

    it('rend l’adhésion idempotente et déduplique les prénoms', async () => {
      const twin = await joinTrip(trip.slug, 'Marie')
      const { data } = await twin.from('participants').select('display_name').eq('trip_id', trip.tripId)
      const names = (data ?? []).map((row) => row.display_name).sort()
      expect(names).toEqual(['Marie', 'Marie (2)'])
    })

    it('génère un slug de 16 caractères en base58', () => {
      expect(trip.slug).toMatch(/^[1-9A-HJ-NP-Za-km-z]{16}$/)
    })
  })
})
