export type View = "overview" | "game" | "lineups" | "players" | "research";
export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  score: number;
  home: boolean;
};
export type Game = {
  id: string;
  season: number;
  season_label: string;
  season_type: string;
  date: string;
  local_date: string;
  opponent: Team;
  home: boolean;
  lakers_score: number;
  opponent_score: number;
  result: string;
  periods: number;
  duration: number;
  status: string;
  lineup_coverage: number;
  issues: number;
  revision: string;
};
export type Filters = {
  season: number;
  season_type: string;
  game_ids: string[];
  date_from: string | null;
  date_to: string | null;
  opponent: string | null;
  venue: string;
  rest: string;
  period: number | null;
  start: number;
  end: number;
  on: string[];
  off: string[];
  max_margin: number | null;
  clutch: boolean;
  minimum_possessions: number;
  last_n: number | null;
  player_id: string | null;
};
export type Player = {
  id: string;
  name: string;
  short_name: string;
  position: string;
  jersey: string;
};
export type Rates = {
  points: number;
  fgm: number;
  fga: number;
  three_made: number;
  three_attempts: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  rebounds: number;
  turnovers: number;
  assists: number;
  possessions: number;
  defensive_possessions: number;
  off_rating: number | null;
  def_rating: number | null;
  net_rating: number | null;
  efg: number | null;
  ts: number | null;
  three_pct: number | null;
  three_rate: number | null;
  turnover_rate: number | null;
  oreb_pct: number | null;
  ft_rate: number | null;
};
export type PlayerResult = Player &
  Rates & { minutes: number; games: number; ppg: number };
export type Lineup = Rates & {
  players: string[];
  player_ids: string[];
  minutes: number;
  games: number;
  plus_minus: number;
};
export type Zone = {
  zone: string;
  attempts: number;
  made: number;
  points: number;
  fg_pct: number;
};
export type Analysis = {
  filters: Filters;
  games: Game[];
  game_count: number;
  matching_games: number;
  summary: Rates;
  opponent_summary: Rates;
  minutes: number;
  players: PlayerResult[];
  lineups: Lineup[];
  trends: (Game & Rates)[];
  zones: Zone[];
  coverage: {
    partial_games: number;
    excluded_lineup_seconds: number;
    coordinate_shots: number;
    total_shots: number;
    heaves: number;
  };
  method_version: string;
  revisions: Record<string, string>;
  comparison?: Analysis;
  player_detail: PlayerDetail | null;
};
export type Play = {
  id: string;
  sequence: number;
  period: number;
  clock: string;
  remaining: number;
  elapsed: number;
  type: string;
  description: string;
  team_id: string | null;
  player_id: string | null;
  participants: string[];
  assist_id: string | null;
  points: number;
  field_goal: boolean;
  free_throw: boolean;
  heave: boolean;
  turnover: boolean;
  made: boolean;
  attempted_points: number;
  x: number | null;
  y: number | null;
  lakers_score: number;
  opponent_score: number;
  margin: number;
  lineups: Record<string, string[]>;
  possession_id: string | null;
};
export type Stint = {
  period: number;
  start: number;
  end: number;
  lineups: Record<string, string[]>;
};
export type Possession = {
  id: string;
  team_id: string;
  period: number;
  start: number;
  end: number;
  points: number;
  event_ids: string[];
  outcome: string;
  lineups: Record<string, string[]>;
};
export type TimelinePoint = Pick<
  Play,
  | "id"
  | "elapsed"
  | "period"
  | "clock"
  | "margin"
  | "lakers_score"
  | "opponent_score"
  | "description"
>;
export type Validation = {
  status: string;
  stats_valid: boolean;
  lineups_valid: boolean;
  checks: { name: string; actual: number; expected: number; passed: boolean }[];
  issues: string[];
  lineup_coverage: number;
  shot_coverage: number;
  possession_method: string;
};
export type GameDetail = Game & {
  teams: Record<string, Team>;
  roster: (Player & {
    team_id: string;
    starter: boolean;
    did_not_play: boolean;
    box: Rates & { minutes: number };
  })[];
  events: Play[];
  possessions: Possession[];
  stints: Stint[];
  timeline: TimelinePoint[];
  validation: Validation;
  analysis: Analysis;
  source_url: string;
};
export type ImportState = {
  season: number;
  season_type_id: number;
  expected: number;
  expected_ids: string[];
  last_success: string | null;
  status: string;
  failures: { id: string; error: string }[];
};
export type Catalog = {
  games: Game[];
  seasons: { value: number; label: string }[];
  players: Player[];
  imports: ImportState[];
  method_version: string;
};
export type Investigation = {
  id: string;
  title: string;
  note: string;
  filters: Filters;
  snapshot: Analysis;
  created_at: string;
  superseded: boolean;
};

export const defaultFilters: Filters = {
  season: 2026,
  season_type: "Regular season",
  game_ids: [],
  date_from: null,
  date_to: null,
  opponent: null,
  venue: "all",
  rest: "all",
  period: null,
  start: 0,
  end: 10000,
  on: [],
  off: [],
  max_margin: null,
  clutch: false,
  minimum_possessions: 20,
  last_n: null,
  player_id: null,
};

export type PlayerDetail = {
  player: PlayerResult;
  logs: { game: Game; stats: PlayerResult }[];
  shots: Play[];
  zones: Zone[];
};
