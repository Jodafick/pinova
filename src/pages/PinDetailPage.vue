<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import PinGrid from '../components/PinGrid.vue'

const route = useRoute()
const router = useRouter()
const { getPin, toggleSave, searchPins, formatCount } = usePins()
const { currentUser, toggleSavePin } = useAuth()

const pinId = computed(() => Number(route.params.id))
const pin = computed(() => getPin(pinId.value))

const comment = ref('')
const comments = ref([
  { user: 'Marie', text: 'Trop beau ! J\'adore cette inspiration.', avatarColor: 'bg-pink-400', time: 'Il y a 2h' },
  { user: 'Thomas', text: 'J\'ai sauvegardé, merci pour le partage !', avatarColor: 'bg-blue-400', time: 'Il y a 5h' },
])

const relatedPins = computed(() => {
  if (!pin.value) return []
  return searchPins('', pin.value.topic).filter((p) => p.id !== pin.value!.id).slice(0, 8)
})

const handleSave = () => {
  if (!pin.value) return
  toggleSave(pin.value.id)
  toggleSavePin(pin.value.id)
}

const addComment = () => {
  if (!comment.value.trim() || !currentUser.value) return
  comments.value.unshift({
    user: currentUser.value.displayName,
    text: comment.value,
    avatarColor: currentUser.value.avatarColor,
    time: "À l'instant",
  })
  comment.value = ''
}

const goBack = () => {
  router.back()
}

const openRelatedPin = (id: number) => {
  router.push(`/pin/${id}`)
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Not found -->
    <div v-if="!pin" class="flex flex-col items-center justify-center py-32 text-center px-6">
      <span class="material-symbols-outlined text-7xl text-neutral-300 mb-4">broken_image</span>
      <h1 class="text-2xl font-bold text-neutral-800 mb-2">Pin introuvable</h1>
      <p class="text-neutral-500 mb-6">Ce pin n'existe pas ou a été supprimé.</p>
      <router-link to="/" class="px-6 py-2.5 rounded-full bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition">
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
                <button class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition">
                  <span class="material-symbols-outlined">share</span>
                </button>
                <button class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition">
                  <span class="material-symbols-outlined">link</span>
                </button>
                <button class="w-10 h-10 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition">
                  <span class="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
              <button
                class="px-6 py-2.5 rounded-full font-semibold text-sm transition-all"
                :class="pin.saved
                  ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'bg-red-600 text-white hover:bg-red-700'"
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
            <div class="flex items-center justify-between py-4 border-t border-b border-neutral-100 mb-6">
              <div class="flex items-center gap-3">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                  :class="pin.userAvatarColor"
                >
                  {{ pin.user[0] }}
                </div>
                <div>
                  <p class="font-semibold text-neutral-900">{{ pin.user }}</p>
                  <p class="text-xs text-neutral-500">{{ formatCount(pin.stats.saves) }} enregistrements</p>
                </div>
              </div>
              <button class="px-4 py-2 rounded-full bg-neutral-100 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition">
                Suivre
              </button>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 mb-6 text-sm text-neutral-500">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">bookmark</span>
                {{ formatCount(pin.stats.saves) }} enreg.
              </span>
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-lg">favorite</span>
                {{ formatCount(pin.stats.reactions) }} j'aime
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
                <div v-for="(c, i) in comments" :key="i" class="flex gap-3">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    :class="c.avatarColor"
                  >
                    {{ c.user[0] }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold">{{ c.user }}</span>
                      <span class="text-xs text-neutral-400">{{ c.time }}</span>
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
                    v-model="comment"
                    type="text"
                    placeholder="Ajouter un commentaire..."
                    class="flex-1 py-2.5 px-4 rounded-full bg-neutral-100 text-sm outline-none focus:ring-2 focus:ring-red-500"
                    @keyup.enter="addComment"
                  />
                  <button
                    class="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition disabled:opacity-40"
                    :disabled="!comment.trim()"
                    @click="addComment"
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
      <section v-if="relatedPins.length > 0" class="px-3 sm:px-6 lg:px-10 xl:px-16 pb-10">
        <h2 class="text-xl font-bold text-neutral-900 mb-5">Plus comme ça</h2>
        <PinGrid
          :pins="relatedPins"
          @toggle-save="(id) => { toggleSave(id); toggleSavePin(id) }"
          @open-pin="openRelatedPin"
          @more="openRelatedPin"
        />
      </section>
    </div>
  </div>
</template>
