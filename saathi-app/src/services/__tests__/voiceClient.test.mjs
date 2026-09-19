import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { guessAudioMeta, transcribeAudio } from '../voiceClient.js';
import { ApiError } from '../http.js';
import { installFetch, withEnv } from './helpers.mjs';

let fetchStub;
afterEach(() => fetchStub && fetchStub.restore());

const ENV = { EXPO_PUBLIC_VOICE_API_URL: 'http://voice.test:8001' };
const audioBlob = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/m4a' });

describe('voice client (mic -> Dev-A Whisper)', () => {
  test('uploads the recording as multipart "audio" to <voice url>/api/transcribe and returns the transcript', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/transcribe': { transcript: '  I earned 800 from tailoring today  ' } });
      const text = await transcribeAudio({ blob: audioBlob(), fileName: 'voice.m4a' });
      assert.equal(text, 'I earned 800 from tailoring today');
      const call = fetchStub.calls[0];
      assert.equal(call.origin, 'http://voice.test:8001');
      assert.ok(call.body instanceof FormData, 'body must be multipart form data');
      const file = call.body.get('audio');
      assert.equal(file.name, 'voice.m4a');
      assert.equal(file.size, 4);
    }));

  test('silence comes back as an empty transcript, not an error', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/transcribe': { transcript: '' } });
      assert.equal(await transcribeAudio({ blob: audioBlob() }), '');
    }));

  test('a server error carries Dev-A\'s message; an unreachable server is flagged isNetworkError', () =>
    withEnv(ENV, async () => {
      fetchStub = installFetch({ 'POST /api/transcribe': [{ detail: "I couldn't understand that audio. Please try again." }, 422] });
      await assert.rejects(transcribeAudio({ blob: audioBlob() }), (e) => e instanceof ApiError && e.status === 422 && /couldn't understand/.test(e.message));
      fetchStub.restore();
      fetchStub = installFetch({ 'POST /api/transcribe': new Error('ECONNREFUSED') });
      await assert.rejects(transcribeAudio({ blob: audioBlob() }), (e) => e.isNetworkError === true);
    }));

  test('the platform adapter decides how the recording is attached (a phone passes a File, never a Blob or {uri,name,type})', () =>
    withEnv(ENV, async () => {
      // Regression for "Unsupported FormDataPart implementation": Expo SDK 57's fetch rejects {uri,name,type} parts and
      // Blobs read from a file uri. The native adapter (voiceRuntime.native.js) attaches an expo-file-system File instead.
      const attached = [];
      const fakeNativeAdapter = async (form, field, audio) => { attached.push({ field, audio }); form.append(field, new Blob(['x'])); };
      fetchStub = installFetch({ 'POST /api/transcribe': { transcript: 'from phone' } });
      const text = await transcribeAudio({ uri: 'file:///data/user/0/cache/Audio/rec.m4a', fileName: 'voice.m4a', mimeType: 'audio/m4a' }, { appendAudio: fakeNativeAdapter });
      assert.equal(text, 'from phone');
      assert.deepEqual(attached, [{ field: 'audio', audio: { uri: 'file:///data/user/0/cache/Audio/rec.m4a', fileName: 'voice.m4a', mimeType: 'audio/m4a' } }]);
      assert.equal(fetchStub.calls.length, 1); // the standard fetch(uri).blob() path was NOT taken
    }));

  test('the native adapter uploads an expo-file-system File and the web adapter a named Blob', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const native = fs.readFileSync(path.join(dir, 'voiceRuntime.native.js'), 'utf8');
    assert.match(native, /import \{ File \} from 'expo-file-system'/);
    assert.match(native, /form\.append\(field, new File\(uri\)\)/);
    assert.ok(!/name:\s*fileName|type:\s*mimeType/.test(native), 'must not build a {uri,name,type} part');
    assert.match(fs.readFileSync(path.join(dir, 'voiceRuntime.js'), 'utf8'), /appendAudioStandard as appendAudio/);
  });

  test('on web (blob: uri) the recording is fetched and uploaded as a named Blob', () =>
    withEnv(ENV, async () => {
      const blobUrl = URL.createObjectURL(new Blob([new Uint8Array([9, 9, 9])], { type: 'audio/webm' }));
      const realFetch = globalThis.fetch;
      let upload;
      globalThis.fetch = async (url, init) => {
        if (String(url).startsWith('blob:')) return realFetch(url, init); // reading the recording
        upload = { url: String(url), body: init.body };
        return new Response(JSON.stringify({ transcript: 'web hello' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        assert.equal(await transcribeAudio({ uri: blobUrl, fileName: 'voice.webm', mimeType: 'audio/webm' }), 'web hello');
        assert.equal(upload.body.get('audio').name, 'voice.webm');
        assert.equal(upload.body.get('audio').size, 3);
      } finally {
        globalThis.fetch = realFetch;
        URL.revokeObjectURL(blobUrl);
      }
    }));

  test('guessAudioMeta: native .m4a, web blob (webm), unknown -> m4a', () => {
    assert.deepEqual(guessAudioMeta('file:///data/cache/Audio/rec-1.m4a'), { fileName: 'voice.m4a', mimeType: 'audio/m4a' });
    assert.deepEqual(guessAudioMeta('file:///x/rec.3gp'), { fileName: 'voice.3gp', mimeType: 'audio/3gpp' });
    assert.deepEqual(guessAudioMeta('blob:http://localhost:8081/1234-abcd'), { fileName: 'voice.webm', mimeType: 'audio/webm' });
    assert.deepEqual(guessAudioMeta(''), { fileName: 'voice.m4a', mimeType: 'audio/m4a' });
  });
});
