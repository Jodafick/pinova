/**
 * Remplace les <span class="material-symbols-outlined"> par <PinovaIcon />.
 * Migration conservative : une ligne par span, contenu simple uniquement.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'src')

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'generated') continue
      walk(p, files)
    } else if (p.endsWith('.vue')) {
      files.push(p)
    }
  }
  return files
}

function cleanStaticClasses(classAttr) {
  return classAttr
    .split(/\s+/)
    .filter(
      (c) =>
        c &&
        c !== 'material-symbols-outlined' &&
        c !== 'pin-mobile-filled' &&
        c !== 'pin-desktop-filled' &&
        !c.startsWith('material-symbols'),
    )
    .join(' ')
}

function buildPinovaIcon(attrs, icon) {
  const filled =
    attrs.includes('pin-mobile-filled') || attrs.includes('pin-desktop-filled')
  const spin =
    attrs.includes('animate-spin') || icon.static === 'progress_activity'

  const classMatch = attrs.match(/\bclass="([^"]*)"/)
  const classBindMatch = attrs.match(/:class="([^"]*)"/)
  const staticClass = classMatch ? cleanStaticClasses(classMatch[1]) : ''

  const parts = []
  for (const d of ['v-for', 'v-if', 'v-else-if', 'v-else', 'v-show']) {
    const dm = attrs.match(new RegExp(`\\b${d}(?:="[^"]*"|='[^']*')?`))
    if (dm) parts.push(dm[0])
  }
  const keyMatch = attrs.match(/:key="([^"]*)"/)
  if (keyMatch) parts.push(`:key="${keyMatch[1]}"`)

  if (icon.dynamic) parts.push(`:name="${icon.dynamic}"`)
  else parts.push(`name="${icon.static}"`)

  if (filled) parts.push('filled')
  if (spin) parts.push('spin')
  if (staticClass) parts.push(`class="${staticClass}"`)
  if (classBindMatch) parts.push(`:class="${classBindMatch[1]}"`)

  const ariaMatch = attrs.match(/\baria-hidden="([^"]*)"/)
  const ariaLabelMatch = attrs.match(/\baria-label="([^"]*)"/)
  if (ariaMatch) parts.push(`aria-hidden="${ariaMatch[1]}"`)
  if (ariaLabelMatch) parts.push(`aria-label="${ariaLabelMatch[1]}"`)

  return `<PinovaIcon ${parts.join(' ')} />`
}

function transformLine(line) {
  const normalized = line.replace(/\r$/, '')
  if (!normalized.includes('material-symbols-outlined')) return line

  // span enfant : <span class="...material..."><span ...>icon</span></span>
  const nested = normalized.match(
    /^(\s*)<span([^>]*material-symbols-outlined[^>]*)>\s*<span[^>]*>([a-z0-9_]+)<\/span>\s*<\/span>\s*$/,
  )
  if (nested) {
    const [, indent, attrs, iconName] = nested
    return indent + buildPinovaIcon(attrs, { static: iconName })
  }

  const dynamic = normalized.match(
    /^(\s*)<span([^>]*material-symbols-outlined[^>]*)>\s*(\{\{[^<]+\}\})\s*<\/span>\s*$/,
  )
  if (dynamic) {
    const [, indent, attrs, expr] = dynamic
    return indent + buildPinovaIcon(attrs, { dynamic: expr.slice(2, -2).trim() })
  }

  const stat = normalized.match(
    /^(\s*)<span([^>]*material-symbols-outlined[^>]*)>\s*([a-z0-9_]+)\s*<\/span>\s*$/,
  )
  if (stat) {
    const [, indent, attrs, iconName] = stat
    return indent + buildPinovaIcon(attrs, { static: iconName })
  }

  return line
}

function transformMultilineBlock(content) {
  // Ouverture multiligne, contenu simple (pas de balise imbriquée)
  const re =
    /<span(\s+(?:(?!<span\b)[\s\S])*?material-symbols-outlined(?:(?!<span\b)[\s\S])*?)>\s*(\{\{[^<]+\}\}|[a-z0-9_]+)\s*<\/span>/gi
  return content.replace(re, (match, attrs, inner) => {
    const trimmed = inner.trim()
    if (trimmed.startsWith('{{')) {
      return buildPinovaIcon(attrs, { dynamic: trimmed.slice(2, -2).trim() })
    }
    if (/^[a-z0-9_]+$/i.test(trimmed)) {
      return buildPinovaIcon(attrs, { static: trimmed })
    }
    return match
  })
}

function transform(content) {
  let result = content.split('\n').map(transformLine).join('\n')
  for (let i = 0; i < 5; i++) {
    const next = transformMultilineBlock(result)
    if (next === result) break
    result = next
  }
  return result
}

let changed = 0
for (const file of walk(srcDir)) {
  const before = fs.readFileSync(file, 'utf8')
  const after = transform(before)
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    changed += 1
    console.log('updated', path.relative(srcDir, file))
  }
}
console.log(`Done. ${changed} files updated.`)
