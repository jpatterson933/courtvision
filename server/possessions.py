import re


def reconstruct_possessions(game: dict) -> tuple[list[dict], list[str]]:
    possessions, issues = [], []
    teams = list(game["teams"])
    for period in range(1, game["periods"] + 1):
        events = [event for event in game["events"] if event["period"] == period]
        current = None
        boundary = (period - 1) * 720 if period <= 4 else 2880 + (period - 5) * 300
        next_team = None
        for index, event in enumerate(events):
            event["possession_id"] = None
            kind = event["type"]
            if is_retained_free_throw(event):
                continue
            offense = offensive_team(event, teams)
            if current and offense and offense != current["team_id"]:
                if not any(e["type"] == "jumpball" for e in events[max(0, index - 3) : index]):
                    issues.append(f"Possession boundary inferred before event {event['id']}.")
                finish_possession(current, events[max(0, index - 1)], possessions)
                boundary = events[max(0, index - 1)]["elapsed"]
                current = None
            if current is None and offense:
                current = begin_possession(event, offense, boundary, game["id"], len(possessions))
            if current:
                event["possession_id"] = current["id"]
                current["event_ids"].append(event["id"])
                if event["team_id"] == current["team_id"]:
                    current["points"] += event["points"]
                terminal = ends_possession(event, events[index + 1 :])
                if terminal:
                    finish_possession(current, event, possessions)
                    next_team = next(item for item in teams if item != current["team_id"])
                    current = None
                    boundary = event["elapsed"]
            if (
                kind == "end period"
                and current is None
                and next_team
                and boundary < event["elapsed"]
            ):
                held = begin_possession(event, next_team, boundary, game["id"], len(possessions))
                held["event_ids"] = [event["id"]]
                event["possession_id"] = held["id"]
                finish_possession(held, event, possessions)
                boundary = event["elapsed"]
        if current and events:
            finish_possession(current, events[-1], possessions)
    return possessions, issues


def begin_possession(event: dict, team: str, start: float, game_id: str, count: int) -> dict:
    return {
        "id": f"{game_id}-p{count + 1}",
        "team_id": team,
        "period": event["period"],
        "start": start,
        "start_margin": event["margin"]
        - (event["points"] if event["team_id"] == "13" else -event["points"]),
        "points": 0,
        "event_ids": [],
        "lineups": event.get("lineups", {}),
    }


def finish_possession(possession: dict, event: dict, possessions: list[dict]):
    possession["end"] = event["elapsed"]
    possession["outcome"] = event["type"]
    possession["lineups"] = event.get("lineups", {})
    possessions.append(possession)


def offensive_team(event: dict, teams: list[str]) -> str | None:
    team, kind = event["team_id"], event["type"]
    if team not in teams:
        return None
    if (
        event["field_goal"]
        or event["free_throw"]
        or event.get("turnover", "turnover" in kind)
        or "offensive rebound" in kind
    ):
        return team
    if "defensive rebound" in kind:
        return next(item for item in teams if item != team)
    return None


def is_retained_free_throw(event: dict) -> bool:
    return event["free_throw"] and any(
        word in event["type"] + " " + event["description"].lower()
        for word in ("technical", "flagrant", "clear path", "transition take", "away from play")
    )


def ends_possession(event: dict, following: list[dict]) -> bool:
    kind = event["type"]
    if (
        event.get("turnover", "turnover" in kind)
        or "defensive rebound" in kind
        or kind == "end period"
    ):
        return True
    if event["field_goal"] and event["made"]:
        for next_event in following:
            if next_event["elapsed"] != event["elapsed"]:
                break
            if (
                next_event["free_throw"]
                and "1 of 1" in next_event["type"]
                and next_event["team_id"] == event["team_id"]
                and not is_retained_free_throw(next_event)
            ):
                return False
        return True
    if event["free_throw"] and event["made"]:
        attempt = re.search(r"(\d) of (\d)", kind)
        return bool(attempt and attempt[1] == attempt[2])
    return False
