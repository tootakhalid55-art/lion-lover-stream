/**
 * Tenant-isolation helpers used by every Phase 2C server fn and REST route.
 * Never trust an `orgId` from client input — always run it through
 * `assertTenantAccess` first.
 */
import type { AuthCtx } from "./rbac.server";

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  type: "platform" | "master_distributor" | "distributor" | "reseller" | "sub_reseller" | "customer";
  parent_id: string | null;
  status: "active" | "suspended" | "disabled";
  currency: string;
  country: string | null;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** All ancestor org IDs (inclusive of `orgId`) walking up parent chain. */
export async function orgAncestors(orgId: string): Promise<string[]> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("org_ancestors", { _org: orgId });
  if (error) throw error;
  return (data as string[]) ?? [];
}

/** Every org the current user belongs to directly (no ancestor walk). */
export async function myOrgIds(ctx: AuthCtx): Promise<string[]> {
  const { data, error } = await ctx.supabase.from("org_members").select("org_id").eq("user_id", ctx.userId);
  if (error) throw error;
  return (data ?? []).map((r: { org_id: string }) => r.org_id);
}

/**
 * Throws unless the current user is a platform admin OR a member of `orgId`
 * OR a member of any ancestor of `orgId` (parent orgs can read/write child orgs).
 */
export async function assertTenantAccess(ctx: AuthCtx, orgId: string): Promise<void> {
  const admin = await getAdmin();
  const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: ctx.userId });
  if (adminFlag) return;
  const [mine, ancestors] = await Promise.all([myOrgIds(ctx), orgAncestors(orgId)]);
  if (mine.some((m) => ancestors.includes(m))) return;
  throw new Error("Forbidden");
}

/** Read an org row after verifying access. */
export async function getOrg(ctx: AuthCtx, orgId: string): Promise<OrgRow> {
  await assertTenantAccess(ctx, orgId);
  const admin = await getAdmin();
  const { data, error } = await admin.from("organizations").select("*").eq("id", orgId).single();
  if (error || !data) throw new Error("Organization not found");
  return data as OrgRow;
}

/** Every org the user can see (self + all descendants). */
export async function visibleOrgIds(ctx: AuthCtx): Promise<string[]> {
  const admin = await getAdmin();
  const { data: adminFlag } = await admin.rpc("is_admin", { _user_id: ctx.userId });
  if (adminFlag) {
    const { data } = await admin.from("organizations").select("id");
    return (data ?? []).map((r: { id: string }) => r.id);
  }
  const seeds = await myOrgIds(ctx);
  if (seeds.length === 0) return [];
  // BFS downward through parent_id
  const seen = new Set<string>(seeds);
  let frontier = seeds;
  while (frontier.length > 0) {
    const { data } = await admin.from("organizations").select("id").in("parent_id", frontier);
    const next = ((data ?? []) as Array<{ id: string }>).map((r) => r.id).filter((id) => !seen.has(id));
    next.forEach((id) => seen.add(id));
    frontier = next;
  }
  return Array.from(seen);
}

export const PLATFORM_ORG_ID = "00000000-0000-0000-0000-000000000001";
