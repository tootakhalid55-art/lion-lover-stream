/**
 * Server-side CSV/XLSX row builders. Called from server routes.
 */
import * as XLSX from "xlsx";

export type Dataset = "users" | "packages" | "licenses" | "devices" | "sessions" | "security" | "audit";
export type Format = "csv" | "xlsx";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function collect(dataset: Dataset): Promise<{ headers: string[]; rows: any[][] }> {
  const admin = await getAdmin();
  switch (dataset) {
    case "users": {
      const { data } = await admin.from("profiles").select("username, display_name, email, phone, status, expires_at, last_login_at, last_ip, created_at, package_id, packages(name, tier)").limit(10000);
      return {
        headers: ["username", "display_name", "email", "phone", "status", "expires_at", "last_login_at", "last_ip", "package", "package_tier", "created_at"],
        rows: (data ?? []).map((r: any) => [r.username, r.display_name, r.email, r.phone, r.status, r.expires_at, r.last_login_at, r.last_ip, r.packages?.name ?? "", r.packages?.tier ?? "", r.created_at]),
      };
    }
    case "packages": {
      const { data } = await admin.from("packages").select("*").limit(1000);
      return {
        headers: ["name", "tier", "duration_days", "max_devices", "max_sessions", "price_cents", "currency", "is_active"],
        rows: (data ?? []).map((r: any) => [r.name, r.tier, r.duration_days, r.max_devices, r.max_sessions, r.price_cents, r.currency, r.is_active]),
      };
    }
    case "licenses": {
      const { data } = await admin.from("licenses").select("license_key, license_type, status, activated_at, expires_at, auto_renew, profiles:user_id(username), packages(name, tier)").limit(10000);
      return {
        headers: ["license_key", "type", "status", "user", "package", "tier", "activated_at", "expires_at", "auto_renew"],
        rows: (data ?? []).map((r: any) => [r.license_key, r.license_type, r.status, r.profiles?.username ?? "", r.packages?.name ?? "", r.packages?.tier ?? "", r.activated_at, r.expires_at, r.auto_renew]),
      };
    }
    case "devices": {
      const { data } = await admin.from("user_devices").select("*, profiles:user_id(username)").limit(10000);
      return {
        headers: ["user", "device_name", "name", "os", "browser", "device_type", "ip", "country", "region", "first_login_at", "last_seen", "trusted_at", "blocked_at"],
        rows: (data ?? []).map((r: any) => [r.profiles?.username ?? "", r.device_name, r.name, r.os, r.browser, r.device_type, r.ip, r.country, r.region, r.first_login_at, r.last_seen, r.trusted_at, r.blocked_at]),
      };
    }
    case "sessions": {
      const { data } = await admin.from("user_sessions").select("*, profiles:user_id(username)").limit(10000);
      return {
        headers: ["user", "device_id", "ip", "country", "user_agent", "created_at", "last_seen", "revoked_at", "revoked_reason"],
        rows: (data ?? []).map((r: any) => [r.profiles?.username ?? "", r.device_id, r.ip, r.country, r.user_agent, r.created_at, r.last_seen, r.revoked_at, r.revoked_reason]),
      };
    }
    case "security": {
      const { data } = await admin.from("security_events").select("*, profiles:user_id(username)").limit(10000);
      return {
        headers: ["created_at", "kind", "severity", "user", "ip", "country", "user_agent", "meta"],
        rows: (data ?? []).map((r: any) => [r.created_at, r.kind, r.severity, r.profiles?.username ?? "", r.ip, r.country, r.user_agent, JSON.stringify(r.meta)]),
      };
    }
    case "audit": {
      const { data } = await admin.from("audit_logs").select("*, actor:actor_id(username), target:target_user_id(username)").limit(10000);
      return {
        headers: ["created_at", "actor", "action", "target", "ip", "user_agent", "before", "after", "meta"],
        rows: (data ?? []).map((r: any) => [r.created_at, r.actor?.username ?? "", r.action, r.target?.username ?? "", r.ip, r.user_agent, JSON.stringify(r.before_value), JSON.stringify(r.after_value), JSON.stringify(r.meta)]),
      };
    }
  }
}

function escapeCsv(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: any[][]): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const r of rows) lines.push(r.map(escapeCsv).join(","));
  return "\uFEFF" + lines.join("\n");
}

export function toXlsx(headers: string[], rows: any[][], sheetName = "Sheet1"): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

export function contentType(fmt: Format): string {
  return fmt === "csv" ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
