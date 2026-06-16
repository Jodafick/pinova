#!/usr/bin/env node
/**
 * Génère countries.json (REST Countries) et cities-by-country/*.json (country-state-city).
 *
 * Usage: pnpm run generate:geo
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MOBILE_ROOT = path.resolve(ROOT, '..', 'Fotoce-Mobile')
const REF_TARGETS = [
  path.join(ROOT, 'src', 'data', 'reference'),
  path.join(MOBILE_ROOT, 'src', 'data', 'reference'),
]
const LEGACY_COUNTRIES = path.join(REF_TARGETS[0], 'countries.json')
const LEGACY_CITIES = path.join(REF_TARGETS[0], 'cities.json')

const require = createRequire(import.meta.url)
const { Country, City } = require('country-state-city')

function flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🏳️'
  const code = iso2.toUpperCase()
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function loadLegacyOverrides() {
  let countries = []
  let cities = {}
  try {
    countries = JSON.parse(await fs.readFile(LEGACY_COUNTRIES, 'utf8'))
  } catch {
    /* ignore */
  }
  try {
    cities = JSON.parse(await fs.readFile(LEGACY_CITIES, 'utf8'))
  } catch {
    /* ignore */
  }
  const countryByCode = new Map(countries.map((c) => [c.code, c]))
  return { countryByCode, legacyCities: cities }
}

async function fetchRestCountries() {
  const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,currencies,translations,flag')
  if (!res.ok) throw new Error(`REST Countries HTTP ${res.status}`)
  return res.json()
}

function pickCurrency(currencies) {
  if (!currencies || typeof currencies !== 'object') return 'USD'
  const keys = Object.keys(currencies)
  return keys[0] || 'USD'
}

function pickFrenchName(item, translations) {
  const fr = translations?.fra?.common || translations?.fra?.official
  if (fr) return fr
  return item.name?.common || item.name?.official || ''
}

async function main() {
  const { countryByCode, legacyCities } = await loadLegacyOverrides()

  console.log('📡 REST Countries…')
  const remote = await fetchRestCountries()

  const countries = remote
    .map((item) => {
      const code = (item.cca2 || '').toUpperCase()
      if (!code) return null
      const legacy = countryByCode.get(code)
      const nameEn = item.name?.common || legacy?.nameEn || code
      const nameFr = pickFrenchName(item, item.translations) || legacy?.nameFr || nameEn
      return {
        code,
        nameFr,
        nameEn,
        ...(legacy?.nameFon ? { nameFon: legacy.nameFon } : {}),
        currency: legacy?.currency || pickCurrency(item.currencies),
        flag: legacy?.flag || flagEmoji(code),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr'))

  const countriesJson = JSON.stringify(countries, null, 2) + '\n'

  const cscCountries = Country.getAllCountries()
  let totalCities = 0
  const cityCodes = []

  for (const refDir of REF_TARGETS) {
    await fs.mkdir(path.join(refDir, 'cities-by-country'), { recursive: true })
    await fs.writeFile(path.join(refDir, 'countries.json'), countriesJson, 'utf8')
    console.log(`✅ ${countries.length} pays → ${path.join(refDir, 'countries.json')}`)
  }

  for (const c of cscCountries) {
    const code = (c.isoCode || '').toUpperCase()
    if (!code) continue

    const raw = City.getCitiesOfCountry(code) || []
    const legacy = legacyCities[code] || []
    const byId = new Map()

    for (const city of raw) {
      const name = city.name?.trim()
      if (!name) continue
      const id = slugify(name)
      if (!id) continue
      byId.set(id, { id, nameFr: name, nameEn: name })
    }

    for (const city of legacy) {
      byId.set(city.id, {
        id: city.id,
        nameFr: city.nameFr || city.nameEn,
        nameEn: city.nameEn || city.nameFr,
        ...(city.nameFon ? { nameFon: city.nameFon } : {}),
      })
    }

    const list = [...byId.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
    if (!list.length) continue

    cityCodes.push(code)
    totalCities += list.length
    const payload = JSON.stringify(list, null, 0) + '\n'
    for (const refDir of REF_TARGETS) {
      await fs.writeFile(path.join(refDir, 'cities-by-country', `${code}.json`), payload, 'utf8')
    }
  }

  const loaderLines = [
    '// Fichier généré par scripts/generate-reference-geo.mjs — ne pas éditer à la main.',
    "import type { CityRef } from './index'",
    '',
    'const loaders: Record<string, () => CityRef[]> = {',
    ...cityCodes.map((code) => `  ${code}: () => require('./cities-by-country/${code}.json'),`),
    '}',
    '',
    'export function loadCitiesChunk(code: string): CityRef[] {',
    '  const upper = code.toUpperCase()',
    '  return loaders[upper]?.() ?? []',
    '}',
    '',
  ]
  await fs.writeFile(
    path.join(MOBILE_ROOT, 'src', 'data', 'reference', 'cities-loader.ts'),
    loaderLines.join('\n'),
    'utf8',
  )

  console.log(`✅ ${cityCodes.length} fichiers pays-villes, ${totalCities} villes au total`)
  console.log(`   → cities-by-country/ (web + mobile)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
