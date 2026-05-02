import type { AlertVariant } from '../composables/useAppModal'

export type ShareUi = {
  showAlert: (message: string, options?: { title?: string; variant?: AlertVariant }) => Promise<void>
  showPrompt: (options: {
    message: string
    title?: string
    defaultValue?: string
    placeholder?: string
    variant?: AlertVariant
  }) => Promise<string | null>
}

function uniqueShareCandidates(url: string, title?: string, text?: string): ShareData[] {
  const t = title?.trim()
  const x = text?.trim()
  const raw: ShareData[] = []

  if (t && x) raw.push({ title: t, text: x, url })
  if (t) raw.push({ title: t, url })
  if (x) raw.push({ text: x, url })
  raw.push({ url })

  if (t || x) {
    const combo = [t, x].filter(Boolean).join('\n').trim()
    if (combo) raw.push({ text: `${combo}\n${url}`, url })
  }

  const seen = new Set<string>()
  const out: ShareData[] = []
  for (const data of raw) {
    const hasPayload = !!(data.url || data.text || data.title || (data.files && data.files.length > 0))
    if (!hasPayload) continue
    const key = JSON.stringify({
      url: data.url,
      title: data.title,
      text: data.text,
    })
    if (seen.has(key)) continue
    seen.add(key)
    out.push(data)
  }
  return out
}

/** Partage système (Web Share API). `'aborted'` = utilisateur a fermé la feuille ; pas de fallback presse‑papiers. */
async function tryNativeShare(opts: { url: string; title?: string; text?: string }): Promise<'shared' | 'aborted' | 'unavailable'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unavailable'
  }

  const candidates = uniqueShareCandidates(opts.url, opts.title, opts.text)

  for (const data of candidates) {
    if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
      continue
    }
    try {
      await navigator.share(data)
      return 'shared'
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : ''
      if (name === 'AbortError') return 'aborted'
    }
  }
  return 'unavailable'
}

/**
 * Partage système en priorité (plusieurs variantes ShareData pour compatibilité),
 * puis presse‑papiers, puis invitation à copier manuellement.
 */
export async function shareUrlWithFallback(
  ui: ShareUi,
  opts: {
    url: string
    title?: string
    text?: string
    copiedMessage: string
    copyErrorMessage: string
    copyErrorTitle?: string
    manualTitle: string
    manualBody: string
  },
): Promise<void> {
  const native = await tryNativeShare(opts)
  if (native === 'shared' || native === 'aborted') return

  try {
    await navigator.clipboard.writeText(opts.url)
    await ui.showAlert(opts.copiedMessage, { variant: 'success' })
  } catch {
    await ui.showPrompt({
      title: opts.manualTitle,
      message: `${opts.manualBody}\n${opts.url}`,
      defaultValue: opts.url,
      variant: 'info',
    })
  }
}
