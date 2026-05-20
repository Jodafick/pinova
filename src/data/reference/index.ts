import countriesJson from './countries.json'
import citiesJson from './cities.json'
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
export const REFERENCE_CITIES_BY_COUNTRY = citiesJson as Record<string, CityRef[]>
export const REFERENCE_INTERESTS = interestsJson as InterestRef[]
export const REFERENCE_ACCENT_COLORS = accentColorsJson as AccentColorRef[]
export type GenderRef = { id: string } & LocalizedNames
export type PronounRef = { id: string } & LocalizedNames

export const REFERENCE_GENDERS = gendersJson as GenderRef[]
export const REFERENCE_PRONOUNS = pronounsJson as PronounRef[]

export function pickLocalizedName(item: LocalizedNames, lang: string): string {
  if (lang === 'en') return item.nameEn
  if (lang === 'fon' && item.nameFon) return item.nameFon
  return item.nameFr
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

export function citiesForCountry(code: string): CityRef[] {
  return REFERENCE_CITIES_BY_COUNTRY[code.toUpperCase()] ?? []
}

export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}
