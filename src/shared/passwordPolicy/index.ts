/** Politique mot de passe Pinova — miroir client de accounts/password_policy.py */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_VALID_EXAMPLE = 'Pinova2026'

export const PASSWORD_RULE_IDS = ['min_length', 'has_letter', 'has_digit', 'not_trivial'] as const
export type PasswordRuleId = (typeof PASSWORD_RULE_IDS)[number]

const LETTER_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]/
const DIGIT_RE = /\d/

const TRIVIAL_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'azerty123',
  'admin123',
  'letmein1',
  'welcome1',
  'pinova',
  'pinova123',
  'changeme',
  'changeme1',
  'iloveyou',
  'monmotdepasse',
  'motdepasse',
  'abcdefgh',
  'abc12345',
])

function normalize(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

function emailLocalPart(email: string | undefined | null): string {
  const raw = normalize(email)
  if (!raw.includes('@')) return raw
  return raw.split('@')[0] ?? raw
}

function isTrivialPassword(
  password: string,
  context?: { email?: string; username?: string },
): boolean {
  const lowered = normalize(password)
  if (!lowered) return true
  if (TRIVIAL_PASSWORDS.has(lowered)) return true

  const candidates = new Set([
    normalize(context?.username),
    normalize(context?.email),
    emailLocalPart(context?.email),
  ])
  candidates.delete('')
  for (const candidate of candidates) {
    if (!candidate) continue
    if (lowered === candidate) return true
    if (candidate.length >= 4 && lowered.includes(candidate)) return true
  }
  return false
}

export function evaluatePasswordRules(
  password: string,
  context?: { email?: string; username?: string },
): Record<PasswordRuleId, boolean> {
  const value = password || ''
  return {
    min_length: value.length >= PASSWORD_MIN_LENGTH,
    has_letter: LETTER_RE.test(value),
    has_digit: DIGIT_RE.test(value),
    not_trivial: !isTrivialPassword(value, context),
  }
}

export function allPasswordRulesMet(
  password: string,
  context?: { email?: string; username?: string },
): boolean {
  const rules = evaluatePasswordRules(password, context)
  return PASSWORD_RULE_IDS.every((id) => rules[id])
}

export function passwordStrengthScore(
  password: string,
  context?: { email?: string; username?: string },
): number {
  const rules = evaluatePasswordRules(password, context)
  return PASSWORD_RULE_IDS.filter((id) => rules[id]).length
}

export function passwordStrengthLabelKey(score: number): string {
  if (score <= 1) return 'passwordPolicy.strength.weak'
  if (score <= 3) return 'passwordPolicy.strength.medium'
  return 'passwordPolicy.strength.strong'
}
