type ClockTickMode = "normal" | "amber" | "red";

export class SoundFx {
  private context?: AudioContext;
  private master?: GainNode;
  private conveyorTimer?: number;
  private conveyorEnabled = false;
  private isDestroyed = false;
  private lastDragSoundAt = 0;

  async resume() {
    if (this.isDestroyed) {
      return;
    }

    this.ensureContext();

    if (this.context?.state === "suspended") {
      await this.context.resume();
    }

    if (this.conveyorEnabled) {
      this.startConveyorTimer();
    }
  }

  startConveyor() {
    this.conveyorEnabled = true;
    this.startConveyorTimer();
  }

  stopConveyor() {
    this.conveyorEnabled = false;

    if (this.conveyorTimer !== undefined) {
      window.clearInterval(this.conveyorTimer);
      this.conveyorTimer = undefined;
    }
  }

  grab() {
    this.resume();
    this.playTone({ frequency: 170, duration: 0.08, gain: 0.18, type: "square" });
    this.playNoise({ duration: 0.06, gain: 0.12, filterFrequency: 900 });
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
    this.playTone({
      frequency: 110,
      endFrequency: 70,
      duration: 0.12,
      gain: 0.14,
      type: "sawtooth",
    });
  }

  fall(durationMs: number) {
    this.ensureContext();

    if (!this.context || !this.master) {
      return () => undefined;
    }

    const context = this.context;
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = Math.max(0.18, durationMs / 1000);

    noise.buffer = this.createNoiseBuffer(duration);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + duration);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + duration);

    return () => {
      try {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.02);
        noise.stop(context.currentTime + 0.04);
      } catch {
        // The source may already be stopped by the scheduled duration.
      }
    };
  }

  land() {
    this.playNoise({ duration: 0.18, gain: 0.28, filterFrequency: 180 });
    this.playTone({
      frequency: 72,
      endFrequency: 48,
      duration: 0.2,
      gain: 0.22,
      type: "triangle",
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

  private startConveyorTimer() {
    if (!this.context || this.conveyorTimer !== undefined) {
      return;
    }

    this.playConveyorCreak();
    this.conveyorTimer = window.setInterval(() => {
      this.playConveyorCreak();
    }, 1450);
  }

  private playConveyorCreak() {
    this.playNoise({ duration: 0.18, gain: 0.055, filterFrequency: 360 });
    this.playTone({
      frequency: 86,
      endFrequency: 118,
      duration: 0.22,
      gain: 0.07,
      type: "sawtooth",
    });
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
