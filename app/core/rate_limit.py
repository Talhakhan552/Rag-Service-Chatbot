"""
Shared rate limiter instance + key function.

Split into its own module (rather than living in main.py) so route
files can import `limiter` to apply per-endpoint limits without a
circular import on app.main.

Key function: rate limits by API key when one is present (X-API-Key
header), falling back to IP address otherwise. This matters for
customer integrations -- multiple customers' backends can share an
egress IP (corporate NAT, cloud provider shared IPs), so limiting
purely by IP would let one noisy customer eat another's quota. Keying
by API key gives each customer integration its own bucket.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def rate_limit_key(request) -> str:
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"apikey:{api_key}"
    return get_remote_address(request)


# Redis storage so all uvicorn workers share one count (in-memory would
# give each worker its own bucket and reset on every restart).
limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=[f"{settings.rate_limit_per_minute}/minute"],
    storage_uri=settings.redis_url,
    # If Redis is down, count in memory instead of failing every request.
    in_memory_fallback_enabled=True,
)