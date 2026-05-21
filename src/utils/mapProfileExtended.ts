import type { UserProfileExtended, SocialLinks } from '../types/profileExtended'

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

function parseSocialLinks(raw: unknown): SocialLinks {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: SocialLinks = {}
  for (const [k, v] of Object.entries(o)) {
    const u = String(v ?? '').trim()
    if (u) (out as Record<string, string>)[k] = u
  }
  return out
}

/** Mappe le bloc `profile` Django vers les champs étendus front. */
export function mapProfileExtendedFromApi(profile: Record<string, unknown>): UserProfileExtended {
  return {
    firstName: profile.first_name != null ? String(profile.first_name) : '',
    lastName: profile.last_name != null ? String(profile.last_name) : '',
    gender: profile.gender != null ? String(profile.gender) : '',
    pronouns: profile.pronouns != null ? String(profile.pronouns) : '',
    city: profile.city != null ? String(profile.city) : '',
    website: profile.website != null ? String(profile.website) : '',
    jobTitle: profile.job_title != null ? String(profile.job_title) : '',
    school: profile.school != null ? String(profile.school) : '',
    company: profile.company != null ? String(profile.company) : '',
    phone: profile.phone != null ? String(profile.phone) : '',
    interests: parseStringList(profile.interests),
    followedOnboardingCreators: parseStringList(profile.followed_onboarding_creators),
    themeMode: (profile.theme_mode as UserProfileExtended['themeMode']) || 'system',
    accentColor: profile.accent_color != null ? String(profile.accent_color) : 'rose',
    dateFormat: profile.date_format != null ? String(profile.date_format) : 'auto',
    timezone: profile.timezone != null ? String(profile.timezone) : '',
    presenceStatus: (profile.presence_status as UserProfileExtended['presenceStatus']) || 'available',
    showActivity: profile.show_activity === undefined ? true : !!profile.show_activity,
    showLastSeen: profile.show_last_seen === undefined ? true : !!profile.show_last_seen,
    allowDm: profile.allow_dm === undefined ? true : !!profile.allow_dm,
    allowTagsMentions:
      profile.allow_tags_mentions === undefined ? true : !!profile.allow_tags_mentions,
    favoriteQuote: profile.favorite_quote != null ? String(profile.favorite_quote) : '',
    hobbies: parseStringList(profile.hobbies),
    skills: parseStringList(profile.skills),
    socialLinks: parseSocialLinks(profile.social_links),
    allowAiTranslation:
      profile.allow_ai_translation === undefined ? true : !!profile.allow_ai_translation,
    onboardingCompletedAt:
      profile.onboarding_completed_at == null ? null : String(profile.onboarding_completed_at),
  }
}

export function profileExtendedToApiPayload(
  ext: Partial<UserProfileExtended>,
): Record<string, string | boolean | string[]> {
  const p: Record<string, string | boolean | string[]> = {}
  if (ext.firstName !== undefined) p.first_name = ext.firstName
  if (ext.lastName !== undefined) p.last_name = ext.lastName
  if (ext.gender !== undefined) p.gender = ext.gender
  if (ext.pronouns !== undefined) p.pronouns = ext.pronouns
  if (ext.city !== undefined) p.city = ext.city
  if (ext.website !== undefined) p.website = ext.website
  if (ext.jobTitle !== undefined) p.job_title = ext.jobTitle
  if (ext.school !== undefined) p.school = ext.school
  if (ext.company !== undefined) p.company = ext.company
  if (ext.phone !== undefined) p.phone = ext.phone
  if (ext.interests !== undefined) p.interests = ext.interests
  if (ext.followedOnboardingCreators !== undefined) {
    p.followed_onboarding_creators = ext.followedOnboardingCreators
  }
  if (ext.themeMode !== undefined) p.theme_mode = ext.themeMode
  if (ext.accentColor !== undefined) p.accent_color = ext.accentColor
  if (ext.dateFormat !== undefined) p.date_format = ext.dateFormat
  if (ext.timezone !== undefined) p.timezone = ext.timezone
  if (ext.presenceStatus !== undefined) p.presence_status = ext.presenceStatus
  if (ext.showActivity !== undefined) p.show_activity = ext.showActivity
  if (ext.showLastSeen !== undefined) p.show_last_seen = ext.showLastSeen
  if (ext.allowDm !== undefined) p.allow_dm = ext.allowDm
  if (ext.allowTagsMentions !== undefined) p.allow_tags_mentions = ext.allowTagsMentions
  if (ext.favoriteQuote !== undefined) p.favorite_quote = ext.favoriteQuote
  if (ext.hobbies !== undefined) p.hobbies = ext.hobbies
  if (ext.skills !== undefined) p.skills = ext.skills
  if (ext.socialLinks !== undefined) p.social_links = ext.socialLinks as unknown as string[]
  if (ext.allowAiTranslation !== undefined) p.allow_ai_translation = ext.allowAiTranslation
  return p
}
