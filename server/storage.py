from datetime import UTC, datetime
from functools import lru_cache

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from server.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "lakers_games"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    season: Mapped[int] = mapped_column(Integer, index=True)
    season_type: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[str] = mapped_column(String(32), index=True)
    revision: Mapped[str] = mapped_column(String(64))
    document: Mapped[dict] = mapped_column(JSON)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SourceRevision(Base):
    __tablename__ = "source_revisions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    game_id: Mapped[str] = mapped_column(String(32), index=True)
    revision: Mapped[str] = mapped_column(String(64))
    source_url: Mapped[str] = mapped_column(String(500))
    raw_path: Mapped[str] = mapped_column(String(500))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ImportState(Base):
    __tablename__ = "import_state"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    document: Mapped[dict] = mapped_column(JSON)


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    note: Mapped[str] = mapped_column(String(10000))
    filters: Mapped[dict] = mapped_column(JSON)
    snapshot: Mapped[dict] = mapped_column(JSON)
    revisions: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def initialize_database():
    Base.metadata.create_all(engine)


def all_games() -> list[dict]:
    with Session(engine) as session:
        revision = session.execute(select(func.max(Game.imported_at), func.count(Game.id))).one()
    return games_at_revision(tuple(revision))


@lru_cache(maxsize=1)
def games_at_revision(revision: tuple) -> list[dict]:
    with Session(engine) as session:
        return [row.document for row in session.scalars(select(Game).order_by(Game.date))]


def store_game(document: dict, source_url: str, raw_path: str):
    now = datetime.now(UTC)
    with Session(engine) as session:
        row = session.get(Game, document["id"]) or Game(id=document["id"])
        for field in ("season", "season_type", "date", "revision"):
            setattr(row, field, document[field])
        row.document = document
        row.imported_at = now
        session.add(row)
        revision_id = f"{row.id}:{row.revision}"
        if not session.get(SourceRevision, revision_id):
            session.add(
                SourceRevision(
                    id=revision_id,
                    game_id=row.id,
                    revision=row.revision,
                    source_url=source_url,
                    raw_path=raw_path,
                    fetched_at=now,
                )
            )
        session.commit()
    games_at_revision.cache_clear()


def store_import_state(key: str, document: dict):
    with Session(engine) as session:
        row = session.get(ImportState, key) or ImportState(id=key)
        row.document = document
        session.add(row)
        session.commit()


def import_states() -> list[dict]:
    with Session(engine) as session:
        return [row.document for row in session.scalars(select(ImportState))]
