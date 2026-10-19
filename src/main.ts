import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { VillageScene } from './scenes/VillageScene';
import { BridgeManager } from './systems/BridgeManager';
import { GameState } from './systems/GameStateManager';

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  public create(): void {
    // Launch directly into the 2.5D Fortified Solar Keep & Valley (BattleScene):
    // First session starts with the 30-second Opening Siege Hook (Wave 1),
    // and returning sessions start On-Demand inside the fortified valley with Kaelen ready!
    const isFirstTime = !GameState.state.tutorialHookCompleted;
    this.scene.start('BattleScene', {
      wave: GameState.state.currentWave || 1,
      isOpeningHook: isFirstTime,
      peacefulStart: !isFirstTime
    });
  }
}

async function startDownfall(): Promise<void> {
  await BridgeManager.init();
  await GameState.loadFromBridge();

  const container = document.getElementById('game-container');
  let gameInstance: Phaser.Game | null = null;

  const computeLogicalHeight = (): number => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 0 || h <= 0) return 956;
    if (w < 760 && h > w) {
      return Phaser.Math.Clamp(Math.round(440 * (h / w)), 680, 1020);
    }
    return 956;
  };

  const patchViewportAndBounds = () => {
    if (!container) return;
    if (window.innerWidth <= 0 || window.innerHeight <= 0) {
      container.style.width = '440px';
      container.style.height = '956px';
    } else {
      container.style.width = '100%';
      container.style.height = '100%';
    }
    if (gameInstance?.scale) {
      const targetH = computeLogicalHeight();
      if (Math.abs(gameInstance.scale.height - targetH) > 2) {
        gameInstance.scale.setGameSize(440, targetH);
      }
      gameInstance.scale.refresh();
      gameInstance.scale.updateBounds();
    }
  };
  patchViewportAndBounds();
  window.addEventListener('resize', patchViewportAndBounds, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', patchViewportAndBounds, { passive: true });
  }

  const initialHeight = computeLogicalHeight();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    title: 'Downfall',
    version: '1.0.0',
    backgroundColor: '#14182E',
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance'
    },
    scale: {
      parent: 'game-container',
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 440,
      height: initialHeight,
      min: { width: 220, height: 340 },
      max: { width: 1320, height: 2868 }
    },
    fps: {
      target: 60,
      smoothStep: true
    },
    input: {
      activePointers: 2
    },
    disableContextMenu: true,
    scene: [BootScene, BattleScene, VillageScene]
  };

  const game = new Phaser.Game(config);
  gameInstance = game;
  setTimeout(patchViewportAndBounds, 60);

  BridgeManager.onPauseStateChanged((isPaused: boolean) => {
    if (isPaused) {
      game.pause();
    } else {
      game.resume();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      GameState.saveToBridge();
    }
  });

  (window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;
}

startDownfall();
