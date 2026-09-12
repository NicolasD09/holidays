import { expect, test, type Page } from '@playwright/test'
import { labels } from '../src/lib/labels'

/**
 * Le parcours qui fait exister le produit (doc 08, sprint 2) :
 * Marie crée → Thomas rejoint et vote → Marie voit le résultat.
 *
 * Deux contextes de navigateur = deux potes. Chacun a sa propre session
 * anonyme, donc sa propre identité côté RLS — c'est ce qui rend le test
 * honnête : deux onglets d'un même contexte partageraient le même JWT et
 * voteraient pour la même personne.
 */

const configured = Boolean(process.env.VITE_SUPABASE_URL)

test.describe('parcours complet', () => {
  test.skip(
    !configured,
    'Sans VITE_SUPABASE_URL ni clé publiable, la suite ne peut pas parler à holidays-dev.',
  )

  test('un groupe choisit une destination du début à la fin', async ({ browser }) => {
    const marie = await browser.newContext()
    const thomas = await browser.newContext()
    const pageMarie = await marie.newPage()
    const pageThomas = await thomas.newPage()

    // ── Marie crée le sondage ────────────────────────────────────────────
    await pageMarie.goto('/new')
    await pageMarie.getByLabel(labels.create.titleLabel).fill('Vacances test E2E')
    await pageMarie.getByLabel(labels.create.nameLabel).fill('Marie')
    await pageMarie.getByRole('button', { name: labels.create.submit }).click()

    // La modale de partage porte le lien : c'est le seul objet qui circule.
    const lien = pageMarie.getByLabel(labels.share.linkLabel)
    await expect(lien).toBeVisible()
    const url = await lien.inputValue()
    expect(url).toMatch(/\/t\/[A-Za-z0-9]{16}$/)

    await pageMarie.getByRole('button', { name: labels.share.continue }).click()

    // ── Marie propose trois destinations ─────────────────────────────────
    for (const destination of ['Lisbonne', 'Palerme', 'Split']) {
      await pageMarie.getByRole('button', { name: labels.addOption.open }).click()
      await pageMarie.getByLabel(labels.addOption.titleLabel).fill(destination)
      await pageMarie.getByRole('button', { name: labels.addOption.submit }).click()
      await expect(pageMarie.getByRole('heading', { name: destination })).toBeVisible()
    }

    // ── Thomas ouvre le lien ─────────────────────────────────────────────
    await pageThomas.goto(url)

    // Avant d'entrer son prénom, il voit le sondage — mais pas les
    // propositions : l'aperçu n'en expose aucune (doc 03 §3.7).
    await expect(pageThomas.getByRole('heading', { name: 'Vacances test E2E' })).toBeVisible()
    await expect(pageThomas.getByRole('heading', { name: 'Lisbonne' })).toHaveCount(0)

    await pageThomas.getByLabel(labels.join.nameLabel).fill('Thomas')
    await pageThomas.getByRole('button', { name: labels.join.submit }).click()

    // ── Thomas vote, sans bouton Valider ─────────────────────────────────
    await expect(pageThomas.getByRole('heading', { name: 'Lisbonne' })).toBeVisible()
    await voter(pageThomas, 'Lisbonne', labels.voting.yes)
    await voter(pageThomas, 'Palerme', labels.voting.maybe)
    await voter(pageThomas, 'Split', labels.voting.no)

    // Le vote est optimiste : `aria-checked` bascule avant que le serveur ait
    // répondu (doc 04 §4.5). Les résultats agrégés, eux, viennent de
    // `app_category_results` — les attendre chez Thomas, c'est attendre que
    // son « non » soit réellement commité. Sans ce point d'ancrage, Marie
    // pouvait recharger avant, lire Split à zéro vote, et ne plus jamais
    // refaire de requête : c'est la course qui rendait ce test flaky.
    await expect(
      carte(pageThomas, 'Split').getByText(labels.voting.blocking(1)),
    ).toBeVisible()

    // ── Le vote survit au rechargement ───────────────────────────────────
    await pageThomas.reload()
    await expect(radio(pageThomas, 'Lisbonne', labels.voting.yes)).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // ── Marie voit le résultat ───────────────────────────────────────────
    await pageMarie.reload()
    await expect(pageMarie.getByText(labels.voting.tally(1, 0, 0)).first()).toBeVisible()
    await expect(pageMarie.getByText(labels.voting.blocking(1))).toBeVisible()

    await marie.close()
    await thomas.close()
  })
})

function carte(page: Page, titre: string) {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name: titre }) })
}

function radio(page: Page, titre: string, choix: string) {
  return carte(page, titre).getByRole('radio', { name: choix })
}

async function voter(page: Page, titre: string, choix: string) {
  await radio(page, titre, choix).click()
  await expect(radio(page, titre, choix)).toHaveAttribute('aria-checked', 'true')
}
