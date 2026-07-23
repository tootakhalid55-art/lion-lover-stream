/**
 * Licensing helpers — pure functions and shared logic used by both
 * `licensing.functions.ts` and admin/user flows. Keeping helpers out of the
 * server-fn module avoids TSS split ReferenceErrors.
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 for readability

function chunk(len: number): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += CHARS[buf[i] % CHARS.length];
  return out;
}

/** e.g. `NOVA-2026-AB45-HJK9-PLM8` */
export function generateLicenseKey(): string {
  const year = new Date().getUTCFullYear();
  return `NOVA-${year}-${chunk(4)}-${chunk(4)}-${chunk(4)}`;
}

/** e.g. `NOVA-84HF-29DK-JS83` */
export function generateActivationCode(): string {
  return `NOVA-${chunk(4)}-${chunk(4)}-${chunk(4)}`;
}

export function computeExpiry(durationDays: number | null | undefined, from = new Date()): string | null {
  if (durationDays == null) return null;
  return new Date(from.getTime() + durationDays * 86400_000).toISOString();
}
