import gzip
import json
from pathlib import Path

import pytest

from server.lineups import player_seconds
from server.metrics import count_events, rate, sum_counts, with_rates
from server.normalize import normalize_game, parse_clock
from server.possessions import ends_possession, is_retained_free_throw
from server.queries import Filters, analyze, context_matches, game_detail

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize(
    "path", [p for p in FIXTURES.glob("*.json.gz") if p.stem != "401809506.json"]
)
def test_real_games_reconcile_scores_player_totals_and_rotations(path):
    game = normalize_game(json.load(gzip.open(path, "rt")))
    assert game["validation"]["status"] == "validated", game["validation"]
    assert sum(stint["end"] - stint["start"] for stint in game["stints"]) == game["duration"]
    assert all(len(unit) == 5 for stint in game["stints"] for unit in stint["lineups"].values())
    assert sum(player_seconds(game["stints"]).values()) == pytest.approx(game["duration"] * 10)


def test_real_feed_preserves_corrected_event_order():
    raw = json.load(gzip.open(FIXTURES / "401811025.json.gz", "rt"))
    game = normalize_game(raw)
    assert [event["id"] for event in game["events"]] == [play["id"] for play in raw["plays"]]
    assert game["validation"]["lineup_coverage"] == 100


def test_missed_heaves_count_for_team_but_not_shooter(real_game):
    heaves = [event for event in real_game["events"] if event["heave"]]
    assert len(heaves) == 1
    assert count_events(heaves, "13")["fga"] == 1
    assert count_events(heaves, "13", "1966")["fga"] == 0
    assert count_events(real_game["events"], "13", "1966")["fga"] == 15


def test_source_disagreement_is_reported_and_not_silently_repaired():
    raw = json.load(gzip.open(FIXTURES / "401809506.json.gz", "rt"))
    game = normalize_game(raw)
    assert game["validation"]["status"] == "partial"
    assert any("assists" in issue for issue in game["validation"]["issues"])
    assert all(check["passed"] for check in game["validation"]["checks"])


def test_game_and_quarter_totals_reconcile(imported_game):
    full = analyze(Filters(game_ids=[imported_game["id"]], minimum_possessions=0))
    quarters = [analyze(Filters(period=period)) for period in range(1, 5)]
    assert full["summary"]["points"] == 131
    assert full["opponent_summary"]["points"] == 107
    assert sum(sample["summary"]["points"] for sample in quarters) == 131
    assert (
        sum(sample["summary"]["possessions"] for sample in quarters)
        == full["summary"]["possessions"]
    )


def test_on_off_partition_preserves_points_possessions_and_minutes(imported_game):
    full = analyze(Filters())
    on = analyze(Filters(on=["1966"]))
    off = analyze(Filters(off=["1966"]))
    for key in ("points", "possessions", "defensive_possessions"):
        assert on["summary"][key] + off["summary"][key] == full["summary"][key]
    assert on["minutes"] + off["minutes"] == pytest.approx(full["minutes"], abs=0.02)
    assert on["game_count"] == off["game_count"] == 1


def test_unresolved_lineup_does_not_become_off_court_minutes(imported_game, monkeypatch):
    from server import storage

    imported_game["events"][0]["lineups"] = {}
    imported_game["stints"] = []
    for event in imported_game["events"]:
        event["lineups"] = {}
    for possession in imported_game["possessions"]:
        possession["lineups"] = {}
    storage.store_game(imported_game, "test", "test")
    assert analyze(Filters(off=["1966"]))["game_count"] == 0


def test_invalid_filter_combination_rejected():
    with pytest.raises(ValueError):
        Filters(on=["1966"], off=["1966"])
    with pytest.raises(ValueError):
        Filters(start=30, end=20)


def test_empty_sample_has_null_efficiency(imported_game):
    result = analyze(Filters(opponent="not-a-team"))
    assert result["game_count"] == 0
    assert result["summary"]["efg"] is None
    assert result["summary"]["off_rating"] is None


def test_filtered_event_list_and_shots_share_period(imported_game):
    detail = game_detail(imported_game["id"], Filters(period=2))
    assert {event["period"] for event in detail["events"]} == {2}
    assert (
        sum(event["points"] for event in detail["events"] if event["team_id"] == "13")
        == detail["analysis"]["summary"]["points"]
    )


def test_rates_recompute_from_counts_instead_of_averaging_percentages():
    counts = sum_counts([{"fgm": 1, "fga": 1}, {"fgm": 0, "fga": 9}])
    result = with_rates(counts, counts, 10, 10)
    assert result["efg"] == 10
    assert rate(0, 0) is None


def test_free_throw_and_and_one_boundaries():
    shot = {
        "type": "layup",
        "field_goal": True,
        "free_throw": False,
        "made": True,
        "elapsed": 10,
        "team_id": "13",
    }
    extra = {
        "type": "free throw - 1 of 1",
        "field_goal": False,
        "free_throw": True,
        "made": True,
        "elapsed": 10,
        "team_id": "13",
        "description": "made free throw",
    }
    assert not ends_possession(shot, [extra])
    assert ends_possession(extra, [])
    assert is_retained_free_throw({**extra, "type": "free throw - technical"})
    assert not ends_possession({**extra, "type": "free throw - 1 of 2"}, [])
    assert not ends_possession({**extra, "type": "free throw - 2 of 2", "made": False}, [])
    assert parse_clock("0.3") == 0.3


def test_repeat_import_is_idempotent(imported_game, database):
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from server import storage

    storage.store_game(imported_game, "test", "test")
    with Session(database) as session:
        assert session.scalar(select(func.count()).select_from(storage.Game)) == 1
        assert session.scalar(select(func.count()).select_from(storage.SourceRevision)) == 1


def test_player_drilldown_agrees_with_box_score_and_excludes_team_heaves(imported_game):
    result = analyze(Filters(player_id="1966"))["player_detail"]
    assert result["player"]["points"] == 18
    assert result["logs"][0]["stats"]["points"] == 18
    assert len(result["shots"]) == result["player"]["fga"] == 15
    assert sum(zone["attempts"] for zone in result["zones"]) == 15
    quarter = analyze(Filters(player_id="1966", period=1))["player_detail"]
    assert all(shot["period"] == 1 for shot in quarter["shots"])


def test_clutch_uses_possession_start_for_clock_and_score():
    filters = Filters(clutch=True)
    assert not context_matches(4, 2590, 4, filters, possession_start=2575)
    assert context_matches(4, 2590, 4, filters, possession_start=2580)
    assert not context_matches(4, 2590, 6, filters, possession_start=2580)
    assert context_matches(5, 2900, 2, filters, possession_start=2890)


def test_time_slice_has_same_scoring_events_across_views(imported_game):
    detail = game_detail(imported_game["id"], Filters(start=120, end=240))
    assert all(120 <= event["elapsed"] <= 240 for event in detail["events"])
    assert (
        sum(event["points"] for event in detail["events"] if event["team_id"] == "13")
        == detail["analysis"]["summary"]["points"]
    )
    assert all(120 <= stint["start"] < stint["end"] <= 240 for stint in detail["stints"])
