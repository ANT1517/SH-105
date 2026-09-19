/**
 * Web / default upload adapter for the mic recording (the recorder gives a blob: URL on web).
 * On iOS/Android Metro picks voiceRuntime.native.js instead. Import this WITHOUT the extension so platform
 * resolution works: `import { appendAudio } from '../services/voiceRuntime'`.
 */
export { appendAudioStandard as appendAudio } from './voiceClient.js';
