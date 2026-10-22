"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerAnalysis } from "./player-analysis";
import { GameFlow, RotationChart, ShotChart, TrendChart } from "./charts";
import { PlayerFilters, SampleFilters } from "./filters";
import {
  Empty,
  GameList,
  LineupTable,
  PlayerTable,
  PlayTable,
  PossessionTable,
  ZoneTable,
} from "./tables";
import { number, request, signed } from "@/lib/api";
import { defaultFilters } from "@/lib/types";
import type {
  Analysis,
  Catalog,
  Filters,
  GameDetail,
  Investigation,
  View,
} from "@/lib/types";

const navigation: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Season overview", icon: "overview" },
  { id: "game", label: "Game workspace", icon: "game" },
  { id: "lineups", label: "Lineups & on/off", icon: "lineups" },
  { id: "players", label: "Player analysis", icon: "players" },
  { id: "research", label: "Research notebook", icon: "research" },
];

export default function Workspace() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [view, setView] = useState<View>("game");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [gameId, setGameId] = useState("");
  const [game, setGame] = useState<GameDetail | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [comparison, setComparison] = useState<Analysis | null>(null);
  const [saved, setSaved] = useState<Investigation[]>([]);
  const [snapshot, setSnapshot] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [methods, setMethods] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Catalog>("/catalog", undefined, controller.signal)
      .then((result) => {
        setCatalog(result);
        setGameId(
          (previous) =>
            previous ||
            result.games.find((item) => item.season_type === "Regular season")
              ?.id ||
            result.games[0]?.id ||
            "",
        );
        setError("");
        if (!result.games.length) setLoading(false);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setError(reason.message);
          setLoading(false);
        }
      });
    request<Investigation[]>("/research", undefined, controller.signal)
      .then(setSaved)
      .catch(() => {});
    return () => controller.abort();
  }, [revision]);

  const selectedGame = catalog?.games.find((item) => item.id === gameId);
  const effectiveFilters =
    view === "game" && selectedGame
      ? {
          ...filters,
          season: selectedGame.season,
          season_type: selectedGame.season_type,
          game_ids: [gameId],
          last_n: null,
          date_from: null,
          date_to: null,
          opponent: null,
          venue: "all",
          rest: "all",
        }
      : filters;
  const filterKey = JSON.stringify(effectiveFilters);

  useEffect(() => {
    if (!catalog?.games.length || (view === "game" && !gameId)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const body = JSON.parse(filterKey);
      const work =
        view === "game"
          ? request<GameDetail>(
              `/games/${gameId}`,
              body,
              controller.signal,
            ).then((result) => {
              setGame(result);
              setAnalysis(result.analysis);
            })
          : request<Analysis>("/analysis", body, controller.signal).then(
              setAnalysis,
            );
      work
        .catch((reason) => {
          if (reason.name !== "AbortError") setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 130);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalog, view, gameId, filterKey, revision]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!methods && !saving && !snapshot) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMethods(false);
        setSaving(false);
        setSnapshot(null);
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [methods, saving, snapshot]);

  function navigate(next: View) {
    if (next === "game" && gameId) {
      openGame(gameId);
      return;
    }
    setView(next);
    setLoading(true);
    setComparison(null);
    setFilters((previous) => ({
      ...previous,
      game_ids: [],
      start: 0,
      end: 10000,
      period: null,
    }));
  }

  function openGame(id: string) {
    const selected = catalog?.games.find((item) => item.id === id);
    setGameId(id);
    setView("game");
    setLoading(true);
    setComparison(null);
    setFilters({
      ...defaultFilters,
      season: selected?.season ?? defaultFilters.season,
      season_type: selected?.season_type ?? defaultFilters.season_type,
      minimum_possessions: 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateFilters(next: Filters) {
    setLoading(true);
    setFilters(next);
  }

  async function exportCsv() {
    try {
      const table =
        view === "lineups"
          ? "lineups"
          : view === "overview"
            ? "games"
            : view === "players" && filters.player_id
              ? "player-log"
              : "players";
      const response = await fetch(`/api/export?table=${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effectiveFilters),
      });
      if (!response.ok) throw new Error("The export could not be created.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `lakers-${table}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Selected statistics exported.");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function rerunInvestigation(item: Investigation) {
    try {
      const pinned = item.snapshot.comparison;
      setComparison(
        pinned ? await request<Analysis>("/analysis", pinned.filters) : null,
      );
      updateFilters(item.filters);
      setView("research");
      setSnapshot(null);
      setNotice(
        "Saved filters loaded against current data, including the comparison.",
      );
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function refreshData() {
    setRefreshing(true);
    try {
      await request("/import", {
        season: effectiveFilters.season,
        season_type:
          effectiveFilters.season_type === "Preseason"
            ? 1
            : effectiveFilters.season_type === "Postseason"
              ? 3
              : 2,
      });
      setNotice(
        "Refreshing completed games. Existing analysis stays available.",
      );
      let status = "running";
      while (status === "running") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const job = await request<{ status: string; error: string | null }>(
          "/import",
        );
        status = job.status;
        if (job.error) throw new Error(job.error);
      }
      setRevision((value) => value + 1);
      setNotice("Game data refreshed.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  const imported = catalog?.imports.find(
    (item) =>
      item.season === effectiveFilters.season &&
      item.season_type_id ===
        (effectiveFilters.season_type === "Regular season"
          ? 2
          : effectiveFilters.season_type === "Preseason"
            ? 1
            : 3),
  );
  const seasonGames =
    catalog?.games.filter(
      (item) =>
        item.season === effectiveFilters.season &&
        item.season_type === effectiveFilters.season_type,
    ) ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="CourtVision home">
          <CourtMark />
          <span>
            CourtVision<small>Los Angeles Lakers</small>
          </span>
        </Link>
        <div className="team-stamp">
          <span className="team-monogram">LA</span>
          <div>
            One team.
            <br />
            <strong>Every possession.</strong>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={view === item.id ? "active" : ""}
              aria-current={view === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "research" && saved.length > 0 && (
                <b>{saved.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setMethods(true)}>
            <Icon name="data" />
            Data & methods
          </button>
          <div className="source-status">
            <i />
            <span>
              ESPN game data
              <small>
                {seasonGames.length} /{" "}
                {imported?.expected ?? seasonGames.length} games imported
              </small>
            </span>
          </div>
          <p>A personal basketball research workspace.</p>
        </div>
      </aside>
      <main className="main-workspace">
        <header className="topbar">
          <span>
            Lakers research{" "}
            <span className="breadcrumb">
              / {navigation.find((item) => item.id === view)?.label}
            </span>
          </span>
          <div>
            <span className="local-indicator">Local workspace</span>
            <button
              className="icon-button"
              title="Refresh game data"
              aria-label="Refresh game data"
              onClick={refreshData}
              disabled={refreshing || !catalog}
            >
              <Icon name="refresh" />
            </button>
            <span className="avatar">JP</span>
          </div>
        </header>
        <div className="workspace-content">
          {error && (
            <div className="error-banner" role="alert">
              <strong>{error}</strong>
              <button
                onClick={() => {
                  setRevision((value) => value + 1);
                  setError("");
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!catalog && !error && (
            <div className="initial-loading">
              <CourtMark />
              <h1>Opening the scorebook…</h1>
              <p>Loading imported Lakers games.</p>
            </div>
          )}
          {catalog && !catalog.games.length && (
            <>
              <div className="page-title">
                <h1>Your Lakers scorebook</h1>
              </div>
              <Empty text="Import a season to start exploring real games, players, and lineups." />
              <button
                className="primary-button"
                onClick={refreshData}
                disabled={refreshing}
              >
                {refreshing
                  ? "Importing games…"
                  : "Import 2025-26 Lakers games"}
              </button>
            </>
          )}
          {catalog && catalog.games.length > 0 && (
            <>
              <div className="page-title">
                <div>
                  <h1>
                    {view === "game"
                      ? "Game workspace"
                      : view === "overview"
                        ? "The season, in context."
                        : view === "lineups"
                          ? "Find what works together."
                          : view === "players"
                            ? "A closer look at every Laker."
                            : "Follow the numbers."}
                  </h1>
                  <p>
                    {view === "game"
                      ? "Explore the game. Isolate a stretch. See the evidence."
                      : view === "overview"
                        ? "Team performance, recent form, and the games behind the trends."
                        : view === "lineups"
                          ? "Compare combinations with their minutes and possessions in view."
                          : view === "players"
                            ? "Shot selection, efficiency, and production across your selected games."
                            : "Build a sample, compare it, and keep a record of what you find."}
                  </p>
                </div>
                <div className="page-actions">
                  <button
                    className="secondary-button"
                    onClick={exportCsv}
                    disabled={!analysis || loading}
                  >
                    <Icon name="export" />
                    Export
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setSaving(true)}
                    disabled={!analysis?.game_count || loading}
                  >
                    <Icon name="bookmark" />
                    Save finding
                  </button>
                </div>
              </div>
              {view === "game" ? (
                <div className="game-picker">
                  <label>
                    Choose a game
                    <select
                      value={gameId}
                      onChange={(event) => openGame(event.target.value)}
                    >
                      {catalog.games.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.local_date} · {item.home ? "vs" : "@"}{" "}
                          {item.opponent.name} · {item.result}{" "}
                          {item.lakers_score}-{item.opponent_score}
                          {item.season_type !== "Regular season"
                            ? ` (${item.season_type})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="source-caption">
                    Completed games / Los Angeles time
                  </span>
                </div>
              ) : (
                <SampleFilters
                  catalog={catalog}
                  filters={filters}
                  setFilters={updateFilters}
                />
              )}
              {view !== "game" && (
                <details className="advanced-filters">
                  <summary>
                    Date range and player combinations
                    {filters.on.length + filters.off.length > 0
                      ? ` (${filters.on.length + filters.off.length} players selected)`
                      : ""}
                  </summary>
                  <div className="date-filters">
                    <label>
                      From
                      <input
                        type="date"
                        value={filters.date_from ?? ""}
                        onChange={(event) =>
                          updateFilters({
                            ...filters,
                            date_from: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Through
                      <input
                        type="date"
                        value={filters.date_to ?? ""}
                        onChange={(event) =>
                          updateFilters({
                            ...filters,
                            date_to: event.target.value || null,
                          })
                        }
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() =>
                        updateFilters({
                          ...defaultFilters,
                          season: filters.season,
                          season_type: filters.season_type,
                        })
                      }
                    >
                      Reset filters
                    </button>
                  </div>
                  <PlayerFilters
                    catalog={catalog}
                    filters={filters}
                    setFilters={updateFilters}
                  />
                </details>
              )}
              <div aria-live="polite" className="loading-status">
                {loading
                  ? "Updating the sample…"
                  : analysis
                    ? `${analysis.game_count} ${analysis.game_count === 1 ? "game" : "games"} · ${analysis.summary.possessions} offensive possessions · ${analysis.summary.defensive_possessions} defensive possessions`
                    : ""}
              </div>
              {analysis && (
                <div
                  className={loading ? "results updating" : "results"}
                  aria-busy={loading}
                >
                  {view === "game" && game && (
                    <>
                      <div className="game-hero">
                        <div className="game-identity">
                          <span className="game-meta">
                            {new Date(game.date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "America/Los_Angeles",
                            })}{" "}
                            / {game.home ? "Home" : "Away"}
                          </span>
                          <h2>
                            Lakers <span>vs.</span>{" "}
                            {game.opponent.name.replace(
                              /^(Utah|Phoenix|Golden State|Los Angeles|Oklahoma City|New York|New Orleans|San Antonio|Portland|Toronto|Cleveland|Detroit|Washington|Brooklyn|Boston|Chicago|Atlanta|Miami|Orlando|Houston|Dallas|Denver|Minnesota|Memphis|Sacramento|Indiana|Milwaukee|Philadelphia|Charlotte) /,
                              "",
                            )}
                          </h2>
                          <span
                            className={`hero-result ${game.result === "W" ? "" : "hero-loss"}`}
                          >
                            {game.result === "W" ? "Lakers win" : "Lakers loss"}
                          </span>
                          <span className="hero-competition">
                            {game.season_label} {game.season_type.toLowerCase()}
                          </span>
                        </div>
                        <div className="scoreboard">
                          <div>
                            <span>LAL</span>
                            <strong>{game.lakers_score}</strong>
                          </div>
                          <span className="score-separator">:</span>
                          <div>
                            <span>{game.opponent.abbreviation}</span>
                            <strong>{game.opponent_score}</strong>
                          </div>
                          <small>
                            Final
                            {game.periods > 4 ? ` / ${game.periods - 4}OT` : ""}
                          </small>
                        </div>
                      </div>
                      <div className="period-toolbar">
                        <div className="segmented">
                          <button
                            className={
                              !filters.period &&
                              filters.start === 0 &&
                              filters.end >= game.duration
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              updateFilters({
                                ...filters,
                                period: null,
                                start: 0,
                                end: 10000,
                              })
                            }
                          >
                            Full game
                          </button>
                          {Array.from({ length: game.periods }, (_, index) => (
                            <button
                              key={index}
                              className={
                                filters.period === index + 1 ? "selected" : ""
                              }
                              onClick={() =>
                                updateFilters({
                                  ...filters,
                                  period: index + 1,
                                  start: 0,
                                  end: 10000,
                                })
                              }
                            >
                              {index < 4 ? `Q${index + 1}` : `OT${index - 3}`}
                            </button>
                          ))}
                        </div>
                        <SampleFilters
                          catalog={catalog}
                          filters={filters}
                          setFilters={updateFilters}
                          gameMode
                        />
                      </div>
                    </>
                  )}
                  <MetricStrip analysis={analysis} />
                  {!analysis.game_count && (
                    <Empty text="No games or possessions match this sample. Widen the filters, clear player selections, or choose another competition." />
                  )}
                  {analysis.coverage.partial_games > 0 && (
                    <div className="coverage-note">
                      <Icon name="data" />
                      <span>
                        {analysis.coverage.partial_games}{" "}
                        {analysis.coverage.partial_games === 1
                          ? "game has"
                          : "games have"}{" "}
                        source discrepancies. Full-game totals use box scores;
                        filtered results depend on event coverage.
                      </span>
                      <button onClick={() => setMethods(true)}>
                        See coverage
                      </button>
                    </div>
                  )}
                  {analysis.coverage.excluded_lineup_seconds > 0 && (
                    <p className="coverage-exclusion">
                      {number(analysis.coverage.excluded_lineup_seconds / 60)}{" "}
                      minutes of unresolved rotation are excluded from lineup
                      and on/off results across the selected games.
                    </p>
                  )}
                  {view === "game" && game && (
                    <>
                      <div className="analysis-grid">
                        <section className="panel flow-panel">
                          <PanelTitle
                            title="Where the game changed"
                            detail="Score margin"
                          />
                          <GameFlow
                            game={game}
                            start={
                              filters.period
                                ? filters.period <= 4
                                  ? (filters.period - 1) * 720
                                  : 2880 + (filters.period - 5) * 300
                                : filters.start
                            }
                            end={
                              filters.period
                                ? filters.period <= 4
                                  ? filters.period * 720
                                  : 2880 + (filters.period - 4) * 300
                                : filters.end
                            }
                            onSelect={(start, end) =>
                              updateFilters({
                                ...filters,
                                start,
                                end,
                                period: null,
                              })
                            }
                          />
                        </section>
                        <section className="panel shooting-panel">
                          <PanelTitle
                            title="The shooting picture"
                            detail="Field goal attempts"
                          />
                          <ShotChart key={game.id} game={game} />
                        </section>
                        <section className="panel rotation-panel">
                          <PanelTitle
                            title="The rotation"
                            detail="Who shared the floor"
                          />
                          <RotationChart game={game} />
                        </section>
                        <section className="panel factors-panel">
                          <PanelTitle
                            title="How the possessions added up"
                            detail="Lakers / opponent"
                          />
                          <FactorComparison analysis={analysis} />
                        </section>
                      </div>
                      <section className="panel">
                        <PanelTitle
                          title="Player production"
                          detail="Totals for this sample"
                        />
                        <PlayerTable players={analysis.players} />
                        <p className="panel-footnote">
                          Minutes use the reconstructed rotation, or published
                          minutes when the rotation is incomplete. Effective FG%
                          gives made threes extra weight. True shooting also
                          accounts for free throws.
                        </p>
                      </section>
                      <section className="panel">
                        <PanelTitle
                          title="Possession by possession"
                          detail="Outcomes and both five-player units"
                        />
                        <PossessionTable game={game} />
                      </section>
                      <section className="panel">
                        <PanelTitle
                          title="Go to the events"
                          detail={`${game.possessions.length} reconstructed possessions`}
                        />
                        <PlayTable events={game.events} />
                      </section>
                    </>
                  )}
                  {view === "overview" && (
                    <>
                      <section className="panel">
                        <PanelTitle
                          title="Performance, game by game"
                          detail="Net rating"
                        />
                        <TrendChart analysis={analysis} onGame={openGame} />
                      </section>
                      <div className="overview-grid">
                        <section className="panel">
                          <PanelTitle
                            title="The game log"
                            detail={`${analysis.game_count} games in this sample`}
                          />
                          <GameList
                            games={[...analysis.games].reverse()}
                            onGame={openGame}
                          />
                        </section>
                        <section className="panel">
                          <PanelTitle
                            title="The shape of the offense"
                            detail="Shooting zones"
                          />
                          <ZoneTable zones={analysis.zones} />
                          <div className="inset-section">
                            <h3>Possession factors</h3>
                            <FactorComparison analysis={analysis} />
                          </div>
                        </section>
                      </div>
                    </>
                  )}
                  {(view === "lineups" || view === "research") && (
                    <>
                      <section className="panel research-controls">
                        <PanelTitle
                          title="Build your comparison"
                          detail="The same filters, two samples"
                        />
                        <PlayerFilters
                          catalog={catalog}
                          filters={filters}
                          setFilters={updateFilters}
                        />
                        <div className="comparison-actions">
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setComparison(analysis);
                              setNotice(
                                "Sample pinned. Change the filters to compare it with another sample.",
                              );
                            }}
                            disabled={loading || !analysis.game_count}
                          >
                            <Icon name="compare" />
                            Pin this sample for comparison
                          </button>
                          {comparison && (
                            <button
                              className="text-button"
                              onClick={() => setComparison(null)}
                            >
                              Clear comparison
                            </button>
                          )}
                          <label>
                            Minimum offensive possessions
                            <input
                              aria-label="Minimum offensive possessions"
                              type="number"
                              min="0"
                              max="10000"
                              value={filters.minimum_possessions}
                              onChange={(event) =>
                                updateFilters({
                                  ...filters,
                                  minimum_possessions: Math.max(
                                    0,
                                    Math.min(10000, Number(event.target.value)),
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                      </section>
                      {comparison && (
                        <Comparison current={analysis} pinned={comparison} />
                      )}
                      <section className="panel">
                        <PanelTitle
                          title="Five-player combinations"
                          detail="Ordered by sample size. Click a unit to inspect it."
                        />
                        <LineupTable
                          lineups={analysis.lineups}
                          onSelect={(ids) =>
                            updateFilters({
                              ...filters,
                              on: ids,
                              off: [],
                              minimum_possessions: 0,
                            })
                          }
                        />
                        <p className="panel-footnote">
                          Possessions use the lineup at the terminal event;
                          points use the lineup when scored. Small samples
                          describe what happened, not which unit is inherently
                          better.
                        </p>
                      </section>
                    </>
                  )}
                  {view === "players" && (
                    <>
                      <section className="panel">
                        <PanelTitle
                          title="The Lakers, player by player"
                          detail="Select a player for game logs and shot locations."
                        />
                        <PlayerTable
                          players={analysis.players}
                          onPlayer={(id) =>
                            updateFilters({ ...filters, player_id: id })
                          }
                        />
                        <p className="panel-footnote">
                          Totals and percentages are recomputed from counts.
                          Team heaves are excluded from individual shooting
                          percentages.
                        </p>
                      </section>
                      {analysis.player_detail ? (
                        <PlayerAnalysis
                          detail={analysis.player_detail}
                          onGame={openGame}
                          onFloor={(on) => {
                            setView("lineups");
                            updateFilters({
                              ...filters,
                              on: on ? [analysis.player_detail!.player.id] : [],
                              off: on
                                ? []
                                : [analysis.player_detail!.player.id],
                            });
                          }}
                        />
                      ) : (
                        <Empty text="Select a player above to inspect his production, game logs, and shooting locations in this sample." />
                      )}
                    </>
                  )}
                  {view === "research" && (
                    <section className="panel">
                      <PanelTitle
                        title="Saved findings"
                        detail="Fixed snapshots with source revisions"
                      />
                      {saved.length ? (
                        <div className="notebook-list">
                          {saved.map((item) => (
                            <article key={item.id}>
                              <div className="notebook-symbol">
                                <Icon name="research" />
                              </div>
                              <div>
                                <h3>{item.title}</h3>
                                <p>{item.note || "No note added."}</p>
                                <small>
                                  {item.snapshot.game_count} games /{" "}
                                  {item.snapshot.summary.possessions} offensive
                                  possessions /{" "}
                                  {new Date(
                                    item.created_at,
                                  ).toLocaleDateString()}
                                  {item.superseded
                                    ? " / Source or method has changed"
                                    : ""}
                                </small>
                              </div>
                              <div className="notebook-actions">
                                <button
                                  className="secondary-button"
                                  onClick={() => setSnapshot(item)}
                                >
                                  Open snapshot
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => rerunInvestigation(item)}
                                >
                                  Re-run filters
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Empty text="Save a finding to keep your filters, results, and notes together. Snapshots preserve the numbers you saw." />
                      )}
                    </section>
                  )}
                </div>
              )}
              <footer className="workspace-footer">
                <span>
                  Source: ESPN / Possessions reconstructed by CourtVision
                </span>
                <button onClick={() => setMethods(true)}>
                  Definitions, coverage & source checks
                </button>
              </footer>
            </>
          )}
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {methods && (
        <Modal title="Data & methods" onClose={() => setMethods(false)}>
          <p>
            Real completed games from ESPN. Each import retains its original
            response and revision. Team possessions and rotations are
            reconstructed from events; they are not official NBA advanced
            statistics.
          </p>
          <div className="method-summary">
            <div>
              <strong>
                {seasonGames.length}/{imported?.expected ?? seasonGames.length}
              </strong>
              <span>Games imported</span>
            </div>
            <div>
              <strong>
                {
                  seasonGames.filter((item) => item.status === "validated")
                    .length
                }
              </strong>
              <span>Fully reconciled</span>
            </div>
            <div>
              <strong>
                {imported?.last_success
                  ? new Date(imported.last_success).toLocaleDateString()
                  : "—"}
              </strong>
              <span>Last import</span>
            </div>
          </div>
          <dl className="definitions">
            <dt>Offensive / defensive rating</dt>
            <dd>
              Points scored / allowed per 100 offensive / defensive possessions.
              The two denominators can differ.
            </dd>
            <dt>Net rating</dt>
            <dd>
              Offensive rating minus defensive rating. On/off differences also
              reflect opponents and teammates.
            </dd>
            <dt>Effective FG% / true shooting</dt>
            <dd>
              (FGM + 0.5 × 3PM) / FGA. True shooting = points / [2 × (FGA + 0.44
              × FTA)], a box-score approximation.
            </dd>
            <dt>Team heaves</dt>
            <dd>
              Explicitly tagged missed heaves are counted as team attempts and
              shown on the map. They do not count against the individual
              shooter. ESPN box-score shooting totals are adjusted by these
              tagged team attempts.
            </dd>
            <dt>Clutch / score margin</dt>
            <dd>
              Within five points in the last five minutes of the fourth quarter
              or overtime. Score margin is evaluated at possession start where
              available.
            </dd>
            <dt>Lineup coverage</dt>
            <dd>
              Unresolved periods are omitted from lineup and on/off comparisons.
              Minutes are checked against ESPN’s rounded box-score minutes with
              a one-minute tolerance.
            </dd>
            <dt>Source discrepancies</dt>
            <dd>
              Full-game counts use published box scores. Event-filtered analysis
              uses the play-by-play and retains any identified differences. Team
              heaves and reconstructed possession definitions may differ from
              another statistics site.
            </dd>
          </dl>
          {view === "game" && game && (
            <>
              <h3>Selected game checks</h3>
              <p>
                {game.validation.lineup_coverage}% lineup coverage /{" "}
                {game.validation.shot_coverage}% shot-coordinate coverage.{" "}
                <a href={game.source_url} target="_blank" rel="noreferrer">
                  Open ESPN game
                </a>
              </p>
              {game.validation.issues.length > 0 && (
                <ul className="issue-list">
                  {game.validation.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              )}
              <details>
                <summary>
                  {
                    game.validation.checks.filter((check) => check.passed)
                      .length
                  }{" "}
                  of {game.validation.checks.length} score and team-total checks
                  passed
                </summary>
                <ul className="check-list">
                  {game.validation.checks.map((check) => (
                    <li key={check.name}>
                      <span>
                        {check.passed ? "✓" : "!"} {check.name}
                      </span>
                      <span>
                        {check.actual} / {check.expected}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          <p className="muted">
            Saved findings keep the source revisions and calculation version.
            This app runs locally and uses no AI to invent statistics.
          </p>
        </Modal>
      )}
      {saving && analysis && (
        <SaveModal
          analysis={analysis}
          filters={effectiveFilters}
          comparison={comparison}
          onClose={() => setSaving(false)}
          onSaved={(item) => {
            setSaved((previous) => [item, ...previous]);
            setSaving(false);
            setNotice("Finding saved to your research notebook.");
          }}
        />
      )}
      {snapshot && (
        <Modal title={snapshot.title} onClose={() => setSnapshot(null)}>
          <p>{snapshot.note || "Saved statistical sample."}</p>
          <p className="muted">
            Fixed snapshot from {new Date(snapshot.created_at).toLocaleString()}
            .{" "}
            {snapshot.superseded
              ? "Newer source data or calculation methods are available; this snapshot keeps the original results."
              : "Source revisions still match."}
          </p>
          <MetricStrip analysis={snapshot.snapshot} />
          <PlayerTable players={snapshot.snapshot.players} />
          {snapshot.snapshot.comparison && (
            <Comparison
              current={snapshot.snapshot}
              pinned={snapshot.snapshot.comparison}
            />
          )}
          <button
            className="primary-button"
            onClick={() => rerunInvestigation(snapshot)}
          >
            Re-run these filters
          </button>
        </Modal>
      )}
    </div>
  );
}

function MetricStrip({ analysis }: { analysis: Analysis }) {
  const stats = analysis.summary;
  return (
    <div className="metric-strip">
      <Metric
        label="Offensive rating"
        value={number(stats.off_rating)}
        note={`${stats.points} points / ${stats.possessions} possessions`}
      />
      <Metric
        label="Defensive rating"
        value={number(stats.def_rating)}
        note={`${analysis.opponent_summary.points} allowed / ${stats.defensive_possessions} possessions`}
      />
      <Metric
        label="Net rating"
        value={signed(stats.net_rating)}
        note="Per 100 possessions"
        positive={(stats.net_rating ?? 0) >= 0}
      />
      <Metric
        label="Effective FG%"
        value={stats.efg === null ? "—" : `${number(stats.efg)}%`}
        note={`${stats.fgm}/${stats.fga} FG · ${stats.three_made} made threes`}
      />
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong
        className={
          positive === undefined ? "" : positive ? "positive" : "negative"
        }
      >
        {value}
      </strong>
      <small>{note}</small>
    </div>
  );
}
function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>
      <span>{detail}</span>
    </div>
  );
}
function FactorComparison({ analysis }: { analysis: Analysis }) {
  const rows: [keyof Analysis["summary"], string][] = [
    ["efg", "Effective FG%"],
    ["turnover_rate", "Turnovers / 100"],
    ["oreb_pct", "Offensive rebound %"],
    ["ft_rate", "FTA / 100 FGA"],
  ];
  return (
    <div className="factor-list">
      {rows.map(([key, label]) => (
        <div key={key}>
          <span>{label}</span>
          <strong>{number(analysis.summary[key])}</strong>
          <span className="factor-opponent">
            {number(analysis.opponent_summary[key])}
          </span>
        </div>
      ))}
    </div>
  );
}
function Comparison({
  current,
  pinned,
}: {
  current: Analysis;
  pinned: Analysis;
}) {
  return (
    <section className="panel">
      <PanelTitle
        title="Two samples, side by side"
        detail="Descriptive comparisons; not adjusted player impact"
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Measure</th>
              <th>Current sample</th>
              <th>Pinned sample</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["game_count", "Games"],
                ["minutes", "Minutes"],
                ["defensive_possessions", "Defensive possessions"],
                ["possessions", "Offensive possessions"],
                ["off_rating", "Offensive rating"],
                ["def_rating", "Defensive rating"],
                ["net_rating", "Net rating"],
                ["efg", "Effective FG%"],
                ["turnover_rate", "Turnovers / 100"],
              ] as const
            ).map(([key, label]) => {
              const a =
                  key === "game_count" || key === "minutes"
                    ? current[key]
                    : current.summary[key],
                b =
                  key === "game_count" || key === "minutes"
                    ? pinned[key]
                    : pinned.summary[key];
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{number(a)}</td>
                  <td>{number(b)}</td>
                  <td>{a !== null && b !== null ? signed(a - b) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        <strong>Current:</strong> {describeSample(current, pinned)}
        <br />
        <strong>Pinned:</strong> {describeSample(pinned, current)}
      </p>
    </section>
  );
}
function describeSample(sample: Analysis, other: Analysis) {
  const filters = sample.filters;
  const players = [...sample.players, ...other.players];
  const names = (ids: string[]) =>
    ids
      .map((id) => players.find((player) => player.id === id)?.name ?? id)
      .join(", ");
  return [
    `${filters.season - 1}-${String(filters.season).slice(-2)} ${filters.season_type.toLowerCase()}`,
    filters.last_n
      ? `last ${filters.last_n} matching games`
      : `${sample.game_count} games`,
    filters.on.length ? `on: ${names(filters.on)}` : "",
    filters.off.length ? `off: ${names(filters.off)}` : "",
    filters.date_from ? `from ${filters.date_from}` : "",
    filters.date_to ? `through ${filters.date_to}` : "",
    filters.venue !== "all" ? filters.venue : "",
    filters.clutch ? "clutch only" : "",
    filters.max_margin !== null ? `within ${filters.max_margin} points` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.current?.querySelector<HTMLElement>(
      "button, input, select, textarea, a[href]",
    );
    first?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
        ) ?? [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function SaveModal({
  analysis,
  filters,
  comparison,
  onClose,
  onSaved,
}: {
  analysis: Analysis;
  filters: Filters;
  comparison: Analysis | null;
  onClose: () => void;
  onSaved: (item: Investigation) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      onSaved(
        await request<Investigation>("/research", {
          title,
          note,
          filters,
          comparison_filters: comparison?.filters ?? null,
          expected_revisions: analysis.revisions,
          comparison_revisions: comparison?.revisions ?? null,
          expected_method: analysis.method_version,
        }),
      );
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Save a finding" onClose={onClose}>
      <p>
        Keep a fixed snapshot of these results, filters, and supporting games.
      </p>
      <form onSubmit={save}>
        <label>
          Finding title
          <input
            required
            maxLength={200}
            placeholder="What are you investigating?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Your notes
          <textarea
            rows={4}
            maxLength={10000}
            placeholder="What stands out? What would you check next?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="negative">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy || !title.trim()}>
            {busy ? "Saving…" : "Save finding"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CourtMark() {
  return (
    <svg className="court-mark" viewBox="0 0 36 36" aria-hidden="true">
      <rect
        x="2"
        y="5"
        width="32"
        height="26"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M18 5v26M2 11h6v14H2m32-14h-6v14h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="18"
        cy="18"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M3 10h7V3H3zm11 11h7V10h-7zM3 21h7v-7H3zm11-15h7V3h-7z",
    game: "M3 4h18v16H3zm9 0v16M3 9h4v6H3m18-6h-4v6h4",
    lineups: "M3 18l5-7 5 4 8-11M3 5v15h19",
    players:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4M13 4a4 4 0 1 1 0 7M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    research: "M5 3h14v18H5zm4 5h6m-6 4h6m-6 4h4",
    bookmark: "M6 3h12v18l-6-4-6 4z",
    export: "M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6",
    compare: "M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4",
    refresh:
      "M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3",
    data: "M12 3 2 8l10 5 10-5zm-10 9 10 5 10-5M2 16l10 5 10-5",
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.game} />
    </svg>
  );
}
