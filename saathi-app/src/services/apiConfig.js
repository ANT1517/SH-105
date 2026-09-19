/**
 * Base URLs and identity for every backend the app talks to: one env var per service, with a local-dev
 * default, following the pattern nlpClient.js already used.
 *
 *   EXPO_PUBLIC_PERSON_B_API_URL  Person B financial-memory backend   (default http://localhost:5000)
 *   EXPO_PUBLIC_PERSON_C_API_URL  Person C guidance / safety service  (default http://localhost:8000)
 *   EXPO_PUBLIC_NLP_API_URL       saathi-nlp understanding service    (default http://localhost:8002)
 *   EXPO_PUBLIC_VOICE_API_URL     Dev-A speech-to-text (Whisper)      (default http://localhost:8001)
 *   EXPO_PUBLIC_USER_ID           user this device acts as            (default meera_001, the demo user)
 *
 * NOTE: on a phone or an Android emulator "localhost" is the device itself. Point these at your machine's LAN
 * address (Android emulator: http://10.0.2.2:<port>) in .env / app config.
 *
 * Expo only inlines EXPO_PUBLIC_* variables that are read as literal `process.env.EXPO_PUBLIC_X` expressions,
 * so each one is spelled out below (no dynamic lookup).
 */

export const DEFAULT_URLS = {
  personB: 'http://localhost:5000',
  personC: 'http://localhost:8000',
  nlp: 'http://localhost:8002',
  voice: 'http://localhost:8001',
};

export const DEFAULT_USER_ID = 'meera_001';

const trimSlashes = (url) => url.replace(/\/+$/, '');

export function getPersonBApiUrl() {
  return trimSlashes(process.env.EXPO_PUBLIC_PERSON_B_API_URL || DEFAULT_URLS.personB);
}

export function getPersonCApiUrl() {
  return trimSlashes(process.env.EXPO_PUBLIC_PERSON_C_API_URL || DEFAULT_URLS.personC);
}

export function getNlpApiUrl() {
  return trimSlashes(process.env.EXPO_PUBLIC_NLP_API_URL || DEFAULT_URLS.nlp);
}

export function getVoiceApiUrl() {
  return trimSlashes(process.env.EXPO_PUBLIC_VOICE_API_URL || DEFAULT_URLS.voice);
}

export function getUserId() {
  return (process.env.EXPO_PUBLIC_USER_ID || DEFAULT_USER_ID).trim();
}
