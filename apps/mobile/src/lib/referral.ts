// Referral-link handling (web build). An invite link is `<origin>/?ref=CODE`.
// On first load we lift the code out of the URL into sessionStorage and clean the
// address bar, so a page reload or manual nav to Sign up still carries the code.

const KEY = 'reelspark.referral';

function readStore(): string {
  try {
    return window.sessionStorage?.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/** Call once on app start. Returns the code found in the URL or store, if any. */
export function captureReferralFromUrl(): string {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('ref');
    if (raw && raw.trim()) {
      const code = raw.trim().toUpperCase().slice(0, 32);
      window.sessionStorage?.setItem(KEY, code);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return code;
    }
  } catch {
    /* ignore */
  }
  return readStore();
}

export function getStoredReferral(): string {
  return readStore();
}

export function clearStoredReferral(): void {
  try {
    window.sessionStorage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function referralLink(code: string): string {
  try {
    return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
  } catch {
    return code;
  }
}
