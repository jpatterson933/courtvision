from datetime import date

from pydantic import BaseModel, Field, model_validator

from server.config import LAKERS_ID, METHOD_VERSION
from server.metrics import count_events, rate, shot_zones, sum_counts, with_rates
from server.storage import all_games, import_states


class Filters(BaseModel):
    season: int = 2026
    season_type: str = "Regular season"
    game_ids: list[str] = Field(default_factory=list)
    date_from: str | None = None
    date_to: str | None = None
    opponent: str | None = None
    venue: str = "all"
    rest: str = "all"
    period: int | None = Field(default=None, ge=1, le=15)
    start: float = Field(default=0, ge=0)
    end: float = Field(default=10000, gt=0, le=10000)
    on: list[str] = Field(default_factory=list, max_length=5)
    off: list[str] = Field(default_factory=list, max_length=15)
    max_margin: int | None = Field(default=None, ge=0, le=100)
    clutch: bool = False
    minimum_possessions: int = Field(default=20, ge=0, le=10000)
    last_n: int | None = Field(default=None, ge=1, le=100)
    player_id: str | None = None

    @model_validator(mode="after")
    def valid_selection(self):
        if self.start >= self.end:
            raise ValueError("The end time must be after the start time.")
        if set(self.on) & set(self.off):
            raise ValueError("A player cannot be both on and off the floor.")
        if self.venue not in ("all", "home", "away") or self.rest not in ("all", "b2b", "rested"):
            raise ValueError("Unknown venue or rest filter.")
        for value in (self.date_from, self.date_to):
            if value:
                date.fromisoformat(value)
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("The end date must be after the start date.")
        return self


def catalog() -> dict:
    games = all_games()
    seasons = sorted({game["season"] for game in games}, reverse=True)
    return {
        "games": [game_summary(game) for game in reversed(games)],
        "seasons": [{"value": year, "label": f"{year - 1}-{str(year)[-2:]}"} for year in seasons],
        "players": sorted(
            {
                player["id"]: {
                    key: player[key] for key in ("id", "name", "short_name", "jersey", "position")
                }
                for game in games
                for player in game["players"].values()
                if player["team_id"] == LAKERS_ID and not player["did_not_play"]
            }.values(),
            key=lambda player: player["name"],
        ),
        "imports": import_states(),
        "method_version": METHOD_VERSION,
    }


def analyze(filters: Filters) -> dict:
    games = select_games(filters)
    samples = [select_sample(game, filters) for game in games]
    active = [sample for sample in samples if sample["events"]]
    events = [event for sample in samples for event in sample["events"]]
    possessions = [possession for sample in samples for possession in sample["possessions"]]
    own = sum_counts([sample_counts(sample, LAKERS_ID) for sample in samples])
    opponents = sum_counts(
        [sample_counts(sample, sample["game"]["opponent"]["id"]) for sample in samples]
    )
    offense_count = sum(possession["team_id"] == LAKERS_ID for possession in possessions)
    defense_count = len(possessions) - offense_count
    shots = [event for event in events if event["field_goal"] and event["team_id"] == LAKERS_ID]
    return {
        "filters": filters.model_dump(),
        "games": [game_summary(s["game"]) for s in active],
        "game_count": len(active),
        "matching_games": len(games),
        "summary": with_rates(own, opponents, offense_count, defense_count),
        "opponent_summary": with_rates(opponents, own, defense_count, offense_count),
        "minutes": round(sum(s["seconds"] for s in samples) / 60, 2),
        "players": player_results(samples),
        "player_detail": player_detail(samples, filters.player_id) if filters.player_id else None,
        "lineups": lineup_results(samples, filters.minimum_possessions),
        "trends": [trend_result(sample) for sample in active],
        "zones": shot_zones(shots),
        "coverage": {
            "partial_games": sum(s["game"]["validation"]["status"] != "validated" for s in active),
            "excluded_lineup_seconds": sum(s["excluded_seconds"] for s in samples),
            "coordinate_shots": sum(shot["x"] is not None for shot in shots),
            "total_shots": len(shots),
            "heaves": sum(event.get("heave", False) for event in shots),
        },
        "method_version": METHOD_VERSION,
        "revisions": {game["id"]: game["revision"] for game in games},
    }


def game_detail(game_id: str, filters: Filters) -> dict | None:
    game = next((game for game in all_games() if game["id"] == game_id), None)
    if not game:
        return None
    selected = filters.model_copy(
        update={"season": game["season"], "season_type": game["season_type"], "game_ids": [game_id]}
    )
    sample = select_sample(game, selected)
    return {
        **game_summary(game),
        "teams": game["teams"],
        "roster": list(game["players"].values()),
        "events": sample["events"],
        "possessions": sample["possessions"],
        "stints": sample["stints"],
        "validation": game["validation"],
        "timeline": [
            {
                key: event[key]
                for key in (
                    "id",
                    "elapsed",
                    "period",
                    "clock",
                    "margin",
                    "lakers_score",
                    "opponent_score",
                    "description",
                )
            }
            for event in game["events"]
            if event["points"] or event["type"] == "end period"
        ],
        "analysis": analyze(selected),
        "source_url": game["source_url"],
    }


def player_detail(samples: list[dict], player_id: str) -> dict | None:
    player = next((row for row in player_results(samples) if row["id"] == player_id), None)
    if not player:
        return None
    logs = []
    for sample in samples:
        row = next((row for row in player_results([sample]) if row["id"] == player_id), None)
        if row:
            logs.append({"game": game_summary(sample["game"]), "stats": row})
    shots = [
        {**event, "id": f"{sample['game']['id']}:{event['id']}"}
        for sample in samples
        for event in sample["events"]
        if event["field_goal"] and event["player_id"] == player_id and not event["heave"]
    ]
    return {"player": player, "logs": logs, "shots": shots, "zones": shot_zones(shots)}


def game_summary(game: dict) -> dict:
    return {
        key: game[key]
        for key in (
            "id",
            "season",
            "season_label",
            "season_type",
            "date",
            "local_date",
            "opponent",
            "home",
            "lakers_score",
            "opponent_score",
            "result",
            "periods",
            "duration",
            "revision",
        )
    } | {
        "status": game["validation"]["status"],
        "lineup_coverage": game["validation"]["lineup_coverage"],
        "issues": len(game["validation"]["issues"])
        + sum(not check["passed"] for check in game["validation"]["checks"]),
    }


def select_games(filters: Filters) -> list[dict]:
    all_season = [
        game
        for game in all_games()
        if game["season"] == filters.season and game["season_type"] == filters.season_type
    ]
    selected = []
    for index, game in enumerate(all_season):
        rest_days = (
            (
                date.fromisoformat(game["local_date"])
                - date.fromisoformat(all_season[index - 1]["local_date"])
            ).days
            - 1
            if index
            else None
        )
        if filters.game_ids and game["id"] not in filters.game_ids:
            continue
        if filters.date_from and game["local_date"] < filters.date_from:
            continue
        if filters.date_to and game["local_date"] > filters.date_to:
            continue
        if filters.opponent and game["opponent"]["id"] != filters.opponent:
            continue
        if filters.venue != "all" and game["home"] != (filters.venue == "home"):
            continue
        if filters.rest == "b2b" and rest_days != 0:
            continue
        if filters.rest == "rested" and (rest_days is None or rest_days < 1):
            continue
        selected.append(game)
    return selected[-filters.last_n :] if filters.last_n else selected


def select_sample(game: dict, filters: Filters) -> dict:
    context = {possession["id"]: possession for possession in game["possessions"]}
    events = [event for event in game["events"] if event_matches(event, filters, context)]
    possessions = [
        possession for possession in game["possessions"] if possession_matches(possession, filters)
    ]
    stints = []
    for stint in game["stints"]:
        start, end = max(stint["start"], filters.start), min(stint["end"], filters.end)
        if start >= end or filters.period and stint["period"] != filters.period:
            continue
        if not lineup_matches(stint["lineups"], filters):
            continue
        if filters.clutch or filters.max_margin is not None:
            intervals = [(max(start, p["start"]), min(end, p["end"])) for p in possessions]
            for left, right in intervals:
                if left < right:
                    stints.append({**stint, "start": left, "end": right})
        else:
            stints.append({**stint, "start": start, "end": end})
    excluded = game["duration"] * (1 - game["validation"]["lineup_coverage"] / 100)
    whole_game = not (
        filters.period
        or filters.start
        or filters.end < game["duration"]
        or filters.on
        or filters.off
        or filters.clutch
        or filters.max_margin is not None
    )
    return {
        "game": game,
        "events": events,
        "possessions": possessions,
        "stints": stints,
        "whole_game": whole_game,
        "seconds": game["duration"]
        if whole_game
        else sum(stint["end"] - stint["start"] for stint in stints),
        "excluded_seconds": round(excluded, 1),
    }


def sample_counts(sample: dict, team_id: str) -> dict:
    if not sample["whole_game"]:
        return count_events(sample["events"], team_id)
    game = sample["game"]
    counts = dict(game["box_totals"][team_id])
    counts["points"] = game["teams"][team_id]["score"]
    heaves = sum(
        event.get("heave", False) for event in game["events"] if event["team_id"] == team_id
    )
    counts["fga"] += heaves
    counts["three_attempts"] += heaves
    return counts


def lineup_matches(lineups: dict, filters: Filters) -> bool:
    if not filters.on and not filters.off:
        return True
    unit = lineups.get(LAKERS_ID)
    return bool(unit and set(filters.on).issubset(unit) and not set(filters.off).intersection(unit))


def context_matches(
    period: int,
    elapsed: float,
    margin: int,
    filters: Filters,
    possession_start: float | None = None,
) -> bool:
    if filters.period and period != filters.period:
        return False
    if not filters.start <= elapsed <= filters.end:
        return False
    if filters.max_margin is not None and abs(margin) > filters.max_margin:
        return False
    context_time = elapsed if possession_start is None else possession_start
    if filters.clutch and not (period >= 4 and context_time >= 2580 and abs(margin) <= 5):
        return False
    return True


def event_matches(event: dict, filters: Filters, context: dict) -> bool:
    possession = context.get(event.get("possession_id"))
    margin = possession["start_margin"] if possession else event["margin"]
    start = possession["start"] if possession else None
    return context_matches(
        event["period"], event["elapsed"], margin, filters, start
    ) and lineup_matches(event.get("lineups", {}), filters)


def possession_matches(possession: dict, filters: Filters) -> bool:
    return context_matches(
        possession["period"],
        possession["end"],
        possession["start_margin"],
        filters,
        possession["start"],
    ) and lineup_matches(possession.get("lineups", {}), filters)


def trend_result(sample: dict) -> dict:
    game = sample["game"]
    own = sample_counts(sample, LAKERS_ID)
    opponent = sample_counts(sample, game["opponent"]["id"])
    possessions = sample["possessions"]
    offense = sum(p["team_id"] == LAKERS_ID for p in possessions)
    return {**game_summary(game), **with_rates(own, opponent, offense, len(possessions) - offense)}


def player_results(samples: list[dict]) -> list[dict]:
    results = {}
    for sample in samples:
        for player_id, player in sample["game"]["players"].items():
            if player["team_id"] != LAKERS_ID or player["did_not_play"]:
                continue
            counts = (
                player["box"]
                if sample["whole_game"]
                else count_events(sample["events"], LAKERS_ID, player_id)
            )
            seconds = sum(
                stint["end"] - stint["start"]
                for stint in sample["stints"]
                if player_id in stint["lineups"].get(LAKERS_ID, [])
            )
            if sample["whole_game"] and not sample["game"]["validation"]["lineups_valid"]:
                seconds = player["box"]["minutes"] * 60
            if not seconds and not any(counts.values()):
                continue
            row = results.setdefault(
                player_id,
                {
                    "id": player_id,
                    "name": player["name"],
                    "short_name": player["short_name"],
                    "position": player["position"],
                    "jersey": player["jersey"],
                    "games": 0,
                    "minutes": 0,
                    "counts": [],
                },
            )
            row["games"] += 1
            row["minutes"] += seconds / 60
            row["counts"].append(counts)
    output = []
    for row in results.values():
        counts = sum_counts(row.pop("counts"))
        output.append(
            {
                **row,
                **counts,
                "minutes": round(row["minutes"], 2),
                "ppg": rate(counts["points"], row["games"]),
                "efg": rate(counts["fgm"] + 0.5 * counts["three_made"], counts["fga"], 100),
                "ts": rate(counts["points"], 2 * (counts["fga"] + 0.44 * counts["fta"]), 100),
            }
        )
    return sorted(output, key=lambda row: row["points"], reverse=True)


def lineup_results(samples: list[dict], minimum: int) -> list[dict]:
    units = {}
    for sample in samples:
        game = sample["game"]
        for stint in sample["stints"]:
            unit = tuple(stint["lineups"].get(LAKERS_ID, []))
            if len(unit) != 5:
                continue
            row = units.setdefault(
                unit,
                {
                    "players": [game["players"][player]["short_name"] for player in unit],
                    "player_ids": list(unit),
                    "seconds": 0,
                    "game_ids": set(),
                    "events": [],
                    "possessions": [],
                },
            )
            row["seconds"] += stint["end"] - stint["start"]
            row["game_ids"].add(game["id"])
        for event in sample["events"]:
            unit = tuple(event.get("lineups", {}).get(LAKERS_ID, []))
            if unit in units:
                units[unit]["events"].append(event)
        for possession in sample["possessions"]:
            unit = tuple(possession.get("lineups", {}).get(LAKERS_ID, []))
            if unit in units:
                units[unit]["possessions"].append(possession)
    output = []
    for row in units.values():
        offense = sum(p["team_id"] == LAKERS_ID for p in row["possessions"])
        defense = len(row["possessions"]) - offense
        if offense < minimum:
            continue
        own = count_events(row["events"], LAKERS_ID)
        opponent = sum_counts(
            [
                count_events(row["events"], team)
                for team in {
                    e["team_id"]
                    for e in row["events"]
                    if e["team_id"] and e["team_id"] != LAKERS_ID
                }
            ]
        )
        output.append(
            {
                "players": row["players"],
                "player_ids": row["player_ids"],
                "games": len(row["game_ids"]),
                "minutes": round(row["seconds"] / 60, 2),
                "plus_minus": own["points"] - opponent["points"],
                **with_rates(own, opponent, offense, defense),
            }
        )
    return sorted(output, key=lambda row: row["possessions"], reverse=True)
