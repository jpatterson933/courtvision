import gzip
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from server import storage
from server.normalize import normalize_game


@pytest.fixture
def real_game():
    path = Path(__file__).parent / "fixtures" / "401811053.json.gz"
    with gzip.open(path, "rt") as source:
        return normalize_game(json.load(source))


@pytest.fixture
def database(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    monkeypatch.setattr(storage, "engine", engine)
    storage.initialize_database()
    storage.games_at_revision.cache_clear()
    yield engine
    storage.games_at_revision.cache_clear()
    engine.dispose()


@pytest.fixture
def imported_game(database, real_game):
    storage.store_game(real_game, "https://example.test/source", "fixture.json.gz")
    return real_game
