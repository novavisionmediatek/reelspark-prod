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

export async function initiatePhonePePayment({
  userPhone,
}: InitiatePhonePePaymentInput): Promise<InitiatePhonePePaymentResult> {
  const redirectBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data, error } = await supabase.functions.invoke('phonepe-initiate', {
    body: { userPhone, redirectBaseUrl },
  });
  if (error) throw new Error(error.message ?? 'Could not start PhonePe payment.');
  if (data?.error) throw new Error(data.error);

  return data as InitiatePhonePePaymentResult;
}

export type PhonePePaymentStatus = 'pending' | 'approved' | 'rejected';

export async function checkPhonePePaymentStatus(merchantOrderId: string): Promise<PhonePePaymentStatus> {
  const { data, error } = await supabase.functions.invoke('phonepe-status', {
    body: { merchantOrderId },
  });
  if (error) throw new Error(error.message ?? 'Could not check payment status.');
  if (data?.error) throw new Error(data.error);

  return data.status as PhonePePaymentStatus;
}
