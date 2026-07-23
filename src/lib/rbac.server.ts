/**
 * Server-side RBAC helpers. Every mutating server fn must call `assertRole`
 * (or a specific `assert*`) before performing privileged work.
 */
import type { AppRole, Capabilities } from "./auth-utils";
import { capabilitiesFor } from "./auth-utils";

export interface AuthCtx {
  supabase: any;
  userId: string;
}

export async function getRoles(ctx: AuthCtx): Promise<AppRole[]> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error("Forbidden");
  return (data ?? []).map((r: { role: AppRole }) => r.role);
}

export async function getCapabilities(ctx: AuthCtx): Promise<{ roles: AppRole[]; caps: Capabilities }> {
  const roles = await getRoles(ctx);
  return { roles, caps: capabilitiesFor(roles) };
}

export async function assertRole(ctx: AuthCtx, allowed: AppRole[]): Promise<AppRole[]> {
  const roles = await getRoles(ctx);
  if (!roles.some((r) => allowed.includes(r))) throw new Error("Forbidden");
  return roles;
}

export async function assertCapability<K extends keyof Capabilities>(
  ctx: AuthCtx,
  cap: K,
): Promise<{ roles: AppRole[]; caps: Capabilities }> {
  const { roles, caps } = await getCapabilities(ctx);
  if (!caps[cap]) throw new Error("Forbidden");
  return { roles, caps };
}
