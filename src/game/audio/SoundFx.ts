import * as Phaser from "phaser";

type ClockTickMode = "normal" | "amber" | "red";
type SoundAssetGroup = "conveyor" | "grab" | "drop" | "fall" | "land";

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
};

export class SoundFx {
  private scene: Phaser.Scene;
  private context?: AudioContext;
  private master?: GainNode;
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

    this.ensureContext();

    if (this.context?.state === "suspended") {
      await this.context.resume();
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
    this.playNoise({ duration: 0.035, gain: 0.05, filterFrequency: 1300 });
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
    this.playTone({ frequency: 740, duration: 0.08, gain: 0.12, type: "triangle" });
    window.setTimeout(() => {
      this.playTone({
        frequency: 1080,
        duration: 0.09,
        gain: 0.11,
        type: "triangle",
      });
    }, 55);
  }

  bonus() {
    this.playTone({ frequency: 520, duration: 0.08, gain: 0.12, type: "sine" });
    window.setTimeout(() => {
      this.playTone({ frequency: 780, duration: 0.08, gain: 0.12, type: "sine" });
    }, 60);
    window.setTimeout(() => {
      this.playTone({ frequency: 1160, duration: 0.12, gain: 0.11, type: "sine" });
    }, 120);
  }

  socketBonus() {
    this.playTone({ frequency: 880, duration: 0.12, gain: 0.13, type: "sine" });
    window.setTimeout(() => {
      this.playTone({ frequency: 1320, duration: 0.2, gain: 0.1, type: "sine" });
    }, 90);
  }

  gameOver() {
    this.stopConveyor();
    this.playNoise({ duration: 0.32, gain: 0.26, filterFrequency: 240 });
    this.playTone({
      frequency: 180,
      endFrequency: 54,
      duration: 0.55,
      gain: 0.24,
      type: "sawtooth",
    });
  }

  clockTick(mode: ClockTickMode) {
    if (mode === "normal") {
      this.playTone({ frequency: 520, duration: 0.045, gain: 0.08, type: "square" });
      return;
    }

    if (mode === "amber") {
      this.playTone({ frequency: 680, duration: 0.055, gain: 0.11, type: "square" });
      return;
    }

    this.playTone({
      frequency: 190,
      endFrequency: 150,
      duration: 0.09,
      gain: 0.16,
      type: "sawtooth",
    });
  }

  destroy() {
    this.isDestroyed = true;
    this.stopConveyor();

    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }

    this.context = undefined;
    this.master = undefined;
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

  private playTone({
    frequency,
    endFrequency,
    duration,
    gain,
    type,
  }: {
    frequency: number;
    endFrequency?: number;
    duration: number;
    gain: number;
    type: OscillatorType;
  }) {
    this.ensureContext();

    if (!this.context || !this.master) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        now + duration,
      );
    }

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private playNoise({
    duration,
    gain,
    filterFrequency,
  }: {
    duration: number;
    gain: number;
    filterFrequency: number;
  }) {
    this.ensureContext();

    if (!this.context || !this.master) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;

    source.buffer = this.createNoiseBuffer(duration);
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.9;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  private createNoiseBuffer(duration: number) {
    this.ensureContext();

    if (!this.context) {
      throw new Error("AudioContext is not available.");
    }

    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private ensureContext() {
    if (this.isDestroyed) {
      return;
    }

    if (this.context) {
      return;
    }

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.context.destination);
  }
}
