# CareBridge AI — Architecture & Hackathon Plan

> Offline-first continuity of care: hospital → discharge → referral → family doctor →
> rural nurse (offline) → sync → AI risk prioritization → anonymous feedback → admin analytics.

## A. Repository audit (start of hackathon)

| Item | Finding |
|---|---|
| Repo | Empty directory, no git. `origin` = `github.com/AzimovAsadbek/careBridge` (empty remote) |
| Runtime | Node 24, npm 11 (no pnpm/yarn) |
| Database | No local Postgres → run PostgreSQL 16 via Docker Compose (Docker 29 available) |
| AI credentials | None provided → AI module must work with a deterministic local engine, LLM optional via env |
| Blockers | None critical. LLM key is optional, not required for the demo |

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
                 │ Prisma                   │ AI provider (optional LLM)
            PostgreSQL 16            rule engine fallback (always on)
```

## C. Database schema (Prisma)

- **Facility** (id, name, type HOSPITAL|FAMILY_CLINIC|RURAL_POST, district, `publicCode` for QR)
- **User** (id, email unique, passwordHash, fullName, role ADMIN|DOCTOR|NURSE, facilityId)
- **Patient** (id, fullName, birthDate, sex, phone?, address, district, facilityId, familyDoctorId?, status ADMITTED|DISCHARGED|IN_FOLLOW_UP|STABLE, riskLevel?, clientId? unique)
- **Observation** (id, patientId, followUpId?, recordedById, systolic, diastolic, pulse, temperature, spo2, symptoms[], generalCondition, notes, recordedAt, `clientId` unique → idempotent sync)
- **Referral** (id, patientId, fromFacilityId, toFacilityId, assignedDoctorId?, priority LOW|MEDIUM|HIGH, reason, dischargeSummary, status PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|OVERDUE, deadline, acceptedAt, completedAt)
- **FollowUp** (id, referralId, patientId, assignedNurseId?, status, visitAt, outcome, completedAt, `clientId` unique, `syncedFromOffline` flag)
- **RiskAssessment** (id, patientId, observationId?, level, score, factors Json, recommendedAction, engine rule|llm)
- **Feedback** (id, facilityId, ward?, rating 1–5, type COMPLAINT|SUGGESTION|PRAISE|OTHER, text) — no patient link, no IP stored
- **FeedbackAnalysis** (feedbackId 1:1, sentiment, category, topics[], priority, engine)
- **AuditLog** (actorId, action, entityType, entityId, metadata Json, createdAt)

Indexes: referral(status, deadline), referral(assignedDoctorId), patient(facilityId), observation(patientId, recordedAt), feedback(facilityId, createdAt).

## D. API map (all JSON, prefix `/api`)

| Method | Path | Roles |
|---|---|---|
| POST | /auth/login · GET /auth/me | public / any |
| GET/POST | /patients · GET/PATCH /patients/:id | ADMIN, DOCTOR, NURSE |
| POST | /patients/:id/observations | DOCTOR, NURSE |
| POST | /patients/:id/discharge | ADMIN, DOCTOR |
| GET | /referrals · GET /referrals/:id | ADMIN, DOCTOR, NURSE |
| PATCH | /referrals/:id (accept / assign nurse) | ADMIN, DOCTOR |
| POST | /follow-ups · PATCH /follow-ups/:id | DOCTOR, NURSE |
| POST | /sync/batch | DOCTOR, NURSE |
| POST | /ai/risk-assessment/:patientId | ADMIN, DOCTOR, NURSE |
| GET | /ai/coordinator (P1) | ADMIN, DOCTOR |
| GET | /public/facilities/:code · POST /public/feedback | public, rate-limited |
| GET | /feedback · /analytics/dashboard | ADMIN |

Errors: `{ statusCode, error, message, path, timestamp }`.

## E. Frontend screens

`/login` · `/dashboard` (role-aware: admin command center / doctor referrals / nurse visits) ·
`/patients` · `/patients/[id]` (history, observations, risk, continuity score) · `/referrals/[id]`
(accept → follow-up → visit → complete) · `/visit/[followUpId]` (mobile offline form) ·
`/feedback` (admin analytics) · `/f/[code]` (public QR form) · global sync status bar.

## F. AI architecture

`AiModule` exposes two use-cases, each with the same pipeline:
`input → provider (LLM if configured, else rule engine) → zod schema validation → fallback to rule engine on
timeout / malformed output / provider error → persisted with engine tag`.

1. **Risk prioritization** – vitals + age + recent discharge + symptoms → `{ riskLevel, score, factors[], recommendedAction }`.
   Transparent weighted rules (e.g. SpO2 < 92, SBP ≥ 180, temp ≥ 38.5, discharge < 14 days, age ≥ 65).
2. **Feedback intelligence** – free text (Uzbek/Russian/English) → `{ sentiment, category, topics[], priority }`.
   Keyword lexicon fallback in uz/ru/en.

AI output is labelled *decision support*, never diagnosis; clinicians confirm all actions.

## G. Offline / sync architecture

- Service worker caches the app shell and visited pages; API reads are cached in IndexedDB.
- Every mutation from the nurse workflow goes to the **outbox** (`localOperationId, entityType, entityId,
  operationType CREATE|UPDATE, payload, createdAt, syncStatus pending|syncing|failed|synced, retryCount, lastError`).
- Online: outbox is flushed immediately. Offline: stays local, UI shows OFFLINE + pending count.
- On `online` event / interval: `POST /sync/batch` with ordered ops. Server applies each op idempotently
  (unique `clientId`), returns per-op result. Failed ops retry with exponential backoff (max 5), then surface as errors.
- Conflict policy: last-write-wins per field for updates; creates are idempotent.

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
| No LLM key / venue Wi-Fi fails | Rule engine is primary fallback; demo never depends on the network |
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
