import { expect, test, type Page } from '@playwright/test'
import { labels } from '../src/lib/labels'

/**
 * Le parcours du sprint 7 : l'organisatrice tranche, le groupe le voit, le
 * lien ouvre le récap.
 *
 * Marie crée Destination + Logement → Thomas vote Porto → Marie clôture la
 * destination sur **Lisbonne**, contre la tête de liste → Thomas, resté sur
 * l'écran, tente de voter : refusé par le serveur → Marie tranche le logement
 * en texte libre → le lien du sondage ouvre le récap → Marie rouvre, et tout
 * redevient modifiable.
 *
 * **Ancrage serveur** (doc 11 §11.1 D) : chaque clôture attend la réponse de
 * `app_close_category` avant d'aller plus loin, et ce qu'on vérifie chez
 * Thomas vient d'un rechargement — jamais de l'écran de Marie.
 */

const configured = Boolean(process.env.VITE_SUPABASE_URL)

test.describe('clôture et récap', () => {
  test.skip(
    !configured,
    'Sans VITE_SUPABASE_URL ni clé publiable, la suite ne peut pas parler à holidays-dev.',
  )

  test('l’organisatrice tranche, le lien ouvre le récap, rouvrir défait', async ({ browser }) => {
    const marie = await browser.newContext()
    const thomas = await browser.newContext()
    const pageMarie = await marie.newPage()
    const pageThomas = await thomas.newPage()

    // ── Marie crée Destination + Logement ────────────────────────────────
    await pageMarie.goto('/new')
    await pageMarie.getByLabel(labels.create.titleLabel).fill('Vacances clôture E2E')
    await pageMarie.getByLabel(labels.create.nameLabel).fill('Marie')
    await pageMarie.getByRole('checkbox', { name: labels.categories.lodging }).check()
    await pageMarie.getByRole('button', { name: labels.create.submit }).click()

    const lien = pageMarie.getByLabel(labels.share.linkLabel)
    await expect(lien).toBeVisible()
    const url = await lien.inputValue()
    await pageMarie.getByRole('button', { name: labels.share.continue }).click()
    await expect(pageMarie.getByRole('heading', { name: 'Vacances clôture E2E' })).toBeVisible()

    await proposer(pageMarie, labels.categories.destination, ['Lisbonne', 'Porto'])
    await proposer(pageMarie, labels.categories.lodging, ['Airbnb Alfama'])

    // ── Thomas vote Porto, qui passe en tête ─────────────────────────────
    await pageThomas.goto(url)
    await pageThomas.getByLabel(labels.join.nameLabel).fill('Thomas')
    await pageThomas.getByRole('button', { name: labels.join.submit }).click()
    await expect(pageThomas.getByText(labels.hub.progress(0, 2))).toBeVisible()
    await ouvrir(pageThomas, labels.categories.destination)
    await voterOui(pageThomas, 'Porto')

    // ── Marie clôture, contre la tête de liste ───────────────────────────
    await ouvrir(pageMarie, labels.categories.destination)
    await pageMarie.getByRole('button', { name: labels.closure.closeCta }).click()

    const modale = pageMarie.getByRole('dialog', {
      name: labels.closure.dialogTitle(labels.categories.destination),
    })
    // La tête de liste est pré-sélectionnée…
    await expect(modale.getByRole('radio', { name: /Porto/ })).toBeChecked()
    // … et la modale prévient, par un nombre : Marie elle-même n'a pas voté.
    await expect(modale.getByText(labels.closure.nonVoters(1))).toBeVisible()

    // … mais c'est elle qui tranche.
    await modale.getByRole('radio', { name: /Lisbonne/ }).check()
    await cloturer(pageMarie, modale)

    const decision = pageMarie.getByRole('region', { name: labels.closure.decided })
    await expect(decision.getByText('Lisbonne', { exact: true })).toBeVisible()

    // ── Thomas, resté sur l'écran, tente de voter : refusé côté serveur ──
    // Sa page date d'avant la clôture : les boutons y sont encore actifs. Le
    // refus doit venir de la base, pas d'un bouton grisé.
    const refus = pageThomas.waitForResponse(
      (reponse) => reponse.url().includes('app_cast_vote') && reponse.request().method() === 'POST',
    )
    await carte(pageThomas, 'Lisbonne').getByRole('radio', { name: labels.voting.yes }).click()
    const reponse = await refus
    expect(reponse.ok()).toBe(false)
    expect(await reponse.text()).toContain('category_closed')

    await pageThomas.reload()
    await expect(
      pageThomas.getByRole('region', { name: labels.closure.decided }).getByText('Lisbonne', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      carte(pageThomas, 'Lisbonne').getByRole('radio', { name: labels.voting.yes }),
    ).toBeDisabled()
    // Une catégorie clôturée ne propose ni de la trancher, ni de la rouvrir,
    // à qui n'est pas organisateur.
    await expect(pageThomas.getByRole('button', { name: labels.closure.reopenCta })).toHaveCount(0)

    // Le hub de Thomas affiche la décision en toutes lettres.
    await pageThomas.getByRole('link', { name: labels.categoryNav.backToHub }).click()
    await expect(pageThomas.getByText(labels.closure.decidedLine('Lisbonne'))).toBeVisible()

    // ── Marie tranche la dernière, en texte libre → le récap ─────────────
    await pageMarie.getByRole('link', { name: labels.categoryNav.backToHub }).click()
    await ouvrir(pageMarie, labels.categories.lodging)
    await pageMarie.getByRole('button', { name: labels.closure.closeCta }).click()
    const derniere = pageMarie.getByRole('dialog', {
      name: labels.closure.dialogTitle(labels.categories.lodging),
    })
    await derniere.getByRole('radio', { name: labels.closure.other }).check()
    await derniere.getByLabel(labels.closure.otherLabel).fill('On campe')
    await cloturer(pageMarie, derniere)

    // La dernière clôture mène au récap.
    await expect(pageMarie).toHaveURL(/\/results$/)
    await expect(pageMarie.getByText(labels.recap.allDecided)).toBeVisible()
    const bandeau = pageMarie.getByRole('region', { name: labels.recap.summaryLabel })
    await expect(bandeau).toHaveText('🌍 Lisbonne · 🏠 On campe')

    // ── Le lien du sondage ouvre désormais le récap ──────────────────────
    await pageThomas.goto(url)
    await expect(pageThomas).toHaveURL(/\/results$/)
    await expect(
      pageThomas.getByRole('region', { name: labels.recap.summaryLabel }),
    ).toHaveText('🌍 Lisbonne · 🏠 On campe')
    // « Revenir au sondage » ramènerait ici : il n'est pas proposé.
    await expect(pageThomas.getByRole('link', { name: labels.recap.backToTrip })).toHaveCount(0)

    // ── Marie rouvre la destination ──────────────────────────────────────
    await pageMarie
      .getByRole('article')
      .filter({ has: pageMarie.getByRole('heading', { name: labels.categories.destination }) })
      .getByRole('link', { name: labels.recap.openCategory })
      .click()
    const reouverture = pageMarie.waitForResponse(
      (r) => r.url().includes('app_reopen_category') && r.request().method() === 'POST',
    )
    await pageMarie.getByRole('button', { name: labels.closure.reopenCta }).click()
    expect((await reouverture).ok()).toBe(true)
    await expect(pageMarie.getByRole('button', { name: labels.closure.closeCta })).toBeVisible()

    // Thomas : le lien rouvre le hub, et voter redevient possible.
    await pageThomas.goto(url)
    await expect(pageThomas.getByText(labels.closure.decidedLine('On campe'))).toBeVisible()
    await ouvrir(pageThomas, labels.categories.destination)
    await voterOui(pageThomas, 'Lisbonne')

    await marie.close()
    await thomas.close()
  })
})

function carte(page: Page, titre: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name: titre }) })
}

async function ouvrir(page: Page, categorie: string) {
  await page.getByRole('link', { name: new RegExp(categorie) }).first().click()
  await expect(page.getByRole('heading', { name: categorie, level: 1 })).toBeVisible()
}

/** Ouvre une catégorie depuis le hub, y ajoute des propositions, et revient. */
async function proposer(page: Page, categorie: string, titres: string[]) {
  await ouvrir(page, categorie)
  for (const titre of titres) {
    await page.getByRole('button', { name: labels.addOption.open }).click()
    await page.getByLabel(labels.addOption.titleLabel).fill(titre)
    await page.getByRole('button', { name: labels.addOption.submit }).click()
    await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  }
  await page.getByRole('link', { name: labels.categoryNav.backToHub }).click()
}

async function voterOui(page: Page, titre: string) {
  const ecriture = page.waitForResponse(
    (reponse) => reponse.url().includes('app_cast_vote') && reponse.request().method() === 'POST',
  )
  const bouton = carte(page, titre).getByRole('radio', { name: labels.voting.yes })
  await bouton.click()
  expect((await ecriture).ok()).toBe(true)
  await expect(bouton).toHaveAttribute('aria-checked', 'true')
}

/** Confirme la clôture et attend que le serveur l'ait **acquittée**. */
async function cloturer(page: Page, modale: ReturnType<Page['getByRole']>) {
  const ecriture = page.waitForResponse(
    (reponse) =>
      reponse.url().includes('app_close_category') && reponse.request().method() === 'POST',
  )
  await modale.getByRole('button', { name: labels.closure.confirm, exact: true }).click()
  expect((await ecriture).ok()).toBe(true)
  await expect(modale).toHaveCount(0)
}
