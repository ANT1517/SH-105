import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_URLS, getNlpApiUrl, getPersonBApiUrl, getPersonCApiUrl, getUserId, getVoiceApiUrl } from '../apiConfig.js';
import { getNlpApiUrl as nlpClientUrl } from '../nlpClient.js';
import { withEnv } from './helpers.mjs';

describe('apiConfig: one env var per service', () => {
  test('defaults are the local-dev ports', () => {
    withEnv({ EXPO_PUBLIC_PERSON_B_API_URL: undefined, EXPO_PUBLIC_PERSON_C_API_URL: undefined, EXPO_PUBLIC_NLP_API_URL: undefined, EXPO_PUBLIC_VOICE_API_URL: undefined, EXPO_PUBLIC_USER_ID: undefined }, () => {
      assert.equal(getPersonBApiUrl(), 'http://localhost:5000');
      assert.equal(getPersonCApiUrl(), 'http://localhost:8000');
      assert.equal(getNlpApiUrl(), 'http://localhost:8002');
      assert.equal(getVoiceApiUrl(), 'http://localhost:8001');
      assert.equal(getUserId(), 'meera_001');
      assert.deepEqual(DEFAULT_URLS, { personB: 'http://localhost:5000', personC: 'http://localhost:8000', nlp: 'http://localhost:8002', voice: 'http://localhost:8001' });
    });
  });

  test('each service is overridden by its own env var, trailing slashes trimmed', () => {
    withEnv({
      EXPO_PUBLIC_PERSON_B_API_URL: 'http://10.0.2.2:5000//',
      EXPO_PUBLIC_PERSON_C_API_URL: 'https://c.example.com/',
      EXPO_PUBLIC_NLP_API_URL: 'http://nlp.internal:9000',
      EXPO_PUBLIC_VOICE_API_URL: 'http://192.168.1.20:8001/',
      EXPO_PUBLIC_USER_ID: ' someone_else ',
    }, () => {
      assert.equal(getPersonBApiUrl(), 'http://10.0.2.2:5000');
      assert.equal(getPersonCApiUrl(), 'https://c.example.com');
      assert.equal(getNlpApiUrl(), 'http://nlp.internal:9000');
      assert.equal(getVoiceApiUrl(), 'http://192.168.1.20:8001');
      assert.equal(getUserId(), 'someone_else');
    });
  });

  test('nlpClient uses the shared config (same function)', () => {
    withEnv({ EXPO_PUBLIC_NLP_API_URL: 'http://nlp.example:1234/' }, () => {
      assert.equal(nlpClientUrl(), 'http://nlp.example:1234');
    });
  });
});
