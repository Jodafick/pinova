/**
 * Query Keys catalog — source de vérité unique pour les clés Vue Query.
 *
 *  Convention : toutes les clés sont préfixées par leur domaine, et utilisent
 *  des fonctions pour les paramétrer (typage strict). Cela évite les fautes
 *  de frappe et permet l'invalidation par préfixe :
 *
 *    queryClient.invalidateQueries({ queryKey: qk.feed.all })
 *    queryClient.invalidateQueries({ queryKey: qk.user.byId(42) })
 *
 *  Cohérent avec mobile (`Pinova-Mobile/data/query/keys.ts`).
 */

export const qk = {
  /* Feeds (home / explore / boards / following). */
  feed: {
    all: ['feed'] as const,
    home: (filters?: unknown) => ['feed', 'home', filters ?? null] as const,
    explore: (filters?: unknown) => ['feed', 'explore', filters ?? null] as const,
    exploreBoards: (filters?: unknown) => ['feed', 'exploreBoards', filters ?? null] as const,
    following: (filters?: unknown) => ['feed', 'following', filters ?? null] as const,
    topic: (topic: string) => ['feed', 'topic', topic] as const,
  },

  /* Pins. */
  pin: {
    all: ['pin'] as const,
    detail: (slugOrId: string | number) => ['pin', 'detail', String(slugOrId)] as const,
    comments: (pinId: string | number) => ['pin', 'comments', String(pinId)] as const,
    related: (pinId: string | number) => ['pin', 'related', String(pinId)] as const,
  },

  /* Users / profiles. */
  user: {
    all: ['user'] as const,
    me: () => ['user', 'me'] as const,
    byId: (id: string | number) => ['user', 'byId', String(id)] as const,
    byUsername: (username: string) => ['user', 'byUsername', username] as const,
    followers: (id: string | number) => ['user', 'followers', String(id)] as const,
    following: (id: string | number) => ['user', 'following', String(id)] as const,
  },

  /* Boards. */
  board: {
    all: ['board'] as const,
    byId: (id: string | number) => ['board', 'byId', String(id)] as const,
    byUser: (userId: string | number) => ['board', 'byUser', String(userId)] as const,
    pins: (boardId: string | number) => ['board', 'pins', String(boardId)] as const,
  },

  /* Notifications. */
  notifications: {
    all: ['notifications'] as const,
    list: (filter?: string) => ['notifications', 'list', filter ?? 'all'] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },

  /* Stories. */
  story: {
    all: ['story'] as const,
    feed: () => ['story', 'feed'] as const,
    likers: (storyId: string | number) => ['story', 'likers', String(storyId)] as const,
  },

  /* Search. */
  search: {
    all: ['search'] as const,
    pins: (q: string) => ['search', 'pins', q] as const,
    users: (q: string) => ['search', 'users', q] as const,
    boards: (q: string) => ['search', 'boards', q] as const,
    autocomplete: (q: string) => ['search', 'autocomplete', q] as const,
  },

  /* Contest / referral / wallet / billing — placeholders pour migrations futures. */
  contest: {
    all: ['contest'] as const,
    list: () => ['contest', 'list'] as const,
    detail: (id: string | number) => ['contest', 'detail', String(id)] as const,
  },
  referral: {
    all: ['referral'] as const,
    summary: () => ['referral', 'summary'] as const,
  },
  wallet: {
    all: ['wallet'] as const,
    balance: () => ['wallet', 'balance'] as const,
    transactions: (cursor?: string) => ['wallet', 'transactions', cursor ?? null] as const,
  },
  billing: {
    all: ['billing'] as const,
    receipts: () => ['billing', 'receipts'] as const,
    receipt: (id: string | number) => ['billing', 'receipt', String(id)] as const,
  },

  /* Topics & taxonomy publique. */
  topics: {
    all: ['topics'] as const,
    list: () => ['topics', 'list'] as const,
    trending: () => ['topics', 'trending'] as const,
  },
} as const

/** Helper : raccourci d'invalidation par domaine. */
export function invalidationKey<K extends keyof typeof qk>(domain: K): readonly string[] {
  return qk[domain].all as readonly string[]
}
