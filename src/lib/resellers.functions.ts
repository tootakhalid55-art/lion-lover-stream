/**
 * Reseller organization management — CRUD, hierarchy tree, member roles,
 * and hierarchy-move with preserved history.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { assertTenantAccess, orgAncestors, visibleOrgIds, type OrgRow } from "./tenancy.server";
import { writeAudit } from "./audit.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "org";
}

export const listOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const ids = await visibleOrgIds(context);
    if (ids.length === 0) return { orgs: [] as OrgRow[] };
    const { data } = await admin.from("organizations").select("*").in("id", ids).order("created_at", { ascending: false });
    return { orgs: (data ?? []) as OrgRow[] };
  });

export const resellerTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rootOrgId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    if (data.rootOrgId) await assertTenantAccess(context, data.rootOrgId);
    const ids = await visibleOrgIds(context);
    if (ids.length === 0) return { orgs: [], profiles: [] };
    const [{ data: orgs }, { data: profiles }] = await Promise.all([
      admin.from("organizations").select("*").in("id", ids),
      admin.from("reseller_profiles").select("*").in("org_id", ids),
    ]);
    return { orgs: orgs ?? [], profiles: profiles ?? [] };
  });

export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string;
    parentId: string;
    type: OrgRow["type"];
    country?: string | null;
    currency?: string;
    territory?: string | null;
    creditLimitCents?: number;
    priceLevel?: string;
    company?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageResellers");
    await assertTenantAccess(context, data.parentId);
    const admin = await getAdmin();
    const slug = `${slugify(data.name)}-${Date.now().toString(36)}`;
    const { data: org, error } = await admin
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        type: data.type,
        parent_id: data.parentId,
        currency: data.currency ?? "USD",
        country: data.country ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    if (data.type !== "customer") {
      await admin.from("reseller_profiles").insert({
        org_id: org!.id,
        company: data.company ?? null,
        contact_name: data.contactName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        territory: data.territory ?? null,
        credit_limit_cents: Math.round(data.creditLimitCents ?? 0),
        price_level: data.priceLevel ?? "standard",
      });
    }
    await writeAudit({ actorId: context.userId, action: "org.create", after: org });
    return { org };
  });

export const updateOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    name?: string;
    status?: OrgRow["status"];
    currency?: string;
    country?: string | null;
    profile?: {
      territory?: string | null;
      creditLimitCents?: number;
      priceLevel?: string;
      commissionModel?: Record<string, unknown>;
      taxProfile?: Record<string, unknown>;
      notes?: string | null;
    };
  }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageResellers");
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.status !== undefined) patch.status = data.status;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.country !== undefined) patch.country = data.country;
    const { data: before } = await admin.from("organizations").select("*").eq("id", data.orgId).single();
    const { data: after, error } = await admin.from("organizations").update(patch).eq("id", data.orgId).select("*").single();
    if (error) throw error;
    if (data.profile) {
      const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.profile.territory !== undefined) p.territory = data.profile.territory;
      if (data.profile.creditLimitCents !== undefined) p.credit_limit_cents = Math.round(data.profile.creditLimitCents);
      if (data.profile.priceLevel !== undefined) p.price_level = data.profile.priceLevel;
      if (data.profile.commissionModel !== undefined) p.commission_model = data.profile.commissionModel;
      if (data.profile.taxProfile !== undefined) p.tax_profile = data.profile.taxProfile;
      if (data.profile.notes !== undefined) p.notes = data.profile.notes;
      await admin.from("reseller_profiles").update(p).eq("org_id", data.orgId);
    }
    await writeAudit({ actorId: context.userId, action: "org.update", before, after, targetUserId: null });
    return { org: after };
  });

export const moveOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; newParentId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageResellers");
    await assertTenantAccess(context, data.orgId);
    await assertTenantAccess(context, data.newParentId);
    if (data.orgId === data.newParentId) throw new Error("Cannot move org into itself");
    // Prevent creating a cycle: newParent must not be a descendant of orgId
    const newParentAncestors = await orgAncestors(data.newParentId);
    if (newParentAncestors.includes(data.orgId)) throw new Error("Cannot move org under its own descendant");
    const admin = await getAdmin();
    const { data: current } = await admin.from("organizations").select("parent_id").eq("id", data.orgId).single();
    await admin.from("organizations").update({ parent_id: data.newParentId, updated_at: new Date().toISOString() }).eq("id", data.orgId);
    await admin.from("org_move_history").insert({
      org_id: data.orgId,
      from_parent_id: current?.parent_id ?? null,
      to_parent_id: data.newParentId,
      reason: data.reason ?? null,
      actor_id: context.userId,
    });
    await writeAudit({
      actorId: context.userId,
      action: "org.move",
      before: { parent_id: current?.parent_id },
      after: { parent_id: data.newParentId, reason: data.reason ?? null },
    });
    return { ok: true };
  });

export const addOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; userId: string; role: "owner" | "admin" | "billing" | "support" | "viewer" }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageResellers");
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    const { error } = await admin.from("org_members").upsert(
      { org_id: data.orgId, user_id: data.userId, role: data.role },
      { onConflict: "org_id,user_id" },
    );
    if (error) throw error;
    await writeAudit({ actorId: context.userId, action: "org.member.add", after: data });
    return { ok: true };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; userId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageResellers");
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    await admin.from("org_members").delete().eq("org_id", data.orgId).eq("user_id", data.userId);
    await writeAudit({ actorId: context.userId, action: "org.member.remove", after: data });
    return { ok: true };
  });
