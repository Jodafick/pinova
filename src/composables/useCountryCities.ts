import { ref, watch, type Ref } from 'vue'
import { loadCitiesForCountry, type CityRef } from '../data/reference'

export function useCountryCities(countryCode: Ref<string>) {
  const cities = ref<CityRef[]>([])
  const loading = ref(false)

  watch(
    countryCode,
    async (code) => {
      if (!code) {
        cities.value = []
        return
      }
      loading.value = true
      try {
        const result = await loadCitiesForCountry(code)
        cities.value = Array.isArray(result) ? result : []
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  return { cities, loading }
}
