# Saathi (SH-105): Session Handoff / Context Note

Written 2026-09-19 at the end of a long working session so anyone (you, a teammate, or a fresh Claude session) can pick up
exactly where we stopped. Everything here was checked against the repo and the running services, not written from memory.
Where something is **not verified**, it says so.

---

## 1. TL;DR

- Four services now talk to each other and share **one memory layer (Person B, Supabase)**: Person B (memory), Person C (guidance + safety),
  Dev-A (WhatsApp + speech-to-text), and the React Native / Expo app (`saathi-app`) plus its small NLP service.
- All work is on local branch **`main`**, **30 commits ahead of `origin/main`, nothing pushed**. A large batch of **saathi-app / NLP / mic work is uncommitted** (section 5).
- The app runs (verified in a browser build: Home, Goals, Ledger, Chat). The **mic button on a real phone is unverified**: the last fix (upload via `expo-file-system` `File`) compiled but has not been confirmed on your phone yet.
- Biggest open items: commit the uncommitted work; map your real WhatsApp number (`PHONE_USER_MAP`) so the bot shares memory; confirm the mic on the phone; decide a few product questions (section 8).

---

## 2. Architecture (who does what)

```
                 WhatsApp (Twilio sandbox) --ngrok--> Dev-A :8001  (FastAPI, Whisper STT, regex parser, router)
                                                        |  |
 Expo app (phone/web) --mic--> Dev-A /api/transcribe ---+  |
   |   \                                                   v
   |    \--> saathi-nlp :8002 (intent + entities ONLY)   Person C :8000 (FastAPI, RAG + Groq LLM, safety rules)
   |                                                       ^  |
   +--------------> Person B :5000 (Node/Express) <--------+  +--> Groq
                       |   (pots, ledger, goals, transactions, audit log)
                       v
                   Supabase Postgres  = THE shared memory
```

| Service | Path | Port | Stack | Role |
|---|---|---|---|---|
| **Person B** | `src/` | 5000 | Node/Express + pg | Source of truth: pots, ledger, goals, transactions, audit log |
| **Person C** | `person_c/` | 8000 | FastAPI, Chroma RAG, Groq | The **only** service allowed to use an LLM for financial content (masterplan s8) |
| **Dev-A** | `services/interaction/` | 8001 | FastAPI, Whisper | WhatsApp webhook, safety-first router, `/api/transcribe` |
| **NLP** | `saathi-app/nlp-service/` | 8002 | Node/Express + Groq + zod | Language understanding only (intent, amount, category, language) |
| **App** | `saathi-app/` | 8081 (Metro) | Expo SDK 57, RN 0.86, expo-router | Home/Lakshya/Khata/Sahayata tabs + Safety Shield |

**Same memory for app and WhatsApp bot: yes, by design.** Both go through Person B; Dev-A has no store of its own. Two conditions:
1. Identity: the app acts as `EXPO_PUBLIC_USER_ID=meera_001`; WhatsApp senders arrive as `whatsapp:+91...` and Person B maps them to a user via **`PHONE_USER_MAP`**. That variable is **not set in the root `.env`**, so real WhatsApp messages are currently rejected ("Unknown phone number"). **Pending: needs your real number.**
2. Same Person B instance/database (Supabase). Don't run a second Person B in in-memory mode on port 5000 while Twilio traffic is flowing.

### Message routing (identical in Dev-A/WhatsApp and the app)
1. **Safety check first**: if the text trips the safety trigger (mirror of `person_c/app/safety/rules.py`), it goes to Person C `/api/v1/safety/check` and is **never** recorded as a transaction (even "paid 500 to verify your KYC now").
2. Otherwise NLP (app) / regex parser (Dev-A) classifies it.
3. Transaction with amount and confidence >= 0.6 -> Person B `POST /api/transactions`; reply = Person B's own confirmation. Incomplete -> clarification question, nothing recorded.
4. Everything else -> Person C `/api/v1/integration/person_a/guidance`.
5. Any failure -> honest "nothing was recorded / couldn't reach" message. No canned or fixture replies.

---

## 3. Repo and git state

- Branch `main`, HEAD `56ec1e5`. `origin/person-a` and `origin/person-d` are the same commit (`a71be25`) and are now merged. `origin/main` is still `76ad541`. **Nothing has been pushed.**
- Merged into main this session: `origin/Person-B`, `origin/dev-a/interaction-ingestion`, `origin/Person-C`, `origin/person-d`.

### Commits made this session (oldest -> newest, after the original Person-B merge)
| Hash | What |
|---|---|
| `81474bb` | Merge dev-a/interaction-ingestion into `services/interaction/` |
| `15c9f5b` | Dev-A webhook -> Person B `/api/transactions` (confidence-gated, honest failure replies), integration test with cleanup |
| `efdaffc` | Person B gap fixes: `saving`/`business` types, phone->user resolver, unknown-user 404, category map (vegetables -> cash), tests |
| `4cba09d` | Test cleanups for atomicity/postgresStrict so the suite leaves no DB rows |
| `e13b126` | Merge Person-C into `person_c/` |
| `54ed4c3` | Person C client: read Person B's live response shape (nested `pots`), default port 5000 |
| `6f1d8b0` | Person C: `UnknownUserError` vs outage, `requirements.txt`, `.env.example`, port note |
| `b29bcd5` | Audit trail: Person B `POST /api/audit-log` + Person C `log_audit()` on all four guidance endpoints (fire-and-forget) |
| `c5659ae` | Dev-A routes non-transactions to Person C (guidance / safety); stopped tracking `.pyc` |
| `321ccb1` | Person C safety rules made context-aware (FP 50% -> 0% on a 52-message corpus), Dev-A mirror + drift test |
| `15de5ea` | Safety check runs **before** the transaction path; reversed-order KYC rule |
| `dbd2e9d` | Person B resolves phone numbers on **all** user-taking routes; never auto-creates users for phones |
| `b8430f7` | Person C replies capped/sanitized for WhatsApp (plain text, <= 1500 chars, sentence-clean) |
| `56ec1e5` | Merge person-d into `saathi-app/` |

---

## 4. What was built, by area

### Person B (`src/`)
- Accepts `saving` (-> bank/shg/post_office, default bank) and `business` (-> business pot) per the shared contract.
- `src/services/userResolver.js` + `resolveOrReject()`: mapped `whatsapp:+91...` -> real user; **unmapped phone -> 404 `unknown_user`** (422 on `/api/transactions`), never auto-created. Applied to financial-state, audit-log (GET/POST), goals (all routes), ledger (GET/POST), transactions.
- `GET /api/financial-state` returns 404 for unknown users instead of serving Meera's in-memory state.
- `POST /api/audit-log`: accepts only `GUIDANCE_GIVEN`, `SAFETY_CHECK_PERFORMED`, `SIMULATOR_RUN` (cannot forge Person B's own actions).
- Category map extended for everything Dev-A's parser emits.

### Dev-A (`services/interaction/`)
- `app/person_c.py`: safety trigger patterns (a copy of Person C's rules; a drift test compares them) + `ask_person_c()`.
- `app/main.py`: `route_message()` (safety -> Person B -> Person C), `POST /api/transcribe` (multipart audio -> the **same** `transcribe_audio` Whisper function the WhatsApp voice path uses), CORS.
- Shared test corpus: `person_c/tests/safety_corpus.json` (39 ordinary, 24 scam messages).

### Person C (`person_c/`)
- Client fix for Person B's live shape; audit logging via `BackgroundTasks` (never delays or breaks a reply).
- `app/safety/rules.py` narrowed to context-aware patterns; reversed-order KYC rule.
- `app/formatting/plain_text.py`: prompt rules + hard safety net (strip markdown, cut at a sentence boundary <= 1500 chars). Live example: 3,629-char markdown reply -> 661 chars plain text.
- CORS added (uncommitted).

### saathi-app (all uncommitted except the merge)
- **Services layer** (`src/services/`): `apiConfig.js` (one `EXPO_PUBLIC_*` var per service), `http.js`, `personBClient.js`, `personCClient.js`, `messageRouter.js`, `safetyTrigger.js`, `viewModels.js`, `liveData.js`, `voiceClient.js`, `voiceRuntime(.native).js`; hooks `useLiveData.js`, `useVoiceRecorder.js`.
- **Screens live**: Money Pot Map (`/api/financial-state`), Ledger (`/api/ledger`), Lakshya/Goals (`/api/goals`, no fixture at all), Chat (router), Safety Shield (paste-in -> Person C). Home and Ledger fall back to `fixture.js` **only** on failure, with a visible "offline sample data" banner.
- **NLP service boundary fix** (`nlp-service/`): the model can no longer write replies (schema has no free-text field; prompt rewritten; `reply_text` is now a server-side clarification template or empty). Prompt also got an explicit "always extract a translated category" rule (a real bug: category came back `null` ~1 in 3 times).
- **Mic**: expo-audio records; audio goes to Dev-A `/api/transcribe` (Whisper); the transcript goes through the same routing as typed text. `expo-audio` + `expo-file-system` installed; mic permission text in `app.json`.
- Removed `src/components/app-tabs.web.tsx` (Expo starter leftover that hid the Goals/Ledger tabs on web; staged deletion).
- Double-send guard in Chat (`sendingRef`).
- Docs updated: `saathi-app/README.md`, `nlp-service/README.md`, `src/services/INTEGRATION.md`, adapter header.

---

## 5. Uncommitted work (needs committing)

`git status` at the time of writing: modified `person_c/app/api/main.py` (CORS), `services/interaction/app/main.py` (CORS + `/api/transcribe`), everything under `saathi-app/` listed in section 4, plus new files: `services/interaction/tests/test_transcribe_endpoint.py` and all new `saathi-app/src/services/*`, `src/hooks/*`, `.env.example`, `__tests__/`.

Suggested split into separate commits:
1. `feat(nlp): remove LLM-generated replies from saathi-nlp (compliance boundary)` (`nlp-service/*`, its README).
2. `feat(saathi-app): wire screens to Person B / Person C, safety-first chat routing` (services, hooks, screens, tests, docs, `.env.example`, `app-tabs.web.tsx` removal).
3. `feat: mic -> Whisper` (Dev-A `/api/transcribe` + test, `voiceClient`, `voiceRuntime*`, `useVoiceRecorder`, `app.json`, package files).
4. `chore: CORS for Expo web (Person C, Dev-A, NLP)`.

Do **not** commit: `saathi-app/.env.local` (git-ignored, holds the LAN IP), `person_c/.env` (Groq key), root `.env` (Supabase URL), `saathi-app/nlp-service/.env` (if created; **verify it is ignored**), `node_modules`.

---

## 6. How to run everything (Windows PowerShell, from the repo root)

Use `curl.exe` (not `curl`) for health checks: `curl.exe http://localhost:8000/health`.

```powershell
# 1. Person B (uses root .env -> Supabase)
npm start                                   # :5000

# 2. Person C  (must use Python 3.11: it has chromadb/groq; the default `python` is 3.13 and does NOT)
cd person_c
& "C:\Users\shyam\AppData\Local\Programs\Python\Python311\python.exe" -c "import sys,types; m=types.ModuleType('paddleocr'); m.PaddleOCR=lambda *a,**k: None; sys.modules['paddleocr']=m; import uvicorn; uvicorn.run('app.api.main:app', host='0.0.0.0', port=8000)"

# 3. NLP service (needs GROQ_API_KEY; create its .env once)
cd saathi-app\nlp-service
Select-String '^GROQ_API_KEY=' ..\..\person_c\.env | ForEach-Object { $_.Line } | Set-Content .env
npm start                                   # :8002

# 4. Dev-A (your venv; --host 0.0.0.0 so a phone can reach it)
cd services\interaction
.\venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 5. Expo
cd saathi-app
npx expo start --clear                      # QR in this window; Expo Go URL exp://<PC-LAN-IP>:8081
```

- **`saathi-app/.env.local`** (git-ignored) currently points all services at this PC's LAN IP **`172.16.12.213`** (Wi-Fi `VNRVJIET_WIFI 6`, classed *Public*). If the IP changes, edit the 4 URLs and restart Expo with `--clear`. Template: `saathi-app/.env.example`.
- `EADDRINUSE`: find the holder with `Get-NetTCPConnection -LocalPort 5000 -State Listen`.
- **Two Dev-A servers were on 8001** (old `127.0.0.1` one, started 9:45 PM and fronted by the ngrok/Twilio tunnel, plus a new `0.0.0.0` one). Both run the same code. You can stop the old one (PID was 31884); the new one also answers `localhost`, so ngrok keeps working.
- **ngrok** (running since ~8 PM) forwards to `http://localhost:8001` (Twilio WhatsApp sandbox -> `/webhooks/whatsapp`).
- Windows Firewall: Python 3.11/3.13 and Node have allow rules for the *Public* profile. If the phone can't reach a port, allow 5000/8000/8001/8002/8081 inbound (admin PowerShell `New-NetFirewallRule ...`).
- `person_c` outside pytest imports `paddleocr` at startup (not installed): the `-c` snippet above stubs it. OCR endpoint doesn't work.

### Tests (all passing at last run)
| Suite | Command | Result |
|---|---|---|
| Person B | `DATABASE_URL= npx jest --runInBand` (in-memory) or `npm test` (live Supabase) | 34 suites / 223 tests live; in-memory: only the DB-dependent suites fail by design |
| Person C | `cd person_c; <py3.11> -m pytest -q` | 256 passed (`test_api_education_mode_still_works` failed intermittently twice, mock-LLM path, unexplained) |
| Dev-A | `cd services/interaction; <py3.11> -m pytest -q` | 118 passed |
| App logic | `cd saathi-app; npm test` (`node --test`) | 64 passed |
| NLP | `cd saathi-app/nlp-service; npm test` | 21 passed |

---

## 7. Verified vs. not verified

**Verified live (real HTTP, real Groq):** transaction -> Person B -> correct pot; guidance reply uses live numbers; KYC scam and "paid 500 to verify your KYC now" go to safety and are never recorded; audit rows (`GUIDANCE_GIVEN`, `SAFETY_CHECK_PERFORMED`) appear via phone-mapped user; Hinglish "aaj silai se 800 rupaye mile" -> tailoring -> business pot; browser build shows live Home/Goals/Ledger and a real Chat reply; Whisper endpoint returns a transcript for a synthesized WAV over the LAN address; Android bundle compiles with the native voice adapter.

**Not verified:** the mic on a real phone (last error was `Unsupported FormDataPart implementation`; fixed by switching to `expo-file-system` `File`, untested on device; docs were ambiguous about `new File(uri)` accepting a plain `file://` string); Safety Shield screen in a browser/phone; `expo lint`; iOS; the offline-fallback banner on a real failure; WhatsApp voice notes with the new code path.

---

## 8. Pending / open questions (prioritized)

1. **Commit the uncommitted work** (section 5), then decide about pushing (30 local commits; `origin/main` untouched).
2. **Confirm the mic on your phone.** If it still fails, the error text now names the URL and cause; send it.
3. **Set `PHONE_USER_MAP`** in Person B's environment (e.g. `{"+91XXXXXXXXXX":"meera_001"}`) with your real WhatsApp number so the bot and the app share Meera's memory. Currently WhatsApp messages are rejected.
4. **Ledger vs Chat gap:** a business sale recorded from Chat is a *transaction* (business pot) but not a *ledger entry*, so the Khata tab doesn't show it. Needs a product decision (make `business` transactions create a ledger entry? ask for cost?). Also `business` credits the full amount as revenue (masterplan s5 wants profit = revenue - cost): see `TODO(business-cost)` in `src/routes/transactions.js`.
5. **Person C safety response has no classification** (only text); the UI/WhatsApp can't show SAFE/CAUTION/SUSPICIOUS. Add `classification` to its response.
6. **Person C advice quality:** it sometimes suggests moving locked chit money, invents "last month", and ignores the business pot. Tighten its prompts/facts.
7. **Strictness decision:** non-phone unknown ids still auto-create a user on goals/ledger/transactions POST. Rejecting all unknown users is a bigger change.
8. **Groq rate limits (429):** every chat question = NLP call + Person C call; tests and demos hit free-tier limits. Consider caching, a cheaper model for NLP, or a Person-C-only path.
9. **NLP down blocks even plain questions** (no direct fallback to Person C).
10. **Person C requirements:** `paddleocr` import should be lazy so it starts without the stub; `requirements.txt` doesn't list it.
11. **CORS is wide open** (`*`) on Person C, Dev-A, NLP (matches Person B's `cors()`); tighten for production.
12. **WhatsApp reply length:** Person C caps at 1500 chars; Dev-A's "I heard: <transcript>" prefix is unbounded, so a very long voice transcript could push a reply over Twilio's 1600 limit. Add a Dev-A-side cap.
13. **Dead buttons** (no handlers): Home bell/audio/pot tap; Ledger "Turn this into a listing", "View All", "+ Nayi Entry"; Safety Shield audio + "Talk to a Sakhi". Ledger voice-memo card was removed (no backend).
14. Flaky test to investigate: `person_c/tests/test_phase3_api.py::test_api_education_mode_still_works`.
15. `SESSION` leftovers: there is a duplicated comment line in `services/interaction/app/person_c.py` (cosmetic).

### Things we can do next (options)
- Unify the two routers: expose Dev-A's `route_message` as a JSON endpoint and let the app call it (removes the JS copy of the safety patterns, keeps one routing brain).
- Add a `/api/voice` end-to-end (transcribe + route) so WhatsApp and app share the exact same pipeline.
- Marketplace listing from a ledger entry (masterplan "should-have").
- Person C Decision Simulator surfaced in the app (endpoint exists: `/api/v1/simulator`).
- Push to a remote and set up CI (run all five suites).

---

## 9. Data / secrets hygiene

- **Supabase** (root `.env`, `DATABASE_SSL=true`): seed = 1 user (`meera_001`), 5 pots (cash 2000, bank 5000, shg 2500, chit 4000, post_office 5000 = total 18,500), 1 goal (Education 8000/20000), 1 ledger entry ("Initial seed entry"), **0 transactions**. At the last check: `audit_logs` = 50 (baseline was 33; the extra rows are `STATE_READ`/`GUIDANCE_GIVEN`/`SAFETY_CHECK_PERFORMED` from testing and phone use; **transactions 0, pots 5, users 1 = clean**). Optionally delete audit rows above id 782 for `meera_001` (check first that none are real usage).
- History: earlier test runs leaked `ghost_user_*` rows and test transactions; all were removed, and the leaking tests were fixed.
- **Secrets:** Groq key lives in `person_c/.env` (git-ignored) and is passed to the NLP service by env var. Never print or commit it. `EXPO_PUBLIC_*` values are visible in the app bundle: no secrets there.
- Test users: use a dedicated id (e.g. `test_dev_a_integration`), never `meera_001`/`ghost_user_%`, and clean up in teardown.

---

## 10. Working notes for the next Claude session

- **`saathi-app/AGENTS.md` says: read the versioned Expo docs (https://docs.expo.dev/versions/v57.0.0/) before writing Expo code.** SDK 57 differs from older tutorials (e.g. Expo's global `fetch` rejects `{uri,name,type}` FormData parts).
- Python: use the **3.11** interpreter for Person C/Dev-A tests (`...\Python311\python.exe`); the default `python` is 3.13 without the deps. Use `PYTHONDONTWRITEBYTECODE=1` so `.pyc` files don't dirty the tree.
- Heredocs in the Bash tool mangled backslashes and `\n` in Python edit scripts several times; write edit scripts with the Write tool and raw strings, matching CRLF (the repo has mixed line endings).
- The permission classifier blocked scripted deletes on the shared DB twice; it accepted exact-id, single-transaction cleanups once the user authorized them. Always preview rows first.
- Real Groq calls happen in Person C's live test and via the NLP service; keep runs small to avoid 429s.
- Don't kill processes you didn't start (the user's Dev-A on 8001 / ngrok); the user runs those.
- The `person-a` and `person-d` branches contained `saathi-app/nlp-service` calling Groq directly; that boundary violation is fixed in the working tree (uncommitted) — make sure it is committed before anything merges to a shared branch.
- Compliance rule (masterplan s8): **only Person C** may use an LLM for financial content. The NLP service is classification-only; keep it that way.

---

## 11. Key files quick index

- Routing: `saathi-app/src/services/messageRouter.js`, `services/interaction/app/main.py` (`route_message`)
- Safety rules (source of truth): `person_c/app/safety/rules.py`; mirrors: `services/interaction/app/person_c.py`, `saathi-app/src/services/safetyTrigger.js`; corpus: `person_c/tests/safety_corpus.json`
- Person B routes: `src/routes/{transactions,financialState,auditLog,goals,businessLedger}.js`, resolver `src/services/userResolver.js`
- Person C output cleaning: `person_c/app/formatting/plain_text.py`, prompts `person_c/app/education/llm.py`
- App config: `saathi-app/src/services/apiConfig.js`, `saathi-app/.env.example`
- Masterplan: `masterplan.pdf` (sections 2 fixture, 5 ledger flow, 8-9 architecture/team split)
- This note: `SESSION_HANDOFF.md`
