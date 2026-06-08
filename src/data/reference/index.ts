import countriesJson from './countries.json'
import legacyCitiesJson from './cities.json'
import interestsJson from './interests.json'
import accentColorsJson from './accent-colors.json'
import gendersJson from './genders.json'
import pronounsJson from './pronouns.json'

export type LocalizedNames = { nameFr: string; nameEn: string; nameFon?: string }

export type CountryRef = LocalizedNames & {
  code: string
  currency: string
  flag: string
}

export type CityRef = LocalizedNames & { id: string }

export type InterestRef = LocalizedNames & {
  slug: string
  icon: string
  category: string
}

export type AccentColorRef = LocalizedNames & { id: string; hex: string }

export const REFERENCE_COUNTRIES = countriesJson as CountryRef[]
export const REFERENCE_INTERESTS = interestsJson as InterestRef[]
export const REFERENCE_ACCENT_COLORS = accentColorsJson as AccentColorRef[]
export type GenderRef = { id: string } & LocalizedNames
export type PronounRef = { id: string } & LocalizedNames

export const REFERENCE_GENDERS = gendersJson as GenderRef[]
export const REFERENCE_PRONOUNS = pronounsJson as PronounRef[]

/** Ancien fichier monolithique — conservé comme secours hors-ligne. */
const LEGACY_CITIES_BY_COUNTRY = legacyCitiesJson as Record<string, CityRef[]>

const cityChunkModules = import.meta.glob('./cities-by-country/*.json')

function normalizeCityChunk(mod: unknown): CityRef[] {
  if (Array.isArray(mod)) return mod as CityRef[]
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const inner = (mod as { default?: unknown }).default
    if (Array.isArray(inner)) return inner as CityRef[]
  }
  return []
}

const cityCache = new Map<string, CityRef[]>()
const cityLoadPromises = new Map<string, Promise<CityRef[]>>()

function slugifyCityId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function pickLocalizedName(item: LocalizedNames, lang: string): string {
  const code = (lang || 'fr').toLowerCase().split('-')[0]
  if (code === 'en') return item.nameEn
  if (code === 'fon' && item.nameFon) return item.nameFon
  if (code === 'fr') return item.nameFr
  return item.nameFr || item.nameEn
}

export function countryLabel(c: CountryRef, lang: string): string {
  return pickLocalizedName(c, lang)
}

export function cityLabel(c: CityRef, lang: string): string {
  return pickLocalizedName(c, lang)
}

export function interestLabel(i: InterestRef, lang: string): string {
  return pickLocalizedName(i, lang)
}

export function genderLabel(g: GenderRef, lang: string): string {
  return pickLocalizedName(g, lang)
}

export function pronounLabel(p: PronounRef, lang: string): string {
  return pickLocalizedName(p, lang)
}

export function accentLabel(a: AccentColorRef, lang: string): string {
  return pickLocalizedName(a, lang)
}

export async function loadCitiesForCountry(code: string): Promise<CityRef[]> {
  const upper = code.toUpperCase()
  if (!upper) return []

  const cached = cityCache.get(upper)
  if (cached) return cached

  const pending = cityLoadPromises.get(upper)
  if (pending) return pending

  const promise = (async () => {
    const chunkPath = `./cities-by-country/${upper}.json`
    const loader = cityChunkModules[chunkPath]
    let cities: CityRef[] = []

    if (loader) {
      cities = normalizeCityChunk(await loader())
    } else {
      cities = LEGACY_CITIES_BY_COUNTRY[upper] ?? []
    }

    cityCache.set(upper, cities)
    return cities
  })()

  cityLoadPromises.set(upper, promise)
  try {
    return await promise
  } finally {
    cityLoadPromises.delete(upper)
  }
}

/** Compatibilité synchrone — retourne le cache ou l'ancien jeu réduit. */
export function citiesForCountry(code: string): CityRef[] {
  const upper = code.toUpperCase()
  if (!upper) return []
  return cityCache.get(upper) ?? LEGACY_CITIES_BY_COUNTRY[upper] ?? []
}

export function searchCountries(query: string, lang: string): CountryRef[] {
  const q = query.trim().toLowerCase()
  if (!q) return REFERENCE_COUNTRIES
  return REFERENCE_COUNTRIES.filter((c) => {
    const hay = `${c.code} ${c.nameFr} ${c.nameEn} ${c.nameFon ?? ''} ${countryLabel(c, lang)}`.toLowerCase()
    return hay.includes(q)
  })
}

export async function searchCitiesInCountry(
  countryCode: string,
  query: string,
  lang: string,
  limit = 80,
): Promise<CityRef[]> {
  const cities = await loadCitiesForCountry(countryCode)
  const q = query.trim().toLowerCase()
  if (!q) return cities.slice(0, limit)
  return cities
    .filter((c) => {
      const hay = `${c.id} ${c.nameFr} ${c.nameEn} ${cityLabel(c, lang)}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, limit)
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

export { slugifyCityId }
