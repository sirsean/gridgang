import * as Phaser from "phaser";

type CargoCell = [number, number];

type ShapeDefinition = {
  key: string;
  color: number;
  cells: CargoCell[];
};

type ConveyorCargo = {
  id: number;
  definition: ShapeDefinition;
  container: Phaser.GameObjects.Container;
  hitbox: Phaser.GameObjects.Rectangle;
  row: number;
  isDragging: boolean;
  returnX: number;
  returnY: number;
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

const shapeDefinitions: ShapeDefinition[] = [
  {
    key: "long-hook",
    color: palette.cargoA,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  {
    key: "tall-hook",
    color: palette.cargoB,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    key: "t-block",
    color: palette.cargoC,
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  {
    key: "corner",
    color: palette.cargoD,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  {
    key: "peak",
    color: palette.cargoB,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
  },
  {
    key: "riser",
    color: palette.cargoC,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    key: "jag",
    color: palette.cargoA,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  },
  {
    key: "drop-hook",
    color: palette.hazard,
    cells: [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
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
  private isGameOver = false;
  private dropPreview: Phaser.GameObjects.Rectangle[] = [];
  private dropColumnPreview: Phaser.GameObjects.Rectangle[] = [];
  private scoreText?: Phaser.GameObjects.Text;

  constructor() {
    super("boot");
  }

  create() {
    this.cameras.main.setBackgroundColor(palette.background);
    this.cargoGrid = Array.from({ length: bay.rows }, () =>
      Array<number | null>(bay.columns).fill(null),
    );

    this.drawDockPanel();
    this.drawConveyor();
    this.drawCargoBay();
    this.seedConveyor();
    this.drawHud();

    this.input.on("dragstart", this.handleDragStart, this);
    this.input.on("drag", this.handleDrag, this);
    this.input.on("dragend", this.handleDragEnd, this);
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) {
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

    const definition = shapeDefinitions[this.nextShapeIndex];
    this.nextShapeIndex = (this.nextShapeIndex + 1) % shapeDefinitions.length;

    const container = this.createShapeContainer(
      definition,
      x,
      conveyor.rows[row],
      conveyorBlock.size,
      conveyorBlock.step,
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
      row,
      isDragging: false,
      returnX: hitbox.x,
      returnY: hitbox.y,
    };
    this.nextCargoId += 1;

    this.conveyorCargo.push(cargo);
    this.cargoByHitbox.set(hitbox, cargo);
  }

  private createShapeContainer(
    definition: ShapeDefinition,
    x: number,
    y: number,
    blockSize: number,
    blockStep: number,
  ) {
    const bounds = this.getShapePixelBounds(definition, blockSize, blockStep);
    const container = this.add.container(x, y);

    for (const [cellX, cellY] of definition.cells) {
      container.add(
        this.add
          .rectangle(
            cellX * blockStep,
            cellY * blockStep,
            blockSize,
            blockSize,
            definition.color,
            0.95,
          )
          .setOrigin(0)
          .setStrokeStyle(2, 0x050505, 0.9),
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
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) {
    const cargo = this.getCargoForGameObject(gameObject);

    if (this.isGameOver || !cargo || this.activeDrag) {
      return;
    }

    cargo.isDragging = true;
    cargo.returnX = cargo.hitbox.x;
    cargo.returnY = cargo.hitbox.y;
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

    cargo.container.setAlpha(1);
    cargo.hitbox.setDepth(5);

    if (this.isPointInsideBay(pointer.x, pointer.y)) {
      const placement = this.findDropPlacement(cargo.definition, pointer.x);

      if (placement) {
        this.removeConveyorCargo(cargo);
        this.dropCargoIntoBay(
          cargo.definition,
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

    const placement = this.findDropPlacement(cargo.definition, pointerX);

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

  private findDropPlacement(definition: ShapeDefinition, pointerX: number) {
    const shapeWidth = this.getShapeCellWidth(definition);
    const centeredColumn = Math.floor((pointerX - bay.x) / bay.cell - shapeWidth / 2);
    const column = Phaser.Math.Clamp(centeredColumn, 0, bay.columns - shapeWidth);

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
    column: number,
    landingRow: number,
    pointerY: number,
  ) {
    this.reserveGridCells(definition, column, landingRow);

    const releaseRow = Math.floor((pointerY - bay.y) / bay.cell);
    const startRow = Phaser.Math.Clamp(releaseRow, 0, landingRow);
    const container = this.createShapeContainer(
      definition,
      bay.x + column * bay.cell + 1,
      bay.y + startRow * bay.cell + 1,
      bayBlock.size,
      bayBlock.step,
    );
    container.setDepth(10);

    const landingY = bay.y + landingRow * bay.cell + 1;
    this.tweens.add({
      targets: container,
      y: landingY,
      duration: Math.max(160, landingRow * 42),
      ease: "Quad.easeIn",
      onComplete: () => {
        container.setDepth(4);
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

    this.score += definition.cells.length * 100;
    this.scoreText?.setText(`SCORE ${this.score.toString().padStart(6, "0")}`);

    if (this.hasTopRowCargo()) {
      this.endGame();
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
        640,
        `RUN COMPLETE\nFINAL SCORE ${this.score.toString().padStart(6, "0")}`,
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

  private drawHud() {
    this.add
      .rectangle(360, 928, 480, 42, 0x050505, 0.42)
      .setStrokeStyle(1, palette.previewCell, 0.48)
      .setDepth(30);

    this.scoreText = this.add
      .text(360, 928, "SCORE 000000", {
        align: "center",
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#f1f1e6",
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setResolution(2);
  }
}
