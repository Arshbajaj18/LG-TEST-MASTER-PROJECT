const UNSPECIFIED_RE = /^not\s+(separately\s+)?specified/i

/** True for blank cells and the "Not separately specified in the source standard." placeholder. */
export function isUnspecified(text: string | null | undefined): boolean {
  return !text || !text.trim() || UNSPECIFIED_RE.test(text.trim())
}
