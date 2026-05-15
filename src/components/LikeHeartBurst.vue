<script setup lang="ts">
/**
 * LikeHeartBurst — affiche un cœur animé éclatant à la position d'un tap
 * (style Instagram / TikTok). Géré comme une stack de bursts (chaque double-tap
 * empile un cœur indépendant qui disparaît après ~700ms).
 *
 * Le composant ne s'occupe pas du like lui-même ; il expose une méthode
 * `burstAt({ x, y })` à appeler après détection d'un double-tap.
 *
 * Anti-jitter : si plusieurs bursts arrivent rapidement, ils s'empilent et
 * disparaissent indépendamment (clé unique).
 *
 * Respect `prefers-reduced-motion` : fade simple.
 *
 * Usage :
 *
 *   <LikeHeartBurst ref="heartBurstRef" />
 *   // dans le code :
 *   heartBurstRef.value?.burstAt({ x: 120, y: 240 })
 */
import { reactive } from 'vue'

interface Burst {
  id: number
  x: number
  y: number
  rotation: number
}

const bursts = reactive<Burst[]>([])
let nextId = 1

function burstAt(point: { x: number; y: number }) {
  const id = nextId++
  /* Rotation aléatoire légère pour casser la répétition. */
  const rotation = (Math.random() * 24) - 12
  bursts.push({ id, x: point.x, y: point.y, rotation })
  /* Auto-remove après animation. */
  setTimeout(() => {
    const idx = bursts.findIndex((b) => b.id === id)
    if (idx >= 0) bursts.splice(idx, 1)
  }, 760)
}

defineExpose({ burstAt })
</script>

<template>
  <div class="like-heart-burst" aria-hidden="true">
    <span
      v-for="b in bursts"
      :key="b.id"
      class="like-heart-burst__heart"
      :style="{
        '--burst-x': `${b.x}px`,
        '--burst-y': `${b.y}px`,
        '--burst-rotation': `${b.rotation}deg`,
      } as Record<string, string>"
    >
      <svg viewBox="0 0 24 24" width="64" height="64">
        <path
          d="M12 21s-7.5-4.78-9.5-9.16C1 8.79 2.85 5.5 6.18 5.5c1.85 0 3.43 1.04 4.32 2.56C11.39 6.54 12.97 5.5 14.82 5.5 18.15 5.5 20 8.79 18.5 11.84 16.5 16.22 12 21 12 21Z"
          fill="currentColor"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.like-heart-burst {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
  /* Pas de capture d'event. */
}

.like-heart-burst__heart {
  position: absolute;
  top: 0;
  left: 0;
  width: 64px;
  height: 64px;
  margin-left: -32px;
  margin-top: -32px;
  color: #ff2e63;
  transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0)
    rotate(var(--burst-rotation, 0));
  filter: drop-shadow(0 6px 14px rgba(255, 46, 99, 0.45));
  animation: like-burst 720ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  will-change: transform, opacity;
}

@keyframes like-burst {
  0% {
    opacity: 0;
    transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0)
      rotate(var(--burst-rotation, 0))
      scale(0.4);
  }
  35% {
    opacity: 1;
    transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0)
      rotate(var(--burst-rotation, 0))
      scale(1.18);
  }
  60% {
    opacity: 1;
    transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0)
      rotate(var(--burst-rotation, 0))
      scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--burst-x, 0), calc(var(--burst-y, 0) - 32px), 0)
      rotate(var(--burst-rotation, 0))
      scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .like-heart-burst__heart {
    animation: like-burst-reduced 280ms ease forwards;
  }
  @keyframes like-burst-reduced {
    0% { opacity: 0; transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translate3d(var(--burst-x, 0), var(--burst-y, 0), 0); }
  }
}
</style>
