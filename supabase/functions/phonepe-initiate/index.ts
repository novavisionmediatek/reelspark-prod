import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PHONEPE_CLIENT_ID = Deno.env.get("PHONEPE_CLIENT_ID") || ""
const PHONEPE_CLIENT_SECRET = Deno.env.get("PHONEPE_CLIENT_SECRET") || ""
const PHONEPE_CLIENT_VERSION = Deno.env.get("PHONEPE_CLIENT_VERSION") || "1"
const PHONEPE_ENV = Deno.env.get("PHONEPE_ENV") === "prod" ? "prod" : "sandbox"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const OAUTH_URL = {
  sandbox: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
  prod: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
}
const PAY_URL = {
  sandbox: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
  prod: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: PHONEPE_CLIENT_ID,
    client_version: PHONEPE_CLIENT_VERSION,
    client_secret: PHONEPE_CLIENT_SECRET,
    grant_type: "client_credentials",
  })

  const response = await fetch(OAUTH_URL[PHONEPE_ENV], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`PhonePe OAuth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

function generateMerchantOrderId(userId: string): string {
  return `REEL_${userId.replace(/-/g, "").slice(0, 16)}_${Date.now()}`
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const { userPhone, redirectBaseUrl } = await req.json()
    if (!userPhone || typeof userPhone !== "string") {
      return new Response(JSON.stringify({ error: "A phone number is required." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
    if (!redirectBaseUrl || typeof redirectBaseUrl !== "string") {
      return new Response(JSON.stringify({ error: "Missing redirect base URL." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Never trust a client-supplied amount — always re-read the current fee.
    const { data: settings, error: settingsError } = await adminClient
      .from("app_settings")
      .select("registration_fee_inr")
      .eq("id", true)
      .single()
    if (settingsError || !settings) {
      throw new Error("Could not read registration fee.")
    }
    const amountInr = settings.registration_fee_inr as number

    // Reject a reused phone number before ever calling PhonePe, so no live
    // order gets created for an attempt that's going to be refused anyway.
    const { data: phoneAvailable, error: phoneCheckError } = await adminClient.rpc("check_phone_available", {
      p_phone_number: userPhone,
      p_user_id: user.id,
    })
    if (phoneCheckError) throw phoneCheckError
    if (!phoneAvailable) {
      return new Response(
        JSON.stringify({ error: "This phone number is already registered with another account." }),
        { status: 409, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const merchantOrderId = generateMerchantOrderId(user.id)
    const accessToken = await getAccessToken()

    const payResponse = await fetch(PAY_URL[PHONEPE_ENV], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        merchantOrderId,
        amount: amountInr * 100,
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "ReelSpark registration fee",
          merchantUrls: {
            // Land back on the app's root, not a special path — the Payment
            // screen looks up the current user's own payment row from the
            // database and confirms it directly, so no dedicated
            // callback route or URL routing config is needed at all.
            redirectUrl: redirectBaseUrl,
          },
        },
        metaInfo: { udf1: userPhone },
      }),
    })

    if (!payResponse.ok) {
      throw new Error(`PhonePe pay API error: ${payResponse.status} ${await payResponse.text()}`)
    }

    const payResult = (await payResponse.json()) as { orderId: string; redirectUrl: string }

    const { error: rpcError } = await adminClient.rpc("start_phonepe_payment", {
      p_user_id: user.id,
      p_amount_inr: amountInr,
      p_merchant_order_id: merchantOrderId,
      p_phone_number: userPhone,
    })
    if (rpcError) {
      const message = rpcError.message?.includes("already registered")
        ? "This phone number is already registered with another account."
        : rpcError.message
      return new Response(JSON.stringify({ error: message }), {
        status: rpcError.message?.includes("already registered") ? 409 : 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({ merchantOrderId, redirectUrl: payResult.redirectUrl }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("phonepe-initiate error:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
