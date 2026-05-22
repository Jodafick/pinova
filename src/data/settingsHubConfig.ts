/** Identifiants de section sur `/settings/:sectionId` (préfixe `settings-`). */
export type SettingsSectionId = string

const SETTINGS_DETAIL_ALIASES: Record<string, string> = {
  'settings-push': 'settings-notifications',
  'settings-access': 'settings-privacy',
  'settings-blocked': 'settings-privacy',
  'settings-social': 'settings-profile',
  'settings-personalization': 'settings-profile',
  'settings-presence': 'settings-profile',
  'settings-security': 'settings-password',
  'settings-ads': 'settings-tips',
  'settings-legal': 'settings-support',
}

/** Contenu affiché sur chaque page détail (plusieurs cartes possibles). */
export const SETTINGS_PAGE_SECTIONS: Record<string, string[]> = {
  'settings-profile': ['settings-profile', 'settings-social', 'settings-personalization', 'settings-presence'],
  'settings-social': ['settings-profile', 'settings-social', 'settings-personalization', 'settings-presence'],
  'settings-personalization': ['settings-profile', 'settings-social', 'settings-personalization', 'settings-presence'],
  'settings-presence': ['settings-profile', 'settings-social', 'settings-personalization', 'settings-presence'],
  'settings-password': ['settings-password', 'settings-security'],
  'settings-security': ['settings-password', 'settings-security'],
  'settings-notifications': ['settings-notifications'],
  'settings-push': ['settings-notifications'],
  'settings-appearance': ['settings-appearance'],
  'settings-privacy': ['settings-privacy', 'settings-access', 'settings-blocked'],
  'settings-access': ['settings-privacy', 'settings-access', 'settings-blocked'],
  'settings-blocked': ['settings-privacy', 'settings-access', 'settings-blocked'],
  'settings-tips': ['settings-tips', 'settings-ads'],
  'settings-ads': ['settings-tips', 'settings-ads'],
  'settings-seats': ['settings-seats'],
  'settings-support': ['settings-support', 'settings-legal'],
  'settings-legal': ['settings-support', 'settings-legal'],
  'settings-subscription': ['settings-subscription'],
  'settings-danger': ['settings-danger'],
  'settings-pwa-install': ['settings-pwa-install'],
  'settings-pwa-reload': ['settings-pwa-reload'],
}

export function resolveSettingsDetailPage(sectionId: string): string {
  return SETTINGS_DETAIL_ALIASES[sectionId] ?? sectionId
}

export function settingsPageShowsSection(pageId: string, sectionId: string): boolean {
  const canonical = resolveSettingsDetailPage(pageId)
  return (SETTINGS_PAGE_SECTIONS[canonical] ?? [canonical]).includes(sectionId)
}

/** Titres complets pour l’en-tête des pages détail. */
export const SETTINGS_SECTION_TITLE_KEY: Record<string, string> = {
  'settings-profile': 'settings.nav.profile',
  'settings-password': 'settings.nav.password',
  'settings-notifications': 'settings.hub.pageNotifications',
  'settings-push': 'settings.hub.pageNotifications',
  'settings-appearance': 'settings.appearance.title',
  'settings-privacy': 'settings.hub.pagePrivacy',
  'settings-access': 'settings.hub.pagePrivacy',
  'settings-blocked': 'settings.hub.pagePrivacy',
  'settings-tips': 'settings.hub.pageTips',
  'settings-ads': 'settings.hub.pageTips',
  'settings-seats': 'settings.nav.seats',
  'settings-support': 'settings.hub.pageSupport',
  'settings-legal': 'settings.hub.pageSupport',
  'settings-subscription': 'settings.hub.sectionOffers',
  'settings-danger': 'settings.nav.danger',
  'settings-pwa-install': 'settings.nav.pwaInstall',
  'settings-pwa-reload': 'pwa.reload.title',
}

export function settingsDetailTitleKey(sectionId: string): string {
  const page = resolveSettingsDetailPage(sectionId)
  return SETTINGS_SECTION_TITLE_KEY[page] ?? SETTINGS_SECTION_TITLE_KEY[sectionId] ?? 'settings.title'
}

export type SettingsHubItem = {
  id: string
  icon: string
  labelKey: string
  requiresUser?: boolean
  requiresStandalone?: boolean
}

export type SettingsHubGroup = {
  titleKey: string
  items: SettingsHubItem[]
}

export const SETTINGS_HUB_GROUPS: SettingsHubGroup[] = [
  {
    titleKey: 'settings.hub.groupAccount',
    items: [
      { id: 'settings-profile', icon: 'person', labelKey: 'settings.nav.profile' },
      { id: 'settings-password', icon: 'key', labelKey: 'settings.nav.password' },
    ],
  },
  {
    titleKey: 'settings.hub.groupPreferences',
    items: [
      { id: 'settings-notifications', icon: 'notifications', labelKey: 'settings.nav.notifications' },
      { id: 'settings-appearance', icon: 'dark_mode', labelKey: 'settings.nav.appearance' },
      { id: 'settings-privacy', icon: 'lock', labelKey: 'settings.nav.privacy' },
    ],
  },
  {
    titleKey: 'settings.hub.groupCreator',
    items: [
      { id: 'settings-tips', icon: 'payments', labelKey: 'settings.nav.tips' },
      { id: 'settings-seats', icon: 'group', labelKey: 'settings.nav.seats', requiresUser: true },
    ],
  },
  {
    titleKey: 'settings.hub.groupMore',
    items: [
      { id: 'settings-support', icon: 'help', labelKey: 'settings.nav.support' },
      { id: 'settings-subscription', icon: 'auto_awesome', labelKey: 'settings.hub.sectionOffers' },
      { id: 'settings-danger', icon: 'warning', labelKey: 'settings.nav.danger' },
      { id: 'settings-pwa-install', icon: 'install_mobile', labelKey: 'settings.nav.pwaInstall' },
      { id: 'settings-pwa-reload', icon: 'refresh', labelKey: 'pwa.reload.title', requiresStandalone: true },
    ],
  },
]

export const SETTINGS_SECTION_IDS = [
  ...new Set([
    ...SETTINGS_HUB_GROUPS.flatMap((g) => g.items.map((i) => i.id)),
    ...Object.keys(SETTINGS_PAGE_SECTIONS),
  ]),
]

export function isValidSettingsSectionId(id: string): boolean {
  return SETTINGS_SECTION_IDS.includes(id)
}
