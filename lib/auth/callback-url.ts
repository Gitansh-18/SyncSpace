/**
 * Accepts only same-origin, relative callback URLs. Protocol-relative
 * ("//host") and absolute URLs are rejected to prevent open redirects.
 */
export function getSafeCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (!value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }

  if (value === "/") {
    return null;
  }

  return value;
}