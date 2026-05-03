import type { LangCode } from '../i18n'

function localeTag(lang: LangCode): string {
  const map: Record<LangCode, string> = {
    fr: 'fr-FR',
    en: 'en-US',
  }
  return map[lang] ?? 'en-US'
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

/**
 * Affiche un libellé relatif courts : instant, minutes, heures, jours, puis date courte.
 */
export function formatCommentRelativeTime(iso: string | undefined, lang: LangCode, t: TFn): string {
  if (!iso) return ''
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  const then = parsed
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (diff < 60_000) return t('comment.time.justNow')
  if (diff < hour) return t('comment.time.minutes', { count: Math.floor(diff / minute) })

  if (diff < day) {
    const h = Math.floor(diff / hour)
    return h <= 1 ? t('comment.time.hourOne') : t('comment.time.hours', { count: h })
  }

  if (diff < 14 * day) {
    const days = Math.floor(diff / day)
    return days <= 1 ? t('comment.time.dayOne') : t('comment.time.days', { count: days })
  }

  const d = new Date(then)
  const yCur = new Date().getFullYear()
  return d.toLocaleDateString(localeTag(lang), {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== yCur ? { year: 'numeric' } : {}),
  })
}
