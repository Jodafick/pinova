export type Pin = {
  id: number
  slug: string
  title: string
  description: string
  imageUrl: string
  /** Vidéo story (MP4/WebM/MOV) */
  storyVideoUrl?: string
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
  /** Libellé topic traduit (API topic_meta.name) pour l’affichage ; `topic` reste le nom canonique. */
  topicDisplay?: string
  visibility?: 'public' | 'followers' | 'private'
  /** Politique commentaires (créateur) */
  commentsPolicy?: 'open' | 'followers_only' | 'closed'
  /** Indique si l’utilisateur connecté peut poster un commentaire */
  canComment?: boolean
  hashtags?: string[]
  privateTags?: string[]
  boards?: {
    id: number
    name: string
    isPrivate?: boolean
    position?: number
    /** Propriétaire du tableau (URL `/profile/:user/board/:id`). */
    ownerUsername?: string
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
  /** Plus/Pro : story publiée via standalone ; supprimée en base après 24 h (pas d'archive pin). */
  storyEphemeral?: boolean
  storyExpiresAt?: string
  createdAt: string
  /** Pin publié avec politique « contenu sensible » (flou par défaut pour les adultes). */
  mediaSensitiveBlur?: boolean
}

export type PinLikerEntry = {
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  liked_at: string
}

export type PinLikersResponse = {
  count: number
  likers: PinLikerEntry[]
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
  /** Jeton profil privé (?share=) — réservé au propriétaire */
  profileShareToken?: string | null
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
    scheduledPlan?: 'free' | 'plus' | 'pro' | '' | null
    trialEligible?: boolean
    trialConsumedAt?: string | null
    digestCreatorWeekly?: boolean
    /** ISO — réservé au propriétaire ; suppression de compte programmée */
    accountScheduledDeletionAt?: string | null
    /** solo | family | team — utilisateur propriétaire de la facture */
    seatBundle?: string
    isSeatMember?: boolean
    sponsorUsername?: string | null
    /** Plafond d’invités (famille ou équipe) — propriétaire hub uniquement */
    seatMaxInvitees?: number
    /** Dernier cycle facturé (paiement approuvé) — pour activer le changement mensuel/annuel */
    activeBillingCycle?: 'monthly' | 'yearly' | null
    /** Plus/Pro — flouter les médias marqués sensibles par défaut (client) */
    sensitiveMediaBlurByDefault?: boolean
    /** Majeur vérifié — masquer totalement les pins sensibles d'autrui */
    hideSensitivePins?: boolean
  }
  boards?: {
    id: number
    name: string
    pinCount: number
    isPrivate: boolean
    /** Propriétaire du tableau (pour ouvrir la bonne URL quand tableau partagé). */
    ownerUsername?: string
    /** true si vous êtes le créateur (compte aux limites de plan ; false pour boards partagées). */
    isOwner?: boolean
    collaboratorCount?: number
    previewImages?: string[]
    shareToken?: string | null
  }[]
  /** ISO YYYY-MM-DD — réservé au propriétaire ; obligatoire pour publier du média */
  birthDate?: string | null
  /** Nombre de pins créés visibles pour le visiteur (API `pins_count`). */
  pinsCount?: number
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
