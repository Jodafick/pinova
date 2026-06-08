import { ref } from 'vue'

/** Incrémenté par le pull-to-refresh mobile : les pages écoutent et revalident en arrière-plan. */
export const appSoftRefreshTick = ref(0)

export function triggerAppSoftRefresh(): void {
  appSoftRefreshTick.value += 1
}
