/**
 * Mapping Material Symbols (legacy) → Font Awesome 6.
 * Les données (settings, topics) gardent les clés Material ; l'UI rend en FA.
 */

export type FaIconMeta = {
  family: 'fa-solid' | 'fa-regular'
  icon: string
  spin?: boolean
}

/** Icônes « contour » en fa-regular quand non filled. */
const REGULAR_WHEN_OUTLINE = new Set([
  'bookmark_border',
  'favorite_border',
  'favorite',
])

const MATERIAL_TO_FA: Record<string, string> = {
  accessibility_new: 'fa-universal-access',
  add: 'fa-plus',
  add_circle: 'fa-circle-plus',
  add_photo_alternate: 'fa-image',
  alternate_email: 'fa-at',
  animation: 'fa-film',
  apps: 'fa-grip',
  arrow_back: 'fa-arrow-left',
  arrow_back_ios_new: 'fa-chevron-left',
  arrow_forward: 'fa-arrow-right',
  auto_awesome: 'fa-wand-magic-sparkles',
  auto_stories: 'fa-circle-play',
  block: 'fa-ban',
  bolt: 'fa-bolt',
  bookmark: 'fa-bookmark',
  bookmark_add: 'fa-bookmark',
  bookmark_border: 'fa-bookmark',
  broken_image: 'fa-image',
  campaign: 'fa-bullhorn',
  card_giftcard: 'fa-gift',
  category: 'fa-tags',
  celebration: 'fa-champagne-glasses',
  chat_bubble: 'fa-comment',
  check: 'fa-check',
  check_circle: 'fa-circle-check',
  chevron_backward: 'fa-chevron-left',
  chevron_down: 'fa-chevron-down',
  chevron_left: 'fa-chevron-left',
  chevron_right: 'fa-chevron-right',
  add_box: 'fa-square-plus',
  touch_app: 'fa-hand-pointer',
  close: 'fa-xmark',
  cloud_off: 'fa-cloud',
  cloud_upload: 'fa-cloud-arrow-up',
  collections: 'fa-images',
  content_copy: 'fa-copy',
  contract: 'fa-compress',
  crop_16_9: 'fa-crop',
  crop_9_16: 'fa-crop',
  crop_free: 'fa-crop',
  crop_portrait: 'fa-crop',
  crop_square: 'fa-crop',
  dark_mode: 'fa-moon',
  dashboard: 'fa-table-columns',
  delete: 'fa-trash',
  description: 'fa-file-lines',
  done_all: 'fa-check-double',
  download: 'fa-download',
  drag_indicator: 'fa-grip-lines',
  edit: 'fa-pen',
  emoji_events: 'fa-trophy',
  error: 'fa-circle-exclamation',
  error_outline: 'fa-circle-exclamation',
  expand_more: 'fa-chevron-down',
  explore: 'fa-compass',
  explore_off: 'fa-compass',
  favorite: 'fa-heart',
  favorite_border: 'fa-heart',
  flag: 'fa-flag',
  flash_on: 'fa-bolt',
  flip: 'fa-right-left',
  fullscreen: 'fa-expand',
  fullscreen_exit: 'fa-compress',
  grid_view: 'fa-table-cells',
  gpp_bad: 'fa-shield-halved',
  group: 'fa-users',
  group_add: 'fa-user-plus',
  groups: 'fa-users',
  help: 'fa-circle-question',
  home: 'fa-house',
  image: 'fa-image',
  imagesmode: 'fa-images',
  inbox: 'fa-inbox',
  info: 'fa-circle-info',
  insights: 'fa-chart-line',
  install_mobile: 'fa-mobile-screen-button',
  interests: 'fa-heart',
  ios_share: 'fa-arrow-up-from-bracket',
  key: 'fa-key',
  language: 'fa-language',
  light_mode: 'fa-sun',
  link: 'fa-link',
  lock: 'fa-lock',
  lock_reset: 'fa-key',
  login: 'fa-right-to-bracket',
  logout: 'fa-right-from-bracket',
  mail: 'fa-envelope',
  mark_email_read: 'fa-envelope-circle-check',
  menu: 'fa-bars',
  military_tech: 'fa-medal',
  mood: 'fa-face-smile',
  more_horiz: 'fa-ellipsis',
  more_vert: 'fa-ellipsis-vertical',
  north: 'fa-arrow-up',
  notifications: 'fa-bell',
  notifications_active: 'fa-bell',
  notifications_off: 'fa-bell-slash',
  offline_bolt: 'fa-bolt',
  online_prediction: 'fa-signal',
  open_in_new: 'fa-arrow-up-right-from-square',
  outgoing_mail: 'fa-paper-plane',
  palette: 'fa-palette',
  pause: 'fa-pause',
  payments: 'fa-credit-card',
  person: 'fa-user',
  person_add: 'fa-user-plus',
  person_off: 'fa-user-slash',
  person_search: 'fa-user-magnifying-glass',
  photo_camera: 'fa-camera',
  play_arrow: 'fa-play',
  privacy_tip: 'fa-shield-halved',
  progress_activity: 'fa-spinner',
  public: 'fa-earth-americas',
  quiz: 'fa-circle-question',
  receipt_long: 'fa-receipt',
  refresh: 'fa-arrows-rotate',
  replay: 'fa-rotate-right',
  reply: 'fa-reply',
  rocket_launch: 'fa-rocket',
  rotate_left: 'fa-rotate-left',
  rotate_right: 'fa-rotate-right',
  schedule: 'fa-clock',
  search: 'fa-magnifying-glass',
  search_off: 'fa-magnifying-glass',
  sell: 'fa-tag',
  send: 'fa-paper-plane',
  settings: 'fa-gear',
  share: 'fa-share-nodes',
  shield: 'fa-shield-halved',
  shield_lock: 'fa-shield',
  show_chart: 'fa-chart-line',
  south: 'fa-arrow-down',
  support_agent: 'fa-headset',
  swap_vert: 'fa-arrows-up-down',
  tag: 'fa-tag',
  target: 'fa-bullseye',
  timer: 'fa-hourglass-half',
  translate: 'fa-language',
  travel_explore: 'fa-compass',
  trending_up: 'fa-arrow-trend-up',
  tune: 'fa-sliders',
  upload: 'fa-upload',
  verified: 'fa-circle-check',
  verified_user: 'fa-user-check',
  videocam: 'fa-video',
  visibility: 'fa-eye',
  visibility_off: 'fa-eye-slash',
  volume_off: 'fa-volume-xmark',
  volume_up: 'fa-volume-high',
  warning: 'fa-triangle-exclamation',
  workspace_premium: 'fa-crown',
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_')
}

export function resolveFaIcon(
  name: string | null | undefined,
  options: { filled?: boolean; spin?: boolean } = {},
): FaIconMeta {
  const key = normalizeKey(name || '')
  if (!key) {
    return { family: 'fa-solid', icon: 'fa-circle-question' }
  }

  const spin = options.spin || key === 'progress_activity'
  const faIcon = MATERIAL_TO_FA[key] ?? `fa-${key.replace(/_/g, '-')}`

  const wantsOutline =
    !options.filled &&
    (REGULAR_WHEN_OUTLINE.has(key) ||
      key.endsWith('_border') ||
      key === 'favorite_border' ||
      key === 'bookmark_border')

  const family: FaIconMeta['family'] =
    wantsOutline && (faIcon === 'fa-heart' || faIcon === 'fa-bookmark')
      ? 'fa-regular'
      : 'fa-solid'

  return { family, icon: faIcon, spin }
}
