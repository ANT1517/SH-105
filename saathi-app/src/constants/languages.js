export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_STORAGE_KEY = '@saathi_ui_language';

const VALID_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

export function isValidLanguageCode(code) {
  return typeof code === 'string' && VALID_CODES.has(code);
}

export function getLanguageLabel(code) {
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return match ? match.label : 'English';
}
