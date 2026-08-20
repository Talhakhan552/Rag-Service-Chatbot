FROM python:3.12-slim

# System deps needed by unstructured/pypdf/docx parsing libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Runs as a non-root user in production -- if a dependency ever has a
# code-execution vulnerability, this limits what an attacker who
# reaches the container can actually do (no write access outside
# directories explicitly granted below, no root inside the container).
RUN useradd --create-home --uid 1001 appuser \
    && mkdir -p /app/storage/uploads \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Lets `docker ps` / orchestrators (Compose, Kubernetes, etc.) see
# real application health, not just "the process is running" --
# hits the same /api/v1/health endpoint used throughout local dev.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]