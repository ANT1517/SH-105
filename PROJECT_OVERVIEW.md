# Saathi: what this project does

**Saathi** ("companion") is a money assistant for people in India's informal economy: home tailors, small shop owners,
women who run a household on cash, a chit fund and a self-help group (SHG). It lets them keep track of their money and
get safe, plain-language guidance **by talking or typing in WhatsApp or a mobile app**, with no banking jargon and no
forms to fill in.

The demo user is **Meera**, a tailor who also sells pickles. Her money is not one bank balance. It sits in several places.

---

## The problem

- Money lives in many "pots": cash at home, a bank account, an SHG, a chit fund (locked, cannot be spent), the post office,
  and business income. No ordinary app understands this.
- Records are kept in the head or on paper, so people do not know their real profit or how far they are from a goal.
- Scam messages ("verify your KYC now", "pay to release your prize") cost people their savings.
- Many users are more comfortable speaking (Hindi, Hinglish, Telugu) than typing.

## What Saathi does

| Feature | What the user does | What happens |
|---|---|---|
| **Record by chat or voice** | Sends "I earned 800 from tailoring today" on WhatsApp, or speaks it into the app's mic | It is understood, saved to the right pot, and confirmed back. Business income also goes into the business ledger. |
| **Money Pot Map (Tijori)** | Opens Home | Sees every pot and the total. The chit fund is shown as committed. |
| **Len-Den (Transactions)** | Opens the Len-Den tab | Sees every income and expense, newest first. |
| **Khata (business ledger)** | Opens Khata | Sees business revenue, cost and profit. Adds an entry by form, or **scans a bill** with the camera (OCR) to add a cost. |
| **Lakshya (Goals)** | Opens Lakshya | Sees progress towards a goal such as "Education, 8,000 of 20,000". Sets a new goal. |
| **Sahayata (Chat)** | Asks "Can I afford to buy a machine?" | Gets guidance based on **her own real numbers**, not generic advice. |
| **Safety Shield** | Pastes a suspicious message (or Chat flags it) | Gets a clear "looks like a scam" or "no known pattern" verdict and a plain explanation. Scam text is **never** recorded as a transaction. |

## How a message is handled

1. **Safety check first.** If the text looks like a scam, it goes to the safety service and is never saved as money.
2. Otherwise the message is classified (transaction, question, or something else).
3. A transaction with an amount and enough confidence is saved. If details are missing, Saathi asks a clarification question.
4. A question goes to the guidance service, which answers from the user's live data.
5. If any service is down, Saathi says honestly that nothing was recorded. There are no canned or fake replies.

## The parts

```
 WhatsApp (Twilio) --+                          +--> Person C: guidance + safety (LLM, RAG)
                     +--> Dev-A (voice, router) |
 Mobile app (Expo) --+--> NLP service (intent)  +--> Person B: memory (Supabase Postgres)
```

| Part | Folder | Role |
|---|---|---|
| **Person B**: financial memory | `src/` (port 5000) | The single source of truth: pots, ledger, goals, transactions, audit log. Node/Express on Supabase Postgres. |
| **Person C**: guidance and safety | `person_c/` (port 8000) | Explains and advises using the user's live data, checks for scams, and reads bill photos with OCR (PaddleOCR). **The only part allowed to use an LLM for financial content.** |
| **Dev-A**: WhatsApp and voice | `services/interaction/` (port 8001) | Receives WhatsApp messages, converts voice to text (Whisper), routes each message. |
| **NLP service** | `saathi-app/nlp-service/` (port 8002) | Language understanding only: intent, amount, category. It never writes replies. |
| **App** | `saathi-app/` (Expo / React Native) | Tabs: Tijori, Lakshya, Khata, Len-Den, Sahayata, plus the Safety Shield. |

The WhatsApp bot and the app read and write through the same memory layer, so a sale recorded on WhatsApp shows up
in the app.

## Design rules

- **One source of truth.** Only Person B stores money data.
- **LLM boundary.** Only Person C may use an LLM for financial content, so advice stays grounded and auditable.
- **Safety before money.** A suspicious message is checked before anything is recorded.
- **Honest failure.** If something cannot be saved or reached, the user is told.
- **Audit trail.** Guidance and safety checks are logged.

## Known limits (honest list)

- Every business sale counts as full revenue with no cost, so profit is overstated until cost is captured.
- The safety verdict is a two-level yes/no from scam-pattern rules, not a graded risk score.
- Chat questions make two LLM calls, so free-tier rate limits (HTTP 429) can appear during heavy testing.
- Guidance quality still needs tightening (for example, it should never suggest spending locked chit money).
- CORS is open for development and should be restricted for production.

## Running it

See `README.md` and `SESSION_HANDOFF.md` for setup and run commands, environment variables (`PHONE_USER_MAP`, service
URLs) and tests.
