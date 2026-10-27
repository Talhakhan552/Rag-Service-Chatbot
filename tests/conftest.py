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

Requires a real Postgres with pgvector reachable at TEST_DATABASE_URL,
which must point at a local host (the compose `db` service or
localhost). There is deliberately no fallback to DATABASE_URL: that
can be a hosted database, and every test ends with drop_all. Run via:
    docker compose exec -e TEST_DATABASE_URL=postgresql+asyncpg://USER:PASS@db:5432/rag_test app pytest
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 -- registers all models on Base.metadata
from app.core.rate_limit import limiter
from app.database.base import Base
from app.database.session import get_db
from app.main import create_app

LOCAL_DB_HOSTS = {"db", "localhost", "127.0.0.1", "::1"}

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit("TEST_DATABASE_URL is not set -- refusing to run (tests drop all tables).", returncode=2)
if make_url(TEST_DATABASE_URL).host not in LOCAL_DB_HOSTS:
    pytest.exit(
        f"TEST_DATABASE_URL host {make_url(TEST_DATABASE_URL).host!r} is not local -- refusing to run "
        f"(tests drop all tables). Allowed hosts: {sorted(LOCAL_DB_HOSTS)}",
        returncode=2,
    )


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