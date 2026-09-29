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
const STATUS_URL = {
  sandbox: (orderId: string) =>
    `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${orderId}/status`,
  prod: (orderId: string) =>
    `https://api.phonepe.com/apis/pg/checkout/v2/order/${orderId}/status`,
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

    const { merchantOrderId } = await req.json()
    if (!merchantOrderId || typeof merchantOrderId !== "string") {
      return new Response(JSON.stringify({ error: "Missing merchantOrderId." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: payment, error: paymentError } = await adminClient
      .from("registration_payments")
      .select("id, user_id, status")
      .eq("merchant_order_id", merchantOrderId)
      .single()

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found." }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
    if (payment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden." }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Already terminal — no need to hit PhonePe again.
    if (payment.status === "approved" || payment.status === "rejected") {
      return new Response(JSON.stringify({ status: payment.status }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const accessToken = await getAccessToken()
    const statusResponse = await fetch(STATUS_URL[PHONEPE_ENV](merchantOrderId), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
    })

    if (!statusResponse.ok) {
      throw new Error(`PhonePe status API error: ${statusResponse.status} ${await statusResponse.text()}`)
    }

    const statusResult = (await statusResponse.json()) as { orderId: string; state: string }

    if (statusResult.state === "COMPLETED") {
      const { error: rpcError } = await adminClient.rpc("approve_phonepe_payment", {
        p_merchant_order_id: merchantOrderId,
        p_phonepe_order_id: statusResult.orderId,
      })
      if (rpcError) throw rpcError
      return new Response(JSON.stringify({ status: "approved" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    if (statusResult.state === "FAILED") {
      const { error: rpcError } = await adminClient.rpc("reject_phonepe_payment", {
        p_merchant_order_id: merchantOrderId,
      })
      if (rpcError) throw rpcError
      return new Response(JSON.stringify({ status: "rejected" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("phonepe-status error:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
