<script setup lang="ts">
/**
 * BirthDateRequiredModal — saisie de la date de naissance directement depuis
 * une page de création (pin / story). Plus besoin d'aller dans Paramètres :
 * l'utilisateur entre sa date, on POST `/me` via `updateProfile`, le snapshot
 * localStorage est rafraîchi via `fetchCurrentUser({ force: true })`, puis on
 * débloque la publication.
 *
 * Le modal s'auto-ferme sur succès ; sur erreur l'utilisateur reste dans le
 * modal pour corriger. L'âge minimum n'est PAS validé côté front (l'API
 * applique sa propre politique selon le type de média).
 */
import { ref, watch } from 'vue'
import PinovaModal from './ui/PinovaModal.vue'
import BirthDatePicker from './BirthDatePicker.vue'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'
import { hasRequiredBirthDateForMediaPublish } from '../composables/moderationPolicy'

const props = defineProps<{
  /** Ouverture contrôlée. */
  modelValue: boolean
  /** Si true, on ne peut pas fermer sans saisir une date valide (publication bloquée). */
  required?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', birthDate: string): void
}>()

const { t } = useI18n()
const { updateProfile, fetchCurrentUser, currentUser } = useAuth()

const birthDate = ref('')
const saving = ref(false)
const errorMsg = ref('')

/* Pré-remplir avec la date existante si déjà saisie (cas modification). */
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      const existing = currentUser.value?.birthDate
      birthDate.value =
        typeof existing === 'string' && existing.trim()
          ? existing.trim().slice(0, 10)
          : ''
      errorMsg.value = ''
    }
  },
  { immediate: true },
)

function close() {
  if (props.required && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    /* Bloqué : on ignore la fermeture demandée tant que l'âge n'est pas saisi. */
    return
  }
  emit('update:modelValue', false)
}

async function save() {
  const value = birthDate.value.trim()
  if (!hasRequiredBirthDateForMediaPublish(value)) {
    errorMsg.value = t('birthDateModal.invalid')
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    await updateProfile({ birthDate: value })
    /* Rafraîchit /me + snapshot localStorage pour que le reste de l'UI reflète
       la nouvelle date sans relancer l'utilisateur. */
    await fetchCurrentUser({ force: true, silent: true })
    pushToast({ message: t('birthDateModal.saved'), kind: 'success' })
    emit('saved', value)
    emit('update:modelValue', false)
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { error?: string; detail?: string; birth_date?: string[] } } }
    const data = ax.response?.data
    errorMsg.value =
      data?.error ||
      data?.detail ||
      (Array.isArray(data?.birth_date) ? data?.birth_date[0] : '') ||
      t('birthDateModal.saveError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <PinovaModal
    :open="modelValue"
    presentation="center"
    :show-header="false"
    :backdrop-dismiss="!required"
    @update:open="(v: boolean) => { if (!v) close() }"
  >
    <div class="p-1">
      <h2 class="text-lg font-black text-neutral-950 dark:text-neutral-50">
        {{ t('birthDateModal.title') }}
      </h2>
      <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        {{ t('birthDateModal.description') }}
      </p>

      <label class="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {{ t('birthDateModal.label') }}
      </label>
      <BirthDatePicker v-model="birthDate" select-class="birth-date-picker-select" />

      <p
        v-if="errorMsg"
        class="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400"
        role="alert"
      >
        {{ errorMsg }}
      </p>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          v-if="!required"
          type="button"
          class="px-4 py-2 rounded-full text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          :disabled="saving"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
          :disabled="saving || !birthDate.trim()"
          @click="save"
        >
          <svg v-if="saving" class="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? t('birthDateModal.saving') : t('birthDateModal.save') }}
        </button>
      </div>
    </div>
  </PinovaModal>
</template>

<style scoped>
:deep(.birth-date-picker-select) {
  width: 100%;
  margin-top: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(229 229 229);
  background: white;
  color: rgb(23 23 23);
  font-size: 0.875rem;
}

:global(html.dark) :deep(.birth-date-picker-select) {
  border-color: rgb(64 64 64);
  background: rgb(23 23 23);
  color: rgb(245 245 245);
}
</style>
