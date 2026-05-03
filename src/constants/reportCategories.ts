/** Aligné sur `pinova-backend/pins/report_constants.py` — codes API. */
export const REPORT_CATEGORY_CODES = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'illegal',
  'minor',
  'impersonation',
  'copyright',
  'other',
] as const

export type ReportCategoryCode = (typeof REPORT_CATEGORY_CODES)[number]
