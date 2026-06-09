/** Retire le splash HTML inline (`index.html`) une fois Vue monté. */
export function removeBootSplash(): void {
  if (typeof document === 'undefined') return
  document.getElementById('pinova-boot-splash')?.remove()
}
