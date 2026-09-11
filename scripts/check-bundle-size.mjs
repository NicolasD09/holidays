/**
 * Budget de performance (doc 04 §4.10) : le JavaScript initial doit rester
 * sous 200 Ko gzip. Le script échoue le build si la limite est franchie —
 * c'est volontaire : un budget qu'on peut ignorer n'est pas un budget.
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIMITE_KO = 200
const dossier = 'dist/assets'

function fichiersJs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dir, f))
}

let total = 0
const details = []

for (const fichier of fichiersJs(dossier)) {
  const gzip = gzipSync(readFileSync(fichier)).length
  total += gzip
  details.push({ fichier, ko: +(gzip / 1024).toFixed(1), brut: statSync(fichier).size })
}

details.sort((a, b) => b.ko - a.ko)
for (const d of details) console.log(`  ${d.ko.toString().padStart(7)} Ko gzip  ${d.fichier}`)

const totalKo = +(total / 1024).toFixed(1)
console.log(`\nTotal JS : ${totalKo} Ko gzip (limite ${LIMITE_KO} Ko)`)

if (totalKo > LIMITE_KO) {
  console.error(
    `\n❌ Budget dépassé de ${(totalKo - LIMITE_KO).toFixed(1)} Ko.\n` +
      `   Découpe par route avec React.lazy, ou justifie la hausse dans la PR.`,
  )
  process.exit(1)
}
console.log('✅ Budget respecté.')
