export type Foto = {
  id: number
  slug: string
  title: string
  description: string
  imageUrl: string
  /** Variante légère pour la grille (carré / feed). */
  feedImageUrl?: string
  /** Largeur native du média (API) — améliore le masonry. */
  mediaWidth?: number
  /** Hauteur native du média (API). */
  mediaHeight?: number
  /** width / height (dérivé). */
  mediaAspectRatio?: number
  /** Vidéo story (MP4/WebM/MOV) */
  storyVideoUrl?: string
  user: string
  username: string
  userId: number
  userAvatarUrl?: string
  userAvatarColor: string
  authorTipsInternalEnabled?: boolean
  link: string
  stats: {
    saves: number
    reactions: number
    shares?: number
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
  /** Plus/Pro : story publiée via standalone ; supprimée en base après 24 h (pas d'archive foto). */
  storyEphemeral?: boolean
  storyExpiresAt?: string
  createdAt: string
  /** Foto publié avec politique « contenu sensible » (flou par défaut pour les adultes). */
  mediaSensitiveBlur?: boolean
  /** Le visiteur connecté a déjà signalé ce foto (API `viewer_has_reported`). */
  viewerHasReported?: boolean
  isBoosted?: boolean
}

export type PartnerAd = {
  feedType: 'partner_ad'
  id: string
  campaignId: number
  title: string
  body: string
  sponsorName: string
  imageUrl: string
  ctaLabel: string
  ctaUrl: string
}

export type FotoPromo = {
  feedType: 'foto_promo'
  id: string
  campaignId: number
  fotoSlug?: string
  fotoId?: number
  title: string
  body: string
  sponsorName: string
  username: string
  imageUrl: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  ctaLabel: string
  ctaUrl?: string
  topic?: string
}

export type SponsoredAd = PartnerAd | FotoPromo

export type FeedItem = Foto | SponsoredAd

export function isPartnerAd(item: FeedItem): item is PartnerAd {
  return (item as PartnerAd).feedType === 'partner_ad'
}

export function isFotoPromo(item: FeedItem): item is FotoPromo {
  return (item as FotoPromo).feedType === 'foto_promo'
}

export function isSponsoredAd(item: FeedItem): item is SponsoredAd {
  return isPartnerAd(item) || isFotoPromo(item)
}

export function isFeedFoto(item: FeedItem): item is Foto {
  return !isSponsoredAd(item)
}

/** Première page renvoyée par `GET me/` (`me_created_fotos_page` / `me_saved_fotos_page`). */
export type MeHydrationFotosPage = {
  count: number
  next: string | null
  previous: string | null
  results: Foto[]
}

export type FotoLikerEntry = {
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  liked_at: string
}

export type FotoLikersResponse = {
  count: number
  likers: FotoLikerEntry[]
}

import type { ActivationFunnelState } from '@fotoce/shared'
import type { UserProfileExtended } from './profileExtended'

export type User = UserProfileExtended & {
  activationFunnel?: ActivationFunnelState
  id: number
  isStaff?: boolean
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
  notificationsStreakReminders?: boolean
  notificationsReactivationEmails?: boolean
  dateJoined?: string
  avatarUrl?: string
  avatarColor: string
  bio: string
  followers: number
  following: number
  isFollowing?: boolean
  savedFotos: number[]
  /** Jeton profil privé (?share=) — réservé au propriétaire */
  profileShareToken?: string | null
  subscription?: {
    plan: 'free' | 'plus' | 'pro'
    renewalAt?: string | null
    translationQuotaMonthly: number
    translationUsedMonthly: number
    tipsEnabled?: boolean
    cancelAtPeriodEnd?: boolean
    scheduledPlan?: 'free' | 'plus' | 'pro' | '' | null
    trialEligible?: boolean
    trialConsumedAt?: string | null
    digestCreatorWeekly?: boolean
    adAdsEnabled?: boolean
    partnerAdsEnabled?: boolean
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
    /** Au moins une entrée d’historique de paiement (API `has_billing_history`) */
    hasBillingHistory?: boolean
    /** Plus/Pro — flouter les médias marqués sensibles par défaut (client) */
    sensitiveMediaBlurByDefault?: boolean
    /** Majeur vérifié — masquer totalement les fotos sensibles d'autrui */
    hideSensitivePins?: boolean
  }
  boards?: {
    id: number
    name: string
    fotoCount: number
    isPrivate: boolean
    /** Propriétaire du tableau (pour ouvrir la bonne URL quand tableau partagé). */
    ownerUsername?: string
    /** true si vous êtes le créateur (compte aux limites de plan ; false pour boards partagées). */
    isOwner?: boolean
    collaboratorCount?: number
    previewImages?: string[]
    shareToken?: string | null
  }[]
  /** Hydratation `GET me/` — suite via `fotos/?author=…&page=2` comme aujourd’hui. */
  meCreatedPinsPage?: MeHydrationPinsPage
  /** Hydratation `GET me/` — suite via `fotos/?saved_by_me=1&page=2`. */
  meSavedPinsPage?: MeHydrationPinsPage
  /** ISO YYYY-MM-DD — réservé au propriétaire ; obligatoire pour publier du média */
  birthDate?: string | null
  /** Nombre de fotos créés visibles pour le visiteur (API `fotos_count`). */
  pinsCount?: number
  /** Comptes que j’ai bloqués (API `blocked_usernames`). */
  blockedUsernames?: string[]
  /** Profil consulté : le visiteur connecté a déjà signalé ce compte (API `viewer_has_reported_profile`). */
  viewerHasReportedProfile?: boolean
  /** `GET me/` — compte avec mot de passe Django utilisable (false si connexion sociale sans mot de passe). */
  hasUsablePassword?: boolean
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
