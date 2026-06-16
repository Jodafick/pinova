/**
 * useImmersiveViewer — API impérative pour ouvrir l'ImmersiveMediaViewer.
 *
 * Pattern singleton : un seul viewer global monté dans `App.vue`. N'importe
 * quel composant peut l'invoquer via `openImmersiveViewer({...})` sans avoir
 * à passer de prop ni à monter sa propre instance.
 *
 * Pourquoi singleton ?
 *  - Empêche l'ouverture multiple simultanée (chaos visuel)
 *  - Mémoire stable (un seul ensemble de listeners, pool video, etc.)
 *  - Cohérence (back button gère toujours le même état)
 *
 * Usage côté caller :
 *
 *   import { openImmersiveViewer } from '@/composables/useImmersiveViewer'
 *   openImmersiveViewer({
 *     items: [{ type: 'image', src: foto.imageUrl, blurhash: foto.blurhash }],
 *     initialIndex: 0,
 *     onLike: (item) => saveFoto(item),
 *     onClose: () => console.log('closed'),
 *   })
 *
 * Usage côté host (App.vue) :
 *
 *   <ImmersiveMediaViewer
 *     v-model:open="viewer.open.value"
 *     :items="viewer.items.value"
 *     :initial-index="viewer.initialIndex.value"
 *     @change-index="viewer.onChangeIndex"
 *   />
 */
import { ref, type Ref } from 'vue'
import type { ImmersiveMediaItem } from '../components/ui/ImmersiveMediaViewer.vue'

export interface OpenImmersiveViewerRequest {
  items: ImmersiveMediaItem[]
  initialIndex?: number
  title?: string
  zoomEnabled?: boolean
  swipeEnabled?: boolean
  onLike?: (item: ImmersiveMediaItem, point: { x: number; y: number }) => void
  onChangeIndex?: (idx: number) => void
  onClose?: () => void
}

const open = ref(false)
const items = ref<ImmersiveMediaItem[]>([])
const initialIndex = ref(0)
const title = ref<string | undefined>(undefined)
const zoomEnabled = ref(true)
const swipeEnabled = ref(true)

let activeRequest: OpenImmersiveViewerRequest | null = null

export interface UseImmersiveViewer {
  open: Ref<boolean>
  items: Ref<ImmersiveMediaItem[]>
  initialIndex: Ref<number>
  title: Ref<string | undefined>
  zoomEnabled: Ref<boolean>
  swipeEnabled: Ref<boolean>
  onChangeIndex: (idx: number) => void
  onLike: (item: ImmersiveMediaItem, point: { x: number; y: number }) => void
  onCloseInternal: () => void
}

export function useImmersiveViewer(): UseImmersiveViewer {
  return {
    open,
    items,
    initialIndex,
    title,
    zoomEnabled,
    swipeEnabled,
    onChangeIndex(idx: number) {
      activeRequest?.onChangeIndex?.(idx)
    },
    onLike(item, point) {
      activeRequest?.onLike?.(item, point)
    },
    onCloseInternal() {
      activeRequest?.onClose?.()
      activeRequest = null
    },
  }
}

/**
 * Ouvre le viewer impérativement.
 */
export function openImmersiveViewer(req: OpenImmersiveViewerRequest): void {
  activeRequest = req
  items.value = req.items
  initialIndex.value = req.initialIndex ?? 0
  title.value = req.title
  zoomEnabled.value = req.zoomEnabled ?? true
  swipeEnabled.value = req.swipeEnabled ?? true
  /* Petit microtask delay pour permettre au DOM de monter le viewer si jamais
     il n'est pas encore présent. */
  queueMicrotask(() => { open.value = true })
}

/**
 * Ferme le viewer (annule la requête active).
 */
export function closeImmersiveViewer(): void {
  open.value = false
  activeRequest = null
}
