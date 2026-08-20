/**
 * Build a telephone action only from a backend-owned phone value that has a
 * conventional, bounded format. Never normalize an arbitrary URI-like value
 * into a `tel:` URL.
 */
export function safeTelephoneHref(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !/^\+?[0-9][0-9\s().-]{5,24}$/.test(trimmed)) return null;

  const normalized = trimmed.replace(/[\s().-]/g, "");
  return /^\+?\d{6,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
