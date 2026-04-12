import * as Phaser from "phaser";

const palette = {
  background: 0x090909,
  grid: 0x2d3436,
  panel: 0x161616,
  panelLine: 0x7f8c8d,
  brass: 0xc4a15a,
  teal: 0x4fb3a5,
  hazard: 0xe35335,
  cargoA: 0x9b9b9b,
  cargoB: 0x4fb3a5,
  cargoC: 0xc4a15a,
  cargoD: 0x7f8c8d,
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    this.cameras.main.setBackgroundColor(palette.background);

    this.drawDockPanel();
    this.drawConveyor();
    this.drawCargoBay();
    this.drawPrototypeCargo();
    this.drawHud();
  }

  private drawDockPanel() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, palette.background).setOrigin(0);

    for (let y = 24; y < height; y += 24) {
      this.add
        .line(0, 0, 0, y, width, y, palette.grid, 0.24)
        .setOrigin(0);
    }
  }

  private drawConveyor() {
    this.add
      .rectangle(80, 32, 560, 264, palette.panel)
      .setOrigin(0)
      .setStrokeStyle(3, palette.panelLine, 0.8);

    this.add
      .text(98, 10, "INBOUND CONVEYOR", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#c4a15a",
      })
      .setResolution(2);

    for (const y of [108, 216]) {
      for (let x = 104; x < 620; x += 48) {
        this.add.rectangle(x, y, 30, 10, palette.panelLine, 0.48);
      }
    }
  }

  private drawCargoBay() {
    const bayX = 120;
    const bayY = 344;
    const cell = 40;
    const columns = 12;
    const rows = 15;

    this.add
      .rectangle(
        bayX,
        bayY,
        columns * cell,
        rows * cell,
        palette.panel,
        0.95,
      )
      .setOrigin(0)
      .setStrokeStyle(4, palette.panelLine, 0.9);

    for (let col = 1; col < columns; col += 1) {
      const x = bayX + col * cell;
      this.add
        .line(0, 0, x, bayY, x, bayY + rows * cell, palette.grid, 0.58)
        .setOrigin(0);
    }

    for (let row = 1; row < rows; row += 1) {
      const y = bayY + row * cell;
      this.add
        .line(0, 0, bayX, y, bayX + columns * cell, y, palette.grid, 0.58)
        .setOrigin(0);
    }

    this.add
      .text(bayX, bayY - 30, "PERSONAL CARGO BAY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#c4a15a",
      })
      .setResolution(2);
  }

  private drawPrototypeCargo() {
    const conveyorShapes = [
      {
        x: 108,
        y: 60,
        color: palette.cargoA,
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
        ],
      },
      {
        x: 242,
        y: 60,
        color: palette.cargoB,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
      },
      {
        x: 376,
        y: 60,
        color: palette.cargoC,
        cells: [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
      },
      {
        x: 510,
        y: 60,
        color: palette.cargoD,
        cells: [
          [0, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
      },
      {
        x: 108,
        y: 180,
        color: palette.cargoB,
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
        ],
      },
      {
        x: 242,
        y: 180,
        color: palette.cargoC,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 2],
        ],
      },
      {
        x: 376,
        y: 180,
        color: palette.cargoA,
        cells: [
          [0, 0],
          [1, 0],
          [1, 1],
          [2, 1],
        ],
      },
      {
        x: 510,
        y: 180,
        color: palette.hazard,
        cells: [
          [1, 0],
          [1, 1],
          [0, 2],
          [1, 2],
        ],
      },
    ] satisfies Array<{
      x: number;
      y: number;
      color: number;
      cells: Array<[number, number]>;
    }>;

    for (const shape of conveyorShapes) {
      this.drawShape(shape.x, shape.y, shape.color, shape.cells);
    }

    this.drawShape(280, 736, palette.hazard, [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
  }

  private drawShape(
    originX: number,
    originY: number,
    color: number,
    cells: Array<[number, number]>,
  ) {
    const size = 32;
    const gap = 4;

    for (const [cellX, cellY] of cells) {
      this.add
        .rectangle(
          originX + cellX * (size + gap),
          originY + cellY * (size + gap),
          size,
          size,
          color,
          0.95,
        )
        .setOrigin(0)
        .setStrokeStyle(2, 0x050505, 0.9);
    }
  }

  private drawHud() {
    this.add
      .text(120, 924, "SCORE 000000    BEST LOCAL", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#4fb3a5",
      })
      .setResolution(2);
  }
}
