import { ref } from 'vue'

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger'

const open = ref(false)
const mode = ref<'alert' | 'prompt'>('alert')
const title = ref('')
const message = ref('')
const variant = ref<AlertVariant>('info')
const inputValue = ref('')
const inputPlaceholder = ref('')

let resolveAlert: (() => void) | null = null
let resolvePrompt: ((value: string | null) => void) | null = null

export function useAppModal() {
  function showAlert(
    messageText: string,
    options?: { title?: string; variant?: AlertVariant },
  ): Promise<void> {
    return new Promise((resolve) => {
      mode.value = 'alert'
      title.value = options?.title?.trim() ?? ''
      message.value = messageText
      variant.value = options?.variant ?? 'info'
      resolveAlert = resolve
      open.value = true
    })
  }

  function showPrompt(options: {
    message: string
    title?: string
    defaultValue?: string
    placeholder?: string
    variant?: AlertVariant
  }): Promise<string | null> {
    return new Promise((resolve) => {
      mode.value = 'prompt'
      title.value = options.title?.trim() ?? ''
      message.value = options.message
      variant.value = options.variant ?? 'info'
      inputValue.value = options.defaultValue ?? ''
      inputPlaceholder.value = options.placeholder ?? ''
      resolvePrompt = resolve
      open.value = true
    })
  }

  function dismissAlert() {
    open.value = false
    const r = resolveAlert
    resolveAlert = null
    r?.()
  }

  function finishPrompt(ok: boolean) {
    open.value = false
    const r = resolvePrompt
    resolvePrompt = null
    if (!r) return
    r(ok ? inputValue.value.trim() : null)
  }

  return {
    open,
    mode,
    title,
    message,
    variant,
    inputValue,
    inputPlaceholder,
    showAlert,
    showPrompt,
    dismissAlert,
    finishPrompt,
  }
}
