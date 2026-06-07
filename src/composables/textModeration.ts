/** Scan texte profanité — glin-profanity chargé à la demande (routes création). */

export async function moderationScanText(parts: string[]): Promise<{ ok: true } | { ok: false }> {
  const joined = parts.filter(Boolean).join('\n')
  if (!joined.trim()) return { ok: true }
  const { checkProfanity } = await import('glin-profanity')
  const r = checkProfanity(joined, {
    languages: ['french', 'english'],
    detectLeetspeak: true,
    normalizeUnicode: true,
  })
  if (r.containsProfanity) return { ok: false }
  return { ok: true }
}
