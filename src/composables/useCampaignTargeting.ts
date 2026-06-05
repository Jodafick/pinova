import { onMounted, ref } from 'vue'
import api from '../api'

export type CampaignTargeting = {
  countries: string[]
  languages: string[]
  currencies: string[]
  plans: string[]
  genders: string[]
  cities: string[]
  interests: string[]
  hobbies: string[]
  topics: string[]
  age_min: number | null
  age_max: number | null
}

export type TargetingOption = { code: string; label: string }
export type TopicOption = { slug: string; name: string }

export type TargetingOptions = {
  countries: TargetingOption[]
  languages: TargetingOption[]
  currencies: TargetingOption[]
  plans: TargetingOption[]
  genders: TargetingOption[]
  topics: TopicOption[]
  interest_suggestions: string[]
  hobby_suggestions: string[]
}

export function countTargetingFilters(t: CampaignTargeting): number {
  let n = 0
  if (t.countries.length) n++
  if (t.languages.length) n++
  if (t.currencies.length) n++
  if (t.plans.length) n++
  if (t.genders.length) n++
  if (t.cities.length) n++
  if (t.interests.length) n++
  if (t.hobbies.length) n++
  if (t.topics.length) n++
  if (t.age_min != null || t.age_max != null) n++
  return n
}

export function emptyTargeting(): CampaignTargeting {
  return {
    countries: [],
    languages: [],
    currencies: [],
    plans: [],
    genders: [],
    cities: [],
    interests: [],
    hobbies: [],
    topics: [],
    age_min: null,
    age_max: null,
  }
}

export function useCampaignTargetingOptions() {
  const options = ref<TargetingOptions | null>(null)
  const loading = ref(false)

  async function load() {
    if (options.value) return
    loading.value = true
    try {
      const res = await api.get<TargetingOptions>('monetization/campaign-targeting-options/')
      options.value = res.data
    } finally {
      loading.value = false
    }
  }

  onMounted(() => void load())

  return { options, loading, load }
}

export function appendCampaignToFormData(
  fd: FormData,
  payload: {
    headline: string
    body: string
    ctaUrl: string
    ctaLabel: string
    packageSlug: string
    topicSlug?: string
    targeting: CampaignTargeting
    mediaFile?: File | null
    mediaType?: 'image' | 'video'
  },
) {
  fd.append('headline', payload.headline)
  fd.append('body', payload.body)
  fd.append('cta_url', payload.ctaUrl)
  fd.append('cta_label', payload.ctaLabel)
  fd.append('package', payload.packageSlug)
  if (payload.topicSlug) fd.append('topic_slug', payload.topicSlug)
  fd.append('targeting', JSON.stringify(payload.targeting))
  if (payload.mediaFile) {
    fd.append('media', payload.mediaFile)
    fd.append('media_type', payload.mediaType || 'image')
  }
}
