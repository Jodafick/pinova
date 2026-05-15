<script setup lang="ts">
export type TopicChip = { canonical: string; label: string }

const props = withDefaults(
  defineProps<{
    topics: TopicChip[]
    activeTopic: string | null
    /** Bandeau sous le header home : marges réduites, ligne centrée sur lg. */
    feedChrome?: boolean
  }>(),
  { feedChrome: false },
)

const emit = defineEmits<{
  (e: 'select', topic: string | null): void
}>()

const handleClick = (canonical: string) => {
  if (props.activeTopic === canonical) {
    emit('select', null)
  } else {
    emit('select', canonical)
  }
}
</script>

<template>
  <section :class="feedChrome ? 'mb-0 sm:mb-0' : 'mb-4 sm:mb-5'">
    <div
      class="flex items-center gap-2 overflow-x-auto no-scrollbar"
      :class="feedChrome ? 'min-h-11 w-full pb-1 lg:min-h-0 lg:pb-0' : 'pb-1'"
    >
      <button
        v-for="item in topics"
        :key="item.canonical"
        type="button"
        class="shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors"
        :class="
          item.canonical === activeTopic
            ? 'bg-neutral-900 text-white dark:bg-pink-600 dark:text-white dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
            : 'bg-[#f3f4f6] hover:bg-[#e8e8ed] text-neutral-800 dark:bg-[#07070a] dark:hover:bg-[#101014] dark:text-neutral-400 dark:ring-1 dark:ring-inset dark:ring-white/[0.07]'
        "
        @click="handleClick(item.canonical)"
      >
        {{ item.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
