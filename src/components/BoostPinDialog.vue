<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

const props = defineProps<{ pinSlug: string; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const { showAlert } = useAppModal()

type Pack = { slug: string; label: string; duration_hours: number; amount: number; currency_iso: string }
const packs = ref<Pack[]>([])
const busy = ref(false)

onMounted(async () => {
  const res = await api.get<{ results: Pack[] }>('monetization/boost-packages/')
  packs.value = res.data.results ?? []
})

async function startBoost(slug: string) {
  busy.value = true
  try {
    const res = await api.post(`monetization/pins/${encodeURIComponent(props.pinSlug)}/boost/`, {
      package: slug,
    })
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active') {
      await showAlert(t('pin.boost.success'), { variant: 'success' })
      emit('close')
      return
    }
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-2xl app-card p-5 space-y-4 shadow-xl">
      <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('pin.boost.title') }}</h2>
      <p class="text-sm text-neutral-500">{{ t('pin.boost.desc') }}</p>
      <div class="space-y-2">
        <button
          v-for="p in packs"
          :key="p.slug"
          type="button"
          class="w-full flex items-center justify-between rounded-xl border app-divider-subtle px-4 py-3 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors disabled:opacity-50"
          :disabled="busy"
          @click="startBoost(p.slug)"
        >
          <span class="font-medium text-sm">{{ p.label }}</span>
          <span class="text-xs text-neutral-500">{{ p.amount }} {{ p.currency_iso }}</span>
        </button>
      </div>
      <button type="button" class="w-full text-sm text-neutral-500 py-2" @click="emit('close')">
        {{ t('modal.cancel') }}
      </button>
    </div>
  </div>
</template>
