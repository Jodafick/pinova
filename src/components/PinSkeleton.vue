<script setup lang="ts">
// No logic needed for skeleton
</script>

<template>
  <div class="flex gap-3 sm:gap-4 items-start animate-pulse" aria-hidden="true">
    <div
      v-for="i in 5"
      :key="i"
      class="flex-1 flex flex-col gap-3 sm:gap-4"
      :class="{
        'hidden': i > 2 && i <= 5,
        'sm:flex': i <= 3,
        'lg:flex': i <= 4,
        'xl:flex': i <= 5
      }"
    >
      <div
        v-for="j in 4"
        :key="j"
        class="bg-white rounded-2xl overflow-hidden shadow-sm"
      >
        <!-- Image placeholder with random heights -->
        <div 
          class="bg-neutral-200 w-full" 
          :style="{ height: [200, 300, 250, 400][(i + j) % 4] + 'px' }"
        ></div>
        
        <!-- Info placeholder -->
        <div class="px-2 pt-3 pb-4 space-y-2">
          <div class="h-4 bg-neutral-200 rounded w-3/4"></div>
          <div class="flex items-center gap-2 mt-2">
            <div class="w-6 h-6 rounded-full bg-neutral-200"></div>
            <div class="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
