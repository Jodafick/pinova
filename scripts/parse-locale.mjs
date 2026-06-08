#!/usr/bin/env node
/** Lit un fichier locale .ts et exporte le dict en JSON sur stdout. */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2]
const code = process.argv[3]
if (!dir || !code) {
  console.error('Usage: node parse-locale.mjs <locales-dir> <code>')
  process.exit(1)
}

const file = path.join(dir, `${code}.ts`)
try {
  const mod = await import(pathToFileURL(file).href)
  const dict = mod[code]
  if (!dict || typeof dict !== 'object') {
    process.stdout.write('{}')
    process.exit(0)
  }
  process.stdout.write(JSON.stringify(dict))
} catch {
  process.stdout.write('{}')
}
