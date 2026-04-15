import * as Phaser from "phaser";
import { SoundFx } from "../audio/SoundFx";
import { defaultMission, type DockMission } from "../missions";

type CargoCell = [number, number];
type CellAssetGroup = "hazard" | "cargo-a" | "cargo-b" | "cargo-c" | "cargo-d";
type CellTextureUsage = "conveyor" | "bay";

type ShapeDefinition = {
  key: string;
  color: number;
  assetGroup: CellAssetGroup;
  cells: CargoCell[];
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
  x: 80,
  y: 32,
  width: 560,
  height: 264,
  rows: [60, 180],
  speed: 42,
  spawnX: 44,
  despawnX: 740,
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
  private cargoGrid: Array<Array<number | null>> = [];
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
  private timerText?: Phaser.GameObjects.Text;

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
      Array<number | null>(bay.columns).fill(null),
    );

    this.drawDockPanel();
    this.drawConveyor();
    this.drawCargoBay();
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
      this.endGame();
      return;
    }

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
      this.spawnConveyorCargo(conveyor.spawnX, this.nextRowIndex);
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
    this.add
      .rectangle(
        conveyor.x,
        conveyor.y,
        conveyor.width,
        conveyor.height,
        palette.panel,
      )
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

  private seedConveyor() {
    const initialCargo = [
      [108, 0],
      [242, 0],
      [376, 0],
      [510, 0],
      [108, 1],
      [242, 1],
      [376, 1],
      [510, 1],
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

    return {
      ...baseDefinition,
      color: style.color,
      assetGroup: style.assetGroup,
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
      if (cargo.isDragging || cargo.container.x < conveyor.despawnX) {
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
    this.reserveGridCells(definition, column, landingRow);
    const scoreValue = this.getScoreValue(definition);
    const scoreBonuses = this.collectScoreBonuses(definition, column, landingRow);

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
    for (const [cellX, cellY] of definition.cells) {
      this.cargoGrid[row + cellY][column + cellX] = definition.color;
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
    this.scoreText?.setText(`SCORE ${this.formatScore(this.score)}`);

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
      this.endGame();
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

    const tileColor = this.cargoGrid[tileRow][tileColumn];

    if (tileColor === null) {
      return null;
    }

    for (let rowOffset = 0; rowOffset < tileSize; rowOffset += 1) {
      for (let columnOffset = 0; columnOffset < tileSize; columnOffset += 1) {
        if (
          this.cargoGrid[tileRow + rowOffset][tileColumn + columnOffset] !==
          tileColor
        ) {
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

    switch (this.mission.scoringRule) {
      case "red-only":
        return isRed ? baseScore : 0;
      case "yellow-penalty":
        return isYellow ? -baseScore : baseScore;
      case "yellow-only":
        return isYellow ? baseScore : 0;
      case "teal-only":
        return isTeal ? baseScore : 0;
      case "grey-only":
        return isGrey ? baseScore : 0;
      case "red-penalty":
        return isRed ? -baseScore : baseScore;
      case "non-red-only":
        return isRed ? 0 : baseScore;
      case "small-double":
        return isSmall ? baseScore * 2 : baseScore;
      case "large-double":
        return isLarge ? baseScore * 2 : baseScore;
      case "small-penalty":
        return isSmall ? -baseScore : baseScore;
      case "half-manifest":
        return Math.floor(baseScore / 2);
      case "standard":
        return baseScore;
    }
  }

  private hasTopRowCargo() {
    return this.cargoGrid[0].some((cell) => cell !== null);
  }

  private endGame() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.activeDrag = undefined;
    this.clearDropPreview();
    this.soundFx.gameOver();

    for (const cargo of this.conveyorCargo) {
      cargo.isDragging = false;
      cargo.container.setAlpha(0.45);
      cargo.hitbox.disableInteractive();
      cargo.hitbox.setAlpha(0.16);
    }

    this.add
      .rectangle(360, 640, 420, 160, 0x050505, 0.86)
      .setStrokeStyle(3, palette.hazard, 0.9)
      .setDepth(50);

    this.add
      .text(
        360,
        618,
        `RUN COMPLETE\nFINAL SCORE ${this.formatScore(this.score)}`,
        {
          align: "center",
          color: "#f1f1e6",
          fontFamily: "monospace",
          fontSize: "26px",
          lineSpacing: 12,
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
