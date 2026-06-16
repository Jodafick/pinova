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
  'cancel',
  'replay',
  'military_tech',
  /* Topics API / seed (fotoce-backend TOPIC_ICONS) */
  'self_improvement',
  'construction',
  'computer',
  'payments',
]

const RE_TEXT = /material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</gi
const RE_FOTOCE_ICON = /<FotoceIcon[^>]*\bname=["']([a-z0-9_]+)["']/gi
const RE_HAS_FOTOCE_ICON = /<FotoceIcon[\s/>]/
/** Branches ternaires dans `<FotoceIcon :name="… ? 'glyph' : 'glyph'" />` — pas les opérandes `=== 'state'`. */
const RE_FOTOCE_DYNAMIC_ATTR = /<FotoceIcon[^>]*:name="([^"]*)"/gi
const RE_TERNARY_ICON = /\?\s*'([a-z][a-z0-9_]*)'|\:\s*'([a-z][a-z0-9_]*)'/gi
const RE_ICON_HELPER_ANCHOR =
  /(?:function\s+(?:\w*[Ii]con\w*|iconFor)\s*\([^)]*\)[^{]*|(?:\w*[Ii]con\w*)\s*=\s*computed\s*\(\s*\(\)\s*=>\s*)/gi
const RE_RETURN_ICON = /return\s+'([a-z][a-z0-9_]*)'/g
const RE_ICON_PROP = /icon:\s*['"]([a-z0-9_]+)['"]/gi
const RE_TEMPLATE_ICON = /icon\s*===\s*['"]([a-z0-9_]+)['"]/gi

function addIconToken(icons, name) {
  const token = name?.trim()
  if (!token || token === 'icon') return
  if (/^[a-z][a-z0-9_]*$/.test(token)) icons.add(token)
}

/** Icônes référencées dans les JSON (intérêts, catégories, etc.). */
function collectIconsFromJsonFile(filePath, icons) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    const visit = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item)
        return
      }
      if (node && typeof node === 'object') {
        if (typeof node.icon === 'string') addIconToken(icons, node.icon)
        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') visit(value)
        }
      }
    }
    visit(data)
  } catch {
    /* ignore invalid json */
  }
}

function collectIconsFromJsonTree(dir, icons) {
  if (!fs.existsSync(dir)) return
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) collectIconsFromJsonTree(p, icons)
    else if (ent.name.endsWith('.json')) collectIconsFromJsonFile(p, icons)
  }
}

function collectIconHelperReturns(text, icons) {
  RE_ICON_HELPER_ANCHOR.lastIndex = 0
  let anchor
  while ((anchor = RE_ICON_HELPER_ANCHOR.exec(text))) {
    const openBrace = text.indexOf('{', anchor.index)
    if (openBrace === -1) continue
    let depth = 1
    let i = openBrace + 1
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    }
    const block = text.slice(openBrace + 1, i - 1)
    RE_RETURN_ICON.lastIndex = 0
    let m
    while ((m = RE_RETURN_ICON.exec(block))) {
      addIconToken(icons, m[1])
    }
  }
}

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

collectIconsFromJsonTree(path.join(srcDir, 'data'), icons)

for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8')
  for (const re of [RE_TEXT, RE_FOTOCE_ICON, RE_ICON_PROP, RE_TEMPLATE_ICON]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      addIconToken(icons, m[1])
    }
  }
  collectIconHelperReturns(text, icons)

  if (!RE_HAS_FOTOCE_ICON.test(text)) continue

  RE_FOTOCE_DYNAMIC_ATTR.lastIndex = 0
  for (const attr of text.matchAll(RE_FOTOCE_DYNAMIC_ATTR)) {
    RE_TERNARY_ICON.lastIndex = 0
    for (const branch of attr[1].matchAll(RE_TERNARY_ICON)) {
      addIconToken(icons, branch[1] ?? branch[2])
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
