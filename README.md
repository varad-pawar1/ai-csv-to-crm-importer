# GrowEasy CSV → CRM Importer

AI-powered tool that ingests any sales leads CSV and maps rows into GrowEasy's fixed CRM schema using LLM inference — no hardcoded column mappings.

## Architecture

```
Browser (Next.js 14)
    │
    ├── Client-side CSV preview (PapaParse)
    ├── Mapping preview (AI column inference)
    └── SSE progress stream
         │
         ▼
Express API (Node + TypeScript)
    │
    ├── POST /api/import          → create job, enqueue batches
    ├── GET  /api/import/:id/stream → SSE progress
    ├── GET  /api/import/:id/results
    └── GET  /api/import/:id/export
         │
    ┌────┴────┐
    ▼         ▼
 MongoDB    Redis/BullMQ
 (durable)  (queue + retries)
                │
                ▼
           LLM Worker
      (OpenAI / Anthropic / Gemini)
```

## Why this architecture?

- **BullMQ + Redis**: CSV imports with thousands of rows require batched LLM calls over minutes. Upload returns `jobId` immediately; workers process asynchronously with retry/backoff.
- **MongoDB**: `mappedData` per lead is schema-flexible JSON from the LLM — documents fit naturally.
- **SSE (not polling)**: BullMQ emits progress events as batches complete — piped directly to the browser for low-latency updates.
- **Server-side re-parse**: Client preview is for UX only; the server always re-parses CSV on import.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Queue | BullMQ + Redis |
| Database | MongoDB + Mongoose |
| Realtime | Server-Sent Events |
| AI | Provider-agnostic adapter (OpenAI / Anthropic / Gemini) |
| CSV | PapaParse |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for MongoDB + Redis)

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Edit `backend/.env` and `frontend/.env` with your values.

Set your AI provider API key in `backend/.env`:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### 4. Run development servers

```bash
# Terminal 1 — Backend (port 4000)
npm run dev:backend

# Terminal 2 — Frontend (port 3000)
npm run dev:frontend
```

Open http://localhost:3000

## Product Flow

1. **Upload** — Drag-and-drop CSV (max 10MB)
2. **Preview** — Client-side table preview (no AI call)
3. **Confirm** — AI mapping preview, dedup warnings, cost estimate
4. **Processing** — SSE-driven progress bar with live counts
5. **Result** — Virtualized table with confidence flags, export CSV/JSON

## CRM Schema

```
created_at, name, email, country_code, mobile_without_country_code,
company, city, state, country, lead_owner, crm_status, crm_note,
data_source, possession_time, description, _skipped, _skip_reason
```

### Enum fields (never guessed)
- `crm_status`: GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE
- `data_source`: leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/import/preview-mapping` | AI column mapping preview |
| POST | `/api/import` | Start import job |
| GET | `/api/import/:jobId/stream` | SSE progress stream |
| GET | `/api/import/:jobId/status` | Current job status |
| GET | `/api/import/:jobId/results` | Import results |
| GET | `/api/import/:jobId/export?format=csv\|json` | Download mapped data |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BATCH_SIZE` | 20 | Rows per LLM batch (15–30 recommended) |
| `AI_PROVIDER` | openai | Primary LLM provider |
| `AI_FALLBACK_PROVIDER` | anthropic | Fallback on primary failure |
| `MAX_FILE_SIZE_MB` | 10 | Upload size limit |
| `MAX_CSV_ROWS` | 50000 | Maximum rows per import |

## Design Decisions

- **Batch size 20**: Balance between LLM context window usage and retry granularity.
- **Concurrency 5**: Process 5 batches in parallel without overwhelming LLM rate limits.
- **Retry 3x exponential**: BullMQ handles transient LLM failures automatically.
- **Partial failure tolerance**: One failed batch doesn't kill the entire import.
- **CSV injection protection**: Fields starting with `=`, `+`, `-`, `@` are prefixed with `'` on export.
- **Resumability**: `jobId` in URL (`/import/[jobId]`) — reconnect SSE to pick up where processing left off.

## Testing

```bash
# Unit tests (no Docker required)
npm run test --workspace=backend

# Integration tests (requires MongoDB + Redis)
RUN_INTEGRATION_TESTS=true npm run test --workspace=backend
```

## Deployment

- **Frontend**: Vercel or Render — set `NEXT_PUBLIC_API_URL` to your backend URL
- **Backend**: Railway or Render — MongoDB + Redis, env vars from `backend/.env`

### Render (important)

Render sets `NODE_ENV=development` during build by default, which breaks Next.js static generation. The frontend build script already forces production mode via `cross-env`.

**Option A — deploy from repo root (single frontend service)**

| Setting | Value |
|---------|--------|
| Build Command | `npm install && npm run build:frontend` |
| Start Command | `npm start` |

**Option B — deploy with Root Directory (recommended)**

**Frontend service:**

| Setting | Value |
|---------|--------|
| Root Directory | `frontend` |
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm start` |
| Env | `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com` |

**Backend service:**

| Setting | Value |
|---------|--------|
| Root Directory | `backend` |
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm start` |

Or use the included [`render.yaml`](render.yaml) Blueprint for both services.

## Known Limitations

- LLM mapping quality depends on CSV header clarity and sample data
- Very large files (>50k rows) are rejected at parse time
- Real-time progress requires SSE-compatible proxy (Vercel rewrites handle this locally)
- Mapping preview requires a valid AI API key

## Project Structure

```
groweasy-csv-importer/
├── frontend/          # Next.js 14 App Router
│   ├── app/           # Pages (/, /import/[jobId])
│   ├── components/    # UI components
│   ├── hooks/         # SSE, import, dedup hooks
│   └── lib/           # API client, CSV parser
├── backend/           # Express API + BullMQ worker
│   ├── src/
│   │   ├── models/    # Mongoose schemas
│   │   ├── queue/     # BullMQ queue + worker
│   │   ├── services/  # CSV, AI, mapping, SSE
│   │   └── prompts/   # LLM system prompts
│   └── tests/         # Unit + integration tests
└── docker-compose.yml # MongoDB + Redis
```
