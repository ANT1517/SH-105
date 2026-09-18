const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { checkDatabaseConnection, initSchema, isConnected } = require('./db/db');
const { seedMeera } = require('./db/seed');
const financialStateRoute = require('./routes/financialState');
const transactionsRoute = require('./routes/transactions');
const businessLedgerRoute = require('./routes/businessLedger');
const goalsRoute = require('./routes/goals');
const auditLogRoute = require('./routes/auditLog');

const app = express();

// Middlewares
app.use(cors());

// Custom JSON parser with clean error formatting for malformed JSON payloads
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      if (buf && buf.length) {
        JSON.parse(buf.toString(encoding || 'utf8'));
      }
    } catch (e) {
      const err = new Error('Malformed JSON body');
      err.status = 400;
      throw err;
    }
  }
}));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'saathi-financial-memory-backend',
    owner: 'Person B',
    postgres_connected: isConnected(),
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/financial-state', financialStateRoute);
app.use('/api/transactions', transactionsRoute);
app.use('/api/ledger', businessLedgerRoute);
app.use('/api/goals', goalsRoute);
app.use('/api/audit-log', auditLogRoute);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error Handler (Sanitizes errors, hides secrets and stack traces)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  let rawMessage = err.message || 'Internal server error';
  if (status === 400 && rawMessage.includes('JSON')) {
    rawMessage = 'Malformed JSON body';
  } else if (status >= 500) {
    rawMessage = 'Internal server error';
  }

  const { sanitizeErrorMessage } = require('./db/db');
  const message = sanitizeErrorMessage(rawMessage);

  res.status(status).json({
    error: message,
    status
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Server & Database
async function startServer() {
  const dbOk = await checkDatabaseConnection();
  if (dbOk) {
    await initSchema();
    await seedMeera(); // Idempotent — safe on every restart
  }

  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`[Saathi Backend - Person B] Server running on port ${PORT}`);
    });
  }
}

startServer();

module.exports = app;
