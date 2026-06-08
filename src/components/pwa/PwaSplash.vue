<script setup lang="ts">
/**
 * PwaSplash — splash de boot iOS premium (gradient adapté clair/sombre, logo, fade).
 *
 * Durée perçue max 700ms (cible Apple "fast feeling"). Le splash :
 *  - apparaît instantanément (CSS pure, pas de JS bloquant)
 *  - disparaît au signal `ready` (fade 320ms)
 *  - réapparaît si l'app rentre en background longtemps (display=standalone)
 *
 * IMPORTANT : ce splash ne remplace PAS le splash natif iOS Safari (qui est
 * affiché par le système avant le premier paint). Il complète le système en
 * masquant la latence entre le premier paint et le mount Vue complet.
 *
 * Le composant est self-contained : aucune dépendance externe (pour pouvoir
 * apparaître AVANT que les composables Vue soient initialisés).
 *
 * Usage : monté dans App.vue avec `v-if="!appReady"` (appReady passe à true
 * une fois que `fetchCurrentUser` + i18n sont prêts).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface Props {
  /** Affiche le splash. Default true. */
  open?: boolean
  /** Durée min d'affichage (évite le flash instantané). Default 300ms. */
  minDurationMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  open: true,
  minDurationMs: 120,
})

const visible = ref(true)
const fadingOut = ref(false)
const mountedAt = ref(performance.now())

onMounted(() => {
  mountedAt.value = performance.now()
})

function dismiss() {
  const elapsed = performance.now() - mountedAt.value
  const delay = Math.max(0, props.minDurationMs - elapsed)
  setTimeout(() => {
    fadingOut.value = true
    /* On retire le lock body DÈS le début du fade-out (sinon le scroll reste
       bloqué tant que ce composant est monté dans App.vue, même si le splash
       n'est plus visuellement présent). */
    document.body.classList.remove('pinova-splash-locked')
    setTimeout(() => { visible.value = false }, 180)
  }, delay)
}

/* Écoute la prop `open` en interne : passe à false → trigger fade-out. */
const watchEffect = computed(() => {
  if (!props.open && visible.value && !fadingOut.value) {
    dismiss()
  }
  return visible.value
})

onBeforeUnmount(() => {
  /* Restore body background si on l'a override. */
  document.body.classList.remove('pinova-splash-locked')
})

/* Lock body pendant le splash (évite le scroll du contenu derrière qui apparaîtrait
   en transparence partielle quand le splash fade-out). */
onMounted(() => {
  document.body.classList.add('pinova-splash-locked')
})
</script>

<template>
  <div
    v-if="watchEffect"
    class="pwa-splash"
    :class="{ 'is-fading': fadingOut }"
    role="img"
    aria-label="Pinova"
  >
    <div class="pwa-splash__bg" aria-hidden="true" />

    <!-- Particles discrètes (décoratif). -->
    <div class="pwa-splash__particles" aria-hidden="true">
      <span class="pwa-splash__particle pwa-splash__particle--1" />
      <span class="pwa-splash__particle pwa-splash__particle--2" />
      <span class="pwa-splash__particle pwa-splash__particle--3" />
      <span class="pwa-splash__particle pwa-splash__particle--4" />
      <span class="pwa-splash__particle pwa-splash__particle--5" />
    </div>

    <!-- Logo flottant. -->
    <div class="pwa-splash__logo-wrap">
      <div class="pwa-splash__logo">
        <img src="/logo.png" alt="" width="92" height="92" class="pwa-splash__logo-img" />

        <!-- Sparkles SVG (4 étoiles autour du logo, décoratives). -->
        <svg class="pwa-splash__sparkle pwa-splash__sparkle--tl" viewBox="0 0 16 16" aria-hidden="true">
          <path class="pwa-splash__sparkle-path" d="M8 1 L9.5 6.5 L15 8 L9.5 9.5 L8 15 L6.5 9.5 L1 8 L6.5 6.5 Z" />
        </svg>
        <svg class="pwa-splash__sparkle pwa-splash__sparkle--tr" viewBox="0 0 16 16" aria-hidden="true">
          <path class="pwa-splash__sparkle-path" d="M8 1 L9.5 6.5 L15 8 L9.5 9.5 L8 15 L6.5 9.5 L1 8 L6.5 6.5 Z" />
        </svg>
        <svg class="pwa-splash__sparkle pwa-splash__sparkle--bl" viewBox="0 0 16 16" aria-hidden="true">
          <path class="pwa-splash__sparkle-path" d="M8 1 L9.5 6.5 L15 8 L9.5 9.5 L8 15 L6.5 9.5 L1 8 L6.5 6.5 Z" />
        </svg>
        <svg class="pwa-splash__sparkle pwa-splash__sparkle--br" viewBox="0 0 16 16" aria-hidden="true">
          <path class="pwa-splash__sparkle-path" d="M8 1 L9.5 6.5 L15 8 L9.5 9.5 L8 15 L6.5 9.5 L1 8 L6.5 6.5 Z" />
        </svg>
      </div>
      <div class="pwa-splash__wordmark">Pinova</div>
    </div>

    <!-- Indéterminé discret en bas d'écran (thème-aware via CSS). -->
    <div class="pwa-splash__progress" aria-hidden="true" />
  </div>
</template>

<style scoped>
.pwa-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  box-sizing: border-box;
  height: 100dvh;
  max-height: 100dvh;
  min-height: -webkit-fill-available;
  overflow: hidden;
  /* Animation d'entrée : on apparaît instantanément (le système iOS affichait
     déjà l'image splash, on prend le relais). */
  opacity: 1;
  transition: opacity 360ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity;
}

.pwa-splash.is-fading {
  opacity: 0;
  pointer-events: none;
}

.pwa-splash__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(255, 255, 255, 0.45) 0%, transparent 55%),
    radial-gradient(circle at 30% 25%, rgba(255, 145, 180, 0.88) 0%, transparent 52%),
    radial-gradient(circle at 72% 78%, rgba(255, 95, 145, 0.72) 0%, transparent 56%),
    linear-gradient(145deg, #d01f56 0%, #e0245e 22%, #ff4d7d 48%, #ff9ab8 100%);
}

/* Particles : disques flous animés en montée lente. */
.pwa-splash__particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.pwa-splash__particle {
  position: absolute;
  display: block;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  filter: blur(0.5px);
  animation: pwa-splash-float 4s ease-in-out infinite;
  will-change: transform, opacity;
}

.pwa-splash__particle--1 { width: 7px;  height: 7px;  top: 18%; left: 12%; animation-delay: 0s; }
.pwa-splash__particle--2 { width: 4px;  height: 4px;  top: 35%; left: 80%; animation-delay: 0.7s; }
.pwa-splash__particle--3 { width: 9px;  height: 9px;  top: 65%; left: 22%; animation-delay: 1.4s; }
.pwa-splash__particle--4 { width: 5px;  height: 5px;  top: 78%; left: 70%; animation-delay: 0.3s; }
.pwa-splash__particle--5 { width: 6px;  height: 6px;  top: 45%; left: 50%; animation-delay: 2.1s; }

@keyframes pwa-splash-float {
  0%   { transform: translateY(0) scale(1); opacity: 0.6; }
  50%  { transform: translateY(-22px) scale(1.15); opacity: 0.95; }
  100% { transform: translateY(-44px) scale(0.9); opacity: 0; }
}

/* Logo flottant : levitation douce + glow. */
.pwa-splash__logo-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  animation: pwa-splash-enter 480ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pwa-splash__logo {
  width: 92px;
  height: 92px;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 20px 56px rgba(180, 24, 72, 0.38),
    0 0 0 1px rgba(255, 255, 255, 0.55) inset,
    0 -10px 28px rgba(255, 255, 255, 0.55) inset;
  display: grid;
  place-items: center;
  animation: pwa-splash-levitate 3.2s ease-in-out infinite;
  will-change: transform;
}

.pwa-splash__logo-img {
  width: 78px;
  height: 78px;
  object-fit: cover;
}

.pwa-splash__sparkle-path {
  fill: #ffffff;
}

.pwa-splash__wordmark {
  color: white;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.5px;
  text-shadow:
    0 2px 18px rgba(0, 0, 0, 0.22),
    0 0 32px rgba(255, 255, 255, 0.2);
  animation: pwa-splash-wordmark 560ms 80ms backwards cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pwa-splash-enter {
  from { transform: scale(0.7) translateY(8px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes pwa-splash-levitate {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes pwa-splash-wordmark {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

/* Sparkles décoratifs autour du logo (4 étoiles SVG). */
.pwa-splash__sparkle {
  position: absolute;
  width: 14px;
  height: 14px;
  opacity: 0;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.55));
  pointer-events: none;
  animation: pwa-splash-sparkle 1.8s ease-out infinite;
  will-change: transform, opacity;
}
.pwa-splash__sparkle--tl { top: -10px;  left: -8px;  animation-delay: 0.0s; }
.pwa-splash__sparkle--tr { top: -4px;   right: -12px; animation-delay: 0.5s; width: 11px; height: 11px; }
.pwa-splash__sparkle--bl { bottom: -8px; left: -10px; animation-delay: 0.9s; width: 9px;  height: 9px;  }
.pwa-splash__sparkle--br { bottom: -6px; right: -6px;  animation-delay: 1.3s; width: 12px; height: 12px; }

@keyframes pwa-splash-sparkle {
  0%   { transform: scale(0) rotate(0deg);  opacity: 0; }
  35%  { transform: scale(1) rotate(45deg); opacity: 1; }
  65%  { transform: scale(1) rotate(90deg); opacity: 0.8; }
  100% { transform: scale(0) rotate(180deg); opacity: 0; }
}

/* Barre de progression indéterminée (lisible sur les deux thèmes). */
.pwa-splash__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  overflow: hidden;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.12);
}

.pwa-splash__progress::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.9),
    transparent
  );
  transform: translateX(-100%);
  animation: pwa-splash-progress 1.35s ease-in-out infinite;
}

@keyframes pwa-splash-progress {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ─── Thème sombre (classe `dark` sur `<html>`, même source que Tailwind) ─── */
:global(html.dark) .pwa-splash__bg {
  /* Sombre quasi-pur, juste une lueur rose extrêmement faible pour identifier la marque. */
  background:
    radial-gradient(ellipse 110% 70% at 50% -20%, rgba(120, 18, 56, 0.10) 0%, transparent 60%),
    radial-gradient(circle at 78% 82%, rgba(60, 8, 28, 0.18) 0%, transparent 55%),
    #050507;
}

:global(html.dark) .pwa-splash__particle {
  background: rgba(255, 163, 198, 0.45);
  filter: blur(0.75px);
}

:global(html.dark) .pwa-splash__logo {
  background: linear-gradient(165deg, rgba(28, 28, 32, 0.96) 0%, rgba(14, 14, 16, 0.98) 100%);
  box-shadow:
    0 22px 64px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset,
    0 0 48px rgba(224, 36, 94, 0.18);
}

:global(html.dark) .pwa-splash__logo-img {
  filter: saturate(1.08) brightness(1.06);
}

:global(html.dark) .pwa-splash__sparkle-path {
  fill: rgba(255, 182, 210, 0.95);
}

:global(html.dark) .pwa-splash__sparkle {
  filter: drop-shadow(0 0 10px rgba(255, 105, 165, 0.45));
}

:global(html.dark) .pwa-splash__wordmark {
  color: #fafaf9;
  text-shadow:
    0 2px 24px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(224, 36, 94, 0.35);
}

:global(html.dark) .pwa-splash__progress {
  background: rgba(255, 255, 255, 0.08);
}

:global(html.dark) .pwa-splash__progress::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 163, 198, 0.85),
    transparent
  );
}

@media (prefers-reduced-motion: reduce) {
  .pwa-splash__particle { animation: none; opacity: 0.5; }
  .pwa-splash__logo     { animation: none; }
  .pwa-splash__logo-wrap { animation: none; }
  .pwa-splash__wordmark  { animation: none; }
  .pwa-splash__sparkle   { animation: none; opacity: 0; }
  .pwa-splash__progress::after { animation: none; opacity: 0.5; }
}
</style>

<style>
/* Body lock pendant splash (global, hors scoped). */
body.pinova-splash-locked {
  position: fixed;
  inset: 0;
  width: 100%;
  overflow: hidden;
  height: 100dvh;
  max-height: 100dvh;
  min-height: -webkit-fill-available;
}
</style>
