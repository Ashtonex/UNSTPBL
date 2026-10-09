export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

// Zimbabwean mobile prefixes after +263: 71 (NetOne), 73 (Telecel), 77/78 (Econet).
// Landlines (e.g. 020 for Mutare) cannot receive SMS, so they are rejected.
const ZIMBABWE_MOBILE = /^7[13478]\d{7}$/;

const fail = (error: string): PhoneResult => ({ ok: false, error });

/**
 * Normalises a phone number to E.164 (+263771234567).
 *
 * Accepts how people actually write numbers: "0771 234 567", "+263 77 123 4567",
 * "263771234567", "00263771234567", "771234567". Numbers without a country code are
 * taken to be Zimbabwean. Other countries are accepted in international form.
 */
export function normalizePhone(input: unknown, defaultCountryCode = '263'): PhoneResult {
  if (typeof input !== 'string' || input.trim() === '') return fail('A phone number is required.');

  const compact = input.trim().replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) return fail('Phone numbers may only contain digits, spaces and a leading +.');

  let international: string;
  if (compact.startsWith('+')) {
    international = compact.slice(1);
  } else if (compact.startsWith('00')) {
    international = compact.slice(2);
  } else if (compact.startsWith('0')) {
    international = defaultCountryCode + compact.slice(1);
  } else if (defaultCountryCode === '263' && ZIMBABWE_MOBILE.test(compact)) {
    international = `263${compact}`;
  } else {
    international = compact;
  }

  if (international.length < 8 || international.length > 15) {
    return fail('That does not look like a valid phone number.');
  }

  if (international.startsWith('263') && !ZIMBABWE_MOBILE.test(international.slice(3))) {
    return fail('Enter a Zimbabwean mobile number, for example 077 123 4567.');
  }

  return { ok: true, e164: `+${international}` };
}

/** "+263771234567" -> "+263 77 ••• 4567", for logs and lists that don't need the full number. */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return '••••';
  return `${e164.slice(0, 6)} ••• ${e164.slice(-4)}`;
}
