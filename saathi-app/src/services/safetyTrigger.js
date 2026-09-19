/**
 * Client-side safety trigger: decides whether a message goes to Person C's /api/v1/safety/check (safety check
 * FIRST, before anything is treated as a transaction) exactly as Dev-A's WhatsApp webhook does.
 *
 * SAFETY_TRIGGER_PATTERNS is a copy of the patterns in person_c/app/safety/rules.py (detect_signals): a message
 * that produces ANY safety signal there is routed to the safety check. The copy is kept in sync by
 * src/services/__tests__/safetyTrigger.test.mjs, which compares it with rules.py and runs the shared
 * person_c/tests/safety_corpus.json examples. To regenerate, copy the re.search patterns from rules.py in order.
 */

export const SAFETY_TRIGGER_PATTERNS = [
  String.raw`\b(kyc|account|card)\b.*\b(expire|expired|suspended|block|blocked|verify)\b|\b(verify|update|renew|complete)\b.{0,15}\byour\b.{0,10}\b(kyc|account|card)\b`, // KYC / account expiry
  String.raw`\bclick\b|\b(tap|visit|go to)\b.*\b(link|url|website|site|here|below)\b|\bwww\.`, // click-link requests
  String.raw`\b(otp|one time password)\b|\b(verification|security|confirmation|secret|login|authentication) code\b|\bcode\b.*\b(received|sent to your)\b`, // OTP requests
  String.raw`\b(share|send|enter|provide|reveal|give|tell)\b.{0,15}\byour\b.{0,15}\b(password|pin|mpin|cvv)\b|\b(password|pin|mpin|cvv)\b.{0,40}\b(required|needed|to verify|to confirm|to activate|to unlock)\b`, // credential requests
  String.raw`\b(share|send|give|provide|submit|update|upload|forward)\b.{0,20}\byour\b.*\b(aadhaar|aadhar|pan|bank details|credit card|card details|card number|account number)\b`, // sensitive info
  String.raw`\b(pay|send money|transfer)\b.*\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b|\b(immediately|urgent|urgently|asap|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|last chance|final notice)\b.*\b(pay|send money|transfer)\b|\b(pay|transfer)\b\s+(rs\.?|inr|₹)?\s*\d[\d,]*\s+now\b`, // urgent payment
  String.raw`\b(arrest|arrested|warrant|prosecution)\b|\b(legal action|police case|court case|police complaint)\b.{0,30}\b(against you|will be (filed|taken|registered|initiated)|has been (filed|registered)|avoid)\b|\bavoid\b.{0,15}\b(legal action|police)\b|\bcourt (notice|summons)\b|\b(fine|penalty)\b.*\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b|\b(imposed|levied|violation|violated|illegal|unlawful|breach)\b.*\b(fine|penalty)\b`, // threats
  String.raw`\bapk\b|\b(anydesk|teamviewer|quicksupport)\b|\bremote (access|control)\b|\b(install|download)\b.{0,30}\b(app|application|software|file|attachment|link)\b|\b(app|application|software)\b.{0,30}\b(install|download)\b`, // app installs
];

const TRIGGERS = SAFETY_TRIGGER_PATTERNS.map((pattern) => new RegExp(pattern));

/** Same normalisation as rules.py: truncate to 2000 chars, trim, lowercase, collapse whitespace. */
export function normalizeForSafety(text) {
  return String(text || '').slice(0, 2000).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function looksSuspicious(text) {
  const t = normalizeForSafety(text);
  return t.length > 0 && (t.includes('http') || TRIGGERS.some((re) => re.test(t)));
}
