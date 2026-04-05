import { ref, computed } from 'vue'
import type { Pin } from '../types'

const STORAGE_KEY = 'pinterest_pins'

const defaultPins: Pin[] = [
  {
    id: 1,
    title: 'Salon minimaliste beige & bois',
    description: 'Ambiance douce pour petit espace avec des tons naturels et du mobilier épuré.',
    imageUrl: 'https://images.pexels.com/photos/1080696/pexels-photo-1080696.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Clara',
    userAvatarColor: 'bg-amber-400',
    link: 'archi-deco.fr',
    stats: { saves: 5100, reactions: 132 },
    topic: 'Maison et déco',
    tall: true,
    createdAt: '2026-03-20',
  },
  {
    id: 2,
    title: 'Idées de brunch du dimanche',
    description: 'Recettes faciles et colorées pour un brunch parfait entre amis.',
    imageUrl: 'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Léo',
    userAvatarColor: 'bg-emerald-400',
    link: 'foodlover.blog',
    stats: { saves: 2300, reactions: 64 },
    topic: 'Recettes faciles',
    createdAt: '2026-03-18',
  },
  {
    id: 3,
    title: 'Voyage au Japon – Itinéraire 10 jours',
    description: 'Tokyo, Kyoto, Osaka — conseils, budget et itinéraire détaillé.',
    imageUrl: 'https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Aya',
    userAvatarColor: 'bg-rose-400',
    link: 'travel-notes.jp',
    stats: { saves: 9800, reactions: 421 },
    topic: 'Voyages',
    tall: true,
    createdAt: '2026-03-15',
  },
  {
    id: 4,
    title: 'Setup bureau productif & cosy',
    description: 'Idées de lumières, rangements et déco pour un espace de travail inspirant.',
    imageUrl: 'https://images.pexels.com/photos/3746311/pexels-photo-3746311.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Max',
    userAvatarColor: 'bg-sky-400',
    link: 'notionlover.io',
    stats: { saves: 4400, reactions: 98 },
    topic: 'Inspiration design',
    createdAt: '2026-03-12',
  },
  {
    id: 5,
    title: 'Tatouages fins inspiration floral',
    description: 'Lignes délicates et minimalistes — les plus beaux tatouages floraux.',
    imageUrl: 'https://images.pexels.com/photos/2706187/pexels-photo-2706187.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Zoé',
    userAvatarColor: 'bg-indigo-400',
    link: 'tattoo-inspo.fr',
    stats: { saves: 6100, reactions: 211 },
    topic: 'Art & illustration',
    createdAt: '2026-03-10',
  },
  {
    id: 6,
    title: "Plantes d'intérieur faciles",
    description: "Top 10 des plantes pour débuter — faciles à entretenir et décoratives.",
    imageUrl: 'https://images.pexels.com/photos/3076899/pexels-photo-3076899.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Nina',
    userAvatarColor: 'bg-lime-400',
    link: 'greenhome.studio',
    stats: { saves: 3700, reactions: 77 },
    topic: 'Plantes',
    tall: true,
    createdAt: '2026-03-08',
  },
  {
    id: 7,
    title: 'Recette de banana bread moelleux',
    description: 'La recette parfaite pour un banana bread ultra moelleux et gourmand.',
    imageUrl: 'https://images.pexels.com/photos/1277202/pexels-photo-1277202.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Emma',
    userAvatarColor: 'bg-orange-400',
    link: 'chefmaison.fr',
    stats: { saves: 8200, reactions: 345 },
    topic: 'Recettes faciles',
    createdAt: '2026-03-05',
  },
  {
    id: 8,
    title: 'Mode streetwear automne 2026',
    description: 'Les tendances streetwear incontournables pour cet automne.',
    imageUrl: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Karim',
    userAvatarColor: 'bg-violet-400',
    link: 'streetstyle.co',
    stats: { saves: 3400, reactions: 156 },
    topic: 'Mode',
    tall: true,
    createdAt: '2026-03-03',
  },
  {
    id: 9,
    title: 'Yoga matinal — routine 15 min',
    description: 'Une routine simple et efficace pour bien démarrer la journée.',
    imageUrl: 'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Sofia',
    userAvatarColor: 'bg-teal-400',
    link: 'zenlife.app',
    stats: { saves: 7600, reactions: 289 },
    topic: 'Bien-être',
    createdAt: '2026-03-01',
  },
  {
    id: 10,
    title: 'Palette de couleurs terracotta',
    description: 'Inspiration couleurs chaudes pour intérieurs et projets graphiques.',
    imageUrl: 'https://images.pexels.com/photos/5797903/pexels-photo-5797903.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Lucas',
    userAvatarColor: 'bg-red-400',
    link: 'designpalette.cc',
    stats: { saves: 4100, reactions: 167 },
    topic: 'Inspiration design',
    tall: true,
    createdAt: '2026-02-28',
  },
  {
    id: 11,
    title: 'Photographie de rue à Paris',
    description: 'Les plus beaux spots parisiens pour la photographie urbaine.',
    imageUrl: 'https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&cs=tinysrgb&w=600',
    user: 'Julien',
    userAvatarColor: 'bg-cyan-400',
    link: 'photostreet.paris',
    stats: { saves: 5500, reactions: 198 },
    topic: 'Photographie',
    createdAt: '2026-02-25',
  },
  {
    id: 12,
    title: 'DIY macramé mural débutant',
    description: 'Tutoriel pas à pas pour créer une suspension murale en macramé.',
    imageUrl: 'https://images.pexels.com/photos/6444267/pexels-photo-6444267.jpeg?auto=compress&cs=tinysrgb&w=600',
    user: 'Chloé',
    userAvatarColor: 'bg-pink-400',
    link: 'crafthome.diy',
    stats: { saves: 2900, reactions: 88 },
    topic: 'DIY & Crafts',
    tall: true,
    createdAt: '2026-02-22',
  },
]

function loadPins(): Pin[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return [...defaultPins]
    }
  }
  return [...defaultPins]
}

const pins = ref<Pin[]>(loadPins())

function savePins() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins.value))
}

export function usePins() {
  const topics = computed(() => {
    const set = new Set<string>()
    pins.value.forEach((pin) => set.add(pin.topic))
    return Array.from(set).sort()
  })

  function addPin(pin: Omit<Pin, 'id' | 'createdAt'>) {
    const newPin: Pin = {
      ...pin,
      id: Date.now(),
      createdAt: new Date().toISOString().split('T')[0]!,
    }
    pins.value.unshift(newPin)
    savePins()
    return newPin
  }

  function getPin(id: number): Pin | undefined {
    return pins.value.find((p) => p.id === id)
  }

  function toggleSave(id: number) {
    const pin = pins.value.find((p) => p.id === id)
    if (pin) {
      pin.saved = !pin.saved
      if (pin.saved) {
        pin.stats.saves++
      } else {
        pin.stats.saves = Math.max(0, pin.stats.saves - 1)
      }
      savePins()
    }
  }

  function deletePin(id: number) {
    const idx = pins.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      pins.value.splice(idx, 1)
      savePins()
    }
  }

  function searchPins(query: string, topic?: string | null): Pin[] {
    return pins.value.filter((pin) => {
      const matchesTopic = topic ? pin.topic === topic : true
      const q = query.trim().toLowerCase()
      const matchesQuery = q
        ? [pin.title, pin.description, pin.link, pin.topic, pin.user].some((f) =>
            f.toLowerCase().includes(q),
          )
        : true
      return matchesTopic && matchesQuery
    })
  }

  function getPinsByTopic(topic: string): Pin[] {
    return pins.value.filter((p) => p.topic === topic)
  }

  function getTrendingPins(): Pin[] {
    return [...pins.value].sort((a, b) => b.stats.saves - a.stats.saves).slice(0, 20)
  }

  function formatCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' k'
    return String(n)
  }

  return {
    pins,
    topics,
    addPin,
    getPin,
    toggleSave,
    deletePin,
    searchPins,
    getPinsByTopic,
    getTrendingPins,
    formatCount,
  }
}
