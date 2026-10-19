/**
 * Procedural WebAudio synthesizer for Downfall.
 * Provides distinct Village, Battle, and Boss music loops + layered SFX with zero external file bloat.
 * Respects Playgama Bridge audio state and separate user Music/SFX mute controls.
 */
export type MusicTrack = 'none' | 'village' | 'battle' | 'boss';

class SoundSynthesizerClass {
  private ctx: AudioContext | null = null;
  private platformMuted = false;
  private userMuted = false;
  private musicVolume = 0.35;
  private sfxVolume = 0.55;
  private currentTrack: MusicTrack = 'none';
  private loopIntervalId: number | null = null;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted()) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.platformMuted || this.userMuted;
  }

  public setPlatformAudioEnabled(enabled: boolean): void {
    this.platformMuted = !enabled;
    this.applyMuteState();
  }

  public setUserMuted(muted: boolean): void {
    this.userMuted = muted;
    this.applyMuteState();
  }

  public toggleUserMute(): boolean {
    this.userMuted = !this.userMuted;
    this.applyMuteState();
    return this.userMuted;
  }

  private applyMuteState(): void {
    if (!this.ctx) return;
    if (this.isMuted()) {
      this.ctx.suspend().catch(() => {});
    } else {
      this.ctx.resume().catch(() => {});
    }
  }

  public playMusic(track: MusicTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stepIndex = 0;
    if (this.loopIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }
    if (track === 'none' || typeof window === 'undefined') return;

    const tempoMs = track === 'boss' ? 220 : track === 'battle' ? 280 : 420;
    this.loopIntervalId = window.setInterval(() => {
      if (this.isMuted()) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const villageScale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63];
      const battleScale = [146.83, 174.61, 196.0, 220.0, 146.83, 220.0, 261.63, 196.0];
      const bossScale = [110.0, 116.54, 130.81, 146.83, 164.81, 146.83, 130.81, 98.0];

      const notes = track === 'boss' ? bossScale : track === 'battle' ? battleScale : villageScale;
      const freq = notes[this.stepIndex % notes.length];
      this.stepIndex++;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = track === 'boss' ? 'sawtooth' : track === 'battle' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const peak = this.musicVolume * (track === 'village' ? 0.12 : 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (tempoMs / 1000) * 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (tempoMs / 1000) * 0.95);
    }, tempoMs);
  }

  public playSfx(type: 'tap' | 'shoot_arrow' | 'shoot_cannon' | 'shoot_magic' | 'shoot_ice' | 'shoot_mortar' | 'hit' | 'coin' | 'upgrade' | 'ultimate' | 'victory' | 'defeat' | 'boss_horn'): void {
    if (this.isMuted()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const vol = this.sfxVolume * 0.25;

    switch (type) {
      case 'tap':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      case 'shoot_arrow':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
        gain.gain.setValueAtTime(vol * 0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      case 'shoot_cannon':
      case 'shoot_mortar':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
        gain.gain.setValueAtTime(vol * 1.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.start(now);
        osc.stop(now + 0.19);
        break;
      case 'shoot_magic':
      case 'shoot_ice':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'shoot_ice' ? 1100 : 680, now);
        osc.frequency.exponentialRampToValueAtTime(type === 'shoot_ice' ? 1480 : 980, now + 0.11);
        gain.gain.setValueAtTime(vol * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      case 'hit':
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(85, now + 0.05);
        gain.gain.setValueAtTime(vol * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      case 'coin':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.05);
        gain.gain.setValueAtTime(vol * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      case 'upgrade':
      case 'victory':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.08);
        osc.frequency.setValueAtTime(659.25, now + 0.16);
        osc.frequency.setValueAtTime(880, now + 0.24);
        gain.gain.setValueAtTime(vol * 1.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
        break;
      case 'ultimate':
      case 'boss_horn':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(type === 'boss_horn' ? 110 : 220, now);
        osc.frequency.linearRampToValueAtTime(type === 'boss_horn' ? 98 : 440, now + 0.35);
        gain.gain.setValueAtTime(vol * 1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.42);
        break;
      case 'defeat':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(293.66, now);
        osc.frequency.linearRampToValueAtTime(146.83, now + 0.38);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
    }
  }
}

export const SoundSynthesizer = new SoundSynthesizerClass();
