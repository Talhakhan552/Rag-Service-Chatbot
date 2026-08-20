"""
Shared test fixtures.

Engine strategy: a fresh engine is created INSIDE the db_session
fixture (function-scoped) rather than once at module level. This
sidesteps pytest-asyncio's event-loop-scope settings entirely --
their exact ini key names and defaults have changed across versions
and caused repeated 'Task attached to a different loop' errors here.
A function-scoped fixture always runs on the exact same loop as the
function-scoped test that requests it, by pytest-asyncio's own
design contract, regardless of version -- so there's no scope to
configure or get wrong.

DB isolation: each test gets its own fresh schema (created and
dropped per test) and a transaction rolled back at the end. Slightly
slower than a shared schema, but simple and correct across
pytest-asyncio versions -- worth the tradeoff for a suite this size.

Requires a real Postgres with pgvector reachable at TEST_DATABASE_URL
(or DATABASE_URL as a fallback) -- run via:
    docker compose exec app pytest
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 -- registers all models on Base.metadata
from app.core.config import settings
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.main import create_app

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", settings.database_url)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.reset()
    yield


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    test_app = create_app()

    async def override_get_db():
        yield db_session

    test_app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac