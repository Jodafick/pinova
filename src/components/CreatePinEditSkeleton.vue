<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div
    class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
    role="status"
    :aria-label="t('pin.edit.loadingSkeleton')"
  >
    <!-- Header (comme création / édition réelle) -->
    <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between mb-8">
      <div class="space-y-3 min-w-0 flex-1">
        <div class="h-8 sm:h-9 w-[min(16rem,70%)] rounded-lg bg-neutral-200 animate-pulse" />
        <div class="h-4 w-full max-w-md rounded-md bg-neutral-100 animate-pulse" />
        <div class="h-3 w-48 rounded-md bg-neutral-100/90 animate-pulse" />
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="h-10 w-24 sm:w-28 rounded-full bg-neutral-200 animate-pulse" />
        <div class="h-10 w-32 sm:w-36 rounded-full bg-pink-200/80 animate-pulse" />
      </div>
    </div>

    <div class="bg-white rounded-3xl shadow-lg border border-neutral-100 overflow-hidden">
      <div class="flex flex-col lg:flex-row">
        <!-- Colonne média (équivalent étape 2) -->
        <div class="lg:w-2/5 p-6 sm:p-8 bg-neutral-50 border-b lg:border-b-0 lg:border-r border-neutral-100">
          <div
            class="w-full rounded-2xl bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200 animate-pulse min-h-[260px] sm:min-h-[320px]"
          />
        </div>

        <!-- Champs étape 1 (données texte après chargement) -->
        <div class="lg:w-3/5 p-6 sm:p-8 space-y-5">
          <div class="flex items-center gap-2 mb-2">
            <div class="h-7 w-7 rounded-full bg-neutral-200 animate-pulse" />
            <div class="h-3 w-3 rounded-full bg-neutral-100 animate-pulse" />
            <div class="h-7 w-7 rounded-full bg-neutral-100 animate-pulse" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-24 rounded bg-neutral-200 animate-pulse" />
            <div class="h-12 w-full rounded-xl bg-neutral-100 animate-pulse" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-32 rounded bg-neutral-200 animate-pulse" />
            <div class="h-[5.5rem] w-full rounded-xl bg-neutral-100 animate-pulse" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-28 rounded bg-neutral-200 animate-pulse" />
            <div class="h-12 w-full rounded-xl bg-neutral-100 animate-pulse" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-36 rounded bg-neutral-200 animate-pulse" />
            <div class="h-12 w-full rounded-xl bg-neutral-100 animate-pulse" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-28 rounded bg-neutral-200 animate-pulse" />
            <div class="h-12 w-full rounded-xl bg-neutral-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
