<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import type { Pin, User } from '../types'
import { useI18n } from '../i18n'
import { displayInitials } from '../utils/displayInitials'
import AvatarDisc from './AvatarDisc.vue'
import PinSensitiveMedia from './PinSensitiveMedia.vue'
import CommentThread from './CommentThread.vue'
import RichCommentInput from './RichCommentInput.vue'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'

type CommentSubmitPayload = {
  text: string
  gif?: string | null
  mediaFile?: File | null
  replyTo?: string | null
  parentId?: number
}

const props = defineProps({
  pin: { type: Object as PropType<Pin>, required: true },
  currentUser: { type: Object as PropType<User | null>, default: null },
  isAuthenticated: { type: Boolean, required: true },
  isPinOwner: { type: Boolean, required: true },
  viewerCanComment: { type: Boolean, required: true },
  viewerCanRevealSensitive: { type: Boolean, required: true },
  blurSensitiveByDefault: { type: Boolean, required: true },
  descriptionText: { type: String, default: '' },
  comments: { type: Array as PropType<any[]>, default: () => [] },
  commentsTotalCount: { type: Number, default: 0 },
  commentsHasNext: { type: Boolean, default: false },
  commentsLoadingMore: { type: Boolean, default: false },
  highlightedCommentId: { type: Number as PropType<number | null>, default: null },
  detailVideoPreload: { type: String as PropType<'none' | 'metadata' | 'auto'>, default: 'metadata' },
  detailImageFetchPriority: { type: String as PropType<'high' | 'low' | 'auto'>, default: 'high' },
  formatCount: { type: Function as PropType<(value: number) => string>, required: true },
  likingPin: { type: Boolean, default: false },
  savingPin: { type: Boolean, default: false },
  downloadingPin: { type: Boolean, default: false },
  followingAuthor: { type: Boolean, default: false },
  translatingDescription: { type: Boolean, default: false },
  submittingComment: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'media-orientation', landscape: boolean): void
  (e: 'like'): void
  (e: 'double-like'): void
  (e: 'save'): void
  (e: 'share'): void
  (e: 'download'): void
  (e: 'report'): void
  (e: 'follow'): void
  (e: 'translate-description'): void
  (e: 'open-likers'): void
  (e: 'comment-add', payload: CommentSubmitPayload): void
  (e: 'comment-like', id: number): void
  (e: 'comment-translate', id: number): void
  (e: 'load-more-comments'): void
  (e: 'load-more-replies', id: number): void
  (e: 'moderate-comment', id: number, hidden: boolean): void
  (e: 'report-comment', id: number): void
  (e: 'delete-comment', id: number): void
}>()

const { t } = useI18n()

const pinVisibility = computed(() => props.pin.visibility || 'public')
const isOwnStory = computed(() => props.pin.isStory && props.isPinOwner)
const canFollowAuthor = computed(() => props.currentUser && props.currentUser.id !== props.pin.userId)

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  emit('media-orientation', img.naturalWidth >= img.naturalHeight)
}

function onVideoMetadata(e: Event) {
  const video = e.target as HTMLVideoElement
  if (!video.videoWidth || !video.videoHeight) return
  emit('media-orientation', video.videoWidth >= video.videoHeight)
}
</script>

<template>
  <Teleport to="body">
    <section class="pin-desktop-modal hidden lg:flex fixed inset-0 z-[95] items-center justify-center px-8 py-7">
      <button
        type="button"
        class="absolute inset-0 bg-white/35 dark:bg-neutral-950/40 backdrop-blur-2xl saturate-150"
        :aria-label="t('common.close')"
        @click="emit('close')"
      />

      <article
        class="pin-desktop-modal-card relative z-[1] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white/80 dark:bg-neutral-950/70 text-neutral-950 dark:text-neutral-50 shadow-[0_32px_100px_rgba(0,0,0,0.45)] ring-1 ring-white/30 dark:ring-white/10 backdrop-blur-2xl backdrop-saturate-150"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="pin.title ? 'pin-detail-title' : undefined"
      >
        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xl ring-1 ring-white/15 transition hover:bg-black/60"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <span class="pin-desktop-filled material-symbols-outlined text-2xl">close</span>
        </button>

        <div class="pin-detail-mobile-card flex max-h-[86vh] flex-row">
          <div class="pin-detail-media-pane flex min-h-0 flex-1 basis-0 items-center justify-center overflow-hidden bg-neutral-100/40 dark:bg-neutral-900/40">
            <div class="relative flex h-full w-full items-center justify-center">
              <PinSensitiveMedia
                v-if="pin.imageUrl"
                :sensitive="!!pin.mediaSensitiveBlur"
                :viewer-can-reveal="viewerCanRevealSensitive"
                :blur-by-default="blurSensitiveByDefault"
                :media-url="pin.imageUrl"
                media-type="image"
                wrapper-class="w-full h-full flex justify-center items-center"
              >
                <img
                  :src="pin.imageUrl"
                  :alt="pin.title ? `${pin.title} - ${pin.user}` : t('feed.pinImageFallback', { user: pin.user })"
                  :fetchpriority="detailImageFetchPriority"
                  loading="eager"
                  decoding="async"
                  :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'pin-detail-media max-h-[86vh] w-full object-contain select-none']"
                  @load="onImageLoad"
                  @dblclick.prevent="emit('double-like')"
                  v-bind="pinMediaAntiLeakImgBindings()"
                >
              </PinSensitiveMedia>
              <PinSensitiveMedia
                v-else-if="pin.storyVideoUrl"
                :sensitive="!!pin.mediaSensitiveBlur"
                :viewer-can-reveal="viewerCanRevealSensitive"
                :blur-by-default="blurSensitiveByDefault"
                :media-url="pin.storyVideoUrl"
                media-type="video"
                wrapper-class="w-full h-full flex justify-center items-center"
              >
                <video
                  :src="pin.storyVideoUrl"
                  controls
                  playsinline
                  :preload="detailVideoPreload"
                  :class="[PIN_MEDIA_ANTI_LEAK_CLASS, 'pin-detail-media max-h-[86vh] w-full object-contain select-none']"
                  @loadedmetadata="onVideoMetadata"
                  @dblclick.prevent="emit('double-like')"
                  v-bind="pinMediaAntiLeakVideoBindings(true)"
                />
              </PinSensitiveMedia>
            </div>
          </div>

          <div class="pin-detail-info-pane flex max-h-[86vh] w-[440px] min-w-[380px] flex-col overflow-y-auto p-8">
            <div class="pin-detail-actions mb-6 flex items-center justify-between gap-4">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="!isOwnStory"
                  type="button"
                  class="lux-icon-ring-btn"
                  :class="pin.liked ? 'bg-gradient-to-br from-pink-50 to-rose-50/80 text-pink-700 border-pink-100' : ''"
                  :disabled="likingPin"
                  :aria-pressed="pin.liked"
                  :aria-label="pin.liked ? t('pin.a11y.unlike') : t('pin.a11y.like')"
                  @click="emit('like')"
                >
                  <span v-if="likingPin" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  <span v-else class="pin-desktop-filled material-symbols-outlined" :class="pin.liked ? 'text-pink-700' : 'text-neutral-700 dark:text-neutral-200'" aria-hidden="true">favorite</span>
                </button>
                <button
                  v-else
                  type="button"
                  class="lux-icon-ring-btn bg-gradient-to-br from-pink-50 to-rose-50/80 text-pink-700 border-pink-100"
                  :aria-label="t('story.likers.openListAria', { count: pin.stats.reactions })"
                  @click="emit('open-likers')"
                >
                  <span class="pin-desktop-filled material-symbols-outlined text-pink-700" aria-hidden="true">favorite</span>
                </button>
                <button type="button" class="lux-icon-ring-btn" :aria-label="t('pin.a11y.share')" @click="emit('share')">
                  <span class="pin-desktop-filled material-symbols-outlined" aria-hidden="true">share</span>
                </button>
                <button
                  type="button"
                  class="lux-icon-ring-btn disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="downloadingPin || !pin.imageUrl"
                  :aria-label="t('pin.a11y.download')"
                  @click="emit('download')"
                >
                  <span v-if="downloadingPin" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  <span v-else class="pin-desktop-filled material-symbols-outlined" aria-hidden="true">download</span>
                </button>
                <button
                  v-if="isAuthenticated && !isPinOwner && !pin.viewerHasReported"
                  type="button"
                  class="lux-icon-ring-btn"
                  :aria-label="t('moderation.report')"
                  @click="emit('report')"
                >
                  <span class="pin-desktop-filled material-symbols-outlined text-[22px]" aria-hidden="true">flag</span>
                </button>
              </div>
              <button
                type="button"
                class="pin-detail-save transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                :class="pin.saved ? 'lux-btn-detail-saved' : 'lux-btn-primary lux-btn-pill'"
                :disabled="savingPin"
                :aria-pressed="pin.saved"
                :aria-label="pin.saved ? t('pin.a11y.saved') : t('pin.a11y.save')"
                @click="emit('save')"
              >
                <span v-if="savingPin" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span v-else class="pin-desktop-filled material-symbols-outlined" aria-hidden="true">bookmark</span>
                <span v-if="!savingPin">{{ pin.saved ? t('pin.saved') : t('pin.save') }}</span>
              </button>
            </div>

            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              rel="noopener noreferrer"
              class="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-800 underline underline-offset-2 hover:text-neutral-950 dark:text-neutral-200 dark:hover:text-white"
            >
              <span class="material-symbols-outlined text-base">open_in_new</span>
              {{ pin.link }}
            </a>

            <div class="mb-3 flex flex-wrap items-start gap-2">
              <h1 id="pin-detail-title" class="min-w-[12rem] flex-1 text-2xl font-auth-title font-auth-title--black text-neutral-950 dark:text-neutral-100">{{ pin.title }}</h1>
              <span
                v-if="pinVisibility !== 'public'"
                class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                :class="pinVisibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
              >
                <span class="material-symbols-outlined text-xs">{{ pinVisibility === 'private' ? 'lock' : 'group' }}</span>
                {{ pinVisibility === 'private' ? t('pin.visibility.private') : t('pin.visibility.followers') }}
              </span>
            </div>

            <div class="mb-6 space-y-2">
              <p v-if="descriptionText || pin.description" class="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                {{ descriptionText || pin.description }}
              </p>
              <button
                v-if="isAuthenticated && (descriptionText || pin.description)"
                type="button"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-700 hover:text-pink-800"
                :disabled="translatingDescription"
                @click="emit('translate-description')"
              >
                <span v-if="translatingDescription" class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>{{ translatingDescription ? t('common.loading') : t('comment.translate') }}</span>
              </button>
            </div>

            <div v-if="isPinOwner && pin.privateTags?.length" class="mb-6">
              <p class="mb-2 text-xs font-semibold text-neutral-500">{{ t('pin.privateTags.readonlyTitle') }}</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="tag in pin.privateTags" :key="tag" class="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                  {{ tag }}
                </span>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between gap-4">
              <router-link
                :to="`/profile/${pin.username}`"
                class="flex min-w-0 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <AvatarDisc
                  :color="pin.userAvatarColor"
                  frame-class="w-10 h-10 text-sm shadow-sm"
                  text-class="text-white"
                  :has-image="!!pin.userAvatarUrl"
                >
                  <img v-if="pin.userAvatarUrl" :src="pin.userAvatarUrl" class="h-full w-full object-cover" loading="lazy" decoding="async">
                  <span v-else class="avatar-text">{{ displayInitials(pin.user) }}</span>
                </AvatarDisc>
                <div class="min-w-0">
                  <p class="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ pin.user }}</p>
                  <p class="text-xs text-neutral-500">{{ t('pin.followers', { count: formatCount(pin.authorFollowersCount ?? 0) }) }}</p>
                </div>
              </router-link>
              <button
                v-if="canFollowAuthor"
                type="button"
                class="rounded-full text-sm font-bold transition-all"
                :class="pin.isFollowing ? 'lux-btn-accent-dark py-2.5 px-6' : 'lux-btn-secondary py-2.5 px-6 border-0 shadow-md'"
                :disabled="followingAuthor"
                @click="emit('follow')"
              >
                <span v-if="followingAuthor" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span v-else>{{ pin.isFollowing ? t('pin.following') : t('pin.follow') }}</span>
              </button>
            </div>

            <div class="mb-6 mt-6 flex items-center gap-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.saves) }}
                <span class="pin-desktop-filled material-symbols-outlined text-lg" :class="{ 'text-neutral-600': pin.saved }">bookmark</span>
              </span>
              <button
                v-if="pin.isStory && isPinOwner"
                type="button"
                class="-mx-1 flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                :aria-label="t('story.likers.openListAria', { count: pin.stats.reactions })"
                @click="emit('open-likers')"
              >
                {{ formatCount(pin.stats.reactions) }}
                <span class="pin-desktop-filled material-symbols-outlined text-lg text-pink-700" aria-hidden="true">favorite</span>
              </button>
              <span v-else-if="!pin.isStory" class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.reactions) }}
                <span class="pin-desktop-filled material-symbols-outlined text-lg" :class="pin.liked ? 'text-pink-700' : 'text-neutral-300'">favorite</span>
              </span>
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">sell</span>
                <span class="truncate">{{ pin.topicDisplay ?? pin.topic }}</span>
              </span>
            </div>

            <div v-if="pin.hashtags?.length" class="mb-5 flex flex-wrap gap-2">
              <span v-for="tag in pin.hashtags" :key="tag" class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {{ tag }}
              </span>
            </div>

            <div v-if="pin.boards?.length" class="mb-5 flex flex-wrap gap-2">
              <router-link
                v-for="board in pin.boards"
                :key="board.id"
                :to="`/profile/${board.ownerUsername || pin.username}/board/${board.id}`"
                class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 dark:bg-purple-950/35 dark:text-purple-300 dark:hover:bg-purple-900/45"
              >
                <span class="material-symbols-outlined text-sm" aria-hidden="true">dashboard</span>
                {{ board.name }}
              </router-link>
            </div>

            <div class="pin-detail-comments-pane flex-1">
              <div class="mb-4 flex flex-col gap-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <h3 class="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                    {{ t('pin.comments') }}
                    <span class="text-sm font-normal text-neutral-400">({{ commentsTotalCount }})</span>
                  </h3>
                </div>
                <p
                  v-if="isAuthenticated && !viewerCanComment"
                  class="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  {{ pin.commentsPolicy === 'closed' ? t('pin.comments.closedBanner') : t('pin.comments.followersOnlyBanner') }}
                </p>
              </div>

              <div class="mb-5 max-h-[360px] overflow-y-auto pr-1">
                <CommentThread
                  :comments="comments"
                  :can-translate="isAuthenticated"
                  :highlighted-comment-id="highlightedCommentId"
                  :is-pin-owner="isPinOwner"
                  :viewer-can-comment="viewerCanComment"
                  :viewer-username="currentUser?.username ?? null"
                  @add="(payload) => emit('comment-add', payload)"
                  @like="(id) => emit('comment-like', id)"
                  @translate="(id) => emit('comment-translate', id)"
                  @load-more-replies="(id) => emit('load-more-replies', id)"
                  @moderate-comment="(id, hidden) => emit('moderate-comment', id, hidden)"
                  @report-comment="(id) => emit('report-comment', id)"
                  @delete-comment="(id) => emit('delete-comment', id)"
                />
                <div v-if="commentsHasNext" class="mt-3 text-center">
                  <button
                    class="text-sm font-semibold text-pink-700 hover:text-pink-800 disabled:opacity-50"
                    :disabled="commentsLoadingMore"
                    @click="emit('load-more-comments')"
                  >
                    {{ commentsLoadingMore ? t('comment.loadingMoreComments') : t('comment.loadMoreComments') }}
                  </button>
                </div>
              </div>

              <div v-if="!isAuthenticated || viewerCanComment" class="flex w-full min-w-0 items-start gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <AvatarDisc
                  v-if="currentUser"
                  :color="currentUser.avatarColor"
                  frame-class="w-9 h-9 text-xs mt-1"
                  text-class="text-white"
                  :has-image="!!currentUser.avatarUrl"
                >
                  <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" alt="" class="h-full w-full object-cover" loading="lazy" decoding="async">
                  <span v-else>{{ currentUser.displayName[0] }}</span>
                </AvatarDisc>
                <div class="min-w-0 flex-1">
                  <RichCommentInput :submitting="submittingComment" @submit="(payload) => emit('comment-add', payload)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </Teleport>
</template>

<style scoped>
.pin-desktop-filled {
  font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24;
}

.pin-desktop-modal-card {
  animation: pin-desktop-modal-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pin-desktop-modal-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
