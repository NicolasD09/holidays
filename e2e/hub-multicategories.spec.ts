import { expect, test, type Page } from '@playwright/test'
import { labels } from '../src/lib/labels'

/**
 * Le parcours du sprint 3 : un sondage à plusieurs axes, et un participant
 * qui sait où il en est.
 *
 * Marie crée trois catégories et les garnit → Thomas rejoint, parcourt le
 * hub, vote partout → le hub dit qu'il est à jour, et que Marie manque encore.
 *
 * **Règle apprise au run #8** (doc 11 §11.1 D) : le vote est optimiste,
 * `aria-checked` bascule avant la réponse du serveur. Chaque fois que ce test
 * quitte un écran ou change de contexte, il s'ancre d'abord sur une donnée
 * **venue du serveur** — un décompte agrégé, une pastille recalculée — jamais
 * sur l'état peint par la mutation.
 */

const configured = Boolean(process.env.VITE_SUPABASE_URL)

test.describe('hub multi-catégories', () => {
  test.skip(
    !configured,
    'Sans VITE_SUPABASE_URL ni clé publiable, la suite ne peut pas parler à holidays-dev.',
  )

  test('un participant parcourt trois catégories et se sait à jour', async ({ browser }) => {
    const marie = await browser.newContext()
    const thomas = await browser.newContext()
    const pageMarie = await marie.newPage()
    const pageThomas = await thomas.newPage()

    // ── Marie crée un sondage à trois catégories ─────────────────────────
    await pageMarie.goto('/new')
    await pageMarie.getByLabel(labels.create.titleLabel).fill('Vacances multi E2E')
    await pageMarie.getByLabel(labels.create.nameLabel).fill('Marie')

    await pageMarie.getByRole('checkbox', { name: labels.categories.lodging }).check()
    await pageMarie.getByRole('checkbox', { name: labels.categories.activity }).check()

    // Une catégorie dont l'écran n'existe pas encore reste hors de portée :
    // la carte est là, mais on ne peut pas la cocher. Depuis le sprint 4,
    // Dates est cochable — seul Budget attend encore son écran (sprint 6).
    await expect(
      pageMarie.getByRole('checkbox', { name: labels.categories.budget }),
    ).toBeDisabled()

    await pageMarie.getByRole('button', { name: labels.create.submit }).click()

    const lien = pageMarie.getByLabel(labels.share.linkLabel)
    await expect(lien).toBeVisible()
    const url = await lien.inputValue()
    await pageMarie.getByRole('button', { name: labels.share.continue }).click()

    // Trois catégories : on arrive sur le hub, pas sur un écran de vote.
    await expect(
      pageMarie.getByRole('heading', { name: 'Vacances multi E2E' }),
    ).toBeVisible()
    for (const nom of [
      labels.categories.destination,
      labels.categories.lodging,
      labels.categories.activity,
    ]) {
      await expect(pageMarie.getByRole('heading', { name: nom })).toBeVisible()
    }

    // ── Marie garnit chaque catégorie ────────────────────────────────────
    // Une catégorie vide n'est jamais « à voter » : sans propositions, le
    // parcours de Thomas n'aurait rien à parcourir.
    await proposer(pageMarie, labels.categories.destination, 'Lisbonne')
    await proposer(pageMarie, labels.categories.lodging, 'Airbnb Alfama')
    await proposer(pageMarie, labels.categories.activity, 'Surf')

    // ── Thomas rejoint ───────────────────────────────────────────────────
    await pageThomas.goto(url)
    await pageThomas.getByLabel(labels.join.nameLabel).fill('Thomas')
    await pageThomas.getByRole('button', { name: labels.join.submit }).click()

    // Le hub s'ouvre sur un état lu côté serveur : trois catégories, aucune
    // traitée.
    await expect(pageThomas.getByText(labels.hub.progress(0, 3))).toBeVisible()
    // `exact` n'est pas un détail : par défaut `getByText` cherche une
    // sous-chaîne, et « À voter » se retrouve dans « Continuer à voter ».
    // Sans ça, la pastille de statut est comptée une fois de trop.
    await expect(
      pageThomas.getByText(labels.hub.statusToVote, { exact: true }),
    ).toHaveCount(3)

    // ── Il enchaîne les trois ────────────────────────────────────────────
    await pageThomas.getByRole('button', { name: labels.hub.continue }).click()

    for (const attendu of ['Lisbonne', 'Airbnb Alfama', 'Surf']) {
      await expect(pageThomas.getByRole('heading', { name: attendu })).toBeVisible()
      await voterOui(pageThomas, attendu)

      const suivant = pageThomas.getByRole('link', { name: labels.categoryNav.next })
      if (await suivant.isVisible()) await suivant.click()
    }

    // ── Retour au hub : il est à jour, et Marie manque encore ────────────
    await pageThomas.getByRole('link', { name: labels.categoryNav.backToHub }).click()

    await expect(
      pageThomas.getByText(labels.hub.upToDateWithMissing(['Marie'])),
    ).toBeVisible()
    await expect(
      pageThomas.getByText(labels.hub.statusVoted, { exact: true }),
    ).toHaveCount(3)

    // Plus rien à faire : l'action ancrée disparaît plutôt que de mener dans
    // le vide.
    await expect(
      pageThomas.getByRole('button', { name: labels.hub.continue }),
    ).toHaveCount(0)

    await marie.close()
    await thomas.close()
  })
})

function carte(page: Page, titre: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name: titre }) })
}

/** Ouvre une catégorie depuis le hub, y ajoute une proposition, et revient. */
async function proposer(page: Page, categorie: string, titre: string) {
  await page.getByRole('link', { name: new RegExp(categorie) }).first().click()
  await expect(page.getByRole('heading', { name: categorie, level: 1 })).toBeVisible()

  await page.getByRole('button', { name: labels.addOption.open }).click()
  await page.getByLabel(labels.addOption.titleLabel).fill(titre)
  await page.getByRole('button', { name: labels.addOption.submit }).click()

  // La proposition est relue depuis le serveur après l'insert : l'attendre
  // ici, c'est s'assurer que le hub la comptera.
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  await page.getByRole('link', { name: labels.categoryNav.backToHub }).click()
}

/**
 * Vote « Oui » et attend que le **décompte agrégé** le reflète — pas
 * seulement `aria-checked`, qui n'est que l'état optimiste.
 */
async function voterOui(page: Page, titre: string) {
  const bouton = carte(page, titre).getByRole('radio', { name: labels.voting.yes })
  await bouton.click()
  await expect(bouton).toHaveAttribute('aria-checked', 'true')
  await expect(carte(page, titre).getByText(labels.voting.tally(1, 0, 0))).toBeVisible()
}
