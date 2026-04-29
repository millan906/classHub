import { supabase } from '../lib/supabase'

const PUBLIC_PREFIX = '/storage/v1/object/public/submissions/'

/** Extracts the storage path from either a full public URL or a bare path. */
export function extractSubmissionPath(fileUrl: string): string {
  const idx = fileUrl.indexOf(PUBLIC_PREFIX)
  return idx !== -1 ? fileUrl.slice(idx + PUBLIC_PREFIX.length) : fileUrl
}

/** Generates a signed URL for a submission file. Handles both full URLs and bare paths. */
export async function getSubmissionSignedUrl(fileUrl: string, expirySeconds = 3600): Promise<string> {
  const path = extractSubmissionPath(fileUrl)
  const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, expirySeconds)
  if (error || !data?.signedUrl) throw error ?? new Error('Failed to generate signed URL')
  return data.signedUrl
}
