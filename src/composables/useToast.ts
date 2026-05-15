/**
 * useToast — store singleton de toasts premium iOS-style.
 *
 *  Usage :
 *
 *    import { pushToast } from '@/composables/useToast'
 *    pushToast({ message: t('post.saved'), kind: 'success' })
 *    pushToast({ message: t('error.network'), kind: 'error', duration: 5000 })
 *
 *  Le composant `<AppToast />` (monté UNE FOIS dans `App.vue`) consomme la
 *  queue et affiche les toasts en pile (max 3 visibles, FIFO).
 *
 *  Caractéristiques :
 *   - file d'attente bornée (auto-purge des plus anciens)
 *   - haptic mappé sur `kind` via `emitMicroFeedback`
 *   - i18n-friendly : on attend des strings déjà traduites
 *   - dismiss via swipe (géré côté composant)
 */

import { readonly, ref, type Ref } from 'vue'
import { emitMicroFeedback, type FeedbackIntent } from './useMicroFeedback'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  /** Sous-titre / description discrète. */
  description?: string
  kind: ToastKind
  /** Durée en ms avant auto-dismiss. Default 3200 (5500 pour error). */
  duration: number
  /** Label CTA optionnel (s'affiche en bouton à droite). */
  actionLabel?: string
  /** Callback CTA. */
  onAction?: () => void
  /** Suppression manuelle (signalable depuis le store). */
  createdAt: number
}

export interface PushToastInput {
  message: string
  description?: string
  kind?: ToastKind
  duration?: number
  actionLabel?: string
  onAction?: () => void
  /** Évite de pousser deux fois le même message si déjà visible (dedup). */
  dedupKey?: string
}

const toasts: Ref<Toast[]> = ref([])
const MAX_VISIBLE = 3
let nextId = 1

const dedupRegistry = new Map<string, number>()

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  info: 3200,
  success: 3000,
  warning: 4200,
  error: 5500,
}

const KIND_TO_INTENT: Record<ToastKind, FeedbackIntent> = {
  info: 'navigation',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

/** Liste réactive des toasts visibles (max MAX_VISIBLE). */
export const toastList = readonly(toasts) as Readonly<Ref<readonly Toast[]>>

/**
 * Pousse un toast. Retourne son id (utile pour `dismissToast`).
 */
export function pushToast(input: PushToastInput): number {
  const kind: ToastKind = input.kind ?? 'info'

  /* Dedup : si un toast avec la même `dedupKey` est encore visible, on saute. */
  if (input.dedupKey) {
    const existingId = dedupRegistry.get(input.dedupKey)
    if (existingId && toasts.value.some((t) => t.id === existingId)) {
      return existingId
    }
  }

  const id = nextId++
  const toast: Toast = {
    id,
    message: input.message,
    description: input.description,
    kind,
    duration: input.duration ?? DEFAULT_DURATIONS[kind],
    actionLabel: input.actionLabel,
    onAction: input.onAction,
    createdAt: Date.now(),
  }
  toasts.value = [...toasts.value, toast].slice(-MAX_VISIBLE)
  if (input.dedupKey) dedupRegistry.set(input.dedupKey, id)

  /* Haptic mappé. */
  try { emitMicroFeedback(KIND_TO_INTENT[kind]) } catch { /* ignore */ }

  /* Auto-dismiss. */
  if (toast.duration > 0) {
    setTimeout(() => dismissToast(id), toast.duration)
  }
  return id
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
  /* Nettoyer dedup. */
  for (const [k, v] of dedupRegistry) {
    if (v === id) dedupRegistry.delete(k)
  }
}

export function clearAllToasts(): void {
  toasts.value = []
  dedupRegistry.clear()
}

/* Raccourcis sémantiques. */
export const toast = {
  info: (msg: string, opts?: Omit<PushToastInput, 'message' | 'kind'>) =>
    pushToast({ ...opts, message: msg, kind: 'info' }),
  success: (msg: string, opts?: Omit<PushToastInput, 'message' | 'kind'>) =>
    pushToast({ ...opts, message: msg, kind: 'success' }),
  warning: (msg: string, opts?: Omit<PushToastInput, 'message' | 'kind'>) =>
    pushToast({ ...opts, message: msg, kind: 'warning' }),
  error: (msg: string, opts?: Omit<PushToastInput, 'message' | 'kind'>) =>
    pushToast({ ...opts, message: msg, kind: 'error' }),
}

export function useToast() {
  return {
    toasts: toastList,
    push: pushToast,
    dismiss: dismissToast,
    clear: clearAllToasts,
    ...toast,
  }
}
