<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { usePwaContext } from '../composables/usePwaContext'
import { SETTINGS_HUB_GROUPS, type SettingsHubItem } from '../data/settingsHubConfig'

const { currentUser } = useAuth()
const { t } = useI18n()
const { isStandalone } = usePwaContext()

function itemVisible(item: SettingsHubItem): boolean {
  if (item.requiresUser && !currentUser.value) return false
  if (item.id === 'settings-pwa-reload' && !isStandalone.value) return false
  if (item.id === 'settings-pwa-install' && isStandalone.value) return false
  return true
}

const visibleGroups = computed(() =>
  SETTINGS_HUB_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(itemVisible),
  })).filter((g) => g.items.length > 0),
)
</script>

<template>
  <div
    class="pinova-settings-hub max-w-3xl mx-auto w-full min-w-0 overflow-x-clip px-4 sm:px-6 flex flex-col min-h-[min(100dvh,100svh)] pt-6 sm:pt-10 md:pt-12 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-12"
  >
    <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div class="settings-hub-orb settings-hub-orb--rose" />
      <div class="settings-hub-orb settings-hub-orb--violet" />
    </div>

    <header class="relative z-[1] mb-8">
      <h1 class="text-xl min-[400px]:text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50 mb-2">
        {{ t('settings.title') }}
      </h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-lg">
        {{ t('settings.hub.lead') }}
      </p>
    </header>

    <div class="relative z-[1] space-y-6">
      <section v-for="group in visibleGroups" :key="group.titleKey" class="settings-hub-group">
        <h2 class="settings-hub-group-title">{{ t(group.titleKey) }}</h2>
        <div
          class="settings-hub-card overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_-12px_rgba(0,0,0,.12)] dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
        >
          <RouterLink
            v-for="(item, idx) in group.items"
            :key="item.id"
            :to="{ name: 'settings-section', params: { sectionId: item.id } }"
            class="settings-hub-row group"
            :class="{ 'settings-hub-row--border': idx < group.items.length - 1 }"
          >
            <span
              class="settings-hub-row-icon material-symbols-outlined"
              aria-hidden="true"
            >{{ item.icon }}</span>
            <span class="settings-hub-row-label">{{ t(item.labelKey) }}</span>
            <span class="material-symbols-outlined settings-hub-row-chevron" aria-hidden="true">chevron_right</span>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-hub-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.45;
  pointer-events: none;
}
.settings-hub-orb--rose {
  width: 280px;
  height: 280px;
  top: -60px;
  left: -40px;
  background: rgba(244, 63, 94, 0.35);
}
.settings-hub-orb--violet {
  width: 240px;
  height: 240px;
  top: 120px;
  right: -50px;
  background: rgba(139, 92, 246, 0.28);
}
.settings-hub-group-title {
  margin-bottom: 0.65rem;
  padding-left: 0.25rem;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(115 115 115);
}
:global(html.dark) .settings-hub-group-title {
  color: rgb(163 163 163);
}
.settings-hub-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.25rem;
  padding: 0.85rem 1rem 0.85rem 1.1rem;
  transition: background-color 0.15s ease;
}
.settings-hub-row--border {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
:global(html.dark) .settings-hub-row--border {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.settings-hub-row:hover,
.settings-hub-row:focus-visible {
  background: rgba(244, 63, 94, 0.06);
}
:global(html.dark) .settings-hub-row:hover,
:global(html.dark) .settings-hub-row:focus-visible {
  background: rgba(244, 63, 94, 0.12);
}
.settings-hub-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  font-size: 1.25rem;
  color: rgb(190 24 93);
  background: rgba(244, 63, 94, 0.1);
}
:global(html.dark) .settings-hub-row-icon {
  color: rgb(251 113 133);
  background: rgba(244, 63, 94, 0.16);
}
.settings-hub-row-label {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgb(23 23 23);
}
:global(html.dark) .settings-hub-row-label {
  color: rgb(245 245 245);
}
.settings-hub-row-chevron {
  font-size: 1.35rem;
  color: rgb(163 163 163);
  transition: transform 0.15s ease, color 0.15s ease;
}
.group:hover .settings-hub-row-chevron {
  transform: translateX(2px);
  color: rgb(190 24 93);
}
</style>
