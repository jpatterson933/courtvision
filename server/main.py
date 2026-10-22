import asyncio
import csv
import io
import os
import threading
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import METHOD_VERSION
from server.provider import import_season
from server.queries import Filters, analyze, catalog, game_detail
from server.storage import Investigation, all_games, engine, initialize_database

import_lock = threading.Lock()
job_state = {"status": "idle", "error": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    task = asyncio.create_task(refresh_loop()) if os.environ.get("CV_AUTO_REFRESH") == "1" else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    engine.dispose()


app = FastAPI(title="CourtVision Lakers", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.exec_driver_sql("SELECT 1")
    return {"status": "ok", "database": True, "method_version": METHOD_VERSION}


@app.get("/api/catalog")
def get_catalog():
    return catalog()


@app.post("/api/analysis")
def get_analysis(filters: Filters):
    return analyze(filters)


@app.post("/api/games/{game_id}")
def get_game(game_id: str, filters: Filters):
    result = game_detail(game_id, filters)
    if result is None:
        raise HTTPException(404, "That game has not been imported.")
    return result


@app.post("/api/export")
def export_analysis(
    filters: Filters, table: Literal["players", "lineups", "games", "player-log"] = "players"
):
    result = analyze(filters)
    rows = result["players"]
    output = io.StringIO()
    columns = [
        "name",
        "games",
        "minutes",
        "points",
        "fga",
        "fgm",
        "three_attempts",
        "three_made",
        "fta",
        "ftm",
        "oreb",
        "dreb",
        "assists",
        "turnovers",
        "efg",
        "ts",
    ]
    if table == "lineups":
        rows = [{**row, "players": " / ".join(row["players"])} for row in result["lineups"]]
        columns = [
            "players",
            "games",
            "minutes",
            "possessions",
            "defensive_possessions",
            "points",
            "off_rating",
            "def_rating",
            "net_rating",
            "plus_minus",
            "efg",
            "turnover_rate",
            "oreb_pct",
        ]
    elif table == "games":
        rows = [{**row, "opponent": row["opponent"]["name"]} for row in result["trends"]]
        columns = [
            "id",
            "local_date",
            "opponent",
            "home",
            "result",
            "lakers_score",
            "opponent_score",
            "possessions",
            "defensive_possessions",
            "off_rating",
            "def_rating",
            "net_rating",
            "efg",
            "revision",
        ]
    elif table == "player-log":
        detail = result["player_detail"]
        rows = (
            [
                {
                    **row["stats"],
                    "game_id": row["game"]["id"],
                    "date": row["game"]["local_date"],
                    "opponent": row["game"]["opponent"]["name"],
                }
                for row in detail["logs"]
            ]
            if detail
            else []
        )
        columns = ["game_id", "date", "opponent", *columns]
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="lakers-{table}.csv"',
        },
    )


class SaveInvestigation(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=10000)
    filters: Filters
    comparison_filters: Filters | None = None
    expected_revisions: dict[str, str] | None = None
    comparison_revisions: dict[str, str] | None = None
    expected_method: str | None = None

    @field_validator("title")
    @classmethod
    def meaningful_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A finding needs a title.")
        return value.strip()


@app.post("/api/research", status_code=201)
def save_investigation(request: SaveInvestigation):
    result = analyze(request.filters)
    if request.expected_method and request.expected_method != METHOD_VERSION:
        raise HTTPException(409, "Calculations changed. Refresh your analysis before saving.")
    if request.expected_revisions is not None and request.expected_revisions != result["revisions"]:
        raise HTTPException(409, "Source data changed. Refresh your analysis before saving.")
    if not result["game_count"]:
        raise HTTPException(400, "Choose a sample with imported games before saving.")
    revisions = dict(result["revisions"])
    if request.comparison_filters:
        result["comparison"] = analyze(request.comparison_filters)
        if (
            request.comparison_revisions is not None
            and request.comparison_revisions != result["comparison"]["revisions"]
        ):
            raise HTTPException(
                409, "The pinned sample changed. Refresh and pin it again before saving."
            )
        revisions.update(result["comparison"]["revisions"])
    record = Investigation(
        id=str(uuid4()),
        title=request.title.strip(),
        note=request.note,
        filters=request.filters.model_dump(),
        snapshot=result,
        revisions=revisions,
        created_at=datetime.now(UTC),
    )
    with Session(engine) as session:
        session.add(record)
        session.commit()
        return investigation_document(record)


@app.get("/api/research")
def get_investigations():
    with Session(engine) as session:
        return [
            investigation_document(record)
            for record in session.scalars(
                select(Investigation).order_by(Investigation.created_at.desc())
            )
        ]


@app.delete("/api/research/{investigation_id}", status_code=204)
def delete_investigation(investigation_id: str):
    with Session(engine) as session:
        record = session.get(Investigation, investigation_id)
        if record is None:
            raise HTTPException(404, "Investigation not found.")
        session.delete(record)
        session.commit()


def investigation_document(record: Investigation) -> dict:
    current = {game["id"]: game["revision"] for game in all_games()}
    superseded = any(
        current.get(game_id) != revision for game_id, revision in record.revisions.items()
    )
    superseded = superseded or record.snapshot.get("method_version") != METHOD_VERSION
    return {
        "id": record.id,
        "title": record.title,
        "note": record.note,
        "filters": record.filters,
        "snapshot": record.snapshot,
        "created_at": record.created_at.isoformat(),
        "superseded": superseded,
    }


class ImportRequest(BaseModel):
    season: int = Field(default=2026, ge=2021, le=2100)
    season_type: int = Field(default=2, ge=1, le=3)


@app.post("/api/import", status_code=202)
def trigger_import(request: ImportRequest, tasks: BackgroundTasks):
    if not import_lock.acquire(blocking=False):
        raise HTTPException(409, "An import is already running.")
    job_state.update(status="running", error=None)
    tasks.add_task(run_import, request.season, request.season_type)
    return job_state


@app.get("/api/import")
def import_status():
    return job_state


def run_import(season: int, season_type: int):
    try:
        backfill = import_season(season, season_type)
        if backfill["failures"]:
            raise ValueError("Some games could not be imported.")
        refreshed = import_season(season, season_type, limit=5, refresh=True)
        if refreshed["failures"]:
            raise ValueError("Some games could not be refreshed.")
        job_state.update(status="complete", error=None)
    except Exception:
        job_state.update(
            status="failed",
            error=(
                "The data source could not be refreshed. "
                "Previously imported games are available. Retry later."
            ),
        )
    finally:
        import_lock.release()


async def refresh_loop():
    while True:
        now = datetime.now(UTC)
        season = now.year + int(now.month >= 10)
        season_types = [1, 2] if now.month == 10 else [2, 3] if now.month in (4, 5, 6, 7) else [2]
        for season_type in season_types:
            if import_lock.acquire(blocking=False):
                job_state.update(status="running", error=None)
                await asyncio.to_thread(run_import, season, season_type)
        await asyncio.sleep(3600)
