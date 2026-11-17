import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.dependencies import get_db
from app.main import app
from app.scripts.seed import seed_database


@pytest.fixture(scope="session")
def test_engine():
    database_url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        pytest.fail("Set TEST_DATABASE_URL to a PostgreSQL 16 database")
    engine = create_engine(database_url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(config, "head")
    with Session(engine) as session:
        seed_database(session)
    yield engine
    engine.dispose()


@pytest.fixture
def client(test_engine) -> Iterator[TestClient]:
    factory = sessionmaker(test_engine, expire_on_commit=False)

    def get_test_db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
