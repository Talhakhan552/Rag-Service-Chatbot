# Deployment Guide

This covers taking the app from your local Docker Compose setup to a
real production deployment on a server with a real domain.

## 1. Prerequisites

- A server (VPS, EC2, DigitalOcean droplet, etc.) with Docker and
  Docker Compose installed
- A domain name pointed at the server's IP address (an A record)
- Real API keys with billing set up: OpenAI (required), Anthropic/Gemini
  (only if you wire up alternate providers later)

## 2. Environment setup

```bash
cp .env.production.example .env.production
```

Fill in every blank value. In particular:
- `JWT_SECRET_KEY` — generate a **new** one, never reuse the dev value:
  `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — a real, unique password
- `OPENAI_API_KEY` — your real key
- `CORS_ORIGINS` and `NEXT_PUBLIC_API_URL` — your real domain, not `localhost`

Never commit `.env.production` — it's already covered by `.gitignore`
patterns matching `.env*`.

## 3. TLS certificates

The included `nginx.conf` expects certificates at `./certs/fullchain.pem`
and `./certs/privkey.pem`. The simplest way to get real ones is
[Let's Encrypt](https://letsencrypt.org) via certbot:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./certs/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./certs/
```

Certificates expire every 90 days — set up a cron job or systemd timer
to run `certbot renew` and copy the refreshed files into `./certs/`.

Edit `nginx.conf` and replace `your-domain.com` with your real domain
in both `server_name` lines.

## 4. Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
docker compose -f docker-compose.prod.yml ps
```

Then run migrations (same as dev, just against the prod container):

```bash
docker compose -f docker-compose.prod.yml exec app alembic upgrade head
```

Visit `https://your-domain.com` — nginx routes `/` to the frontend and
`/api/*` to the backend automatically.

## 5. What's different from local dev

| | Dev (`docker-compose.yml`) | Prod (`docker-compose.prod.yml`) |
|---|---|---|
| Source code | Bind-mounted (live edits) | Baked into the image at build time |
| App server | 1 uvicorn process | 4 uvicorn workers |
| DB/Redis ports | Exposed to host (`5432`, `6379`) | Internal only — not reachable from outside the Docker network |
| Restart policy | None | `restart: always` |
| TLS | None (`http://localhost`) | nginx terminates TLS |
| `DEBUG` | `true` | `false` (disables verbose SQL logging, etc.) |

## 6. Updating a running deployment

Since prod doesn't bind-mount source code, a code change requires a
rebuild:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
docker compose -f docker-compose.prod.yml exec app alembic upgrade head  # if there are new migrations
```

This causes a brief restart of the `app` and `frontend` containers.
For zero-downtime deploys you'd need a load balancer with multiple app
instances — out of scope until you actually have enough traffic to
need it.

## 7. Backups

Postgres holds everything that matters (accounts, workspaces, chunks,
chat history). Back it up regularly:

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U raguser ragchatbot > backup