/**
 * Opens a file in a new tab using fetch → Blob → object URL so the
 * underlying storage URL (Supabase path, tokens, UUIDs) is never visible
 * in the browser address bar. The user sees blob:https://classhub.work/...
 *
 * window.open() is called synchronously first to avoid popup blockers,
 * then the location is updated once the blob is ready.
 */
export async function viewFile(url: string): Promise<void> {
  const win = window.open('about:blank')
  const response = await fetch(url)
  if (!response.ok) {
    win?.close()
    throw new Error(`Failed to load file (${response.status})`)
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  if (win) {
    win.location.href = blobUrl
  }
}
