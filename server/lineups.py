from collections import defaultdict


def reconstruct_lineups(game: dict) -> tuple[list[dict], list[str]]:
    stints, issues = [], []
    for period in range(1, game["periods"] + 1):
        events = [event for event in game["events"] if event["period"] == period]
        if not events:
            issues.append(f"Period {period}: no events.")
            continue
        lineups = period_starters(game, events, period)
        period_stints, period_issues = follow_substitutions(events, lineups, period)
        if period_issues:
            issues.extend(period_issues)
            for event in events:
                event["lineups"] = {}
        else:
            stints.extend(period_stints)
    return stints, issues


def period_starters(game: dict, events: list[dict], period: int) -> dict[str, set[str]]:
    if period == 1:
        return {
            team: {
                p["id"] for p in game["players"].values() if p["team_id"] == team and p["starter"]
            }
            for team in game["teams"]
        }
    first_roles = {}
    for event in events:
        if event["type"] == "substitution" and len(event["participants"]) == 2:
            incoming, outgoing = event["participants"]
            first_roles.setdefault(incoming, "bench")
            first_roles.setdefault(outgoing, "court")
        elif is_on_court_action(event):
            for player_id in event["participants"]:
                first_roles.setdefault(player_id, "court")
    return {
        team: {
            player_id
            for player_id, role in first_roles.items()
            if role == "court" and game["players"].get(player_id, {}).get("team_id") == team
        }
        for team in game["teams"]
    }


def is_on_court_action(event: dict) -> bool:
    kind = event["type"]
    return (
        event["field_goal"]
        or "rebound" in kind
        or event.get("turnover", "turnover" in kind)
        or (event["free_throw"] and "technical" not in kind)
        or ("foul" in kind and not any(word in kind for word in ("technical", "bench", "delay")))
    )


def follow_substitutions(events: list[dict], lineups: dict, period: int):
    start = (period - 1) * 720 if period <= 4 else 2880 + (period - 5) * 300
    end = start + (720 if period <= 4 else 300)
    issues, stints = [], []
    if any(len(unit) != 5 for unit in lineups.values()):
        return [], [f"Period {period}: could not establish five starters for both teams."]
    stint_start = start
    for event in events:
        event["lineups"] = {team: sorted(unit) for team, unit in lineups.items()}
        if event["type"] != "substitution":
            if is_on_court_action(event):
                known_players = set().union(*lineups.values())
                if any(player not in known_players for player in event["participants"]):
                    issues.append(f"Period {period}: event {event['id']} contradicts the lineup.")
            continue
        if event["elapsed"] > stint_start:
            stints.append(
                {
                    "period": period,
                    "start": stint_start,
                    "end": event["elapsed"],
                    "lineups": {team: sorted(unit) for team, unit in lineups.items()},
                }
            )
            stint_start = event["elapsed"]
        team = event["team_id"]
        if len(event["participants"]) != 2 or team not in lineups:
            issues.append(f"Period {period}: substitution {event['id']} lacks participants.")
            continue
        incoming, outgoing = event["participants"]
        if outgoing not in lineups[team] or incoming in lineups[team]:
            issues.append(f"Period {period}: inconsistent substitution {event['id']}.")
            continue
        lineups[team].remove(outgoing)
        lineups[team].add(incoming)
    if stint_start < end:
        stints.append(
            {
                "period": period,
                "start": stint_start,
                "end": end,
                "lineups": {team: sorted(unit) for team, unit in lineups.items()},
            }
        )
    return stints, list(dict.fromkeys(issues))


def player_seconds(stints: list[dict]) -> dict[str, float]:
    seconds = defaultdict(float)
    for stint in stints:
        for unit in stint["lineups"].values():
            for player in unit:
                seconds[player] += stint["end"] - stint["start"]
    return dict(seconds)
