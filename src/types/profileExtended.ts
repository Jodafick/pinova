/** Champs profil étendus (identité, social, personnalisation, présence). */

export type ThemeMode = 'light' | 'dark' | 'system'
export type PresenceStatus = 'available' | 'busy' | 'invisible'
export type SocialLinks = Partial<
  Record<'instagram' | 'tiktok' | 'github' | 'linkedin' | 'youtube' | 'portfolio' | 'twitter' | 'facebook', string>
>

export type UserProfileExtended = {
  firstName?: string
  lastName?: string
  coverImageUrl?: string
  gender?: string
  pronouns?: string
  city?: string
  website?: string
  jobTitle?: string
  school?: string
  company?: string
  phone?: string
  interests?: string[]
  followedOnboardingCreators?: string[]
  themeMode?: ThemeMode
  accentColor?: string
  dateFormat?: string
  timezone?: string
  presenceStatus?: PresenceStatus
  showActivity?: boolean
  showLastSeen?: boolean
  allowDm?: boolean
  allowTagsMentions?: boolean
  favoriteQuote?: string
  hobbies?: string[]
  skills?: string[]
  socialLinks?: SocialLinks
  allowAiTranslation?: boolean
  onboardingCompletedAt?: string | null
}
