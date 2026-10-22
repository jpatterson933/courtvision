"use client";

import { number, shortDate } from "@/lib/api";
import type { PlayerDetail } from "@/lib/types";
import { ShotPlot } from "./charts";
import { ZoneTable } from "./tables";

export function PlayerAnalysis({
  detail,
  onGame,
  onFloor,
}: {
  detail: PlayerDetail;
  onGame: (id: string) => void;
  onFloor: (on: boolean) => void;
}) {
  const player = detail.player;
  return (
    <div className="player-detail">
      <section className="player-profile">
        <div>
          <span className="eyebrow">
            #{player.jersey} / {player.position} / {player.games} games
          </span>
          <h2>{player.name}</h2>
          <p>
            {number(player.minutes)} minutes · {player.fga} field goal attempts
          </p>
        </div>
        <div className="player-profile-stats">
          <div>
            <strong>{number(player.ppg)}</strong>
            <span>Points / game</span>
          </div>
          <div>
            <strong>{number(player.ts)}%</strong>
            <span>True shooting</span>
          </div>
          <div>
            <strong>{number(player.assists / player.games)}</strong>
            <span>Assists / game</span>
          </div>
        </div>
        <div className="page-actions">
          <button className="secondary-button" onClick={() => onFloor(true)}>
            Team with him on
          </button>
          <button className="secondary-button" onClick={() => onFloor(false)}>
            Team with him off
          </button>
        </div>
      </section>
      <div className="overview-grid player-shooting">
        <section className="panel">
          <div className="panel-title">
            <h3>{player.short_name}: shooting map</h3>
            <span>Selected sample</span>
          </div>
          <ShotPlot shots={detail.shots} />
        </section>
        <section className="panel">
          <div className="panel-title">
            <h3>Where the shots come from</h3>
            <span>Individual attempts</span>
          </div>
          <ZoneTable zones={detail.zones} />
          <p className="panel-footnote">
            Use the last 5, 10, or 20 games and date controls to examine changes
            in shot selection. Locations come from play-by-play; source
            corrections may differ from box totals.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h3>The game log</h3>
          <span>Click a date to inspect the game</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date / opponent</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>FG</th>
                <th>3PT</th>
                <th>FT</th>
                <th>REB</th>
                <th>AST</th>
                <th>TO</th>
                <th>eFG%</th>
                <th>TS%</th>
              </tr>
            </thead>
            <tbody>
              {[...detail.logs].reverse().map(({ game, stats }) => (
                <tr key={game.id}>
                  <td>
                    <button
                      className="player-link"
                      onClick={() => onGame(game.id)}
                    >
                      {shortDate(game.local_date)} · {game.home ? "vs" : "@"}{" "}
                      {game.opponent.abbreviation}
                      <small>
                        {game.result} {game.lakers_score}-{game.opponent_score}
                      </small>
                    </button>
                  </td>
                  <td>{number(stats.minutes)}</td>
                  <td className="strong">{stats.points}</td>
                  <td>
                    {stats.fgm}-{stats.fga}
                  </td>
                  <td>
                    {stats.three_made}-{stats.three_attempts}
                  </td>
                  <td>
                    {stats.ftm}-{stats.fta}
                  </td>
                  <td>{stats.rebounds}</td>
                  <td>{stats.assists}</td>
                  <td>{stats.turnovers}</td>
                  <td>{number(stats.efg)}</td>
                  <td>{number(stats.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
