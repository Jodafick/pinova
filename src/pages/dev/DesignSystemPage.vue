<script setup lang="ts">
import { ref } from 'vue'
import FotoceButton from '../../components/ui/FotoceButton.vue'
import FotoceInput from '../../components/ui/FotoceInput.vue'
import FotoceEmptyState from '../../components/ui/FotoceEmptyState.vue'
import FotoceErrorState from '../../components/ui/FotoceErrorState.vue'
import FotoceModal from '../../components/ui/FotoceModal.vue'
import { pushToast } from '../../composables/useToast'

const demoEmail = ref('')
const modalOpen = ref(false)

function showSuccessToast() {
  pushToast({ message: 'Foto publiée avec succès.', kind: 'success' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-10">
    <header>
      <p class="text-xs font-bold uppercase tracking-widest text-pink-700 dark:text-pink-400">Dev only</p>
      <h1 class="mt-2 text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50">
        Fotoce Design System
      </h1>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Aperçu des primitives web — voir aussi <code class="text-xs">docs/DESIGN-SYSTEM.md</code>.
      </p>
    </header>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">FotoceButton</h2>
      <div class="flex flex-wrap gap-3">
        <FotoceButton variant="primary">Primary</FotoceButton>
        <FotoceButton variant="secondary">Secondary</FotoceButton>
        <FotoceButton variant="ghost">Ghost</FotoceButton>
        <FotoceButton variant="danger">Danger</FotoceButton>
        <FotoceButton variant="primary" :loading="true">Loading</FotoceButton>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">FotoceInput</h2>
      <FotoceInput v-model="demoEmail" label="Email" icon="mail" placeholder="vous@exemple.com" hint="Format valide requis" />
      <FotoceInput v-model="demoEmail" label="Erreur" icon="mail" error="Adresse invalide" />
    </section>

    <section class="grid gap-6 sm:grid-cols-2">
      <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <FotoceEmptyState icon="inbox" title="Rien ici" description="Utilisez FotoceEmptyState pour les listes vides." />
      </div>
      <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <FotoceErrorState title="Erreur réseau" description="Réessayez dans un instant.">
          <template #action>
            <FotoceButton variant="primary" size="sm" block>Réessayer</FotoceButton>
          </template>
        </FotoceErrorState>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">Toast</h2>
      <FotoceButton variant="secondary" @click="showSuccessToast">pushToast success</FotoceButton>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">FotoceModal</h2>
      <FotoceButton variant="primary" @click="modalOpen = true">Ouvrir bottom sheet</FotoceButton>
      <FotoceModal v-model:open="modalOpen" presentation="bottomSheet" title="Exemple sheet">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">Contenu modal unifié FotoceModal.</p>
        <FotoceButton variant="primary" block class="mt-4" @click="modalOpen = false">Fermer</FotoceButton>
      </FotoceModal>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-bold">Skeleton</h2>
      <div class="app-skeleton-wave space-y-2">
        <div class="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div class="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </section>
  </div>
</template>
