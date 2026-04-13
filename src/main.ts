import "./styles/main.css";
import { createGame } from "./game/createGame";
import type * as Phaser from "phaser";

let game: Phaser.Game | undefined;

const homeScreen = document.querySelector<HTMLElement>("#home-screen");
const gameScreen = document.querySelector<HTMLElement>("#game-screen");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const gameContainer = document.querySelector<HTMLElement>("#game");

function showGame() {
  if (!homeScreen || !gameScreen || !gameContainer) {
    return;
  }

  game?.destroy(true);
  gameContainer.replaceChildren();
  homeScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  game = createGame("game");
}

function showHome() {
  if (!homeScreen || !gameScreen || !startButton) {
    return;
  }

  game?.destroy(true);
  game = undefined;
  gameScreen.classList.add("is-hidden");
  homeScreen.classList.remove("is-hidden");
  startButton.focus();
}

function navigateTo(pathname: "/" | "/game") {
  if (window.location.pathname !== pathname) {
    window.history.pushState(null, "", pathname);
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

startButton?.addEventListener("click", () => {
  navigateTo("/game");
});
window.addEventListener("gridgang:navigate-home", () => {
  navigateTo("/");
});
window.addEventListener("popstate", renderRoute);
renderRoute();
