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
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const apellido = typeof body.apellido === "string" ? body.apellido.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phone_country = typeof body.phone_country === "string" ? body.phone_country.trim() : "";
    const birth_date = typeof body.birth_date === "string" ? body.birth_date.trim() : "";

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "invalid_password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!nombre || !apellido) {
      return new Response(JSON.stringify({ error: "invalid_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!birth_date) {
      return new Response(JSON.stringify({ error: "invalid_birth_date" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fullName = `${nombre} ${apellido}`.trim();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        account_type: "customer",
        nombre,
        apellido,
        full_name: fullName,
        phone,
        phone_country,
        birth_date,
      },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("user already") ||
        msg.includes("duplicate") ||
        (error as any).status === 422
      ) {
        return new Response(JSON.stringify({ error: "email_exists" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("register-customer createUser error:", error);
      return new Response(JSON.stringify({ error: "create_failed", message: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: data.user?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("register-customer error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
