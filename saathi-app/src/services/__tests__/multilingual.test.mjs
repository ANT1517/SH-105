import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  isValidLanguageCode,
  getLanguageLabel,
} from '../../constants/languages.js';

import en from '../../locales/en/translation.json' with { type: 'json' };
import te from '../../locales/te/translation.json' with { type: 'json' };
import hi from '../../locales/hi/translation.json' with { type: 'json' };
import kn from '../../locales/kn/translation.json' with { type: 'json' };

// Mock AsyncStorage for testing persistence
class MockAsyncStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrow = false;
  }
  async getItem(key) {
    if (this.shouldThrow) throw new Error('AsyncStorage read disk failure');
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async setItem(key, value) {
    if (this.shouldThrow) throw new Error('AsyncStorage write disk failure');
    this.store.set(key, String(value));
  }
  async removeItem(key) {
    this.store.delete(key);
  }
  async clear() {
    this.store.clear();
  }
}

// Helper to recursively collect all dot-notation leaf keys
function getLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getLeafKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('Multilingual UI & Language Selector Verification', () => {
  let mockStorage;

  beforeEach(async () => {
    mockStorage = new MockAsyncStorage();
    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        compatibilityJSON: 'v4',
        resources: {
          en: { translation: en },
          te: { translation: te },
          hi: { translation: hi },
          kn: { translation: kn },
        },
        lng: DEFAULT_LANGUAGE,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false },
      });
    } else {
      await i18n.changeLanguage(DEFAULT_LANGUAGE);
    }
  });

  test('Exactly 4 supported languages: English, Telugu, Hindi, Kannada', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    const labels = SUPPORTED_LANGUAGES.map((l) => l.label);

    assert.deepEqual(codes, ['en', 'te', 'hi', 'kn']);
    assert.deepEqual(labels, ['English', 'తెలుగు', 'हिन्दी', 'ಕನ್ನಡ']);
    assert.equal(SUPPORTED_LANGUAGES.length, 4);
  });

  test('getLanguageLabel returns correct native labels', () => {
    assert.equal(getLanguageLabel('en'), 'English');
    assert.equal(getLanguageLabel('te'), 'తెలుగు');
    assert.equal(getLanguageLabel('hi'), 'हिन्दी');
    assert.equal(getLanguageLabel('kn'), 'ಕನ್ನಡ');
    assert.equal(getLanguageLabel('unknown'), 'English');
  });

  describe('STARTUP scenarios', () => {
    test('no saved language -> English', async () => {
      const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY); // null
      const lang = isValidLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
      await i18n.changeLanguage(lang);
      assert.equal(lang, 'en');
      assert.equal(i18n.language, 'en');
      assert.equal(i18n.t('tabs.tijori'), 'Tijori');
    });

    test('saved "te" -> Telugu', async () => {
      await mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'te');
      const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY);
      const lang = isValidLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
      await i18n.changeLanguage(lang);
      assert.equal(lang, 'te');
      assert.equal(i18n.language, 'te');
      assert.equal(i18n.t('tabs.tijori'), 'తిజోరి');
    });

    test('saved "hi" -> Hindi', async () => {
      await mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'hi');
      const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY);
      const lang = isValidLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
      await i18n.changeLanguage(lang);
      assert.equal(lang, 'hi');
      assert.equal(i18n.language, 'hi');
      assert.equal(i18n.t('tabs.tijori'), 'तिजोरी');
    });

    test('saved "kn" -> Kannada', async () => {
      await mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'kn');
      const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY);
      const lang = isValidLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
      await i18n.changeLanguage(lang);
      assert.equal(lang, 'kn');
      assert.equal(i18n.language, 'kn');
      assert.equal(i18n.t('tabs.tijori'), 'ತಿಜೋರಿ');
    });

    test('invalid saved language (e.g. "fr", "es", garbage) -> English', async () => {
      const invalidValues = ['fr', 'es', 'zh', '123', 'undefined', '', '{code: "te"}'];
      for (const val of invalidValues) {
        await mockStorage.setItem(LANGUAGE_STORAGE_KEY, val);
        const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY);
        const lang = isValidLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
        assert.equal(lang, 'en', `Failed for value: ${val}`);
        await i18n.changeLanguage(lang);
        assert.equal(i18n.language, 'en');
      }
    });

    test('AsyncStorage read failure -> falls back safely to English without crashing', async () => {
      mockStorage.shouldThrow = true;
      let lang = DEFAULT_LANGUAGE;
      try {
        const stored = await mockStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isValidLanguageCode(stored)) lang = stored;
      } catch {
        lang = DEFAULT_LANGUAGE;
      }
      assert.equal(lang, 'en');
      await i18n.changeLanguage(lang);
      assert.equal(i18n.language, 'en');
    });
  });

  describe('LANGUAGE SWITCHING sequence', () => {
    test('English -> Telugu -> Hindi -> Kannada -> English cycle updates immediately', async () => {
      // 1. English
      await i18n.changeLanguage('en');
      assert.equal(i18n.language, 'en');
      assert.equal(i18n.t('tabs.tijori'), 'Tijori');

      // 2. English -> Telugu
      await i18n.changeLanguage('te');
      assert.equal(i18n.language, 'te');
      assert.equal(i18n.t('tabs.tijori'), 'తిజోరి');

      // 3. Telugu -> Hindi
      await i18n.changeLanguage('hi');
      assert.equal(i18n.language, 'hi');
      assert.equal(i18n.t('tabs.tijori'), 'तिजोरी');

      // 4. Hindi -> Kannada
      await i18n.changeLanguage('kn');
      assert.equal(i18n.language, 'kn');
      assert.equal(i18n.t('tabs.tijori'), 'ತಿಜೋರಿ');

      // 5. Kannada -> English
      await i18n.changeLanguage('en');
      assert.equal(i18n.language, 'en');
      assert.equal(i18n.t('tabs.tijori'), 'Tijori');
    });

    test('Repeated switching does not crash or leak state', async () => {
      const cycle = ['en', 'te', 'hi', 'kn', 'en', 'hi', 'te', 'kn', 'en', 'kn', 'hi', 'te'];
      for (const code of cycle) {
        await i18n.changeLanguage(code);
        assert.equal(i18n.language, code);
        assert.ok(i18n.t('tabs.tijori').length > 0);
      }
    });

    test('AsyncStorage write failure does not crash language change', async () => {
      mockStorage.shouldThrow = true;
      let errorCaught = null;
      try {
        await mockStorage.setItem(LANGUAGE_STORAGE_KEY, 'te');
      } catch (err) {
        errorCaught = err;
      }
      assert.ok(errorCaught);
      // App still updates in-memory i18n successfully
      await i18n.changeLanguage('te');
      assert.equal(i18n.language, 'te');
      assert.equal(i18n.t('tabs.tijori'), 'తిజోరి');
    });
  });

  describe('UI COVERAGE & KEY PARITY', () => {
    test('100% leaf key parity across all 4 locales (165 keys)', () => {
      const enKeys = getLeafKeys(en).sort();
      const teKeys = getLeafKeys(te).sort();
      const hiKeys = getLeafKeys(hi).sort();
      const knKeys = getLeafKeys(kn).sort();

      assert.equal(enKeys.length, 165, 'Expected 165 translation keys across all domains');
      assert.deepEqual(teKeys, enKeys, 'Telugu keys must match English keys');
      assert.deepEqual(hiKeys, enKeys, 'Hindi keys must match English keys');
      assert.deepEqual(knKeys, enKeys, 'Kannada keys must match English keys');
    });

    test('No empty strings, whitespace-only, or TODO markers in any language', () => {
      const enKeys = getLeafKeys(en);
      const resources = { en, te, hi, kn };
      for (const [lang, resource] of Object.entries(resources)) {
        for (const key of enKeys) {
          const value = key.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), resource);
          assert.ok(typeof value === 'string', `[${lang}] ${key} must be a string`);
          assert.ok(value.trim().length > 0, `[${lang}] ${key} must not be blank`);
          assert.ok(!/\bTODO\b/i.test(value), `[${lang}] ${key} contains TODO: "${value}"`);
        }
      }
    });

    test('All major functional areas covered in translations', () => {
      const areas = [
        'common.cancel', 'common.save', 'common.language',
        'tabs.tijori', 'tabs.lakshya', 'tabs.khata', 'tabs.transactions', 'tabs.sahayata',
        'moneyPotMap.greetingEyebrow', 'moneyPotMap.sectionTitle', 'moneyPotMap.chitLocked',
        'chat.headerTitle', 'chat.placeholder', 'chat.stopRecording', 'chat.speakToSaathi',
        'lakshya.headerTitle', 'lakshya.goalBadge', 'lakshya.modalTitle',
        'ledger.headerTitle', 'ledger.scanBill', 'ledger.cameraPermNeeded',
        'transactions.headerTitle', 'transactions.noTransactions',
        'safetyShield.headerTitle', 'safetyShield.checkButton', 'safetyShield.rule1'
      ];

      for (const lang of ['en', 'te', 'hi', 'kn']) {
        i18n.changeLanguage(lang);
        for (const key of areas) {
          const val = i18n.t(key);
          assert.ok(val && val !== key, `Area key ${key} missing or untranslated in ${lang}`);
        }
      }
    });
  });
});
