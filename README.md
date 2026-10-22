# CourtVision · Los Angeles Lakers

A local statistical research workspace for Lakers games. Explore a game, isolate a stretch, compare lineups or players, and save the evidence behind a finding.

The rebuilt app includes a linked score-margin timeline, shots, rotations, possession and event logs; season and player game logs; five-player units and multi-player on/off filters; date, opponent, venue, rest, score and clutch filters; side-by-side samples; frozen research snapshots; CSV exports; and completed-game refreshes.

## Start locally

Requirements: Python 3.12 or newer, [uv](https://docs.astral.sh/uv/), Node.js 24, and Docker (Docker Desktop or Colima).

```bash
uv sync --frozen
npm --prefix client ci
cp .env.example .env
docker compose up -d --wait postgres
uv run python -m server.cli import --season 2026
docker compose stop client server  # only needed if the Docker app is already running
./scripts/dev.sh
```

Open [CourtVision](http://127.0.0.1:3000). The API runs on port 8000 and PostgreSQL on 5434. All exposed ports bind to localhost. This is a personal app with no account or public hosting setup.

If using the existing workspace, the 2025-26 regular season is already loaded. Imports are idempotent and skip existing games. First-time backfill needs internet access; analysis of imported games works offline.

## Data and refresh

ESPN provides the completed-game schedules, box scores, events, and shot coordinates. CourtVision reconstructs possessions and rotations. These are **not official NBA advanced statistics**. Full-game box totals and filtered event totals can differ after source corrections; the interface reports discrepancies and unavailable rotations.

```bash
# Season ending year: 2026 = 2025-26
uv run python -m server.cli import --season 2027 --season-type 1
# 1 = preseason, 2 = regular season, 3 = postseason
uv run python -m server.cli import --season 2026 --refresh --limit 5
uv run python -m server.cli validate
uv run python -m server.cli rebuild
```

The refresh button updates the selected season/type and rechecks its five latest games. `CV_AUTO_REFRESH=1` checks for completed current-season games hourly while the server is running, including recent corrections. It does not install an operating-system scheduler. Raw responses are stored under `data/raw`; PostgreSQL keeps normalized games, coverage, source revisions, and saved findings. For local Python runs, back up `data/` and the database volume `courtvision_lakers_data`. The Docker app stores source files in the named volume `courtvision_lakers_raw`; back up that volume alongside the database.

Saved findings preserve calculated results, selected games, source hashes, filters, notes, and method version. Re-running filters uses current data and can include newly imported games. The original snapshot stays fixed, including a pinned comparison and selected player detail.

See [data validation and methods](docs/DATA_VALIDATION.md) for verified coverage and calculation limits, and [the approved proposal](docs/LAKERS_PROPOSAL.md) for product direction.

## Verification

```bash
uv run pytest -q
uv run ruff check server tests
uv run ruff format --check server tests
npm --prefix client run lint
npm --prefix client run format:check
npm --prefix client run build
```

Tests use six real saved games and an isolated SQLite database. They cover scores, corrected event order, minutes, team heaves, period/time filters, player drilldowns, on/off partitions, zero denominators, possession edge cases, import idempotence, and saved comparisons surviving source revisions. They do not require a running PostgreSQL server or network access.

## Run entirely in Docker

```bash
docker compose --profile app up --build -d
docker compose run --rm server .venv/bin/python -m server.cli import --season 2026
```

Stop any local app servers before using these same ports. Docker source archives live in `courtvision_lakers_raw`, not the host `data/` directory. Run import and rebuild commands inside the server container when using this mode. `docker compose down` retains the database. Do not add `-v` unless you intend to erase it.

## Code map

- `server/provider.py`: fetch, archive, and import source games.
- `server/normalize.py`, `lineups.py`, `possessions.py`, `validation.py`: reconstruct and validate basketball data.
- `server/queries.py`, `metrics.py`: shared filters and count-based calculations.
- `server/main.py`, `storage.py`: API, refresh jobs, PostgreSQL records, and research snapshots.
- `client/src/components/`: analysis workspace, filters, charts, and tables.

The app needs no paid data account or AI subscription. League-wide benchmarks, tagged play types, tracking data, video, predictions, and trade/draft tools are outside this release.
