let pendingStoryCaptureFile: File | null = null

export function setPendingStoryCaptureFile(file: File) {
  pendingStoryCaptureFile = file
}

export function consumePendingStoryCaptureFile(): File | null {
  const file = pendingStoryCaptureFile
  pendingStoryCaptureFile = null
  return file
}
