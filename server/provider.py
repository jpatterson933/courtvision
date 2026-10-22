import gzip
import json
import time
from datetime import UTC, datetime

import httpx

from server.config import DATA_DIR, SOURCE_BASE
from server.normalize import normalize_game
from server.storage import all_games, import_states, store_game, store_import_state


def import_season(
    season: int, season_type: int = 2, limit: int | None = None, refresh: bool = False
) -> dict:
    key = f"espn:{season}:{season_type}"
    started = datetime.now(UTC).isoformat()
    previous = next((state for state in import_states() if state["id"] == key), {})
    with httpx.Client(
        timeout=30, headers={"User-Agent": "CourtVision/0.2 (personal basketball research)"}
    ) as client:
        schedule_url = f"{SOURCE_BASE}/teams/lal/schedule?season={season}&seasontype={season_type}"
        schedule = fetch_json(client, schedule_url)
        games = [
            event
            for event in schedule.get("events", [])
            if event["competitions"][0]["status"]["type"]["completed"]
        ]
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        (DATA_DIR / f"schedule-{season}-{season_type}.json").write_text(json.dumps(schedule))
        expected_ids = [str(event["id"]) for event in games]
        state = {
            "id": key,
            "season": season,
            "season_type_id": season_type,
            "expected_ids": expected_ids,
            "expected": len(games),
            "started_at": started,
            "last_success": previous.get("last_success"),
            "failures": [],
            "source_url": schedule_url,
            "status": "running",
        }
        store_import_state(key, state)
        existing = {game["id"] for game in all_games()}
        selected = sorted(games, key=lambda event: event["date"], reverse=True)
        if not refresh:
            selected = [event for event in selected if str(event["id"]) not in existing]
        if limit:
            selected = selected[:limit]
        imported = 0
        for event in selected:
            game_id = str(event["id"])
            try:
                document = import_game(client, game_id)
                imported += 1
                print(
                    f"{game_id} {document['local_date']} {document['opponent']['abbreviation']} "
                    f"{document['validation']['status']} "
                    f"({len(document['validation']['issues'])} issues)",
                    flush=True,
                )
            except (httpx.HTTPError, ValueError, KeyError) as error:
                state["failures"].append({"id": game_id, "error": str(error)[:300]})
                print(f"{game_id} failed: {error}", flush=True)
            time.sleep(0.35)
        available = {game["id"] for game in all_games()}
        state["missing_ids"] = sorted(set(expected_ids) - available)
        state["status"] = "partial" if state["failures"] or state["missing_ids"] else "complete"
        state["finished_at"] = datetime.now(UTC).isoformat()
        if state["status"] == "complete":
            state["last_success"] = state["finished_at"]
        state["imported_this_run"] = imported
        store_import_state(key, state)
        return state


def import_game(client: httpx.Client, game_id: str) -> dict:
    url = f"{SOURCE_BASE}/summary?event={game_id}"
    raw = fetch_json(client, url)
    document = normalize_game(raw)
    raw_dir = DATA_DIR / "raw" / game_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / f"{document['revision']}.json.gz"
    if not path.exists():
        with gzip.open(path, "wt") as output:
            json.dump(raw, output)
    store_game(document, url, str(path.relative_to(DATA_DIR)))
    return document


def rebuild_saved_games() -> int:
    count = 0
    for game in all_games():
        path = DATA_DIR / "raw" / game["id"] / f"{game['revision']}.json.gz"
        with gzip.open(path, "rt") as source:
            document = normalize_game(json.load(source))
        store_game(
            document, f"{SOURCE_BASE}/summary?event={game['id']}", str(path.relative_to(DATA_DIR))
        )
        count += 1
    return count


def fetch_json(client: httpx.Client, url: str) -> dict:
    for attempt in range(3):
        try:
            response = client.get(url)
            response.raise_for_status()
            return response.json()
        except (httpx.TimeoutException, httpx.ConnectError):
            if attempt == 2:
                raise
            time.sleep(2**attempt)
        except httpx.HTTPStatusError as error:
            if error.response.status_code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("Unable to retrieve game data.")
