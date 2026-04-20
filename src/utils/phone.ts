/**
 * Phone number utilities.
 *
 * This module owns the single source of truth for turning user-entered
 * phone strings into the canonical E.164 form we persist on the Users
 * doc (`phone`) and query against in Add-Friends / Contacts-Discovery.
 *
 * Design notes
 * ------------
 * - We deliberately keep this lightweight (no `libphonenumber-js`) because
 *   the only two consumers today are (a) the profile edit flow and
 *   (b) contact-lookup normalization. Both already agreed on a "+<digits>"
 *   format with a US default for 10-digit inputs. A future phase that
 *   adds contact import or phone-auth can swap this out for full
 *   libphonenumber-js without changing any call sites.
 * - Display formatting is kept separate from the canonical form so we
 *   never use a formatted string as a lookup key.
 */

/**
 * Minimum / maximum digit counts accepted for a plausible international
 * phone number. Mirrors the E.164 spec (1\u201315 significant digits) with a
 * conservative lower bound to reject obvious garbage.
 */
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Normalize a user-entered phone string into E.164 (`+<country><national>`).
 *
 * Returns `null` when the input is empty or cannot be coerced into a
 * plausible number. Callers can treat `null` as "invalid input, don't
 * hit the network".
 *
 * Supported inputs:
 *   - Already-E.164: "+14155551234" \u2192 "+14155551234"
 *   - 11-digit starting with 1: "14155551234" \u2192 "+14155551234"
 *   - 10-digit US: "4155551234" \u2192 "+14155551234"
 *   - International without leading +: "44 20 7946 0958" \u2192 "+442079460958"
 *     (only if length \u2265 11 so we don't mis-assume US)
 *   - Formatting (spaces, dashes, parens, dots) is stripped.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip everything except digits and a leading +.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;

  if (hasPlus) {
    return `+${digits}`;
  }

  // 11 digits starting with 1 \u2192 assume US with missing '+'
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // 10 digits \u2192 assume US
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Longer bare digits \u2192 assume the user omitted the '+' on an
  // international number. We cannot validate the country code without
  // a full library, so we accept it as-is.
  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Pretty-print an E.164 number for display in Settings.
 *
 * US numbers are rendered as "+1 (415) 555-1234". All other numbers are
 * returned in "+CC rest" form with a space after the country code.
 *
 * Returns the raw input unchanged if it isn't already in E.164 form \u2014
 * safe to use on partially-saved or legacy values.
 */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  if (!e164.startsWith("+")) return e164;

  const digits = e164.slice(1);

  // US / CA: +1NNNNNNNNNN
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7);
    return `+1 (${area}) ${mid}-${last}`;
  }

  // Generic international: group country code as best-effort 1\u20133 digits.
  // Without a full metadata set we just split after the first 1\u20133 digits
  // so the result stays readable.
  const cc = digits.slice(0, Math.min(3, Math.max(1, digits.length - 7)));
  const rest = digits.slice(cc.length);
  return `+${cc} ${rest}`.trim();
}

/**
 * Quick validity check for UI state \u2014 true when `normalizePhoneE164`
 * would return a non-null result.
 */
export function isValidPhoneInput(raw: string | null | undefined): boolean {
  return normalizePhoneE164(raw) !== null;
}
