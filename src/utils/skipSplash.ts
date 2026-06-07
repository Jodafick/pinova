/** Session flag : évite le splash Pinova au boot suivant (navigation création, post-auth, etc.). */
export const SKIP_SPLASH_FLAG = 'pinova-skip-splash'

export function markSkipSplash(): void {
  try {
    sessionStorage.setItem(SKIP_SPLASH_FLAG, '1')
  } catch {
    /* quota / mode privé */
  }
}

export function consumeSkipSplashFlag(): boolean {
  try {
    if (sessionStorage.getItem(SKIP_SPLASH_FLAG)) {
      sessionStorage.removeItem(SKIP_SPLASH_FLAG)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Routes immersives (création / édition) : pas de splash au cold-start. */
export function shouldSkipSplashForPath(pathname: string): boolean {
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  if (p === '/create' || p.startsWith('/create/')) return true
  if (p === '/story/create') return true
  if (/^\/pin\/[^/]+\/edit$/.test(p)) return true
  return false
}
