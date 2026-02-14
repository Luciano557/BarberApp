import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST method allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();

    // Support single or array of gastos
    const items: any[] = Array.isArray(body) ? body : [body];

    const errors: string[] = [];
    const toInsert: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.organization_id) {
        errors.push(`Item ${i}: falta organization_id`);
        continue;
      }
      if (!item.monto || typeof item.monto !== "number") {
        errors.push(`Item ${i}: monto es requerido y debe ser un número`);
        continue;
      }

      toInsert.push({
        Categoria: item.categoria || "Otros",
        Monto: item.monto,
        Descripcion: item.descripcion || null,
        Fecha: item.fecha || new Date().toISOString(),
        organization_id: item.organization_id,
      });
    }

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid items to insert", details: errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase.from("Egresos").insert(toInsert).select();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Error inserting", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: data.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body", details: String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
