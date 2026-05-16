import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ICON_WHITELIST = new Set([
  'instagram', 'whatsapp', 'facebook', 'tiktok', 'youtube',
  'map', 'web', 'phone', 'mail', 'link',
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { org_slug, debug } = body || {};
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

    const [sucursalesRes, barberosRes, serviciosRes, portalRes] = await Promise.all([
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
        .from("servicios_sucursales")
        .select("sucursal_id, precio, activo, servicio:servicios!inner(id, nombre, duracion_min, eliminado)")
        .eq("organization_id", org.id)
        .eq("activo", true)
        .gt("precio", 0)
        .not("sucursal_id", "is", null)
        .or("eliminado.is.null,eliminado.eq.false", { foreignTable: "servicios" }),
      supabase
        .from("portal_config")
        .select("logo_path, cover_path, cover_position_x, cover_position_y, cover_zoom, description, primary_color, links")
        .eq("organization_id", org.id)
        .maybeSingle(),
    ]);

    const clampPos = (n: any): number => {
      const v = typeof n === 'number' ? n : Number(n);
      if (!Number.isFinite(v)) return 50;
      return Math.max(0, Math.min(100, Math.round(v)));
    };
    const clampZoom = (n: any): number => {
      const v = typeof n === 'number' ? n : Number(n);
      if (!Number.isFinite(v)) return 1;
      return Math.max(1, Math.min(3, v));
    };

    let portal: {
      logo_url: string | null;
      cover_url: string | null;
      cover_position_x: number;
      cover_position_y: number;
      cover_zoom: number;
      description: string | null;
      primary_color: string | null;
      links: { label: string; url: string; icon: string | null }[];
    } | null = null;

    const pc: any = portalRes.data;
    if (pc) {
      let logo_url: string | null = null;
      if (pc.logo_path) {
        const { data: pub } = supabase.storage.from("portal-logos").getPublicUrl(pc.logo_path);
        logo_url = pub?.publicUrl ?? null;
      }
      let cover_url: string | null = null;
      if (pc.cover_path) {
        const { data: pub } = supabase.storage.from("portal-logos").getPublicUrl(pc.cover_path);
        cover_url = pub?.publicUrl ?? null;
      }
      const rawLinks = Array.isArray(pc.links) ? pc.links : [];
      const links = rawLinks
        .filter((l: any) => l && l.active === true && typeof l.label === "string" && typeof l.url === "string")
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((l: any) => ({
          label: l.label,
          url: l.url,
          icon: typeof l.icon === 'string' && ICON_WHITELIST.has(l.icon) ? l.icon : null,
        }));

      portal = {
        logo_url: logo_url ?? org.logo_url ?? null,
        cover_url,
        cover_position_x: clampPos(pc.cover_position_x ?? 50),
        cover_position_y: clampPos(pc.cover_position_y ?? 50),
        cover_zoom: clampZoom(pc.cover_zoom ?? 1),
        description: pc.description ?? null,
        primary_color: typeof pc.primary_color === "string" && /^#[0-9A-Fa-f]{6}$/.test(pc.primary_color)
          ? pc.primary_color
          : null,
        links,
      };
    } else {
      portal = {
        logo_url: org.logo_url ?? null,
        cover_url: null,
        cover_position_x: 50,
        cover_position_y: 50,
        cover_zoom: 1,
        description: null,
        primary_color: null,
        links: [],
      };
    }

    const rawRows = (serviciosRes.data || []).filter((r: any) => r && r.servicio);
    const servicios = rawRows.map((r: any) => ({
      id: r.servicio.id,
      nombre: r.servicio.nombre,
      precio: r.precio,
      duracion_min: r.servicio.duracion_min,
      sucursal_id: r.sucursal_id,
    }));
    const sucursalesConServicios = new Set(rawRows.map((r: any) => r.sucursal_id));
    const sucursalesActivas = sucursalesRes.data || [];
    const sucursales = sucursalesActivas.filter((s: any) => sucursalesConServicios.has(s.id));
    const barberos = (barberosRes.data || []).filter((b: any) => sucursalesConServicios.has(b.sucursal_id));

    const responseBody: Record<string, unknown> = {
      organization: { id: org.id, name: org.name, logo_url: org.logo_url },
      sucursales,
      barberos,
      servicios,
      portal,
    };

    if (debug === true) {
      responseBody.debug = {
        sucursales_activas_count: sucursalesActivas.length,
        sucursales_activas: sucursalesActivas.map((s: any) => ({ id: s.id, nombre: s.nombre })),
        servicios_reservables_count: rawServicios.length,
        servicios_considerados: rawServicios.map((s: any) => ({
          id: s.id, nombre: s.nombre, sucursal_id: s.sucursal_id,
          activo: s.activo, precio: s.precio, eliminado: s.eliminado,
        })),
        sucursales_reservables_ids: Array.from(sucursalesConServicios),
        sucursales_devueltas_count: sucursales.length,
      };
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
