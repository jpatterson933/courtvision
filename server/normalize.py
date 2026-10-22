import hashlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from server.config import LAKERS_ID, METHOD_VERSION
from server.lineups import reconstruct_lineups
from server.possessions import reconstruct_possessions
from server.validation import validate_game


def normalize_game(raw: dict) -> dict:
    header = raw["header"]
    competition = header["competitions"][0]
    teams = {item["team"]["id"]: normalize_team(item) for item in competition["competitors"]}
    if LAKERS_ID not in teams:
        raise ValueError("This game does not include the Los Angeles Lakers.")
    if not competition["status"]["type"]["completed"]:
        raise ValueError("Only completed games are imported.")
    opponent = next(team for team in teams.values() if team["id"] != LAKERS_ID)
    players = normalize_players(raw["boxscore"]["players"])
    home_id = next(team["id"] for team in teams.values() if team["home"])
    events = normalize_events(raw.get("plays", []), players, home_id)
    season = int(header["season"]["year"])
    game_date = datetime.fromisoformat(competition["date"].replace("Z", "+00:00"))
    relevant_source = {key: raw.get(key) for key in ("header", "boxscore", "plays")}
    revision = hashlib.sha256(json.dumps(relevant_source, sort_keys=True).encode()).hexdigest()
    document = {
        "id": str(header["id"]),
        "season": season,
        "season_label": f"{season - 1}-{str(season)[-2:]}",
        "season_type": {1: "Preseason", 2: "Regular season", 3: "Postseason"}.get(
            int(header["season"]["type"]), "Other"
        ),
        "date": competition["date"],
        "local_date": game_date.astimezone(ZoneInfo("America/Los_Angeles")).date().isoformat(),
        "teams": teams,
        "opponent": opponent,
        "home": teams[LAKERS_ID]["home"],
        "lakers_score": teams[LAKERS_ID]["score"],
        "opponent_score": opponent["score"],
        "result": "W" if teams[LAKERS_ID]["score"] > opponent["score"] else "L",
        "players": players,
        "events": events,
        "revision": revision,
        "method_version": METHOD_VERSION,
        "source": "ESPN",
        "source_url": f"https://www.espn.com/nba/game/_/gameId/{header['id']}",
        "periods": max((event["period"] for event in events), default=4),
        "box_totals": normalize_team_totals(raw["boxscore"]["teams"]),
    }
    document["duration"] = 2880 + max(0, document["periods"] - 4) * 300
    document["stints"], lineup_issues = reconstruct_lineups(document)
    document["possessions"], possession_issues = reconstruct_possessions(document)
    document["validation"] = validate_game(document, lineup_issues, possession_issues)
    return document


def normalize_team(item: dict) -> dict:
    team = item["team"]
    return {
        "id": str(team["id"]),
        "name": team["displayName"],
        "abbreviation": team["abbreviation"],
        "home": item["homeAway"] == "home",
        "score": int(item["score"]),
        "color": f"#{team.get('color', '555555')}",
        "period_scores": [
            int(float(score["displayValue"])) for score in item.get("linescores", [])
        ],
    }


def normalize_players(groups: list[dict]) -> dict:
    players = {}
    for group in groups:
        for statistics in group["statistics"]:
            for entry in statistics["athletes"]:
                athlete = entry["athlete"]
                if not athlete.get("id"):
                    continue
                values = dict(zip(statistics["names"], entry.get("stats", [])))
                fg, three, ft = [parse_pair(values.get(key, "0-0")) for key in ("FG", "3PT", "FT")]
                players[athlete["id"]] = {
                    "id": athlete["id"],
                    "name": athlete["displayName"],
                    "short_name": athlete.get("shortName", athlete["displayName"]),
                    "team_id": group["team"]["id"],
                    "starter": bool(entry.get("starter")),
                    "did_not_play": bool(entry.get("didNotPlay")),
                    "jersey": athlete.get("jersey", ""),
                    "position": athlete.get("position", {}).get("abbreviation", ""),
                    "box": {
                        "minutes": parse_number(values.get("MIN", "0")),
                        "points": parse_number(values.get("PTS", "0")),
                        "fgm": fg[0],
                        "fga": fg[1],
                        "three_made": three[0],
                        "three_attempts": three[1],
                        "ftm": ft[0],
                        "fta": ft[1],
                        **{
                            target: parse_number(values.get(source, "0"))
                            for source, target in [
                                ("REB", "rebounds"),
                                ("OREB", "oreb"),
                                ("DREB", "dreb"),
                                ("AST", "assists"),
                                ("TO", "turnovers"),
                                ("STL", "steals"),
                                ("BLK", "blocks"),
                                ("PF", "fouls"),
                                ("+/-", "plus_minus"),
                            ]
                        },
                    },
                }
    return players


def normalize_events(plays: list[dict], players: dict, home_id: str) -> list[dict]:
    events = []
    for sequence, play in enumerate(plays):
        kind = play["type"]["text"].replace("\n", " ").lower()
        period = play["period"]["number"]
        remaining = parse_clock(play["clock"]["displayValue"])
        participants = [
            person["athlete"]["id"]
            for person in play.get("participants", [])
            if person.get("athlete", {}).get("id")
        ]
        coordinate = play.get("coordinate", {})
        x, y = coordinate.get("x"), coordinate.get("y")
        valid_coordinate = x is not None and y is not None and 0 <= x <= 50 and -6 <= y <= 94
        free_throw = "free throw" in kind
        field_goal = bool(play.get("shootingPlay")) and not free_throw
        lakers_score = play["homeScore"] if home_id == LAKERS_ID else play["awayScore"]
        opponent_score = play["awayScore"] if home_id == LAKERS_ID else play["homeScore"]
        events.append(
            {
                "id": play["id"],
                "sequence": sequence,
                "provider_sequence": play["sequenceNumber"],
                "period": period,
                "clock": play["clock"]["displayValue"],
                "remaining": remaining,
                "elapsed": period_start(period) + period_length(period) - remaining,
                "type": kind,
                "description": play.get("text", ""),
                "team_id": play.get("team", {}).get("id"),
                "player_id": participants[0] if participants else None,
                "participants": participants,
                "assist_id": participants[1]
                if len(participants) > 1 and "assists)" in play.get("text", "")
                else None,
                "block_id": participants[1]
                if len(participants) > 1 and " blocks " in play.get("text", "")
                else None,
                "steal_id": participants[1]
                if len(participants) > 1 and "steals)" in play.get("text", "")
                else None,
                "points": int(play.get("scoreValue", 0)) if play.get("scoringPlay") else 0,
                "field_goal": field_goal,
                "free_throw": free_throw,
                "turnover": play.get("shortDescription") == "Turnover" or "turnover" in kind,
                "heave": field_goal and "heave" in kind and not play.get("scoringPlay"),
                "made": bool(play.get("scoringPlay")),
                "attempted_points": int(play.get("pointsAttempted", 0)),
                "x": float(x) if field_goal and valid_coordinate else None,
                "y": float(y) if field_goal and valid_coordinate else None,
                "lakers_score": lakers_score,
                "opponent_score": opponent_score,
                "margin": lakers_score - opponent_score,
            }
        )
    return events


def normalize_team_totals(teams: list[dict]) -> dict:
    result = {}
    for item in teams:
        stats = {stat["name"]: stat["displayValue"] for stat in item["statistics"]}
        fg = parse_pair(stats.get("fieldGoalsMade-fieldGoalsAttempted", "0-0"))
        three = parse_pair(
            stats.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "0-0")
        )
        ft = parse_pair(stats.get("freeThrowsMade-freeThrowsAttempted", "0-0"))
        result[item["team"]["id"]] = {
            "fgm": fg[0],
            "fga": fg[1],
            "three_made": three[0],
            "three_attempts": three[1],
            "ftm": ft[0],
            "fta": ft[1],
            **{
                target: parse_number(stats.get(source, "0"))
                for source, target in [
                    ("offensiveRebounds", "oreb"),
                    ("defensiveRebounds", "dreb"),
                    ("totalRebounds", "rebounds"),
                    ("assists", "assists"),
                    ("totalTurnovers", "turnovers"),
                ]
            },
        }
    return result


def parse_pair(value: str) -> tuple[int, int]:
    parts = value.split("-")
    return (int(parts[0]), int(parts[1])) if len(parts) == 2 else (0, 0)


def parse_number(value: str) -> float:
    if ":" in value:
        minutes, seconds = value.split(":")
        return int(minutes) + float(seconds) / 60
    try:
        return float(value)
    except ValueError:
        return 0


def parse_clock(clock: str) -> float:
    if ":" in clock:
        minutes, seconds = clock.split(":")
        return int(minutes) * 60 + float(seconds)
    return float(clock)


def period_start(period: int) -> int:
    return (period - 1) * 720 if period <= 4 else 2880 + (period - 5) * 300


def period_length(period: int) -> int:
    return 720 if period <= 4 else 300
