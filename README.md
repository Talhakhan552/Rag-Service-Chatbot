# Cortex — Multi-Tenant RAG Chatbot Platform

Turn any set of documents into a chatbot that answers questions grounded in them — with every answer citing exactly which document it came from.

Upload PDFs, DOCX, TXT, or Markdown files to a workspace. Cortex chunks and embeds them, and lets your team (or your customers, via API) chat with an AI that only speaks from what's actually in those documents — not from guesses.

---

## Features

* 🔐 **Auth** — JWT access tokens with server-side, revocable refresh tokens (rotate-on-use)
* 🏢 **Multi-tenant workspaces** — owner/admin/member roles, full data isolation enforced at the query level
* 📄 **Document ingestion** — PDF/DOCX/TXT/MD upload, background parsing, automatic chunking + embedding
* 🔍 **RAG retrieval** — pgvector cosine similarity search, scoped per-workspace
* 💬 **Streaming chat** — token-by-token responses over Server-Sent Events, with source citations on every answer
* 🛡️ **Prompt-injection guarding** — untrusted document content is explicitly fenced and flagged in every prompt
* 🔑 **Customer API keys** — dual auth (JWT for your app, API keys for customer integrations), each with its own rate-limit bucket
* 📊 **Usage dashboard** — per-workspace stats: documents, storage, chat volume, members
* 🎨 **Full web UI** — Next.js frontend with the same feature set, built for a technical/dev audience
* ✅ **Tested** — 38-test suite (unit + integration) run against a real Postgres/pgvector instance
* 🚀 **Production-ready deploy path** — hardened Docker images, nginx reverse proxy config, full deployment guide

---

## Tech Stack

### Backend

* [FastAPI](https://fastapi.tiangolo.com/) (async Python)
* [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector)
* [Redis](https://redis.io/)
* [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/)
* [OpenAI API](https://platform.openai.com/) (embeddings + chat)

### Frontend

* [Next.js](https://nextjs.org/) (App Router)
* TypeScript
* Tailwind CSS

### Infrastructure

* Docker
* Docker Compose
* nginx

---

## Architecture

```text
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Next.js   │─────▶│     FastAPI      │─────▶│   PostgreSQL    │
│  Frontend   │ REST │     Backend      │      │   + pgvector    │
└─────────────┘  SSE └──────────────────┘      └─────────────────┘
                           │      │
                           │      └──────▶ Redis (rate limiting)
                           │
                           └──────▶ OpenAI (embeddings + chat completion)
```

Every table that holds tenant data (`documents`, `chunks`, `chat_sessions`, `messages`, `api_keys`, `workspace_members`) carries a `workspace_id` foreign key, and every query filters on it — that's the actual mechanism that keeps one customer's data from ever surfacing in another's chat.

### The RAG Pipeline

1. **Upload** → file saved to disk, `Document` row created (`pending`)
2. **Background processing** → text extracted (`pypdf`/`python-docx`), split into ~500-token overlapping chunks
3. **Embedding** → each chunk embedded via OpenAI (`text-embedding-3-small`), stored as a `vector(1536)` column
4. **Query time** → the user's question is embedded, Postgres runs a cosine similarity search scoped to the workspace, top-5 chunks retrieved
5. **Prompt construction** → retrieved chunks are wrapped in explicit injection-guarding delimiters and instructions before being sent to the model
6. **Streaming response** → tokens stream back over SSE; the full reply and its sources are persisted once streaming completes

---

## Project Structure

```text
rag-saas/
├── app/
│   ├── auth/                # Registration, login, JWT, refresh tokens
│   ├── workspaces/          # Multi-tenancy: CRUD, roles, membership
│   ├── documents/           # Upload, storage, background parsing
│   ├── embeddings/          # Chunking + OpenAI embedding generation
│   ├── rag/                 # Vector retrieval + prompt construction
│   ├── chat/                # Streaming chat sessions & messages
│   ├── apikeys/             # Customer-facing API key auth
│   ├── admin/               # Usage stats dashboard endpoints
│   ├── database/            # Engine, session, declarative base
│   ├── models/              # SQLAlchemy ORM models
│   ├── services/             # LLM provider abstraction
│   ├── core/                 # Settings, logging, security, rate limiting
│   └── api/v1/               # Router aggregation
├── alembic/                   # Database migrations
├── tests/                     # Unit + integration test suite
├── frontend/                  # Next.js web app
│   ├── src/app/               # Pages (login, workspaces, chat, etc.)
│   ├── src/components/        # Chat, documents, members, API keys UI
│   └── src/lib/               # Typed API client
├── docker-compose.yml          # Local development stack
├── docker-compose.prod.yml     # Production stack (+ nginx)
├── nginx.conf                  # Reverse proxy config
└── DEPLOYMENT.md               # Production deployment guide
```

---

## Quickstart (Local Development)

### Backend

```bash
cp .env.example .env

# Fill in:
# JWT_SECRET_KEY
# POSTGRES_PASSWORD
# OPENAI_API_KEY

docker compose up --build -d
docker compose exec app alembic upgrade head
```

API docs (Swagger UI):

[**http://localhost:8000/docs**](http://localhost:8000/docs)

Health check:

[**http://localhost:8000/api/v1/health**](http://localhost:8000/api/v1/health)

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [**http://localhost:3000**](http://localhost:3000) — register an account, create a workspace, upload a document, and start chatting.

---

## Running Tests

```bash
docker compose exec db psql -U raguser -d ragchatbot -c "CREATE DATABASE ragchatbot_test;"

docker compose exec db psql -U raguser -d ragchatbot_test -c "CREATE EXTENSION IF NOT EXISTS vector;"

docker compose exec \
  -e TEST_DATABASE_URL="postgresql+asyncpg://raguser:<password>@db:5432/ragchatbot_test" \
  app pytest -v
```

38 tests covering:

* Password/JWT security
* Chunking algorithm
* RAG prompt injection-guarding
* Rate-limit key logic
* Integration tests for auth flows
* Tenant isolation against a real database

---

## API Overview

All endpoints are prefixed `/api/v1`. Full interactive docs are available at `/docs`.

| Area           | Endpoints                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **Auth**       | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`          |
| **Workspaces** | `GET/POST /workspaces`, `GET/PATCH/DELETE /workspaces/{id}`, `/workspaces/{id}/members`        |
| **Documents**  | `GET/POST /workspaces/{id}/documents`, `GET/DELETE /workspaces/{id}/documents/{id}`            |
| **Chat**       | `GET/POST /workspaces/{id}/chat/sessions`, `POST .../sessions/{id}/messages` (streams via SSE) |
| **API Keys**   | `GET/POST /workspaces/{id}/api-keys`, `DELETE .../api-keys/{id}`                               |
| **Admin**      | `GET /workspaces/{id}/admin/stats`                                                             |

Chat and document endpoints accept either a JWT:

```http
Authorization: Bearer ...
```

or a customer API key:

```http
X-API-Key: ...
```

The same endpoints serve both your own frontend and any customer's backend integration.

---

## Deployment

See [**DEPLOYMENT.md**](DEPLOYMENT.md) for the full production guide, including:

* TLS via Let's Encrypt
* nginx reverse proxy setup
* Environment separation
* Backups
* Pre-launch checklist

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

---

## License

Proprietary — all rights reserved.

---
