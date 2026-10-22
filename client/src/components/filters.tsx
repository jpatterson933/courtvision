"use client";

import type { Catalog, Filters } from "@/lib/types";

export function SampleFilters({
  catalog,
  filters,
  setFilters,
  gameMode = false,
}: {
  catalog: Catalog;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  gameMode?: boolean;
}) {
  const patch = (change: Partial<Filters>) =>
    setFilters({ ...filters, ...change });
  const opponents = [
    ...new Map(
      catalog.games
        .filter((game) => game.season === filters.season)
        .map((game) => [game.opponent.id, game.opponent]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="sample-filters">
      {!gameMode && (
        <>
          <label>
            Season
            <select
              value={filters.season}
              onChange={(event) => {
                const season = Number(event.target.value);
                const types = catalog.games
                  .filter((game) => game.season === season)
                  .map((game) => game.season_type);
                const seasonType = types.includes(filters.season_type)
                  ? filters.season_type
                  : types.includes("Regular season")
                    ? "Regular season"
                    : types[0];
                patch({
                  season,
                  season_type: seasonType,
                  game_ids: [],
                  opponent: null,
                  date_from: null,
                  date_to: null,
                });
              }}
            >
              {catalog.seasons.map((season) => (
                <option key={season.value} value={season.value}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Competition
            <select
              value={filters.season_type}
              onChange={(event) =>
                patch({ season_type: event.target.value, game_ids: [] })
              }
            >
              {[
                ...new Set(
                  catalog.games
                    .filter((game) => game.season === filters.season)
                    .map((game) => game.season_type),
                ),
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Games
            <select
              value={filters.last_n ?? ""}
              onChange={(event) =>
                patch({
                  last_n: event.target.value
                    ? Number(event.target.value)
                    : null,
                  game_ids: [],
                })
              }
            >
              <option value="">Full sample</option>
              <option value="5">Last 5</option>
              <option value="10">Last 10</option>
              <option value="20">Last 20</option>
            </select>
          </label>
          <label>
            Opponent
            <select
              value={filters.opponent ?? ""}
              onChange={(event) =>
                patch({ opponent: event.target.value || null })
              }
            >
              <option value="">All opponents</option>
              {opponents.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <select
              value={filters.venue}
              onChange={(event) => patch({ venue: event.target.value })}
            >
              <option value="all">Home + away</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </label>
          <label>
            Rest
            <select
              value={filters.rest}
              onChange={(event) => patch({ rest: event.target.value })}
            >
              <option value="all">Any rest</option>
              <option value="b2b">Back-to-back</option>
              <option value="rested">1+ days off</option>
            </select>
          </label>
        </>
      )}
      <label>
        Score margin
        <select
          value={filters.max_margin ?? ""}
          onChange={(event) =>
            patch({
              max_margin: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
        >
          <option value="">All minutes</option>
          <option value="5">Within 5</option>
          <option value="10">Within 10</option>
          <option value="20">Within 20</option>
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={filters.clutch}
          onChange={(event) => patch({ clutch: event.target.checked })}
        />
        Clutch only
      </label>
    </div>
  );
}

export function PlayerFilters({
  catalog,
  filters,
  setFilters,
}: {
  catalog: Catalog;
  filters: Filters;
  setFilters: (filters: Filters) => void;
}) {
  const [on, off] = [new Set(filters.on), new Set(filters.off)];
  const add = (id: string, side: "on" | "off") => {
    if (!id) return;
    setFilters({
      ...filters,
      [side]: [...new Set([...filters[side], id])],
      [side === "on" ? "off" : "on"]: filters[
        side === "on" ? "off" : "on"
      ].filter((player) => player !== id),
    });
  };
  return (
    <div className="player-filters">
      <div>
        <label>
          On the floor
          <select
            aria-label="Add player on the floor"
            value=""
            disabled={filters.on.length >= 5}
            onChange={(event) => add(event.target.value, "on")}
          >
            <option value="">Add player…</option>
            {catalog.players
              .filter((player) => !on.has(player.id))
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>
        <div className="chips">
          {filters.on.map((id) => (
            <button
              key={id}
              onClick={() =>
                setFilters({
                  ...filters,
                  on: filters.on.filter((player) => player !== id),
                })
              }
              aria-label={`Remove ${catalog.players.find((player) => player.id === id)?.name} from on-court filter`}
            >
              {catalog.players.find((player) => player.id === id)?.short_name}
              <span>×</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label>
          Off the floor
          <select
            aria-label="Add player off the floor"
            value=""
            onChange={(event) => add(event.target.value, "off")}
          >
            <option value="">Add player…</option>
            {catalog.players
              .filter((player) => !off.has(player.id))
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>
        <div className="chips off-chips">
          {filters.off.map((id) => (
            <button
              key={id}
              onClick={() =>
                setFilters({
                  ...filters,
                  off: filters.off.filter((player) => player !== id),
                })
              }
              aria-label={`Remove ${catalog.players.find((player) => player.id === id)?.name} from off-court filter`}
            >
              {catalog.players.find((player) => player.id === id)?.short_name}
              <span>×</span>
            </button>
          ))}
        </div>
      </div>
      <p>
        Results describe these minutes. Teammates, opponents, and rotation
        choices also affect the outcome.
      </p>
    </div>
  );
}
