from fastapi.testclient import TestClient

from server import main, storage


def test_save_reload_export_and_source_correction(imported_game, database, monkeypatch):
    monkeypatch.setattr(main, "engine", database)
    with TestClient(main.app) as client:
        assert client.get("/health").json()["database"]
        assert len(client.get("/api/catalog").json()["games"]) == 1
        created = client.post(
            "/api/research",
            json={
                "title": "LeBron on/off",
                "note": "Same-game comparison.",
                "filters": {"on": ["1966"]},
                "comparison_filters": {"off": ["1966"]},
            },
        )
        assert created.status_code == 201
        saved = created.json()
        assert saved["snapshot"]["comparison"]["filters"]["off"] == ["1966"]
        assert client.get("/api/research").json()[0]["snapshot"] == saved["snapshot"]
        imported_game["revision"] = "corrected-source"
        storage.store_game(imported_game, "test", "new-source")
        refreshed = client.get("/api/research").json()[0]
        assert refreshed["superseded"]
        assert refreshed["snapshot"] == saved["snapshot"]
        export = client.post("/api/export", json={"period": 1})
        assert export.status_code == 200
        assert "LeBron James" in export.text
        assert (
            "off_rating"
            in client.post("/api/export?table=lineups", json={"minimum_possessions": 0}).text
        )
        log = client.post("/api/export?table=player-log", json={"player_id": "1966"})
        assert log.status_code == 200 and "2026-04-12" in log.text
        assert client.post("/api/research", json={"title": "   ", "filters": {}}).status_code == 422
        stale = client.post(
            "/api/research",
            json={
                "title": "Stale sample",
                "filters": {},
                "expected_revisions": {imported_game["id"]: "old-source"},
            },
        )
        assert stale.status_code == 409
        assert (
            client.post("/api/analysis", json={"on": ["1966"], "off": ["1966"]}).status_code == 422
        )
        assert client.post("/api/games/missing", json={}).status_code == 404
        assert client.delete(f"/api/research/{saved['id']}").status_code == 204
        assert client.get("/api/research").json() == []
