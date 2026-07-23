/**
 * Client-safe helpers used by both the login screen and admin UI.
 */

export type AccountStatus = "active" | "suspended" | "expired" | "disabled" | "locked";
export type AppRole = "super_admin" | "admin" | "moderator";

export const USERNAME_DOMAIN = "nova.local";

/** Turn a username into the synthetic auth email Supabase stores. */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

const DEVICE_KEY = "nova.deviceId";

export function getDeviceFingerprint(): {
  deviceId: string;
  deviceName: string;
  os: string;
  browser: string;
} {
  if (typeof window === "undefined") {
    return { deviceId: "server", deviceName: "server", os: "server", browser: "server" };
  }
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  const ua = navigator.userAgent;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Mac/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
    ? "Windows"
    : /Linux/.test(ua)
    ? "Linux"
    : "Unknown";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Unknown";
  const deviceName = `${os} · ${browser}`;
  return { deviceId: id, deviceName, os, browser };
}

export const DURATION_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: "١ يوم", days: 1 },
  { label: "٧ أيام", days: 7 },
  { label: "٣٠ يومًا", days: 30 },
  { label: "٩٠ يومًا", days: 90 },
  { label: "١٨٠ يومًا", days: 180 },
  { label: "٣٦٥ يومًا", days: 365 },
  { label: "مدى الحياة", days: null },
];

export const STATUS_LABEL: Record<AccountStatus, string> = {
  active: "مفعّل",
  suspended: "معلّق",
  expired: "منتهي",
  disabled: "معطّل",
  locked: "مقفول",
};
