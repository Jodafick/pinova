<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen" role="status" :aria-label="t('common.loading')">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div class="h-9 w-28 rounded-lg bg-neutral-200 animate-pulse mb-6" />
      <div class="bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col lg:flex-row lg:max-h-[80vh]">
        <div class="flex-1 lg:w-1/2 min-h-[220px] lg:min-h-[360px] bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200 animate-pulse" />
        <div class="lg:flex-1 p-6 sm:p-8 lg:p-10 flex flex-col gap-5">
          <div class="flex justify-between">
            <div class="flex gap-2">
              <div class="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
              <div class="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
              <div class="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
            </div>
            <div class="h-10 w-24 rounded-full bg-neutral-200 animate-pulse" />
          </div>
          <div class="h-4 w-[70%] max-w-md rounded bg-neutral-200 animate-pulse" />
          <div class="h-10 w-full max-w-xl rounded-xl bg-neutral-200 animate-pulse" />
          <div class="space-y-2">
            <div class="h-3 w-full rounded bg-neutral-100 animate-pulse" />
            <div class="h-3 w-[92%] rounded bg-neutral-100 animate-pulse" />
            <div class="h-3 w-[80%] rounded bg-neutral-100 animate-pulse" />
          </div>
          <div class="flex items-center gap-3 pt-6">
            <div class="w-10 h-10 rounded-full bg-neutral-200 animate-pulse" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-36 rounded bg-neutral-200 animate-pulse" />
              <div class="h-3 w-24 rounded bg-neutral-100 animate-pulse" />
            </div>
          </div>
          <div class="flex gap-6 pt-2">
            <div class="h-4 w-16 rounded bg-neutral-100 animate-pulse" />
            <div class="h-4 w-16 rounded bg-neutral-100 animate-pulse" />
            <div class="h-4 w-28 rounded bg-neutral-100 animate-pulse" />
          </div>
          <div class="border-t border-neutral-100 pt-6 mt-4 space-y-4">
            <div class="h-5 w-40 rounded bg-neutral-200 animate-pulse" />
            <div class="h-24 w-full rounded-2xl bg-neutral-100 animate-pulse" />
            <div class="h-10 w-full rounded-full bg-neutral-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
