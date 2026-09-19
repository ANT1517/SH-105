# Saathi Service Integration Architecture & Boundaries

This document defines the interface boundaries, contracts, and future integration paths between the **NLP service**, **Dev-A (voice & normalized input)**, **Person B (financial ledger & state engine)**, and **Person C (nudges, goals, & guidance routing)**.

---

## 1. Planned End-to-End Pipeline

```
Frontend (React Native App)
   │
   ▼
NLP Service (POST /api/nlp/understand)
   │
   ▼
NLP Integration Adapter (nlpIntegrationAdapter.js)
   │
   ▼
Dev-A Normalized-Input Contract
   │
   ▼
Person B Transaction API / Ledger Engine
   │
   ▼
Updated Authoritative Financial State
   │
   ▼
Frontend Refresh / UI Update
```

---

## 2. Current NLP Output Specification

The independent NLP service (`POST /api/nlp/understand`) is responsible exclusively for **Language Understanding**:

```json
{
  "intent": "record_income | record_expense | record_saving | record_commitment | business_sale | financial_question | goal_question | education_question | safety_check | unknown",
  "transaction": {
    "type": "income | expense | saving | commitment | business",
    "amount": 800,
    "category": "tailoring"
  },
  "language": "en | hi | te | mixed | unknown",
  "confidence": 0.96,
  "reply_text": ""
}
```

If the input is ambiguous or incomplete (e.g. *"I got some money from tailoring"*), the NLP layer:
- Sets `transaction.amount: null` (never hallucinates an amount)
- Assigns lower confidence (`< 0.60`)
- Produces a clarification request in `reply_text` (a deterministic server template, not model text)

---

## 3. Future Person B Adapter & Semantic Alignment

### Current Semantic Compatibility Gap
- **Dev-A normalized input** specifies transaction categories:
  - `income`, `expense`, `saving`, `commitment`, `business`
- **Person B backend** defines its own accounting ledger semantics (e.g., specific pots, double-entry credits/debits, account identifiers).

### Adapter Boundary Rule
- `nlpIntegrationAdapter.js` converts raw NLP output into a neutral action object.
- It **does not silently coerce or guess Person B's semantics** until Person B's contract is formally integrated.
- Origin channel is dynamically tracked (e.g., `react_native_chat`) and **never hardcoded as `"whatsapp"`**.
- Person B is **not called** from the adapter at this step; `downstream.personBExecuted: false`.

---

## 4. Future Person C Guidance Routing

When the user expresses intent relating to advisory, goals, education, or fraud checks:
- `intent: "goal_question"` or `"education_question"` $\rightarrow$ Routes to Person C's Goal Advisor engine.
- `intent: "safety_check"` $\rightarrow$ Routes to Safety Shield evaluation module.
- `intent: "financial_question"` $\rightarrow$ Person C generates personalized conversational guidance using authoritative balances retrieved from Person B.

---

## 5. Future Dev-A Voice Ingestion Path

- Voice inputs captured via mic (audio recording or voice memo) pass into Dev-A's speech-to-text pipeline (ASR / Bhashini / Whisper).
- The transcribed transcript feeds directly into `understandMessage(transcript)` in `nlpClient.js`.
- The origin metadata tracks `channel: "voice_memo"` or `channel: "voice_chat"`.

---

## 6. Why NLP Does NOT Mutate Money

1. **Separation of Concerns**: NLP is probabilistic; ledger accounting is deterministic and transactional.
2. **Auditability**: Financial records require strict ledger transaction IDs, idempotent idempotency keys, and account validation.
3. **Safety & Hallucination Prevention**: If the language model misunderstands or misclassifies a number (e.g., interpreting *"2 sarees"* as ₹2), an automatic balance mutation could corrupt the user's financial records.
4. **Authoritative Confirmation**: Mutations must be explicitly committed by the dedicated transaction service (Person B) after user verification or high-confidence transaction validation.

---

## 7. Authoritative Source of Truth for Balances

| Component | Responsibility | Authoritative? |
| :--- | :--- | :--- |
| **NLP Service (`saathi-nlp`)** | Language parsing, entity extraction, intent detection | ❌ No |
| **Frontend (`ChatScreen`, `theme`)** | Display, user interactions, loading/confidence states | ❌ No |
| **Person C Guidance Engine** | Nudges, savings projections, goal recommendations | ❌ No |
| **Person B Ledger Engine** | Pot balances, transaction journal, running totals |  **YES (Sole Source of Truth)** |


---

## 8. Implemented chat routing (Step 5)

`src/services/messageRouter.js` implements the pipeline above. Order (the same as Dev-A's WhatsApp webhook):

1. **Safety check first.** A message that trips the safety trigger (`safetyTrigger.js`, a tested copy of Person C's rules) goes to
   Person C `POST /api/v1/safety/check` and is never treated as a transaction.
2. **NLP understanding** (`nlpClient.js`): intent + entities only. The NLP service returns no advice.
3. **Transaction** with an amount and confidence >= 0.6: an explicit normalized-input payload is POSTed to Person B
   `/api/transactions`, and the reply is Person B's own confirmation. Incomplete transactions get a clarification question and record nothing.
4. **Everything else** goes to Person C `POST /api/v1/integration/person_a/guidance`.

Failures are reported honestly ("nothing was recorded"); no message gets a canned or fixture reply.
The adapter itself still does not call any service: `messageRouter.js` does.
