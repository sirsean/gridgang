import "./styles/main.css";
import { createGame } from "./game/createGame";
import {
  getMissionByDock,
  selectHomeMissions,
  type DockMission,
} from "./game/missions";
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
  card.appendChild(button);

  return card;
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

window.addEventListener("gridgang:navigate-home", () => {
  navigateTo("/");
});
window.addEventListener("popstate", renderRoute);
renderRoute();
