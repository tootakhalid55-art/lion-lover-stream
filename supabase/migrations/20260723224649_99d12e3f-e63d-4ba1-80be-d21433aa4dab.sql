
-- Restrict sensitive credential columns to admins only
DROP POLICY IF EXISTS gateway_configs_read ON public.payment_gateway_configs;
CREATE POLICY gateway_configs_read ON public.payment_gateway_configs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS wh_ep_read ON public.webhook_endpoints;
CREATE POLICY wh_ep_read ON public.webhook_endpoints
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS api_keys_read ON public.api_keys;
CREATE POLICY api_keys_read ON public.api_keys
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Reduce SECURITY DEFINER function attack surface: revoke EXECUTE from
-- anon/authenticated on functions only used by service_role code paths.
REVOKE EXECUTE ON FUNCTION public.next_doc_number(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_billing_lock(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.org_wallet_balances(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Revoke anon EXECUTE on RLS helpers (they only need to be callable by authenticated).
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_org_read(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.org_ancestors(uuid) FROM PUBLIC, anon;
