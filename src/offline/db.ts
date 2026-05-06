import Dexie, { type Table } from 'dexie'
import type { CachedPost, OfflineAction } from './types'

class PinovaOfflineDB extends Dexie {
  posts!: Table<CachedPost, string>
  actions!: Table<OfflineAction, string>

  constructor() {
    super('pinova_offline_db')
    this.version(1).stores({
      posts: 'id, slug, updatedAt, synced, title',
      actions: 'id, status, timestamp, type, client_id',
    })
  }
}

export const offlineDb = new PinovaOfflineDB()
