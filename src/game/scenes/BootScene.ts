import * as Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { getTopHighScore, recordHighScore } from "../highScores";
import { defaultMission, type DockMission } from "../missions";

type CargoCell = [number, number];
type CellAssetGroup = "hazard" | "cargo-a" | "cargo-b" | "cargo-c" | "cargo-d";
type CellTextureUsage = "conveyor" | "bay";

type BayCell = {
  color: number;
  isHot: boolean;
} | null;

type ShapeDefinition = {
  key: string;
  color: number;
  assetGroup: CellAssetGroup;
  cells: CargoCell[];
  /** Same length as `cells`; true = smuggler cell (glow, 5× share of piece score, inspector risk). */
  hotCellMask?: boolean[];
};

type ConveyorCargo = {
  id: number;
  definition: ShapeDefinition;
  container: Phaser.GameObjects.Container;
  hitbox: Phaser.GameObjects.Rectangle;
  cellTextureVariants: number[];
  row: number;
  isDragging: boolean;
  returnX: number;
  returnY: number;
  grabCellOffsetX: number;
  grabCellOffsetY: number;
};

type ScoreBonus = {
  label: string;
  value: number;
  color: number;
  x: number;
  y: number;
};

const palette = {
  background: 0x090909,
  grid: 0x2d3436,
  panel: 0x161616,
  panelLine: 0x7f8c8d,
  hazard: 0xe35335,
  cargoA: 0x9b9b9b,
  cargoB: 0x4fb3a5,
  cargoC: 0xc4a15a,
  cargoD: 0x7f8c8d,
  previewColumn: 0x4fb3a5,
  previewCell: 0xc4a15a,
};

const cargoStyles: Array<{ color: number; assetGroup: CellAssetGroup }> = [
  { color: palette.hazard, assetGroup: "hazard" },
  { color: palette.cargoA, assetGroup: "cargo-a" },
  { color: palette.cargoB, assetGroup: "cargo-b" },
  { color: palette.cargoC, assetGroup: "cargo-c" },
  { color: palette.cargoD, assetGroup: "cargo-d" },
];

const conveyor = {
  y: 32,
  height: 264,
  rows: [60, 180],
  speed: 42,
  /** Cargo spawns this far left of x = 0 (off the left edge). */
  spawnPastLeft: 56,
  /** Cargo is removed after moving this far past the right edge of the screen. */
  despawnPastRight: 120,
  spawnDelay: 1500,
  maxCargo: 12,
};

const bay = {
  x: 120,
  y: 344,
  cell: 40,
  columns: 12,
  rows: 15,
};

const inspector = {
  trackY: 300,
  offScreenMargin: 96,
  passDurationMs: 9300,
  idleWaitMinMs: 5000,
  idleWaitMaxMs: 13_000,
  firstIdleMinMs: 2500,
  firstIdleMaxMs: 6000,
  beamFill: 0xff9a12,
  beamStroke: 0xffe08a,
  railColor: 0xd4a024,
  droneBodyStroke: 0xb8893a,
  pulsePeriodMs: 680,
  hotCellChance: 0.077,
  hotScoreMultiplier: 5,
};

const conveyorBlock = {
  size: 32,
  step: 36,
  hitPadding: 18,
};

const bayBlock = {
  size: 38,
  step: bay.cell,
};

const bonusScoring = {
  tileSize: 3,
  sameColorTile: 1500,
  rowBase: 1000,
  rowStep: 500,
};

const cellAssetVariants = 10;
const cellTexturePrefix = "cell";
const cellTextureUsages: CellTextureUsage[] = ["conveyor", "bay"];
const cellAssetGroups: CellAssetGroup[] = [
  "hazard",
  "cargo-a",
  "cargo-b",
  "cargo-c",
  "cargo-d",
];

// Five 3x3 bottom-profile pairs. Four full catalog cycles can tile the 12x15 bay.
// Each plug occupies top-accessible cells so gravity can fill the paired gaps.
// Color is randomized per spawn, so profile matches are common but color matches are not.
const shapeDefinitions: ShapeDefinition[] = [
  {
    key: "rising-step-socket",
    color: palette.cargoA,
    assetGroup: "cargo-a",
    cells: [
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  },
  {
    key: "rising-step-plug",
    color: palette.cargoA,
    assetGroup: "cargo-a",
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
  },
  {
    key: "falling-step-socket",
    color: palette.cargoB,
    assetGroup: "cargo-b",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
  },
  {
    key: "falling-step-plug",
    color: palette.cargoB,
    assetGroup: "cargo-b",
    cells: [
      [1, 0],
      [2, 1],
      [2, 0],
    ],
  },
  {
    key: "center-cradle-socket",
    color: palette.cargoC,
    assetGroup: "cargo-c",
    cells: [
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  },
  {
    key: "center-cradle-plug",
    color: palette.cargoC,
    assetGroup: "cargo-c",
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  },
  {
    key: "offset-cradle-socket",
    color: palette.hazard,
    assetGroup: "hazard",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
  },
  {
    key: "offset-cradle-plug",
    color: palette.hazard,
    assetGroup: "hazard",
    cells: [
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  },
  {
    key: "flat-bed-socket",
    color: palette.cargoD,
    assetGroup: "cargo-d",
    cells: [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ],
  },
  {
    key: "flat-bed-plug",
    color: palette.cargoD,
    assetGroup: "cargo-d",
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
];

export class BootScene extends Phaser.Scene {
  private cargoGrid: Array<Array<BayCell>> = [];
  private pendingGridCells = new Set<string>();
  private conveyorCargo: ConveyorCargo[] = [];
  private cargoByHitbox = new Map<Phaser.GameObjects.Rectangle, ConveyorCargo>();
  private activeDrag?: ConveyorCargo;
  private nextCargoId = 1;
  private nextShapeIndex = 0;
  private nextRowIndex = 0;
  private spawnElapsed = 0;
  private score = 0;
  private timeRemainingMs = 90_000;
  private soundFx!: SoundFx;
  private isGameOver = false;
  private scoredTileKeys = new Set<string>();
  private scoredRows = new Set<number>();
  private dropPreview: Phaser.GameObjects.Rectangle[] = [];
  private dropColumnPreview: Phaser.GameObjects.Rectangle[] = [];
  private scoreText?: Phaser.GameObjects.Text;
  private topScoreText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private inspectorProbeX = 0;
  private inspectorRail?: Phaser.GameObjects.Line;
  private inspectorBeam?: Phaser.GameObjects.Rectangle;
  private inspectorDrone?: Phaser.GameObjects.Container;
  private inspectorDroneBody?: Phaser.GameObjects.Rectangle;
  private inspectorDroneLens?: Phaser.GameObjects.Rectangle;
  private inspectorPulsePhase = 0;
  private inspectorMode: "idle" | "passing" = "idle";
  private inspectorIdleMs = 0;
  private inspectorPassElapsed = 0;
  private inspectorPassStartX = 0;
  private inspectorPassEndX = 0;
  /** True if the last pass finished by leaving past the right edge. */
  private inspectorLastExitRight: boolean | null = null;

  constructor(private readonly mission: DockMission = defaultMission) {
    super("boot");
  }

  preload() {
    SoundFx.preload(this);

    for (const usage of cellTextureUsages) {
      for (const group of cellAssetGroups) {
        for (let variant = 1; variant <= cellAssetVariants; variant += 1) {
          const variantId = variant.toString().padStart(2, "0");
          this.load.image(
            this.getCellTextureKey(usage, group, variant),
            `/assets/cells/${usage}/${group}-${variantId}.png`,
          );
        }
      }
    }
  }

  create() {
    this.soundFx = new SoundFx(this);
    this.cameras.main.setBackgroundColor(palette.background);
    this.cargoGrid = Array.from({ length: bay.rows }, () =>
      Array.from({ length: bay.columns }, (): BayCell => null),
    );

    this.drawDockPanel();
    this.drawConveyor();
    this.drawCargoBay();
    this.drawInspectorRig();
    this.seedConveyor();
    this.drawHud();

    this.soundFx.startConveyor();
    this.input.on("pointerdown", () => {
      this.soundFx.resume();
    });
    this.input.on("dragstart", this.handleDragStart, this);
    this.input.on("drag", this.handleDrag, this);
    this.input.on("dragend", this.handleDragEnd, this);
    this.events.once("shutdown", () => {
      this.soundFx.destroy();
    });
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) {
      return;
    }

    const previousTimeRemainingMs = this.timeRemainingMs;
    this.timeRemainingMs = Math.max(0, this.timeRemainingMs - delta);
    this.updateTimerText();
    this.updateClockTick(previousTimeRemainingMs, this.timeRemainingMs);

    if (this.timeRemainingMs <= 0) {
      this.endGame("complete");
      return;
    }

    this.updateInspector(delta);

    const movement = (delta / 1000) * conveyor.speed;

    for (const cargo of this.conveyorCargo) {
      if (!cargo.isDragging) {
        cargo.container.x += movement;
        cargo.hitbox.x += movement;
      }
    }

    this.despawnConveyorCargo();

    this.spawnElapsed += delta;
    if (this.spawnElapsed >= conveyor.spawnDelay) {
      this.spawnElapsed = 0;
      this.spawnConveyorCargo(-conveyor.spawnPastLeft, this.nextRowIndex);
      this.nextRowIndex = (this.nextRowIndex + 1) % conveyor.rows.length;
    }
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
    const width = this.scale.width;

    this.add
      .rectangle(0, conveyor.y, width, conveyor.height, palette.panel)
      .setOrigin(0)
      .setStrokeStyle(3, palette.panelLine, 0.8);

    this.add
      .text(20, 10, "INBOUND CONVEYOR", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#c4a15a",
      })
      .setResolution(2);

    const dashY = [108, 216] as const;
    const dashW = 30;
    const dashH = 10;
    const dashGap = 18;
    const pitch = dashW + dashGap;
    const startLeft = -dashGap;

    for (const y of dashY) {
      for (let left = startLeft; left < width + dashW; left += pitch) {
        this.add
          .rectangle(left + dashW / 2, y, dashW, dashH, palette.panelLine, 0.48)
          .setOrigin(0.5, 0.5);
      }
    }
  }

  private drawCargoBay() {
    this.add
      .rectangle(
        bay.x,
        bay.y,
        bay.columns * bay.cell,
        bay.rows * bay.cell,
        palette.panel,
        0.95,
      )
      .setOrigin(0)
      .setStrokeStyle(4, palette.panelLine, 0.9);

    for (let col = 1; col < bay.columns; col += 1) {
      const x = bay.x + col * bay.cell;
      this.add
        .line(0, 0, x, bay.y, x, bay.y + bay.rows * bay.cell, palette.grid, 0.58)
        .setOrigin(0);
    }

    for (let row = 1; row < bay.rows; row += 1) {
      const y = bay.y + row * bay.cell;
      this.add
        .line(0, 0, bay.x, y, bay.x + bay.columns * bay.cell, y, palette.grid, 0.58)
        .setOrigin(0);
    }

    this.add
      .text(bay.x, bay.y - 30, "PERSONAL CARGO BAY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#c4a15a",
      })
      .setResolution(2);
  }

  private drawInspectorRig() {
    const railLeft = 0;
    const railRight = this.scale.width;

    this.inspectorRail = this.add
      .line(0, 0, railLeft, inspector.trackY, railRight, inspector.trackY, inspector.railColor, 1)
      .setOrigin(0)
      .setLineWidth(4)
      .setDepth(13);

    const beamHeight = bay.y + bay.rows * bay.cell - inspector.trackY + 6;
    this.inspectorBeam = this.add
      .rectangle(
        this.scale.width / 2,
        inspector.trackY,
        bay.cell - 6,
        beamHeight,
        inspector.beamFill,
        0.14,
      )
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, inspector.beamStroke, 0.42)
      .setDepth(12);

    this.inspectorDroneBody = this.add
      .rectangle(0, 0, 34, 16, 0x2a2418, 0.96)
      .setStrokeStyle(2, inspector.droneBodyStroke, 0.55);
    this.inspectorDroneLens = this.add
      .rectangle(0, 10, 14, 8, 0x1f170c, 0.94)
      .setStrokeStyle(2, inspector.beamStroke, 0.72);
    this.inspectorDrone = this.add.container(this.scale.width / 2, inspector.trackY, [
      this.inspectorDroneBody,
      this.inspectorDroneLens,
    ]);
    this.inspectorDrone.setDepth(15);

    this.inspectorMode = "idle";
    this.inspectorIdleMs = Phaser.Math.Between(
      inspector.firstIdleMinMs,
      inspector.firstIdleMaxMs,
    );
    this.inspectorRail.setVisible(false);
    this.inspectorBeam.setVisible(false);
    this.inspectorDrone.setVisible(false);
  }

  private beginInspectorPass() {
    const width = this.scale.width;
    const margin = inspector.offScreenMargin;
    let entryFromLeft: boolean;

    if (this.inspectorLastExitRight === null) {
      entryFromLeft = Math.random() < 0.5;
    } else {
      const naturalNextFromLeft = !this.inspectorLastExitRight;
      entryFromLeft = Math.random() < 0.62 ? naturalNextFromLeft : !naturalNextFromLeft;
    }

    this.inspectorPassStartX = entryFromLeft ? -margin : width + margin;
    this.inspectorPassEndX = entryFromLeft ? width + margin : -margin;
    this.inspectorPassElapsed = 0;
    this.inspectorPulsePhase = 0;
    this.inspectorMode = "passing";
    this.inspectorProbeX = this.inspectorPassStartX;

    this.inspectorRail?.setVisible(true);
    this.inspectorBeam?.setVisible(true);
    this.inspectorDrone?.setVisible(true);
    this.inspectorBeam?.setX(this.inspectorProbeX);
    this.inspectorDrone?.setPosition(this.inspectorProbeX, inspector.trackY);
  }

  private endInspectorPass() {
    this.inspectorLastExitRight = this.inspectorPassEndX > this.inspectorPassStartX;
    this.inspectorMode = "idle";
    this.inspectorIdleMs = Phaser.Math.Between(inspector.idleWaitMinMs, inspector.idleWaitMaxMs);
    this.inspectorRail?.setVisible(false);
    this.inspectorBeam?.setVisible(false);
    this.inspectorDrone?.setVisible(false);
  }

  private updateInspector(delta: number) {
    if (!this.inspectorRail || !this.inspectorBeam || !this.inspectorDrone) {
      return;
    }

    if (this.inspectorMode === "idle") {
      this.inspectorIdleMs -= delta;
      if (this.inspectorIdleMs <= 0) {
        this.beginInspectorPass();
      }
      return;
    }

    this.inspectorPassElapsed += delta;
    const t = Phaser.Math.Clamp(
      this.inspectorPassElapsed / inspector.passDurationMs,
      0,
      1,
    );
    this.inspectorProbeX = Phaser.Math.Linear(this.inspectorPassStartX, this.inspectorPassEndX, t);

    this.inspectorBeam.setX(this.inspectorProbeX);
    this.inspectorDrone.setPosition(this.inspectorProbeX, inspector.trackY);

    this.inspectorPulsePhase += (delta / inspector.pulsePeriodMs) * (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(this.inspectorPulsePhase);
    const beamFillA = Phaser.Math.Linear(0.06, 0.22, pulse);
    const beamStrokeA = Phaser.Math.Linear(0.28, 0.78, pulse);
    this.inspectorBeam.setFillStyle(inspector.beamFill, beamFillA);
    this.inspectorBeam.setStrokeStyle(2, inspector.beamStroke, beamStrokeA);
    this.inspectorRail.setAlpha(Phaser.Math.Linear(0.5, 1, pulse));
    this.inspectorDroneBody?.setStrokeStyle(2, inspector.droneBodyStroke, Phaser.Math.Linear(0.38, 0.82, pulse));
    this.inspectorDroneLens?.setStrokeStyle(2, inspector.beamStroke, Phaser.Math.Linear(0.5, 0.98, pulse));

    const bayWidth = bay.columns * bay.cell;
    const bayRight = bay.x + bayWidth;

    if (this.inspectorProbeX >= bay.x && this.inspectorProbeX < bayRight) {
      const column = Phaser.Math.Clamp(
        Math.floor((this.inspectorProbeX - bay.x) / bay.cell),
        0,
        bay.columns - 1,
      );

      if (this.isExposedHotInColumn(column)) {
        this.endGame("caught");
      }
    }

    if (t >= 1) {
      this.endInspectorPass();
    }
  }

  private isExposedHotInColumn(column: number) {
    for (let row = 0; row < bay.rows; row += 1) {
      const cell = this.cargoGrid[row][column];
      if (cell !== null) {
        return cell.isHot;
      }
    }

    return false;
  }

  private gridCellPendingKey(gridX: number, gridY: number) {
    return `${gridX},${gridY}`;
  }

  private seedConveyor() {
    const width = this.scale.width;
    const pad = 72;
    const spread = (width - pad * 2) / 3;
    const xs = [pad, pad + spread, pad + spread * 2, pad + spread * 3] as const;
    const initialCargo = [
      [xs[0], 0],
      [xs[1], 0],
      [xs[2], 0],
      [xs[3], 0],
      [xs[0], 1],
      [xs[1], 1],
      [xs[2], 1],
      [xs[3], 1],
    ] satisfies Array<[number, number]>;

    for (const [x, row] of initialCargo) {
      this.spawnConveyorCargo(x, row);
    }
  }

  private spawnConveyorCargo(x: number, row: number) {
    if (this.isGameOver || this.conveyorCargo.length >= conveyor.maxCargo) {
      return;
    }

    const definition = this.createSpawnDefinition(
      shapeDefinitions[this.nextShapeIndex],
    );
    this.nextShapeIndex = (this.nextShapeIndex + 1) % shapeDefinitions.length;
    const cellTextureVariants = this.createCellTextureVariants(definition);

    const container = this.createShapeContainer(
      definition,
      x,
      conveyor.rows[row],
      conveyorBlock.size,
      conveyorBlock.step,
      "conveyor",
      cellTextureVariants,
    );
    const bounds = this.getShapePixelBounds(
      definition,
      conveyorBlock.size,
      conveyorBlock.step,
    );
    const hitbox = this.createConveyorHitbox(x, conveyor.rows[row], bounds);

    const cargo: ConveyorCargo = {
      id: this.nextCargoId,
      definition,
      container,
      hitbox,
      cellTextureVariants,
      row,
      isDragging: false,
      returnX: hitbox.x,
      returnY: hitbox.y,
      grabCellOffsetX: 0,
      grabCellOffsetY: 0,
    };
    this.nextCargoId += 1;

    this.conveyorCargo.push(cargo);
    this.cargoByHitbox.set(hitbox, cargo);
  }

  private createSpawnDefinition(baseDefinition: ShapeDefinition) {
    const style = Phaser.Utils.Array.GetRandom(cargoStyles);
    const hotCellMask = baseDefinition.cells.map(
      () => Phaser.Math.FloatBetween(0, 1) < inspector.hotCellChance,
    );

    return {
      ...baseDefinition,
      color: style.color,
      assetGroup: style.assetGroup,
      hotCellMask,
    };
  }

  private createShapeContainer(
    definition: ShapeDefinition,
    x: number,
    y: number,
    blockSize: number,
    blockStep: number,
    textureUsage: CellTextureUsage,
    cellTextureVariants: number[],
  ) {
    const bounds = this.getShapePixelBounds(definition, blockSize, blockStep);
    const container = this.add.container(x, y);
    const hotRims: Phaser.GameObjects.Rectangle[] = [];

    for (const [index, [cellX, cellY]] of definition.cells.entries()) {
      if (definition.hotCellMask?.[index] !== true) {
        continue;
      }

      const rim = this.add
        .rectangle(
          cellX * blockStep + blockSize / 2,
          cellY * blockStep + blockSize / 2,
          blockSize + 10,
          blockSize + 10,
          0xff4d0a,
          0.12,
        )
        .setStrokeStyle(3, 0xff9a45, 0.92);

      rim.setBlendMode(Phaser.BlendModes.ADD);
      container.add(rim);
      hotRims.push(rim);
    }

    for (const [index, [cellX, cellY]] of definition.cells.entries()) {
      const textureKey = this.getCellTextureKey(
        textureUsage,
        definition.assetGroup,
        cellTextureVariants[index],
      );

      container.add(
        this.add
          .image(cellX * blockStep, cellY * blockStep, textureKey)
          .setOrigin(0)
          .setDisplaySize(blockSize, blockSize),
      );
    }

    container.setSize(bounds.width, bounds.height);

    if (hotRims.length > 0) {
      this.tweens.add({
        targets: hotRims,
        alpha: 0.35,
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }

    return container;
  }

  private createConveyorHitbox(
    x: number,
    y: number,
    bounds: { width: number; height: number },
  ) {
    const hitPadding = conveyorBlock.hitPadding;
    const hitbox = this.add
      .rectangle(
        x - hitPadding,
        y - hitPadding,
        bounds.width + hitPadding * 2,
        bounds.height + hitPadding * 2,
        0x4fb3a5,
        0,
      )
      .setOrigin(0)
      .setDepth(5);

    hitbox.setInteractive({ draggable: true });

    return hitbox;
  }

  private getShapePixelBounds(
    definition: ShapeDefinition,
    blockSize: number,
    blockStep: number,
  ) {
    const maxX = Math.max(...definition.cells.map(([cellX]) => cellX));
    const maxY = Math.max(...definition.cells.map(([, cellY]) => cellY));

    return {
      width: maxX * blockStep + blockSize,
      height: maxY * blockStep + blockSize,
    };
  }

  private createCellTextureVariants(definition: ShapeDefinition) {
    return definition.cells.map(() => Phaser.Math.Between(1, cellAssetVariants));
  }

  private getCellTextureKey(
    usage: CellTextureUsage,
    group: CellAssetGroup,
    variant: number,
  ) {
    return `${cellTexturePrefix}-${usage}-${group}-${variant
      .toString()
      .padStart(2, "0")}`;
  }

  private despawnConveyorCargo() {
    this.conveyorCargo = this.conveyorCargo.filter((cargo) => {
      if (
        cargo.isDragging ||
        cargo.container.x < this.scale.width + conveyor.despawnPastRight
      ) {
        return true;
      }

      cargo.container.destroy();
      cargo.hitbox.destroy();
      this.cargoByHitbox.delete(cargo.hitbox);
      return false;
    });
  }

  private handleDragStart(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) {
    const cargo = this.getCargoForGameObject(gameObject);

    if (this.isGameOver || !cargo || this.activeDrag) {
      return;
    }

    this.soundFx.grab();
    cargo.isDragging = true;
    cargo.returnX = cargo.hitbox.x;
    cargo.returnY = cargo.hitbox.y;
    cargo.grabCellOffsetX = this.getGrabCellOffset(
      pointer.x,
      cargo.container.x,
      conveyorBlock.step,
      this.getShapeCellWidth(cargo.definition),
    );
    cargo.grabCellOffsetY = this.getGrabCellOffset(
      pointer.y,
      cargo.container.y,
      conveyorBlock.step,
      this.getShapeCellHeight(cargo.definition),
    );
    cargo.hitbox.setDepth(21);
    cargo.container.setDepth(20);
    cargo.container.setAlpha(0.82);
    this.activeDrag = cargo;
  }

  private handleDrag(
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dragX: number,
    dragY: number,
  ) {
    const cargo = this.getCargoForGameObject(gameObject);

    if (this.isGameOver || !cargo || this.activeDrag !== cargo) {
      return;
    }

    cargo.hitbox.setPosition(dragX, dragY);
    cargo.container.setPosition(
      dragX + conveyorBlock.hitPadding,
      dragY + conveyorBlock.hitPadding,
    );
    this.soundFx.drag();
    this.updateDropPreview(cargo, _pointer.x, _pointer.y);
  }

  private handleDragEnd(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) {
    const cargo = this.getCargoForGameObject(gameObject);

    if (!cargo || this.activeDrag !== cargo) {
      return;
    }

    this.activeDrag = undefined;
    this.clearDropPreview();
    this.soundFx.drop();

    cargo.container.setAlpha(1);
    cargo.hitbox.setDepth(5);

    if (this.isPointInsideBay(pointer.x, pointer.y)) {
      const placement = this.findDropPlacement(cargo, pointer.x);

      if (placement) {
        this.removeConveyorCargo(cargo);
        this.dropCargoIntoBay(
          cargo.definition,
          cargo.cellTextureVariants,
          placement.column,
          placement.row,
          pointer.y,
        );
        return;
      }
    }

    cargo.container.setDepth(0);
    cargo.hitbox.setPosition(cargo.returnX, cargo.returnY);
    cargo.container.setPosition(
      cargo.returnX + conveyorBlock.hitPadding,
      cargo.returnY + conveyorBlock.hitPadding,
    );
    cargo.isDragging = false;
  }

  private getCargoForGameObject(gameObject: Phaser.GameObjects.GameObject) {
    if (!(gameObject instanceof Phaser.GameObjects.Rectangle)) {
      return undefined;
    }

    return this.cargoByHitbox.get(gameObject);
  }

  private isPointInsideBay(x: number, y: number) {
    return (
      x >= bay.x &&
      x <= bay.x + bay.columns * bay.cell &&
      y >= bay.y &&
      y <= bay.y + bay.rows * bay.cell
    );
  }

  private updateDropPreview(cargo: ConveyorCargo, pointerX: number, pointerY: number) {
    this.clearDropPreview();

    if (!this.isPointInsideBay(pointerX, pointerY)) {
      return;
    }

    const placement = this.findDropPlacement(cargo, pointerX);

    if (!placement) {
      return;
    }

    const previewColumns = [
      ...new Set(cargo.definition.cells.map(([cellX]) => placement.column + cellX)),
    ];

    for (const column of previewColumns) {
      const columnPreview = this.add
        .rectangle(
          bay.x + column * bay.cell,
          bay.y,
          bay.cell,
          bay.rows * bay.cell,
          palette.previewColumn,
          0.14,
        )
        .setOrigin(0)
        .setStrokeStyle(2, palette.previewColumn, 0.55)
        .setDepth(6);

      this.dropColumnPreview.push(columnPreview);
    }

    for (const [cellX, cellY] of cargo.definition.cells) {
      const preview = this.add
        .rectangle(
          bay.x + (placement.column + cellX) * bay.cell + bay.cell / 2,
          bay.y + (placement.row + cellY) * bay.cell + bay.cell / 2,
          bay.cell - 4,
          bay.cell - 4,
          palette.previewCell,
          0.42,
        )
        .setStrokeStyle(2, 0xf1f1e6, 0.85)
        .setDepth(8);

      this.dropPreview.push(preview);
    }
  }

  private clearDropPreview() {
    for (const preview of this.dropPreview) {
      preview.destroy();
    }

    for (const preview of this.dropColumnPreview) {
      preview.destroy();
    }

    this.dropPreview = [];
    this.dropColumnPreview = [];
  }

  private findDropPlacement(cargo: ConveyorCargo, pointerX: number) {
    const { definition } = cargo;
    const shapeWidth = this.getShapeCellWidth(definition);
    const grabbedColumn = Math.floor((pointerX - bay.x) / bay.cell);
    const anchoredColumn = grabbedColumn - cargo.grabCellOffsetX;
    const column = Phaser.Math.Clamp(anchoredColumn, 0, bay.columns - shapeWidth);

    if (!this.canPlaceShape(definition, column, 0)) {
      return null;
    }

    let row = 0;
    while (this.canPlaceShape(definition, column, row + 1)) {
      row += 1;
    }

    return { column, row };
  }

  private canPlaceShape(definition: ShapeDefinition, column: number, row: number) {
    for (const [cellX, cellY] of definition.cells) {
      const gridX = column + cellX;
      const gridY = row + cellY;

      if (
        gridX < 0 ||
        gridX >= bay.columns ||
        gridY < 0 ||
        gridY >= bay.rows ||
        this.pendingGridCells.has(this.gridCellPendingKey(gridX, gridY)) ||
        this.cargoGrid[gridY][gridX] !== null
      ) {
        return false;
      }
    }

    return true;
  }

  private dropCargoIntoBay(
    definition: ShapeDefinition,
    cellTextureVariants: number[],
    column: number,
    landingRow: number,
    pointerY: number,
  ) {
    for (const [cellX, cellY] of definition.cells) {
      this.pendingGridCells.add(
        this.gridCellPendingKey(column + cellX, landingRow + cellY),
      );
    }

    const scoreValue = this.getScoreValue(definition);

    const releaseRow = Math.floor((pointerY - bay.y) / bay.cell);
    const startRow = Phaser.Math.Clamp(releaseRow, 0, landingRow);
    const container = this.createShapeContainer(
      definition,
      bay.x + column * bay.cell + 1,
      bay.y + startRow * bay.cell + 1,
      bayBlock.size,
      bayBlock.step,
      "bay",
      cellTextureVariants,
    );
    container.setDepth(10);

    const landingY = bay.y + landingRow * bay.cell + 1;
    const dropDuration = Math.max(160, landingRow * 42);
    const stopFallSound = this.soundFx.fall(dropDuration);
    this.tweens.add({
      targets: container,
      y: landingY,
      duration: dropDuration,
      ease: "Quad.easeIn",
      onComplete: () => {
        stopFallSound();
        this.soundFx.land();
        container.setDepth(4);
        for (const [cellX, cellY] of definition.cells) {
          this.pendingGridCells.delete(
            this.gridCellPendingKey(column + cellX, landingRow + cellY),
          );
        }
        this.reserveGridCells(definition, column, landingRow);
        const scoreBonuses = this.collectScoreBonuses(definition, column, landingRow);
        this.awardScore(
          scoreValue,
          definition,
          column,
          landingRow,
          scoreBonuses,
        );
      },
    });
  }

  private reserveGridCells(
    definition: ShapeDefinition,
    column: number,
    row: number,
  ) {
    for (const [index, [cellX, cellY]] of definition.cells.entries()) {
      this.cargoGrid[row + cellY][column + cellX] = {
        color: definition.color,
        isHot: definition.hotCellMask?.[index] === true,
      };
    }
  }

  private awardScore(
    value: number,
    definition: ShapeDefinition,
    column: number,
    row: number,
    bonuses: ScoreBonus[],
  ) {
    const bonusValue = bonuses.reduce((total, bonus) => total + bonus.value, 0);

    this.score += value + bonusValue;
    this.updateScoreText();

    if (value !== 0) {
      this.showScorePop(value, definition, column, row);
    }

    if (value > 0) {
      this.soundFx.score();
    }

    for (const bonus of bonuses) {
      this.showBonusPop(bonus);
    }

    if (this.hasTopRowCargo()) {
      this.endGame("overflow");
    }
  }

  private showScorePop(
    value: number,
    definition: ShapeDefinition,
    column: number,
    row: number,
  ) {
    const bounds = this.getShapeCellBounds(definition);
    const x = bay.x + (column + bounds.centerX) * bay.cell;
    const y = bay.y + (row + bounds.centerY) * bay.cell;
    const pop = this.add
      .text(x, y, this.formatScoreDelta(value), {
        align: "center",
        color: `#${definition.color.toString(16).padStart(6, "0")}`,
        fontFamily: "monospace",
        fontSize: "34px",
        stroke: "#050505",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setResolution(2);

    this.tweens.add({
      targets: pop,
      alpha: 0,
      scale: 1.45,
      y: y - 30,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => {
        pop.destroy();
      },
    });
  }

  private showBonusPop(bonus: ScoreBonus) {
    if (bonus.label === "3X3") {
      this.soundFx.socketBonus();
    } else {
      this.soundFx.bonus();
    }

    const pop = this.add
      .text(bonus.x, bonus.y, `+${bonus.value} ${bonus.label}`, {
        align: "center",
        color: `#${bonus.color.toString(16).padStart(6, "0")}`,
        fontFamily: "monospace",
        fontSize: "24px",
        stroke: "#050505",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setResolution(2);

    this.tweens.add({
      targets: pop,
      alpha: 0,
      scale: 1.32,
      y: bonus.y - 36,
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => {
        pop.destroy();
      },
    });
  }

  private getShapeCellBounds(definition: ShapeDefinition) {
    const maxX = Math.max(...definition.cells.map(([cellX]) => cellX));
    const maxY = Math.max(...definition.cells.map(([, cellY]) => cellY));

    return {
      centerX: (maxX + 1) / 2,
      centerY: (maxY + 1) / 2,
    };
  }

  private collectScoreBonuses(
    definition: ShapeDefinition,
    column: number,
    row: number,
  ) {
    return [
      ...this.collectSameColorTileBonuses(definition, column, row),
      ...this.collectFullRowBonuses(),
    ];
  }

  private collectSameColorTileBonuses(
    definition: ShapeDefinition,
    column: number,
    row: number,
  ) {
    const bonuses: ScoreBonus[] = [];
    const touchedTileKeys = new Set<string>();
    const tileSize = bonusScoring.tileSize;

    for (const [cellX, cellY] of definition.cells) {
      const gridX = column + cellX;
      const gridY = row + cellY;
      const tileColumn = Math.floor(gridX / tileSize) * tileSize;
      const tileRow = Math.floor(gridY / tileSize) * tileSize;
      const tileKey = this.getTileKey(tileColumn, tileRow);

      if (touchedTileKeys.has(tileKey) || this.scoredTileKeys.has(tileKey)) {
        continue;
      }

      touchedTileKeys.add(tileKey);

      const tileColor = this.getSameColorTile(tileColumn, tileRow);

      if (tileColor === null) {
        continue;
      }

      this.scoredTileKeys.add(tileKey);
      bonuses.push({
        label: "3X3",
        value: bonusScoring.sameColorTile,
        color: tileColor,
        x: bay.x + (tileColumn + tileSize / 2) * bay.cell,
        y: bay.y + (tileRow + tileSize / 2) * bay.cell,
      });
    }

    return bonuses;
  }

  private getSameColorTile(tileColumn: number, tileRow: number) {
    const tileSize = bonusScoring.tileSize;

    if (tileColumn + tileSize > bay.columns || tileRow + tileSize > bay.rows) {
      return null;
    }

    const anchorCell = this.cargoGrid[tileRow][tileColumn];

    if (anchorCell === null) {
      return null;
    }

    const tileColor = anchorCell.color;

    for (let rowOffset = 0; rowOffset < tileSize; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < tileSize; columnOffset += 1) {
        const cell = this.cargoGrid[tileRow + rowOffset][tileColumn + columnOffset];
        if (cell === null || cell.color !== tileColor) {
          return null;
        }
      }
    }

    return tileColor;
  }

  private collectFullRowBonuses() {
    const bonuses: ScoreBonus[] = [];
    const newlyCompletedRows = this.cargoGrid
      .map((_, row) => row)
      .filter((row) => !this.scoredRows.has(row) && this.isRowFull(row));

    for (const [index, row] of newlyCompletedRows.entries()) {
      const completedRowCount = this.scoredRows.size + index + 1;
      const value =
        bonusScoring.rowBase + (completedRowCount - 1) * bonusScoring.rowStep;

      bonuses.push({
        label: `ROW ${completedRowCount}`,
        value,
        color: palette.previewCell,
        x: bay.x + (bay.columns * bay.cell) / 2,
        y: bay.y + row * bay.cell + bay.cell / 2,
      });
    }

    for (const row of newlyCompletedRows) {
      this.scoredRows.add(row);
    }

    return bonuses;
  }

  private isRowFull(row: number) {
    return this.cargoGrid[row].every((cell) => cell !== null);
  }

  private getTileKey(tileColumn: number, tileRow: number) {
    return `${tileColumn}:${tileRow}`;
  }

  private getScoreValue(definition: ShapeDefinition) {
    const baseScore = definition.cells.length * 100;
    const isRed = definition.color === palette.hazard;
    const isYellow = definition.color === palette.cargoC;
    const isTeal = definition.color === palette.cargoB;
    const isGrey =
      definition.color === palette.cargoA || definition.color === palette.cargoD;
    const isSmall = definition.cells.length <= 4;
    const isLarge = definition.cells.length >= 5;

    let value: number;

    switch (this.mission.scoringRule) {
      case "red-only":
        value = isRed ? baseScore : 0;
        break;
      case "yellow-penalty":
        value = isYellow ? -baseScore : baseScore;
        break;
      case "yellow-only":
        value = isYellow ? baseScore : 0;
        break;
      case "teal-only":
        value = isTeal ? baseScore : 0;
        break;
      case "grey-only":
        value = isGrey ? baseScore : 0;
        break;
      case "red-penalty":
        value = isRed ? -baseScore : baseScore;
        break;
      case "non-red-only":
        value = isRed ? 0 : baseScore;
        break;
      case "small-double":
        value = isSmall ? baseScore * 2 : baseScore;
        break;
      case "large-double":
        value = isLarge ? baseScore * 2 : baseScore;
        break;
      case "small-penalty":
        value = isSmall ? -baseScore : baseScore;
        break;
      case "half-manifest":
        value = Math.floor(baseScore / 2);
        break;
      case "standard":
        value = baseScore;
        break;
    }

    const mask = definition.hotCellMask;
    const cellCount = definition.cells.length;
    if (!mask || cellCount === 0) {
      return value;
    }

    const weightedSum = mask.reduce(
      (sum, hot) => sum + (hot ? inspector.hotScoreMultiplier : 1),
      0,
    );

    return Math.round((value * weightedSum) / cellCount);
  }

  private hasTopRowCargo() {
    return this.cargoGrid[0].some((cell) => cell !== null);
  }

  private endGame(outcome: "complete" | "overflow" | "caught") {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.activeDrag = undefined;
    this.clearDropPreview();
    this.soundFx.gameOver();
    const previousBest = getTopHighScore(this.mission.dock);
    const isNewBest = !previousBest || this.score > previousBest.score;
    recordHighScore(this.mission.dock, this.score);
    this.updateScoreText();

    for (const cargo of this.conveyorCargo) {
      cargo.isDragging = false;
      cargo.container.setAlpha(0.45);
      cargo.hitbox.disableInteractive();
      cargo.hitbox.setAlpha(0.16);
    }

    const headline =
      outcome === "caught"
        ? "BUSTED"
        : outcome === "overflow"
          ? "BAY FULL"
          : "RUN COMPLETE";
    const subline =
      outcome === "caught"
        ? "HOT MANIFEST DISCOVERED"
        : outcome === "overflow"
          ? "CARGO HIT THE TOP"
          : "TIMER EXPIRED";
    const strokeColor = outcome === "caught" ? palette.hazard : palette.previewCell;

    this.add
      .rectangle(360, 652, 420, 210, 0x050505, 0.86)
      .setStrokeStyle(3, strokeColor, 0.9)
      .setDepth(50);

    this.add
      .text(
        360,
        616,
        [
          headline,
          subline,
          `FINAL SCORE ${this.formatScore(this.score)}`,
          isNewBest
            ? "NEW DOCK RECORD"
            : `DOCK BEST ${this.formatScore(previousBest!.score)}`,
        ].join("\n"),
        {
          align: "center",
          color: "#f1f1e6",
          fontFamily: "monospace",
          fontSize: "24px",
          lineSpacing: 10,
        },
      )
      .setOrigin(0.5)
      .setDepth(51)
      .setResolution(2);

    const homeButton = this.add
      .rectangle(360, 710, 190, 44, palette.panel, 0.95)
      .setStrokeStyle(2, palette.previewCell, 0.9)
      .setDepth(51)
      .setInteractive({ useHandCursor: true });

    const homeLabel = this.add
      .text(360, 710, "HOME", {
        align: "center",
        color: "#f1f1e6",
        fontFamily: "monospace",
        fontSize: "20px",
      })
      .setOrigin(0.5)
      .setDepth(52)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });

    const goHome = () => {
      window.dispatchEvent(new CustomEvent("gridgang:navigate-home"));
    };

    homeButton.on("pointerdown", goHome);
    homeLabel.on("pointerdown", goHome);
  }

  private removeConveyorCargo(cargo: ConveyorCargo) {
    this.conveyorCargo = this.conveyorCargo.filter((item) => item.id !== cargo.id);
    this.cargoByHitbox.delete(cargo.hitbox);
    cargo.hitbox.destroy();
    cargo.container.destroy();
  }

  private getShapeCellWidth(definition: ShapeDefinition) {
    return Math.max(...definition.cells.map(([cellX]) => cellX)) + 1;
  }

  private getShapeCellHeight(definition: ShapeDefinition) {
    return Math.max(...definition.cells.map(([, cellY]) => cellY)) + 1;
  }

  private getGrabCellOffset(
    pointerPosition: number,
    containerPosition: number,
    blockStep: number,
    maxCells: number,
  ) {
    const offset = Math.floor((pointerPosition - containerPosition) / blockStep);

    return Phaser.Math.Clamp(offset, 0, maxCells - 1);
  }

  private drawHud() {
    this.add
      .rectangle(360, 928, 480, 42, 0x050505, 0.42)
      .setStrokeStyle(1, palette.previewCell, 0.48)
      .setDepth(30);

    this.scoreText = this.add
      .text(136, 928, `SCORE ${this.formatScore(this.score)}`, {
        align: "left",
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#f1f1e6",
      })
      .setOrigin(0, 0.5)
      .setDepth(31)
      .setResolution(2);

    this.topScoreText = this.add
      .text(360, 928, this.getTopScoreLabel(), {
        align: "center",
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#c4a15a",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setResolution(2);

    this.timerText = this.add
      .text(584, 928, this.formatTime(this.timeRemainingMs), {
        align: "right",
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#f1f1e6",
      })
      .setOrigin(1, 0.5)
      .setDepth(31)
      .setResolution(2);
  }

  private updateScoreText() {
    this.scoreText?.setText(`SCORE ${this.formatScore(this.score)}`);
    this.topScoreText?.setText(this.getTopScoreLabel());
  }

  private getTopScoreLabel() {
    const topScore = getTopHighScore(this.mission.dock);

    if (!topScore) {
      return this.score === 0 ? "BEST ------" : `BEST ${this.formatScore(this.score)}`;
    }

    return `BEST ${this.formatScore(Math.max(this.score, topScore.score))}`;
  }

  private updateTimerText() {
    this.timerText?.setText(this.formatTime(this.timeRemainingMs));
    this.timerText?.setColor(this.getTimerColor());
  }

  private updateClockTick(previousMilliseconds: number, currentMilliseconds: number) {
    const previousSecond = Math.ceil(previousMilliseconds / 1000);
    const currentSecond = Math.ceil(currentMilliseconds / 1000);

    if (currentSecond >= previousSecond) {
      return;
    }

    for (let second = previousSecond - 1; second >= currentSecond; second -= 1) {
      if (second <= 0) {
        continue;
      }

      if (second <= 10) {
        this.soundFx.clockTick("red");
      } else if (second <= 30) {
        this.soundFx.clockTick("amber");
      } else if (second % 10 === 0) {
        this.soundFx.clockTick("normal");
      }
    }
  }

  private formatTime(milliseconds: number) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  private formatScore(value: number) {
    const sign = value < 0 ? "-" : "";

    return `${sign}${Math.abs(value).toString().padStart(6, "0")}`;
  }

  private formatScoreDelta(value: number) {
    return value > 0 ? `+${value}` : value.toString();
  }

  private getTimerColor() {
    if (this.timeRemainingMs <= 10_000) {
      return "#e35335";
    }

    if (this.timeRemainingMs <= 30_000) {
      return "#c4a15a";
    }

    return "#f1f1e6";
  }
}
