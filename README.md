# Saathi — Financial Memory Backend (Person B)

This is the **Person B / Dev B** backend service for the **Saathi** platform as specified in the *Saathi Final Build Plan v3*.

Person B acts as the single source of truth for user financial state, serving the **Money Pot Map**, managing **business ledger storage**, executing **duplicate transaction detection**, tracking **goals**, and recording **immutable audit logs**.

---

## 🏛 Architecture & Contracts

```mermaid
flowchart TD
    A[Person A: WhatsApp / Voice Bot] -->|POST /api/transactions| B[Person B: Financial Memory Backend]
    B -->|GET /api/financial-state| C[Person C: RAG & Financial Guidance]
    B -->|GET /api/financial-state| D[Person D: Money Pot Map Dashboard]
    D -->|POST /api/ledger| B
```

### 1. Person A Contract (Input Ingestion)
Person A sends normalized financial inputs via `POST /api/transactions`.
```json
{
  "user_id": "meera_001",
  "channel": "whatsapp_voice",
  "input_type": "voice",
  "raw_text": "I earned 800 from tailoring today",
  "normalized_text": "earned 800 from tailoring",
  "parsed_transaction": {
    "type": "income",
    "amount": 800,
    "category": "tailoring"
  },
  "confidence": 0.95
}
```
*Person B internally maps `category` to the corresponding financial pot (`cash`, `bank`, `shg`, `chit_committed`, `post_office`, `business`).*

### 2. Person C & D Contract (Financial State)
Person C and Person D retrieve unified state via `GET /api/financial-state` (or `/api/financial-state/mock` for Hour 0–2 mock contract).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/saathi_db
NODE_ENV=development
PHONE_USER_MAP={"+919876543210":"meera_001"}
```
`PHONE_USER_MAP` is required for the WhatsApp demo: Twilio sends the sender as `whatsapp:+91...`, and this maps
phone numbers to existing user_ids. Unmapped phone numbers are rejected with HTTP 422.

### 3. Run Server
```bash
npm start
```
Dev server with hot reloading:
```bash
npm run dev
```

### 4. Run Tests
```bash
npm test
```

---

## 📡 API Endpoints

| Method | Endpoint | Description | Consumed By |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health status | All / Monitoring |
| `GET` | `/api/financial-state/mock` | Hour 0–2 exact Section 2 Meera demo fixture | Person C, Person D |
| `GET` | `/api/financial-state` | Live unified Money Pot Map financial state | Person C, Person D |
| `POST` | `/api/transactions` | Ingests normalized transaction & detects duplicates | Person A |
| `POST` | `/api/ledger` | Records informal business revenue/cost & computes profit | Person D (Business view) |
| `GET` | `/api/ledger` | Retrieves business ledger history | Person D |
| `GET` | `/api/goals` | Retrieves active savings goals & progress | Person C, Person D |
| `POST` | `/api/goals/progress` | Updates savings progress for goals | Person B / Person D |
| `GET` | `/api/audit-log` | Retrieves immutable audit trail | Compliance & Monitoring |

---

## ⚠ Known gaps

- **Business transactions record revenue, not profit.** `type: "business"` on `POST /api/transactions` credits the full
  amount to the business pot with no cost tracking. masterplan.pdf s5 specifies profit = revenue - cost. Revisit once
  Dev-A's parser can supply or prompt for cost (see `TODO(business-cost)` in `src/routes/transactions.js`).
- **Real demo phone number not set.** `PHONE_USER_MAP` in `.env.example` holds a placeholder; set the real Twilio demo
  number in your `.env`.

## 🛡 Features

1. **Money Pot Map Data Model**: Dynamically aggregates balances across `cash`, `bank`, `shg`, `chit_committed`, `post_office`, and `business`.
2. **Duplicate Transaction Detection**: Protects financial memory from duplicate WhatsApp / voice note retries within a 5-minute sliding window.
3. **Informal Business Ledger**: Automates profit calculation (`profit = revenue - cost`) for micro-enterprise activities (tailoring, pickle sales) and updates business pot balance.
4. **Goals Tracking**: Tracks target vs saved progress with percentage calculation.
5. **Immutable Audit Logging**: Logs all state changes, transaction ingests, deduplication events, and goal adjustments.
6. **PostgreSQL + Graceful Fallback**: Fully typed SQL schema for PostgreSQL (`src/db/schema.sql`) with in-memory fallback for zero-downtime mock testing.
