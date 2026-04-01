import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { org_slug } = await req.json();
    if (!org_slug || typeof org_slug !== "string") {
      return new Response(JSON.stringify({ error: "org_slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get org
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, logo_url")
      .eq("slug", org_slug)
      .eq("is_active", true)
      .single();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sucursales, barberos, servicios in parallel
    const [sucursalesRes, barberosRes, serviciosRes] = await Promise.all([
      supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("organization_id", org.id)
        .eq("activa", true),
      supabase
        .from("barberos")
        .select("id, nombre, apellido, sucursal_id")
        .eq("organization_id", org.id)
        .eq("activo", true)
        .eq("rol_equipo", "barbero")
        .not("sucursal_id", "is", null),
      supabase
        .from("servicios")
        .select("id, nombre, precio, duracion_min, sucursal_id")
        .eq("organization_id", org.id)
        .eq("activo", true),
    ]);

    return new Response(
      JSON.stringify({
        organization: { id: org.id, name: org.name, logo_url: org.logo_url },
        sucursales: sucursalesRes.data || [],
        barberos: barberosRes.data || [],
        servicios: serviciosRes.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
