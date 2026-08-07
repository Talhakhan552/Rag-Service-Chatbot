"""
Structured logging configuration using structlog.

Why structlog over stdlib logging directly: every log line becomes a
JSON object with consistent fields (timestamp, level, event, and any
context we bind, e.g. workspace_id, user_id, request_id). That makes
logs greppable/queryable in production log aggregators (Loki,
CloudWatch, etc.) instead of parsing free-text strings.

Call configure_logging() once at app startup (done in main.py).
Everywhere else: `from app.core.logging import get_logger` then
`logger = get_logger(__name__)`.
"""

import logging
import sys

import structlog

from app.core.config import settings


def configure_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if settings.debug else logging.INFO,
    )

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.app_env == "development":
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.debug else logging.INFO
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
