<script setup lang="ts">
const props = defineProps<{
  topics: string[]
  activeTopic: string | null
}>()

const emit = defineEmits<{
  (e: 'select', topic: string | null): void
}>()

const handleClick = (topic: string) => {
  if (props.activeTopic === topic) {
    emit('select', null)
  } else {
    emit('select', topic)
  }
}
</script>

<template>
  <section class="mb-4 sm:mb-5">
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        v-for="topic in topics"
        :key="topic"
        class="shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors"
        :class="
          topic === activeTopic
            ? 'bg-neutral-900 text-white'
            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
        "
        @click="handleClick(topic)"
      >
        {{ topic }}
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

