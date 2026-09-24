# CareBridge AI

**Offline-first continuity of care: we connect the patient's journey from hospital to home, even when there is no internet.**

CareBridge AI combines three hackathon healthcare problems into **one patient journey**:

| # | Problem | How CareBridge solves it |
|---|---|---|
| 11 | **Continuity of care**: serious patients get lost after discharge | Discharge automatically creates a follow-up referral with a deadline for the family doctor. Overdue referrals escalate. |
| 10 | **Digital bridge for rural areas**: no stable internet | Nurses record home visits offline (PWA + IndexedDB outbox). Data syncs automatically and idempotently when the connection returns. |
| 8 | **Patient voice**: no safe channel for feedback | Ward QR codes open an anonymous feedback form. AI classifies sentiment, topics and priority in Uzbek, Russian and English. |

```
Hospital ─► discharge ─► automatic referral ─► family doctor ─► rural nurse
   ─► offline home visit ─► sync ─► AI risk prioritization ─► admin command center
                                                 ▲
                   anonymous QR feedback ─► AI feedback intelligence
```

---

## Architecture

```
┌──────────────────── Next.js 15 PWA (apps/web) ────────────────────┐
│  Admin / Doctor / Nurse UI          Public QR feedback (/f/:code) │
│  Service worker (app shell cache)   IndexedDB via Dexie           │
│  Sync engine ── outbox (CREATE/UPDATE ops, retry + backoff) ──┐   │
└──────────────────────────┬────────────────────────────────────┼───┘
                   REST + JWT (Bearer)                  POST /api/sync/batch
┌──────────────────────────▼────────────────────────────────────▼───┐
│  NestJS 11 modular monolith (apps/api)                            │
│  auth · users · facilities · patients · referrals · follow-ups ·  │
│  sync · ai · feedback · analytics · audit                         │
└──────────────┬─────────────────────────────────────┬──────────────┘
               │ Prisma 6                            │ optional
        PostgreSQL 16                     Gemini (server-side, structured JSON)
                                          + deterministic safety rules
```

- **Modular monolith**: one deployable API, organized by domain.
- **Data model**: Facility, User, Patient, Observation, Referral, FollowUp, RiskAssessment, Feedback, FeedbackAnalysis, AuditLog. UUID keys, enums, foreign keys, and indexes on the query paths ([schema](apps/api/prisma/schema.prisma)).
- Detailed design notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Dexie (IndexedDB), hand-written service worker |
| Backend | NestJS 11, TypeScript, class-validator DTOs, Passport JWT, @nestjs/throttler, Helmet |
| Database | PostgreSQL 16 (Docker), Prisma 6 migrations |
| AI | Google Gemini (`@google/genai`, server-side only) with JSON-schema output validated by Zod, behind deterministic rule engines and a safety layer |
| Tests | Jest (API unit + e2e with Supertest against a real test DB), Vitest + fake-indexeddb (sync engine) |

---

## AI components (decision support, not diagnosis)

Every AI output is labelled in the UI as *decision support*. Final clinical decisions stay with qualified professionals.

**Provider:** Google Gemini, called only from the API (`apps/api/src/ai/gemini.provider.ts`). The web app never sees the key.

**Models:**
- `GEMINI_MODEL` (default `gemini-3.8-flash`, verified available for the project key).
- Tried next when the primary is out of quota, overloaded (503) or missing: `GEMINI_FALLBACK_MODELS` (default `gemini-3.5-flash`).
- Each stored result records the model that actually answered.

### Pipeline (same for both features)
```
input ─► deterministic rules (instant, stored immediately, "AI pending")
      └► background job ─► Gemini (JSON schema) ─► Zod re-validation ─► safety layer ─► update record
                          └ timeout / 429 / 503 → retried (honours Gemini's retryDelay), then FALLBACK_RULE_ENGINE
```
- AI never blocks clinical work. A nurse's sync returns in milliseconds, and the Gemini review lands a few seconds later; the UI shows "Gemini is reviewing…".
- Stored engine values:
  - `RULE_ENGINE`: no AI configured;
  - `GEMINI`: AI result accepted;
  - `GEMINI_WITH_RULE_OVERRIDE`: the safety rules kept a higher risk or priority than Gemini suggested;
  - `FALLBACK_RULE_ENGINE`: AI was configured but failed.

### 1. Risk prioritization
- **Input (de-identified):**
  - age, days since discharge and referral priority;
  - vitals: BP, pulse, temperature, SpO₂;
  - general condition, symptoms, and free-text notes in any language;
  - the last 3 observations as a trend.

  No names, addresses, phone numbers or ids are sent.
- **Gemini output:** `{ riskLevel, reasons[], recommendedAction, confidence, warnings[] }`.
- **Safety layer** ([`risk.safety.ts`](apps/api/src/ai/risk.safety.ts)):
  - **AI may raise but never lower the rule-based risk.** For example, rules HIGH + Gemini LOW → HIGH (`GEMINI_WITH_RULE_OVERRIDE`).
  - Emergency thresholds always apply (SpO₂ < 90, SBP ≥ 180, critical condition, …).
  - Medication and dosing advice is withheld.
  - Diagnostic conclusions ("suggests heart failure", "for suspected sepsis") are stripped or withheld. CareBridge prioritizes risk; it does not diagnose.
  - Every override is explained in `warnings`.
- **Stored:** final level, rule and AI reasons (tagged separately), action, confidence, warnings, engine, model, timestamps.

### 2. Feedback intelligence (anonymous QR feedback)
- **Input:** free text in Uzbek (Latin or Cyrillic), Russian or English, plus rating and type.
- **Gemini output:** `{ category, sentiment, priority, topics[], safetySignal, summary }`. All fields except the summary are enums.
- **Safety layer** ([`feedback.safety.ts`](apps/api/src/ai/feedback.safety.ts)):
  - A safety signal from **either** the multilingual keyword rules **or** Gemini forces HIGH priority. This covers bribery, abuse, threats, negligence, wrong medication, deaths, and unattended emergencies.
  - Gemini cannot move a keyword-detected safety report into a non-safety category.
  - Summaries are scrubbed of phone numbers and e-mail addresses.
- **Anonymity:** nothing about the submitter is stored or sent (no IP, device, user or patient link).

### 3. Care coordinator
The admin dashboard shows a ranked "needs attention now" worklist (overdue, AI-high-risk, high-priority) and plain-language operational insights.

### Prompt-injection defence
- Patient notes and feedback are treated as **untrusted data**. They are JSON-encoded, with `<`/`>` escaped, inside delimiters, so they cannot close their tag or pose as instructions.
- System instructions are sent as Gemini's `systemInstruction`.
- The output is constrained by a JSON schema and re-validated.
- Tested with "ignore all previous instructions…" attacks: they cannot lower a bribery report.

### Verified live
- `gemini-3.8-flash` / `gemini-3.5-flash` classified Uzbek and Russian feedback correctly and ignored an injection attempt (correctly flagging corruption, HIGH).
- In risk review, Gemini read an Uzbek note ("tunda yotolmayapti": can't lie flat at night), detected a SpO₂/pulse trend and flagged missing BP.

## Offline and sync architecture

- **Online:** UI → API → PostgreSQL.
- **Offline:** UI → IndexedDB outbox → (later) sync engine → `POST /api/sync/batch` → PostgreSQL.

1. **Service worker** ([`public/sw.js`](apps/web/public/sw.js)):
   - caches the app shell; static assets are cache-first, pages network-first;
   - nurse pages are static routes (`/nurse/visit?id=…`), so one cached shell serves every visit;
   - navigations are cached under one key per path, so offline users never boot a stale build.
2. **Read cache:** the worklist and patient records are stored in IndexedDB when fetched online, and shown with an "offline mode" banner when the network is unavailable.
3. **Outbox** ([`lib/db.ts`](apps/web/src/lib/db.ts)): every nurse mutation is stored as `{ localOperationId, entityType, entityId, operationType, payload, createdAt, syncStatus, retryCount, nextAttemptAt, lastError }`.
4. **Sync engine** ([`lib/sync-engine.ts`](apps/web/src/lib/sync-engine.ts)):
   - flushes in creation order;
   - uses exponential backoff (2 s → 5 min cap) and recovers ops stuck in "syncing";
   - treats an unreachable server as offline even when `navigator.onLine` is true (weak rural signal), probes `/health`, and retries immediately on recovery;
   - turns permanent refusals into visible "rejected" items that the nurse can discard.
5. **Server** ([`sync.service.ts`](apps/api/src/sync/sync.service.ts)):
   - each op is validated with the same DTOs as the online endpoints and authorized for the calling user;
   - ops are applied independently, so one bad op never blocks the rest;
   - ops are **idempotent**: observations use a unique client UUID, and follow-up status changes use a forward-only state machine.
   - The observation keeps its original offline `recordedAt`, and the visit is flagged `syncedFromOffline`.
6. **UI:** a persistent status badge shows *Online · synced*, *Offline · N changes saved on device*, *Syncing…*, or *N rejected*. Unsynced observations are tagged "on device · not synced".

**Verified manually:** with the API and web servers both stopped, the nurse reloaded the visit page (served by the service worker), recorded vitals, and completed the visit. When the servers came back, all operations synced. The server then showed the offline-captured observations, a new HIGH risk assessment, and 100% continuity.

---

## Care Continuity Score

A **process metric, not a clinical score.** Each referral earns 20% per completed hand-off:

`Referral created ✓ → Family doctor accepted ✓ → Home visit performed ✓ → Visit data synchronized ✓ → Follow-up completed ✓` = **100%**

The score is shown per patient, with each step explained. The admin dashboard shows the average over the last 90 days and the on-time completion rate.

---

## Getting started

**Prerequisites:** Node.js ≥ 20, npm, Docker.

```bash
npm install
```

```bash
npm run db:up
```

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set `JWT_SECRET` in `apps/api/.env` to the output of `openssl rand -hex 32` (the API refuses to start with a weak secret).

```bash
npm run prisma:deploy -w apps/api && npm run db:seed -w apps/api
```

Run the API (port 4000) and the web app (port 3000) in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open http://localhost:3000. **The service worker (offline mode) only registers in production builds.** To demo offline:

```bash
npm run build -w apps/web && npm run start -w apps/web
```

To wipe the dev database and reseed (destructive):

```bash
npm exec -w apps/api -- prisma migrate reset --force
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | api | PostgreSQL connection (Docker maps to `localhost:5434`) |
| `JWT_SECRET` | api | ≥ 32 random chars; required |
| `JWT_EXPIRES_IN` | api | Token lifetime (default `8h`) |
| `PORT` | api | API port (default 4000) |
| `CORS_ORIGINS` | api | Comma-separated allowed web origins |
| `TRUST_PROXY` | api | `true` behind a reverse proxy (correct IPs for rate limiting) |
| `GEMINI_API_KEY` | api | Optional. Enables Gemini; empty means deterministic rules only. **Server-side only, never commit it** |
| `GEMINI_MODEL` | api | Primary model (default `gemini-3.8-flash`) |
| `GEMINI_FALLBACK_MODELS` | api | Comma-separated models tried on quota/overload (default `gemini-3.5-flash`) |
| `AI_TIMEOUT_MS` | api | Client-side timeout per Gemini call (default 20000; Gemini rejects server deadlines < 10 s) |
| `NEXT_PUBLIC_API_URL` | web | API base URL, e.g. `http://localhost:4000/api` |

### Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript for api + web |
| `npm run lint` | ESLint for api + web |
| `npm test` | API unit tests (Jest) + web sync-engine tests (Vitest) |
| `npm run test:e2e` | API integration tests against `carebridge_test` (create it once: `docker compose exec db createdb -U carebridge carebridge_test`, then `DATABASE_URL=…/carebridge_test npx prisma migrate deploy` in `apps/api`) |
| `npm run test:smoke -w apps/api` | **Live** Gemini smoke test (opt-in; uses `GEMINI_API_KEY` from `apps/api/.env`, retries transient errors, never prints the key) |
| `npm run build` | Production builds |

### Demo accounts (seed data, all fictional)

Password for all accounts: `CareBridge2026!`

| Role | Email |
|---|---|
| Admin | `admin@carebridge.uz` |
| Hospital doctor | `hospital.doctor@carebridge.uz` |
| Family doctor | `doctor@carebridge.uz` |
| Rural nurse | `nurse@carebridge.uz` |

Public QR feedback: `/f/SAM-RH-01`, `/f/URG-FP-07`, `/f/URG-QVP-12` (QR codes are on the admin *Patient voice* page).

---

## Demo script (one patient journey, ~5 min)

1. **Hospital doctor**: open *Rustam Aliyev* (in hospital) → **Discharge patient** (priority High). The referral is created automatically and sent to the family doctor with a 48 h deadline. Continuity is now 20%.
2. **Family doctor**: sees it under *Referrals* marked "New". Also note *Sherzod Qodirov*, **overdue and escalated**. Accept Rustam's referral, then assign it to nurse *Gulnora*.
3. **Nurse (phone width)**: *My visits* lists Rustam. Open the visit once online.
4. **Turn off the network** (DevTools → Offline, or stop the servers). The badge switches to *Offline*.
5. Record vitals (e.g. SpO₂ 89, pulse 108, "Shortness of breath"). They're saved on the device; the badge shows *N changes saved on device*. Complete the visit.
6. **Turn the network back on.** Sync is automatic. The rule-based risk (HIGH) appears immediately with *Gemini is reviewing…*, then updates to *Gemini AI · checked by safety rules* with AI reasons, confidence and warnings.
7. **Admin**: the *Command center* shows continuity, overdue follow-ups, high-risk patients, offline-synced visits and AI coordinator insights.
8. **Patient**: scan the ward QR code and submit *"Palatada juda uzoq kutdik, hamshirani chaqirsak kech keldi."* anonymously.
9. **Admin**: under *Patient voice*, Gemini classifies it (negative · service quality · waiting time + staff response). Bribery or negligence reports carry a red **Safety signal** and are always HIGH.
10. Back on Rustam's record: **Care Continuity Score 100%**.

---

## Security and privacy

- **Authentication:** bcrypt password hashing and short-lived JWTs. Login failures return a generic message, with constant-time comparison even for unknown emails, and are rate limited (10/min).
- **Authorization (deny by default):** a global JWT guard plus a `@Roles()` guard. Data scoping is enforced on the server in every query ([`common/access/scopes.ts`](apps/api/src/common/access/scopes.ts)). Out-of-scope records return **404** so ids can't be probed.
- **Validation:** DTOs use whitelist + `forbidNonWhitelisted` (mass assignment is blocked). Vital signs have plausible ranges. UUID params are checked. Page size is capped at 100.
- **Public endpoints:**
  - only a facility `publicCode` is exposed, never UUIDs or patient data;
  - strict rate limit (5 submissions per minute per IP);
  - control characters are stripped;
  - **feedback rows store no IP, device, user or patient link**.
- **Injection:** Prisma parameterized queries, including the single tagged `$queryRaw`. React escaping everywhere: no `dangerouslySetInnerHTML` (enforced by lint).
- **Headers:** Helmet on the API. On the web: a strict CSP (`connect-src` limited to the API), `X-Frame-Options: DENY`, `nosniff` and a Referrer-Policy. CORS is limited to configured origins.
- **Audit log** for login (success and failure), patient create/update, discharge, referral creation/accept/overdue, follow-up transitions, observations, sync batches and AI assessments. Metadata holds ids and statuses only, **no PHI**.
- **Logging:** the error filter logs route and error name only (no request bodies) and returns a uniform error shape without stack traces.
- **Secrets:**
  - `.env` files are git-ignored and only `.env.example` files are committed.
  - The API refuses a weak JWT secret.
  - `GEMINI_API_KEY` is read only by the API, is never logged, returned or bundled, and is sent only as the `x-goog-api-key` header. The build output and logs were scanned for the key.
  - Tests never load the real key (`ignoreEnvFile` under `NODE_ENV=test`).
- **Logging:** Prisma error messages (which embed query data) are never logged, only their class and code. The AI provider logs only failure reasons and status codes, never prompts or outputs.
- **Permissions:**
  - nurses can't list the staff directory;
  - nurses can't change a patient's care status or family doctor;
  - manual AI re-assessment is rate limited (10/min).
- **Session storage:** the web session is stored in `localStorage` so nurses stay signed in offline. The trade-off is XSS exposure, mitigated by the CSP and React escaping. Sign-out clears cached records; unsynced work is kept until it reaches the server.

## Limitations (honest)

- **Rule weights** are illustrative, not clinically validated. Neither the risk level nor the Continuity Score is a medical score, and AI output is decision support only.
- **Gemini free-tier quota:**
  - `gemini-3.8-flash` allows **20 requests per day per model** (plus per-minute limits and occasional 503 "high demand").
  - The fallback chain and rule fallback keep the product working, but for a live demo enable billing or keep a fallback model with spare quota.
  - Google's unpaid tier may use prompts to improve its products. Even though inputs are de-identified, use a paid tier (or Vertex AI) for real patient data.
- **Offline scope** (only these flows work offline):
  - opening an already-downloaded home visit;
  - recording observations;
  - starting and completing the visit.

  Patient registration, discharge, referral assignment, AI review and feedback analysis need a connection. A visit must be opened once online to be available offline.
- **Background AI jobs** run in-process. Pending reviews are resumed at API start, but there is no durable queue.
- **Conflict handling:** creates are idempotent and follow-up status only moves forward. There is no field-level merge UI.
- **Infrastructure:** single-node in-memory rate limiting, and no refresh tokens (JWT in `localStorage`, mitigated by CSP).
- **Dependencies:** `npm audit` reports advisories in dev and build tooling only (vitest's mocker, the postcss version bundled inside Next).

## Roadmap

- SMS/USSD for patients without smartphones, and push notifications for doctors.
- Offline patient registration and conflict-resolution UI.
- Integration with national EMR / DMED and HL7 FHIR export.
- Scale: hospital → district → region → national dashboards; multi-tenant B2G/B2B SaaS.
- Clinically validated risk models, developed together with health authorities.
