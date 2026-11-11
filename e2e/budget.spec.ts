import { expect, test, type Page } from '@playwright/test'
import { labels } from '../src/lib/labels'

/**
 * Le parcours du sprint 6 : trois personnes donnent leur budget, et l'app
 * n'en montre qu'un résumé.
 *
 * Marie crée Destination + Budget → Marie et Thomas répondent : pas de résumé
 * à 2 réponses (RM-10) → Sarah répond : le résumé s'ouvre, le curseur dit
 * combien suivent → nulle part un montant n'est attaché à un prénom.
 *
 * **L'ancrage serveur** (doc 11 §11.1 D) est plus simple ici qu'ailleurs :
 * l'enregistrement n'est pas optimiste. Le texte « Ton montant est
 * enregistré » n'apparaît qu'après la réponse de `app_set_budget`. On attend
 * quand même l'acquittement de la RPC avant toute navigation — recharger trop
 * tôt annule la requête en vol (doc 15).
 */

const configured = Boolean(process.env.VITE_SUPABASE_URL)

/** `Intl` écrit « 1 200 € » avec des espaces insécables. */
const montant = (texte: string) => new RegExp(texte.replace(/ /g, '\\s'))

test.describe('budget confidentiel', () => {
  test.skip(
    !configured,
    'Sans VITE_SUPABASE_URL ni clé publiable, la suite ne peut pas parler à holidays-dev.',
  )

  test('trois budgets donnent un résumé, jamais un montant nominatif', async ({ browser }) => {
    const marie = await browser.newContext()
    const thomas = await browser.newContext()
    const sarah = await browser.newContext()
    const pageMarie = await marie.newPage()
    const pageThomas = await thomas.newPage()
    const pageSarah = await sarah.newPage()

    // ── Marie crée un sondage Destination + Budget ───────────────────────
    await pageMarie.goto('/new')
    await pageMarie.getByLabel(labels.create.titleLabel).fill('Vacances budget E2E')
    await pageMarie.getByLabel(labels.create.nameLabel).fill('Marie')
    await pageMarie.getByRole('checkbox', { name: labels.categories.budget }).check()
    await pageMarie
      .getByLabel(labels.create.budgetScopeField)
      .fill('Par personne, hors transport')
    await pageMarie.getByRole('button', { name: labels.create.submit }).click()

    const lien = pageMarie.getByLabel(labels.share.linkLabel)
    await expect(lien).toBeVisible()
    const url = await lien.inputValue()
    await pageMarie.getByRole('button', { name: labels.share.continue }).click()
    await expect(pageMarie.getByRole('heading', { name: 'Vacances budget E2E' })).toBeVisible()

    // ── Marie répond : seule, elle ne voit aucun résumé ──────────────────
    await ouvrirBudget(pageMarie)
    await expect(pageMarie.getByText('Par personne, hors transport')).toBeVisible()
    await expect(pageMarie.getByText(labels.budget.promise)).toBeVisible()
    await expect(pageMarie.getByText(labels.budget.answerFirst)).toBeVisible()

    await donnerBudget(pageMarie, '1200')
    await expect(pageMarie.getByText(labels.budget.insufficient)).toBeVisible()

    // ── Thomas répond : 2 réponses, toujours rien (RM-10) ────────────────
    await rejoindre(pageThomas, url, 'Thomas')
    await ouvrirBudget(pageThomas)
    await donnerBudget(pageThomas, '900')
    await expect(pageThomas.getByText(labels.budget.insufficient)).toBeVisible()
    await expect(pageThomas.getByText(labels.budget.respondents(2))).toBeVisible()
    await expect(pageThomas.getByRole('slider')).toHaveCount(0)

    // ── Sarah répond : le résumé s'ouvre ─────────────────────────────────
    await rejoindre(pageSarah, url, 'Sarah')
    await ouvrirBudget(pageSarah)
    await donnerBudget(pageSarah, '700')

    await expect(pageSarah.getByText(labels.budget.respondents(3))).toBeVisible()
    const curseur = pageSarah.getByRole('slider', { name: labels.budget.sliderLabel })
    // Ouvert sur le montant que tout le monde suit.
    await expect(curseur).toHaveValue('700')
    await expect(curseur).toHaveAttribute('aria-valuetext', montant('À 700 €, tout le monde suit.'))

    // Un cran plus haut, Sarah décroche — mais l'écran ne dit pas que c'est elle.
    await curseur.fill('725')
    await expect(curseur).toHaveAttribute(
      'aria-valuetext',
      montant('À 725 €, 2 personnes sur 3 suivent.'),
    )

    // ── La confidentialité, vue de l'organisatrice ───────────────────────
    // Marie recharge : tout ce qu'elle voit vient du serveur.
    await pageMarie.reload()
    await expect(pageMarie.getByText(labels.budget.respondents(3))).toBeVisible()
    await expect(pageMarie.getByRole('slider')).toBeVisible()

    const ecran = (await pageMarie.locator('main').innerText()).replace(/\s/g, ' ')
    // Son propre montant, oui. Un prénom à côté d'un montant, jamais.
    expect(ecran).toContain('1 200 €')
    expect(ecran).not.toMatch(/Thomas|Sarah/)

    // ── Le hub compte, sans nommer ───────────────────────────────────────
    await pageMarie.getByRole('link', { name: labels.categoryNav.backToHub }).click()
    await expect(
      pageMarie.getByText(montant(labels.hub.budgetComfortable('700 €'))),
    ).toBeVisible()
    await expect(pageMarie.getByText(labels.hub.participation(3, 3))).toBeVisible()

    await marie.close()
    await thomas.close()
    await sarah.close()
  })
})

async function rejoindre(page: Page, url: string, prenom: string) {
  await page.goto(url)
  await page.getByLabel(labels.join.nameLabel).fill(prenom)
  await page.getByRole('button', { name: labels.join.submit }).click()
  await expect(page.getByText(labels.hub.progress(0, 1))).toBeVisible()
}

/** Ouvre la catégorie Budget depuis le hub. */
async function ouvrirBudget(page: Page) {
  await page
    .getByRole('link', { name: new RegExp(labels.categories.budget) })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: labels.categories.budget, level: 1 }),
  ).toBeVisible()
}

/** Saisit un montant et attend que le serveur l'ait **acquitté**. */
async function donnerBudget(page: Page, valeur: string) {
  const ecriture = page.waitForResponse(
    (reponse) =>
      reponse.url().includes('app_set_budget') && reponse.request().method() === 'POST',
  )
  await page.getByLabel(labels.budget.question).fill(valeur)
  await page.getByRole('button', { name: labels.budget.save }).click()
  expect((await ecriture).ok()).toBe(true)
  await expect(page.getByRole('button', { name: labels.budget.update })).toBeVisible()
}
