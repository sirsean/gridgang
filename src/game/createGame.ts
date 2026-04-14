import * as Phaser from "phaser";
import type { DockMission } from "./missions";
import { BootScene } from "./scenes/BootScene";

const GAME_WIDTH = 720;
const GAME_HEIGHT = 960;

export function createGame(parent: string, mission: DockMission) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#090909",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new BootScene(mission)],
  });
}
