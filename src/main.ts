import "./styles/main.css";
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

function showHome() {
  if (!homeScreen || !gameScreen || !missionList || !homeLeaderboard) {
    return;
  }

  game?.destroy(true);
  game = undefined;
  renderHomeMissions();
  gameScreen.classList.add("is-hidden");
  homeScreen.classList.remove("is-hidden");
  missionList.querySelector<HTMLButtonElement>("button")?.focus();
}

function renderHomeMissions() {
  if (!missionList || !homeLeaderboard) {
    return;
  }

  missionList.replaceChildren(createMissionCard(defaultMission));
  homeLeaderboard.replaceChildren(createLeaderboardPanel(defaultMission));
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

function createLeaderboardPanel(mission: DockMission) {
  const scores = getHighScores(mission.dock).slice(0, 10);
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

  if (scores.length === 0) {
    const empty = document.createElement("p");
    empty.className = "leaderboard-empty";
    empty.textContent = "No runs logged yet. Finish a run to claim a spot.";
    panel.appendChild(empty);
    return panel;
  }

  const list = document.createElement("ol");
  list.className = "leaderboard-list";

  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index];
    const item = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1);

    const scoreValue = document.createElement("span");
    scoreValue.className = "leaderboard-score-value";
    const playedAt = document.createElement("time");
    playedAt.className = "leaderboard-score-time";

    scoreValue.textContent = formatScore(score.score);
    playedAt.dateTime = score.playedAt;
    playedAt.textContent = formatPlayedAt(score.playedAt);

    item.appendChild(rank);
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
