import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendFcmMessage } from "../_shared/fcm-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPushRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Constant-time string comparison to avoid leaking the secret via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only the service_role key may invoke this function — no user-session auth.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const providedKey = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

  if (!serviceRoleKey || !timingSafeEqual(providedKey, serviceRoleKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { userId, title, body, data }: SendPushRequest = await req.json();

    if (!userId || !title || !body) {
      throw new Error("Missing required fields");
    }

    const { data: tokenRows, error: tokensError } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (tokensError) {
      console.error("Error fetching push tokens:", tokensError);
      throw new Error("Error fetching push tokens");
    }

    const tokens = (tokenRows ?? []).map((row: { token: string }) => row.token);

    let sent = 0;
    let failed = 0;

    for (const fcmToken of tokens) {
      try {
        const result = await sendFcmMessage(fcmToken, title, body, data);
        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error("[send-push-notification] envío fallido:", result.error);
        }
      } catch (err) {
        failed++;
        console.error("[send-push-notification] error inesperado al enviar:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalTokens: tokens.length,
        sent,
        failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-push-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
