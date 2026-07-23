/**
 * Dashboard v2 KPIs + time-series aggregations.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function dayBuckets(days: number): { start: Date; end: Date; keys: string[]; keyOf: (d: string) => string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const keys: string[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400_000);
    keys.push(d.toISOString().slice(0, 10));
  }
  return { start, end, keys, keyOf: (iso) => new Date(iso).toISOString().slice(0, 10) };
}

export const dashboardV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canViewSecurity");
    const admin = await getAdmin();
    const now = Date.now();
    const dayAgo = new Date(now - 86400_000).toISOString();
    const cutoff = new Date(now - 5 * 60_000).toISOString();
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers, activeUsers, onlineSessions, activeLicenses, expiredLicenses,
      devicesCount, activeSessionsCount, failed24, activationsToday, packagesRows, licenses30,
      profiles30, logins30,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active"),
      admin.from("user_sessions").select("*", { count: "exact", head: true }).is("revoked_at", null).gt("last_seen", cutoff),
      admin.from("licenses").select("*", { count: "exact", head: true }).eq("status", "active"),
      admin.from("licenses").select("*", { count: "exact", head: true }).eq("status", "expired"),
      admin.from("user_devices").select("*", { count: "exact", head: true }),
      admin.from("user_sessions").select("*", { count: "exact", head: true }).is("revoked_at", null),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "failed_login").gt("created_at", dayAgo),
      admin.from("licenses").select("*", { count: "exact", head: true }).gt("activated_at", todayStart.toISOString()),
      admin.from("packages").select("id, name, tier").eq("is_active", true),
      admin.from("licenses").select("activated_at, package_id").gt("activated_at", new Date(now - 30 * 86400_000).toISOString()),
      admin.from("profiles").select("created_at").gt("created_at", new Date(now - 30 * 86400_000).toISOString()),
      admin.from("security_events").select("created_at, kind").in("kind", ["successful_login", "failed_login"])
        .gt("created_at", new Date(now - 30 * 86400_000).toISOString()),
    ]);

    const bk = dayBuckets(30);
    const activationsByDay = Object.fromEntries(bk.keys.map((k) => [k, 0]));
    const newUsersByDay = Object.fromEntries(bk.keys.map((k) => [k, 0]));
    const loginsByDay = Object.fromEntries(bk.keys.map((k) => [k, { ok: 0, fail: 0 }]));
    const pkgDist: Record<string, number> = {};
    (licenses30.data ?? []).forEach((r: any) => {
      const k = bk.keyOf(r.activated_at); if (k in activationsByDay) activationsByDay[k]++;
      pkgDist[r.package_id] = (pkgDist[r.package_id] ?? 0) + 1;
    });
    (profiles30.data ?? []).forEach((r: any) => { const k = bk.keyOf(r.created_at); if (k in newUsersByDay) newUsersByDay[k]++; });
    (logins30.data ?? []).forEach((r: any) => {
      const k = bk.keyOf(r.created_at);
      if (!(k in loginsByDay)) return;
      if (r.kind === "successful_login") loginsByDay[k].ok++; else loginsByDay[k].fail++;
    });

    const packageDistribution = (packagesRows.data ?? []).map((p: any) => ({
      name: p.name, tier: p.tier, count: pkgDist[p.id] ?? 0,
    }));

    return {
      kpis: {
        activeUsers: activeUsers.count ?? 0,
        totalUsers: totalUsers.count ?? 0,
        onlineNow: onlineSessions.count ?? 0,
        activeLicenses: activeLicenses.count ?? 0,
        expiredLicenses: expiredLicenses.count ?? 0,
        devices: devicesCount.count ?? 0,
        activeSessions: activeSessionsCount.count ?? 0,
        failedLogins24h: failed24.count ?? 0,
        activationsToday: activationsToday.count ?? 0,
      },
      series: {
        activations: bk.keys.map((d) => ({ date: d, count: activationsByDay[d] })),
        newUsers: bk.keys.map((d) => ({ date: d, count: newUsersByDay[d] })),
        logins: bk.keys.map((d) => ({ date: d, ok: loginsByDay[d].ok, fail: loginsByDay[d].fail })),
      },
      packageDistribution,
    };
  });
