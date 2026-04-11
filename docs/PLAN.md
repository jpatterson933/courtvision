# CourtVision: Multi-Phase Implementation Plan

## Progress

| Phase                      | Status      | Date       |
| -------------------------- | ----------- | ---------- |
| 1. Scaffolding             | In Progress | 2026-04-10 |
| 2. Schema + Connectors     | Pending     |            |
| 3. Player Genome           | Pending     |            |
| 4. Market Inefficiency     | Pending     |            |
| 5. Lineup Laboratory       | Pending     |            |
| 6. Trade & Draft           | Pending     |            |
| 7. Real-Time Pipeline      | Pending     |            |
| 8. Testing + Observability | Pending     |            |
| 9. Deployment              | Pending     |            |
| 10. Polish                 | Pending     |            |

> **New chat thread?** Read this file first, then say: _"Read docs/PLAN.md for full project context, then continue with Phase N."_

## Context

Building a full-stack NBA analytics platform from an empty repo. Four core modules (Player Genome, Market Inefficiency Dashboard, Lineup Laboratory, Trade & Draft Simulator) powered by 7 premium data sources, ML models, and rich D3 visualizations. Hobbyist project with unlimited budget.

---

## Top-Level Directory Structure

Monorepo with clear service separation. The repo root is the project root (`/` = `courtvision/`).

```
/
├── client/                     # Next.js frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router (pages via folder structure)
│   │   │   ├── genome/         # /genome route
│   │   │   ├── market/         # /market route
│   │   │   ├── lineups/        # /lineups route
│   │   │   ├── trades/         # /trades route
│   │   │   ├── draft/          # /draft route
│   │   │   ├── layout.tsx      # Root layout with sidebar
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── viz/            # D3 visualization components
│   │   │   ├── layout/         # Sidebar, header
│   │   │   └── ui/             # Shared UI primitives
│   │   ├── lib/                # API client, utilities
│   │   └── hooks/              # Custom React hooks
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
├── server/                     # Python FastAPI backend
│   ├── api/                    # FastAPI route handlers
│   ├── ingestion/              # Data source connectors
│   ├── models/                 # ML models (XGBoost, PyTorch, etc.)
│   ├── modules/                # The four core modules
│   │   ├── player_genome/
│   │   ├── market_inefficiency/
│   │   ├── lineup_lab/
│   │   └── trade_draft/
│   ├── db/                     # SQLAlchemy models + Alembic migrations
│   │   ├── models/             # Table definitions
│   │   ├── migrations/         # Alembic migration versions
│   │   ├── engine.py           # Async engine + session factory
│   │   └── base.py             # DeclarativeBase
│   ├── cache/                  # Redis caching layer
│   ├── config/                 # Settings, env management
│   ├── utils/                  # Shared helpers
│   ├── tests/                  # All backend tests
│   ├── main.py                 # FastAPI app factory + entrypoint
│   ├── pyproject.toml
│   └── Dockerfile
├── scripts/                    # One-off data loading, backfills
├── docs/                       # Project plan + architecture docs
│   └── PLAN.md                 # This plan -- the single source of truth
├── .github/workflows/          # CI/CD
├── docker-compose.yml          # Postgres, Redis, server, client
├── .env.example
└── .gitignore
```

**Notes on structure:**

- `client/` = Next.js frontend. Page routing is automatic via App Router folder structure.
- `server/` = Python FastAPI backend. Handles all DB calls, Redis, external API calls, ML model inference.
- `docs/PLAN.md` = This plan, committed to the repo so new chat threads can read it for context.
- Infrastructure files (`docker-compose.yml`, `.env.example`, CI workflows) live at root.
- **Alembic** is a database _migration tool_ (not a database). It tracks schema changes over time. PostgreSQL is the database. SQLAlchemy is the ORM. Alembic manages the migration files in `server/db/migrations/`.

---

## Phase 1: Project Scaffolding and Local Dev Environment

**Goal:** Get from empty repo to a running local stack -- health-check API endpoint, frontend shell rendering, Postgres + Redis connected. Also commit this plan to the repo as the source of truth for future chat threads.

**Deliverables:**

- **`docs/PLAN.md`** committed to repo (this plan) — the single source of truth across chat threads
- FastAPI backend with health-check endpoint
- Next.js frontend with sidebar navigation shell
- PostgreSQL 16 + Redis 7 via Docker Compose
- CI pipeline (GitHub Actions) for lint + test on push

**Step 0 — Document the plan:**
Before writing any code, commit `docs/PLAN.md` (this plan) to the repo. This file is what future chat threads will read to understand the project state. As each phase completes, update `docs/PLAN.md` with:

- A `## Progress` section at the top tracking completed phases with dates
- Any deviations from the original plan noted inline
- When starting a new chat thread, tell Claude: _"Read docs/PLAN.md for full project context, then continue with Phase N."_

**Key files:**

```
# Root
docs/PLAN.md                        # This plan — read this first in new threads
.env.example
docker-compose.yml
.gitignore
.github/workflows/ci.yml

# Server
server/pyproject.toml
server/Dockerfile
server/main.py                      # FastAPI app factory with lifespan
server/config/settings.py           # Pydantic BaseSettings
server/db/engine.py                 # Async SQLAlchemy engine + session
server/db/base.py                   # DeclarativeBase
server/cache/redis_client.py        # Async redis connection pool
server/api/__init__.py
server/api/health.py                # GET /health -> {"status":"ok","db":true,"redis":true}
server/tests/conftest.py
server/tests/test_health.py

# Client (frontend)
client/package.json
client/tsconfig.json
client/next.config.ts
client/tailwind.config.ts
client/Dockerfile
client/src/app/layout.tsx              # Root layout with sidebar
client/src/app/page.tsx                # Dashboard home (placeholder)
client/src/app/globals.css
client/src/components/layout/sidebar.tsx   # Nav: Genome, Market, Lineups, Trades, Draft
client/src/components/layout/header.tsx
client/src/lib/api.ts                      # Fetch wrapper pointing to server
```

**Details:**

- Docker Compose: 4 services (postgres:16, redis:7, server, client). Hot-reload via mounted source volumes. Named volumes for Postgres persistence.
- Server: FastAPI with async lifespan for DB/Redis pool init, CORS middleware for frontend origin
- Client: Next.js App Router, Tailwind CSS, shadcn/ui components
- CI: ruff check + pytest (server), npm lint + build (client), service containers for Postgres/Redis

**Verification:** `docker compose up` -> `curl localhost:8000/health` returns ok -> `localhost:3000` renders shell -> CI green

---

## Phase 2: Database Schema and Data Source Connectors

**Goal:** Define the full data warehouse schema and build connectors to all 7 data sources with rate limiting, retry, and error handling.

**Deliverables:**

- Complete PostgreSQL schema (players, teams, games, plays, tracking, shots, contracts, lineups, synergy, draft)
- `BaseConnector` ABC with retry/rate-limit pattern
- 7 connector implementations (Sportradar, Second Spectrum, Cleaning the Glass, PBP Stats, Spotrac, Synergy, Stats Perform)
- Ingestion logging (`ingestion_log` table)
- Backfill script and daily ingestion script
- Ingestion status API endpoint

**Key files:**

```
# Database models
server/db/models/__init__.py
server/db/models/player.py
server/db/models/team.py
server/db/models/game.py
server/db/models/play.py
server/db/models/tracking.py
server/db/models/shot.py
server/db/models/contract.py
server/db/models/draft.py
server/db/models/lineup.py
server/db/models/synergy.py
server/db/models/ingestion_log.py

# Migrations
server/db/migrations/001_initial_schema.py

# Connectors
server/ingestion/__init__.py
server/ingestion/base.py                # BaseConnector ABC
server/ingestion/sportradar.py
server/ingestion/second_spectrum.py
server/ingestion/cleaning_glass.py
server/ingestion/pbpstats.py
server/ingestion/spotrac.py
server/ingestion/synergy.py
server/ingestion/stats_perform.py
server/ingestion/scheduler.py

# Scripts
scripts/backfill_historical.py
scripts/daily_ingest.py

# API
server/api/ingestion.py               # GET /api/ingestion/status, POST /api/ingestion/trigger/{source}

# Tests
server/tests/test_ingestion/test_sportradar.py
server/tests/test_ingestion/test_base_connector.py
server/tests/test_ingestion/fixtures/   # Sample API response JSON
```

**Critical schema tables:**

- `players`: sportradar_id, second_spectrum_id, name, position, draft info
- `games`: season, game_date, teams, scores (indexed on season+date)
- `plays`: possession-level, partitioned by season
- `tracking_frames` + `player_positions`: highest-volume, partitioned by game_id range
- `shots`: x/y coords, expected_fg_pct, defender_distance, shot_quality_score
- `contracts`: salary, cap_hit, dead_money, trade_kicker, no_trade_clause
- `lineup_stints`: 5-man combos with off/def/net ratings
- `synergy_playtypes`: play type breakdowns with PPP and percentiles

**BaseConnector pattern:**

```python
class BaseConnector(ABC):
    # httpx.AsyncClient, AsyncLimiter for rate limiting, tenacity retry
    # Every connector logs to ingestion_log with row counts, errors, duration
```

**Verification:** `alembic upgrade head` succeeds -> backfill script populates data -> `GET /api/ingestion/status` shows row counts

---

## Phase 3: Feature Engineering Pipeline and Player Genome (Module 1)

**Goal:** Build the feature engineering pipeline transforming raw data into multi-dimensional Player Genomes. This is the intellectual core -- everything else depends on it.

**Deliverables:**

- Feature computation modules: shooting, defense, gravity, transition, fatigue, clutch, screening, playmaking, rebounding
- PyTorch spatial model for tracking-data-derived gravity metrics
- `player_genomes` table (key metrics as columns + JSONB `raw_features`)
- Genome pipeline orchestrator
- API: `/api/genome/{player_id}`, `/api/genome/compare`, `/api/genome/search`
- Frontend: genome radar chart ("radar on steroids"), shot chart, fatigue curve, gravity heatmap
- Redis caching for expensive genome computations

**Key files:**

```
# Server - feature engineering
server/modules/player_genome/__init__.py
server/modules/player_genome/features/shooting.py
server/modules/player_genome/features/defense.py
server/modules/player_genome/features/gravity.py       # PyTorch spatial model
server/modules/player_genome/features/transition.py
server/modules/player_genome/features/fatigue.py
server/modules/player_genome/features/clutch.py
server/modules/player_genome/features/screening.py
server/modules/player_genome/features/playmaking.py
server/modules/player_genome/features/rebounding.py
server/modules/player_genome/pipeline.py                # Orchestrates all features
server/modules/player_genome/normalization.py            # Percentile ranks, z-scores
server/db/models/genome.py
server/db/migrations/002_player_genomes.py
server/api/genome.py
server/tests/test_genome/

# App - frontend
client/src/app/genome/page.tsx                         # Player search + genome display
client/src/app/genome/[playerId]/page.tsx              # Individual player genome
client/src/app/genome/compare/page.tsx                 # Side-by-side comparison
client/src/components/viz/genome-radar.tsx              # D3 radar chart
client/src/components/viz/shot-chart.tsx
client/src/components/viz/fatigue-curve.tsx
client/src/components/viz/gravity-heatmap.tsx
client/src/components/genome/player-search.tsx
client/src/components/genome/genome-card.tsx
client/src/hooks/use-genome.ts
```

**Feature computation highlights:**

- **shooting.py**: Zone eFG%, shot quality differential, pull-up vs C&S, self-created ratio, shot distribution entropy
- **gravity.py**: PyTorch attention model on tracking sequences predicting defensive displacement attributable to focal player
- **defense.py**: Versatility (distinct play types defended), contest rate, recovery speed, quality-of-opponent weighting
- **fatigue.py**: Efficiency by cumulative-minutes bins, slope = fatigue_resilience
- **clutch.py**: eFG% of teammates' assisted shots with player on vs off court in clutch minutes
- **screening.py**: Screen contact time, defender displacement, DHO PPP from tracking data

**Pipeline orchestrator:** Load all player data in single DB round-trip -> compute all feature modules -> normalize to percentiles -> store + cache (24hr TTL, nightly full recompute)

**Frontend radar chart:** D3 multi-layer spider chart, 8-10 axes, filled polygon, league-average dotted circle, hover-to-expand sub-dimensions, comparison overlay mode, team color-coded, animated transitions

**Verification:** Genome computation for known players returns reasonable values -> top shooters rank high on shooting -> gravity correlates with Cleaning the Glass data -> radar chart renders with real data

---

## Phase 4: Market Inefficiency Dashboard (Module 2)

**Goal:** Combine Player Genome + contract data to identify market inefficiencies with forward projections.

**Can be worked in parallel with Phase 5 after Phase 3 completes.**

**Key files:**

```
# Server
server/modules/market_inefficiency/war_model.py         # XGBoost WAR estimation
server/modules/market_inefficiency/archetypes.py        # GMM clustering on genome vectors
server/modules/market_inefficiency/aging_curves.py      # Aging curves by archetype
server/modules/market_inefficiency/market_value.py      # Predicted salary from WAR
server/modules/market_inefficiency/value_spread.py      # Actual - predicted salary
server/modules/market_inefficiency/projections.py       # Forward projection
server/db/models/market.py
server/db/migrations/003_market_tables.py
server/api/market.py

# App
client/src/app/market/page.tsx
client/src/app/market/[playerId]/page.tsx
client/src/components/viz/value-scatter.tsx                 # WAR vs Salary scatter
client/src/components/viz/aging-curve.tsx
client/src/components/viz/surplus-bar.tsx
client/src/components/market/inefficiency-table.tsx
client/src/components/market/projection-card.tsx
client/src/hooks/use-market.ts
```

**Deliverables:**

- XGBoost WAR model (target: team wins added from RAPM/on-off; features: genome dimensions + minutes + usage)
- GMM player archetype clustering (12-15 archetypes from genome vectors)
- Aging curves by archetype (delta method + LOESS smoothing)
- Market value model (LightGBM: salary predicted from WAR + age + experience + market)
- Value spread = actual_salary - predicted_salary
- Frontend: WAR vs Salary scatter plot, aging curves, surplus bar chart, sortable inefficiency table, 3-year projection cards

**Verification:** WAR model R^2 > 0.70 -> archetypes are interpretable -> aging curves match basketball wisdom (guards ~27, bigs ~26) -> top inefficiencies list is plausible

---

## Phase 5: Lineup Laboratory (Module 3)

**Goal:** Constrained optimization for lineup construction with spatial fit modeling and Monte Carlo simulation.

**Can be worked in parallel with Phase 4 after Phase 3 completes.**

**Key files:**

```
# Server
server/modules/lineup_lab/lineup_model.py          # Net rating prediction
server/modules/lineup_lab/spatial_fit.py            # Spatial complementarity
server/modules/lineup_lab/optimizer.py              # PuLP rotation optimizer
server/modules/lineup_lab/monte_carlo.py            # Game simulation
server/modules/lineup_lab/stagger.py                # Stagger analysis
server/modules/lineup_lab/matchups.py               # Matchup-specific lineups
server/db/models/lineup_analysis.py
server/db/migrations/004_lineup_tables.py
server/api/lineups.py

# App
client/src/app/lineups/page.tsx
client/src/app/lineups/optimize/page.tsx
client/src/app/lineups/simulate/page.tsx
client/src/components/viz/court-spatial.tsx             # Half-court with player overlays
client/src/components/viz/rotation-timeline.tsx
client/src/components/viz/simulation-distribution.tsx   # Histogram of simulated outcomes
client/src/components/lineup/player-picker.tsx          # Drag-and-drop roster builder
client/src/components/lineup/lineup-card.tsx
client/src/components/lineup/stagger-matrix.tsx         # Minutes overlap heatmap
client/src/hooks/use-lineups.ts
```

**Deliverables:**

- Lineup net rating prediction model (ridge regression on concatenated genome vectors + interaction features)
- Spatial fit scoring (shot chart overlap penalty, gravity coverage reward, entropy measure)
- PuLP rotation optimizer (binary variables: player on/off per minute, constraints: exactly 5 on court, minutes limits, rest periods, stagger requirements)
- Monte Carlo game simulator (10K games, sample from lineup rating distributions)
- Stagger analysis (player-pair shared minutes heatmap)
- Frontend: drag-and-drop lineup builder, half-court spatial overlay, rotation timeline, simulation histogram, stagger matrix

**Verification:** Predicted net ratings within 3pts of observed for 200+ possession lineups -> optimizer produces valid 48-min rotation -> Monte Carlo shows >60% win prob for known good vs bad lineups -> spatial fit correlates with observed net ratings

---

## Phase 6: Trade and Draft Simulator (Module 4)

**Goal:** Knapsack optimizer for trades under CBA cap constraints + draft archetype classification with transition probability mapping.

**Depends on Phases 4 AND 5.**

**Key files:**

```
# Server
server/modules/trade_draft/cap_engine.py           # CBA salary cap rules
server/modules/trade_draft/trade_evaluator.py      # Evaluate proposed trades
server/modules/trade_draft/trade_optimizer.py      # Knapsack optimizer
server/modules/trade_draft/draft_model.py          # Prospect archetype classifier
server/modules/trade_draft/transition_probs.py     # College -> NBA mapping
server/modules/trade_draft/draft_projections.py    # Risk-adjusted projections
server/modules/trade_draft/draft_pick_value.py     # Pick value curve
server/db/models/trade.py
server/db/models/draft_board.py
server/db/migrations/005_trade_draft_tables.py
server/api/trades.py
server/api/draft.py

# App
client/src/app/trades/page.tsx                         # Trade machine
client/src/app/trades/optimizer/page.tsx               # Auto trade finder
client/src/app/draft/page.tsx                          # Draft board
client/src/app/draft/[prospectId]/page.tsx             # Prospect profile
client/src/components/trade/trade-builder.tsx           # Drag players between teams
client/src/components/trade/trade-impact.tsx            # Before/after comparison
client/src/components/trade/cap-sheet.tsx               # Visual cap sheet
client/src/components/draft/prospect-card.tsx
client/src/components/draft/draft-board-table.tsx
client/src/components/viz/pick-value-curve.tsx
client/src/components/viz/prospect-comp-radar.tsx
client/src/components/viz/transition-sankey.tsx          # Sankey: college -> NBA archetype
client/src/hooks/use-trades.ts
client/src/hooks/use-draft.ts
```

**Deliverables:**

- CBA cap engine (salary matching rules, aprons, trade exceptions, Bird rights, Stepien Rule)
- Trade evaluator (3-year projected win delta using aging curves)
- Knapsack trade optimizer (PuLP CBC solver with time limit)
- Draft prospect archetype classifier (random forest on college stats + combine data)
- Historical transition probability model (college archetype -> NBA outcome distribution, 2010-2025 training data)
- Risk-adjusted draft projections (expected WAR over rookie scale + 7 years, bust/star probability)
- Frontend: trade builder with real-time salary matching, before/after impact, cap sheet, big board, prospect radar, transition Sankey

**Verification:** Cap engine validates 10 known historical trades + rejects 5 illegal ones -> optimizer finds plausible trade targets -> draft archetypes match consensus scouting -> frontend enforces salary matching in real-time

---

## Phase 7: Real-Time Data Pipeline and Caching Layer

**Goal:** Hybrid batch + real-time system. Live game data, incremental genome updates, SSE for frontend.

**Can start after Phase 3.**

**Key files:**

```
# Server
server/realtime/game_feed.py            # WebSocket consumer for Sportradar live
server/realtime/event_processor.py      # Process plays, update materialized views
server/realtime/genome_updater.py       # Incremental genome update post-game
server/cache/strategy.py                # Cache key patterns, TTL, invalidation
server/cache/warmup.py                  # Pre-warm caches
server/api/live.py                      # SSE: /api/live/games, /api/live/game/{id}
server/tasks/worker.py                  # Async task worker (asyncio.Queue)
server/tasks/jobs.py                    # Background jobs

# App
client/src/hooks/use-live-game.ts          # SSE hook
client/src/components/live/game-ticker.tsx
client/src/components/live/live-game-feed.tsx
```

**Deliverables:**

- WebSocket consumer for Sportradar live feed
- Incremental genome update after each game (weighted rolling average; full recompute nightly)
- Redis caching strategy with `@cached` decorator (key patterns, TTLs, invalidation on new data)
- Simple async task worker (asyncio.Queue, no Celery)
- SSE endpoint for frontend live updates
- Frontend: live game ticker, real-time play-by-play

**Verification:** Live game streams play-by-play via SSE -> genomes update within 5 min of game end -> cached responses <50ms -> stale entries purged on new data

---

## Phase 8: Testing, Documentation, and Observability

**Goal:** Harden the system. >80% test coverage, structured logging, error tracking, comprehensive docs.

**Key files:**

```
# Server
server/tests/integration/test_genome_pipeline_e2e.py
server/tests/integration/test_trade_evaluator_e2e.py
server/tests/integration/test_lineup_optimizer_e2e.py
server/observability/logging.py         # structlog JSON logging
server/observability/metrics.py         # Prometheus metrics
server/observability/middleware.py      # Request logging + correlation IDs
server/observability/sentry.py          # Sentry init

# Docs (at root)
docs/architecture.md
docs/data-dictionary.md
docs/feature-definitions.md             # How each genome dimension is computed
docs/api-guide.md
docs/runbooks/backfill.md
docs/runbooks/adding-a-data-source.md
docs/runbooks/retraining-models.md
```

**Deliverables:**

- Integration tests for each module (end-to-end: ingest -> compute -> API)
- `structlog` JSON logging with correlation IDs
- Sentry error tracking + alerts (>5 errors/min, any 5xx)
- Prometheus metrics at `/metrics` (request duration, DB query time, cache hit rate, ingestion rows)
- `docs/feature-definitions.md` (critical: how every genome dimension is computed, for future self)
- `docs/data-dictionary.md`, `docs/architecture.md`, runbooks

**Verification:** `pytest` >80% coverage -> structured JSON logs with correlation IDs -> Sentry captures test errors -> `/metrics` returns Prometheus format -> docs are accurate

---

## Phase 9: Deployment and Production Infrastructure

**Goal:** Deploy to Railway with automated CI/CD.

**Key files:**

```
# Root (infra lives at root level)
railway.toml
docker-compose.prod.yml                 # Production overrides
server/Dockerfile.prod                  # Multi-stage optimized build
client/Dockerfile.prod                  # Next.js standalone output
.github/workflows/deploy.yml            # Deploy on merge to main
scripts/db_backup.py                    # Dump Postgres -> Cloudflare R2
scripts/db_restore.py
scripts/health_check.py
```

**Deliverables:**

- Railway config (4 services: server, app, managed Postgres, Redis)
- Multi-stage Dockerfiles for production
- GitHub Actions deploy on merge to main
- Weekly DB backups to Cloudflare R2
- Health monitoring script

**Verification:** `railway up` succeeds -> production `/health` returns ok -> frontend accessible -> auto-deploy on merge works -> backup script produces valid dump

---

## Phase 10: Polish, Performance, and Fun Features

**Goal:** Make it great. Performance tuning, UI polish, delightful extras.

**Key files:**

```
server/db/materialized_views.py         # Common query pre-aggregation
client/src/components/ui/theme-toggle.tsx   # Dark/light mode
client/src/components/ui/export-button.tsx  # Export as CSV/PNG
client/src/components/ui/share-link.tsx     # Shareable URLs
client/src/app/shared/[hash]/page.tsx       # Render shared view
client/src/components/genome/what-if-sliders.tsx
client/src/components/viz/season-compare.tsx
```

**Deliverables:**

- Materialized views for common queries (`mv_player_season_summary`, `mv_team_lineup_stats`)
- Additional indexes from `EXPLAIN ANALYZE`
- Dark mode
- Shareable links (compressed JSON state in URL hash)
- Export to CSV/PNG
- "What-if" sliders on genome page (adjust dimensions, see WAR/market value/lineup fit ripple)
- Season-over-season comparison views
- Mobile-responsive key pages

**Verification:** P95 API <200ms -> Lighthouse >90 -> dark mode works -> shared links reconstruct views -> what-if sliders update downstream metrics in real-time

---

## Phase Dependency Graph

```
Phase 1 (Scaffolding)
  └── Phase 2 (Schema + Connectors)
        ├── Phase 3 (Player Genome) ──────────────┐
        │     ├── Phase 4 (Market Inefficiency) ───┤  (4 & 5 parallel)
        │     ├── Phase 5 (Lineup Laboratory) ─────┤
        │     │     └── Phase 6 (Trade & Draft) ───┘  (needs 4 + 5)
        │     └── Phase 7 (Real-Time Pipeline)
        └────────────────────────────────────────────
              └── Phase 8 (Testing + Observability)
                    └── Phase 9 (Deployment)
                          └── Phase 10 (Polish)
```

## Critical Files (most important to get right)

1. `server/modules/player_genome/pipeline.py` -- Genome orchestrator; every module depends on it
2. `server/ingestion/base.py` -- BaseConnector ABC; pattern for all 7 connectors
3. `server/modules/trade_draft/cap_engine.py` -- Most complex business logic; errors invalidate all trade analysis
4. `server/modules/lineup_lab/optimizer.py` -- Most algorithmically challenging; likely needs iteration
5. `client/src/components/viz/genome-radar.tsx` -- Signature visualization; first thing users interact with
