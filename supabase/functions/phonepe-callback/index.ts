import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PHONEPE_CALLBACK_USERNAME = Deno.env.get("PHONEPE_CALLBACK_USERNAME") || ""
const PHONEPE_CALLBACK_PASSWORD = Deno.env.get("PHONEPE_CALLBACK_PASSWORD") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// PhonePe signs webhooks as Authorization: SHA256("<username>:<password>"),
// using the username/password configured in the PhonePe dashboard (not the
// API client_id/client_secret).
async function isValidAuthorization(header: string): Promise<boolean> {
  const expected = await sha256Hex(`${PHONEPE_CALLBACK_USERNAME}:${PHONEPE_CALLBACK_PASSWORD}`)
  return header === expected
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const authHeader = req.headers.get("authorization") || ""
    if (!(await isValidAuthorization(authHeader))) {
      console.error("PhonePe webhook: invalid Authorization header")
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = JSON.parse(await req.text())
    const event = body.event as string | undefined
    const payload = body.payload || {}
    const merchantOrderId = payload.merchantOrderId as string | undefined
    const phonepeOrderId = payload.orderId as string | undefined

    if (!merchantOrderId) {
      return new Response(JSON.stringify({ error: "Missing merchantOrderId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (event === "checkout.order.completed" || payload.state === "COMPLETED") {
      const { error } = await adminClient.rpc("approve_phonepe_payment", {
        p_merchant_order_id: merchantOrderId,
        p_phonepe_order_id: phonepeOrderId || null,
      })
      if (error) throw error
    } else if (event === "checkout.order.failed" || payload.state === "FAILED") {
      const { error } = await adminClient.rpc("reject_phonepe_payment", {
        p_merchant_order_id: merchantOrderId,
      })
      if (error) throw error
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("PhonePe callback error:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
