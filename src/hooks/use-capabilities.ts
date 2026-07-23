import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { myCapabilities } from "@/lib/devices.functions";
import type { Capabilities } from "@/lib/auth-utils";

const EMPTY: Capabilities = {
  canManageUsers: false, canDeleteUsers: false, canManageLicenses: false, canManagePackages: false,
  canManageDevices: false, canManageSessions: false, canBulk: false, canExport: false,
  canViewSecurity: false, canViewAudit: false, canManageSystem: false, canBroadcast: false,
  canManageRoles: false, canManageResellers: false, canManageBilling: false, canManageApiKeys: false,
  canManageWebhooks: false, canViewFinance: false, canImpersonateCustomer: false, readOnly: false,
};

export function useCapabilities(): Capabilities {
  const fn = useServerFn(myCapabilities);
  const q = useQuery({ queryKey: ["me", "caps"], queryFn: () => fn(), staleTime: 60_000 });
  return q.data?.caps ?? EMPTY;
}
