"use client";

import { useState } from "react";
import { elapsedLabel, number, shortDate, signed } from "@/lib/api";
import type {
  Game,
  GameDetail,
  Lineup,
  PlayerResult,
  Play,
  Zone,
} from "@/lib/types";

export function PlayerTable({
  players,
  onPlayer,
}: {
  players: PlayerResult[];
  onPlayer?: (id: string) => void;
}) {
  const [sort, setSort] = useState<keyof PlayerResult>("points");
  const [ascending, setAscending] = useState(false);
  const columns: [keyof PlayerResult, string][] = [
    ["games", "GP"],
    ["minutes", "MIN"],
    ["points", "PTS"],
    ["ppg", "PTS/G"],
    ["rebounds", "REB"],
    ["assists", "AST"],
    ["turnovers", "TO"],
    ["efg", "eFG%"],
    ["ts", "TS%"],
  ];
  const sorted = [...players].sort(
    (a, b) =>
      (Number(a[sort] ?? -1) - Number(b[sort] ?? -1)) * (ascending ? 1 : -1),
  );
  if (!players.length)
    return (
      <Empty text="No player minutes match these filters. Widen the sample or clear the on/off selection." />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            {columns.map(([key, label]) => (
              <th
                key={key}
                aria-sort={
                  sort === key
                    ? ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  onClick={() => {
                    setSort(key);
                    setAscending(sort === key ? !ascending : false);
                  }}
                >
                  {label}
                  {sort === key ? (ascending ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
            <th>FG</th>
            <th>3PT</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.id}>
              <td>
                {onPlayer ? (
                  <button
                    className="player-link"
                    onClick={() => onPlayer(player.id)}
                  >
                    {player.name}
                    <small>
                      #{player.jersey} / {player.position}
                    </small>
                  </button>
                ) : (
                  <span className="player-name">
                    {player.name}
                    <small>
                      #{player.jersey} / {player.position}
                    </small>
                  </span>
                )}
              </td>
              {columns.map(([key]) => (
                <td key={key} className={key === "points" ? "strong" : ""}>
                  {number(
                    player[key] == null ? null : Number(player[key]),
                    ["minutes", "ppg", "efg", "ts"].includes(key) ? 1 : 0,
                  )}
                </td>
              ))}
              <td>
                {player.fgm}-{player.fga}
              </td>
              <td>
                {player.three_made}-{player.three_attempts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LineupTable({
  lineups,
  onSelect,
}: {
  lineups: Lineup[];
  onSelect: (ids: string[]) => void;
}) {
  const [sort, setSort] = useState<"possessions" | "net_rating" | "minutes">(
    "possessions",
  );
  const sorted = [...lineups].sort(
    (a, b) => (b[sort] ?? -1000) - (a[sort] ?? -1000),
  );
  if (!lineups.length)
    return (
      <Empty text="No five-player units meet the sample minimum. Lower the possession minimum or widen your filters." />
    );
  return (
    <div className="table-scroll">
      <table className="lineup-table">
        <thead>
          <tr>
            <th>Five-player unit</th>
            <th>GP</th>
            <th>
              <button onClick={() => setSort("minutes")}>
                MIN {sort === "minutes" ? "↓" : ""}
              </button>
            </th>
            <th>
              <button onClick={() => setSort("possessions")}>
                OFF POSS {sort === "possessions" ? "↓" : ""}
              </button>
            </th>
            <th>DEF POSS</th>
            <th>OFF RTG</th>
            <th>DEF RTG</th>
            <th>
              <button onClick={() => setSort("net_rating")}>
                NET {sort === "net_rating" ? "↓" : ""}
              </button>
            </th>
            <th>+/−</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((unit) => (
            <tr key={unit.player_ids.join("-")}>
              <td>
                <button
                  className="lineup-names"
                  onClick={() => onSelect(unit.player_ids)}
                >
                  {unit.players.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </button>
              </td>
              <td>{unit.games}</td>
              <td>{number(unit.minutes)}</td>
              <td className="strong">{unit.possessions}</td>
              <td>{unit.defensive_possessions}</td>
              <td>{number(unit.off_rating)}</td>
              <td>{number(unit.def_rating)}</td>
              <td
                className={
                  (unit.net_rating ?? 0) >= 0
                    ? "positive strong"
                    : "negative strong"
                }
              >
                {signed(unit.net_rating)}
              </td>
              <td>
                {unit.plus_minus > 0 ? "+" : ""}
                {unit.plus_minus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GameList({
  games,
  onGame,
  limit = 12,
}: {
  games: Game[];
  onGame: (id: string) => void;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  return (
    <>
      <div className="game-list">
        {games.slice(0, showAll ? undefined : limit).map((game) => (
          <button key={game.id} onClick={() => onGame(game.id)}>
            <span className="game-date">{shortDate(game.local_date)}</span>
            <span className="opponent-code">
              {game.home ? "vs" : "@"}{" "}
              <strong>{game.opponent.abbreviation}</strong>
            </span>
            <span className={`result ${game.result === "W" ? "win" : "loss"}`}>
              {game.result}
            </span>
            <strong className="game-list-score">
              {game.lakers_score}
              <span> : </span>
              {game.opponent_score}
            </strong>
            <span className="game-status">
              {game.status === "partial"
                ? "Check source"
                : game.periods > 4
                  ? `${game.periods - 4}OT`
                  : "Final"}
            </span>
          </button>
        ))}
      </div>
      {games.length > limit && (
        <button
          className="text-button show-games"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show recent games" : `Show all ${games.length} games`}
        </button>
      )}
    </>
  );
}

export function PlayTable({ events }: { events: Play[] }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(40);
  const filtered = events.filter((event) =>
    event.description.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="play-search">
        <input
          aria-label="Search game events"
          placeholder="Search events, players, or outcomes…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(40);
          }}
        />
        <span>{filtered.length} events</span>
      </div>
      <div className="table-scroll">
        <table className="play-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Clock</th>
              <th>Event</th>
              <th>LAL</th>
              <th>OPP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((event) => (
              <tr
                key={event.id}
                className={
                  event.points && event.team_id === "13" ? "lakers-scoring" : ""
                }
              >
                <td>
                  {event.period <= 4
                    ? `Q${event.period}`
                    : `OT${event.period - 4}`}
                </td>
                <td>{event.clock}</td>
                <td>
                  {event.description}
                  {event.heave && (
                    <small className="heave-label">
                      Team attempt; excluded from individual shooting
                    </small>
                  )}
                </td>
                <td>{event.lakers_score}</td>
                <td>{event.opponent_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button
          className="text-button show-games"
          onClick={() => setLimit(limit + 80)}
        >
          Load more events
        </button>
      )}
    </>
  );
}

export function ZoneTable({ zones }: { zones: Zone[] }) {
  return (
    <div className="zone-list">
      {zones.map((zone) => (
        <div className="zone-row" key={zone.zone}>
          <span>{zone.zone}</span>
          <div className="zone-track">
            <span style={{ width: `${zone.fg_pct}%` }} />
          </div>
          <strong>{number(zone.fg_pct)}%</strong>
          <small>
            {zone.made}/{zone.attempts}
          </small>
        </div>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-court">◎</span>
      <p>{text}</p>
    </div>
  );
}

export function PossessionTable({ game }: { game: GameDetail }) {
  const [expanded, setExpanded] = useState(false);
  const names = Object.fromEntries(
    game.roster.map((player) => [player.id, player.short_name]),
  );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Period / elapsed time</th>
              <th>Offense</th>
              <th>PTS</th>
              <th>Outcome</th>
              <th>Lakers on court</th>
              <th>Opponent on court</th>
            </tr>
          </thead>
          <tbody>
            {game.possessions
              .slice(0, expanded ? undefined : 20)
              .map((possession) => (
                <tr key={possession.id}>
                  <td>
                    {possession.period <= 4
                      ? `Q${possession.period}`
                      : `OT${possession.period - 4}`}{" "}
                    · {elapsedLabel(possession.start)} to{" "}
                    {elapsedLabel(possession.end)}
                  </td>
                  <td>{game.teams[possession.team_id]?.abbreviation}</td>
                  <td className="strong">{possession.points}</td>
                  <td>{possession.outcome}</td>
                  <td>
                    {possession.lineups["13"]
                      ?.map((id) => names[id])
                      .join(" · ") || "Unresolved"}
                  </td>
                  <td>
                    {possession.lineups[game.opponent.id]
                      ?.map((id) => names[id])
                      .join(" · ") || "Unresolved"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {game.possessions.length > 20 && (
        <button
          className="text-button show-games"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Show first 20 possessions"
            : `Show all ${game.possessions.length} possessions`}
        </button>
      )}
      <p className="panel-footnote">
        Lineups at the terminal event. Technical and other retained-possession
        free throws stay in the event log and score totals; they do not create a
        new possession.
      </p>
    </>
  );
}
