
---

## Quickstart (local development)

### Backend

```bash
cp .env.example .env
# Fill in: JWT_SECRET_KEY, POSTGRES_PASSWORD, OPENAI_API_KEY

docker compose up --build -d
docker compose exec app alembic upgrade head
```

API docs (Swagger UI): **http://localhost:8000/docs**
Health check: **http://localhost:8000/api/v1/health**

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000** — register an account, create a workspace, upload a document, and start chatting.

---

## Running Tests

```bash
docker compose exec db psql -U raguser -d ragchatbot -c "CREATE DATABASE ragchatbot_test;"
docker compose exec db psql -U raguser -d ragchatbot_test -c "CREATE EXTENSION IF NOT EXISTS vector;"

docker compose exec -e TEST_DATABASE_URL="postgresql+asyncpg://raguser:<password>@db:5432/ragchatbot_test" app pytest -v
```

38 tests covering: password/JWT security, chunking algorithm, RAG prompt injection-guarding, rate-limit key logic, and integration tests for auth flows and tenant isolation against a real database.

---

## API Overview

All endpoints are prefixed `/api/v1`. Full interactive docs at `/docs`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Workspaces | `GET/POST /workspaces`, `GET/PATCH/DELETE /workspaces/{id}`, `/workspaces/{id}/members` |
| Documents | `GET/POST /workspaces/{id}/documents`, `GET/DELETE /workspaces/{id}/documents/{id}` |
| Chat | `GET/POST /workspaces/{id}/chat/sessions`, `POST .../sessions/{id}/messages` (streams via SSE) |
| API Keys | `GET/POST /workspaces/{id}/api-keys`, `DELETE .../api-keys/{id}` |
| Admin | `GET /workspaces/{id}/admin/stats` |

Chat and document endpoints accept either a JWT (`Authorization: Bearer ...`) or a customer API key (`X-API-Key: ...`) — the same endpoints serve both your own frontend and any customer's backend integration.

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full production guide: TLS via Let's Encrypt, the nginx reverse proxy setup, environment separation, backups, and a pre-launch checklist.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

---

## License

Proprietary — all rights reserved.