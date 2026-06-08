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
        cities.value = await loadCitiesForCountry(code)
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  return { cities, loading }
}
