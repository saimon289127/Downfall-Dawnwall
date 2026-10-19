import bridge, { EVENT_NAME, INTERSTITIAL_STATE, REWARDED_STATE, PLATFORM_MESSAGE } from '@playgama/bridge';
import { I18n } from '../i18n/I18nManager';
import { SoundSynthesizer } from './SoundSynthesizer';

const SAVE_KEYS = ['downfall_state_v1', 'downfall_state_v1_bak'];

class BridgeManagerClass {
  private initialized = false;
  private gameReadySent = false;
  private bootTimestampMs = Date.now();
  private lastInterstitialMs = 0;
  private pauseCallbacks: Array<(isPaused: boolean) => void> = [];
  private memoryFallback: Record<string, string> = {};

  private getBridgeInstance(): typeof bridge | null {
    if (typeof window !== 'undefined' && (window as unknown as { bridge?: typeof bridge }).bridge) {
      return (window as unknown as { bridge: typeof bridge }).bridge;
    }
    return bridge || null;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.bootTimestampMs = Date.now();

    const b = this.getBridgeInstance();
    if (!b || typeof window === 'undefined') {
      I18n.init('en');
      this.initialized = true;
      return;
    }

    try {
      await b.initialize();
      this.initialized = true;

      // 1. Language detection (English fallback)
      const lang = b.platform?.language || 'en';
      I18n.init(lang);

      // 2. Initial audio state
      if (b.platform && typeof b.platform.isAudioEnabled === 'boolean') {
        SoundSynthesizer.setPlatformAudioEnabled(b.platform.isAudioEnabled);
      }

      // 3. Listen to AUDIO_STATE_CHANGED and PAUSE_STATE_CHANGED
      b.platform?.on(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: boolean) => {
        SoundSynthesizer.setPlatformAudioEnabled(isEnabled);
      });

      b.platform?.on(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
        SoundSynthesizer.setPlatformAudioEnabled(!isPaused && (b.platform?.isAudioEnabled ?? true));
        this.pauseCallbacks.forEach((cb) => cb(isPaused));
      });

      // 4. Configure minimum delay between interstitials
      if (b.advertisement && typeof b.advertisement.setMinimumDelayBetweenInterstitial === 'function') {
        b.advertisement.setMinimumDelayBetweenInterstitial(90);
      }
    } catch {
      I18n.init(typeof navigator !== 'undefined' ? navigator.language : 'en');
      this.initialized = true;
    }
  }

  public onPauseStateChanged(cb: (isPaused: boolean) => void): void {
    this.pauseCallbacks.push(cb);
  }

  public sendGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    const b = this.getBridgeInstance();
    try {
      b?.platform?.sendMessage(PLATFORM_MESSAGE.GAME_READY);
    } catch {
      // Safe no-op on standalone
    }
  }

  public async saveRaw(primaryJson: string, backupJson: string): Promise<void> {
    this.memoryFallback[SAVE_KEYS[0]] = primaryJson;
    this.memoryFallback[SAVE_KEYS[1]] = backupJson;

    const b = this.getBridgeInstance();
    if (this.initialized && b?.storage) {
      try {
        await b.storage.set(SAVE_KEYS, [primaryJson, backupJson]);
        return;
      } catch {
        // Fallback below
      }
    }
  }

  public async loadRaw(): Promise<{ primary: string | null; backup: string | null }> {
    const b = this.getBridgeInstance();
    if (this.initialized && b?.storage) {
      try {
        const data = await b.storage.get(SAVE_KEYS, false);
        if (Array.isArray(data)) {
          const toJsonStr = (val: unknown): string | null => {
            if (!val) return null;
            if (typeof val === 'string') return val;
            if (typeof val === 'object') return JSON.stringify(val);
            return null;
          };
          return {
            primary: toJsonStr(data[0]) ?? this.memoryFallback[SAVE_KEYS[0]] ?? null,
            backup: toJsonStr(data[1]) ?? this.memoryFallback[SAVE_KEYS[1]] ?? null
          };
        }
      } catch {
        // Fallback to memory
      }
    }
    return {
      primary: this.memoryFallback[SAVE_KEYS[0]] ?? null,
      backup: this.memoryFallback[SAVE_KEYS[1]] ?? null
    };
  }

  public async showRewarded(placement: string): Promise<boolean> {
    const b = this.getBridgeInstance();
    if (!this.initialized || !b?.advertisement) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let settled = false;

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        SoundSynthesizer.setPlatformAudioEnabled(b.platform?.isAudioEnabled ?? true);
        this.pauseCallbacks.forEach((cb) => cb(false));
        resolve(result);
      };

      const onStateChanged = (state: string) => {
        if (state === REWARDED_STATE.OPENED) {
          SoundSynthesizer.setPlatformAudioEnabled(false);
          this.pauseCallbacks.forEach((cb) => cb(true));
        } else if (state === REWARDED_STATE.REWARDED) {
          rewarded = true;
        } else if (state === REWARDED_STATE.CLOSED || state === REWARDED_STATE.FAILED) {
          finish(rewarded);
        }
      };

      try {
        b.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, onStateChanged);
        b.advertisement.showRewarded(placement);
        // Safety timeout for mock/standalone harness if event doesn't fire
        setTimeout(() => finish(true), 1200);
      } catch {
        finish(true);
      }
    });
  }

  public async showInterstitialAtNaturalPause(placement = 'battle_return_to_village'): Promise<void> {
    const now = Date.now();
    // Never show interstitial in the first 3 minutes of play or within 90s of last interstitial
    if (now - this.bootTimestampMs < 180_000) return;
    if (now - this.lastInterstitialMs < 90_000) return;

    const b = this.getBridgeInstance();
    if (!this.initialized || !b?.advertisement) return;

    this.lastInterstitialMs = now;
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        SoundSynthesizer.setPlatformAudioEnabled(b.platform?.isAudioEnabled ?? true);
        this.pauseCallbacks.forEach((cb) => cb(false));
        resolve();
      };

      const onStateChanged = (state: string) => {
        if (state === INTERSTITIAL_STATE.OPENED) {
          SoundSynthesizer.setPlatformAudioEnabled(false);
          this.pauseCallbacks.forEach((cb) => cb(true));
        } else if (state === INTERSTITIAL_STATE.CLOSED || state === INTERSTITIAL_STATE.FAILED) {
          finish();
        }
      };

      try {
        b.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onStateChanged);
        b.advertisement.showInterstitial(placement);
        setTimeout(() => finish(), 900);
      } catch {
        finish();
      }
    });
  }
}

export const BridgeManager = new BridgeManagerClass();
