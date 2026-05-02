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
  }[]
  certifiedCredit?: boolean
  provenanceRootHash?: string
  tall?: boolean
  saved?: boolean
  liked?: boolean
  isFollowing?: boolean
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
  }
  boards?: {
    id: number
    name: string
    pinCount: number
    isPrivate: boolean
    collaboratorCount?: number
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
