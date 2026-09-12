import { expect, test, type Locator, type Page } from '@playwright/test'
import { labels } from '../src/lib/labels'

/**
 * Le parcours du sprint 5 : trois personnes peignent leurs disponibilités, et
 * l'app désigne le bon créneau.
 *
 * Marie crée un sondage Destination + Dates et peint une semaine **au
 * glissement** → Thomas peint les mêmes jours → Julien en bloque un seul → le
 * classement met en tête le créneau attendu et **nomme** Julien.
 *
 * **Deux règles héritées, et elles gouvernent tout ce fichier :**
 *
 * 1. *L'ancrage serveur* (doc 11 §11.1 D). La peinture est optimiste : une case
 *    se colore avant que le serveur ait répondu, et le classement se recalcule
 *    sur le cache local. Rien de tout ça ne prouve une écriture. Chaque geste
 *    attend donc l'**acquittement de la RPC**, puis le participant recharge :
 *    ce qui survit à un rechargement vient de la base, et de nulle part
 *    ailleurs.
 *
 *    Les deux moitiés comptent, et l'ordre aussi. Recharger sans attendre
 *    l'acquittement **annule la requête en vol** — la navigation coupe le
 *    `fetch`, l'état optimiste part avec la page, et la case revient « non
 *    renseigné ». Déterministe, silencieux, et parfaitement trompeur : on
 *    accuse la peinture alors que c'est le test qui a raccroché trop tôt.
 * 2. *Les sélecteurs ne passent pas par le français* là où ils peuvent
 *    l'éviter. Les cases portent un `data-day` : c'est stable, et ça ne casse
 *    pas le jour où un libellé change.
 *
 * La fenêtre est **fixée en 2027** plutôt que calculée à partir d'aujourd'hui :
 * un test dont les données bougent avec la date d'exécution finit par échouer
 * un lundi de juillet sans que personne comprenne pourquoi.
 */

const configured = Boolean(process.env.VITE_SUPABASE_URL)

const FENETRE = { du: '2027-07-01', au: '2027-07-20', nuits: '2' }
/** Lundi, mardi, mercredi — trois colonnes voisines de la même ligne. */
const SEMAINE = ['2027-07-05', '2027-07-06', '2027-07-07']
/** Ce que `rankWindows` doit sortir en tête : un séjour de 2 nuits sur ces jours. */
const CRENEAU_ATTENDU = 'lun. 5 → mer. 7 juillet'

test.describe('disponibilités et créneaux', () => {
  test.skip(
    !configured,
    'Sans VITE_SUPABASE_URL ni clé publiable, la suite ne peut pas parler à holidays-dev.',
  )

  test('trois dispos croisées désignent le bon créneau', async ({ browser }) => {
    const marie = await browser.newContext()
    const thomas = await browser.newContext()
    const julien = await browser.newContext()
    const pageMarie = await marie.newPage()
    const pageThomas = await thomas.newPage()
    const pageJulien = await julien.newPage()

    // ── Marie crée un sondage Destination + Dates ────────────────────────
    await pageMarie.goto('/new')
    await pageMarie.getByLabel(labels.create.titleLabel).fill('Vacances dates E2E')
    await pageMarie.getByLabel(labels.create.nameLabel).fill('Marie')

    await pageMarie.getByRole('checkbox', { name: labels.categories.dates }).check()
    await pageMarie.getByLabel(labels.create.datesFrom).fill(FENETRE.du)
    await pageMarie.getByLabel(labels.create.datesTo).fill(FENETRE.au)
    await pageMarie.getByLabel(labels.create.datesNights).fill(FENETRE.nuits)

    await pageMarie.getByRole('button', { name: labels.create.submit }).click()

    const lien = pageMarie.getByLabel(labels.share.linkLabel)
    await expect(lien).toBeVisible()
    const url = await lien.inputValue()
    await pageMarie.getByRole('button', { name: labels.share.continue }).click()

    // Deux catégories : on arrive sur le hub.
    await expect(pageMarie.getByRole('heading', { name: 'Vacances dates E2E' })).toBeVisible()

    // Une proposition dans Destination, sans quoi cette catégorie ne compterait
    // pas dans la progression — et l'assertion du §14.2 plus bas perdrait son
    // sens.
    await proposer(pageMarie, labels.categories.destination, 'Lisbonne')

    // ── Marie peint une semaine au glissement ────────────────────────────
    await ouvrirDates(pageMarie)
    await enAttendantLEcriture(pageMarie, () => peindreAuGlissement(pageMarie, SEMAINE))
    await rechargerEtVerifier(pageMarie, SEMAINE, labels.availability.statuses.yes)

    // ── Thomas rejoint et peint les mêmes jours ──────────────────────────
    await pageThomas.goto(url)
    await pageThomas.getByLabel(labels.join.nameLabel).fill('Thomas')
    await pageThomas.getByRole('button', { name: labels.join.submit }).click()

    await expect(pageThomas.getByText(labels.hub.progress(0, 2))).toBeVisible()
    await expect(
      pageThomas.getByText(labels.hub.statusToVote, { exact: true }),
    ).toHaveCount(2)

    await ouvrirDates(pageThomas)
    for (const jour of SEMAINE) {
      await enAttendantLEcriture(pageThomas, () => cliquerJour(pageThomas, jour))
    }
    await rechargerEtVerifier(pageThomas, SEMAINE, labels.availability.statuses.yes)

    /*
      Le correctif du doc 14 §14.2, et la seule assertion qui le prouve.
      Thomas n'a peint qu'un calendrier — aucune proposition, aucun vote. Avant
      ce sprint, la catégorie dates ne comptait pas : le hub aurait annoncé
      « 0 sur 1 », puis « Tu es à jour » dès la destination votée, sans qu'il
      ait jamais ouvert le calendrier.
    */
    await pageThomas.getByRole('link', { name: labels.categoryNav.backToHub }).click()
    await expect(pageThomas.getByText(labels.hub.progress(1, 2))).toBeVisible()

    // ── Julien bloque une seule journée ──────────────────────────────────
    await pageJulien.goto(url)
    await pageJulien.getByLabel(labels.join.nameLabel).fill('Julien')
    await pageJulien.getByRole('button', { name: labels.join.submit }).click()

    await ouvrirDates(pageJulien)
    await pageJulien
      .getByRole('radio', { name: labels.availability.brushes.no })
      .click()
    await enAttendantLEcriture(pageJulien, () => cliquerJour(pageJulien, '2027-07-06'))
    await rechargerEtVerifier(pageJulien, ['2027-07-06'], labels.availability.statuses.no)

    // ── Le classement tranche ────────────────────────────────────────────
    // Marie recharge : tout ce qu'elle voit des deux autres vient du serveur.
    await pageMarie.reload()

    const tete = pageMarie.getByRole('listitem').filter({ hasText: labels.ranking.top })
    await expect(tete).toContainText(CRENEAU_ATTENDU)
    // Deux personnes sûres, personne d'incertain — Julien est écarté, pas compté.
    await expect(tete).toContainText(labels.ranking.counts(2, 0))
    await expect(tete).toContainText(labels.ranking.blocked(['Julien']))

    // ── Et le hub le répète ──────────────────────────────────────────────
    await pageMarie.getByRole('link', { name: labels.categoryNav.backToHub }).click()
    await expect(pageMarie.getByText(labels.hub.leader(CRENEAU_ATTENDU))).toBeVisible()

    await marie.close()
    await thomas.close()
    await julien.close()
  })
})

/**
 * Joue un geste de peinture et attend que le serveur l'ait **acquitté**.
 *
 * C'est la moitié manquante de l'ancrage serveur. `app_set_availability` part
 * au relâchement du doigt ; tant que sa réponse n'est pas là, rien n'est
 * écrit — et toute navigation d'ici là annule la requête au lieu de la laisser
 * finir.
 */
async function enAttendantLEcriture(page: Page, geste: () => Promise<void>) {
  const ecriture = page.waitForResponse(
    (reponse) =>
      reponse.url().includes('app_set_availability') &&
      reponse.request().method() === 'POST',
  )
  await geste()
  expect((await ecriture).ok()).toBe(true)
}

/** Ouvre la catégorie Dates depuis le hub. */
async function ouvrirDates(page: Page) {
  await page
    .getByRole('link', { name: new RegExp(labels.categories.dates) })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: labels.categories.dates, level: 1 }),
  ).toBeVisible()
}

/** Ouvre une catégorie depuis le hub, y ajoute une proposition, et revient. */
async function proposer(page: Page, categorie: string, titre: string) {
  await page.getByRole('link', { name: new RegExp(categorie) }).first().click()
  await expect(page.getByRole('heading', { name: categorie, level: 1 })).toBeVisible()

  await page.getByRole('button', { name: labels.addOption.open }).click()
  await page.getByLabel(labels.addOption.titleLabel).fill(titre)
  await page.getByRole('button', { name: labels.addOption.submit }).click()

  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  await page.getByRole('link', { name: labels.categoryNav.backToHub }).click()
}

/**
 * Amène une case au **centre** du viewport, puis clique.
 *
 * Centrer n'est pas un luxe : la barre de navigation est `fixed bottom-0
 * z-40`, et tout ce qui se contente d'amener la case « à l'écran » la dépose
 * sur le bord bas — c'est-à-dire dessous.
 */
async function cliquerJour(page: Page, jour: string) {
  const cellule = page.locator(`[data-day="${jour}"]`)
  await centrer(cellule)
  await cellule.click()
}

function centrer(cellule: Locator) {
  return cellule.evaluate((element) => element.scrollIntoView({ block: 'center' }))
}

/**
 * Peint une série de jours voisins **d'un seul geste**.
 *
 * C'est la seule chose de ce sprint que l'unitaire ne peut pas prouver : jsdom
 * n'a pas d'`elementFromPoint` utile, tout y est à coordonnées nulles. Il faut
 * un vrai moteur pour vérifier que la capture du pointeur suit bien le doigt
 * d'une case à l'autre.
 *
 * **Le piège, payé une fois.** `scrollIntoViewIfNeeded` fait le strict
 * minimum : il pose la case sur le bord bas du viewport, donc **sous** la
 * barre de navigation. `elementFromPoint` y renvoie la barre, le geste ne
 * trouve aucun `data-day`, et rien n'est peint — sans la moindre erreur. D'où
 * le centrage, et surtout la vérification qui suit.
 */
async function peindreAuGlissement(page: Page, jours: string[]) {
  const cases = jours.map((jour) => page.locator(`[data-day="${jour}"]`))
  const premier = cases[0]
  if (!premier) throw new Error('aucun jour à peindre')

  await centrer(premier)

  /*
    Ce que le doigt toucherait vraiment, avant de toucher.

    `trial: true` joue toutes les vérifications d'actionnabilité de Playwright
    — visible, stable, **reçoit les événements de pointeur** — sans rien
    cliquer. C'est l'étape 13 de la recette, automatisée : si la barre basse
    venait un jour recouvrir la grille, l'échec serait **ici**, en nommant
    l'élément qui intercepte, au lieu de nous laisser peindre dans le vide et
    d'échouer trois assertions plus loin sur un « non renseigné »
    incompréhensible.
  */
  for (const cellule of cases) await cellule.click({ trial: true })

  // Les boîtes sont relevées **après** ces contrôles : ils peuvent encore
  // faire défiler, et une coordonnée périmée viserait à côté.
  const centres: { x: number; y: number }[] = []
  for (const cellule of cases) {
    const boite = await cellule.boundingBox()
    if (!boite) throw new Error('case hors de l\u2019écran : le glissement ne veut rien dire')
    centres.push({ x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 })
  }

  const [depart, ...suite] = centres
  if (!depart) throw new Error('aucun centre calculé')

  await page.mouse.move(depart.x, depart.y)
  await page.mouse.down()
  /*
    `steps` n'est pas cosmétique.

    Sans lui, un `mouse.move` produit **un seul** événement, à l'arrivée : le
    pointeur se téléporte d'une case à l'autre au lieu de les traverser. La
    case du milieu n'est jamais survolée, donc jamais peinte — et WebKit, qui
    fusionne les mouvements rapprochés, le rend d'autant plus visible.

    Un doigt, lui, produit un flux continu. C'est ce qu'on simule ici, et c'est
    la seule version du geste qui prouve quelque chose.
  */
  for (const point of suite) await page.mouse.move(point.x, point.y, { steps: 12 })
  await page.mouse.up()
}

/**
 * La seconde moitié de l'ancrage : recharger, puis vérifier.
 *
 * Une case colorée ne prouve rien — la mutation la peint avant l'aller-retour.
 * Ce qui survit à un rechargement, en revanche, a été relu depuis la base.
 *
 * À n'appeler qu'après `enAttendantLEcriture` : sans acquittement préalable,
 * ce rechargement ne vérifie pas l'écriture, il l'annule.
 */
async function rechargerEtVerifier(page: Page, jours: string[], statut: string) {
  await page.reload()

  for (const jour of jours) {
    await expect(page.locator(`[data-day="${jour}"]`)).toHaveAttribute(
      'aria-label',
      // « pas disponible » contient « disponible » : la virgule et la fin de
      // segment sont ce qui les distingue.
      new RegExp(`, ${statut}(,|$)`),
    )
  }
}
