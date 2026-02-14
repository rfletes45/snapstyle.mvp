import type { ZoneId } from "../../game/types";

export type SoundEventId =
  | "ui_click"
  | "cast"
  | "bite"
  | "progress_tick"
  | "catch"
  | "fail"
  | "purchase"
  | "sell"
  | "pickup"
  | "gate_unlock"
  | "rarity_stinger";

interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

const AMBIENCE_FREQ: Record<ZoneId, [number, number]> = {
  beach: [174, 220],
  river: [146, 196],
  cave: [98, 130],
  volcano: [110, 146],
  oasis: [196, 262],
};

const OPTIONAL_AUDIO_FILES: Partial<Record<SoundEventId, string>> = {
  // Place optional files under /public/audio/sfx and keep names below to override synth:
  // cast: "sfx/cast.wav",
  // bite: "sfx/bite.wav",
  // catch: "sfx/catch.wav",
  // sell: "sfx/sell.wav",
};

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeSfx = 0;
  private readonly maxSimultaneousSfx = 6;
  private ambienceNodes: OscillatorNode[] = [];
  private assetBasePath = "/audio/";

  private settings: AudioSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    musicVolume: 0.55,
    muted: false,
  };

  async unlockByGesture(): Promise<boolean> {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.masterGain = this.context.createGain();
        this.sfxGain = this.context.createGain();
        this.musicGain = this.context.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.applySettings(this.settings);
      } catch {
        return false;
      }
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return true;
  }

  setAssetBasePath(path: string): void {
    this.assetBasePath = path.endsWith("/") ? path : `${path}/`;
  }

  applySettings(settings: AudioSettings): void {
    this.settings = {
      masterVolume: clamp01(settings.masterVolume),
      sfxVolume: clamp01(settings.sfxVolume),
      musicVolume: clamp01(settings.musicVolume),
      muted: Boolean(settings.muted),
    };

    if (!this.context || !this.masterGain || !this.sfxGain || !this.musicGain) {
      return;
    }

    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(
      this.settings.muted ? 0 : this.settings.masterVolume,
      now,
      0.02,
    );
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume * 0.24, now, 0.08);
  }

  setZoneAmbience(zoneId: ZoneId): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    this.clearAmbience();

    const [f1, f2] = AMBIENCE_FREQ[zoneId];
    const oscA = this.context.createOscillator();
    const oscB = this.context.createOscillator();
    const gainA = this.context.createGain();
    const gainB = this.context.createGain();

    oscA.type = zoneId === "volcano" ? "sawtooth" : "sine";
    oscB.type = zoneId === "cave" ? "triangle" : "sine";
    oscA.frequency.value = f1;
    oscB.frequency.value = f2;
    gainA.gain.value = zoneId === "cave" ? 0.026 : 0.03;
    gainB.gain.value = zoneId === "oasis" ? 0.024 : 0.02;

    oscA.connect(gainA);
    oscB.connect(gainB);
    gainA.connect(this.musicGain);
    gainB.connect(this.musicGain);

    oscA.start();
    oscB.start();
    this.ambienceNodes = [oscA, oscB];
  }

  playSfx(id: SoundEventId): void {
    if (!this.context || !this.sfxGain || this.settings.muted) {
      return;
    }
    if (this.activeSfx >= this.maxSimultaneousSfx) {
      return;
    }

    if (this.tryPlayOptionalFile(id)) {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const params = describeSound(id);

    this.activeSfx += 1;
    osc.type = params.type;
    osc.frequency.setValueAtTime(params.startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, params.endFreq),
      now + params.duration,
    );

    filter.type = "lowpass";
    filter.frequency.value = params.filter;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(params.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + params.duration);

    osc.start(now);
    osc.stop(now + params.duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
  }

  dispose(): void {
    this.clearAmbience();
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    if (this.sfxGain) {
      this.sfxGain.disconnect();
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }

  private tryPlayOptionalFile(id: SoundEventId): boolean {
    const file = OPTIONAL_AUDIO_FILES[id];
    if (!file) {
      return false;
    }
    this.activeSfx += 1;
    const audio = new Audio(`${this.assetBasePath}${file}`);
    audio.volume = clamp01(this.settings.sfxVolume * 0.7);
    void audio.play().catch(() => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    });
    audio.onended = () => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
    audio.onerror = () => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
    return true;
  }

  private clearAmbience(): void {
    for (const osc of this.ambienceNodes) {
      try {
        osc.stop();
      } catch {
        // no-op
      }
      osc.disconnect();
    }
    this.ambienceNodes = [];
  }
}

function describeSound(id: SoundEventId): {
  type: OscillatorType;
  startFreq: number;
  endFreq: number;
  duration: number;
  gain: number;
  filter: number;
} {
  switch (id) {
    case "ui_click":
      return {
        type: "triangle",
        startFreq: 520,
        endFreq: 460,
        duration: 0.08,
        gain: 0.08,
        filter: 4200,
      };
    case "cast":
      return {
        type: "sine",
        startFreq: 240,
        endFreq: 120,
        duration: 0.22,
        gain: 0.1,
        filter: 3200,
      };
    case "bite":
      return {
        type: "square",
        startFreq: 780,
        endFreq: 420,
        duration: 0.18,
        gain: 0.12,
        filter: 3600,
      };
    case "progress_tick":
      return {
        type: "sine",
        startFreq: 620,
        endFreq: 570,
        duration: 0.06,
        gain: 0.04,
        filter: 5000,
      };
    case "catch":
      return {
        type: "triangle",
        startFreq: 460,
        endFreq: 920,
        duration: 0.26,
        gain: 0.12,
        filter: 5200,
      };
    case "fail":
      return {
        type: "sawtooth",
        startFreq: 320,
        endFreq: 120,
        duration: 0.28,
        gain: 0.09,
        filter: 1800,
      };
    case "purchase":
      return {
        type: "triangle",
        startFreq: 520,
        endFreq: 780,
        duration: 0.16,
        gain: 0.1,
        filter: 4600,
      };
    case "sell":
      return {
        type: "triangle",
        startFreq: 360,
        endFreq: 700,
        duration: 0.14,
        gain: 0.09,
        filter: 4200,
      };
    case "pickup":
      return {
        type: "sine",
        startFreq: 640,
        endFreq: 980,
        duration: 0.24,
        gain: 0.12,
        filter: 6000,
      };
    case "gate_unlock":
      return {
        type: "triangle",
        startFreq: 420,
        endFreq: 1120,
        duration: 0.4,
        gain: 0.14,
        filter: 5400,
      };
    case "rarity_stinger":
      return {
        type: "sine",
        startFreq: 680,
        endFreq: 1440,
        duration: 0.42,
        gain: 0.16,
        filter: 7000,
      };
    default:
      return {
        type: "sine",
        startFreq: 400,
        endFreq: 400,
        duration: 0.1,
        gain: 0.08,
        filter: 3000,
      };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
