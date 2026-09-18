const {
  generateTransactionHash,
  checkDuplicate,
  recordTransactionInCache,
  clearCache,
  DEDUPLICATION_WINDOW_MS
} = require('../../src/services/deduplicationService');

describe('Unit: Deduplication Service', () => {
  beforeEach(() => {
    clearCache();
  });

  it('generates consistent SHA-256 hash for identical transaction payload', () => {
    const tx = {
      user_id: 'meera_001',
      channel: 'whatsapp_voice',
      raw_text: 'earned 800 tailoring',
      normalized_text: 'earned 800 tailoring',
      parsed_transaction: { type: 'income', amount: 800, category: 'tailoring' }
    };

    const hash1 = generateTransactionHash(tx);
    const hash2 = generateTransactionHash(tx);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('generates different hashes for different users', () => {
    const tx1 = { user_id: 'user_A', channel: 'whatsapp', normalized_text: 'income 500', parsed_transaction: { amount: 500, category: 'cash', type: 'income' } };
    const tx2 = { user_id: 'user_B', channel: 'whatsapp', normalized_text: 'income 500', parsed_transaction: { amount: 500, category: 'cash', type: 'income' } };
    expect(generateTransactionHash(tx1)).not.toBe(generateTransactionHash(tx2));
  });

  it('generates different hashes for different amounts and categories', () => {
    const base = { user_id: 'meera', channel: 'whatsapp', normalized_text: 'text', parsed_transaction: { type: 'income', amount: 500, category: 'tailoring' } };
    const diffAmount = { ...base, parsed_transaction: { type: 'income', amount: 600, category: 'tailoring' } };
    const diffCategory = { ...base, parsed_transaction: { type: 'income', amount: 500, category: 'pickle sales' } };

    expect(generateTransactionHash(base)).not.toBe(generateTransactionHash(diffAmount));
    expect(generateTransactionHash(base)).not.toBe(generateTransactionHash(diffCategory));
  });

  it('detects duplicate after recording transaction in cache', () => {
    const tx = {
      user_id: 'meera_001',
      channel: 'whatsapp_voice',
      raw_text: 'earned 800 tailoring',
      normalized_text: 'earned 800 tailoring',
      parsed_transaction: { type: 'income', amount: 800, category: 'tailoring' }
    };

    const check1 = checkDuplicate(tx);
    expect(check1.isDuplicate).toBe(false);

    recordTransactionInCache(check1.hash, tx);

    const check2 = checkDuplicate(tx);
    expect(check2.isDuplicate).toBe(true);
    expect(check2.hash).toBe(check1.hash);
  });
});
