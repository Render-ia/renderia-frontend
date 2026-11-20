/**
 * Reads the expiry (`exp`, in seconds) of a JWT without verifying it.
 * The backend is the one that verifies the signature; the browser only uses
 * this to avoid restoring a session that already expired. Returns null for
 * tokens that are not JWTs (the mock data source uses random tokens).
 */
export function tokenExpiresAt(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** true when the token carries an expiry that has already passed. */
export function isExpired(token: string, now = Date.now()): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= now;
}
