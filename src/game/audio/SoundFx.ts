import * as Phaser from "phaser";

type ClockTickMode = "normal" | "amber" | "red";
type SoundAssetGroup =
  | "conveyor"
  | "grab"
  | "drop"
  | "fall"
  | "land"
  | "drag"
  | "score"
  | "bonus"
  | "socketBonus"
  | "gameOver"
  | "clockNormal"
  | "clockAmber"
  | "clockRed";

const audioPath = "/assets/audio/sfx";
const soundAssets: Record<
  SoundAssetGroup,
  { prefix: string; variants: number; volume: number }
> = {
  conveyor: { prefix: "conveyor-creak-loop", variants: 3, volume: 0.22 },
  grab: { prefix: "container-grab", variants: 4, volume: 0.5 },
  drop: { prefix: "container-drop", variants: 4, volume: 0.38 },
  fall: { prefix: "container-whoosh", variants: 4, volume: 0.34 },
  land: { prefix: "container-land", variants: 5, volume: 0.58 },
  drag: { prefix: "container-drag-scrape", variants: 3, volume: 0.22 },
  score: { prefix: "ui-score-chime", variants: 3, volume: 0.42 },
  bonus: { prefix: "ui-bonus-chime", variants: 3, volume: 0.42 },
  socketBonus: { prefix: "ui-socket-bonus", variants: 3, volume: 0.44 },
  gameOver: { prefix: "ui-game-over", variants: 3, volume: 0.52 },
  clockNormal: { prefix: "clock-tick-normal", variants: 3, volume: 0.26 },
  clockAmber: { prefix: "clock-tick-amber", variants: 3, volume: 0.3 },
  clockRed: { prefix: "clock-tick-red", variants: 3, volume: 0.34 },
};

export class SoundFx {
  private scene: Phaser.Scene;
  private conveyorSound?: Phaser.Sound.BaseSound;
  private conveyorEnabled = false;
  private isDestroyed = false;
  private lastDragSoundAt = 0;

  static preload(scene: Phaser.Scene) {
    for (const spec of Object.values(soundAssets)) {
      for (let variant = 1; variant <= spec.variants; variant += 1) {
        const variantId = variant.toString().padStart(2, "0");
        const key = SoundFx.getAssetKey(spec.prefix, variant);
        scene.load.audio(key, `${audioPath}/${spec.prefix}-${variantId}.mp3`);
      }
    }
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  async resume() {
    if (this.isDestroyed) {
      return;
    }

    this.scene.sound.unlock();

    if (
      "context" in this.scene.sound &&
      this.scene.sound.context &&
      this.scene.sound.context.state === "suspended"
    ) {
      await this.scene.sound.context.resume();
    }

    if (this.conveyorEnabled) {
      this.startConveyorLoop();
    }
  }

  startConveyor() {
    this.conveyorEnabled = true;
    this.startConveyorLoop();
  }

  stopConveyor() {
    this.conveyorEnabled = false;

    if (this.conveyorSound) {
      this.conveyorSound.stop();
      this.conveyorSound.destroy();
      this.conveyorSound = undefined;
    }
  }

  grab() {
    this.resume();
    this.playVariant("grab", {
      detune: this.randomDetune(70),
      rate: this.randomRate(0.94, 1.08),
    });
  }

  drag() {
    const now = performance.now();

    if (now - this.lastDragSoundAt < 130) {
      return;
    }

    this.lastDragSoundAt = now;
    this.playVariant("drag", {
      detune: this.randomDetune(50),
      rate: this.randomRate(0.92, 1.12),
    });
  }

  drop() {
    this.playVariant("drop", {
      detune: this.randomDetune(60),
      rate: this.randomRate(0.96, 1.08),
    });
  }

  fall(durationMs: number) {
    if (this.isDestroyed) {
      return () => undefined;
    }

    const desiredSeconds = Math.max(0.22, durationMs / 1000);
    const key = this.getRandomAssetKey("fall");
    const sound = this.scene.sound.add(key, {
      volume: this.randomVolume(soundAssets.fall.volume, 0.08),
      rate: Phaser.Math.Clamp(0.9 / desiredSeconds, 0.85, 2.2),
      detune: this.randomDetune(45),
    });

    sound.play();

    return () => {
      if (!sound.pendingRemove) {
        sound.stop();
        sound.destroy();
      }
    };
  }

  land() {
    this.playVariant("land", {
      detune: this.randomDetune(55),
      rate: this.randomRate(0.94, 1.04),
    });
  }

  score() {
    this.playVariant("score", {
      detune: this.randomDetune(40),
      rate: this.randomRate(0.96, 1.06),
    });
  }

  bonus() {
    this.playVariant("bonus", {
      detune: this.randomDetune(40),
      rate: this.randomRate(0.96, 1.06),
    });
  }

  socketBonus() {
    this.playVariant("socketBonus", {
      detune: this.randomDetune(35),
      rate: this.randomRate(0.97, 1.05),
    });
  }

  gameOver() {
    this.stopConveyor();
    this.playVariant("gameOver", {
      detune: this.randomDetune(30),
      rate: this.randomRate(0.95, 1.04),
    });
  }

  clockTick(mode: ClockTickMode) {
    if (mode === "normal") {
      this.playVariant("clockNormal", {
        detune: this.randomDetune(35),
        rate: this.randomRate(0.97, 1.03),
      });
      return;
    }

    if (mode === "amber") {
      this.playVariant("clockAmber", {
        detune: this.randomDetune(40),
        rate: this.randomRate(0.96, 1.04),
      });
      return;
    }

    this.playVariant("clockRed", {
      detune: this.randomDetune(45),
      rate: this.randomRate(0.95, 1.05),
    });
  }

  destroy() {
    this.isDestroyed = true;
    this.stopConveyor();
  }

  private startConveyorLoop() {
    if (this.conveyorSound?.isPlaying) {
      return;
    }

    if (!this.conveyorSound) {
      this.conveyorSound = this.scene.sound.add(this.getRandomAssetKey("conveyor"), {
        loop: true,
        volume: soundAssets.conveyor.volume,
        rate: this.randomRate(0.96, 1.03),
        detune: this.randomDetune(25),
      });
    }

    this.conveyorSound.play();
  }

  private playVariant(
    group: SoundAssetGroup,
    config: Phaser.Types.Sound.SoundConfig = {},
  ) {
    if (this.isDestroyed) {
      return;
    }

    const spec = soundAssets[group];

    this.scene.sound.play(this.getRandomAssetKey(group), {
      volume: this.randomVolume(spec.volume, 0.08),
      ...config,
    });
  }

  private getRandomAssetKey(group: SoundAssetGroup) {
    const spec = soundAssets[group];
    const variant = Phaser.Math.Between(1, spec.variants);

    return SoundFx.getAssetKey(spec.prefix, variant);
  }

  private static getAssetKey(prefix: string, variant: number) {
    return `sfx:${prefix}-${variant.toString().padStart(2, "0")}`;
  }

  private randomVolume(baseVolume: number, spread: number) {
    return Phaser.Math.Clamp(
      baseVolume + Phaser.Math.FloatBetween(-spread, spread),
      0,
      1,
    );
  }

  private randomRate(minimum: number, maximum: number) {
    return Phaser.Math.FloatBetween(minimum, maximum);
  }

  private randomDetune(spread: number) {
    return Phaser.Math.Between(-spread, spread);
  }
}
