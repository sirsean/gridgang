-- Discord-backed players and per-dock score rows (top-N reads are indexed by dock + score).

CREATE TABLE players (
  discord_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_hash TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dock TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  played_at TEXT NOT NULL,
  FOREIGN KEY (discord_user_id) REFERENCES players(discord_user_id)
);

CREATE INDEX scores_dock_score_idx ON scores (dock, score DESC, played_at ASC);
