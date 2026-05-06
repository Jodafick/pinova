import Fuse from 'fuse.js'
import { offlineDb } from './db'
import type { CachedPost } from './types'

export async function searchOfflinePosts(query: string): Promise<CachedPost[]> {
  const q = query.trim()
  if (!q) return []
  const posts = await offlineDb.posts.toArray()
  const fuse = new Fuse(posts, {
    includeScore: true,
    threshold: 0.35,
    keys: ['title', 'content'],
  })
  return fuse.search(q).map((r: { item: CachedPost }) => r.item)
}
