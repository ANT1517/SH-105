import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { looksSuspicious, SAFETY_TRIGGER_PATTERNS } from '../safetyTrigger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');
const rulesPath = path.join(repoRoot, 'person_c', 'app', 'safety', 'rules.py');
const corpusPath = path.join(repoRoot, 'person_c', 'tests', 'safety_corpus.json');
const haveMonorepo = fs.existsSync(rulesPath) && fs.existsSync(corpusPath);

describe('client safety trigger (mirror of person_c/app/safety/rules.py)', () => {
  test('the masterplan KYC message and the scam-that-looks-like-a-transaction are flagged', () => {
    assert.ok(looksSuspicious('Your KYC will expire, click to verify'));
    assert.ok(looksSuspicious('paid 500 to verify your KYC now'));
    assert.ok(looksSuspicious('click here http://bit.ly/xyz123'));
  });

  test('ordinary financial questions and transactions are not flagged', () => {
    for (const m of ['is it fine to take a loan?', 'should I go to the bank for a loan?', 'which app is best for saving?',
      'how do I pay my chit installment now?', 'how much can I save?', 'I earned 800 from tailoring today', 'I saved 1000 today', '', '   ']) {
      assert.equal(looksSuspicious(m), false, m);
    }
  });

  test('DRIFT GUARD: the patterns equal the ones in person_c rules.py, in order', { skip: !haveMonorepo && 'person_c not found next to saathi-app' }, () => {
    const src = fs.readFileSync(rulesPath, 'utf8');
    const theirs = [...src.matchAll(/re\.search\(r'([^']+)', normalized\)/g)].map((m) => m[1]);
    assert.equal(theirs.length, 8);
    assert.deepEqual(SAFETY_TRIGGER_PATTERNS, theirs);
    assert.ok(src.includes('"http" in normalized'));
  });

  test('shared corpus: every scam is flagged and no ordinary message is', { skip: !haveMonorepo && 'person_c not found next to saathi-app' }, () => {
    const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
    assert.ok(corpus.safe.length >= 30 && corpus.scam.length >= 20);
    const falsePositives = corpus.safe.filter((m) => looksSuspicious(m));
    const missed = corpus.scam.filter((m) => !looksSuspicious(m));
    assert.deepEqual(falsePositives, []);
    assert.deepEqual(missed, []);
  });
});
