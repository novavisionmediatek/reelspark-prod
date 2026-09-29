import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// All PhonePe API calls (OAuth token, create-payment, status) happen
// server-side in the phonepe-initiate / phonepe-status Supabase Edge
// Functions — nothing PhonePe-related is trusted to the client.

interface InitiatePhonePePaymentInput {
  userPhone: string;
}

interface InitiatePhonePePaymentResult {
  merchantOrderId: string;
  redirectUrl: string;
}

// supabase-js's own error.message for a non-2xx function response is just
// "Edge Function returned a non-2xx status code" — the real reason is a JSON
// body ({ error: "..." }) on error.context, a Response it doesn't read for you.
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.clone().json();
      if (body?.error) return body.error as string;
    } catch {
      /* body wasn't JSON — fall through to the generic message */
    }
  }
  return (error as Error)?.message || fallback;
}

export async function initiatePhonePePayment({
  userPhone,
}: InitiatePhonePePaymentInput): Promise<InitiatePhonePePaymentResult> {
  const redirectBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data, error } = await supabase.functions.invoke('phonepe-initiate', {
    body: { userPhone, redirectBaseUrl },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not start PhonePe payment.'));
  if (data?.error) throw new Error(data.error);

  return data as InitiatePhonePePaymentResult;
}

export type PhonePePaymentStatus = 'pending' | 'approved' | 'rejected';

export async function checkPhonePePaymentStatus(merchantOrderId: string): Promise<PhonePePaymentStatus> {
  const { data, error } = await supabase.functions.invoke('phonepe-status', {
    body: { merchantOrderId },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not check payment status.'));
  if (data?.error) throw new Error(data.error);

  return data.status as PhonePePaymentStatus;
}
