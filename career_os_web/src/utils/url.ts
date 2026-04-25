const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function toSafeExternalUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return ALLOWED_PROTOCOLS.includes(protocol) ? value : null;
  } catch {
    return null;
  }
}
