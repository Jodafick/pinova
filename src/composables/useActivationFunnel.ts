import {
  computeCreatorLevelProgress,
  mergeActivationFunnelState,
  parseActivationFunnelState,
  type ActivationFunnelState,
  type CreatorMilestoneId,
} from '@fotoce/shared'
import { computed } from 'vue'
import api from '../api/index'
import { useAuth } from './useAuth'

const LOCAL_KEY = 'fotoce:activation:funnel:v1'

function readLocalFunnel(): ActivationFunnelState {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return {}
    return parseActivationFunnelState(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeLocalFunnel(state: ActivationFunnelState) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function useActivationFunnel() {
  const { currentUser, fetchCurrentUser } = useAuth()

  const funnelState = computed<ActivationFunnelState>(() => {
    const server = currentUser.value?.activationFunnel
    const local = readLocalFunnel()
    if (!server) return local
    return mergeActivationFunnelState(local, server)
  })

  const creatorProgress = computed(() => computeCreatorLevelProgress(funnelState.value))

  async function patchFunnel(patch: Partial<ActivationFunnelState>) {
    const merged = mergeActivationFunnelState(funnelState.value, patch)
    writeLocalFunnel(merged)
    const formData = new FormData()
    formData.append('activation_funnel_json', JSON.stringify(patch))
    await api.patch('me/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    await fetchCurrentUser({ force: true, silent: true })
  }

  async function markWelcomeTutorial(status: 'completed' | 'dismissed') {
    await patchFunnel({ welcomeCreateTutorial: status })
  }

  async function markFirstPinCelebrationSeen(milestones: CreatorMilestoneId[] = ['first_foto_published']) {
    await patchFunnel({
      firstPinCelebrationSeen: true,
      milestones,
    })
  }

  async function addMilestones(...ids: CreatorMilestoneId[]) {
    if (!ids.length) return
    await patchFunnel({ milestones: ids })
  }

  return {
    funnelState,
    creatorProgress,
    markWelcomeTutorial,
    markFirstPinCelebrationSeen,
    addMilestones,
    patchFunnel,
  }
}
