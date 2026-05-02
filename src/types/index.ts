export type Pin = {
  id: number
  slug: string
  title: string
  description: string
  imageUrl: string
  user: string
  username: string
  userId: number
  userAvatarUrl?: string
  userAvatarColor: string
  authorTipsEnabled?: boolean
  authorTipsUrl?: string
  link: string
  stats: {
    saves: number
    reactions: number
  }
  topic: string
  visibility?: 'public' | 'followers' | 'private'
  hashtags?: string[]
  privateTags?: string[]
  boards?: {
    id: number
    name: string
    isPrivate?: boolean
    position?: number
  }[]
  tall?: boolean
  saved?: boolean
  liked?: boolean
  isFollowing?: boolean
  /** Nombre d'abonnés de l'auteur (profil public). */
  authorFollowersCount?: number
  /** ISO — réservé à l'auteur par l'API */
  scheduledPublishAt?: string | null
  /** Story 24h (badge filtre actif / archivé pour l'auteur) */
  isStory?: boolean
  storyExpiresAt?: string
  createdAt: string
}

export type User = {
  id: number
  username: string
  displayName: string
  email: string
  preferredLanguage?: string
  preferredCurrency?: string
  countryCode?: string
  privateProfile?: boolean
  discoverableProfile?: boolean
  notificationsFollowers?: boolean
  notificationsSaves?: boolean
  notificationsRecommendations?: boolean
  avatarUrl?: string
  avatarColor: string
  bio: string
  followers: number
  following: number
  isFollowing?: boolean
  savedPins: number[]
  subscription?: {
    plan: 'free' | 'plus' | 'pro'
    renewalAt?: string | null
    translationQuotaMonthly: number
    translationUsedMonthly: number
    adAdsEnabled?: boolean
    partnerAdsEnabled?: boolean
    tipsEnabled?: boolean
    tipsUrl?: string
    cancelAtPeriodEnd?: boolean
    scheduledPlan?: 'free' | 'plus' | 'pro' | null
  }
  boards?: {
    id: number
    name: string
    pinCount: number
    isPrivate: boolean
    collaboratorCount?: number
    previewImages?: string[]
  }[]
}

export type Notification = {
  id: number
  type: 'like' | 'save' | 'follow' | 'comment'
  message: string
  fromUser: string
  avatarColor: string
  read: boolean
  createdAt: string
}
