/**
 * Converts a name string to title case.
 * Handles all-caps, all-lowercase, and mixed inputs.
 * e.g. "KRIZEL GONZALES" → "Krizel Gonzales"
 *      "mary joy DE LA CRUZ" → "Mary Joy De La Cruz"
 */
export function toTitleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
