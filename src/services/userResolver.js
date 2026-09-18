/**
 * Resolves the user_id sent by Person A to a canonical Saathi user.
 * Twilio WhatsApp sends the sender's phone as "whatsapp:+91XXXXXXXXXX"; known demo numbers are
 * mapped to existing users via PHONE_USER_MAP (JSON, e.g. {"+919876543210":"meera_001"}).
 * Phone-shaped ids that are not mapped are NOT auto-created as users (that fragments state).
 */

const PHONE_SHAPED = /^(whatsapp:)?\s*\+?\d[\d\s-]{6,}$/i;

function normalizePhone(id) {
  const digits = id.replace(/^whatsapp:/i, '').replace(/[^\d]/g, '');
  return `+${digits}`;
}

function loadPhoneMap() {
  try {
    const raw = JSON.parse(process.env.PHONE_USER_MAP || '{}');
    return Object.fromEntries(Object.entries(raw).map(([p, u]) => [normalizePhone(p), u]));
  } catch (_) {
    return {};
  }
}

/** @returns {{userId: string}|{error: string}} */
function resolveUserId(id) {
  if (!PHONE_SHAPED.test(id)) return { userId: id };
  const mapped = loadPhoneMap()[normalizePhone(id)];
  if (mapped) return { userId: mapped };
  return { error: `Unknown phone number "${id}": no user is mapped to it (set PHONE_USER_MAP)` };
}

module.exports = { resolveUserId, normalizePhone };
