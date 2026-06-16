/**
 * Transitions du `<router-view>` : détection avant / retour via une pile persistée
 * (sessionStorage). Évite `popstate` global : les couches (`layerManager`) font
 * aussi du pushState sans navigation Vue Router — un flag popstate fausserait la direction.
 *
 * Brancher une fois après `app.use(router)` : `installRouterViewTransition(router)`.
 */
import { ref } from 'vue'
import type { Router } from 'vue-router'
import type { PageNavDirection } from './adaptiveNavigator'

const NAV_STACK_KEY = 'fotoce-page-nav-stack-v1'
const MAX_STACK = 48

export const pageNavDirection = ref<PageNavDirection>('forward')
/** True uniquement pour la toute première résolution de route (entrée app / hard refresh). */
export const pageNavIsInitial = ref(true)

function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(NAV_STACK_KEY)
    const j = raw ? JSON.parse(raw) : []
    return Array.isArray(j) ? j.map(String) : []
  } catch {
    return []
  }
}

function writeStack(stack: string[]) {
  try {
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)))
  } catch {
    /* quota / privé */
  }
}

let installed = false

export function installRouterViewTransition(router: Router) {
  if (installed) return
  installed = true

  router.beforeEach((to, from) => {
    if (to.meta.noTransition) {
      pageNavDirection.value = 'forward'
      return true
    }

    if (!from.matched.length) {
      pageNavIsInitial.value = true
      pageNavDirection.value = 'forward'
      writeStack([to.fullPath])
      return true
    }

    pageNavIsInitial.value = false

    let stack = readStack()

    if (stack.length === 0) {
      stack = [from.fullPath]
    } else if (stack[stack.length - 1] !== from.fullPath) {
      const fromIdx = stack.lastIndexOf(from.fullPath)
      if (fromIdx >= 0) {
        stack = stack.slice(0, fromIdx + 1)
      } else {
        stack = [...stack, from.fullPath]
      }
    }

    const idx = stack.lastIndexOf(to.fullPath)
    if (idx >= 0 && idx < stack.length - 1) {
      pageNavDirection.value = 'back'
      writeStack(stack.slice(0, idx + 1))
    } else {
      pageNavDirection.value = 'forward'
      const last = stack[stack.length - 1]
      if (last !== to.fullPath) {
        writeStack([...stack, to.fullPath])
      } else {
        writeStack(stack)
      }
    }

    return true
  })
}
