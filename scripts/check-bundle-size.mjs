/**
 * Budget de performance (doc 04 §4.10) : le JavaScript **initial** doit rester
 * sous 200 Ko gzip. Le script échoue le build si la limite est franchie —
 * c'est volontaire : un budget qu'on peut ignorer n'est pas un budget.
 *
 * **Ce qu'« initial » veut dire, et pourquoi ça compte.** Depuis le découpage
 * par route (tâche 7.3), le dossier `assets` contient une quinzaine de
 * morceaux dont la plupart ne sont téléchargés qu'à l'ouverture d'un écran
 * précis. En faire la somme punirait le découpage au lieu de le récompenser :
 * découper augmente le total et diminue ce qu'on charge pour voir la première
 * page — exactement ce qu'on cherche.
 *
 * La mesure suit donc ce que le navigateur demande vraiment au démarrage,
 * c'est-à-dire ce que `dist/index.html` déclare : le module d'entrée, et les
 * `modulepreload` que Vite y écrit pour ses dépendances statiques. Le reste
 * est affiché à titre indicatif, sans compter dans le verdict.
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const LIMITE_KO = 200
const DIST = 'dist'
const ASSETS = join(DIST, 'assets')
const INDEX = join(DIST, 'index.html')

/*
  Une barrière qui ne trouve rien doit crier, pas passer. Un rapport vert qui
  n'a rien mesuré est pire que pas de rapport du tout — c'est la leçon du
  sprint 3 sur les tests qui s'annonçaient « ignorés » (doc 11 §11.1 D), et
  celle du budget lui-même, recopié pendant trois sprints (doc 13).
*/
if (!existsSync(INDEX)) {
  console.error(`❌ ${INDEX} introuvable. Lance \`npm run build\` d'abord.`)
  process.exit(1)
}

const html = readFileSync(INDEX, 'utf8')

/** Le module d'entrée : `<script type="module" src="/assets/index-xxx.js">`. */
const entrees = [...html.matchAll(/<script[^>]*\ssrc="([^"]+\.js)"/g)].map((m) => m[1])

/** Ses dépendances statiques, que Vite déclare en `modulepreload`. */
const precharges = [...html.matchAll(/<link[^>]*>/g)]
  .filter((balise) => balise[0].includes('modulepreload'))
  .map((balise) => /href="([^"]+\.js)"/.exec(balise[0])?.[1])
  .filter((href) => href !== undefined)

const initiaux = [...new Set([...entrees, ...precharges])].map((url) =>
  join(DIST, url.replace(/^\//, '')),
)

if (initiaux.length === 0) {
  console.error(
    `❌ Aucun module initial trouvé dans ${INDEX}.\n` +
      `   Le format de sortie de Vite a probablement changé : corrige ce script\n` +
      `   plutôt que de le laisser mesurer le vide.`,
  )
  process.exit(1)
}

const gzipDe = (fichier) => gzipSync(readFileSync(fichier)).length
const enKo = (octets) => +(octets / 1024).toFixed(1)

let initial = 0
console.log('Chargé au démarrage :')
for (const fichier of initiaux.sort()) {
  if (!existsSync(fichier)) {
    console.error(`❌ ${fichier} est déclaré par index.html mais absent du build.`)
    process.exit(1)
  }
  const octets = gzipDe(fichier)
  initial += octets
  console.log(`  ${enKo(octets).toString().padStart(7)} Ko gzip  ${basename(fichier)}`)
}

const aLaDemande = readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => join(ASSETS, f))
  .filter((f) => !initiaux.includes(f))
  .map((f) => ({ fichier: f, octets: gzipDe(f) }))
  .sort((a, b) => b.octets - a.octets)

if (aLaDemande.length > 0) {
  console.log('\nÀ la demande (hors budget) :')
  for (const { fichier, octets } of aLaDemande) {
    console.log(`  ${enKo(octets).toString().padStart(7)} Ko gzip  ${basename(fichier)}`)
  }
}

const totalDiffere = aLaDemande.reduce((somme, { octets }) => somme + octets, 0)
const initialKo = enKo(initial)

console.log(
  `\nJS initial : ${initialKo} Ko gzip (limite ${LIMITE_KO} Ko)` +
    `\nJS différé : ${enKo(totalDiffere)} Ko gzip sur ${aLaDemande.length} morceaux`,
)

if (initialKo > LIMITE_KO) {
  console.error(
    `\n❌ Budget dépassé de ${(initialKo - LIMITE_KO).toFixed(1)} Ko.\n` +
      `   Sors du chemin initial ce qui peut l'être : un écran de plus en\n` +
      `   \`lazy()\` dans src/app/router.tsx, ou une dépendance déplacée vers\n` +
      `   l'écran qui l'utilise. Sinon, justifie la hausse dans la PR.`,
  )
  process.exit(1)
}

console.log('✅ Budget respecté.')
