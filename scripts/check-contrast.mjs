/**
 * Vérification des contrastes du thème (doc 05 §5.5, seuil WCAG 2.1 AA).
 *
 * Nécessite un navigateur et un serveur de prévisualisation, donc hors CI pour
 * l'instant — l'audit automatisé arrive au sprint 9 avec axe-core. À relancer
 * à la main après toute modification des jetons de couleur :
 *
 *   npm run build && npx vite preview --port 4174 &
 *   node scripts/check-contrast.mjs
 */
import { chromium } from 'playwright'

const navigateur = await chromium.launch()

function lum([r, v, bl]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(v) + 0.0722 * f(bl)
}
const ratio = (a, c) => {
  const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const paires = [
  ['--text', '--surface', 4.5, 'texte sur fond'],
  ['--text-muted', '--surface', 4.5, 'texte secondaire sur fond'],
  ['--text', '--surface-2', 4.5, 'texte sur carte'],
  ['--text-muted', '--surface-2', 4.5, 'texte secondaire sur carte'],
  ['--brand-fg', '--brand', 4.5, 'libellé du bouton primaire'],
  ['--brand', '--surface', 4.5, 'lien de marque sur fond'],
  ['--vote-fg', '--yes', 4.5, 'libellé sur vote Oui'],
  ['--vote-fg', '--maybe', 4.5, 'libellé sur vote Peut-être'],
  ['--vote-fg', '--no', 4.5, 'libellé sur vote Non'],
  ['--border-strong', '--surface', 3, 'bordure de contrôle sur fond'],
  ['--border-strong', '--surface-2', 3, 'bordure de contrôle sur carte'],
]

let echecs = 0
for (const scheme of ['light', 'dark']) {
  const ctx = await navigateur.newContext({ colorScheme: scheme })
  const p = await ctx.newPage()
  await p.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' })
  // Résolution fiable : on peint la couleur sur un canvas et on lit le pixel.
  const resolus = await p.evaluate((vars) => {
    const cs = getComputedStyle(document.documentElement)
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const ctx2 = cv.getContext('2d')
    const out = {}
    for (const v of vars) {
      ctx2.clearRect(0, 0, 1, 1)
      ctx2.fillStyle = cs.getPropertyValue(v).trim()
      ctx2.fillRect(0, 0, 1, 1)
      const d = ctx2.getImageData(0, 0, 1, 1).data
      out[v] = [d[0], d[1], d[2]]
    }
    return out
  }, [...new Set(paires.flatMap(([a, c]) => [a, c]))])

  const rgb = (v) => v
  console.log(`\n── thème ${scheme} ──`)
  for (const [fg, bg, min, nom] of paires) {
    const r = ratio(rgb(resolus[fg]), rgb(resolus[bg]))
    const ok = r >= min
    if (!ok) echecs++
    console.log(`${ok ? '✅' : '❌'} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${nom}`)
  }
  await ctx.close()
}
await navigateur.close()
console.log(echecs ? `\n${echecs} paire(s) sous le seuil.` : '\nToutes les paires respectent le seuil.')
process.exit(echecs ? 1 : 0)
