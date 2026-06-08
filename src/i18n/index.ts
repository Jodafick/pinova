import { ref, computed } from 'vue'
import { en } from './locales/en'
import { fr } from './locales/fr'
import { fon } from './locales/fon'
import {
  PINOVA_LANGUAGES,
  detectBrowserLangCode,
  getLanguageMeta,
  isSupportedLang,
  type LangCode,
  type PinovaLanguage,
} from './languages.registry'

export type { LangCode, PinovaLanguage }
export {
  PINOVA_LANGUAGES,
  detectBrowserLangCode,
  getLanguageMeta,
  isSupportedLang,
  resolveLangFromBcp47,
  languageSearchHaystack,
  REGION_ORDER,
  REGION_LABELS,
} from './languages.registry'

const STORAGE_KEY = 'pinova_web_lang_v1'

export const languages: PinovaLanguage[] = [...PINOVA_LANGUAGES]

const localeModules = import.meta.glob<Record<string, Record<string, string>>>('./locales/*.ts')

const bundled: Record<string, Record<string, string>> = { en, fr, fon }
const loadedLocales = new Map<string, Record<string, string>>(Object.entries(bundled))
const loadingLocales = new Map<string, Promise<void>>()

function readStoredLang(): LangCode | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isSupportedLang(raw)) return raw
  } catch {
    /* ignore */
  }
  return null
}

function persistLang(code: LangCode) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
}

function applyDocumentLang(code: LangCode) {
  if (typeof document === 'undefined') return
  const meta = getLanguageMeta(code)
  document.documentElement.lang = code
  document.documentElement.dir = meta?.rtl ? 'rtl' : 'ltr'
}

async function loadLocaleDictionary(code: LangCode): Promise<void> {
  if (loadedLocales.has(code)) return
  const existing = loadingLocales.get(code)
  if (existing) return existing

  const path = `./locales/${code}.ts`
  const loader = localeModules[path]
  if (!loader) {
    loadedLocales.set(code, en)
    return
  }

  const promise = loader()
    .then((mod) => {
      const dict = mod[code] ?? mod.default ?? en
      loadedLocales.set(code, dict)
    })
    .catch(() => {
      loadedLocales.set(code, en)
    })
    .finally(() => {
      loadingLocales.delete(code)
    })

  loadingLocales.set(code, promise)
  return promise
}

const initialLang = readStoredLang() ?? detectBrowserLangCode()
const currentLang = ref<LangCode>(initialLang)
applyDocumentLang(initialLang)
void loadLocaleDictionary(initialLang)

export function getCurrentWebLang(): LangCode {
  return currentLang.value
}

export const useI18n = () => {
  const localeLoading = ref(false)

  const setLang = async (code: LangCode) => {
    localeLoading.value = true
    try {
      await loadLocaleDictionary(code)
      currentLang.value = code
      persistLang(code)
      applyDocumentLang(code)
    } finally {
      localeLoading.value = false
    }
  }

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = loadedLocales.get(currentLang.value) || en
    const fallback = en
    const bridge = loadedLocales.get('fr') || fr
    let str = dict[key] ?? bridge[key] ?? fallback[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`{${k}}`, 'g'), String(v))
      }
    }
    return str
  }

  const currentLangMeta = computed(() => getLanguageMeta(currentLang.value) ?? PINOVA_LANGUAGES[1])
  const isRtl = computed(() => !!currentLangMeta.value.rtl)
  const browserLang = computed(() => detectBrowserLangCode())

  return {
    currentLang,
    currentLangMeta,
    browserLang,
    isRtl,
    localeLoading,
    languages,
    setLang,
    t,
    preloadLocale: loadLocaleDictionary,
  }
}
