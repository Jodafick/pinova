import { computed, onMounted, ref } from 'vue'
import api from '../api/index'
import { useI18n } from '../i18n'
import { QUICK_PIN_DEFAULT_TOPIC } from './pinCreateShared'

export type TopicSuggestion = {
  name: string
  originalName: string
  icon?: string
  color?: string
}

export function useTopicSuggestions(initial = QUICK_PIN_DEFAULT_TOPIC) {
  const { currentLang } = useI18n()
  const selectedTopic = ref(initial)
  const suggestions = ref<TopicSuggestion[]>([])
  const loading = ref(false)

  const chipOptions = computed(() => {
    const seen = new Set<string>()
    const out: TopicSuggestion[] = []
    const push = (s: TopicSuggestion) => {
      const key = (s.originalName || s.name).trim().toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push(s)
    }
    push({ name: QUICK_PIN_DEFAULT_TOPIC, originalName: QUICK_PIN_DEFAULT_TOPIC })
    for (const s of suggestions.value) push(s)
    return out.slice(0, 8)
  })

  async function loadSuggestions() {
    loading.value = true
    try {
      const response = await api.get('pins/topics/', {
        params: { lang: currentLang.value, limit: 12 },
      })
      const payload = Array.isArray(response.data) ? response.data : []
      suggestions.value = payload
        .map((item: Record<string, unknown>) => ({
          name: String(item?.name || ''),
          originalName: String(item?.originalName || item?.name || ''),
          icon: item?.icon ? String(item.icon) : undefined,
          color: item?.color ? String(item.color) : undefined,
        }))
        .filter((item: TopicSuggestion) => item.name)
    } catch {
      suggestions.value = []
    } finally {
      loading.value = false
    }
  }

  function selectTopic(s: TopicSuggestion) {
    selectedTopic.value = (s.originalName || s.name).trim() || QUICK_PIN_DEFAULT_TOPIC
  }

  function isSelected(s: TopicSuggestion): boolean {
    const sel = selectedTopic.value.trim().toLowerCase()
    const canon = (s.originalName || s.name).trim().toLowerCase()
    const label = s.name.trim().toLowerCase()
    return sel === canon || sel === label
  }

  onMounted(() => {
    void loadSuggestions()
  })

  return { selectedTopic, chipOptions, loading, selectTopic, isSelected }
}
