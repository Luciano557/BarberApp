import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type BillingPlanCode = 'basico' | 'profesional' | 'premium';

export interface BillingContext {
  userId: string;
  userEmail: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  roles: string[];
}

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return value === 'basico' || value === 'profesional' || value === 'premium';
}

export function appOrigin(req: Request): string {
  return (
    Deno.env.get('APP_ORIGIN') ||
    req.headers.get('origin') ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

export function sanitizeExternalReference(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 250);
}

export async function getBillingContext(req: Request): Promise<{
  supabaseAdmin: ReturnType<typeof createAdminClient>;
  context: BillingContext;
  error?: Response;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      supabaseAdmin: createAdminClient(),
      context: null as never,
      error: jsonError('Unauthorized', 401),
    };
  }

  const supabaseAdmin = createAdminClient();
  const supabaseUser = createUserClient(authHeader);

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return { supabaseAdmin, context: null as never, error: jsonError('Unauthorized', 401) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return { supabaseAdmin, context: null as never, error: jsonError('No organization', 400) };
  }

  const orgId = profile.organization_id as string;

  const [{ data: org }, { data: roleRows }] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id),
  ]);

  if (!org) {
    return { supabaseAdmin, context: null as never, error: jsonError('Organization not found', 404) };
  }

  const roles = ((roleRows ?? []) as Array<{ role: string }>).map((row) => row.role);
  const canManageBilling = roles.includes('owner') || roles.includes('general_manager');

  if (!canManageBilling) {
    return { supabaseAdmin, context: null as never, error: jsonError('Forbidden', 403) };
  }

  return {
    supabaseAdmin,
    context: {
      userId: user.id,
      userEmail: user.email ?? '',
      organizationId: orgId,
      organizationSlug: org.slug as string,
      organizationName: org.name as string,
      roles,
    },
  };
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
  });
}
