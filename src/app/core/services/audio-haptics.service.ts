import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioHapticsService {
  readonly soundEnabled = signal<boolean>(true);
  readonly musicEnabled = signal<boolean>(false);
  readonly hapticsEnabled = signal<boolean>(true);
  readonly hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  private audioCtx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Music scheduler state
  private musicIntervalId: ReturnType<typeof setInterval> | null = null;
  private nextChordTime = 0;
  private currentChordIndex = 0;

  // Meditative ambient chord progression: Cmaj9 -> Am11 -> Fmaj7#11 -> Gsus4
  private readonly chords: number[][] = [
    // Cmaj9: C3, G3, B3, D4, E4
    [130.81, 196.00, 246.94, 293.66, 329.63],
    // Am11: A2, E3, G3, C4, D4
    [110.00, 164.81, 196.00, 261.63, 293.66],
    // Fmaj7: F2, C3, E3, A3, C4
    [87.31, 130.81, 164.81, 220.00, 261.63],
    // G6/9: G2, D3, G3, B3, E4
    [98.00, 146.83, 196.00, 246.94, 329.63]
  ];

  // Shimmer arpeggio notes for puzzle ambience
  private readonly shimmerNotes = [523.25, 587.33, 659.25, 783.99, 987.77, 1046.50];

  constructor() {
    // Load preferences from storage
    if (typeof localStorage !== 'undefined') {
      const savedSound = localStorage.getItem('queens_sound');
      if (savedSound !== null) {
        this.soundEnabled.set(savedSound === 'true');
      }
      const savedMusic = localStorage.getItem('queens_music');
      if (savedMusic !== null) {
        this.musicEnabled.set(savedMusic === 'true');
      }
      const savedHaptics = localStorage.getItem('queens_haptics');
      if (savedHaptics !== null) {
        this.hapticsEnabled.set(savedHaptics === 'true');
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', () => this.unlock(), { capture: true });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.audioCtx?.state === 'suspended') {
          void this.audioCtx.resume();
        }
      });
    }
  }

  /** Creates and resumes the audio context inside the user's tap. Mobile browsers stay silent otherwise. */
  unlock(): void {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';

    const ctx = this.initAudio();
    if (!ctx) return;

    if (ctx.state !== 'running') {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      try {
        source.start(0);
      } catch {
        // The context can reject a start while it is still suspended; resume() below finishes the unlock.
      }
      void ctx.resume();
    }

    if (this.musicEnabled() && !this.musicIntervalId) this.startAmbientMusic();
  }

  toggleSound(): boolean {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    localStorage.setItem('queens_sound', String(next));
    this.unlock();
    if (next) this.playMarkX();
    return next;
  }

  toggleMusic(): boolean {
    const next = !this.musicEnabled();
    this.musicEnabled.set(next);
    localStorage.setItem('queens_music', String(next));

    if (next) {
      this.unlock();
    } else {
      this.stopAmbientMusic();
    }
    return next;
  }

  toggleHaptics(): boolean {
    if (!this.hapticsSupported) return this.hapticsEnabled();
    const next = !this.hapticsEnabled();
    this.hapticsEnabled.set(next);
    localStorage.setItem('queens_haptics', String(next));
    this.unlock();
    if (next) this.vibrate(25);
    return next;
  }

  private initAudio(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();

        // Create master SFX gain
        this.sfxGain = this.audioCtx.createGain();
        this.sfxGain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);
        this.sfxGain.connect(this.audioCtx.destination);

        // Create master Music gain with subtle ambient volume
        this.musicGain = this.audioCtx.createGain();
        this.musicGain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
        this.musicGain.connect(this.audioCtx.destination);
      }

      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }

      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /** Runs a sound effect once the context is actually running, so notes are not scheduled on a frozen clock. */
  private withSfx(play: (ctx: AudioContext) => void): void {
    if (!this.soundEnabled()) return;
    const ctx = this.initAudio();
    if (!ctx || !this.sfxGain) return;
    const run = () => {
      if (ctx.state !== 'running') return;
      play(ctx);
    };
    if (ctx.state === 'running') run();
    else void ctx.resume().then(run);
  }

  // ==========================================
  // PROCEDURAL AMBIENT GAME SOUNDTRACK
  // ==========================================

  private startAmbientMusic(): void {
    const ctx = this.initAudio();
    if (!ctx || !this.musicGain) return;

    if (this.musicIntervalId) return;

    this.nextChordTime = ctx.currentTime + 0.1;
    this.currentChordIndex = 0;

    // Run scheduler every 250ms with 1s lookahead
    this.musicIntervalId = setInterval(() => {
      this.scheduleMusicLookahead();
    }, 250);
  }

  private stopAmbientMusic(): void {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    if (this.musicGain && this.audioCtx) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.audioCtx.currentTime, 0.4);
      setTimeout(() => {
        if (this.musicGain && this.audioCtx) {
          this.musicGain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
        }
      }, 500);
    }
  }

  private scheduleMusicLookahead(): void {
    if (!this.audioCtx || !this.musicEnabled() || !this.musicGain) return;

    const ctx = this.audioCtx;
    if (ctx.state !== 'running') {
      void ctx.resume();
      return;
    }
    const lookahead = 1.2; // seconds ahead

    while (this.nextChordTime < ctx.currentTime + lookahead) {
      const chord = this.chords[this.currentChordIndex];
      const chordDuration = 4.0; // 4 seconds per chord
      const start = Math.max(this.nextChordTime, ctx.currentTime);

      // Play soft ambient pad voices
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Warm filtered triangle/sine
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        // Low-pass filter for smooth mellow tone
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(i === 0 ? 300 : 700, start);
        filter.Q.setValueAtTime(1.0, start);

        // Slow soft envelope
        const peakGain = i === 0 ? 0.35 : 0.18;
        noteGain.gain.setValueAtTime(0.0001, start);
        noteGain.gain.exponentialRampToValueAtTime(peakGain, start + 0.9);
        noteGain.gain.exponentialRampToValueAtTime(peakGain * 0.7, start + 2.5);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, start + chordDuration);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.musicGain!);

        osc.start(start);
        osc.stop(start + chordDuration);
      });

      // Play subtle chime sparkle in the middle of each chord
      const sparkleTime = start + 1.8;
      const sparkleFreq = this.shimmerNotes[(this.currentChordIndex * 2) % this.shimmerNotes.length];
      const sparkleOsc = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkleOsc.type = 'sine';
      sparkleOsc.frequency.setValueAtTime(sparkleFreq, sparkleTime);

      sparkleGain.gain.setValueAtTime(0.0001, sparkleTime);
      sparkleGain.gain.exponentialRampToValueAtTime(0.08, sparkleTime + 0.05);
      sparkleGain.gain.exponentialRampToValueAtTime(0.0001, sparkleTime + 1.2);

      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(this.musicGain);
      sparkleOsc.start(sparkleTime);
      sparkleOsc.stop(sparkleTime + 1.2);

      this.nextChordTime = start + chordDuration;
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
    }
  }

  // ==========================================
  // HIGH-QUALITY TACTILE SOUND EFFECTS (SFX)
  // ==========================================

  /**
   * Queen placement sound: resonant crystal chime with gentle dual overtones
   */
  playPlaceQueen(): void {
    this.vibrate(25);
    this.withSfx((ctx) => {
    const t = ctx.currentTime;
    const freqs = [523.25, 1046.5, 1567.98]; // C5 fundamental + C6 + G6 harmonic sparkle
    const weights = [0.25, 0.12, 0.06];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(weights[idx], t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.45);
    });
    });
  }

  /**
   * Mark X sound: tactile, organic wooden tap (crisp, pleasant, zero fatigue)
   */
  playMarkX(): void {
    this.vibrate(10);
    this.withSfx((ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Woodblock style quick downward pop
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.04);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.setValueAtTime(2.5, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.05);
    });
  }

  /**
   * Erase / clear cell sound: soft, subtle air brush
   */
  playErase(): void {
    this.vibrate(8);
    this.withSfx((ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.06);
    });
  }

  /**
   * Conflict alert: soft melodic warning marimba (informative, non-abrasive)
   */
  playConflict(): void {
    this.vibrate([20, 30, 20]);
    this.withSfx((ctx) => {
    const t = ctx.currentTime;
    // Gentle minor second chord
    [311.13, 329.63].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + 0.22);
    });
    });
  }

  /**
   * Victory fanfare: shimmering 5-note arpeggiated triumph
   */
  playVictory(): void {
    this.vibrate([40, 50, 40, 50, 160]);
    this.withSfx((ctx) => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + idx * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.24, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
    });
  }

  /**
   * Undo sound: subtle reverse acoustic pop
   */
  playUndo(): void {
    this.vibrate(10);
    this.withSfx((ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.06);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(t);
    osc.stop(t + 0.06);
    });
  }

  private vibrate(pattern: number | number[]): void {
    if (this.hapticsEnabled() && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Safe ignore
      }
    }
  }
}
