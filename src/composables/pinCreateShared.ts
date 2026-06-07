/** Valeurs par défaut pour une publication rapide (champs avancés reportés). */
export const QUICK_PIN_DEFAULT_TOPIC = 'Général'

export type QuickPinPublishInput = {
  title: string
  authorId: number
  imageFile?: File | null
  storyVideoFile?: File | null
  mediaSensitiveBlur?: boolean
  topic?: string
}

export function resolveQuickPinTitle(
  title: string,
  t: (key: string, params?: Record<string, string>) => string,
  locale: string,
): string {
  const trimmed = title.trim()
  if (trimmed) return trimmed
  return t('create.quick.defaultTitle', { date: new Date().toLocaleDateString(locale) })
}

/** Construit un FormData minimal pour le mode rapide (média + titre optionnel). */
export function appendQuickPinFormData(formData: FormData, input: QuickPinPublishInput) {
  formData.append('title', input.title)
  formData.append('description', '')
  formData.append('link', '')
  formData.append('topic', input.topic?.trim() || QUICK_PIN_DEFAULT_TOPIC)
  formData.append('visibility', 'public')
  formData.append('is_story', 'false')
  formData.append('media_sensitive_blur', input.mediaSensitiveBlur ? 'true' : 'false')
  formData.append('author', String(input.authorId))
  if (input.imageFile) formData.append('image', input.imageFile)
  if (input.storyVideoFile) formData.append('story_video', input.storyVideoFile)
}
