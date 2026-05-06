import api from '../api'
import { offlineDb } from './db'
import type { OfflineAction, OfflineActionType } from './types'

const CLIENT_ID_KEY = 'pinova_client_id'

function getClientId(): string {
  const existing = window.localStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing
  const next = crypto.randomUUID()
  window.localStorage.setItem(CLIENT_ID_KEY, next)
  return next
}

export async function enqueueOfflineAction(
  type: OfflineActionType,
  payload: Record<string, unknown>,
): Promise<OfflineAction> {
  const action: OfflineAction = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    client_id: getClientId(),
    status: 'pending',
    attempts: 0,
  }
  await offlineDb.actions.put(action)
  return action
}

export async function flushOfflineActions(): Promise<void> {
  const pending: OfflineAction[] = await offlineDb.actions
    .where('status')
    .equals('pending')
    .sortBy('timestamp')
  if (!pending.length) return

  try {
    const { data } = await api.post('sync/', {
      actions: pending.map((a) => ({
        id: a.id,
        type: a.type,
        payload: a.payload,
        timestamp: a.timestamp,
        client_id: a.client_id,
      })),
    })
    const conflictIds = new Set<string>(
      Array.isArray(data?.conflicts)
        ? data.conflicts.map((c: { actionId?: string }) => c.actionId || '')
        : [],
    )

    await offlineDb.transaction('rw', offlineDb.actions, async () => {
      for (const action of pending as OfflineAction[]) {
        if (conflictIds.has(action.id)) {
          await offlineDb.actions.update(action.id, { status: 'failed', attempts: action.attempts + 1 })
        } else {
          await offlineDb.actions.update(action.id, { status: 'synced', attempts: action.attempts + 1 })
        }
      }
    })
  } catch (error) {
    await offlineDb.transaction('rw', offlineDb.actions, async () => {
      for (const action of pending) {
        await offlineDb.actions.update(action.id, {
          status: 'pending',
          attempts: action.attempts + 1,
          lastError: error instanceof Error ? error.message : 'sync_failed',
        })
      }
    })
    throw error
  }
}
