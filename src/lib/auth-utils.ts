/**
 * Client-safe helpers used by both the login screen and admin UI.
 */

export type AccountStatus = "active" | "suspended" | "expired" | "disabled" | "locked";
export type AppRole =
  | "super_admin"
  | "admin"
  | "moderator"
  | "support"
  | "auditor"
  | "readonly"
  | "reseller_owner"
  | "reseller_staff"
  | "billing_admin"
  | "api_client";

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "مسؤول أعلى",
  admin: "مسؤول",
  moderator: "مشرف",
  support: "دعم",
  auditor: "مدقّق",
  readonly: "قراءة فقط",
  reseller_owner: "مالك موزّع",
  reseller_staff: "موظّف موزّع",
  billing_admin: "مسؤول فوترة",
  api_client: "عميل API",
};

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

// ─── RBAC capability matrix (client + server share this) ────────────────
export interface Capabilities {
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  canManageLicenses: boolean;
  canManagePackages: boolean;
  canManageDevices: boolean;
  canManageSessions: boolean;
  canBulk: boolean;
  canExport: boolean;
  canViewSecurity: boolean;
  canViewAudit: boolean;
  canManageSystem: boolean;
  canBroadcast: boolean;
  canManageRoles: boolean;
  readOnly: boolean;
}

export function capabilitiesFor(roles: AppRole[]): Capabilities {
  const has = (r: AppRole) => roles.includes(r);
  const isSuper = has("super_admin");
  const isAdmin = isSuper || has("admin");
  const isSupport = isAdmin || has("support");
  const isAuditor = has("auditor");
  const isReadOnly = has("readonly") && !isSupport && !isAuditor;
  return {
    canManageUsers: isSupport,
    canDeleteUsers: isAdmin,
    canManageLicenses: isSupport,
    canManagePackages: isAdmin,
    canManageDevices: isSupport,
    canManageSessions: isSupport,
    canBulk: isAdmin,
    canExport: isAdmin || isAuditor,
    canViewSecurity: isAdmin || isAuditor || isSupport,
    canViewAudit: isAdmin || isAuditor,
    canManageSystem: isAdmin,
    canBroadcast: isSuper,
    canManageRoles: isSuper,
    readOnly: isReadOnly,
  };
}
