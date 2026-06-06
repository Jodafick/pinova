import { onMounted, watch, type Ref } from 'vue'
import type { CampaignTargeting } from './useCampaignTargeting'

const DRAFT_KEY = 'pinova_campaign_draft_v1'

export type CampaignDraft = {
  headline: string
  body: string
  ctaUrl: string
  ctaLabel: string
  packageSlug: string
  targeting: CampaignTargeting
}

function readDraft(): Partial<CampaignDraft> | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<CampaignDraft>
  } catch {
    return null
  }
}

function writeDraft(draft: CampaignDraft) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function clearCampaignDraft() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export function useCampaignDraft(fields: {
  headline: Ref<string>
  body: Ref<string>
  ctaUrl: Ref<string>
  ctaLabel: Ref<string>
  packageSlug: Ref<string>
  targeting: Ref<CampaignTargeting>
}) {
  onMounted(() => {
    const saved = readDraft()
    if (!saved) return
    if (saved.headline) fields.headline.value = saved.headline
    if (saved.body) fields.body.value = saved.body
    if (saved.ctaUrl) fields.ctaUrl.value = saved.ctaUrl
    if (saved.ctaLabel) fields.ctaLabel.value = saved.ctaLabel
    if (saved.packageSlug) fields.packageSlug.value = saved.packageSlug
    if (saved.targeting) fields.targeting.value = saved.targeting
  })

  watch(
    () => ({
      headline: fields.headline.value,
      body: fields.body.value,
      ctaUrl: fields.ctaUrl.value,
      ctaLabel: fields.ctaLabel.value,
      packageSlug: fields.packageSlug.value,
      targeting: fields.targeting.value,
    }),
    (draft) => {
      if (!draft.headline && !draft.body && !draft.ctaUrl) return
      writeDraft(draft as CampaignDraft)
    },
    { deep: true },
  )
}
