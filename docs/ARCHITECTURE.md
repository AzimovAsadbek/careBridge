# CareBridge AI — Architecture & Hackathon Plan

> Offline-first continuity of care: hospital → discharge → referral → family doctor →
> rural nurse (offline) → sync → AI risk prioritization → anonymous feedback → admin analytics.

## A. Repository audit (start of hackathon)

| Item | Finding |
|---|---|
| Repo | Empty directory, no git. `origin` = `github.com/AzimovAsadbek/careBridge` (empty remote) |
| Runtime | Node 24, npm 11 (no pnpm/yarn) |
| Database | No local Postgres → run PostgreSQL 16 via Docker Compose on host port 5434 |
| AI credentials | Gemini key added later (server-side `.env`); deterministic rules remain the floor and fallback |
| Blockers | Gemini free tier: 20 req/day/model → fallback model chain + rule fallback |

Version choices favour stability over novelty: Next.js 15, NestJS 11, Prisma 6, TypeScript 5.9, Tailwind 4.

## B. System architecture

```
 ┌──────────────── Next.js PWA (apps/web) ────────────────┐
 │ Admin / Doctor / Nurse UI     Public QR feedback page  │
 │ Service worker (app shell)    IndexedDB (Dexie)        │
 │           Sync engine ── outbox queue ──┐              │
 └───────────────────────┬─────────────────┼──────────────┘
                   REST + JWT        POST /sync/batch
 ┌───────────────────────▼─────────────────▼──────────────┐
 │ NestJS modular monolith (apps/api)                     │
 │ auth · users · facilities · patients · referrals ·     │
 │ follow-ups · sync · ai · feedback · analytics · audit  │
 └───────────────┬──────────────────────────┬─────────────┘
                 │ Prisma                   │ AiProvider → GeminiProvider (server-side)
            PostgreSQL 16            rules + safety layer (always on)
```

## C. Database schema (Prisma)

- **Facility** (id, name, type HOSPITAL|FAMILY_CLINIC|RURAL_POST, district, `publicCode` for QR)
- **User** (id, email unique, passwordHash, fullName, role ADMIN|DOCTOR|NURSE, facilityId)
- **Patient** (id, fullName, birthDate, sex, phone?, address, district, facilityId, familyDoctorId?, status ADMITTED|DISCHARGED|IN_FOLLOW_UP|STABLE, riskLevel?)
- **Observation** (id, patientId, followUpId?, recordedById, systolic, diastolic, pulse, temperature, spo2, symptoms[], generalCondition, notes, recordedAt, `clientId` unique → idempotent sync)
- **Referral** (id, patientId, fromFacilityId, toFacilityId, assignedDoctorId?, priority LOW|MEDIUM|HIGH, reason, dischargeSummary, status PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|OVERDUE, deadline, acceptedAt, completedAt, escalatedAt)
- **FollowUp** (id, referralId, patientId, assignedNurseId?, status SCHEDULED|IN_PROGRESS|COMPLETED, scheduledFor, visitStartedAt, completedAt, outcome, `syncedFromOffline` flag)
- **RiskAssessment** (id, patientId, observationId?, level, score, factors Json, recommendedAction, engine rule|llm)
- **Feedback** (id, facilityId, ward?, rating 1–5, type COMPLAINT|SUGGESTION|PRAISE|OTHER, text) — no patient link, no IP stored
- **FeedbackAnalysis** (feedbackId 1:1, sentiment, category, topics[], priority, engine)
- **AuditLog** (actorId, action, entityType, entityId, metadata Json, createdAt)

Indexes: referral(status, deadline), referral(assignedDoctorId), patient(facilityId), observation(patientId, recordedAt), feedback(facilityId, createdAt).

## D. API map (all JSON, prefix `/api`, as implemented)

| Method | Path | Roles |
|---|---|---|
| POST | /auth/login | public (10/min) |
| GET | /auth/me · /users?role= · /facilities | any staff |
| GET/POST | /patients (search, status, riskLevel, paging) | any staff (scoped) |
| GET/PATCH | /patients/:id (detail incl. continuity score) | any staff (scoped) |
| POST | /patients/:id/discharge → auto referral | ADMIN, DOCTOR |
| POST | /patients/:id/observations → auto risk assessment | DOCTOR, NURSE |
| GET | /referrals?view=active&status=&priority= · /referrals/:id | any staff (scoped) |
| PATCH | /referrals/:id `{action:"accept"}` | ADMIN, DOCTOR |
| POST | /follow-ups (assign nurse) | ADMIN, DOCTOR |
| GET | /follow-ups/mine (nurse worklist) | any staff |
| PATCH | /follow-ups/:id (start / complete) | DOCTOR, NURSE |
| POST | /sync/batch (offline outbox) | DOCTOR, NURSE |
| POST | /ai/risk-assessment/:patientId · GET /ai/status | any staff (scoped) |
| GET | /public/facilities/:code · POST /public/feedback | public (30/min, 5/min) |
| GET | /feedback · POST /feedback/:id/reanalyze | ADMIN |
| GET | /analytics/dashboard (KPIs, attention queue, insights) | ADMIN |
| GET | /audit | ADMIN |
| GET | /health | public |

Errors: `{ statusCode, error, message, path, timestamp }`.

## E. Frontend screens

`/login` · `/dashboard` (admin command center) · `/doctor` (referral worklist) · `/nurse` (visit worklist, offline) ·
`/nurse/visit?id=` (mobile offline visit form — static route so one cached shell serves every visit) ·
`/patients`, `/patients/new`, `/patients/[id]` (history, observations, risk, continuity score, discharge) ·
`/referrals/[id]` (accept → assign nurse) · `/feedback` (patient voice + QR codes) · `/f/[code]` (public QR form) ·
global sync status badge.

## F. AI architecture

- `AiProvider` (abstraction) → `GeminiProvider` (`@google/genai`).
  - Model chain: `GEMINI_MODEL` → `GEMINI_FALLBACK_MODELS`; a model is cooled down on daily-quota errors or when it doesn't exist.
  - JSON-schema output (`responseJsonSchema`), then Zod re-validation.
  - Client-side timeout; failure reasons are `timeout | quota | unavailable | blocked | malformed | error | not_configured`.
- `AiJobs`: in-process background runner that retries transient failures (honouring Gemini's `retryDelay`). AI never blocks requests.
- `RiskService` / `FeedbackAnalysisService`:
  - store the deterministic result immediately (`aiPending`);
  - then upgrade it through `risk.safety.ts` / `feedback.safety.ts`.
- Engines: `RULE_ENGINE | GEMINI | GEMINI_WITH_RULE_OVERRIDE | FALLBACK_RULE_ENGINE`.
- Safety invariants:
  - AI never lowers rule risk or feedback safety priority;
  - no medication or dosing advice;
  - no diagnostic conclusions;
  - untrusted text is escaped and delimited;
  - de-identified inputs.

## G. Offline / sync architecture

- Build-versioned service worker (`/sw.js?v=<buildId>`): each deploy precaches the offline shells and their JS/CSS, and deletes older caches. API reads are cached in IndexedDB.
- Every mutation from the nurse workflow goes to the **outbox** (`localOperationId, entityType, entityId,
  operationType CREATE|UPDATE, payload, createdAt, syncStatus pending|syncing|failed|synced, retryCount, lastError`).
- Online: outbox is flushed immediately. Offline: stays local, UI shows OFFLINE + pending count.
- On `online` event / 15 s interval / app start: `POST /sync/batch` with ordered ops. Server applies each op
  idempotently (observation `clientId` unique; follow-up status forward-only) and returns a per-op result.
- Network failures retry with exponential backoff (2 s → 5 min cap); an unreachable server marks the device offline
  and a `/health` probe triggers immediate retry on recovery. Validation/permission refusals become visible "rejected" ops.
- Conflict policy: creates are idempotent; follow-up status only moves forward (replays of older states are no-ops).

## H. Security model

bcrypt password hashing · JWT (short-lived, Bearer) · global JWT guard + `@Roles()` guard, deny by default ·
facility-scoped data access · class-validator DTOs with whitelist + forbidNonWhitelisted · Helmet · strict CORS
from env · `@nestjs/throttler` (strict on `/public/*` and `/auth/login`) · Prisma (parameterized) ·
audit log for login, discharge, referral changes, observations, sync · no PHI in logs · React escaping (no
`dangerouslySetInnerHTML`) · public endpoints expose only facility `publicCode`, never UUIDs or patient data.

## I. 48-hour execution plan

| Block | Work |
|---|---|
| Day 1 AM | Monorepo, Docker Postgres, Prisma schema + seed, auth/RBAC, error handling, UI shell |
| Day 1 PM | Patients, discharge → referral, doctor dashboard, follow-up workflow (P0 end-to-end online) |
| Day 1 night | IndexedDB outbox, sync engine, service worker, sync status UI — test with network off |
| Day 2 AM | AI risk + feedback intelligence, QR public feedback, admin command center, continuity score |
| Day 2 PM | Tests (auth, referral, sync, AI, feedback), security pass, README, demo rehearsal |

## J. Scope

- **P0**: auth/RBAC, patients, discharge→referral, follow-up + observations, offline outbox + sync, AI risk, QR feedback + AI analysis, admin dashboard, continuity score.
- **P1**: overdue escalation job, AI care coordinator summary, LLM provider, QR code rendering, audit log viewer.
- **P2**: SMS notifications, charts, i18n switcher, multi-facility admin.

## K. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gemini quota / venue Wi-Fi fails | Fallback model chain, then rule engine; demo never depends on the network |
| Offline edge cases eat time | Scope offline to nurse visit flow only (observations + follow-up status) |
| Sync duplicates | Client-generated UUIDs + unique `clientId` → idempotent |
| Service worker caching bugs in dev | SW only registered in production build; demo runs `next build && next start` |
| Scope creep | P0 list is the contract; P1 only after demo flow passes end-to-end |

## L. Implementation order

1. Tooling + Docker + Prisma schema + seed
2. Auth + RBAC + errors + audit
3. Patients → discharge → referral → follow-up (API, then UI)
4. Offline outbox + sync endpoint + SW + status UI
5. AI risk → AI feedback → QR public flow
6. Admin command center + continuity score
7. Tests, hardening, README, demo script
