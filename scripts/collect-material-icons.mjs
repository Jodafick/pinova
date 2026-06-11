/**
 * Extrait les noms d'icônes Material Symbols utilisés dans src/
 * et génère src/generated/materialIconSubset.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'src')
const outFile = path.join(srcDir, 'generated', 'materialIconSubset.ts')

/** Icônes dynamiques (topics API, onboarding, etc.) — conservées dans le subset. */
const EXTRA_ICONS = [
  'category',
  'favorite',
  'favorite_border',
  'bookmark',
  'bookmark_border',
  'visibility',
  'visibility_off',
  'block',
  'open_in_new',
  'share',
  'ios_share',
  'more_horiz',
  'more_vert',
  'progress_activity',
  'celebration',
  'check',
  'check_circle',
  'error',
  'info',
  'warning',
  'help',
  'dark_mode',
  'light_mode',
  'language',
  'schedule',
  'timer',
  'play_arrow',
  'pause',
  'volume_up',
  'volume_off',
  'fullscreen',
  'fullscreen_exit',
  'chevron_right',
  'chevron_down',
  'arrow_forward',
  'arrow_back',
  'north',
  'south',
  'menu',
  'home',
  'explore',
  'person',
  'settings',
  'search',
  'add',
  'close',
  'edit',
  'delete',
]

const RE_TEXT = /material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</gi
const RE_PINOVA_ICON = /<PinovaIcon[^>]*\bname=["']([a-z0-9_]+)["']/gi
const RE_PINOVA_ICON_QUOTED = /['"]([a-z][a-z0-9_]{1,48})['"]/gi
const RE_ICON_PROP = /icon:\s*['"]([a-z0-9_]+)['"]/gi
const RE_TEMPLATE_ICON = /icon\s*===\s*['"]([a-z0-9_]+)['"]/gi

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'generated' || ent.name === '__tests__') continue
      walk(p, files)
    } else if (/\.(vue|ts|tsx)$/.test(ent.name)) {
      files.push(p)
    }
  }
  return files
}

const icons = new Set(EXTRA_ICONS)

for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const re of [RE_TEXT, RE_PINOVA_ICON, RE_ICON_PROP, RE_TEMPLATE_ICON]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const name = m[1]?.trim()
      if (name && /^[a-z][a-z0-9_]*$/.test(name)) icons.add(name)
    }
  }
  /* Noms dans expressions ternaires `:name="… ? 'visibility' : 'visibility_off'"`. */
  if (text.includes('PinovaIcon')) {
    RE_PINOVA_ICON_QUOTED.lastIndex = 0
    let m
    while ((m = RE_PINOVA_ICON_QUOTED.exec(text))) {
      const name = m[1]?.trim()
      if (name && /^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) icons.add(name)
    }
  }
}

const sorted = [...icons].sort()
fs.mkdirSync(path.dirname(outFile), { recursive: true })

const content = `/** Généré par scripts/collect-material-icons.mjs — ne pas éditer à la main. */
export const MATERIAL_ICON_SUBSET: readonly string[] = ${JSON.stringify(sorted, null, 2)} as const

/** URL Google Fonts CSS2 — subset via icon_names (variable font). */
export function materialSymbolsStylesheetHref(): string {
  const names = encodeURIComponent(MATERIAL_ICON_SUBSET.join(','))
  return \`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..600,0..1,-25..0&display=swap&icon_names=\${names}\`
}
`

fs.writeFileSync(outFile, content, 'utf8')
console.log(`Wrote ${sorted.length} icons → ${path.relative(root, outFile)}`)
