import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPlatformAdminContext, getRequestId, isPlatformAdminIdentity, jsonResponse, platformAdminCorsHeaders } from '../_shared/platform-admin.ts';
import { createCommercialHandler } from '../_shared/admin-organization-handler.ts';
import { commercialError, commercialAuditOutcome } from '../_shared/admin-organization-domain.ts';

const handler = createCommercialHandler({
  enabled: () => Deno.env.get('PLATFORM_ADMIN_ORG_MUTATIONS_ENABLED') === 'true',
  requestId: getRequestId,
  reply: (req, body, status, requestId) => status === 204
    ? new Response(null, { status, headers: platformAdminCorsHeaders(req) })
    : jsonResponse(req, body, status, requestId),
  authorize: async (req, requestId) => {
    const auth = await getPlatformAdminContext(req, requestId);
    if (auth.error) return auth.error;
    const { context, supabaseAdmin } = auth;
    return {
      reauthenticate: async (password) => {
        const verifier = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data, error } = await verifier.auth.signInWithPassword({ email: context!.email, password });
        const verified = !error && data.user?.id === context!.userId && isPlatformAdminIdentity(data.user);
        if (data.session) await verifier.auth.signOut({ scope: 'local' });
        return verified;
      },
      mutate: async (input, operationRequestId) => {
        const { data, error } = await supabaseAdmin!.rpc('platform_admin_manage_organization', {
          _organization_id: input.organizationId, _actor_user_id: context!.userId,
          _request_id: operationRequestId, _action: input.action, _changes: input.changes,
          _reason: input.reason, _expected_organization_updated_at: input.expectedOrganizationUpdatedAt,
          _expected_subscription_updated_at: input.expectedSubscriptionUpdatedAt,
        });
        if (error) throw commercialError(error.message);
        // A terminal failure receipt is committed after rolling back business writes.
        // Translate only the allowed code; never return the raw database response.
        if (data?.status === 'failed') throw commercialError(data.code);
        return data;
      },
      status: async (organizationId, operationRequestId) => {
        const { data, error } = await supabaseAdmin!.from('platform_admin_audit_log')
          .select('action,result_status,result_detail,created_at').eq('request_id', operationRequestId)
          .eq('actor_user_id', context!.userId)
          .eq('target_type', 'organization').eq('target_id', organizationId)
          .in('action', ['organization.details_updated', 'organization.manual_plan_assigned', 'organization.trial_extended', 'organization.trial_end_changed'])
          .maybeSingle();
        if (error) throw commercialError('COMMERCIAL_MUTATION_FAILED');
        return { organizationId, requestId: operationRequestId,
          ...commercialAuditOutcome(data),
          action: data?.action ?? null, completedAt: data?.created_at ?? null };
      },
    };
  },
});
serve(handler);
