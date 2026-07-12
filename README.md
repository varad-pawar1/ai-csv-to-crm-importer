# GrowEasy CSV → CRM Importer

> **Hosted application:** https://ai-csv-to-crm-importer.onrender.com  
> **GitHub repository:** [FILL IN]  
> **Position applied for:** [FILL IN — Intern / Full-Time]  
> **Backend URL (production):** [FILL IN — to be added]

AI-powered CSV importer that accepts arbitrary lead-export formats (Facebook Ads, Google Ads, spreadsheets) and maps each row into GrowEasy's fixed 15-field CRM schema using an LLM. The backend processes imports asynchronously via BullMQ; the frontend shows upload → preview → confirm → live progress → paginated results and filtered export.

---

## How it works

End-to-end flow as implemented in the codebase:

### 1. Upload (`frontend/app/page.tsx`, `frontend/components/FileUpload.tsx`)

- User selects or drags a `.csv` file (max 10 MB).
- `parseCsvFile()` in `frontend/lib/csvParser.ts` parses the file in the browser with PapaParse (headers + all rows kept in React state).
- On success, the step advances to **Preview**.

### 2. Preview (`frontend/components/CsvPreviewTable.tsx`)

- All parsed rows are shown with client-side pagination (`PREVIEW_PAGE_SIZE = 20` in `frontend/lib/constants.ts`).
- Table height grows with the number of rows on the current page (no fixed empty-row padding).

### 3. Confirm (`frontend/app/page.tsx`, `frontend/components/DedupWarning.tsx`)

- `useDuplicates()` (`frontend/hooks/useDuplicates.ts`) scans preview rows for duplicate emails/phones by header name heuristics.
- User chooses dedup policy: `keep_both` or `merge`.
- **Start Import** calls `submitImport()` → `startImport()` in `frontend/lib/api.ts`.

### 4. Create import job (`POST /api/import`)

- `createImport()` in `backend/src/controllers/import.controller.ts` receives multipart upload via Multer (`backend/src/middleware/upload.middleware.ts`).
- `parseCsvContent()` in `backend/src/services/csvParser.service.ts` re-parses CSV server-side (newline escaping, row limit).
- Rows are chunked with `chunkRows()` / `computeBatchSize()` and enqueued via `enqueueBatches()` in `backend/src/queue/batch.queue.ts`.
- An `ImportJob` and `BatchLog` documents are created in MongoDB (`backend/src/models/index.ts`).
- Response: `{ jobId, totalRows, batchesTotal }`.
- Frontend navigates to `/import/[jobId]` (`frontend/app/import/[jobId]/page.tsx`).

### 5. Background processing (`backend/src/queue/batch.worker.ts`)

- `startBatchWorker()` runs in the same Node process as the API (`backend/src/index.ts`), concurrency 5.
- For each BullMQ job:
  1. Mark batch `active` in `BatchLog`.
  2. `extractCrmRecordsWithMock()` → `extractCrmRecords()` in `backend/src/services/aiExtractor.service.ts` calls the configured LLM (OpenAI, Anthropic, or Gemini) with `CRM_EXTRACTION_SYSTEM_PROMPT` + few-shot examples from `backend/src/prompts/crmExtraction.prompt.ts`.
  3. LLM output is validated with Zod; on count mismatch or duplicate contacts in a chunk, falls back to per-row extraction.
  4. `mapToCrmRecord()` in `backend/src/services/crmMapper.service.ts` normalizes emails/phones, validates enums, marks rows missing both email and phone as `_skipped`.
  5. If `dedupPolicy === 'merge'`, `deduplicateBatchLeads()` merges duplicates within the batch.
  6. `LeadRecord` documents inserted; `ImportJob` counters updated.
- Jobs retry up to 3 times with exponential backoff (2s base) via BullMQ default options in `batch.queue.ts`.
- On final batch failure, batch is logged as `failed` but other batches continue; job status becomes `done` when all batches finish.

### 6. Live progress (`GET /api/import/:jobId/stream`)

- `streamImportProgress()` in `backend/src/services/sse.service.ts` opens an SSE connection.
- Pushes `progress`, `batch-failed`, and `done` events.
- Updates driven by BullMQ `QueueEvents` (`progress`, `completed`, `failed`, `active`) plus a 2s polling fallback.
- Frontend `useImportProgress()` (`frontend/hooks/useImportProgress.ts`) subscribes via `EventSource`; `ProcessingView` renders phase steps, progress bar, and counters.

### 7. Results (`frontend/components/ResultTable.tsx`)

- When SSE reports `status: done | failed`, summary is built from the final progress snapshot (no extra summary-only API call).
- `getImportResults()` fetches paginated mapped records (`page`, `limit`, `filter` query params).
- Filters: `all`, `imported`, `skipped`, `low-confidence`.
- **Export CSV / JSON** calls `GET /api/import/:jobId/export` with the active filter.

---

## Tech stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend framework | Next.js 14 (App Router), React 18 | `frontend/` |
| Frontend styling | Tailwind CSS 3, Lucide icons | Dark mode via `class` on `<html>` |
| Frontend CSV parse (preview) | PapaParse | Client-side only |
| Backend framework | Express 4, TypeScript | `backend/` |
| Database | MongoDB via Mongoose 8 | `ImportJob`, `LeadRecord`, `BatchLog` |
| Queue | Redis + BullMQ 5 | Batch jobs, retries |
| AI providers | OpenAI, Anthropic, Gemini | Selected by `AI_PROVIDER`; optional `AI_FALLBACK_PROVIDER` |
| Validation | Zod 3 | Env config + LLM response parsing |
| Logging | Pino | Structured logs |
| Testing | Vitest, Supertest | Backend only |
| Monorepo | npm workspaces | Root `package.json` |

---

## Setup

### Prerequisites

- Node.js **20.x** (see `.node-version`; root `engines` allows `>=20 <23`)
- MongoDB
- Redis (required for BullMQ queue and worker)
- API key for at least one AI provider (OpenAI, Anthropic, or Gemini)

### Clone

```bash
git clone [FILL IN — your repo URL]
cd CSV
```

### Infrastructure (local)

`docker-compose.yml` starts **MongoDB and Redis only** (not the app):

```bash
docker compose up -d
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — see Environment variables below
npm install
npm run dev        # development: tsx watch src/index.ts → http://localhost:4000
# npm run build && npm start   # production: node dist/index.js
```

The API and BullMQ worker run in the **same process** (`startBatchWorker()` in `src/index.ts`).

### Frontend

```bash
cd frontend
# Optional: create .env.local with NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev        # http://localhost:3000
```

`frontend/next.config.js` rewrites `/api/import/*` to `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`).

### Root workspace scripts

From repo root (after `npm install` at root):

| Script | Command |
|--------|---------|
| Dev frontend | `npm run dev:frontend` |
| Dev backend | `npm run dev:backend` |
| Build all | `npm run build` |
| Start frontend (prod) | `npm start` or `npm run start:frontend` |
| Start backend (prod) | `npm run start:backend` |
| Tests | `npm test` (runs backend Vitest) |
| Lint | `npm run lint` |

### URLs (local)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |

---

## Environment variables

From `backend/.env.example` and `backend/src/config/env.ts`:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | `4000` | API port |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `REDIS_URL` | **Yes*** | — | Redis URL (`redis://...` or `rediss://...`) |
| `QUEUE_REDIS_HOST` | **Yes*** | — | Alternative to `REDIS_URL` (Render-style) |
| `QUEUE_REDIS_PORT` | No | `6379` | With `QUEUE_REDIS_HOST` |
| `QUEUE_REDIS_USERNAME` | No | — | Redis auth |
| `QUEUE_REDIS_PASSWORD` | No | — | Redis auth |
| `REDIS_TLS` | No | `false` | Enable TLS for Redis |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed frontend origin |
| `AI_PROVIDER` | No | `openai` | `openai` \| `anthropic` \| `gemini` |
| `AI_FALLBACK_PROVIDER` | No | — | Second provider on primary failure |
| `OPENAI_API_KEY` | If using OpenAI | — | |
| `ANTHROPIC_API_KEY` | If using Anthropic | — | |
| `GEMINI_API_KEY` | If using Gemini | — | |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | |
| `ANTHROPIC_MODEL` | No | `claude-3-5-haiku-latest` | |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | |
| `BATCH_SIZE` | No | `20` | Rows per BullMQ batch (5–50) |
| `MAX_FILE_SIZE_MB` | No | `10` | Upload limit |
| `MAX_CSV_ROWS` | No | `50000` | Max rows per file |

\* Either `REDIS_URL` or `QUEUE_REDIS_HOST` must be set.

**Frontend (optional):**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend base URL for API rewrites and direct SSE (production). Example: `https://your-backend.onrender.com` |

Integration tests additionally use `RUN_INTEGRATION_TESTS=1` to enable `backend/tests/integration.test.ts`.

---

## CRM schema

### Target fields (15)

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

Defined in `backend/src/types/crm.types.ts` as `CRM_FIELDS`.

### `crm_status` (enum — invalid values become `null`)

- `GOOD_LEAD_FOLLOW_UP`
- `DID_NOT_CONNECT`
- `BAD_LEAD`
- `SALE_DONE`

### `data_source` (enum — invalid values become `null`)

- `leads_on_demand`
- `meridian_tower`
- `eden_park`
- `varah_swamy`
- `sarjapur_plots`

### Runtime metadata (not part of the 15 schema fields)

- `_skipped` / `_skip_reason` — set when both email and phone are missing after mapping
- `_confidence` — per-field `high` \| `medium` \| `low` from LLM (optional)

---

## API endpoints

Base path: `/api/import` (plus `GET /health` on the API root).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check (`{ status, timestamp }`) |
| `POST` | `/api/import` | Upload CSV (`file` multipart field, optional `dedupPolicy`). Creates job and enqueues batches. |
| `GET` | `/api/import/:jobId/stream` | SSE stream of import progress (`progress`, `batch-failed`, `done` events). |
| `GET` | `/api/import/:jobId/results` | Paginated mapped records + summary. Query: `page`, `limit` (max 100, default 25), `filter` (`all` \| `imported` \| `skipped` \| `low-confidence`). |
| `GET` | `/api/import/:jobId/export` | Download all records matching filter as CSV or JSON. Query: `format` (`csv` \| `json`), `filter`. |

There is no job-list endpoint and no server-side preview endpoint (`ImportJob.rawRows` is stored but not exposed via API).

---

## Design decisions

- **Value-over-header LLM mapping** — The system prompt (`crmExtraction.prompt.ts`) instructs the model to classify cells by value shape (email, phone, person name, city, ad platform) rather than trusting column headers, with few-shot examples for misaligned Google/Facebook exports.

- **Chunked LLM calls with per-row fallback** — `computeLlmChunkSize()` scales chunk size by column count; if the batch response has wrong row count, invalid JSON, or duplicate contact keys within the chunk, `extractRowsIndividually()` re-processes one row at a time.

- **Post-LLM deterministic normalization** — `mapToCrmRecord()` applies regex email/phone extraction, enum validation (null if invalid), ISO date normalization, and skip rules independent of the model.

- **Batch-level deduplication policy** — `merge` merges duplicate email/phone within a single batch via `deduplicateBatchLeads()`; `keep_both` stores all rows. Dedup is per-batch, not global across the full import.

- **SSE + BullMQ events + poll fallback** — Progress uses Server-Sent Events subscribed to `QueueEvents`, with fingerprint-based deduplication and 2s DB polling so clients still receive updates if queue events are missed.

- **CSV safety** — Server parser escapes embedded newlines as `\n` in cell values; export prefixes formula-injection characters (`=`, `+`, `-`, `@`) with a single quote.

---

## Bonus features implemented

| Feature | Status |
|---------|--------|
| Drag-and-drop file upload | **Implemented** — `FileUpload.tsx` (`onDrop`, `onDragOver`) |
| Live progress indicators | **Implemented** — SSE + `ProcessingView` (phases, bar, counters) |
| Retry mechanism | **Implemented** — BullMQ `attempts: 3`, exponential backoff 2s |
| Paginated results table | **Implemented** — Server-side pagination in `ResultTable` (20/page) |
| Filtered CSV/JSON export | **Implemented** — `exportImportResults` + `downloadExport()` |
| Dark mode / theme toggle | **Implemented** — `ThemeToggle.tsx`, Tailwind `darkMode: 'class'` |
| Duplicate detection UI | **Implemented** — `useDuplicates` + `DedupWarning` on confirm step |
| Unit tests | **Implemented** — `backend/tests/unit.test.ts` (parser, mapper, batcher, confidence normalization) |
| Integration tests | **Implemented but skipped by default** — `backend/tests/integration.test.ts` requires `RUN_INTEGRATION_TESTS=1` + MongoDB + Redis |
| Docker Compose (Mongo + Redis) | **Implemented** — `docker-compose.yml` |
| Render deployment config | **Implemented** — `render.yaml` (frontend + backend services) |
| Vercel config | **Implemented** — `frontend/vercel.json` |
| Virtualized table (`react-window`) | **Not implemented** — listed in `frontend/package.json` but not imported anywhere |
| Dockerfile for app | **Not implemented** |
| Server-side CSV preview API | **Not implemented** — preview is client-side only |
| Global cross-batch deduplication | **Not implemented** — dedup is within-batch only when `merge` is selected |

---

## Known limitations

- **Worker colocated with API** — `startBatchWorker()` runs inside the Express process; there is no separate worker service definition in code (scaling requires running multiple API instances, each with a worker).

- **Export loads all matching rows into memory** — `exportImportResults` uses `LeadRecord.find()` without streaming; large jobs (up to 50,000 rows) may be memory-heavy.

- **`backend/prompts/crm-extraction-prompt.md` is not used at runtime** — The live prompt is the shorter `backend/src/prompts/crmExtraction.prompt.ts`. The `.md` file is a longer reference document.

- **Preview parsed twice** — CSV is parsed in the browser for preview and again on the server at upload; they can diverge if implementations differ.

- **SSE on Render** — Production SSE may need `NEXT_PUBLIC_API_URL` pointing directly at the backend; connection drops show "Reconnecting" in the UI.

- **Job marked `done` even with failed batches** — Failed batches increment `batchesDone` and the job can complete with partial data; failures are listed in `failedBatches` on the summary.

- **Phone dedup key normalization** — `getLeadDedupKey()` strips non-digits from phone but does not normalize country codes consistently across formats.

- **No authentication** — All import endpoints are public; no API keys or user sessions.

---

## Project structure

### `backend/`

```
backend/
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── prompts/
│   └── crm-extraction-prompt.md      # reference only (not imported at runtime)
├── scripts/
│   └── purge-queue.ts
├── src/
│   ├── index.ts                      # Express app + worker startup
│   ├── config/env.ts
│   ├── controllers/import.controller.ts
│   ├── db/mongo.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── upload.middleware.ts
│   ├── models/index.ts
│   ├── prompts/crmExtraction.prompt.ts  # runtime LLM system prompt
│   ├── queue/
│   │   ├── batch.queue.ts
│   │   ├── batch.worker.ts
│   │   └── connection.ts
│   ├── routes/import.routes.ts
│   ├── services/
│   │   ├── aiExtractor.service.ts
│   │   ├── batcher.service.ts
│   │   ├── crmMapper.service.ts
│   │   ├── csvParser.service.ts
│   │   └── sse.service.ts
│   ├── types/crm.types.ts
│   └── utils/logger.ts
└── tests/
    ├── unit.test.ts
    ├── integration.test.ts
    └── fixtures/
```

### `frontend/`

```
frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                    # upload → preview → confirm
│   └── import/[jobId]/page.tsx     # processing → results
├── components/
│   ├── AppHeader.tsx
│   ├── CsvPreviewTable.tsx
│   ├── DedupWarning.tsx
│   ├── FileUpload.tsx
│   ├── ImportLoadingOverlay.tsx
│   ├── ImportSummary.tsx
│   ├── ProcessingView.tsx
│   ├── ResultTable.tsx
│   ├── Stepper.tsx
│   ├── ThemeToggle.tsx
│   └── ui/                         # Alert, Button, Card, Pagination
├── hooks/
│   ├── useCsvImport.ts
│   ├── useDuplicates.ts
│   └── useImportProgress.ts
├── lib/
│   ├── api.ts
│   ├── constants.ts
│   ├── csvParser.ts
│   └── utils.ts
├── types/crm.ts
├── next.config.js
├── tailwind.config.ts
├── vercel.json
└── package.json
```

### Root

```
├── package.json          # npm workspaces
├── docker-compose.yml      # MongoDB + Redis
├── render.yaml             # Render Blueprint (frontend + backend)
└── .node-version           # 20
```

---

## Deployment notes

- **Frontend (live):** https://ai-csv-to-crm-importer.onrender.com  
- **Backend:** [FILL IN] — set `NEXT_PUBLIC_API_URL` on the frontend to the backend URL and `CORS_ORIGIN` on the backend to the frontend URL.
- `render.yaml` defines separate `groweasy-frontend` and `groweasy-backend` web services; Redis and MongoDB must be provisioned separately (not in `docker-compose` on Render).
