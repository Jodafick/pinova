<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => {
  void router.replace({ name: 'boost-promote', query: { tab: 'campaigns' } })
})
</script>

<template>
  <div class="py-20 text-center text-sm text-neutral-500">…</div>
</template>
