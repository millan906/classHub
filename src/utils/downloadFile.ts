/**
 * Downloads a file from a URL using fetch → Blob → object URL so the
 * underlying storage URL is never exposed in the browser address bar.
 * The file saves with `filename` rather than the UUID-based storage path.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status})`)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}
