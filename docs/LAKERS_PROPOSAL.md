# CourtVision: Lakers statistical analysis proposal

Draft for Jeff Patterson. October 12, 2026.

Rebuild CourtVision around one job: help Jeff investigate the Los Angeles Lakers through trustworthy statistics, from an individual possession to a full season. The product should make it easy to ask a question, compare the relevant samples, inspect the underlying games, and save a finding.

Jeff's stated preference is **anything driven by stats**. Game analysis, lineup performance, player combinations, and season trends therefore form the core. Start with completed games and a personal desktop workflow. Build a useful statistical research tool before adding predictions or an AI interface.

This document is a proposal. The review inspected source code and current provider documentation; it did not run the application, inspect a populated database, or verify live game downloads. Data access and coverage remain the first implementation gate.

**The experience we should build**

Open CourtVision and see the latest available Lakers game, recent team trends, and saved investigations. Open a game and see where the scoring margin changed, which players shared the floor, and how shooting, turnovers, rebounding, and free throws contributed to the result. Select a stretch of the game to update every chart and table to that same stretch.

From there, follow a question across games: did that lineup struggle only tonight, or throughout the month? Was the difference fewer shots at the rim, more turnovers, or unusually poor shooting? Every comparison shows the games, minutes, attempts, and possessions behind it.

Examples of questions the app should support:

- Which Lakers combinations have performed best, and over how many possessions?
- What changes when two selected players play together, separately, or both sit?
- Where did the Lakers gain or lose ground in a particular game?
- Has a player's shot selection changed over the last ten games?
- Are recent offensive gains coming from shooting efficiency, offensive rebounds, fewer turnovers, or free throws?
- How do results change by opponent, home/away, rest, period, or score margin?
- Are closing lineups producing different results from the rest of the rotation?

These are research questions, not promised findings. The app must distinguish an observed difference from an explanation of its cause.

**What exists today, and what it means for the rebuild**

The repository contains a Next.js interface, a Python FastAPI server, PostgreSQL models and migrations, Redis integration, seven data connector implementations, and a player profiling feature called Player Genome. The old roadmap targets a much broader NBA product.

| Finding from the source review | Implication |
| --- | --- |
| The [home page](/Users/jeffpatterson/Desktop/repos/courtvision/client/src/app/page.tsx:1) organizes the product around player profiles, market value, lineups, trades, and draft analysis. | Replace the navigation and primary workflow with Lakers analysis. |
| The lineup, market, trade, and draft pages contain headings and descriptions. | These are placeholders, not completed analysis tools we need to preserve. |
| The [PBP Stats connector](/Users/jeffpatterson/Desktop/repos/courtvision/server/ingestion/pbpstats.py:77) writes season aggregates with a null game ID, while the [lineup model](/Users/jeffpatterson/Desktop/repos/courtvision/server/db/models/lineup.py:13) requires a game ID. | The current path cannot provide reliable game-level rotation analysis as written. |
| The [Cleaning the Glass file importer](/Users/jeffpatterson/Desktop/repos/courtvision/server/ingestion/cleaning_glass.py:70) counts rows as inserted without persisting them. | Existing ingestion success counters are insufficient evidence of usable data. |
| The [development seed script](/Users/jeffpatterson/Desktop/repos/courtvision/scripts/seed_genome_dev.py:1) generates synthetic data. | A populated development screen would not establish real NBA coverage. |
| The backend test directory contains a [health endpoint test](/Users/jeffpatterson/Desktop/repos/courtvision/server/tests/test_health.py:1), but no basketball calculation or ingestion tests. | Statistical correctness needs its own verification foundation. |

Recommendation: keep the familiar Next.js, Python, and PostgreSQL foundation where it helps, and replace the product workflow, ingestion path, and statistical calculations. Reuse chart primitives only after checking them. Remove the seven-provider dependency chain, Player Genome scores, trade tools, and draft tools from the active product. Redis and machine learning dependencies should not be prerequisites for the first release.

The working tree already contains modified and untracked files. Before implementation replaces anything, preserve the full working state, including untracked source files, and inventory any existing database contents. A Git tag alone would not preserve that work.

**First release scope**

| Area | What Jeff can do | Initial measures and controls |
| --- | --- | --- |
| Lakers overview | Find a game and identify changes worth investigating. | Results, recent versus season performance, offense and defense per 100 possessions, shooting and possession factors, data freshness. |
| Game workspace | Explore a completed game and select a period or stretch. | Score margin timeline, box score, rotation timeline, possession list, shooting locations where available, and offense/defense comparisons. |
| Lineups | Compare five-player units, pairs, and selected players on/off the floor. | Minutes, offensive and defensive possessions, points, net rating, shot profile, turnovers, and rebounding. Include opponent units when reconstructed. |
| Players | Examine a Laker's role, efficiency, and changes over time. | Game logs, minutes, shot volume and locations, effective field goal percentage, true shooting percentage, assists, turnovers, and team results with/without the player. |
| Research | Build, save, and revisit a statistical comparison. | Date range, game type, opponent, venue, rest, period, score margin, players on/off, minimum sample, saved notes, and CSV export. |

Use common filters across views. A saved investigation preserves its filters, metric definitions, source revision, and selected games so it can be reproduced. Clearly distinguish a fixed historical comparison from a rolling view that updates as games arrive.

Lakers games are the detailed dataset, including the opposing team and players in those games. League and opponent summary statistics provide context when available. Opponent season ratings must come from full opponent summaries; their games against the Lakers alone are not a valid league benchmark.

Target the 2025-26 season for the first historical backfill and add 2026-27 completed games as available. Coverage must be demonstrated before promising a complete season. Keep regular season, playoffs, play-in, preseason, and special competition games distinct. Default to regular-season comparisons and make other selections explicit. Rosters come from game participation and dated membership records rather than a hardcoded list of current players.

**Statistical rules that make the app worth trusting**

Depth should come from useful comparisons and inspectable evidence. It should not depend on a proprietary-looking score whose meaning is unclear.

| Measure or behavior | Proposed rule |
| --- | --- |
| Offensive / defensive rating | Points scored / allowed per 100 relevant offensive / defensive possessions. Show each denominator. |
| Net rating | Offensive rating minus defensive rating. Keep raw point differential available alongside it. |
| Shooting efficiency | Effective FG% = (FG made + 0.5 × threes made) / FG attempted. True shooting uses the standard box-score approximation with 0.44 × free throw attempts and is labeled accordingly. |
| Possession factors | Display shooting efficiency, turnovers per possession, offensive rebound share, and free throw attempts per field goal attempt. State definitions so comparisons use the same formula. |
| Aggregation | Sum the underlying counts and recompute rates. Do not average game percentages or lineup ratings without their denominators. |
| Small samples | Always show attempts, minutes, possessions, and number of games. Offer adjustable sample minimums; short stretches remain exploratory. |
| On/off comparisons | Describe team results in those minutes. They do not isolate a player's causal contribution from teammates, opponents, or rotation choices. |
| Clutch and score filters | Provide explicit, editable definitions. A default clutch view uses the last five minutes of the fourth quarter or overtime, within five points. Evaluate context at possession start. |
| Large-margin minutes | Include all minutes by default. An optional exclusion states its exact rule and how many possessions it removes. |
| Missing inputs | Show unavailable or partial coverage. Missing data never becomes a measured zero. |
| Trends | Show rolling windows beside season totals and sample sizes. Keep roster eras and competition types visible. |

Possessions need careful treatment of offensive rebounds, free throws, technical fouls, substitutions, period endings, and corrected events. Store scoring events separately from possession counts so unusual free throws still reconcile to the final score. Define a consistent attribution rule for possessions spanning a substitution, while retaining event-time lineups and exact stint scoring. Surface unresolved lineup intervals and exclude them from lineup comparisons with the exclusion count shown.

Shot charts show observed locations and outcomes. Terms such as open shot, defensive coverage, gravity, and expected shot quality require additional evidence. Basic play-by-play must not be used to invent those attributes.

**Data strategy**

Start with one verified game-data path and keep raw responses so calculations can be reproduced. Evaluate NBA data accessed through `nba_api`, using supported current endpoints, with `pbpstats` as a candidate for possession and lineup parsing.

The `nba_api` project exposes NBA.com statistics and live-data interfaces, but notes that NBA.com does not announce endpoint changes through it. Its February 2026 changelog deprecates PlayByPlayV2 because it returns empty responses. This is a concrete reason to validate today's feeds before building around older connector code. [Project documentation](https://github.com/swar/nba_api), [maintainer changelog](https://github.com/swar/nba_api/blob/master/CHANGELOG.MD).

The `pbpstats` package documents possession boundaries, event-time lineups, shot zones, and event-order corrections. It also supports loading saved responses. Treat it as a parser candidate, distinct from the existing connector to the pbpstats.com website API. Verify compatibility with the selected current feed and season. [Package documentation](https://pbpstats.readthedocs.io/en/latest/), [loading and data-quality notes](https://pbpstats.readthedocs.io/en/latest/quickstart.html).

| Need | First approach | If the sample fails |
| --- | --- | --- |
| Schedules, results, box scores | Verify current NBA endpoints through `nba_api`; cache responses. | Evaluate a documented commercial game feed or supported data-file import. |
| Events, possessions, rotations | Verify event coverage and a compatible parser on real Lakers games. | Evaluate Sportradar for game events and on-court data, then validate the same calculations. |
| Shot locations | Verify coordinate coverage and units in the selected source. | Retain available shot totals and zones; show coordinate coverage explicitly. |
| League comparisons | Obtain compatible season summary statistics. | Offer Lakers historical comparisons until league coverage is available. |
| Play types and richer matchup analysis | Later, evaluate tagged data for a specific unanswered question. | Keep the feature absent until the required data is available. |

Sportradar documents a game play-by-play feed and on-court fields conditional on game coverage. It is a fallback candidate, not an assumed existing integration or purchase. Pricing, account access, historical coverage, and intended use would need confirmation. [Sportradar game feed](https://developer.sportradar.com/basketball/reference/nba-play-by-play).

For later statistical depth, Synergy documents tagged play types, lineups, coordinates, and player roles. That may enable pick-and-roll, isolation, and other action-level studies if the required access is available. It is separate from the basic game-data decision. [Synergy documentation](https://developer.sportradar.com/basketball/reference/synergy-basketball-overview).

Do not inherit the old roadmap's unlimited-budget assumption. Begin locally without a paid-data commitment. After the sample proves what is missing, evaluate a specific provider against a specific need. Hosting, paid feeds, and optional AI usage are separate cost decisions; this proposal does not quote unverified prices or assume existing subscriptions.

**Implementation shape**

Use a small application with three responsibilities:

1. **Import and validate.** Fetch completed Lakers games, retain raw source revisions, normalize IDs, reconstruct events and possessions, and record validation results.
2. **Calculate and query.** Compute tested statistics in Python and store the normalized records and useful summaries in PostgreSQL.
3. **Explore.** Serve the Next.js interface with linked charts, comparison tables, filters, and saved investigations.

The main records are games, dated player participation, source-ID mappings, raw snapshots, events, possessions, lineup stints, shots, validation results, and saved analyses. Keep external identifiers mapped explicitly; player names are display labels, not join keys. Document each provider's season convention and map it to a single internal representation.

An import must be safe to rerun without duplicates. A source correction should rebuild affected calculations and mark saved snapshots as superseded without silently changing their recorded evidence. Fetching belongs in a background job or command, not in page rendering. Add a scheduled postgame refresh during implementation, plus later correction checks. The app must show its last successful update and remain usable with previously imported games during an outage.

Design for dense but readable analysis: tables with meaningful sorting, linked timelines, restrained Lakers purple and gold, clear units, keyboard-accessible controls, and visible sample sizes. Start with desktop layouts because comparing games and lineups needs space. Support smaller screens for reading summaries.

**Build sequence and acceptance gates**

| Milestone | Deliverable | Gate before moving on |
| --- | --- | --- |
| 1. Prove the data | Preserve the existing working state. Import one real Lakers game, then a small varied sample including overtime and substitution edge cases where available. Produce a coverage and validation report. | Final and period scores reconcile exactly. Core player totals reconcile. Game-time coverage and five-player lineups validate, or incomplete intervals are explicitly identified. Reimporting creates no duplicates. Select the source and parser based on these results. |
| 2. Make one game deeply explorable | Replace the main workflow with the game workspace, linked timeline, possession list, rotations, and available shooting breakdowns. | Selecting a stretch updates every panel consistently. Displayed totals trace to events. A user can inspect a scoring swing and save a note with its evidence. |
| 3. Deliver the first release | Backfill the target Lakers season, add lineup/player comparisons, trends, saved investigations, exports, and postgame refresh. | Account for every expected completed game as validated, partial, or missing. Reconcile season totals across included games. Reproduce saved comparisons after reload. Clearly show sample sizes and coverage. |
| 4. Extend demonstrated needs | Add richer tagged statistics, multi-season studies, uncertainty estimates, or an optional natural-language query interface. | Each addition answers a question the first release cannot answer and has verified inputs and a documented method. |

The first useful demonstration is milestone 2. The first release is milestone 3. Milestone 1 determines how much reconstruction or provider integration is actually needed; estimate the remaining implementation effort after that evidence is available.

Verification should focus on basketball correctness: real saved responses, manually checked stretches, score and minutes reconciliation, possession edge cases, missing substitutions, zero denominators, source corrections, and repeat imports. Add one browser workflow covering game selection, filtering, and saving a comparison. Normal lint, build, and automated checks accompany implementation; a passing page build alone does not validate the statistics.

**Later possibilities, with a clear boundary**

An optional “Ask the Lakers data” interface could translate a question into the same visible filters and tested calculations used by the research screen. Every numerical answer would link to the computed result and supporting games. The model would not calculate statistics from memory or claim it watched possessions. Start with ordinary filters so the analysis remains useful without an AI subscription.

Defer trade machines, draft scouting, salary-cap modeling, roster optimization, betting predictions, automatic video analysis, live streaming infrastructure, and custom player-rating models. They would pull the project away from Jeff's stated goal. Team defense and opponent outcomes belong in the core; automated blame for individual defensive mistakes does not follow from those statistics.

The recommended next implementation step is milestone 1: establish a real, reproducible Lakers dataset and prove that the calculations reconcile. That evidence should drive the rebuild.
