<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import PinGrid from '../components/PinGrid.vue'
import PinSkeleton from '../components/PinSkeleton.vue'

const route = useRoute()
const router = useRouter()

const { getPin, toggleSave, pins, fetchPins, formatCount, toggleLike, fetchComments, addComment: apiAddComment, toggleFollow, loading: pinsLoading } = usePins()
const { currentUser, toggleSavePin, isAuthenticated } = useAuth()

const pinSlug = computed(() => route.params.slug as string)
const pin = computed(() => getPin(pinSlug.value))

const commentText = ref('')
const comments = ref<any[]>([])

const fetchPinComments = async () => {
  if (pinSlug.value) {
    comments.value = await fetchComments(pinSlug.value)
  }
}

const relatedPins = computed(() => {
  if (!pin.value) return []
  return pins.value.filter((p) => p.topic === pin.value?.topic && p.slug !== pin.value?.slug).slice(0, 8)
})

onMounted(async () => {
  if (pins.value.length === 0 || !pin.value) {
    await fetchPins()
  }
  if (pinSlug.value) {
    fetchPinComments()
  }
})

const handleLike = async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (pin.value) {
    await toggleLike(pin.value.slug)
  }
}

const handleSave = () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (!pin.value) return
  toggleSave(pin.value.slug)
  toggleSavePin(pin.value.id)
}

const handleFollow = async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (pin.value && pin.value.username) {
    await toggleFollow(pin.value.username)
  }
}

const handleAddComment = async () => {
  if (!commentText.value.trim() || !isAuthenticated.value || !pin.value) return
  try {
    const newComment = await apiAddComment(pin.value.slug, commentText.value)
    comments.value.unshift(newComment)
    commentText.value = ''
  } catch (err) {
    console.error('Failed to add comment:', err)
  }
}

const handleShare = () => {
  navigator.clipboard.writeText(window.location.href)
  alert('Lien copié dans le presse-papier !')
}

const goBack = () => {
  router.back()
}

const openRelatedPin = (slug: string) => {
  router.push(`/pin/${slug}`)
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Not found -->
    <div v-if="!pin" class="flex flex-col items-center justify-center py-32 text-center px-6">
      <span class="material-symbols-outlined text-7xl text-neutral-300 mb-4">broken_image</span>
      <h1 class="text-2xl font-bold text-neutral-800 mb-2">Pin introuvable</h1>
      <p class="text-neutral-500 mb-6">Ce pin n'existe pas ou a été supprimé.</p>
      <router-link to="/" class="px-6 py-2.5 rounded-full bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700 transition">
        Retour à l'accueil
      </router-link>
    </div>

    <!-- Pin detail -->
    <div v-else>
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <!-- Back button -->
        <button
          class="mb-6 flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition"
          @click="goBack"
        >
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          Retour
        </button>

        <!-- Main card -->
        <div class="bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col lg:flex-row">
          <!-- Image -->
          <div class="lg:w-1/2 bg-neutral-100">
            <img
              :src="pin.imageUrl"
              :alt="pin.title"
              class="w-full h-80 sm:h-96 lg:h-full object-cover"
            />
          </div>

          <!-- Details -->
          <div class="lg:w-1/2 p-6 sm:p-8 lg:p-10 flex flex-col">
            <!-- Actions bar -->
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-2">
                <button
                  class="w-10 h-10 rounded-full flex items-center justify-center transition"
                  :class="pin.liked ? 'bg-pink-50 text-pink-600' : 'hover:bg-neutral-100 text-neutral-600'"
                  @click="handleLike"
                >
                  <span class="material-symbols-outlined fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
                </button>
                <button
                  class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined">share</span>
                </button>
                <button class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition">
                  <span class="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
              <button
                class="px-6 py-2.5 rounded-full font-semibold text-sm transition-all"
                :class="pin.saved
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-pink-600 text-white hover:bg-pink-700'"
                @click="handleSave"
              >
                {{ pin.saved ? 'Enregistré' : 'Enregistrer' }}
              </button>
            </div>

            <!-- Link -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              class="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 hover:underline mb-4"
            >
              <span class="material-symbols-outlined text-base">open_in_new</span>
              {{ pin.link }}
            </a>

            <!-- Title & Description -->
            <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3">{{ pin.title }}</h1>
            <p class="text-base text-neutral-600 leading-relaxed mb-6">{{ pin.description }}</p>

            <!-- Author -->
            <div class="mt-8 flex items-center justify-between">
              <router-link
                v-if="pin"
                :to="`/profile/${pin.username}`"
                class="flex items-center gap-3 hover:bg-neutral-50 p-2 rounded-xl transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm overflow-hidden avatar-shadow"
                  :class="pin.userAvatarColor"
                >
                  <img v-if="pin.userAvatarUrl" :src="pin.userAvatarUrl" class="w-full h-full object-cover" />
                  <span v-else class="avatar-text">{{ pin.user[0] }}</span>
                </div>
                <div>
                  <p class="text-sm font-bold text-neutral-900">{{ pin.user }}</p>
                  <p class="text-xs text-neutral-500">2,4k abonnés</p>
                </div>
              </router-link>
              <button
                v-if="currentUser && currentUser.id !== pin.userId"
                class="px-5 py-3 rounded-full text-sm font-bold transition-all"
                :class="pin.isFollowing
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'"
                @click="handleFollow"
              >
                {{ pin.isFollowing ? 'Abonné' : 'S\'abonner' }}
              </button>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 mb-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.saves) }}
                <span class="material-symbols-outlined text-lg" :class="{ 'fill-1 text-neutral-600': pin.saved }">bookmark</span>
              </span>
              <span class="flex items-center gap-1.5">
                {{ formatCount(pin.stats.reactions) }}
                <span class="material-symbols-outlined text-lg fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">sell</span>
                {{ pin.topic }}
              </span>
            </div>

            <!-- Comments section -->
            <div class="flex-1">
              <h3 class="font-semibold text-neutral-900 mb-3">
                Commentaires
                <span class="text-neutral-400 font-normal text-sm">({{ comments.length }})</span>
              </h3>

              <div class="space-y-3 max-h-48 overflow-y-auto mb-4">
                <div v-for="c in comments" :key="c.id" class="flex gap-3">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    :class="c.avatar_color"
                  >
                    {{ (c.display_name || c.username)[0] }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold">{{ c.display_name || c.username }}</span>
                      <span class="text-xs text-neutral-400">{{ new Date(c.created_at).toLocaleDateString() }}</span>
                    </div>
                    <p class="text-sm text-neutral-600">{{ c.text }}</p>
                  </div>
                </div>
              </div>

              <!-- Add comment -->
              <div class="flex items-center gap-3 pt-3 border-t border-neutral-100">
                <div
                  v-if="currentUser"
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  :class="currentUser.avatarColor"
                >
                  {{ currentUser.displayName[0] }}
                </div>
                <div class="flex-1 flex items-center gap-2">
                  <input
                    v-model="commentText"
                    type="text"
                    placeholder="Ajouter un commentaire..."
                    class="flex-1 py-2.5 px-4 rounded-full bg-neutral-100 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                    @keyup.enter="handleAddComment"
                  />
                  <button
                    class="w-9 h-9 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700 transition disabled:opacity-40"
                    :disabled="!commentText.trim()"
                    @click="handleAddComment"
                  >
                    <span class="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Related pins -->
      <section v-if="relatedPins.length > 0 || pinsLoading" class="px-3 sm:px-6 lg:px-10 xl:px-16 pb-10">
        <h2 class="text-xl font-bold text-neutral-900 mb-5">Plus comme ça</h2>
        <PinSkeleton v-if="pinsLoading && relatedPins.length === 0" />
        <PinGrid
          v-else
          :pins="relatedPins"
          @toggle-save="(id) => { toggleSave(id); toggleSavePin(id) }"
          @open-pin="openRelatedPin"
          @more="openRelatedPin"
        />
      </section>
    </div>
  </div>
</template>
