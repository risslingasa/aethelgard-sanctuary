import type { AtmosphereMode } from './types';

// 100% Procedural Web Audio API Ambient Soundscape Engine
// Synthesizes looping wind, flowing turquoise stream/waterfall, distant wind/crystal chimes,
// warm golden-hour tones, and starry aurora night textures with smooth track crossfades.

const SUNSET_CHIME_NOTES = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]; // D major pentatonic
const NIGHT_CHIME_NOTES = [493.88, 587.33, 739.99, 880.0, 1108.73, 1318.51]; // B minor 9 celestial

function createPinkNoiseBuffer(ctx: AudioContext, seconds = 6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * seconds;
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
      data[i] = pink;
    }

    // Seamless loop crossfade over last 0.25s so buffer loops without any click
    const fadeSamples = Math.floor(sampleRate * 0.25);
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const idxEnd = length - fadeSamples + i;
      data[idxEnd] = data[idxEnd] * (1 - t) + data[i] * t;
    }
  }
  return buffer;
}

function createReverbImpulse(ctx: AudioContext, duration = 2.8, decay = 2.6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return impulse;
}

export class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sunsetGain: GainNode | null = null;
  private nightGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private streamFilter: BiquadFilterNode | null = null;

  private mode: AtmosphereMode = 'sunset';
  private enabled = false;
  private chimeTimer: number | null = null;
  private cricketTimer: number | null = null;
  private disposed = false;

  private initContext() {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    // Master output bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    // Spacious sky reverb bus for distant chimes & organic ambience
    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx, 3.0, 2.5);
    const reverbWet = ctx.createGain();
    reverbWet.gain.setValueAtTime(0.42, ctx.currentTime);
    reverb.connect(reverbWet);
    reverbWet.connect(masterGain);
    this.reverbNode = reverb;

    // Dedicated crossfade track buses for Sunset vs Night
    const sunsetGain = ctx.createGain();
    const nightGain = ctx.createGain();
    const isNight = this.mode === 'night';
    sunsetGain.gain.setValueAtTime(isNight ? 0.0 : 1.0, ctx.currentTime);
    nightGain.gain.setValueAtTime(isNight ? 1.0 : 0.0, ctx.currentTime);
    sunsetGain.connect(masterGain);
    nightGain.connect(masterGain);
    this.sunsetGain = sunsetGain;
    this.nightGain = nightGain;

    const noiseBuffer = createPinkNoiseBuffer(ctx, 6);

    // =========================================================================
    // 1. SHARED CONTINUOUS NATURE BED: Highland Wind + Flowing Stream/Waterfall
    // =========================================================================

    // A. Sweeping High-Altitude Wind (soft undulating stereo bandpass noise)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(isNight ? 310 : 420, ctx.currentTime);
    windFilter.Q.setValueAtTime(1.5, ctx.currentTime);
    this.windFilter = windFilter;

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.085, ctx.currentTime);
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(125, ctx.currentTime);
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windLevel = ctx.createGain();
    windLevel.gain.setValueAtTime(0.24, ctx.currentTime);

    windSrc.connect(windFilter);
    windFilter.connect(windLevel);
    windLevel.connect(masterGain);
    windSrc.start();

    // B. Cascading Waterfall Deep Murmur (warm low-pass rumble)
    const waterfallSrc = ctx.createBufferSource();
    waterfallSrc.buffer = noiseBuffer;
    waterfallSrc.loop = true;
    waterfallSrc.loopStart = 1.2;

    const waterfallFilter = ctx.createBiquadFilter();
    waterfallFilter.type = 'lowpass';
    waterfallFilter.frequency.setValueAtTime(340, ctx.currentTime);
    waterfallFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    const waterfallLevel = ctx.createGain();
    waterfallLevel.gain.setValueAtTime(0.26, ctx.currentTime);

    waterfallSrc.connect(waterfallFilter);
    waterfallFilter.connect(waterfallLevel);
    waterfallLevel.connect(masterGain);
    waterfallSrc.start();

    // C. Flowing Turquoise Stream Shimmer (modulated mid-high water trickle)
    const streamSrc = ctx.createBufferSource();
    streamSrc.buffer = noiseBuffer;
    streamSrc.loop = true;
    streamSrc.loopStart = 2.8;

    const streamFilter = ctx.createBiquadFilter();
    streamFilter.type = 'bandpass';
    streamFilter.frequency.setValueAtTime(isNight ? 980 : 1220, ctx.currentTime);
    streamFilter.Q.setValueAtTime(1.15, ctx.currentTime);
    this.streamFilter = streamFilter;

    const streamLfo = ctx.createOscillator();
    streamLfo.type = 'sine';
    streamLfo.frequency.setValueAtTime(0.21, ctx.currentTime);
    const streamLfoGain = ctx.createGain();
    streamLfoGain.gain.setValueAtTime(220, ctx.currentTime);
    streamLfo.connect(streamLfoGain);
    streamLfoGain.connect(streamFilter.frequency);
    streamLfo.start();

    const streamLevel = ctx.createGain();
    streamLevel.gain.setValueAtTime(0.11, ctx.currentTime);

    streamSrc.connect(streamFilter);
    streamFilter.connect(streamLevel);
    streamLevel.connect(masterGain);
    streamSrc.start();

    // =========================================================================
    // 2. SUNSET TRACK: Warm Sunlit Air Pad & Golden Breeze Resonance
    // =========================================================================
    const sunsetPadFilter = ctx.createBiquadFilter();
    sunsetPadFilter.type = 'lowpass';
    sunsetPadFilter.frequency.setValueAtTime(460, ctx.currentTime);
    sunsetPadFilter.connect(sunsetGain);

    // Warm D-major9 sunlit air chord (D3, A3, E4)
    const sunsetFreqs = [146.83, 220.0, 329.63];
    sunsetFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1) * 4.5, ctx.currentTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(idx === 0 ? 0.036 : 0.017, ctx.currentTime);

      osc.connect(g);
      g.connect(sunsetPadFilter);
      osc.start();
    });

    // Subtle sunlit warm air shimmer
    const sunsetBreathLfo = ctx.createOscillator();
    sunsetBreathLfo.type = 'sine';
    sunsetBreathLfo.frequency.setValueAtTime(0.065, ctx.currentTime);
    const sunsetBreathGain = ctx.createGain();
    sunsetBreathGain.gain.setValueAtTime(110, ctx.currentTime);
    sunsetBreathLfo.connect(sunsetBreathGain);
    sunsetBreathGain.connect(sunsetPadFilter.frequency);
    sunsetBreathLfo.start();

    // =========================================================================
    // 3. NIGHT TRACK: Starry Aurora Celestial Pad & Nocturnal Air
    // =========================================================================
    const nightPadFilter = ctx.createBiquadFilter();
    nightPadFilter.type = 'lowpass';
    nightPadFilter.frequency.setValueAtTime(520, ctx.currentTime);
    nightPadFilter.connect(nightGain);

    // Ethereal B-minor9 aurora pad (B2, F#3, C#4, D4)
    const nightFreqs = [123.47, 185.0, 277.18, 293.66];
    nightFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1.5) * 6, ctx.currentTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(idx === 0 ? 0.042 : 0.019, ctx.currentTime);

      osc.connect(g);
      g.connect(nightPadFilter);
      osc.start();
    });

    // Slow aurora sweep modulation
    const auroraLfo = ctx.createOscillator();
    auroraLfo.type = 'sine';
    auroraLfo.frequency.setValueAtTime(0.052, ctx.currentTime);
    const auroraLfoGain = ctx.createGain();
    auroraLfoGain.gain.setValueAtTime(190, ctx.currentTime);
    auroraLfo.connect(auroraLfoGain);
    auroraLfoGain.connect(nightPadFilter.frequency);
    auroraLfo.start();

    // Start organic chime & night cricket schedulers
    this.scheduleNextChime();
    this.scheduleNextNightPulse();
  }

  private scheduleNextChime() {
    if (this.disposed) return;
    const delayMs = 2400 + Math.random() * 3400;
    this.chimeTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (this.enabled && this.ctx && this.ctx.state === 'running') {
        this.triggerDistantChime();
      }
      this.scheduleNextChime();
    }, delayMs);
  }

  private triggerDistantChime() {
    if (!this.ctx || !this.sunsetGain || !this.nightGain || !this.reverbNode) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const isNight = this.mode === 'night';

    const scale = isNight ? NIGHT_CHIME_NOTES : SUNSET_CHIME_NOTES;
    const baseFreq = scale[Math.floor(Math.random() * scale.length)];
    const targetBus = isNight ? this.nightGain : this.sunsetGain;

    // Occasional gentle 2-note wind chime cluster
    const count = Math.random() > 0.62 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const start = now + i * (0.22 + Math.random() * 0.25);
      const freq =
        i === 0
          ? baseFreq
          : scale[Math.floor(Math.random() * scale.length)];

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      osc.type = 'sine';
      overtone.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      // Warm bronze overtone at sunset vs crystalline bell partial at night
      overtone.frequency.setValueAtTime(freq * (isNight ? 2.756 : 2.0), start);

      const env = ctx.createGain();
      const peak = isNight ? 0.034 : 0.038;
      const tail = isNight ? 3.8 : 2.9;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peak, start + 0.045);
      env.gain.exponentialRampToValueAtTime(0.0001, start + tail);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(isNight ? 0.22 : 0.14, start);

      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime((Math.random() - 0.5) * 1.35, start);

      osc.connect(env);
      overtone.connect(overtoneGain);
      overtoneGain.connect(env);
      env.connect(panner);
      panner.connect(targetBus);
      // Send a whisper of the chime into the spacious sky reverb
      const revSend = ctx.createGain();
      revSend.gain.setValueAtTime(0.65, start);
      panner.connect(revSend);
      revSend.connect(this.reverbNode);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + tail + 0.1);
      overtone.stop(start + tail + 0.1);
    }
  }

  private scheduleNextNightPulse() {
    if (this.disposed) return;
    const delayMs = 3000 + Math.random() * 4200;
    this.cricketTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (this.enabled && this.mode === 'night' && this.ctx && this.ctx.state === 'running') {
        this.triggerSoftNightCricket();
      }
      this.scheduleNextNightPulse();
    }, delayMs);
  }

  private triggerSoftNightCricket() {
    if (!this.ctx || !this.nightGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const chirps = 3 + Math.floor(Math.random() * 3);
    const freq = 3950 + Math.random() * 380;

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime((Math.random() - 0.5) * 1.4, now);
    panner.connect(this.nightGain);

    for (let i = 0; i < chirps; i++) {
      const t0 = now + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(0.0065, t0 + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);

      osc.connect(env);
      env.connect(panner);
      osc.start(t0);
      osc.stop(t0 + 0.085);
    }
  }

  public async setEnabled(nextEnabled: boolean): Promise<void> {
    this.enabled = nextEnabled;
    if (nextEnabled) {
      this.initContext();
      if (!this.ctx || !this.masterGain) return;
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.linearRampToValueAtTime(0.75, now + 0.65);
      // Offer a gentle welcoming chime shortly after unmuting
      window.setTimeout(() => {
        if (!this.disposed && this.enabled && this.ctx?.state === 'running') {
          this.triggerDistantChime();
        }
      }, 380);
    } else if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.45);
    }
  }

  public setMode(nextMode: AtmosphereMode): void {
    this.mode = nextMode;
    if (!this.ctx || !this.sunsetGain || !this.nightGain) return;

    const now = this.ctx.currentTime;
    const isNight = nextMode === 'night';
    const fadeSeconds = 1.8;

    // Crossfade smoothly between Sunset and Night tracks
    this.sunsetGain.gain.cancelScheduledValues(now);
    this.sunsetGain.gain.setValueAtTime(this.sunsetGain.gain.value, now);
    this.sunsetGain.gain.linearRampToValueAtTime(isNight ? 0.0 : 1.0, now + fadeSeconds);

    this.nightGain.gain.cancelScheduledValues(now);
    this.nightGain.gain.setValueAtTime(this.nightGain.gain.value, now);
    this.nightGain.gain.linearRampToValueAtTime(isNight ? 1.0 : 0.0, now + fadeSeconds);

    // Subtly shift wind & stream timbre between sunlit openness and hushed night resonance
    if (this.windFilter) {
      this.windFilter.frequency.cancelScheduledValues(now);
      this.windFilter.frequency.setTargetAtTime(isNight ? 310 : 420, now, 0.7);
    }
    if (this.streamFilter) {
      this.streamFilter.frequency.cancelScheduledValues(now);
      this.streamFilter.frequency.setTargetAtTime(isNight ? 980 : 1220, now, 0.7);
    }

    // Play a subtle transition chime reflecting the newly entered atmosphere
    if (this.enabled && this.ctx.state === 'running') {
      window.setTimeout(() => {
        if (!this.disposed && this.enabled) {
          this.triggerDistantChime();
        }
      }, 520);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.enabled = false;
    if (this.chimeTimer !== null) {
      window.clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }
    if (this.cricketTimer !== null) {
      window.clearTimeout(this.cricketTimer);
      this.cricketTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
