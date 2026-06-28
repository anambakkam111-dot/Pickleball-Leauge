// NOTE: This is casual local-only password protection.
// The SHA-256 hash is stored in plain localStorage — visible to anyone with dev tools.
// Do not use this for anything requiring real security.

export async function hashPassword(password: string): Promise<string> {
  const buf = new TextEncoder().encode(password);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === storedHash;
}
