/**
 * Attend que Google Identity Services (OAuth2 token client) soit injecté dans la page.
 * Évite les clics « morts » si l’utilisateur ouvre la connexion avant la fin du chargement du script.
 */
export function waitForGoogleIdentityServices(timeoutMs = 12000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)

  const ready = () => {
    const w = window as Window & {
      google?: { accounts?: { oauth2?: { initTokenClient?: unknown } } }
    }
    const o = w.google?.accounts?.oauth2
    return !!(o && typeof o.initTokenClient === 'function')
  }

  if (ready()) return Promise.resolve(true)

  return new Promise((resolve) => {
    const started = Date.now()
    const poll = () => {
      if (ready()) {
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false)
        return
      }
      window.requestAnimationFrame(poll)
    }
    poll()
  })
}
