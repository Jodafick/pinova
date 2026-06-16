/**
 * Feature flags A/B — bucketing stable par utilisateur anonyme.
 * Override via VITE_FEATURE_<FLAG>=true|false (ex. VITE_FEATURE_ONBOARDING_V2).
 */
export type FeatureFlag = 'onboarding_v2'

type FlagDefinition = {
  storageKey: string
  envKey: string
  /** Pourcentage d'activation quand l'env n'est pas défini (0–100). */
  rolloutPercent: number
}

const FLAG_DEFS: Record<FeatureFlag, FlagDefinition> = {
  onboarding_v2: {
    storageKey: 'fotoce_flag_onboarding_v2',
    envKey: 'VITE_FEATURE_ONBOARDING_V2',
    rolloutPercent: 100,
  },
}

const DISTINCT_STORAGE = 'fotoce_analytics_distinct_id'

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* noop */
  }
}

function readDistinctId(): string {
  const stored = readStorage(DISTINCT_STORAGE)
  if (stored?.trim()) return stored.trim()
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  writeStorage(DISTINCT_STORAGE, id)
  return id
}

function hashToPercent(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100
}

function parseEnvBool(raw: string | undefined): boolean | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false
  return null
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const def = FLAG_DEFS[flag]
  const envRaw = (import.meta.env[def.envKey] as string | undefined) ?? undefined
  const envOverride = parseEnvBool(envRaw)
  if (envOverride !== null) return envOverride

  const cached = readStorage(def.storageKey)
  if (cached === '1') return true
  if (cached === '0') return false

  const enabled = hashToPercent(`${flag}:${readDistinctId()}`) < def.rolloutPercent
  writeStorage(def.storageKey, enabled ? '1' : '0')
  return enabled
}

export function getFeatureFlagVariant(flag: FeatureFlag): 'on' | 'off' {
  return isFeatureEnabled(flag) ? 'on' : 'off'
}
