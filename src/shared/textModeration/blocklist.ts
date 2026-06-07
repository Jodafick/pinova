/** Liste ciblée : insultes violentes / propos haineux / porno explicite (pas vocabulaire sexuel courant). */

export const DEFAULT_BLOCKED_WORDS: readonly string[] = [
  // Slurs / haine (EN)
  'nigger', 'nigga', 'faggot', 'fagot', 'retard', 'kike', 'chink', 'spic',
  // Slurs / haine (FR)
  'bougnoule', 'youpin', 'bicot', 'raton', 'negro',
  // Insultes violentes (FR)
  'encule', 'enculé', 'enfoire', 'enfoiré', 'ntm',
  // Insultes violentes (EN)
  'motherfucker', 'cunt',
  // Porno explicite
  'pornhub', 'xvideos', 'xhamster', 'redtube', 'youporn', 'brazzers',
  'gangbang', 'bukkake', 'deepthroat', 'creampie', 'blowjob', 'handjob',
  'sextape', 'onlyfans',
]

export const DEFAULT_BLOCKED_PHRASES: readonly string[] = [
  'nique ta mere',
  'nique ta mère',
  'va te faire foutre',
  'va te faire enculer',
  'fils de pute',
  'fille de pute',
  'ta gueule',
  'ferme ta gueule',
  'je vais te tuer',
  'je te tue',
  'creve espèce',
  'creve espece',
  'fuck you',
  'go kill yourself',
  'kill yourself',
  'film porno',
  'video porno',
  'vidéo porno',
  'site porno',
  'porno gratuit',
  'free porn',
  'hardcore porn',
  'xxx video',
]

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
}

export function normalizeForTextScan(text: string): string {
  if (!text) return ''
  let lowered = text.toLowerCase()
  lowered = lowered.replace(/[013457@$]/g, (ch) => LEET_MAP[ch] ?? ch)
  const decomposed = lowered.normalize('NFD').replace(/\p{M}/gu, '')
  return decomposed.replace(/\s+/g, ' ').trim()
}

export function containsBlockedText(
  text: string,
  words: readonly string[] = DEFAULT_BLOCKED_WORDS,
  phrases: readonly string[] = DEFAULT_BLOCKED_PHRASES,
): boolean {
  const normalized = normalizeForTextScan(text)
  if (!normalized) return false

  for (const phrase of phrases) {
    const phraseNorm = normalizeForTextScan(phrase)
    if (phraseNorm && normalized.includes(phraseNorm)) return true
  }

  for (const word of words) {
    const wordNorm = normalizeForTextScan(word)
    if (!wordNorm) continue
    const escaped = wordNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'iu').test(normalized)) return true
  }

  return false
}
