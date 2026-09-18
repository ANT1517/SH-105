-- PostgreSQL Schema for Saathi Person B (Financial-Memory Backend)

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pots (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    pot_type VARCHAR(32) NOT NULL, -- 'cash', 'bank', 'shg', 'chit_committed', 'post_office', 'business'
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_pot UNIQUE (user_id, pot_type)
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL, -- 'whatsapp_voice', 'whatsapp_text', 'sms', 'manual'
    input_type VARCHAR(32) NOT NULL, -- 'voice', 'text', 'sms'
    raw_text TEXT,
    normalized_text TEXT,
    tx_type VARCHAR(32) NOT NULL, -- 'income', 'expense', 'transfer', 'commitment'
    amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(64) NOT NULL,
    target_pot VARCHAR(32) NOT NULL,
    confidence NUMERIC(4, 2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    activity VARCHAR(128) NOT NULL, -- e.g. 'pickle sales', 'tailoring'
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_time ON ledger_entries(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    saved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL, -- 'TRANSACTION_INGESTED', 'DUPLICATE_DETECTED', 'LEDGER_ENTRY_RECORDED', 'GOAL_UPDATED', etc.
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    previous_state JSONB,
    new_state JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, created_at DESC);
