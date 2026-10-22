from server.lineups import player_seconds
from server.metrics import count_events


def validate_game(game: dict, lineup_issues: list[str], possession_issues: list[str]) -> dict:
    checks, issues = [], []
    events = game["events"]
    checks.append(check("Unique events", len({e["id"] for e in events}), len(events)))
    for team_id, team in game["teams"].items():
        counts = count_events(events, team_id)
        checks.append(check(f"{team['abbreviation']} final score", counts["points"], team["score"]))
        for key in ("fgm", "fga", "three_made", "three_attempts", "ftm", "fta", "turnovers"):
            expected = game["box_totals"][team_id][key]
            heaves = sum(e.get("heave", False) for e in events if e["team_id"] == team_id)
            if key in ("fga", "three_attempts"):
                expected += heaves
            checks.append(
                check(
                    f"{team['abbreviation']} {key} (including team heaves)", counts[key], expected
                )
            )
    for player in game["players"].values():
        if player["did_not_play"]:
            continue
        counts = count_events(events, player["team_id"], player["id"])
        for key in (
            "points",
            "fgm",
            "fga",
            "three_made",
            "three_attempts",
            "ftm",
            "fta",
            "assists",
            "turnovers",
            "oreb",
            "dreb",
        ):
            if counts[key] != player["box"][key]:
                issues.append(
                    f"{player['name']} {key}: events {counts[key]}, "
                    f"box score {player['box'][key]:g}."
                )
    for period in range(1, game["periods"] + 1):
        period_events = [e for e in events if e["period"] == period]
        closing = [e for e in period_events if e["type"] == "end period"]
        checks.append(
            {
                "name": f"Period {period} closing event",
                "passed": len(closing) == 1,
                "actual": len(closing),
                "expected": 1,
            }
        )
        if closing:
            for team_id in game["teams"]:
                cumulative = sum(
                    e["points"] for e in events if e["period"] <= period and e["team_id"] == team_id
                )
                score = (
                    closing[-1]["lakers_score"]
                    if team_id == "13"
                    else closing[-1]["opponent_score"]
                )
                checks.append(check(f"Period {period} team {team_id} score", cumulative, score))
    seconds = player_seconds(game["stints"])
    coverage = sum(stint["end"] - stint["start"] for stint in game["stints"])
    minutes_issues = []
    if coverage == game["duration"]:
        for player_id, player in game["players"].items():
            if abs(seconds.get(player_id, 0) / 60 - player["box"]["minutes"]) > 1.05:
                minutes_issues.append(
                    f"{player['name']}: reconstructed minutes differ from rounded box score."
                )
    shots = [e for e in events if e["field_goal"]]
    lineup_ok = not lineup_issues and not minutes_issues and coverage == game["duration"]
    # Failed minute reconciliation invalidates all lineup-based comparisons for this game.
    if minutes_issues:
        game["stints"] = []
        for event in events:
            event["lineups"] = {}
        for possession in game["possessions"]:
            possession["lineups"] = {}
        coverage = 0
    stats_ok = all(item["passed"] for item in checks) and not issues
    return {
        "status": "validated" if stats_ok and lineup_ok and not possession_issues else "partial",
        "stats_valid": stats_ok,
        "lineups_valid": lineup_ok,
        "checks": checks,
        "issues": issues + lineup_issues + minutes_issues + possession_issues,
        "lineup_coverage": round(100 * coverage / game["duration"], 2),
        "shot_coverage": round(100 * sum(e["x"] is not None for e in shots) / len(shots), 2)
        if shots
        else 0,
        "possession_method": (
            "Event reconstruction; terminal-event lineup attribution; "
            "retained free throws do not end possessions."
        ),
    }


def check(name: str, actual: float, expected: float) -> dict:
    return {"name": name, "actual": actual, "expected": expected, "passed": actual == expected}
