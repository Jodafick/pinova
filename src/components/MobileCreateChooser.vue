<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '../i18n'
import PinovaModal from './ui/PinovaModal.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    canCreateStory?: boolean
  }>(),
  {
    canCreateStory: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()

const isDesktop = ref(false)
let removeMql: (() => void) | null = null
onMounted(() => {
  if (typeof window === 'undefined') return
  const mql = window.matchMedia('(min-width: 1024px)')
  isDesktop.value = mql.matches
  const fn = () => {
    isDesktop.value = mql.matches
  }
  mql.addEventListener('change', fn)
  removeMql = () => mql.removeEventListener('change', fn)
})
onBeforeUnmount(() => {
  removeMql?.()
  removeMql = null
})

const modalOpen = computed(() => props.modelValue && !isDesktop.value)

watch(isDesktop, (lg) => {
  if (lg && props.modelValue) emit('update:modelValue', false)
})

function close() {
  emit('update:modelValue', false)
}

/*
 * Sur mobile on quitte le SPA via une vraie navigation <a href>. Le router
 * Vue + le routerLayerBridge restent neutres : la nouvelle page se rend en
 * cold-start, ce qui évite les bugs de couche plein écran (écran noir,
 * clics morts) observés en navigation interne. On ferme juste la modale
 * avant que le navigateur prenne la main, sans preventDefault.
 *
 * `pinova-skip-splash` (sessionStorage) : marque l'intention de navigation
 * vers la création. Au boot suivant, App.vue le détecte et saute le splash
 * pour donner une impression de continuité (pas de gros écran rose au milieu).
 */
const SKIP_SPLASH_FLAG = 'pinova-skip-splash'

function markSkipSplash() {
  try {
    sessionStorage.setItem(SKIP_SPLASH_FLAG, '1')
  } catch {
    /* quota / mode privé */
  }
}

function onPinLinkClick() {
  markSkipSplash()
  close()
}

function onStoryLinkClick(ev: MouseEvent) {
  if (!props.canCreateStory) {
    ev.preventDefault()
    return
  }
  markSkipSplash()
  close()
}
</script>

<template>
  <PinovaModal
    :open="modalOpen"
    presentation="tallSheet"
    rose
    :show-header="false"
    :depth-effect="true"
    @update:open="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="px-1 pb-1">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-neutral-950 dark:text-neutral-50">{{ t('create.mobile.title') }}</h2>
          <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{{ t('create.mobile.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/[0.06] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
          :aria-label="t('common.close')"
          @click="close"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">close</span>
        </button>
      </div>

      <div class="grid gap-2.5">
        <!--
          Liens <a> natifs (pas router.push) : sur mobile la création est ouverte
          en navigation pleine page pour contourner le système de couches qui
          provoquait écrans noirs / clics morts. Le href reste une vraie URL de
          l'app — Vue Router prendra le relais après le hard navigate.
        -->
        <a
          href="/create"
          class="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/80 px-4 py-3 text-left text-pink-950 transition active:scale-[0.99] dark:border-pink-900/50 dark:bg-pink-950/35 dark:text-pink-100 no-underline"
          @click="onPinLinkClick"
        >
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pink-700 text-white shadow-lg shadow-pink-900/20 dark:bg-pink-600">
            <span class="material-symbols-outlined text-2xl">add_photo_alternate</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-black">{{ t('create.mobile.pinTitle') }}</span>
            <span class="block text-xs text-pink-900/70 dark:text-pink-100/70">{{ t('create.mobile.pinSubtitle') }}</span>
          </span>
        </a>

        <a
          v-if="canCreateStory"
          href="/story/create"
          class="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] border-violet-100 bg-violet-50/80 text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/35 dark:text-violet-100 no-underline"
          @click="onStoryLinkClick"
        >
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-lg bg-violet-600 shadow-violet-900/20">
            <span class="material-symbols-outlined text-2xl">auto_stories</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-black">{{ t('create.mobile.storyTitle') }}</span>
            <span class="block text-xs opacity-75">{{ t('create.mobile.storySubtitle') }}</span>
          </span>
        </a>
        <button
          v-else
          type="button"
          class="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500"
          disabled
        >
          <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-lg bg-neutral-400 shadow-black/10">
            <span class="material-symbols-outlined text-2xl">auto_stories</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-black">{{ t('create.mobile.storyTitle') }}</span>
            <span class="block text-xs opacity-75">{{ t('create.mobile.storyLocked') }}</span>
          </span>
        </button>
      </div>

      <p class="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('create.mobile.sourceChooserFootnote') }}
      </p>
    </div>
  </PinovaModal>
</template>
