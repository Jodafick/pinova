#!/usr/bin/env node
/** Exporte en.ts en JSON sur stdout. Usage: node dump-en-locale.mjs <locales-dir> */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: node dump-en-locale.mjs <locales-dir>')
  process.exit(1)
}

const mod = await import(pathToFileURL(path.join(dir, 'en.ts')).href)
if (!mod.en || typeof mod.en !== 'object') {
  console.error('en.ts invalide')
  process.exit(1)
}
process.stdout.write(JSON.stringify(mod.en))
