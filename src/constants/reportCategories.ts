/** Aligné sur `fotoce-backend/pins/report_constants.py` — 3 branches simplifiées. */

export const REPORT_CATEGORY_CODES = ['harmful', 'spam_scam', 'other'] as const



export type ReportCategoryCode = (typeof REPORT_CATEGORY_CODES)[number]

