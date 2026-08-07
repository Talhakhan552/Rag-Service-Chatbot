# RAG Chatbot SaaS

Multi-tenant Retrieval-Augmented Generation chatbot platform. Any business can
create a workspace, upload its documents, and get a chat interface (+ REST API)
that answers questions grounded in those documents, with source citations.

## Stack
FastAPI (async) · PostgreSQL + pgvector · Redis · JWT auth · Docker · OpenAI / Anthropic / Gemini

## Project structure
```
app/
  core/         # settings, logging, security primitives
  database/     # engine/session setup, base model
  models/       # SQLAlchemy ORM models
  auth/         # registration, login, JWT issuance
  workspaces/   # multi-tenant workspace CRUD + membership
  documents/    # upload, parsing, background processing
  embeddings/   # chunking + embedding generation, provider adapters
  rag/          # retrieval + prompt construction + injection guarding
  chat/         # chat sessions, streaming responses, citations
  services/     # cross-module business logic (LLM provider abstraction, etc.)
  utils/        # shared helpers
  api/v1/       # router aggregation
alembic/        # DB migrations
```

## Setup
```bash
cp .env.example .env      # fill in secrets (JWT key, LLM API keys, DB password)
docker compose up --build
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/api/v1/health

## Status
Step 1 complete: project scaffolding (config, logging, app factory, Docker).
Next: database layer (SQLAlchemy models + Alembic migrations).
