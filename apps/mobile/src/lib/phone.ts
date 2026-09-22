// Accepts +country-code and 7-15 digits — permissive on purpose since this is
// a mandatory field every user must clear, not a strict per-country format check.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.trim());
}
