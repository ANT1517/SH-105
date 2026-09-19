# Saathi NLP Service

Independent Node.js + Express backend service providing NLP processing and structured intent recognition for the Saathi financial assistant.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
PORT=8002
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

> **Security Note**: `GROQ_API_KEY` must remain strictly on the backend and must never be exposed or imported in React Native or any client-side code.

## Setup & Running

```bash
cd nlp-service
npm install
npm start
```

For live reloading during development:
```bash
npm run dev
```

## Endpoints

### 1. Health Check
- **Method:** `GET`
- **Route:** `/health`
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "saathi-nlp"
  }
  ```

```bash
npm test
```

## Endpoints

### 1. Health Check
- **Method:** `GET`
- **Route:** `/health`
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "saathi-nlp"
  }
  ```

### 2. Understand Message
- **Method:** `POST`
- **Route:** `/api/nlp/understand`
- **Request Body:**
  ```json
  {
    "text": "मुझे सिलाई से ₹800 मिले",
    "conversation": [] // optional context
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "intent": "record_income",
    "transaction": {
      "type": "income",
      "amount": 800,
      "category": "tailoring"
    },
    "language": "hi",
    "confidence": 0.97,
    "reply_text": ""
  }
  ```
- **Error Codes:**
  - `400 Bad Request`: Request body fails schema validation (empty text or >2000 chars)
  - `422 Unprocessable Entity`: Model output violated required runtime Zod schema
  - `502 Bad Gateway`: Model returned invalid JSON or upstream Groq service failure
  - `503 Service Unavailable`: Backend server missing GROQ_API_KEY configuration

## Schema

Response contract defined in `schema.js` using Zod runtime validation:
- **Intents**: `record_income`, `record_expense`, `record_saving`, `record_commitment`, `business_sale`, `financial_question`, `goal_question`, `education_question`, `safety_check`, `unknown`
- **Languages**: `en`, `hi`, `te`, `mixed`, `unknown`
- **Transaction**: `{ type: "income" | "expense" | "saving" | "commitment" | "business", amount: number | null, category: string | null } | null`
- **Confidence**: `number` (0 to 1)
- **Reply Text**: `string`, composed by the server (never by the model). It is a short clarification prompt (in en/hi/te) when a
  transaction is missing its amount or has low confidence, and an empty string otherwise.

## LLM boundary

Per masterplan section 8, only Person C may use an LLM to generate financial content. This service therefore only
**understands** input: the model returns `intent`, `transaction`, `language` and `confidence`, and its output schema
(`NlpModelOutputSchema`) has no free-text field. Anything else a model returns is discarded. Questions, goals, education and
safety intents are answered by Person C (see `src/services/messageRouter.js` in the app).
