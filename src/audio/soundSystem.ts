// Web Audio API Synthesizer for high performance sound FX

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private distortionCurve: Float32Array | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  private getDistortionCurve(amount: number = 20): Float32Array {
    if (this.distortionCurve) return this.distortionCurve;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 15 * deg) / (Math.PI + amount * Math.abs(x));
    }
    this.distortionCurve = curve;
    return curve;
  }

  public playGunshot(suppressed: boolean = false) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Micro-pitch randomization (+/- 4%) so rapid shots don't sound repetitive
      const pitchMod = (Math.random() * 0.08 - 0.04);
      const baseFreq = (suppressed ? 110 : 250) * (1 + pitchMod);

      // --- LAYER 1: HEAVY SUB-BASS PUNCH (Chest-Thump 7.62 Caliber Impact) ---
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(baseFreq * 1.6, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

      subGain.gain.setValueAtTime(suppressed ? 0.4 : 1.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + (suppressed ? 0.22 : 0.45));

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.46);

      // --- LAYER 2: METALLIC AK-47 RECEIVER & BOLT SLAP ---
      const boltOsc = ctx.createOscillator();
      const boltGain = ctx.createGain();
      const boltFilter = ctx.createBiquadFilter();

      boltOsc.type = 'sawtooth';
      boltOsc.frequency.setValueAtTime(720 * (1 + pitchMod), now);
      boltOsc.frequency.exponentialRampToValueAtTime(130, now + 0.05);

      boltFilter.type = 'bandpass';
      boltFilter.frequency.setValueAtTime(suppressed ? 1100 : 2900, now);
      boltFilter.Q.setValueAtTime(2.2, now);

      boltGain.gain.setValueAtTime(suppressed ? 0.18 : 0.75, now);
      boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      boltOsc.connect(boltFilter);
      boltFilter.connect(boltGain);
      boltGain.connect(ctx.destination);
      boltOsc.start(now);
      boltOsc.stop(now + 0.08);

      // --- LAYER 3: HIGH-PRESSURE MUZZLE BLAST WITH WAVE SATURATION ---
      const bufferSize = Math.floor(ctx.sampleRate * 0.55);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = suppressed ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(suppressed ? 850 : 5200, now);
      filter.frequency.exponentialRampToValueAtTime(suppressed ? 160 : 380, now + 0.28);
      filter.Q.setValueAtTime(suppressed ? 0.9 : 2.6, now);

      const distortion = ctx.createWaveShaper();
      distortion.curve = this.getDistortionCurve(suppressed ? 6 : 28);
      distortion.oversample = '2x';

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(suppressed ? 0.3 : 1.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (suppressed ? 0.20 : 0.48));

      noise.connect(filter);
      filter.connect(distortion);
      distortion.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.50);

      // --- LAYER 4: URBAN REVERB TAIL / ECHO DECAY ---
      if (!suppressed) {
        const tailFilter = ctx.createBiquadFilter();
        tailFilter.type = 'lowpass';
        tailFilter.frequency.setValueAtTime(1400, now + 0.04);
        tailFilter.frequency.exponentialRampToValueAtTime(140, now + 0.65);

        const tailGain = ctx.createGain();
        tailGain.gain.setValueAtTime(0.001, now);
        tailGain.gain.setValueAtTime(0.32, now + 0.035);
        tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

        const tailNoise = ctx.createBufferSource();
        tailNoise.buffer = buffer;

        tailNoise.connect(tailFilter);
        tailFilter.connect(tailGain);
        tailGain.connect(ctx.destination);

        tailNoise.start(now + 0.035);
        tailNoise.stop(now + 0.70);
      }
    } catch {
      // Ignore audio errors
    }
  }

  public playADS() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // ignore
    }
  }

  public playFootstep() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  public playImpact() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  public playMagFlick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.10);

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(180, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      subGain.gain.setValueAtTime(0.5, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  public playMagInsert() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // ignore
    }
  }

  public playBoltRack() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.12);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // ignore
    }
  }

  public playEmptyClick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();
