from collections import defaultdict

COUNT_KEYS = (
    "points",
    "fgm",
    "fga",
    "three_made",
    "three_attempts",
    "ftm",
    "fta",
    "oreb",
    "dreb",
    "rebounds",
    "turnovers",
    "assists",
)


def count_events(events: list[dict], team_id: str, player_id: str | None = None) -> dict:
    counts = dict.fromkeys(COUNT_KEYS, 0)
    for event in events:
        if event["team_id"] != team_id:
            continue
        if event["assist_id"] and (player_id is None or event["assist_id"] == player_id):
            counts["assists"] += 1
        if player_id is not None and event["player_id"] != player_id:
            continue
        counts["points"] += event["points"]
        if event["field_goal"] and not (player_id and event.get("heave")):
            counts["fga"] += 1
            counts["fgm"] += int(event["made"])
            if event["attempted_points"] == 3:
                counts["three_attempts"] += 1
                counts["three_made"] += int(event["made"])
        elif event["free_throw"]:
            counts["fta"] += 1
            counts["ftm"] += int(event["made"])
        if event.get("turnover", "turnover" in event["type"]):
            counts["turnovers"] += 1
        if "rebound" in event["type"] and event["player_id"]:
            counts["rebounds"] += 1
            counts["oreb" if "offensive" in event["type"] else "dreb"] += 1
    return counts


def rate(numerator: float, denominator: float, scale: float = 1) -> float | None:
    return round(scale * numerator / denominator, 3) if denominator else None


def with_rates(counts: dict, opponent: dict, possessions: int, defensive_possessions: int) -> dict:
    offense = rate(counts["points"], possessions, 100)
    defense = rate(opponent["points"], defensive_possessions, 100)
    return {
        **counts,
        "possessions": possessions,
        "defensive_possessions": defensive_possessions,
        "off_rating": offense,
        "def_rating": defense,
        "net_rating": round(offense - defense, 3)
        if offense is not None and defense is not None
        else None,
        "efg": rate(counts["fgm"] + 0.5 * counts["three_made"], counts["fga"], 100),
        "ts": rate(counts["points"], 2 * (counts["fga"] + 0.44 * counts["fta"]), 100),
        "three_pct": rate(counts["three_made"], counts["three_attempts"], 100),
        "three_rate": rate(counts["three_attempts"], counts["fga"], 100),
        "turnover_rate": rate(counts["turnovers"], possessions, 100),
        "oreb_pct": rate(counts["oreb"], counts["oreb"] + opponent["dreb"], 100),
        "ft_rate": rate(counts["fta"], counts["fga"], 100),
    }


def sum_counts(rows: list[dict]) -> dict:
    return {key: sum(row.get(key, 0) for row in rows) for key in COUNT_KEYS}


def shot_zones(shots: list[dict]) -> list[dict]:
    zones = defaultdict(lambda: {"attempts": 0, "made": 0, "points": 0})
    for shot in shots:
        if shot["x"] is None:
            name = "Location unavailable"
        elif shot["attempted_points"] == 3:
            name = (
                "Corner three"
                if abs(shot["x"] - 25) >= 21 and shot["y"] <= 14
                else "Above-break three"
            )
        elif (shot["x"] - 25) ** 2 + shot["y"] ** 2 <= 16:
            name = "At the rim"
        elif abs(shot["x"] - 25) <= 8 and shot["y"] <= 14:
            name = "Paint"
        else:
            name = "Midrange"
        zones[name]["attempts"] += 1
        zones[name]["made"] += int(shot["made"])
        zones[name]["points"] += shot["points"]
    order = [
        "At the rim",
        "Paint",
        "Midrange",
        "Corner three",
        "Above-break three",
        "Location unavailable",
    ]
    return [
        {
            "zone": name,
            **zones[name],
            "fg_pct": rate(zones[name]["made"], zones[name]["attempts"], 100),
        }
        for name in order
        if name in zones
    ]
