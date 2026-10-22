"use client";

import { useId, useState } from "react";
import { elapsedLabel, number, shortDate, signed } from "@/lib/api";
import type { GameDetail, Analysis, TimelinePoint, Play } from "@/lib/types";

export function GameFlow({
  game,
  start,
  end,
  onSelect,
}: {
  game: GameDetail;
  start: number;
  end: number;
  onSelect: (start: number, end: number) => void;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<TimelinePoint | null>(null);
  const width = 720,
    height = 210,
    padding = 30;
  const scale =
    Math.max(10, ...game.timeline.map((point) => Math.abs(point.margin))) + 4;
  const x = (time: number) =>
    padding + (time / game.duration) * (width - padding * 2);
  const y = (margin: number) =>
    height / 2 - (margin / scale) * (height / 2 - 20);
  const line =
    `M${x(0)},${y(0)} ` +
    game.timeline
      .map((point) => `L${x(point.elapsed)},${y(point.margin)}`)
      .join(" ");
  const area = `${line} L${x(game.duration)},${y(0)} Z`;
  const labels = Array.from({ length: game.periods }, (_, index) =>
    index < 4 ? (index + 1) * 720 : 2880 + (index - 3) * 300,
  );
  return (
    <div className="game-flow">
      <div className="chart-legend">
        <span>
          <i className="dot purple" /> Lakers lead
        </span>
        <span>
          <i className="dot gold" /> {game.opponent.abbreviation} lead
        </span>
        <span>Click a point to inspect its 2-minute stretch</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        role="img"
        aria-label="Lakers score margin across the game. Quarter and time controls below provide keyboard access."
      >
        <defs>
          <clipPath id={`${id}-positive`}>
            <rect width={width} height={height / 2} />
          </clipPath>
          <clipPath id={`${id}-negative`}>
            <rect y={height / 2} width={width} height={height} />
          </clipPath>
        </defs>
        {[-20, -10, 0, 10, 20]
          .filter((v) => Math.abs(v) < scale)
          .map((value) => (
            <g key={value}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y(value)}
                y2={y(value)}
                stroke={value === 0 ? "#afa6bc" : "#eeeaf3"}
                strokeDasharray={value === 0 ? undefined : "3 5"}
              />
              <text
                x={padding - 8}
                y={y(value) + 4}
                textAnchor="end"
                className="axis-label"
              >
                {value > 0 ? `+${value}` : value}
              </text>
            </g>
          ))}
        {labels.map((time, index) => (
          <g key={time}>
            <line
              x1={x(time)}
              x2={x(time)}
              y1={12}
              y2={height}
              stroke="#e5e0ec"
            />
            <text
              x={x(time - (index < 4 ? 360 : 150))}
              y={height + 20}
              textAnchor="middle"
              className="axis-label"
            >
              {index < 4 ? `Q${index + 1}` : `OT${index - 3}`}
            </text>
          </g>
        ))}
        <path
          d={area}
          fill="#552583"
          opacity=".12"
          clipPath={`url(#${id}-positive)`}
        />
        <path
          d={area}
          fill="#fdb927"
          opacity=".24"
          clipPath={`url(#${id}-negative)`}
        />
        {(start > 0 || end < game.duration) && (
          <rect
            x={x(start)}
            y={10}
            width={Math.max(0, x(Math.min(game.duration, end)) - x(start))}
            height={height - 10}
            fill="#fdb927"
            opacity=".14"
          />
        )}
        <path
          d={line}
          fill="none"
          stroke="#552583"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {game.timeline.map((point) => (
          <circle
            key={point.id}
            cx={x(point.elapsed)}
            cy={y(point.margin)}
            r="7"
            fill="transparent"
            onMouseEnter={() => setHover(point)}
            onClick={() =>
              onSelect(
                Math.max(0, point.elapsed - 60),
                Math.min(game.duration, point.elapsed + 60),
              )
            }
          >
            <title>{`Q${point.period} ${point.clock}: ${point.description}`}</title>
          </circle>
        ))}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={x(hover.elapsed)}
              x2={x(hover.elapsed)}
              y1={10}
              y2={height}
              stroke="#552583"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover.elapsed)}
              cy={y(hover.margin)}
              r="4"
              fill="#552583"
              stroke="white"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      <p className="chart-caption">
        {hover
          ? `Q${hover.period} ${hover.clock} · LAL ${hover.lakers_score}, ${game.opponent.abbreviation} ${hover.opponent_score} · ${hover.description}`
          : "Hover over the line to inspect the score and scoring play."}
      </p>
      <div className="range-controls">
        <label>
          From <strong>{elapsedLabel(start)}</strong>
          <input
            aria-label="Start of game stretch"
            type="range"
            min={0}
            max={game.duration - 1}
            step={1}
            value={start}
            onChange={(event) =>
              onSelect(Math.min(Number(event.target.value), end - 1), end)
            }
          />
        </label>
        <label>
          To <strong>{elapsedLabel(Math.min(end, game.duration))}</strong>
          <input
            aria-label="End of game stretch"
            type="range"
            min={1}
            max={game.duration}
            step={1}
            value={Math.min(end, game.duration)}
            onChange={(event) =>
              onSelect(start, Math.max(start + 1, Number(event.target.value)))
            }
          />
        </label>
      </div>
    </div>
  );
}

export function ShotChart({ game }: { game: GameDetail }) {
  const [side, setSide] = useState("13");
  const [shooter, setShooter] = useState("");
  const shots = game.events.filter(
    (event) =>
      event.field_goal &&
      event.team_id === side &&
      (!shooter || event.player_id === shooter),
  );
  return (
    <div>
      <div className="shot-controls">
        <div className="segmented">
          <button
            className={side === "13" ? "selected" : ""}
            onClick={() => {
              setSide("13");
              setShooter("");
            }}
          >
            Lakers
          </button>
          <button
            className={side !== "13" ? "selected" : ""}
            onClick={() => {
              setSide(game.opponent.id);
              setShooter("");
            }}
          >
            {game.opponent.abbreviation}
          </button>
        </div>
        <select
          aria-label="Shot chart player"
          value={shooter}
          onChange={(event) => setShooter(event.target.value)}
        >
          <option value="">All shooters</option>
          {game.roster
            .filter((player) => player.team_id === side && !player.did_not_play)
            .map((player) => (
              <option key={player.id} value={player.id}>
                {player.short_name}
              </option>
            ))}
        </select>
      </div>
      <ShotPlot shots={shots} lakers={side === "13"} includeHeaves />
    </div>
  );
}

export function ShotPlot({
  shots,
  lakers = true,
  includeHeaves = false,
}: {
  shots: Play[];
  lakers?: boolean;
  includeHeaves?: boolean;
}) {
  const located = shots.filter(
    (shot) =>
      shot.x !== null && shot.y !== null && shot.y >= -5.25 && shot.y <= 44.75,
  );
  const made = shots.filter((shot) => shot.made).length;
  return (
    <div>
      <svg
        viewBox="-2 -2 54 55"
        className="court"
        role="img"
        aria-label={`${made} of ${shots.length} field goals. ${located.length} shots plotted on the half court.`}
      >
        <rect
          x="0"
          y="0"
          width="50"
          height="50"
          rx=".5"
          fill="#faf9fd"
          stroke="#c5bccf"
          strokeWidth=".18"
        />
        <g fill="none" stroke="#b8aec4" strokeWidth=".18">
          <path d="M17 0 V19 H33 V0 M19 0 V19 H31 V0" />
          <circle cx="25" cy="19" r="6" />
          <path d="M3 0 V14 A23.75 23.75 0 0 0 47 14 V0" />
          <path d="M21 5.25 A4 4 0 0 0 29 5.25" />
          <path d="M19 50 A6 6 0 0 1 31 50" />
          <path d="M22 4 H28" strokeWidth=".35" />
          <circle
            cx="25"
            cy="5.25"
            r=".75"
            stroke="#552583"
            strokeWidth=".25"
          />
        </g>
        {located.map((shot) =>
          shot.made ? (
            <circle
              key={shot.id}
              cx={shot.x!}
              cy={shot.y! + 5.25}
              r=".53"
              fill={lakers ? "#552583" : "#ad7310"}
              opacity=".8"
            >
              <title>{`Q${shot.period} ${shot.clock}: ${shot.description}`}</title>
            </circle>
          ) : (
            <path
              key={shot.id}
              d={`M${shot.x! - 0.4} ${shot.y! + 4.85}l.8 .8m-.8 0l.8 -.8`}
              stroke="#aaa2b6"
              strokeWidth=".22"
            >
              <title>{`Q${shot.period} ${shot.clock}: ${shot.description}`}</title>
            </path>
          ),
        )}
      </svg>
      <div className="shot-footer">
        <strong>
          {made}
          <span> / {shots.length}</span>
        </strong>
        <span>
          {number(shots.length ? (made / shots.length) * 100 : null)}% FG
          <br />
          <small>● Made &nbsp; × Missed</small>
        </span>
      </div>
      <p className="chart-caption">
        {shots.length - located.length
          ? `${shots.length - located.length} full-court or unlocated attempts are outside this map. `
          : ""}
        Shot locations from ESPN.{" "}
        {includeHeaves
          ? "Includes team heaves."
          : "Individual attempts exclude team heaves."}
      </p>
    </div>
  );
}

export function RotationChart({ game }: { game: GameDetail }) {
  const players = game.roster.filter(
    (player) => player.team_id === "13" && !player.did_not_play,
  );
  return (
    <div className="rotation-chart">
      <div className="rotation-axis">
        <span>Player</span>
        <div>
          {Array.from({ length: game.periods }, (_, index) => (
            <span key={index}>
              {index < 4 ? `Q${index + 1}` : `OT${index - 3}`}
            </span>
          ))}
        </div>
      </div>
      {players.map((player) => (
        <div className="rotation-row" key={player.id}>
          <span title={player.name}>{player.short_name}</span>
          <div className="rotation-track">
            {game.stints
              .filter((stint) => stint.lineups["13"]?.includes(player.id))
              .map((stint, index) => (
                <span
                  key={index}
                  className="rotation-stint"
                  style={{
                    left: `${(stint.start / game.duration) * 100}%`,
                    width: `${((stint.end - stint.start) / game.duration) * 100}%`,
                  }}
                  title={`${player.name}: ${elapsedLabel(stint.start)} to ${elapsedLabel(stint.end)}`}
                />
              ))}
          </div>
        </div>
      ))}
      <p className="chart-caption">
        Elapsed game time. Blank intervals may be off-court minutes or
        unresolved lineups; coverage is{" "}
        {number(game.validation.lineup_coverage, 0)}%.
      </p>
    </div>
  );
}

export function TrendChart({
  analysis,
  onGame,
}: {
  analysis: Analysis;
  onGame: (id: string) => void;
}) {
  const games = analysis.trends;
  const scale = Math.max(
    20,
    ...games.map((game) => Math.abs(game.net_rating ?? 0)),
  );
  const width = 800,
    height = 190,
    barWidth = Math.min(24, 730 / Math.max(games.length, 1) - 2);
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height + 25}`}
        role="img"
        aria-label="Net rating by game, above zero for a positive differential."
      >
        <line x1="35" x2="785" y1="95" y2="95" stroke="#b8aec4" />
        <text x="26" y="99" className="axis-label">
          0
        </text>
        {games.map((game, index) => {
          const value = game.net_rating ?? 0,
            x = 40 + ((index + 0.5) * 730) / Math.max(games.length, 1),
            barHeight = (Math.abs(value) / scale) * 80;
          return (
            <g
              key={game.id}
              onClick={() => onGame(game.id)}
              className="trend-bar"
            >
              <rect
                x={x - barWidth / 2}
                y={value >= 0 ? 95 - barHeight : 95}
                width={Math.max(2, barWidth)}
                height={Math.max(1, barHeight)}
                rx="1.5"
                fill={value >= 0 ? "#552583" : "#f0be54"}
              >
                <title>{`${shortDate(game.local_date)} ${game.opponent.abbreviation}: ${signed(value)} net rating (${game.possessions} offensive possessions)`}</title>
              </rect>
              {(index === 0 ||
                index === games.length - 1 ||
                games.length <= 12) && (
                <text x={x} y="207" textAnchor="middle" className="axis-label">
                  {games.length <= 12
                    ? game.opponent.abbreviation
                    : shortDate(game.local_date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="chart-caption">
        Points scored minus points allowed per 100 possessions. Each bar opens a
        game; the game list provides keyboard access.
      </p>
    </div>
  );
}
