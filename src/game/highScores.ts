export type HighScoreEntry = {
  score: number;
  playedAt: string;
};

type HighScoreDatabase = Record<string, HighScoreEntry[]>;

const storageKey = "gridgang:high-scores:v1";
const maxHighScores = 10;

export function getHighScores(dock: string) {
  return readDatabase()[dock] ?? [];
}

export function getTopHighScore(dock: string) {
  return getHighScores(dock)[0];
}

export function recordHighScore(
  dock: string,
  score: number,
  playedAt = new Date(),
) {
  const database = readDatabase();
  const entry = {
    score,
    playedAt: playedAt.toISOString(),
  };
  const scores = [...(database[dock] ?? []), entry]
    .filter(isHighScoreEntry)
    .sort(compareHighScores)
    .slice(0, maxHighScores);

  database[dock] = scores;
  writeDatabase(database);

  return entry;
}

function readDatabase(): HighScoreDatabase {
  const storage = getStorage();

  if (!storage) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(storage.getItem(storageKey) ?? "{}");
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const database: HighScoreDatabase = {};

  for (const [dock, scores] of Object.entries(parsed)) {
    if (!Array.isArray(scores)) {
      continue;
    }

    database[dock] = scores
      .filter(isHighScoreEntry)
      .sort(compareHighScores)
      .slice(0, maxHighScores);
  }

  return database;
}

function writeDatabase(database: HighScoreDatabase) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(database));
  } catch {
    // Scores are best-effort local data. The game should continue if storage is full.
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isHighScoreEntry(value: unknown): value is HighScoreEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as HighScoreEntry;

  return (
    Number.isFinite(entry.score) &&
    typeof entry.playedAt === "string" &&
    Number.isFinite(Date.parse(entry.playedAt))
  );
}

function compareHighScores(left: HighScoreEntry, right: HighScoreEntry) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return Date.parse(right.playedAt) - Date.parse(left.playedAt);
}
