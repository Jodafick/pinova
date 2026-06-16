/** Scan texte — blocklist ciblée (alignée backend), sans glin-profanity. */

import { containsBlockedText } from '@fotoce/shared'

export async function moderationScanText(parts: string[]): Promise<{ ok: true } | { ok: false }> {
  const joined = parts.filter(Boolean).join('\n')
  if (!joined.trim()) return { ok: true }
  if (containsBlockedText(joined)) return { ok: false }
  return { ok: true }
}
