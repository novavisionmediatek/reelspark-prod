# PhonePe Payment Gateway Integration

PhonePe (Standard Checkout v2, OAuth) is the **only** registration-payment gateway in this project. The manual UPI-QR flow and an earlier, never-finished Razorpay attempt have both been removed.

## Architecture

All PhonePe API calls — OAuth token exchange, Create Payment, Order Status — happen **server-side**, inside three Supabase Edge Functions. The mobile app never sees a PhonePe secret and can never mark its own payment approved.

```
apps/mobile (client)                Supabase Edge Functions               PhonePe API
─────────────────────               ──────────────────────                ───────────
PaymentScreen
  → useInitiatePhonePePayment  ──►  phonepe-initiate
                                       - re-reads registration_fee_inr
                                         from app_settings (never trusts
                                         a client-supplied amount)
                                       - OAuth token                  ──►  POST .../v1/oauth/token
                                       - Create Payment               ──►  POST .../checkout/v2/pay
                                         (redirectUrl = the app's root —
                                         deliberately not a special path;
                                         see note below)
                                       - start_phonepe_payment RPC
                                         (service_role only, status='initiated')
                                     ◄── { merchantOrderId, redirectUrl }
  ← window.location.href = redirectUrl

  (browser completes payment on PhonePe's hosted checkout page,
   then lands back on the app's root — any page load works)

PaymentScreen (still 'initiated')
  → useCheckPhonePeStatus     ──►  phonepe-status
      (polls every 3s, keyed          - Order Status                  ──►  GET .../checkout/v2/order/{id}/status
      by the user's own row,          - on COMPLETED/FAILED, calls
      not a URL param)                  approve_phonepe_payment /
                                         reject_phonepe_payment RPC
                                         (service_role only)
                                     ◄── { status: pending|approved|rejected }

                                     phonepe-callback (webhook, verify_jwt=false)
                                       - PhonePe POSTs here directly on
                                         a terminal order state
                                       - validates Authorization header
                                         (SHA256 of callback username:password)
                                       - same approve/reject RPCs
                                       — a second, independent path to the
                                         same result
```

**Why the redirect goes to the app's root, not a dedicated `/payment-callback` path:** a special path only resolves if the host's SPA rewrite rules *and* a client-side router config both work correctly, and that combination silently failed in the first version of this integration — the payment sat at `initiated` forever because nothing ever polled PhonePe to check. Landing on the root and having `PaymentScreen` itself poll `phonepe-status` (keyed off the logged-in user's own `registration_payments` row, not a URL parameter) needs no routing configuration at all and works no matter how the user's browser gets back into the app.

The `approve_phonepe_payment` / `reject_phonepe_payment` / `start_phonepe_payment` RPCs are `SECURITY DEFINER` but granted **only to `service_role`** — not `authenticated`. A logged-in user cannot call them directly to self-approve. (This was a real hole in the first PhonePe attempt: `verify_phonepe_payment` was grantable to `authenticated` and simply marked the payment approved on request.)

The admin **Payments** page still has `approve_registration_payment` / `reject_registration_payment` (unchanged, from `0006`) as a manual override for a payment stuck in `initiated` — but nothing in the normal flow requires an admin to look at it.

## Prerequisites

1. **PhonePe Business account** with **Standard Checkout v2** credentials: `client_id`, `client_secret`, `client_version` (from the PhonePe Business dashboard's developer settings — this project uses the OAuth-based v2 API, not the older salt-key v1 API).
2. A **callback username/password** configured in the PhonePe dashboard for webhook authentication (separate from the client credentials).
3. Supabase CLI linked to this project (`supabase link`).

## Configuration — Edge Function secrets only

Nothing PhonePe-related belongs in `apps/mobile/.env`. Set these as Supabase Edge Function secrets instead:

```bash
supabase secrets set \
  PHONEPE_CLIENT_ID=your-client-id \
  PHONEPE_CLIENT_SECRET=your-client-secret \
  PHONEPE_CLIENT_VERSION=1 \
  PHONEPE_ENV=sandbox \
  PHONEPE_CALLBACK_USERNAME=your-callback-username \
  PHONEPE_CALLBACK_PASSWORD=your-callback-password
```

Set `PHONEPE_ENV=prod` when you switch to production credentials. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge Function automatically.

## Apply the database migration

```bash
supabase db push
```

This runs `supabase/migrations/0013_phonepe_only_payments.sql`, which drops the old UPI/Razorpay columns and RPCs and adds the PhonePe-only schema (`merchant_order_id`, `phonepe_order_id`, `start_phonepe_payment`, `approve_phonepe_payment`, `reject_phonepe_payment`).

## Deploy the Edge Functions

```bash
supabase functions deploy phonepe-initiate
supabase functions deploy phonepe-status
supabase functions deploy phonepe-callback
```

`supabase/config.toml` sets `verify_jwt = false` for `phonepe-callback` only — PhonePe's webhook carries no Supabase session, but `phonepe-initiate`/`phonepe-status` still require the caller's auth token.

## Configure the PhonePe webhook

In the PhonePe Business dashboard, set the webhook URL to:

```
https://<your-project-ref>.functions.supabase.co/phonepe-callback
```

and configure the callback username/password to match what you set in `supabase secrets set` above.

## Testing (sandbox)

1. Confirm `PHONEPE_ENV=sandbox` in your Edge Function secrets.
2. Open the Payment screen, enter a phone number, tap "Pay with PhonePe".
3. Complete the payment on PhonePe's sandbox checkout page.
4. You should land back on `/payment-callback`, see "Verifying your payment…" then "Payment successful!", and the profile should flip to `approved`.
5. Check the `registration_payments` row: `status = 'approved'`, `phonepe_order_id` populated.

## Troubleshooting

- **"Could not read registration fee"** — `app_settings` row missing; check the `0001`/`0006` migrations ran.
- **PhonePe OAuth/pay/status call fails** — check the Edge Function logs (`supabase functions logs phonepe-initiate` / `phonepe-status`) for the exact PhonePe error body; usually a wrong `client_id`/`client_secret`/`client_version` or sandbox-vs-prod mismatch.
- **Webhook returns 401** — the configured callback username/password in the PhonePe dashboard doesn't match the `PHONEPE_CALLBACK_USERNAME`/`PHONEPE_CALLBACK_PASSWORD` secrets.
- **Payment completes on PhonePe but the app never shows "approved"** — the browser may not have made it back to `/payment-callback` (closed tab, etc.); the `phonepe-callback` webhook should still approve it independently. Check `registration_payments.status` directly.

## References

- [PhonePe Developer Documentation](https://developer.phonepe.com)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
