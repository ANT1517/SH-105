/**
 * Static guards on the screen sources. The screens need the Expo/React Native runtime to render, which is not
 * installed in CI-less checkouts, so these tests check the properties that matter for the integration:
 *   - no screen reads fixture data as its default, or hardcodes a service URL
 *   - each screen is wired to the right service client
 *   - every screen file at least parses as valid JSX (via @babel/parser when it is available)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..', '..');
const read = (rel) => fs.readFileSync(path.join(srcDir, rel), 'utf8');
const SCREENS = ['ChatScreen', 'MoneyPotMapScreen', 'LedgerScreen', 'LakshyaScreen', 'SafetyShieldScreen'];
const count = (text, needle) => text.split(needle).length - 1;

describe('screens: live data, no fixture default, no hardcoded URLs', () => {
  test('no screen (or service other than apiConfig) hardcodes a service URL or port', () => {
    const files = [...SCREENS.map((n) => `screens/${n}.js`), 'hooks/useLiveData.js', 'hooks/useVoiceRecorder.js',
      ...fs.readdirSync(path.join(srcDir, 'services')).filter((f) => f.endsWith('.js') && f !== 'apiConfig.js').map((f) => `services/${f}`)];
    for (const f of files) {
      const text = read(f);
      assert.ok(!/localhost|127\.0\.0\.1|:5000\b|:8000\b|:8001\b|:8002\b/.test(text), `${f} hardcodes a service address`);
    }
    assert.match(read('services/apiConfig.js'), /process\.env\.EXPO_PUBLIC_PERSON_B_API_URL/);
    assert.match(read('services/apiConfig.js'), /process\.env\.EXPO_PUBLIC_PERSON_C_API_URL/);
  });

  test('Chat: routes through messageRouter; no canned messages, fixture or NLP-written replies', () => {
    const t = read('screens/ChatScreen.js');
    assert.match(t, /handleUserMessage/);
    assert.ok(!/MEERA_FIXTURE|api\/fixture|INITIAL_MESSAGES|getFormattedTotal/.test(t));
    assert.ok(!/nlpResult\.reply_text|understandMessage/.test(t), 'Chat must not display NLP reply text');
    assert.ok(!/Got it! I've added|Aapko ₹12,000|bit\.ly/.test(t));
    assert.match(t, /useState\(\[\]\)/);
  });

  test('Chat mic: records, transcribes with Dev-A Whisper, then sends the transcript through the normal routing', () => {
    const t = read('screens/ChatScreen.js');
    assert.match(t, /useVoiceRecorder/);
    assert.match(t, /transcribeAudio/);
    assert.match(t, /handleSend\(\{ spoken: transcript \}\)/, 'a transcript must go through handleSend (safety check first), not a shortcut');
    assert.match(t, /from '..\/services\/voiceRuntime'/, 'Chat must import the platform adapter WITHOUT an extension so Metro picks the .native file');
    assert.match(t, /transcribeAudio\(\{ uri, \.\.\.guessAudioMeta\(uri\) \}, \{ appendAudio \}\)/);
    assert.match(t, /onPress=\{handleMic\}/);
    assert.match(read('services/voiceClient.js'), /\/api\/transcribe/);
  });

  test('Money Pot Map and Ledger: live call first; the fixture appears ONLY as the explicit offlineSample fallback', () => {
    for (const [file, getter] of [['MoneyPotMapScreen', 'getFinancialState'], ['LedgerScreen', 'getLedger']]) {
      const t = read(`screens/${file}.js`);
      assert.match(t, new RegExp(`useLiveData\\(${getter}, offlineSample\\)`), `${file} must load live data first`);
      assert.equal(count(t, 'MEERA_FIXTURE'), 2, `${file}: MEERA_FIXTURE only in its import and in offlineSample`);
      assert.match(t, /const offlineSample = \(\) => fixtureTo/);
      assert.match(t, /OFFLINE_BANNER/, `${file} must tell the user when it is showing offline sample data`);
      assert.match(t, /status === 'offline'/);
    }
  });

  test('Lakshya is wired to Person B goals and has no fixture at all', () => {
    const t = read('screens/LakshyaScreen.js');
    assert.match(t, /getGoals/);
    assert.match(t, /useLiveData\(getGoals\)/);
    assert.ok(!/fixture|Meena|College Fund|2,000\/mo/.test(t));
  });

  test('Safety Shield calls Person C safety check on real user input and has no static flagged message', () => {
    const t = read('screens/SafetyShieldScreen.js');
    assert.match(t, /checkSafety/);
    assert.match(t, /<TextInput/);
    assert.ok(!/SAFETY_DATA|bit\.ly\/xyz123|Your KYC will expire\. Click here/.test(t));
  });
});

describe('screens parse as valid JSX', () => {
  let parse = null;
  try {
    const rootRequire = createRequire(path.resolve(srcDir, '..', '..', 'package.json'));
    parse = rootRequire('@babel/parser').parse;
  } catch { /* @babel/parser not available: parse tests are skipped */ }

  for (const rel of [...SCREENS.map((n) => `screens/${n}.js`), 'hooks/useLiveData.js', 'hooks/useVoiceRecorder.js']) {
    test(rel, { skip: !parse && '@babel/parser not installed' }, () => {
      assert.doesNotThrow(() => parse(read(rel), { sourceType: 'module', plugins: ['jsx'] }));
    });
  }
});
