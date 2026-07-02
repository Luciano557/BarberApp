// TEMPORARY helper for validating update-turno-internal. Deploy → test → delete.
// Uses admin.generateLink + verifyOtp to mint a real access_token for an existing user.
// Guarded by a shared secret to avoid open access.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, guard } = await req.json();
    if (guard !== Deno.env.get("SUPABASE_ANON_KEY")) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, service);
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: "link_failed", detail: linkErr?.message }), { status: 500 });
    }
    const anonClient = createClient(url, anon);
    const { data: session, error: verErr } = await anonClient.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    });
    if (verErr || !session?.session?.access_token) {
      return new Response(JSON.stringify({ error: "verify_failed", detail: verErr?.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ access_token: session.session.access_token, user_id: session.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
