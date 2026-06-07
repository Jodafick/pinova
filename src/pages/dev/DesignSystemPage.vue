<script setup lang="ts">
import { ref } from 'vue'
import PinovaButton from '../../components/ui/PinovaButton.vue'
import PinovaInput from '../../components/ui/PinovaInput.vue'
import PinovaEmptyState from '../../components/ui/PinovaEmptyState.vue'
import PinovaErrorState from '../../components/ui/PinovaErrorState.vue'
import PinovaModal from '../../components/ui/PinovaModal.vue'
import { pushToast } from '../../composables/useToast'

const demoEmail = ref('')
const modalOpen = ref(false)

function showSuccessToast() {
  pushToast({ message: 'Pin publié avec succès.', kind: 'success' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-10">
    <header>
      <p class="text-xs font-bold uppercase tracking-widest text-pink-700 dark:text-pink-400">Dev only</p>
      <h1 class="mt-2 text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50">
        Pinova Design System
      </h1>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Aperçu des primitives web — voir aussi <code class="text-xs">docs/DESIGN-SYSTEM.md</code>.
      </p>
    </header>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">PinovaButton</h2>
      <div class="flex flex-wrap gap-3">
        <PinovaButton variant="primary">Primary</PinovaButton>
        <PinovaButton variant="secondary">Secondary</PinovaButton>
        <PinovaButton variant="ghost">Ghost</PinovaButton>
        <PinovaButton variant="danger">Danger</PinovaButton>
        <PinovaButton variant="primary" :loading="true">Loading</PinovaButton>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">PinovaInput</h2>
      <PinovaInput v-model="demoEmail" label="Email" icon="mail" placeholder="vous@exemple.com" hint="Format valide requis" />
      <PinovaInput v-model="demoEmail" label="Erreur" icon="mail" error="Adresse invalide" />
    </section>

    <section class="grid gap-6 sm:grid-cols-2">
      <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <PinovaEmptyState icon="inbox" title="Rien ici" description="Utilisez PinovaEmptyState pour les listes vides." />
      </div>
      <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <PinovaErrorState title="Erreur réseau" description="Réessayez dans un instant.">
          <template #action>
            <PinovaButton variant="primary" size="sm" block>Réessayer</PinovaButton>
          </template>
        </PinovaErrorState>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">Toast</h2>
      <PinovaButton variant="secondary" @click="showSuccessToast">pushToast success</PinovaButton>
    </section>

    <section class="space-y-4">
      <h2 class="text-lg font-bold">PinovaModal</h2>
      <PinovaButton variant="primary" @click="modalOpen = true">Ouvrir bottom sheet</PinovaButton>
      <PinovaModal v-model:open="modalOpen" presentation="bottomSheet" title="Exemple sheet">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">Contenu modal unifié PinovaModal.</p>
        <PinovaButton variant="primary" block class="mt-4" @click="modalOpen = false">Fermer</PinovaButton>
      </PinovaModal>
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
