import { createSyncPendingIntentStorage } from '@fotoce/shared'

const storage =
  typeof sessionStorage !== 'undefined'
    ? createSyncPendingIntentStorage(sessionStorage)
    : createSyncPendingIntentStorage({
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      })

export const {
  peekPendingIntent,
  savePendingIntent,
  consumePendingIntent,
  clearPendingIntent,
} = storage
