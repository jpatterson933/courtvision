# Data validation and methods

Verified locally on October 13, 2026. The full machine-readable report is [data-validation.json](data-validation.json). This is a coverage report for the imported source, not an endorsement of every source event or an independent official NBA possession count.

## Imported coverage

| Dataset | Expected completed games | Imported | Fully reconciled | Partial | Missing | Rotation time reconstructed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-26 regular season | 82 | 82 | 61 | 21 | 0 | 98.17% |
| 2026-27 preseason | 3 | 3 | 2 | 1 | 0 | 100% |

All 82 regular-season final scores reconcile from scoring events. Season aggregation matches the sum of published game scores: 9,540 Lakers points and 9,396 opponent points, with 53 wins and 29 losses. Team totals use published boxes plus explicitly tagged team heaves for shooting attempts; rates are recomputed from summed counts.

The October 5, 2026 preseason game (`401898716`) is missing three Sacramento free-throw points in the event feed. Its published final score is used for whole-game results; filtered events remain visibly partial. No points or event times were invented to repair it.

The regular-season partial games include assist/rebound/turnover attribution differences, six games with unresolved lineup periods, inferred possession boundaries, and stale cumulative period-closing scores. Some categories overlap. Individual failures and affected game IDs are preserved in the JSON report and the selected game's Data & methods panel.

## Source selection and provenance

The NBA CDN schedule and play-by-play requests returned HTTP 403 during source verification. The rebuild uses the working ESPN public game endpoints and a small source-specific parser. ESPN's public endpoints are not a contracted availability guarantee. No paid feed was purchased.

- [2025-26 Lakers schedule](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/lal/schedule?season=2026&seasontype=2)
- [2026-27 preseason schedule](https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/lal/schedule?season=2027&seasontype=1)
- [Reconciled sample game](https://www.espn.com/nba/game/_/gameId/401811053)

The ending year identifies a season. The game header supplies the actual season and competition type; the schedule's top-level season can describe the current season even on a historical request. Dates display in Los Angeles time. Player membership comes from that game's participants, never a manually maintained current roster.

Imports archive each relevant source revision, normalize ESPN IDs, replace that game's computed document, and retain source hashes with saved investigations. Corrections do not overwrite saved research results. Changes to method definitions must increment `METHOD_VERSION`, followed by `server.cli rebuild`.

## Calculation rules

- Preserve source event-array order. Corrected events can retain older sequence numbers that would corrupt rotation reconstruction if sorted numerically.
- Full-game team and individual counts use published box scores. Context filters use events. Tagged missed heaves count as team attempts and are excluded from player attempts.
- Offensive and defensive ratings divide points by their separate reconstructed possession counts, multiplied by 100. Net rating is their difference. These are CourtVision results, not official NBA advanced statistics.
- Possession boundaries include made shots, final made free throws, turnovers, defensive rebounds, and period endings. Offensive rebounds continue a possession. An and-one keeps the made shot and additional free throw together. Technical and other retained-possession free throws remain scoring events without creating or ending possessions.
- A possession is assigned the lineup at its terminal event. Scoring is assigned the lineup at the scoring event. A substitution within a possession can therefore produce a different event-time scoring unit and terminal possession unit.
- Quarter and elapsed-time filters select events at their timestamps and possessions by terminal timestamp. A partial stretch can cut across a possession. Clutch and margin context use the possession's starting score, with clutch requiring its start to be in the last five minutes of Q4 or overtime and within five points. Events without a possession use event-time context.
- Reconstruct exactly five players per team. Unresolved periods are excluded from lineup/on-off samples. Unknown lineups never become off-court minutes. Check reconstructed minutes against the provider's rounded box minutes with a 1.05-minute tolerance. Full-game player summaries fall back to published minutes when rotation coverage is incomplete.
- Effective FG% = `(FGM + 0.5 × 3PM) / FGA`. True shooting = `PTS / [2 × (FGA + 0.44 × FTA)]`, a box-score approximation. Zero denominators return unavailable, not zero percent.
- Possession factors: turnovers per 100 offensive possessions; offensive rebounds divided by own offensive plus opponent defensive rebounds; free throw attempts per 100 field-goal attempts. Individual rebounds exclude unassigned team rebounds.
- Shot zones use observed coordinates: rim within four feet, paint within the lane excluding rim, remaining twos as midrange, and source-tagged threes separated by location. Missing locations remain an explicit bucket. These descriptive zones do not represent tracking-based shot quality.
- Rest means days between Lakers game dates minus one, within the selected competition's imported history. Back-to-back requires zero intervening calendar days. The first imported game has unknown rest. In an incomplete backfill, rest filters should be treated as provisional.
- Aggregate counts before calculating percentages. On/off differences describe team outcomes and do not control for teammates, opponents, or coaching decisions.

## Verification and limits

Regression tests use six real source responses, including overtime, an event-order correction, a team heave, and known attribution discrepancies. Tests cover score/minute reconciliation, weighted aggregation, time and quarter selection, on/off partitions, possession edge cases, player logs/shots, duplicate imports, CSV output, and saved comparisons after source changes. Fixtures include only the basketball fields required for regression checks.

Browser verification covered desktop and 390px mobile layouts, season/competition switching, keyboard modal controls, linked quarter filtering (Q2 events and shots matched 30 Lakers points), player selection and a recent-game window, on/off comparison pinning, saving a finding, reloading the page, and reopening identical comparison results. An example finding is available in the research notebook.

The checked launch path is `scripts/dev.sh` with PostgreSQL in Docker. Both Docker images also build successfully. The app is designed for one local user; it does not include accounts or multi-user deployment controls.

Preseason and regular season are kept separate. Postseason import support uses ESPN's general postseason classification; detailed play-in and special-tournament classification requires additional source validation before comparisons spanning those competitions. No playoff backfill or league-wide benchmark is claimed here.

No tracking, play-type tags, defender attribution, video analysis, or causal impact estimates are inferred from ordinary play-by-play. Source discrepancies remain inspectable rather than being replaced with guessed data.

Dependency checks: runtime npm audit reports zero vulnerabilities after updating Next.js and React. Five findings remain in the development-only ESLint glob dependency chain, for which the suggested forced fix would downgrade Next lint tooling. They are not used to serve or calculate game analysis.
