/**
 * Render Scheduler — helpers de stabilité de rendu (anti-jank).
 *
 * - `nextFrame()` : Promise rAF (1 frame).
 * - `idleCallback()` : Promise requestIdleCallback (avec fallback setTimeout).
 * - `throttleRaf(fn)` : throttle qui ne déclenche qu'une fois par frame.
 * - `debounce(fn, ms)` : debounce simple.
 * - `microThrottle(fn, ms)` : throttle "leading edge" + dernier appel exécuté.
 * - `batchWrite(fn)` : reporte le write au prochain rAF (anti layout thrashing).
 * - `batchRead(fn)` : exécute en `rIC` pour lecture sans bloquer le compositing.
 *
 * Tous renvoient une Promise<void> ou la valeur de la fonction selon usage.
 */

export function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

export function idleCallback(timeout = 200): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
    }).requestIdleCallback
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout })
    } else {
      setTimeout(resolve, Math.min(timeout, 64))
    }
  })
}

/**
 * Throttle qui n'invoque qu'une fois par frame (rAF leading edge).
 * Utile pour les handlers de scroll / pointermove pour éviter le layout thrashing.
 */
type AnyFn = (...args: never[]) => void

export function throttleRaf<T extends AnyFn>(fn: T): T {
  let scheduled = false
  let lastArgs: unknown[] = []
  const wrapped = ((...args: unknown[]) => {
    lastArgs = args
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      try {
        ;(fn as unknown as (...a: unknown[]) => void)(...lastArgs)
      } catch (err) {
        console.warn('[renderScheduler] throttleRaf error', err)
      }
    })
  }) as unknown as T
  return wrapped
}

/** Debounce trailing edge. */
export function debounce<T extends AnyFn>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: unknown[] = []
  const wrapped = ((...args: unknown[]) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      try {
        ;(fn as unknown as (...a: unknown[]) => void)(...lastArgs)
      } catch (err) {
        console.warn('[renderScheduler] debounce error', err)
      }
    }, ms)
  }) as unknown as T & { cancel: () => void }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return wrapped
}

/**
 * "Micro throttle" : 1 appel immédiat, puis 1 appel max toutes les ms.
 * Le dernier appel pendant la fenêtre est exécuté en trailing.
 */
export function microThrottle<T extends AnyFn>(fn: T, ms: number): T {
  let lastCall = 0
  let trailingTimer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: unknown[] = []
  const wrapped = ((...args: unknown[]) => {
    lastArgs = args
    const now = performance.now()
    const elapsed = now - lastCall
    if (elapsed >= ms) {
      lastCall = now
      ;(fn as unknown as (...a: unknown[]) => void)(...args)
    } else if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null
        lastCall = performance.now()
        ;(fn as unknown as (...a: unknown[]) => void)(...lastArgs)
      }, ms - elapsed)
    }
  }) as unknown as T
  return wrapped
}

/** Reporte un write DOM au prochain rAF (anti layout thrashing). */
export function batchWrite(fn: () => void): void {
  requestAnimationFrame(() => {
    try { fn() } catch (err) { console.warn('[renderScheduler] batchWrite error', err) }
  })
}

/** Reporte une lecture lourde au prochain idleCallback. */
export function batchRead(fn: () => void): void {
  const ric = (window as Window & {
    requestIdleCallback?: (cb: () => void) => number
  }).requestIdleCallback
  if (typeof ric === 'function') {
    ric(() => {
      try { fn() } catch (err) { console.warn('[renderScheduler] batchRead error', err) }
    })
  } else {
    setTimeout(() => {
      try { fn() } catch (err) { console.warn('[renderScheduler] batchRead error', err) }
    }, 16)
  }
}
