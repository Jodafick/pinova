/** Logs réservés au développement local (pas en prod). */
export function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) console.log(...args)
}
