import "./styles/main.css";
import {
  fetchMe,
  fetchRemoteLeaderboard,
  logout,
} from "./api/server";
import { createGame } from "./game/createGame";
import { defaultMission, type DockMission } from "./game/missions";
import { getHighScores } from "./game/highScores";
import type * as Phaser from "phaser";

let game: Phaser.Game | undefined;

const homeScreen = document.querySelector<HTMLElement>("#home-screen");
const gameScreen = document.querySelector<HTMLElement>("#game-screen");
const missionList = document.querySelector<HTMLElement>("#mission-list");
const homeLeaderboard = document.querySelector<HTMLElement>("#home-leaderboard");
const gameContainer = document.querySelector<HTMLElement>("#game");
const gameDockLabel = document.querySelector<HTMLElement>("#game-dock-label");

function showGame() {
  if (!homeScreen || !gameScreen || !gameContainer || !gameDockLabel) {
    return;
  }

  const mission = defaultMission;

  game?.destroy(true);
  gameContainer.replaceChildren();
  homeScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  gameDockLabel.textContent = `Dock ${mission.dock}`;
  game = createGame("game", mission);
}

function consumeAuthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("auth_error");
  if (!raw || window.location.pathname !== "/") {
    return null;
  }
  window.history.replaceState(null, "", "/");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function showHome() {
  if (!homeScreen || !gameScreen || !missionList || !homeLeaderboard) {
    return;
  }

  game?.destroy(true);
  game = undefined;
  const authError = consumeAuthErrorFromUrl();
  void renderHomeMissions(authError);
  gameScreen.classList.add("is-hidden");
  homeScreen.classList.remove("is-hidden");
  missionList.querySelector<HTMLButtonElement>("button")?.focus();
}

async function renderHomeMissions(authError: string | null) {
  if (!missionList || !homeLeaderboard) {
    return;
  }

  missionList.replaceChildren(createMissionCard(defaultMission));

  homeLeaderboard.replaceChildren(
    await createLeaderboardPanel(defaultMission, authError),
  );
}

function appendLeaderboardAuthBlock(
  panel: HTMLElement,
  authError: string | null,
  me: { displayName: string; avatarUrl: string | null } | null,
) {
  const block = document.createElement("div");
  block.className = "leaderboard-auth";

  if (authError) {
    const err = document.createElement("p");
    err.className = "leaderboard-auth-error";
    err.textContent = `Sign-in did not complete: ${authError}`;
    block.appendChild(err);
  }

  if (me) {
    const row = document.createElement("div");
    row.className = "leaderboard-auth-row";

    const identity = document.createElement("div");
    identity.className = "leaderboard-auth-identity";

    if (me.avatarUrl) {
      const avatar = document.createElement("img");
      avatar.className = "leaderboard-auth-avatar";
      avatar.src = me.avatarUrl;
      avatar.alt = `${me.displayName} avatar`;
      avatar.width = 40;
      avatar.height = 40;
      avatar.loading = "lazy";
      identity.appendChild(avatar);
    }

    const label = document.createElement("p");
    label.className = "leaderboard-auth-status";
    label.textContent = `Linked as ${me.displayName}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "leaderboard-auth-signout";
    btn.textContent = "Sign out";
    btn.addEventListener("click", async () => {
      await logout();
      await renderHomeMissions(null);
    });

    identity.appendChild(label);
    row.appendChild(identity);
    row.appendChild(btn);
    block.appendChild(row);
  } else {
    const hint = document.createElement("p");
    hint.className = "leaderboard-auth-hint";
    hint.textContent =
      "Link Discord to post runs to the shared board and show your callsign next to scores.";

    const link = document.createElement("a");
    link.href = "/api/auth/discord";
    link.className = "leaderboard-discord-cta";
    link.textContent = "Sign in with Discord";

    block.appendChild(hint);
    block.appendChild(link);
  }

  panel.appendChild(block);
}

function createMissionCard(mission: DockMission) {
  const card = document.createElement("article");
  card.className = "mission-card";

  const dock = document.createElement("p");
  dock.className = "eyebrow";
  dock.textContent = `Dock ${mission.dock}`;

  const name = document.createElement("h2");
  name.textContent = mission.name;

  const summary = document.createElement("p");
  summary.className = "mission-summary";
  summary.textContent = mission.summary;

  const button = document.createElement("button");
  button.className = "mission-action";
  button.type = "button";
  button.textContent = "Start";
  button.addEventListener("click", () => {
    navigateTo("/game");
  });

  card.appendChild(dock);
  card.appendChild(name);
  card.appendChild(summary);
  card.appendChild(button);

  return card;
}

type LeaderboardRow =
  | {
      kind: "remote";
      score: number;
      playedAt: string;
      playerName: string;
      avatarUrl: string | null;
    }
  | { kind: "local"; score: number; playedAt: string };

async function createLeaderboardPanel(
  mission: DockMission,
  authError: string | null,
) {
  const [remote, me] = await Promise.all([
    fetchRemoteLeaderboard(mission.dock),
    fetchMe(),
  ]);

  const panel = document.createElement("article");
  panel.className = "leaderboard-panel";

  const header = document.createElement("header");
  header.className = "leaderboard-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "leaderboard-eyebrow";
  eyebrow.textContent = `Dock ${mission.dock}`;

  const title = document.createElement("h2");
  title.className = "leaderboard-title";
  title.textContent = "Leaderboard";

  header.appendChild(eyebrow);
  header.appendChild(title);
  panel.appendChild(header);

  appendLeaderboardAuthBlock(panel, authError, me);

  let rows: LeaderboardRow[];

  if (remote !== null) {
    rows = remote.map((e) => ({
      kind: "remote" as const,
      score: e.score,
      playedAt: e.playedAt,
      playerName: e.playerName,
      avatarUrl: e.avatarUrl,
    }));
  } else {
    const note = document.createElement("p");
    note.className = "leaderboard-offline-note";
    note.textContent =
      "Could not reach the dock network. Showing scores from this device only.";
    panel.appendChild(note);
    rows = getHighScores(mission.dock).slice(0, 10).map((e) => ({
      kind: "local" as const,
      score: e.score,
      playedAt: e.playedAt,
    }));
  }

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "leaderboard-empty";
    if (remote !== null) {
      empty.textContent = me
        ? "No runs on the shared board yet. Finish a run to post your score."
        : "No runs on the shared board yet.";
    } else {
      empty.textContent = "No runs logged yet. Finish a run to claim a spot.";
    }
    panel.appendChild(empty);
    return panel;
  }

  const list = document.createElement("ol");
  list.className = "leaderboard-list";

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const item = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);

    const playerCell = document.createElement("div");
    playerCell.className = "leaderboard-player-cell";

    if (row.kind === "remote" && row.avatarUrl) {
      const avatarFrame = document.createElement("span");
      avatarFrame.className = "leaderboard-row-avatar-frame";
      const avatar = document.createElement("img");
      avatar.className = "leaderboard-row-avatar";
      avatar.src = row.avatarUrl;
      avatar.alt = `${row.playerName} avatar`;
      avatar.width = 30;
      avatar.height = 30;
      avatar.loading = "lazy";
      avatarFrame.appendChild(avatar);
      playerCell.appendChild(avatarFrame);
    }

    const player = document.createElement("span");
    player.className = "leaderboard-player";
    player.textContent =
      row.kind === "remote" ? row.playerName : "This device";
    playerCell.appendChild(player);

    const scoreValue = document.createElement("span");
    scoreValue.className = "leaderboard-score-value";

    const playedAt = document.createElement("time");
    playedAt.className = "leaderboard-score-time";

    scoreValue.textContent = formatScore(row.score);
    playedAt.dateTime = row.playedAt;
    playedAt.textContent = formatPlayedAt(row.playedAt);

    item.appendChild(rank);
    item.appendChild(playerCell);
    item.appendChild(scoreValue);
    item.appendChild(playedAt);
    list.appendChild(item);
  }

  panel.appendChild(list);

  return panel;
}

function navigateTo(url: string) {
  const nextUrl = new URL(url, window.location.href);

  if (
    window.location.pathname !== nextUrl.pathname ||
    window.location.search !== nextUrl.search
  ) {
    window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}`);
  }

  renderRoute();
}

function renderRoute() {
  if (window.location.pathname === "/game") {
    showGame();
    return;
  }

  showHome();
}

function formatScore(value: number) {
  const sign = value < 0 ? "-" : "";

  return `${sign}${Math.abs(value).toString().padStart(6, "0")}`;
}

function formatPlayedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

window.addEventListener("gridgang:navigate-home", () => {
  navigateTo("/");
});
window.addEventListener("popstate", renderRoute);
renderRoute();
