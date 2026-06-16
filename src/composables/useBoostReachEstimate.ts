import { ref, watch } from 'vue'
import api from '../api/index'

export type BoostReachEstimate = {
  baseline_views_7d: number
  estimated_min: number
  estimated_max: number
  duration_hours: number
  heuristic: boolean
}

export function useBoostReachEstimate(fotoSlug: () => string | undefined, packageSlug: () => string | undefined) {
  const estimate = ref<BoostReachEstimate | null>(null)
  const loading = ref(false)

  watch(
    [fotoSlug, packageSlug],
    async () => {
      const slug = fotoSlug()
      if (!slug) {
        estimate.value = null
        return
      }
      loading.value = true
      try {
        const pkg = packageSlug()
        const res = await api.get<BoostReachEstimate>(
          `monetization/fotos/${encodeURIComponent(slug)}/boost-estimate/`,
          { params: pkg ? { package: pkg } : {} },
        )
        estimate.value = res.data
      } catch {
        estimate.value = null
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  return { estimate, loading }
}
