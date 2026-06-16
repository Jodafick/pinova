<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '../i18n'
import CampaignTargetingPanel from './CampaignTargetingPanel.vue'
import type { CampaignTargeting } from '../composables/useCampaignTargeting'
import { emptyTargeting } from '../composables/useCampaignTargeting'

const props = defineProps<{ open: boolean; modelValue: CampaignTargeting }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:modelValue', v: CampaignTargeting): void
}>()

const { t } = useI18n()
const draft = ref<CampaignTargeting>(emptyTargeting())

watch(
  () => props.open,
  (v) => {
    if (v) draft.value = { ...emptyTargeting(), ...props.modelValue }
  },
)

function save() {
  emit('update:modelValue', draft.value)
  emit('close')
}

function reset() {
  draft.value = emptyTargeting()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[240] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-[2px]"
      @click.self="emit('close')"
    >
      <div
        class="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-950 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div class="shrink-0 px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600">{{ t('promote.targeting.modalKicker') }}</p>
            <h2 class="text-lg font-bold">{{ t('promote.targeting.title') }}</h2>
          </div>
          <button type="button" class="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center" @click="emit('close')">
            <FotoceIcon name="close" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <CampaignTargetingPanel v-model="draft" />
        </div>
        <div class="shrink-0 px-5 py-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2">
          <button type="button" class="text-xs text-neutral-500 px-3 py-2" @click="reset">{{ t('promote.targeting.reset') }}</button>
          <button type="button" class="flex-1 rounded-xl bg-pink-700 text-white font-bold py-3" @click="save">
            {{ t('promote.targeting.apply') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
