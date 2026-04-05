<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { addPin, topics } = usePins()
const { currentUser } = useAuth()

const title = ref('')
const description = ref('')
const link = ref('')
const topic = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const saving = ref(false)

const avatarColors = ['bg-amber-400', 'bg-emerald-400', 'bg-rose-400', 'bg-sky-400', 'bg-indigo-400', 'bg-lime-400']

const setImageFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    window.alert('Merci de déposer un fichier image (JPG, PNG, WEBP).')
    return
  }
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setImageFile(file)
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) setImageFile(file)
}

const clearImage = () => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = null
  imagePreviewUrl.value = null
}

const submitPin = async () => {
  if (!title.value || !imagePreviewUrl.value) return
  saving.value = true
  await new Promise((r) => setTimeout(r, 500))

  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)]!

  addPin({
    title: title.value,
    description: description.value || 'Nouveau pin',
    imageUrl: imagePreviewUrl.value,
    user: currentUser.value?.displayName || 'Utilisateur',
    userAvatarColor: currentUser.value?.avatarColor || randomColor,
    link: link.value || 'pinterest-clone.local',
    stats: { saves: 0, reactions: 0 },
    topic: topic.value || 'Autre',
    tall: Math.random() > 0.5,
    saved: false,
  })

  saving.value = false
  router.push('/')
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">Créer un Pin</h1>
        <p class="text-sm text-neutral-500 mt-1">Partagez une idée inspirante avec la communauté</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="px-5 py-2.5 rounded-full text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition"
          @click="router.back()"
        >
          Annuler
        </button>
        <button
          class="px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2"
          :disabled="!title || !imagePreviewUrl || saving"
          @click="submitPin"
        >
          <svg v-if="saving" class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? 'Publication...' : 'Publier' }}
        </button>
      </div>
    </div>

    <!-- Form -->
    <div class="bg-white rounded-3xl shadow-lg border border-neutral-100 overflow-hidden">
      <div class="flex flex-col lg:flex-row">
        <!-- Image upload area -->
        <div class="lg:w-2/5 p-6 sm:p-8 bg-neutral-50 border-b lg:border-b-0 lg:border-r border-neutral-100">
          <div
            v-if="!imagePreviewUrl"
            class="h-80 lg:h-full min-h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-colors"
            :class="isDragging
              ? 'border-red-400 bg-red-50/60'
              : 'border-neutral-300 hover:border-red-300 hover:bg-red-50/30'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop="onDrop"
            @click="fileInput?.click()"
          >
            <div class="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
              <span class="material-symbols-outlined text-3xl text-neutral-500">cloud_upload</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-neutral-700 mb-1">
                Glissez-déposez une image
              </p>
              <p class="text-xs text-neutral-500">
                ou cliquez pour parcourir vos fichiers
              </p>
              <p class="text-xs text-neutral-400 mt-2">
                JPG, PNG, WEBP — recommandé 1000x1500px
              </p>
            </div>
          </div>

          <div v-else class="relative">
            <img
              :src="imagePreviewUrl"
              alt="Aperçu"
              class="w-full rounded-2xl object-cover max-h-[500px]"
            />
            <button
              class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition"
              @click="clearImage"
            >
              <span class="material-symbols-outlined text-neutral-600">close</span>
            </button>
          </div>

          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
        </div>

        <!-- Fields -->
        <div class="lg:w-3/5 p-6 sm:p-8 space-y-5">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">Titre *</label>
            <input
              v-model="title"
              type="text"
              placeholder="Ajoutez un titre accrocheur"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition placeholder:text-neutral-400"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <textarea
              v-model="description"
              rows="4"
              placeholder="Décrivez votre pin en détail pour aider les autres à le découvrir"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition resize-none placeholder:text-neutral-400"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">Lien de destination</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg">link</span>
              <input
                v-model="link"
                type="url"
                placeholder="https://votre-site.com/article"
                class="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition placeholder:text-neutral-400"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">Catégorie</label>
            <div class="relative">
              <select
                v-model="topic"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition appearance-none bg-white"
              >
                <option value="">Sélectionnez une catégorie</option>
                <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
                <option value="Autre">Autre</option>
              </select>
              <span class="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <div class="flex items-center gap-3 text-sm text-neutral-500">
              <span class="material-symbols-outlined text-lg">info</span>
              <p>Votre pin sera visible par tous les utilisateurs après publication.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
