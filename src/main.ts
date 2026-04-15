import "./styles/main.css";
import { createGame } from "./game/createGame";
import {
  getMissionByDock,
  selectHomeMissions,
  type DockMission,
} from "./game/missions";
import { getHighScores } from "./game/highScores";
import type * as Phaser from "phaser";

let game: Phaser.Game | undefined;

const homeScreen = document.querySelector<HTMLElement>("#home-screen");
const gameScreen = document.querySelector<HTMLElement>("#game-screen");
const missionList = document.querySelector<HTMLElement>("#mission-list");
const gameContainer = document.querySelector<HTMLElement>("#game");
const gameDockLabel = document.querySelector<HTMLElement>("#game-dock-label");

function showGame() {
  if (!homeScreen || !gameScreen || !gameContainer || !gameDockLabel) {
    return;
  }

  const mission = getMissionByDock(
    new URLSearchParams(window.location.search).get("dock"),
  );

  game?.destroy(true);
  gameContainer.replaceChildren();
  homeScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  gameDockLabel.textContent = `Dock ${mission.dock}`;
  game = createGame("game", mission);
}

function showHome() {
  if (!homeScreen || !gameScreen || !missionList) {
    return;
  }

  game?.destroy(true);
  game = undefined;
  renderHomeMissions();
  gameScreen.classList.add("is-hidden");
  homeScreen.classList.remove("is-hidden");
  missionList.querySelector<HTMLButtonElement>("[data-dock]")?.focus();
}

function renderHomeMissions() {
  if (!missionList) {
    return;
  }

  missionList.replaceChildren(...selectHomeMissions().map(createMissionCard));
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

  const highScores = createHighScoreList(mission);

  const button = document.createElement("button");
  button.className = "mission-action";
  button.type = "button";
  button.dataset.dock = mission.dock;
  button.textContent = "Start";
  button.addEventListener("click", () => {
    navigateTo(`/game?dock=${mission.dock}`);
  });

  card.appendChild(dock);
  card.appendChild(name);
  card.appendChild(summary);
  card.appendChild(highScores);
  card.appendChild(button);

  return card;
}

function createHighScoreList(mission: DockMission) {
  const scores = getHighScores(mission.dock).slice(0, 3);
  const wrapper = document.createElement("section");
  wrapper.className = "mission-scores";
  wrapper.setAttribute("aria-label", `Dock ${mission.dock} top scores`);

  const title = document.createElement("p");
  title.className = "mission-scores-title";
  title.textContent = "Top Scores";
  wrapper.appendChild(title);

  if (scores.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mission-scores-empty";
    empty.textContent = "No runs logged.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  const list = document.createElement("ol");
  list.className = "mission-score-list";

  for (const score of scores) {
    const item = document.createElement("li");
    const scoreValue = document.createElement("span");
    const playedAt = document.createElement("time");

    scoreValue.textContent = formatScore(score.score);
    playedAt.dateTime = score.playedAt;
    playedAt.textContent = formatPlayedAt(score.playedAt);

    item.appendChild(scoreValue);
    item.appendChild(playedAt);
    list.appendChild(item);
  }

  wrapper.appendChild(list);

  return wrapper;
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
