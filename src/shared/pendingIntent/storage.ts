import {
  createPendingIntentId,
  PENDING_INTENT_STORAGE_KEY,
  PENDING_INTENT_TTL_MS,
  type PendingIntent,
  type PendingIntentMetadata,
  type PendingIntentType,
} from './types.js'

export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export function parsePendingIntent(raw: string): PendingIntent | null {
  try {
    const parsed = JSON.parse(raw) as PendingIntent
    if (!parsed?.type || !parsed?.resourceId || !parsed?.createdAt) return null
    if (Date.now() - parsed.createdAt > PENDING_INTENT_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function buildPendingIntent(input: {
  type: PendingIntentType
  resourceId: string
  metadata?: PendingIntentMetadata
}): PendingIntent {
  return {
    id: createPendingIntentId(),
    type: input.type,
    resourceId: input.resourceId.trim(),
    metadata: input.metadata,
    createdAt: Date.now(),
  }
}

async function readRaw(storage: KeyValueStorage): Promise<string | null> {
  try {
    return await storage.getItem(PENDING_INTENT_STORAGE_KEY)
  } catch {
    return null
  }
}

async function writeRaw(storage: KeyValueStorage, value: string | null): Promise<void> {
  try {
    if (value == null) await storage.removeItem(PENDING_INTENT_STORAGE_KEY)
    else await storage.setItem(PENDING_INTENT_STORAGE_KEY, value)
  } catch {
    /* quota / stockage indisponible */
  }
}

export function createPendingIntentStorage(storage: KeyValueStorage) {
  async function peekPendingIntent(): Promise<PendingIntent | null> {
    const raw = await readRaw(storage)
    if (!raw) return null
    const intent = parsePendingIntent(raw)
    if (!intent) {
      await writeRaw(storage, null)
      return null
    }
    return intent
  }

  async function savePendingIntent(input: {
    type: PendingIntentType
    resourceId: string
    metadata?: PendingIntentMetadata
  }): Promise<PendingIntent> {
    const intent = buildPendingIntent(input)
    await writeRaw(storage, JSON.stringify(intent))
    return intent
  }

  async function consumePendingIntent(): Promise<PendingIntent | null> {
    const intent = await peekPendingIntent()
    await writeRaw(storage, null)
    return intent
  }

  async function clearPendingIntent(): Promise<void> {
    await writeRaw(storage, null)
  }

  return {
    peekPendingIntent,
    savePendingIntent,
    consumePendingIntent,
    clearPendingIntent,
  }
}

/** Variante synchrone pour sessionStorage web. */
export function createSyncPendingIntentStorage(storage: {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}) {
  function readRaw(): string | null {
    try {
      return storage.getItem(PENDING_INTENT_STORAGE_KEY)
    } catch {
      return null
    }
  }

  function writeRaw(value: string | null): void {
    try {
      if (value == null) storage.removeItem(PENDING_INTENT_STORAGE_KEY)
      else storage.setItem(PENDING_INTENT_STORAGE_KEY, value)
    } catch {
      /* quota / mode privé */
    }
  }

  function peekPendingIntent(): PendingIntent | null {
    const raw = readRaw()
    if (!raw) return null
    const intent = parsePendingIntent(raw)
    if (!intent) {
      writeRaw(null)
      return null
    }
    return intent
  }

  function savePendingIntent(input: {
    type: PendingIntentType
    resourceId: string
    metadata?: PendingIntentMetadata
  }): PendingIntent {
    const intent = buildPendingIntent(input)
    writeRaw(JSON.stringify(intent))
    return intent
  }

  function consumePendingIntent(): PendingIntent | null {
    const intent = peekPendingIntent()
    writeRaw(null)
    return intent
  }

  function clearPendingIntent(): void {
    writeRaw(null)
  }

  return {
    peekPendingIntent,
    savePendingIntent,
    consumePendingIntent,
    clearPendingIntent,
  }
}
