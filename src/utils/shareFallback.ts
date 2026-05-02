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

/**
 * Essaye navigator.share puis presse‑papiers puis invite à copier l’URL (comme PinDetail).
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
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: opts.title || 'Pinova',
        text: opts.text || '',
        url: opts.url,
      })
      return
    }
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : ''
    if (name === 'AbortError') return
  }
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
