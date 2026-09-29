# PhonePe Integration — Implementation Summary

PhonePe (Standard Checkout v2, OAuth) is the sole registration-payment gateway. The manual UPI-QR flow and the earlier, never-finished Razorpay scaffolding have both been removed — see `supabase/migrations/0013_phonepe_only_payments.sql`.

See `PHONEPE_SETUP.md` for the full setup guide and architecture diagram. This file is a quick file-by-file reference.

## Why it was rebuilt

An earlier version of this integration called PhonePe's API directly from the client with `client_secret` in a `VITE_*` env var (shipping the secret to every browser), and had a `verify_phonepe_payment` RPC grantable to `authenticated` that any logged-in user could call to self-approve their own payment without paying. Both are fixed by moving every PhonePe API call and every approve/reject RPC server-side.

## Files

### Mobile app (`apps/mobile/src`)
- `lib/phonepe.ts` — thin wrappers around `supabase.functions.invoke('phonepe-initiate' | 'phonepe-status')`. No PhonePe secrets here.
- `hooks/usePhonePePayment.ts` — `useInitiatePhonePePayment`, `useCheckPhonePeStatus` (polls every 3s while pending).
- `hooks/useRegistrationPayment.ts` — reads the current `registration_payments` row, polling while `initiated`.
- `screens/PaymentScreen.tsx` — PhonePe phone-number form (the only payment method). While the current payment row is `initiated`, this same screen also polls `phonepe-status` directly — see note below.

There is deliberately **no** dedicated callback screen or route. An earlier version redirected to `/payment-callback?order_id=...` and relied on a React Navigation `linking` config to route there — that combination depends on the host's SPA rewrite rules working, which silently failed and left payments stuck at `initiated` forever (nothing ever polled PhonePe). Now `phonepe-initiate` sets the redirect URL to just the app's root, and `PaymentScreen` confirms the payment itself by polling `phonepe-status` for the logged-in user's own `registration_payments` row — no URL parameter or special route needed, so it works regardless of how the browser lands back in the app.

### Supabase Edge Functions (`supabase/functions`)
- `phonepe-initiate` — authenticates the user, re-reads the fee from `app_settings` server-side, gets an OAuth token, calls PhonePe Create Payment (redirect URL = the app's root), writes the `initiated` row via `start_phonepe_payment` (service role), returns the redirect URL.
- `phonepe-status` — authenticates the user, checks PhonePe Order Status, calls `approve_phonepe_payment`/`reject_phonepe_payment` (service role) on a terminal state. This is what `PaymentScreen` polls while `initiated`.
- `phonepe-callback` — PhonePe's webhook. Validates the `Authorization` header (`SHA256(callback_username:callback_password)`), calls the same approve/reject RPCs. A second, independent path to the same result, in case the user never reopens the app after paying.

### Database (`supabase/migrations/0013_phonepe_only_payments.sql`)
- Drops `app_settings.upi_id`/`upi_payee_name` and `registration_payments.upi_reference`/`screenshot_path`/`razorpay_*`.
- Adds `registration_payments.merchant_order_id`/`phonepe_order_id`; status is now `initiated` | `approved` | `rejected`.
- Adds `start_phonepe_payment` / `approve_phonepe_payment` / `reject_phonepe_payment` — all `SECURITY DEFINER`, all granted **only to `service_role`** (never `authenticated`).
- The admin-only `approve_registration_payment` / `reject_registration_payment` (from `0006`) are untouched — kept as a manual override for stuck payments.

### Admin app (`apps/admin/src`)
- `pages/Settings.tsx` — the UPI ID / payee name fields are gone (columns no longer exist).
- `pages/Payments.tsx` — shows `merchant_order_id`/`phonepe_order_id` instead of a UTR/screenshot; filter tabs are Initiated/Approved/Rejected/All.

## Payment flow

```
User opens Payment screen, enters phone number, taps "Pay with PhonePe"
        ↓
phonepe-initiate: reads fee from app_settings, gets PhonePe order + redirect URL
                  (the app's root), records an 'initiated' registration_payments row
        ↓
Browser redirects to PhonePe's hosted checkout, user pays
        ↓
PhonePe redirects back to the app's root
        ↓
PaymentScreen sees its own payment row is still 'initiated' and polls
phonepe-status every 3s
        ↓
phonepe-status confirms with PhonePe server-side → approve_phonepe_payment
        ↓
profile.payment_status = 'approved', referral bonus credited if applicable
        ↓
Success screen shown → user can submit content
```

(In parallel, PhonePe's webhook hits `phonepe-callback` directly and can approve/reject the same row independently of whether the user ever reopens the app.)

## Next steps to deploy

See `PHONEPE_SETUP.md` for the full checklist: set Edge Function secrets via `supabase secrets set`, run `supabase db push`, deploy the three functions, and configure the webhook URL + callback credentials in the PhonePe dashboard.
