import Phaser from 'phaser';
import balancingData from '../config/balancing.json';
import { I18n, SupportedLocale } from '../i18n/I18nManager';
import { generateAllGameTextures } from '../systems/AssetGenerator';
import { BridgeManager } from '../systems/BridgeManager';
import { BuildingId, GameState } from '../systems/GameStateManager';
import { SoundSynthesizer } from '../systems/SoundSynthesizer';

export type TurretTypeId = 'archer' | 'cannon' | 'magic' | 'ice' | 'mortar';
export type TroopTypeId = 'infantry' | 'archers' | 'cavalry';

const TROOP_DEPLOY_COSTS: Record<TroopTypeId, number> = {
  infantry: 35,
  archers: 45,
  cavalry: 65
};

interface TurretSlotState {
  index: number;
  x: number;
  y: number;
  unlocked: boolean;
  turretType: TurretTypeId | null;
  level: number;
  cooldownSec: number;
  padSprite: Phaser.GameObjects.Image;
  turretSprite: Phaser.GameObjects.Image | null;
  bubbleBg: Phaser.GameObjects.Image;
  bubbleIcon: Phaser.GameObjects.Text;
  labelText: Phaser.GameObjects.Text;
  costBadge: Phaser.GameObjects.Text;
  fillBarBg: Phaser.GameObjects.Rectangle;
  fillBarFg: Phaser.GameObjects.Rectangle;
  coinsFed: number;
  coinsRequired: number;
}

interface WorldBuildingPad {
  id: string;
  buildingId?: BuildingId;
  houseIndex?: number;
  barricadeIndex?: number;
  isAlarmBell?: boolean;
  name: string;
  iconEmoji: string;
  x: number;
  y: number;
  padX: number;
  padY: number;
  obstacleRadius: number;
  sprite: Phaser.GameObjects.Image;
  padSprite: Phaser.GameObjects.Image;
  bubbleBg: Phaser.GameObjects.Image;
  bubbleIcon: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  levelBadge: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  fillBarBg: Phaser.GameObjects.Rectangle;
  fillBarFg: Phaser.GameObjects.Rectangle;
  redDot: Phaser.GameObjects.Arc;
  coinsFed: number;
  coinsRequired: number;
  level: number;
}

interface GateNode {
  id: string;
  x: number;
  y: number;
  isVerticalWall: boolean;
  leftDoor: Phaser.GameObjects.Rectangle;
  rightDoor: Phaser.GameObjects.Rectangle;
  closedPosA: number;
  closedPosB: number;
  isOpen: boolean;
}

interface TreeNode {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  isChopped: boolean;
  regrowTimerSec: number;
}

interface GroundCoin {
  id: number;
  x: number;
  y: number;
  value: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  ageSec: number;
  collected: boolean;
}

interface EnemyEntity {
  id: number;
  typeId: string;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  lane: 0 | 1 | 2;
  waypoints: Array<{ x: number; y: number }>;
  waypointIdx: number;
  hp: number;
  maxHp: number;
  speedPx: number;
  armor: number;
  wallDamage: number;
  bounty: number;
  slowUntilSec: number;
  slowFactor: number;
  burnUntilSec: number;
  burnDps: number;
  stunUntilSec: number;
  isBoss: boolean;
  attackCooldown: number;
}

interface FriendlyTroopEntity {
  id: number;
  typeId: TroopTypeId;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBarFill: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  formationIndex: number;
  hp: number;
  maxHp: number;
  dps: number;
  rangePx: number;
  speedPx: number;
  armor: number;
  knockbackPx: number;
  attackCooldown: number;
}

interface RadarBadgeUI {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Arc;
  pointer: Phaser.GameObjects.Triangle;
  iconText: Phaser.GameObjects.Text;
  distText: Phaser.GameObjects.Text;
}

export type DashboardTabId = 'conquest' | 'heroes' | 'panoply' | 'buildings' | 'missions' | 'hexmap';

export class BattleScene extends Phaser.Scene {
  // Spacious, High-Readability 2.5D Isometric Fortified Valley
  private readonly WORLD_W = 1320;
  private readonly WORLD_H = 1280;
  private readonly KEEP_X = 660;
  private readonly KEEP_Y = 740;

  // Physical Fortress Wall Perimeter ('CityCollider' / 'Barikade')
  private readonly FORT_LEFT = 320;
  private readonly FORT_RIGHT = 1000;
  private readonly FORT_TOP = 460;
  private readonly FORT_BOTTOM = 1015;

  private waveNumber = 1;
  private isOpeningHook = false;
  private battleGold = 240;
  private wallHp = 1200;
  private maxWallHp = 1200;
  private battleSimTimeSec = 0;
  private battleSpeedMult = 1;
  private slowMoRemainingRealMs = 0;

  // Trauma camera shake
  private trauma = 0;
  private traumaClock = 0;

  // Hero Kaelen (Direct Joystick Control + Slower Grounded Stride + Back Coin Stack + Auto-Attack)
  private heroX = 660;
  private heroY = 630;
  private heroFacingRad = -Math.PI / 2;
  private heroHp = 950;
  private heroMaxHp = 950;
  private heroAttackCd = 0;
  private heroIsMoving = false;
  private heroSprite!: Phaser.GameObjects.Image;
  private heroShadow!: Phaser.GameObjects.Ellipse;
  private heroRing!: Phaser.GameObjects.Image;
  private heroAimChevrons: Phaser.GameObjects.Text[] = [];
  private heroQuestGuideGraphics!: Phaser.GameObjects.Graphics;
  private heroHpBg!: Phaser.GameObjects.Rectangle;
  private heroHpFill!: Phaser.GameObjects.Rectangle;
  private heroCoinStackSprites: Phaser.GameObjects.Image[] = [];
  private heroCoinCountLabel!: Phaser.GameObjects.Text;
  private feedCooldownSec = 0;
  private bellRingCooldownSec = 0;
  private prodDropTimerSec = 0;
  private autoSaveTimerSec = 0;

  // Virtual Thumb Joystick + Tap-vs-Drag Disambiguation
  private joyActive = false;
  private joyPointerId: number | null = null;
  private joyOriginX = 220;
  private joyOriginY = 580;
  private joyMaxDragPx = 0;
  private joyDownWorldX = 0;
  private joyDownWorldY = 0;
  private joyVecX = 0;
  private joyVecY = 0;
  private joyBaseRing!: Phaser.GameObjects.Image;
  private joyThumbKnob!: Phaser.GameObjects.Image;
  private joyHintText!: Phaser.GameObjects.Text;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // World & Entities
  private slots: TurretSlotState[] = [];
  private buildingPads: WorldBuildingPad[] = [];
  private gates: GateNode[] = [];
  private trees: TreeNode[] = [];
  private groundCoins: GroundCoin[] = [];
  private enemies: EnemyEntity[] = [];
  private troops: FriendlyTroopEntity[] = [];
  private spawnQueue: Array<{ typeId: string; delaySec: number; lane: 0 | 1 | 2 }> = [];
  private spawnTimerSec = 0;
  private totalWaveEnemies = 0;
  private killedWaveEnemies = 0;
  private waveActive = true;
  private waveEnded = false;
  private continueUsed = false;
  private nextEntityId = 1;
  private selectedTurretType: TurretTypeId = 'archer';

  // Cooldowns & Synergies
  private heroCooldownSec = 0;
  private troopCooldowns: Record<TroopTypeId, number> = {
    infantry: 0,
    archers: 0,
    cavalry: 0
  };
  private synergyActive = false;
  private botAutoPlay = false;

  // Fixed Screen-Space UI Elements (100% ScrollFactor 0 on every interactive object!)
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private powerText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private battleGoldText!: Phaser.GameObjects.Text;
  private resBarText!: Phaser.GameObjects.Text;
  private buildersPillText!: Phaser.GameObjects.Text;
  private citizensPillText!: Phaser.GameObjects.Text;
  private wallHpFill!: Phaser.GameObjects.Rectangle;
  private wallHpText!: Phaser.GameObjects.Text;
  private synergyBadge!: Phaser.GameObjects.Container;
  private peacefulWaveBanner: Phaser.GameObjects.GameObject[] = [];
  private heroCdText!: Phaser.GameObjects.Text;
  private troopCdTexts: Partial<Record<TroopTypeId, Phaser.GameObjects.Text>> = {};
  private missionBarText!: Phaser.GameObjects.Text;
  private missionProgressFill!: Phaser.GameObjects.Rectangle;
  private missionActionText!: Phaser.GameObjects.Text;
  private missionDot!: Phaser.GameObjects.Arc;
  private navTabDots: Partial<Record<DashboardTabId, Phaser.GameObjects.Arc>> = {};
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  private activeModalName: string | null = null;
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private radarBadges: RadarBadgeUI[] = [];
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private pathChevrons: Array<{ text: Phaser.GameObjects.Text; baseAlpha: number; phase: number }> = [];

  constructor() {
    super('BattleScene');
  }

  private get H(): number {
    return this.scale?.height || 956;
  }

  public init(data?: {
    wave?: number;
    isOpeningHook?: boolean;
    botAutoPlay?: boolean;
    peacefulStart?: boolean;
  }): void {
    this.waveNumber = data?.wave ?? GameState.state.currentWave ?? 1;
    this.isOpeningHook = data?.isOpeningHook ?? !GameState.state.tutorialHookCompleted;
    this.botAutoPlay = data?.botAutoPlay ?? false;
    this.waveActive = !(data?.peacefulStart ?? false);
    this.enemies = [];
    this.troops = [];
    this.slots = [];
    this.buildingPads = [];
    this.gates = [];
    this.trees = [];
    this.groundCoins = [];
    this.spawnQueue = [];
    this.radarBadges = [];
    this.pathChevrons = [];
    this.uiObjects = [];
    this.peacefulWaveBanner = [];
    this.modalObjects = [];
    this.activeModalName = null;
    this.navTabDots = {};
    this.waveEnded = false;
    this.continueUsed = false;
    this.battleSimTimeSec = 0;
    this.slowMoRemainingRealMs = 0;
    this.trauma = 0;
    this.heroCooldownSec = 0;
    this.bellRingCooldownSec = 0;
    this.troopCooldowns = { infantry: 0, archers: 0, cavalry: 0 };
    this.heroX = 660;
    this.heroY = 630;
    this.joyActive = false;
    this.joyVecX = 0;
    this.joyVecY = 0;
  }

  public create(): void {
    generateAllGameTextures(this);

    const combatMults = GameState.getCombatMultipliers();
    this.maxWallHp = combatMults.wallHp;
    this.wallHp = this.maxWallHp;
    this.battleGold = this.isOpeningHook
      ? 280
      : Math.max(200, Math.floor(GameState.state.resources.gold) + 150 + this.waveNumber * 18);

    const isMajorBoss = this.waveNumber % 10 === 0;
    const isMiniBoss = !isMajorBoss && this.waveNumber % 5 === 0;
    SoundSynthesizer.playMusic(
      !this.waveActive ? 'village' : isMajorBoss || isMiniBoss ? 'boss' : 'battle'
    );

    // Configure 2.5D Isometric Fortified Valley & Camera Follow
    this.cameras.main.setBounds(140, 110, 1040, 1050);

    this.drawSeamlessIsometricValley();
    this.createParticleSystems();
    this.createPineForestsAndWorkers();
    this.create3DFortressWallsAndGates();
    this.createVillageBuildingsOnDemand();
    this.createTurretSlots(Math.max(6, combatMults.turretSlots));
    this.createHeroAndRetinueSquad();
    this.createInitialGroundCoinClusters();
    this.createNightMistPerimeter();

    // Lock camera smoothly onto Hero Kaelen
    this.cameras.main.startFollow(this.heroSprite, false, 0.14, 0.14);

    // Fixed Screen-Space HUD, Right Feature Badges, Radar, Full-Screen Thumb Joystick & 6-Tab Kingshot Dashboard
    this.createOffScreenRadarPool();
    this.createVirtualThumbJoystick();
    this.rebuildFixedScreenHud();

    // Always pre-build the 2 front watchtowers so the fortress looks alive and defended immediately
    this.buildOrUpgradeSlot(0, 'archer', true);
    this.buildOrUpgradeSlot(1, 'cannon', true);

    // Check if returning player has offline earnings waiting
    if (GameState.getPendingOfflineReport()) {
      this.openOfflineEarningsModal();
    }

    if (this.waveActive) {
      this.buildWaveSpawnQueue();
      if (this.isOpeningHook) {
        this.showFloatingBanner(I18n.t('battle.hook_banner'), 0xffb020);
      } else if (isMajorBoss) {
        SoundSynthesizer.playSfx('boss_horn');
        this.showFloatingBanner(I18n.t('battle.major_boss_warning'), 0xff3b5c);
      } else if (isMiniBoss) {
        SoundSynthesizer.playSfx('boss_horn');
        this.showFloatingBanner(I18n.t('battle.boss_warning'), 0x7b3fe4);
      }
    } else {
      this.showPeacefulCallWaveBar();
    }

    this.scale.on('resize', this.handleSafeResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleSafeResize, this);
    });

    BridgeManager.sendGameReady();
    this.exposeTestHooks();
  }

  private handleSafeResize(gameSize: Phaser.Structs.Size): void {
    if (!gameSize || gameSize.width <= 0 || gameSize.height <= 0) return;
    if (this.cameras?.main) {
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    }
    this.rebuildFixedScreenHud();
  }

  /**
   * Helper that registers a fixed-screen UI object with guaranteed `.setScrollFactor(0)`
   * so Phaser 4 input hit-testing NEVER adds camera scroll offsets!
   */
  private registerHudObj<T extends Phaser.GameObjects.GameObject>(obj: T, depth = 72): T {
    const anyObj = obj as unknown as {
      setScrollFactor?: (x: number, y?: number) => unknown;
      setDepth?: (d: number) => unknown;
    };
    if (anyObj.setScrollFactor) anyObj.setScrollFactor(0, 0);
    if (anyObj.setDepth) anyObj.setDepth(depth);
    this.uiObjects.push(obj);
    return obj;
  }

  private registerModalObj<T extends Phaser.GameObjects.GameObject>(obj: T, depth = 94): T {
    const anyObj = obj as unknown as {
      setScrollFactor?: (x: number, y?: number) => unknown;
      setDepth?: (d: number) => unknown;
    };
    if (anyObj.setScrollFactor) anyObj.setScrollFactor(0, 0);
    if (anyObj.setDepth) anyObj.setDepth(depth);
    this.modalObjects.push(obj);
    return obj;
  }

  public closeModal(): void {
    for (const obj of this.modalObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.modalObjects = [];
    this.activeModalName = null;
  }

  private drawSeamlessIsometricValley(): void {
    const g = this.add.graphics().setDepth(1);

    // 1. Lush, sunlit emerald & olive meadow base (matching Kingshot Screenshot 1)
    g.fillStyle(0x417e38, 1);
    g.fillRect(0, 0, this.WORLD_W, this.WORLD_H);

    const patches = [
      { x: 660, y: 740, rx: 460, ry: 360, color: 0x529644 },
      { x: 660, y: 740, rx: 370, ry: 290, color: 0x62ab52 },
      { x: 430, y: 380, rx: 210, ry: 130, color: 0x4f9142 },
      { x: 890, y: 380, rx: 210, ry: 130, color: 0x4f9142 },
      { x: 660, y: 1080, rx: 310, ry: 120, color: 0x4f9142 }
    ];
    for (const p of patches) {
      g.fillStyle(p.color, 0.92);
      g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
    }

    // Grass tufts, clover patches & sunlit wildflowers
    for (let i = 0; i < 80; i++) {
      const gx = 180 + ((i * 79) % 960);
      const gy = 235 + ((i * 139) % 850);
      g.fillStyle(i % 4 === 0 ? 0xffe066 : i % 2 === 0 ? 0x79c667 : 0x33692c, 0.72);
      g.fillCircle(gx, gy, i % 4 === 0 ? 2.5 : 3.5);
    }

    // 2. Northern Sparkling Turquoise River with Sandy Banks
    g.fillStyle(0xd9c290, 1);
    g.fillRect(0, 138, this.WORLD_W, 96);
    g.fillStyle(0x1b76a8, 1);
    g.fillRect(0, 150, this.WORLD_W, 72);
    g.fillStyle(0x32addf, 1);
    g.fillRect(0, 158, this.WORLD_W, 56);
    g.fillStyle(0xa8f4ff, 0.65);
    for (let rx = 35; rx < this.WORLD_W; rx += 80) {
      g.fillRoundedRect(rx, 168 + (rx % 3) * 11, 52, 6, 3);
    }

    // 3. Organic Warm Ochre & Cobblestone Roads connecting Gates & Buildings
    g.lineStyle(62, 0xa88d63, 1);
    g.lineBetween(660, 138, 660, 960);
    g.lineBetween(150, 620, 320, 740);
    g.lineBetween(320, 740, 1000, 740);
    g.lineBetween(1000, 740, 1170, 620);

    g.lineStyle(48, 0xdec59a, 1);
    g.lineBetween(660, 138, 660, 960);
    g.lineBetween(150, 620, 320, 740);
    g.lineBetween(320, 740, 1000, 740);
    g.lineBetween(1000, 740, 1170, 620);

    // Timber & Stone Bridge over the Northern River
    g.fillStyle(0x75471f, 1);
    g.fillRoundedRect(606, 136, 108, 106, 10);
    g.lineStyle(4, 0x42260f, 1);
    g.strokeRoundedRect(606, 136, 108, 106, 10);
    for (let by = 148; by <= 232; by += 12) {
      g.lineStyle(2.5, 0xa36830, 0.95);
      g.lineBetween(612, by, 708, by);
    }

    // 4. Sunlit Isometric Citadel Courtyard Plaza with Lush Green Garden Borders inside the Walls
    g.fillStyle(0x63ab52, 0.95);
    g.fillRoundedRect(336, 476, 648, 524, 30);

    g.fillStyle(0xd8c39e, 0.94);
    g.fillRoundedRect(362, 500, 596, 476, 26);
    g.lineStyle(3, 0x9c845c, 0.85);
    g.strokeRoundedRect(362, 500, 596, 476, 26);

    // Subtle courtyard flagstones
    g.lineStyle(1.2, 0xb8a076, 0.42);
    for (let cx = 410; cx <= 910; cx += 64) {
      g.lineBetween(cx, 504, cx, 972);
    }
    for (let cy = 540; cy <= 940; cy += 64) {
      g.lineBetween(366, cy, 954, cy);
    }

    // Warm Golden Aura around the Central Solar Keep
    g.fillStyle(0xffb020, 0.2);
    g.fillCircle(this.KEEP_X, this.KEEP_Y, 148);

    // 5. Animated Red Enemy Approach Chevrons
    const arrowPoints: Array<{ x: number; y: number; rot: number }> = [
      { x: 660, y: 270, rot: Math.PI / 2 },
      { x: 660, y: 345, rot: Math.PI / 2 },
      { x: 660, y: 415, rot: Math.PI / 2 },
      { x: 215, y: 665, rot: 0.58 },
      { x: 275, y: 706, rot: 0.58 },
      { x: 1105, y: 665, rot: Math.PI - 0.58 },
      { x: 1045, y: 706, rot: Math.PI - 0.58 }
    ];
    arrowPoints.forEach((pt, idx) => {
      const txt = this.add
        .text(pt.x, pt.y, '»»', {
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#FF4B4B',
          stroke: '#4A0E17',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setRotation(pt.rot)
        .setDepth(3);
      this.pathChevrons.push({ text: txt, baseAlpha: 0.8, phase: idx * 0.6 });
    });
  }

  private createParticleSystems(): void {
    this.sparkEmitter = this.add.particles(0, 0, 'particle_flare', {
      speed: { min: 50, max: 175 },
      lifespan: 440,
      scale: { start: 0.78, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffb020, 0xfff3d1, 0x2ce8c8, 0xff3b5c],
      emitting: false
    });
    this.sparkEmitter.setDepth(45);
  }

  private createPineForestsAndWorkers(): void {
    const rockCoords = [
      { x: 505, y: 245 },
      { x: 815, y: 245 },
      { x: 245, y: 480 },
      { x: 1075, y: 480 },
      { x: 255, y: 980 },
      { x: 1065, y: 980 }
    ];
    for (const rc of rockCoords) {
      this.add.image(rc.x, rc.y, 'prop_rock').setScale(1.08).setDepth(11);
    }

    const treeCoords: Array<{ x: number; y: number }> = [
      // North-West Woods
      { x: 205, y: 275 },
      { x: 270, y: 295 },
      { x: 335, y: 270 },
      { x: 400, y: 305 },
      { x: 465, y: 285 },
      { x: 220, y: 370 },
      { x: 295, y: 390 },
      { x: 370, y: 395 },
      { x: 440, y: 405 },
      // North-East Woods
      { x: 855, y: 285 },
      { x: 920, y: 305 },
      { x: 985, y: 270 },
      { x: 1050, y: 295 },
      { x: 1115, y: 275 },
      { x: 880, y: 405 },
      { x: 950, y: 395 },
      { x: 1025, y: 390 },
      { x: 1100, y: 370 },
      // Inner Courtyard Decorative Trees flanking the North Gate
      { x: 365, y: 615 },
      { x: 955, y: 615 },
      { x: 585, y: 505 },
      { x: 735, y: 505 },
      // Southern Woods
      { x: 220, y: 875 },
      { x: 275, y: 955 },
      { x: 345, y: 1065 },
      { x: 455, y: 1080 },
      { x: 560, y: 1085 },
      { x: 660, y: 1090 },
      { x: 760, y: 1085 },
      { x: 865, y: 1080 },
      { x: 975, y: 1065 },
      { x: 1045, y: 955 },
      { x: 1100, y: 875 }
    ];

    for (const tc of treeCoords) {
      const sp = this.add
        .image(tc.x, tc.y, 'prop_pine_tree')
        .setOrigin(0.5, 0.85)
        .setScale(1.08)
        .setDepth(tc.y > 1000 ? 28 : 12);
      this.trees.push({
        x: tc.x,
        y: tc.y,
        sprite: sp,
        isChopped: false,
        regrowTimerSec: 0
      });
    }

    // Autonomous Citizen Lumberjacks & Couriers
    const workerRoutes = [
      { x1: 445, y1: 545, x2: 440, y2: 405, chopTreeIdx: 8 },
      { x1: 445, y1: 545, x2: 370, y2: 395, chopTreeIdx: 7 },
      { x1: 660, y1: 750, x2: 505, y2: 650, chopTreeIdx: -1 },
      { x1: 660, y1: 750, x2: 815, y2: 650, chopTreeIdx: -1 }
    ];

    workerRoutes.forEach((r, idx) => {
      const worker = this.add.image(r.x1, r.y1, 'citizen_worker').setScale(1.12).setDepth(21);
      this.tweens.add({
        targets: worker,
        x: r.x2,
        y: r.y2,
        duration: 3200 + idx * 480,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onYoyo: () => {
          if (r.chopTreeIdx >= 0 && this.trees[r.chopTreeIdx]) {
            this.shakeAndChopTree(this.trees[r.chopTreeIdx]);
          }
        }
      });
    });
  }

  private shakeAndChopTree(tree: TreeNode): void {
    if (tree.isChopped || !tree.sprite.active) return;
    this.tweens.add({
      targets: tree.sprite,
      angle: { from: -8, to: 8 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (!tree.sprite.active) return;
        tree.isChopped = true;
        tree.regrowTimerSec = 10;
        this.tweens.add({
          targets: tree.sprite,
          angle: 82,
          alpha: 0.25,
          duration: 320,
          ease: 'Cubic.easeIn'
        });
      }
    });
  }

  private create3DFortressWallsAndGates(): void {
    // 1. Horizontal 3D Stone & Timber Rampart Segments
    for (let x = this.FORT_LEFT + 32; x <= this.FORT_RIGHT - 32; x += 56) {
      if (Math.abs(x - 660) > 54) {
        this.add.image(x, this.FORT_TOP, 'wall_seg_h').setScale(1.06).setDepth(13);
      }
      this.add.image(x, this.FORT_BOTTOM, 'wall_seg_h').setScale(1.06).setDepth(27);
    }

    // 2. Vertical 3D Stone & Timber Rampart Segments
    for (let y = this.FORT_TOP + 32; y <= this.FORT_BOTTOM - 32; y += 54) {
      if (Math.abs(y - 740) > 52) {
        this.add.image(this.FORT_LEFT, y, 'wall_seg_v').setScale(1.06).setDepth(14);
        this.add.image(this.FORT_RIGHT, y, 'wall_seg_v').setScale(1.06).setDepth(14);
      }
    }

    // 3. 3D Isometric Corner & Gatehouse Bastion Towers ('wall_bastion')
    const bastionCoords = [
      { x: this.FORT_LEFT, y: this.FORT_TOP, depth: 15 },
      { x: this.FORT_RIGHT, y: this.FORT_TOP, depth: 15 },
      { x: this.FORT_LEFT, y: this.FORT_BOTTOM, depth: 28 },
      { x: this.FORT_RIGHT, y: this.FORT_BOTTOM, depth: 28 },
      { x: 608, y: this.FORT_TOP, depth: 15 },
      { x: 712, y: this.FORT_TOP, depth: 15 },
      { x: this.FORT_LEFT, y: 690, depth: 15 },
      { x: this.FORT_LEFT, y: 790, depth: 16 },
      { x: this.FORT_RIGHT, y: 690, depth: 15 },
      { x: this.FORT_RIGHT, y: 790, depth: 16 }
    ];
    for (const b of bastionCoords) {
      this.add
        .image(b.x, b.y - 8, 'wall_bastion')
        .setScale(1.05)
        .setDepth(b.depth);
    }

    // 4. 3 Automatic Swinging Fortress Gates ('ViewDoorOpenSystem')
    const nLeft = this.add
      .rectangle(660 - 19, this.FORT_TOP + 2, 36, 18, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    const nRight = this.add
      .rectangle(660 + 19, this.FORT_TOP + 2, 36, 18, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    this.gates.push({
      id: 'gate_north',
      x: 660,
      y: this.FORT_TOP,
      isVerticalWall: false,
      leftDoor: nLeft,
      rightDoor: nRight,
      closedPosA: 660 - 19,
      closedPosB: 660 + 19,
      isOpen: false
    });

    const wTop = this.add
      .rectangle(this.FORT_LEFT, 740 - 19, 18, 36, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    const wBot = this.add
      .rectangle(this.FORT_LEFT, 740 + 19, 18, 36, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    this.gates.push({
      id: 'gate_west',
      x: this.FORT_LEFT,
      y: 740,
      isVerticalWall: true,
      leftDoor: wTop,
      rightDoor: wBot,
      closedPosA: 740 - 19,
      closedPosB: 740 + 19,
      isOpen: false
    });

    const eTop = this.add
      .rectangle(this.FORT_RIGHT, 740 - 19, 18, 36, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    const eBot = this.add
      .rectangle(this.FORT_RIGHT, 740 + 19, 18, 36, 0x8c5220, 1)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setDepth(14);
    this.gates.push({
      id: 'gate_east',
      x: this.FORT_RIGHT,
      y: 740,
      isVerticalWall: true,
      leftDoor: eTop,
      rightDoor: eBot,
      closedPosA: 740 - 19,
      closedPosB: 740 + 19,
      isOpen: false
    });
  }

  private resolveWalkablePosition(
    oldX: number,
    oldY: number,
    targetX: number,
    targetY: number
  ): { x: number; y: number } {
    let nx = Phaser.Math.Clamp(targetX, 200, 1120);
    const onNorthernBridge = nx >= 610 && nx <= 710;
    const minY = onNorthernBridge ? 148 : 234;
    let ny = Phaser.Math.Clamp(targetY, minY, 1065);

    const wallMargin = 16;

    // North Wall (y = 460, gap at North Gate x = 616..704)
    const inNorthGateGap = nx >= 616 && nx <= 704;
    if (!inNorthGateGap && nx >= this.FORT_LEFT - wallMargin && nx <= this.FORT_RIGHT + wallMargin) {
      if (oldY >= this.FORT_TOP + wallMargin && ny < this.FORT_TOP + wallMargin) {
        ny = this.FORT_TOP + wallMargin;
      } else if (oldY <= this.FORT_TOP - wallMargin && ny > this.FORT_TOP - wallMargin) {
        ny = this.FORT_TOP - wallMargin;
      }
    }

    // South Wall (y = 1015, solid rampart)
    if (nx >= this.FORT_LEFT - wallMargin && nx <= this.FORT_RIGHT + wallMargin) {
      if (oldY <= this.FORT_BOTTOM - wallMargin && ny > this.FORT_BOTTOM - wallMargin) {
        ny = this.FORT_BOTTOM - wallMargin;
      } else if (oldY >= this.FORT_BOTTOM + wallMargin && ny < this.FORT_BOTTOM + wallMargin) {
        ny = this.FORT_BOTTOM + wallMargin;
      }
    }

    // West Wall (x = 320, gap at West Gate y = 696..784)
    const inWestGateGap = ny >= 696 && ny <= 784;
    if (!inWestGateGap && ny >= this.FORT_TOP - wallMargin && ny <= this.FORT_BOTTOM + wallMargin) {
      if (oldX >= this.FORT_LEFT + wallMargin && nx < this.FORT_LEFT + wallMargin) {
        nx = this.FORT_LEFT + wallMargin;
      } else if (oldX <= this.FORT_LEFT - wallMargin && nx > this.FORT_LEFT - wallMargin) {
        nx = this.FORT_LEFT - wallMargin;
      }
    }

    // East Wall (x = 1000, gap at East Gate y = 696..784)
    const inEastGateGap = ny >= 696 && ny <= 784;
    if (!inEastGateGap && ny >= this.FORT_TOP - wallMargin && ny <= this.FORT_BOTTOM + wallMargin) {
      if (oldX <= this.FORT_RIGHT - wallMargin && nx > this.FORT_RIGHT - wallMargin) {
        nx = this.FORT_RIGHT - wallMargin;
      } else if (oldX >= this.FORT_RIGHT + wallMargin && nx < this.FORT_RIGHT + wallMargin) {
        nx = this.FORT_RIGHT + wallMargin;
      }
    }

    // Solid Building Footprint Repulsion ('BuildingBound')
    for (const pad of this.buildingPads) {
      if (pad.obstacleRadius <= 0) continue;
      const obsX = pad.x;
      const obsY = pad.y - 6;
      const dx = nx - obsX;
      const dy = ny - obsY;
      const dist = Math.hypot(dx, dy);
      if (dist < pad.obstacleRadius && dist > 0.001) {
        nx = obsX + (dx / dist) * pad.obstacleRadius;
        ny = obsY + (dy / dist) * pad.obstacleRadius;
      }
    }

    return { x: nx, y: ny };
  }

  private createVillageBuildingsOnDemand(): void {
    const definitions: Array<{
      id: string;
      buildingId?: BuildingId;
      houseIndex?: number;
      barricadeIndex?: number;
      isAlarmBell?: boolean;
      name: string;
      iconEmoji: string;
      x: number;
      y: number;
      scale: number;
      padOffsetY: number;
      obstacleRadius: number;
      baseCostGold: number;
      textureFn: (lv: number) => string;
      initialLevel: number;
    }> = [
      {
        id: 'pad_town_hall',
        buildingId: 'town_hall',
        name: I18n.t('building.town_hall'),
        iconEmoji: '👑',
        x: this.KEEP_X,
        y: 735,
        scale: 1.26,
        padOffsetY: 66,
        obstacleRadius: 42,
        baseCostGold: 55,
        textureFn: () => `building_town_hall_t${GameState.getVisualTier('town_hall')}`,
        initialLevel: GameState.state.buildings.town_hall || 1
      },
      {
        id: 'pad_alarm_bell',
        isAlarmBell: true,
        name: 'Campana',
        iconEmoji: '🔔',
        x: 660,
        y: 558,
        scale: 1.12,
        padOffsetY: 40,
        obstacleRadius: 0,
        baseCostGold: 10,
        textureFn: () => 'prop_alarm_bell',
        initialLevel: 1
      },
      {
        id: 'pad_farm',
        buildingId: 'farm',
        name: I18n.t('building.farm'),
        iconEmoji: '🍴',
        x: 505,
        y: 620,
        scale: 1.16,
        padOffsetY: 50,
        obstacleRadius: 30,
        baseCostGold: 30,
        textureFn: () => `building_farm_t${GameState.getVisualTier('farm')}`,
        initialLevel: GameState.state.buildings.farm || 1
      },
      {
        id: 'pad_lumber_mill',
        buildingId: 'lumber_mill',
        name: I18n.t('building.lumber_mill'),
        iconEmoji: '🪵',
        x: 395,
        y: 555,
        scale: 1.16,
        padOffsetY: 50,
        obstacleRadius: 30,
        baseCostGold: 30,
        textureFn: () => `building_lumber_mill_t${GameState.getVisualTier('lumber_mill')}`,
        initialLevel: GameState.state.buildings.lumber_mill || 1
      },
      {
        id: 'pad_mine',
        buildingId: 'mine',
        name: I18n.t('building.mine'),
        iconEmoji: '🔥',
        x: 815,
        y: 620,
        scale: 1.16,
        padOffsetY: 50,
        obstacleRadius: 30,
        baseCostGold: 40,
        textureFn: () => `building_mine_t${GameState.getVisualTier('mine')}`,
        initialLevel: Math.max(1, GameState.state.buildings.mine || 1)
      },
      {
        id: 'pad_barracks',
        buildingId: 'barracks',
        name: I18n.t('building.barracks'),
        iconEmoji: '⚔️',
        x: 815,
        y: 785,
        scale: 1.16,
        padOffsetY: 50,
        obstacleRadius: 30,
        baseCostGold: 35,
        textureFn: () => `building_barracks_t${GameState.getVisualTier('barracks')}`,
        initialLevel: GameState.state.buildings.barracks || 1
      },
      {
        id: 'pad_turret_workshop',
        buildingId: 'turret_workshop',
        name: I18n.t('building.turret_workshop'),
        iconEmoji: '⚙️',
        x: 505,
        y: 785,
        scale: 1.16,
        padOffsetY: 50,
        obstacleRadius: 30,
        baseCostGold: 35,
        textureFn: () => `building_turret_workshop_t${GameState.getVisualTier('turret_workshop')}`,
        initialLevel: GameState.state.buildings.turret_workshop || 1
      },
      {
        id: 'pad_academy',
        buildingId: 'academy',
        name: I18n.t('building.academy'),
        iconEmoji: '📘',
        x: 925,
        y: 555,
        scale: 1.14,
        padOffsetY: 48,
        obstacleRadius: 28,
        baseCostGold: 45,
        textureFn: () => `building_academy_t${GameState.getVisualTier('academy')}`,
        initialLevel: Math.max(1, GameState.state.buildings.academy || 1)
      },
      {
        id: 'pad_hero_tavern',
        buildingId: 'hero_tavern',
        name: I18n.t('building.hero_tavern'),
        iconEmoji: '🍺',
        x: 925,
        y: 700,
        scale: 1.14,
        padOffsetY: 48,
        obstacleRadius: 28,
        baseCostGold: 45,
        textureFn: () => `building_hero_tavern_t${GameState.getVisualTier('hero_tavern')}`,
        initialLevel: Math.max(1, GameState.state.buildings.hero_tavern || 1)
      },
      {
        id: 'pad_house_1',
        houseIndex: 1,
        name: 'Alloggio 1',
        iconEmoji: '🏠',
        x: 395,
        y: 700,
        scale: 1.14,
        padOffsetY: 44,
        obstacleRadius: 24,
        baseCostGold: 20,
        textureFn: (lv) => `building_house_t${lv >= 5 ? 3 : lv >= 3 ? 2 : 1}`,
        initialLevel: GameState.getHouseLevel(1)
      },
      {
        id: 'pad_house_2',
        houseIndex: 2,
        name: 'Alloggio 2',
        iconEmoji: '🏠',
        x: 395,
        y: 845,
        scale: 1.14,
        padOffsetY: 44,
        obstacleRadius: 24,
        baseCostGold: 20,
        textureFn: (lv) => `building_house_t${lv >= 5 ? 3 : lv >= 3 ? 2 : 1}`,
        initialLevel: GameState.getHouseLevel(2)
      },
      {
        id: 'pad_house_3',
        houseIndex: 3,
        name: 'Alloggio 3',
        iconEmoji: '🏠',
        x: 505,
        y: 935,
        scale: 1.14,
        padOffsetY: 44,
        obstacleRadius: 24,
        baseCostGold: 25,
        textureFn: (lv) => `building_house_t${lv >= 5 ? 3 : lv >= 3 ? 2 : 1}`,
        initialLevel: GameState.getHouseLevel(3)
      },
      {
        id: 'pad_house_4',
        houseIndex: 4,
        name: 'Alloggio 4',
        iconEmoji: '🏠',
        x: 660,
        y: 935,
        scale: 1.14,
        padOffsetY: 44,
        obstacleRadius: 24,
        baseCostGold: 25,
        textureFn: (lv) => `building_house_t${lv >= 5 ? 3 : lv >= 3 ? 2 : 1}`,
        initialLevel: GameState.getHouseLevel(4)
      },
      {
        id: 'pad_house_5',
        houseIndex: 5,
        name: 'Alloggio 5',
        iconEmoji: '🏠',
        x: 815,
        y: 935,
        scale: 1.14,
        padOffsetY: 44,
        obstacleRadius: 24,
        baseCostGold: 30,
        textureFn: (lv) => `building_house_t${lv >= 5 ? 3 : lv >= 3 ? 2 : 1}`,
        initialLevel: GameState.getHouseLevel(5)
      }
    ];

    for (const def of definitions) {
      const lv = def.initialLevel;
      const padX = def.x;
      const padY = def.y + def.padOffsetY;

      const sprite = this.add
        .image(def.x, def.y, def.textureFn(Math.max(1, lv)))
        .setScale(def.scale)
        .setAlpha(lv > 0 ? 1 : 0.6)
        .setDepth(16);

      const padSprite = this.add
        .image(padX, padY, 'turret_pad')
        .setScale(0.84)
        .setDepth(14);

      // Kingshot-style Floating White/Gold Speech Bubble above every building!
      const bubbleY = def.y - (def.buildingId === 'town_hall' ? 66 : 48);
      const bubbleBg = this.add
        .image(def.x, bubbleY, 'ui_speech_bubble')
        .setScale(0.92)
        .setDepth(24);
      const bubbleIcon = this.add
        .text(def.x, bubbleY - 4, def.iconEmoji, {
          fontSize: '18px',
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(25);

      this.tweens.add({
        targets: [bubbleBg, bubbleIcon],
        y: '-=5',
        duration: 1350 + (def.x % 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Crisp, High-Readability Level Badge & Name Pill
      const levelBadge = this.add
        .text(def.x + 26, def.y - 22, `Lv.${Math.max(1, lv)}`, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#14182E',
          backgroundColor: '#FFB020',
          padding: { x: 4, y: 1 },
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(23);

      const nameText = this.add
        .text(def.x, def.y + 18, def.name, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          stroke: '#10172A',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);

      const coinsReq = Math.max(10, def.baseCostGold + lv * 15);
      const costText = this.add
        .text(padX, padY - 2, def.isAlarmBell ? '🔔 ONDATA' : `🪙 ${coinsReq}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFB020',
          stroke: '#10172A',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(23);

      const fillBarBg = this.add
        .rectangle(padX, padY + 13, 52, 7, 0x14182e, 0.92)
        .setStrokeStyle(1.2, 0xffb020, 0.9)
        .setDepth(22);
      const fillBarFg = this.add
        .rectangle(padX - 25, padY + 13, 0, 5, 0x2ecc71, 1)
        .setOrigin(0, 0.5)
        .setDepth(23);

      const redDot = this.add
        .circle(def.x + 17, bubbleY - 14, 6, 0xff3b5c, 1)
        .setStrokeStyle(1.5, 0xfff3d1, 1)
        .setDepth(26);

      this.buildingPads.push({
        id: def.id,
        buildingId: def.buildingId,
        houseIndex: def.houseIndex,
        barricadeIndex: def.barricadeIndex,
        isAlarmBell: def.isAlarmBell,
        name: def.name,
        iconEmoji: def.iconEmoji,
        x: def.x,
        y: def.y,
        padX,
        padY,
        obstacleRadius: def.obstacleRadius,
        sprite,
        padSprite,
        bubbleBg,
        bubbleIcon,
        nameText,
        levelBadge,
        costText,
        fillBarBg,
        fillBarFg,
        redDot,
        coinsFed: 0,
        coinsRequired: coinsReq,
        level: Math.max(1, lv)
      });
    }
  }

  private createTurretSlots(unlockedCount: number): void {
    const coords = [
      { x: 545, y: 505 },
      { x: 775, y: 505 },
      { x: 365, y: 675 },
      { x: 955, y: 675 },
      { x: 365, y: 815 },
      { x: 955, y: 815 }
    ];

    this.slots = coords.map((pt, idx) => {
      const unlocked = idx < unlockedCount;
      const padSprite = this.add
        .image(pt.x, pt.y, 'turret_pad')
        .setScale(1.06)
        .setAlpha(unlocked ? 1 : 0.5)
        .setDepth(15);

      const bubbleBg = this.add
        .image(pt.x, pt.y - 44, 'ui_speech_bubble')
        .setScale(0.86)
        .setDepth(24);
      const bubbleIcon = this.add
        .text(pt.x, pt.y - 48, '🏹', { fontSize: '16px', resolution: 2 })
        .setOrigin(0.5)
        .setDepth(25);

      const labelText = this.add
        .text(pt.x, pt.y + 32, unlocked ? `Torre ${idx + 1}` : '🔒 Mura Lv+', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: unlocked ? '#FFF3D1' : '#B8C0D0',
          stroke: '#10172A',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(21);

      const costBadge = this.add
        .text(pt.x, pt.y - 2, unlocked ? '🪙 50' : '🔒', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFB020',
          stroke: '#10172A',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22);

      const fillBarBg = this.add
        .rectangle(pt.x, pt.y + 15, 52, 7, 0x14182e, 0.92)
        .setStrokeStyle(1.2, 0xffb020, 0.9)
        .setDepth(22);
      const fillBarFg = this.add
        .rectangle(pt.x - 25, pt.y + 15, 0, 5, 0x2ecc71, 1)
        .setOrigin(0, 0.5)
        .setDepth(23);

      return {
        index: idx,
        x: pt.x,
        y: pt.y,
        unlocked,
        turretType: null,
        level: 0,
        cooldownSec: 0,
        padSprite,
        turretSprite: null,
        bubbleBg,
        bubbleIcon,
        labelText,
        costBadge,
        fillBarBg,
        fillBarFg,
        coinsFed: 0,
        coinsRequired: 50
      };
    });
  }

  private createHeroAndRetinueSquad(): void {
    this.heroQuestGuideGraphics = this.add.graphics().setDepth(23);
    this.heroRing = this.add.image(this.heroX, this.heroY + 16, 'hero_selection_ring').setScale(1.15).setDepth(24);
    this.heroShadow = this.add.ellipse(this.heroX, this.heroY + 20, 42, 18, 0x090c18, 0.55).setDepth(24);
    this.heroSprite = this.add.image(this.heroX, this.heroY, 'hero_kaelen').setScale(1.24).setDepth(26);

    this.heroAimChevrons = [0, 1, 2].map((i) =>
      this.add
        .text(this.heroX, this.heroY, '›', {
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#2CE8C8',
          stroke: '#14182E',
          strokeThickness: 3,
          resolution: 2
        })
        .setOrigin(0.5)
        .setAlpha(0.85 - i * 0.2)
        .setDepth(25)
    );

    this.heroHpBg = this.add
      .rectangle(this.heroX, this.heroY - 38, 48, 7, 0x14182e, 0.92)
      .setStrokeStyle(1.2, 0xfff3d1, 0.9)
      .setDepth(28);
    this.heroHpFill = this.add
      .rectangle(this.heroX - 23, this.heroY - 38, 46, 5, 0x2ecc71, 1)
      .setOrigin(0, 0.5)
      .setDepth(29);

    this.heroCoinStackSprites = [];
    for (let i = 0; i < 16; i++) {
      const coinSp = this.add
        .image(this.heroX - 18, this.heroY - 8 - i * 4.4, 'particle_coin')
        .setScale(1.02)
        .setDepth(27 + i * 0.01);
      this.heroCoinStackSprites.push(coinSp);
    }

    this.heroCoinCountLabel = this.add
      .text(this.heroX - 18, this.heroY - 82, `🪙 ${this.battleGold}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#FFB020',
        backgroundColor: 'rgba(16,23,42,0.92)',
        padding: { x: 5, y: 2 },
        resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.refreshHeroCoinStackVisuals();

    this.spawnRetinueGuard('infantry');
    this.spawnRetinueGuard('infantry');
    this.spawnRetinueGuard('archers');
    this.spawnRetinueGuard('archers');
  }

  private createInitialGroundCoinClusters(): void {
    const spots = [
      { x: 625, y: 615, val: 15 },
      { x: 695, y: 615, val: 15 },
      { x: 560, y: 660, val: 15 },
      { x: 755, y: 660, val: 15 },
      { x: 660, y: 565, val: 20 }
    ];
    for (const s of spots) {
      this.dropPhysicalCoinAt(s.x, s.y, s.val);
    }
  }

  private dropPhysicalCoinAt(x: number, y: number, value: number): void {
    const startX = x + Phaser.Math.Between(-18, 18);
    const startY = y + Phaser.Math.Between(-14, 14);
    const shadow = this.add.ellipse(startX, startY + 6, 15, 7, 0x090c18, 0.45).setDepth(18);
    const sprite = this.add.image(x, y - 16, 'particle_coin').setScale(1.05).setDepth(20);

    this.tweens.add({
      targets: sprite,
      x: startX,
      y: startY,
      duration: 280,
      ease: 'Bounce.easeOut'
    });

    this.groundCoins.push({
      id: this.nextEntityId++,
      x: startX,
      y: startY,
      value,
      sprite,
      shadow,
      ageSec: 0,
      collected: false
    });
  }

  private refreshHeroCoinStackVisuals(): void {
    const visibleCount = Math.min(
      this.heroCoinStackSprites.length,
      Math.max(0, Math.ceil(this.battleGold / 20))
    );
    const behindOffsetX = -Math.cos(this.heroFacingRad) * 16;
    const behindOffsetY = -Math.sin(this.heroFacingRad) * 11;

    for (let i = 0; i < this.heroCoinStackSprites.length; i++) {
      const sp = this.heroCoinStackSprites[i];
      if (!sp?.active) continue;
      if (i < visibleCount) {
        sp.setVisible(true);
        const sway = Math.sin(this.battleSimTimeSec * 7 + i * 0.45) * (i * 0.32);
        sp.setPosition(
          this.heroX + behindOffsetX + sway,
          this.heroY + behindOffsetY - 6 - i * 4.4
        );
      } else {
        sp.setVisible(false);
      }
    }

    if (this.heroCoinCountLabel?.active) {
      this.heroCoinCountLabel.setPosition(
        this.heroX + behindOffsetX,
        this.heroY + behindOffsetY - 16 - visibleCount * 4.4
      );
      this.heroCoinCountLabel.setText(`🪙 ${Math.floor(this.battleGold)}`);
      this.heroCoinCountLabel.setVisible(this.battleGold > 0);
    }
  }

  private createNightMistPerimeter(): void {
    this.fogGraphics = this.add.graphics().setDepth(32);
    this.redrawNightMistPerimeter();
  }

  private redrawNightMistPerimeter(): void {
    if (!this.fogGraphics?.active) return;
    this.fogGraphics.clear();

    const thLv = GameState.state.buildings.town_hall || 1;
    const mistThickness = Math.max(36, 88 - thLv * 7);

    this.fogGraphics.fillStyle(0x14182e, 0.76);
    this.fogGraphics.fillRect(140, 110, 1040, mistThickness);
    this.fogGraphics.fillRect(140, 1160 - mistThickness, 1040, mistThickness);
    this.fogGraphics.fillRect(140, 110, mistThickness, 1050);
    this.fogGraphics.fillRect(1180 - mistThickness, 110, mistThickness, 1050);

    this.fogGraphics.lineStyle(16, 0x7b3fe4, 0.3);
    this.fogGraphics.strokeRect(
      140 + mistThickness,
      110 + mistThickness,
      1040 - mistThickness * 2,
      1050 - mistThickness * 2
    );
  }

  /**
   * Rebuilds the Fixed Screen-Space Top HUD, Right Side Badges, and Bottom Kingshot 6-Tab Dashboard
   * anchored dynamically to `this.H` (`this.scale.height`), with `.setScrollFactor(0)` on EVERY interactive object!
   */
  private rebuildFixedScreenHud(): void {
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
    this.navTabDots = {};
    this.troopCdTexts = {};

    const H = this.H;

    // =========================================================================
    // 1. TOP KINGS-STYLE HEADER BAR (y = 0..88)
    // =========================================================================
    this.registerHudObj(
      this.add.rectangle(220, 44, 440, 88, 0x10172a, 0.95).setStrokeStyle(2, 0xd97724, 1),
      70
    );
    this.registerHudObj(this.add.rectangle(220, 3, 436, 3, 0xffb020, 0.85), 71);

    // Top-Left Lord Portrait + Power Crest (Tapping opens Panoply & Lord Profile!)
    const lordBtn = this.registerHudObj(
      this.add
        .rectangle(106, 25, 198, 36, 0x1e3a5f, 1)
        .setStrokeStyle(2, 0xffb020, 1)
        .setInteractive({ useHandCursor: true }),
      72
    );
    lordBtn.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.openDashboardModal('panoply');
    });

    this.registerHudObj(
      this.add.rectangle(28, 25, 36, 36, 0x142642, 1).setStrokeStyle(2, 0xffb020, 1),
      73
    );
    this.registerHudObj(this.add.image(28, 25, 'hero_kaelen').setScale(0.58), 74);

    this.powerText = this.registerHudObj(
      this.add
        .text(122, 25, `⚡ ${GameState.getPower().toLocaleString()}`, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#FFB020',
          stroke: '#090C18',
          strokeThickness: 3,
          resolution: 2
        })
        .setOrigin(0.5),
      74
    );

    // Builders & Citizens Status Pills (Center-Top)
    const buildersPill = this.registerHudObj(
      this.add
        .rectangle(246, 25, 64, 30, 0x182b49, 1)
        .setStrokeStyle(1.5, 0x2ce8c8, 0.9)
        .setInteractive({ useHandCursor: true }),
      72
    );
    buildersPill.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.openDashboardModal('buildings');
    });
    this.buildersPillText = this.registerHudObj(
      this.add
        .text(246, 25, `🔨 ${GameState.state.builders.length}/${GameState.getMaxBuilderSlots()}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );

    const citizensPill = this.registerHudObj(
      this.add
        .rectangle(316, 25, 68, 30, 0x182b49, 1)
        .setStrokeStyle(1.5, 0x2ecc71, 0.9)
        .setInteractive({ useHandCursor: true }),
      72
    );
    citizensPill.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.openCitizensAssignmentModal();
    });
    this.citizensPillText = this.registerHudObj(
      this.add
        .text(316, 25, `👥 ${GameState.getAssignedCitizenCount()}/${GameState.getMaxCitizens()}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#2ECC71',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );

    // Speed 1x/2x & Audio Mute Buttons (Top-Right)
    const speedBtn = this.registerHudObj(
      this.add
        .rectangle(374, 25, 36, 30, 0x1e3a5f, 1)
        .setStrokeStyle(1.5, 0xffb020, 1)
        .setInteractive({ useHandCursor: true }),
      72
    );
    const speedTxt = this.registerHudObj(
      this.add
        .text(374, 25, `${this.battleSpeedMult}x`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#FFB020',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );
    speedBtn.on('pointerdown', () => {
      this.battleSpeedMult = this.battleSpeedMult === 1 ? 2 : 1;
      speedTxt.setText(`${this.battleSpeedMult}x`);
      SoundSynthesizer.playSfx('tap');
    });

    const muteBtn = this.registerHudObj(
      this.add
        .rectangle(414, 25, 34, 30, 0x1e3a5f, 1)
        .setStrokeStyle(1.5, 0xb8c0d0, 0.9)
        .setInteractive({ useHandCursor: true }),
      72
    );
    const muteTxt = this.registerHudObj(
      this.add
        .text(414, 25, SoundSynthesizer.isMuted() ? '🔇' : '🔊', {
          fontSize: '14px',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );
    muteBtn.on('pointerdown', () => {
      const next = SoundSynthesizer.toggleUserMute();
      muteTxt.setText(next ? '🔇' : '🔊');
    });

    // Resource Row (y = 53) — Large 13px Bold High-Contrast Typography!
    const r = GameState.state.resources;
    this.resBarText = this.registerHudObj(
      this.add
        .text(
          14,
          53,
          `🌾${Math.floor(r.food)}  🪵${Math.floor(r.wood)}  🪨${Math.floor(r.stone)}  💎${Math.floor(r.shards)}`,
          {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            stroke: '#090C18',
            strokeThickness: 3,
            resolution: 2
          }
        )
        .setOrigin(0, 0.5),
      73
    );

    this.battleGoldText = this.registerHudObj(
      this.add
        .text(378, 53, `🪙 ${Math.floor(this.battleGold)}`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#FFB020',
          stroke: '#090C18',
          strokeThickness: 3,
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );

    // Fortress Wall HP Bar & Wave Status (y = 75)
    this.registerHudObj(
      this.add.rectangle(152, 75, 272, 14, 0x090c18, 1).setStrokeStyle(1.5, 0x3b4d6b, 1),
      72
    );
    this.wallHpFill = this.registerHudObj(
      this.add.rectangle(18, 75, 268, 10, 0x2ecc71, 1).setOrigin(0, 0.5),
      73
    );
    this.wallHpText = this.registerHudObj(
      this.add
        .text(152, 75, `🛡️ Bastione: ${this.wallHp}/${this.maxWallHp}`, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      74
    );

    this.waveText = this.registerHudObj(
      this.add
        .text(364, 75, `${I18n.t('hud.wave')} ${this.waveNumber}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#2CE8C8',
          resolution: 2
        })
        .setOrigin(0.5),
      74
    );

    // =========================================================================
    // 2. RIGHT-SIDE FLOATING FEATURE BADGES (7-Day Login, Chests, Village View, Language)
    // =========================================================================
    const sideFeatures: Array<{
      icon: string;
      label: string;
      hasDot: boolean;
      action: () => void;
    }> = [
      {
        icon: '🎁',
        label: '7 Giorni',
        hasDot: (GameState.state.loginDaysClaimed || 0) < 7,
        action: () => this.openLoginCalendarModal()
      },
      {
        icon: '📦',
        label: 'Baule',
        hasDot: GameState.canClaimFreeChest(),
        action: () => this.openDashboardModal('heroes')
      },
      {
        icon: '🏘️',
        label: 'Città',
        hasDot: false,
        action: () => this.scene.start('VillageScene')
      },
      {
        icon: '🌐',
        label: I18n.getLocale().toUpperCase(),
        hasDot: false,
        action: () => {
          const locales = I18n.getSupportedLocales();
          const next = locales[(locales.indexOf(I18n.getLocale()) + 1) % locales.length] as SupportedLocale;
          I18n.setLocale(next);
          this.scene.restart({ wave: this.waveNumber, isOpeningHook: false, peacefulStart: !this.waveActive });
        }
      }
    ];

    sideFeatures.forEach((sf, idx) => {
      const sy = 148 + idx * 58;
      const btn = this.registerHudObj(
        this.add
          .rectangle(408, sy, 50, 50, 0x10172a, 0.92)
          .setStrokeStyle(2, 0xffb020, 0.95)
          .setInteractive({ useHandCursor: true }),
        72
      );
      btn.on('pointerdown', () => {
        SoundSynthesizer.playSfx('tap');
        sf.action();
      });
      this.registerHudObj(
        this.add.text(408, sy - 7, sf.icon, { fontSize: '18px', resolution: 2 }).setOrigin(0.5),
        73
      );
      this.registerHudObj(
        this.add
          .text(408, sy + 14, sf.label, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        73
      );
      if (sf.hasDot) {
        this.registerHudObj(
          this.add.circle(428, sy - 19, 6, 0xff3b5c, 1).setStrokeStyle(1.5, 0xfff3d1, 1),
          74
        );
      }
    });

    // =========================================================================
    // 3. BOTTOM INNOVATIVE KINGSHOT DASHBOARD (Anchored dynamically to H!)
    // =========================================================================
    const combatRowY = H - 134;
    const questRowY = H - 84;
    const navDockY = H - 32;

    // 3A. Tactical Combat Strip (Hero Ultimate + 3 Troop Squads + Call Wave / Tower Select)
    const ultBtn = this.registerHudObj(
      this.add
        .rectangle(52, combatRowY, 88, 42, 0xd97724, 0.96)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      72
    );
    ultBtn.on('pointerdown', () => this.triggerHeroUltimate());
    this.registerHudObj(
      this.add
        .text(52, combatRowY - 9, '☀️ KAELEN', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );
    this.heroCdText = this.registerHudObj(
      this.add
        .text(52, combatRowY + 9, '⚡ PRONTO', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#14182E',
          backgroundColor: '#FFB020',
          padding: { x: 4, y: 1 },
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );

    const troopBtns: Array<{ id: TroopTypeId; label: string; x: number }> = [
      { id: 'infantry', label: '🛡️ Fanteria', x: 142 },
      { id: 'archers', label: '🏹 Arcieri', x: 228 },
      { id: 'cavalry', label: '🐎 Cavalleria', x: 314 }
    ];
    for (const tb of troopBtns) {
      const b = this.registerHudObj(
        this.add
          .rectangle(tb.x, combatRowY, 80, 42, 0x162944, 0.95)
          .setStrokeStyle(1.8, 0xffb020, 0.9)
          .setInteractive({ useHandCursor: true }),
        72
      );
      b.on('pointerdown', () => this.deployTroopSquad(tb.id));
      this.registerHudObj(
        this.add
          .text(tb.x, combatRowY - 9, tb.label, {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        73
      );
      const cdTxt = this.registerHudObj(
        this.add
          .text(tb.x, combatRowY + 9, `🪙 ${TROOP_DEPLOY_COSTS[tb.id]}`, {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#2ECC71',
            resolution: 2
          })
          .setOrigin(0.5),
        73
      );
      this.troopCdTexts[tb.id] = cdTxt;
    }

    const waveCallQuickBtn = this.registerHudObj(
      this.add
        .rectangle(398, combatRowY, 72, 42, 0x1e4631, 0.96)
        .setStrokeStyle(2, 0x2ecc71, 1)
        .setInteractive({ useHandCursor: true }),
      72
    );
    waveCallQuickBtn.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.ringAlarmBellForNextWave();
    });
    this.registerHudObj(
      this.add
        .text(398, combatRowY - 8, '🔔 ONDATA', {
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );
    this.registerHudObj(
      this.add
        .text(398, combatRowY + 9, 'CHIAMA', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#2ECC71',
          resolution: 2
        })
        .setOrigin(0.5),
      73
    );

    // 3B. Kingshot Parchment Chapter Quest Scroll Banner (y = H - 84)
    const questBg = this.registerHudObj(
      this.add
        .rectangle(220, questRowY, 428, 44, 0xf5e6c8, 0.98)
        .setStrokeStyle(2.5, 0xd97724, 1)
        .setInteractive({ useHandCursor: true }),
      72
    );
    questBg.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      const claimed = GameState.claimCurrentChapterMission();
      if (claimed) {
        SoundSynthesizer.playSfx('upgrade');
        if (claimed.gold) this.battleGold += claimed.gold;
        GameState.saveToBridge();
        this.spawnFloatingText(this.heroX, this.heroY - 40, '🎁 MISSIONE COMPLETATA!', '#2ECC71', 15);
        this.refreshHeroCoinStackVisuals();
        this.refreshHud();
      } else {
        this.navigateToCurrentQuestTarget();
      }
    });

    this.registerHudObj(
      this.add.text(28, questRowY, '📜', { fontSize: '22px', resolution: 2 }).setOrigin(0.5),
      73
    );

    this.missionBarText = this.registerHudObj(
      this.add
        .text(48, questRowY - 8, '', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#2C1810',
          resolution: 2
        })
        .setOrigin(0, 0.5),
      73
    );

    // Green Progress Bar inside Parchment Banner
    this.registerHudObj(
      this.add.rectangle(185, questRowY + 11, 268, 10, 0x3b2818, 0.85).setStrokeStyle(1, 0x8c5828, 1),
      73
    );
    this.missionProgressFill = this.registerHudObj(
      this.add.rectangle(52, questRowY + 11, 130, 8, 0x2ecc71, 1).setOrigin(0, 0.5),
      74
    );

    // Right CTA Pill inside Parchment Quest Banner
    this.registerHudObj(
      this.add.rectangle(378, questRowY, 92, 32, 0x2ecc71, 1).setStrokeStyle(1.8, 0x14532d, 1),
      73
    );
    this.missionActionText = this.registerHudObj(
      this.add
        .text(378, questRowY, 'VAI ➔', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#10172A',
          resolution: 2
        })
        .setOrigin(0.5),
      74
    );
    this.missionDot = this.registerHudObj(
      this.add.circle(422, questRowY - 14, 7, 0xff3b5c, 1).setStrokeStyle(1.5, 0xffffff, 1),
      75
    );

    // 3C. 6-Tab Kingshot Bottom Navigation Dock (y = H - 32)
    // Matches Screenshot 1 & 2: Warm Beveled Stone/Parchment Cards with Gold Trim!
    this.registerHudObj(
      this.add.rectangle(220, navDockY, 440, 62, 0x161f35, 0.98).setStrokeStyle(2, 0xd97724, 1),
      72
    );

    const tabs: Array<{ id: DashboardTabId; icon: string; label: string }> = [
      { id: 'conquest', icon: '⚔️', label: 'Conquista' },
      { id: 'heroes', icon: '👑', label: 'Eroi' },
      { id: 'panoply', icon: '🎒', label: 'Panoplia' },
      { id: 'buildings', icon: '🏛️', label: 'Edifici' },
      { id: 'missions', icon: '📜', label: 'Decreti' },
      { id: 'hexmap', icon: '🗺️', label: 'Regno' }
    ];

    tabs.forEach((tab, idx) => {
      const tx = 39 + idx * 72.4;
      const tabCard = this.registerHudObj(
        this.add
          .rectangle(tx, navDockY, 68, 52, 0xe8d8be, 1)
          .setStrokeStyle(2, 0xb4692e, 1)
          .setInteractive({ useHandCursor: true }),
        73
      );
      tabCard.on('pointerdown', () => {
        SoundSynthesizer.playSfx('tap');
        this.openDashboardModal(tab.id);
      });

      this.registerHudObj(
        this.add.text(tx, navDockY - 8, tab.icon, { fontSize: '20px', resolution: 2 }).setOrigin(0.5),
        74
      );
      this.registerHudObj(
        this.add
          .text(tx, navDockY + 15, tab.label, {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#2C1810',
            resolution: 2
          })
          .setOrigin(0.5),
        74
      );

      const dot = this.registerHudObj(
        this.add
          .circle(tx + 25, navDockY - 19, 6, 0xff3b5c, 1)
          .setStrokeStyle(1.5, 0xffffff, 1)
          .setVisible(false),
        75
      );
      this.navTabDots[tab.id] = dot;
    });

    if (!this.waveActive) {
      this.showPeacefulCallWaveBar();
    }

    this.refreshHud();
  }

  private navigateToCurrentQuestTarget(): void {
    const m = GameState.getCurrentChapterMission();
    if (!m) return;
    if (m.type === 'building_level' && m.buildingId) {
      const pad = this.buildingPads.find((b) => b.buildingId === m.buildingId);
      if (pad) {
        this.openBuildingUpgradeModal(pad);
        return;
      }
    }
    this.openDashboardModal('conquest');
  }

  private createOffScreenRadarPool(): void {
    this.radarBadges = [];
    for (let i = 0; i < 6; i++) {
      const container = this.add.container(220, 300).setScrollFactor(0).setDepth(74).setVisible(false);
      const pointer = this.add.triangle(0, -24, 0, -8, -7, 6, 7, 6, 0xff3b5c, 1);
      const bg = this.add.circle(0, 0, 20, 0xd9383a, 0.95).setStrokeStyle(2.5, 0xfff3d1, 1);
      const iconText = this.add.text(0, -4, '👹', { fontSize: '14px', resolution: 2 }).setOrigin(0.5);
      const distText = this.add
        .text(0, 11, '4m', {
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          stroke: '#14182E',
          strokeThickness: 2,
          resolution: 2
        })
        .setOrigin(0.5);

      container.add([pointer, bg, iconText, distText]);
      this.radarBadges.push({ container, bg, pointer, iconText, distText });
    }
  }

  private updateOffScreenRadarBadges(): void {
    const cam = this.cameras.main;
    const viewLeft = cam.scrollX;
    const viewRight = cam.scrollX + 440;
    const viewTop = cam.scrollY + 95;
    const viewBottom = cam.scrollY + (this.H - 165);

    const targets: Array<{ x: number; y: number; isEnemy: boolean; icon: string }> = [];

    for (const e of this.enemies) {
      if (e.x < viewLeft + 24 || e.x > viewRight - 24 || e.y < viewTop + 24 || e.y > viewBottom - 24) {
        targets.push({
          x: e.x,
          y: e.y,
          isEnemy: true,
          icon: e.isBoss ? '💀' : '👹'
        });
      }
      if (targets.length >= 4) break;
    }

    if (
      this.KEEP_X < viewLeft + 30 ||
      this.KEEP_X > viewRight - 30 ||
      this.KEEP_Y < viewTop + 30 ||
      this.KEEP_Y > viewBottom - 30
    ) {
      targets.push({
        x: this.KEEP_X,
        y: this.KEEP_Y,
        isEnemy: false,
        icon: '🏰'
      });
    }

    for (let i = 0; i < this.radarBadges.length; i++) {
      const badge = this.radarBadges[i];
      const t = targets[i];
      if (!t) {
        badge.container.setVisible(false);
        continue;
      }

      const dx = t.x - this.heroX;
      const dy = t.y - this.heroY;
      const distMeters = Math.max(1, Math.round(Math.hypot(dx, dy) / 48));
      const angle = Math.atan2(dy, dx);

      const screenX = Phaser.Math.Clamp(t.x - cam.scrollX, 38, 355);
      const screenY = Phaser.Math.Clamp(t.y - cam.scrollY, 125, this.H - 185);

      badge.container.setPosition(screenX, screenY);
      badge.container.setVisible(true);
      badge.bg.setFillStyle(t.isEnemy ? 0xd9383a : 0x2478cc, 0.95);
      badge.pointer.setFillStyle(t.isEnemy ? 0xff3b5c : 0x4aa8ff, 1);
      badge.pointer.setRotation(angle + Math.PI / 2);
      badge.pointer.setPosition(Math.cos(angle) * 23, Math.sin(angle) * 23);
      badge.iconText.setText(t.icon);
      badge.distText.setText(`${distMeters}m`);
    }
  }

  private createVirtualThumbJoystick(): void {
    this.joyOriginX = 220;
    this.joyOriginY = this.H - 225;

    this.joyBaseRing = this.add
      .image(this.joyOriginX, this.joyOriginY, 'ui_joystick_base')
      .setScrollFactor(0)
      .setDepth(68)
      .setAlpha(0.62);

    this.joyThumbKnob = this.add
      .image(this.joyOriginX, this.joyOriginY, 'ui_joystick_thumb')
      .setScrollFactor(0)
      .setDepth(69)
      .setAlpha(0.82);

    this.joyHintText = this.add
      .text(this.joyOriginX, this.joyOriginY + 50, '🕹️ Trascina per muovere • Tocca Edifici/Torri', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        backgroundColor: 'rgba(16,23,42,0.88)',
        padding: { x: 8, y: 3 },
        resolution: 2
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(69);

    this.tweens.add({
      targets: this.joyHintText,
      alpha: 0,
      delay: 2400,
      duration: 500,
      onComplete: () => {
        if (this.joyHintText?.active) this.joyHintText.setVisible(false);
      }
    });

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      };
    }

    // Playfield Tap-vs-Drag Disambiguation:
    // - Dragging > 10px controls the thumb joystick smoothly
    // - Tapping <= 12px on any Building, House, Watchtower, or Bell opens its connected menu!
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.modalObjects.length > 0) return;
      if (pointer.y < 92 || pointer.y > this.H - 158 || (pointer.x > 376 && pointer.y < 380)) {
        return;
      }

      this.joyActive = true;
      this.joyPointerId = pointer.id;
      this.joyOriginX = pointer.x;
      this.joyOriginY = pointer.y;
      this.joyMaxDragPx = 0;
      this.joyDownWorldX = pointer.worldX;
      this.joyDownWorldY = pointer.worldY;
      this.joyBaseRing.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(0.92);
      this.joyThumbKnob.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(1);
      this.joyHintText.setVisible(false);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.modalObjects.length > 0) return;
      if (!this.joyActive || pointer.id !== this.joyPointerId) return;

      const dx = pointer.x - this.joyOriginX;
      const dy = pointer.y - this.joyOriginY;
      const maxRadius = 46;
      const dist = Math.hypot(dx, dy);
      this.joyMaxDragPx = Math.max(this.joyMaxDragPx, dist);

      if (dist > 5) {
        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        this.joyVecX = (Math.cos(angle) * clamped) / maxRadius;
        this.joyVecY = (Math.sin(angle) * clamped) / maxRadius;
        this.joyThumbKnob.setPosition(
          this.joyOriginX + Math.cos(angle) * clamped,
          this.joyOriginY + Math.sin(angle) * clamped
        );
      } else {
        this.joyVecX = 0;
        this.joyVecY = 0;
        this.joyThumbKnob.setPosition(this.joyOriginX, this.joyOriginY);
      }
    });

    const endJoy = (pointer: Phaser.Input.Pointer) => {
      if (this.joyActive && (pointer.id === this.joyPointerId || !pointer.isDown)) {
        const wasCleanTap = this.joyMaxDragPx <= 14;
        const tapWorldX = pointer.worldX || this.joyDownWorldX;
        const tapWorldY = pointer.worldY || this.joyDownWorldY;
        this.resetJoystickState();
        if (wasCleanTap && this.modalObjects.length === 0) {
          this.handleWorldTap(tapWorldX, tapWorldY);
        }
      }
    };

    this.input.on('pointerup', endJoy);
    this.input.on('pointerupoutside', endJoy);
  }

  private resetJoystickState(): void {
    this.joyActive = false;
    this.joyPointerId = null;
    this.joyVecX = 0;
    this.joyVecY = 0;
    this.joyOriginX = 220;
    this.joyOriginY = this.H - 225;
    if (this.joyBaseRing?.active) {
      this.joyBaseRing.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(0.55);
    }
    if (this.joyThumbKnob?.active) {
      this.joyThumbKnob.setPosition(this.joyOriginX, this.joyOriginY).setAlpha(0.75);
    }
  }

  /**
   * Handles a deliberate Tap anywhere on the 2.5D isometric village/valley:
   * Connects every Watchtower, House, Building, and Alarm Bell to its interactive card!
   */
  public handleWorldTap(worldX: number, worldY: number): boolean {
    let bestSlot: TurretSlotState | null = null;
    let bestSlotDist = 58;
    for (const slot of this.slots) {
      const dSlot = Math.min(
        Phaser.Math.Distance.Between(worldX, worldY, slot.x, slot.y - 10),
        Phaser.Math.Distance.Between(worldX, worldY, slot.bubbleBg.x, slot.bubbleBg.y)
      );
      if (dSlot < bestSlotDist) {
        bestSlotDist = dSlot;
        bestSlot = slot;
      }
    }

    let bestPad: WorldBuildingPad | null = null;
    let bestPadDist = 72;
    for (const pad of this.buildingPads) {
      const dSprite = Phaser.Math.Distance.Between(worldX, worldY, pad.x, pad.y - 8);
      const dPad = Phaser.Math.Distance.Between(worldX, worldY, pad.padX, pad.padY);
      const dBubble = Phaser.Math.Distance.Between(worldX, worldY, pad.bubbleBg.x, pad.bubbleBg.y);
      const minD = Math.min(dSprite, dPad, dBubble);
      if (minD < bestPadDist) {
        bestPadDist = minD;
        bestPad = pad;
      }
    }

    if (bestSlot && (!bestPad || bestSlotDist <= bestPadDist)) {
      SoundSynthesizer.playSfx('tap');
      this.openTowerSelectionModal(bestSlot.index);
      return true;
    }

    if (bestPad) {
      SoundSynthesizer.playSfx('tap');
      if (bestPad.isAlarmBell) {
        this.ringAlarmBellForNextWave();
      } else {
        this.openBuildingUpgradeModal(bestPad);
      }
      return true;
    }

    return false;
  }

  private getCurrentQuestTargetPoint(): { x: number; y: number } | null {
    const m = GameState.getCurrentChapterMission();
    if (!m) return null;
    if (m.descKey.includes('farm')) {
      const p = this.buildingPads.find((b) => b.buildingId === 'farm');
      if (p) return { x: p.padX, y: p.padY };
    } else if (m.descKey.includes('lumber') || m.descKey.includes('ch1_3')) {
      const p = this.buildingPads.find((b) => b.buildingId === 'lumber_mill');
      if (p) return { x: p.padX, y: p.padY };
    } else if (m.descKey.includes('town_hall') || m.descKey.includes('ch1_4') || m.descKey.includes('ch3_1')) {
      const p = this.buildingPads.find((b) => b.buildingId === 'town_hall');
      if (p) return { x: p.padX, y: p.padY };
    } else if (m.descKey.includes('mine') || m.descKey.includes('ch2_1')) {
      const p = this.buildingPads.find((b) => b.buildingId === 'mine');
      if (p) return { x: p.padX, y: p.padY };
    } else if (m.descKey.includes('workshop') || m.descKey.includes('ch2_3')) {
      const p = this.buildingPads.find((b) => b.buildingId === 'turret_workshop');
      if (p) return { x: p.padX, y: p.padY };
    } else if (!this.waveActive) {
      const bell = this.buildingPads.find((b) => b.isAlarmBell);
      if (bell) return { x: bell.padX, y: bell.padY };
    }
    return null;
  }

  private updateQuestGuideLine(): void {
    if (!this.heroQuestGuideGraphics?.active) return;
    this.heroQuestGuideGraphics.clear();

    const target = this.getCurrentQuestTargetPoint();
    if (!target) return;

    const dx = target.x - this.heroX;
    const dy = target.y - this.heroY;
    const dist = Math.hypot(dx, dy);
    if (dist < 42) return;

    this.heroQuestGuideGraphics.lineStyle(3.5, 0xffb020, 0.78);
    const steps = Math.min(10, Math.floor(dist / 28));
    const phaseOffset = (this.battleSimTimeSec * 2.5) % 1;
    for (let i = 0; i < steps; i++) {
      const t0 = (i + phaseOffset * 0.5) / steps;
      const t1 = Math.min(1, t0 + 0.45 / steps);
      this.heroQuestGuideGraphics.lineBetween(
        Phaser.Math.Linear(this.heroX, target.x, t0),
        Phaser.Math.Linear(this.heroY + 10, target.y, t0),
        Phaser.Math.Linear(this.heroX, target.x, t1),
        Phaser.Math.Linear(this.heroY + 10, target.y, t1)
      );
    }

    const pulse = 20 + Math.sin(this.battleSimTimeSec * 6) * 4;
    this.heroQuestGuideGraphics.lineStyle(3, 0x2ecc71, 0.92);
    this.heroQuestGuideGraphics.strokeCircle(target.x, target.y, pulse);
  }

  private getTurretUpgradeCost(type: TurretTypeId, currentLevel: number): number {
    const cfg = balancingData.turrets[type];
    if (currentLevel <= 0) return cfg.buildCostBattleGold;
    return cfg.inBattleUpgradeCosts[Math.min(cfg.inBattleUpgradeCosts.length - 1, currentLevel - 1)] || 120;
  }

  public buildOrUpgradeSlot(slotIndex: number, type: TurretTypeId, free = false): boolean {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.unlocked) return false;

    const cfg = balancingData.turrets[type];
    const isUpgrade = slot.turretType === type && slot.level > 0;
    const nextLevel = isUpgrade ? slot.level + 1 : 1;
    const maxLv = cfg.inBattleMultipliers.length;
    if (nextLevel > maxLv) return false;

    const cost = free ? 0 : this.getTurretUpgradeCost(type, isUpgrade ? slot.level : 0);
    if (!free && this.battleGold < cost) return false;
    this.battleGold -= cost;

    slot.turretType = type;
    slot.level = nextLevel;
    slot.coinsFed = 0;
    slot.coinsRequired = this.getTurretUpgradeCost(type, slot.level);

    if (slot.turretSprite) {
      slot.turretSprite.setTexture(`turret_${type}`);
    } else {
      slot.turretSprite = this.add.image(slot.x, slot.y - 14, `turret_${type}`).setDepth(19);
    }

    const iconMap: Record<TurretTypeId, string> = {
      archer: '🏹',
      cannon: '💣',
      magic: '🔮',
      ice: '❄️',
      mortar: '☄️'
    };
    slot.bubbleIcon.setText(iconMap[type]);

    slot.turretSprite.setScale(0.65 + nextLevel * 0.08);
    this.tweens.add({
      targets: slot.turretSprite,
      scaleX: 1.08 + (nextLevel - 1) * 0.08,
      scaleY: 1.08 + (nextLevel - 1) * 0.08,
      duration: 280,
      ease: 'Back.easeOut'
    });

    slot.labelText.setText(`${I18n.t(`turret.${type}`)} Lv.${slot.level}`);
    slot.costBadge.setText(slot.level >= maxLv ? 'MAX' : `🪙 ${slot.coinsRequired}`);
    slot.fillBarFg.width = 0;

    if (!free) {
      GameState.recordDailyAction('turretsBuilt', 1);
    }

    this.sparkEmitter.explode(14, slot.x, slot.y - 10);
    SoundSynthesizer.playSfx('upgrade');
    this.refreshHeroCoinStackVisuals();
    this.refreshHud();
    return true;
  }

  public feedCoinsToBuildingPad(pad: WorldBuildingPad, coinsToFeed = 1): boolean {
    if (pad.isAlarmBell) {
      if (this.bellRingCooldownSec <= 0) {
        this.bellRingCooldownSec = 3.0;
        this.ringAlarmBellForNextWave();
        return true;
      }
      return false;
    }
    if (this.battleGold <= 0) return false;

    const amount = Math.min(this.battleGold, coinsToFeed * 5, pad.coinsRequired - pad.coinsFed);
    if (amount <= 0) return false;

    this.battleGold -= amount;
    pad.coinsFed += amount;
    this.spawnParabolicCoinArc(this.heroX, this.heroY - 24, pad.padX, pad.padY);
    SoundSynthesizer.playSfx('coin');

    const ratio = Phaser.Math.Clamp(pad.coinsFed / Math.max(1, pad.coinsRequired), 0, 1);
    pad.fillBarFg.width = 50 * ratio;
    pad.costText.setText(`🪙 ${Math.max(0, Math.ceil(pad.coinsRequired - pad.coinsFed))}`);

    if (pad.coinsFed >= pad.coinsRequired) {
      this.completeBuildingPadLevelUp(pad);
    }

    this.refreshHeroCoinStackVisuals();
    this.refreshHud();
    return true;
  }

  private completeBuildingPadLevelUp(pad: WorldBuildingPad): void {
    pad.coinsFed = 0;
    pad.level += 1;
    pad.coinsRequired = Math.round(pad.coinsRequired * 1.42);
    pad.fillBarFg.width = 0;
    pad.costText.setText(`🪙 ${pad.coinsRequired}`);
    pad.levelBadge.setText(`Lv.${pad.level}`).setBackgroundColor('#FFB020');
    pad.sprite.setAlpha(1);

    if (pad.buildingId) {
      const currentLv = GameState.state.buildings[pad.buildingId] || 0;
      const maxLv = balancingData.buildings[pad.buildingId].maxLevel;
      if (currentLv < maxLv) {
        GameState.state.buildings[pad.buildingId] = currentLv + 1;
      }
      const tier = GameState.getVisualTier(pad.buildingId);
      pad.sprite.setTexture(`building_${pad.buildingId}_t${tier}`);
      if (pad.buildingId === 'town_hall') {
        this.redrawNightMistPerimeter();
      }
      if (pad.buildingId === 'walls') {
        const mults = GameState.getCombatMultipliers();
        this.maxWallHp = mults.wallHp;
        this.wallHp = Math.min(this.maxWallHp, this.wallHp + 350);
      }
      GameState.recordDailyAction('upgradesDone', 1);
    } else if (pad.houseIndex) {
      if (!GameState.state.houseLevels) GameState.state.houseLevels = [1, 1, 1, 1, 1];
      GameState.state.houseLevels[pad.houseIndex - 1] = pad.level;
      const hTier = pad.level >= 5 ? 3 : pad.level >= 3 ? 2 : 1;
      pad.sprite.setTexture(`building_house_t${hTier}`);
      GameState.state.morale = Math.min(100, GameState.state.morale + 3);
      GameState.recordDailyAction('upgradesDone', 1);
    }

    const baseScale = pad.buildingId === 'town_hall' ? 1.28 : pad.houseIndex ? 1.15 : 1.18;
    this.tweens.add({
      targets: pad.sprite,
      scaleX: { from: baseScale * 1.22, to: baseScale },
      scaleY: { from: baseScale * 0.8, to: baseScale },
      duration: 340,
      ease: 'Back.easeOut'
    });
    this.sparkEmitter.explode(22, pad.x, pad.y);
    SoundSynthesizer.playSfx('upgrade');
    this.spawnFloatingText(pad.x, pad.y - 42, `⚡ ${pad.name} Lv.${pad.level}!`, '#2ECC71', 14);
    GameState.notify();
    GameState.saveToBridge();
  }

  private feedSingleCoinToTurretSlot(slot: TurretSlotState): boolean {
    if (!slot.unlocked || this.battleGold < 5) return false;
    const typeToUse = slot.turretType || this.selectedTurretType;
    const cfg = balancingData.turrets[typeToUse];
    if (slot.level >= cfg.inBattleMultipliers.length) return false;

    const step = Math.min(10, this.battleGold, slot.coinsRequired - slot.coinsFed);
    if (step <= 0) return false;

    this.battleGold -= step;
    slot.coinsFed += step;
    this.spawnParabolicCoinArc(this.heroX, this.heroY - 24, slot.x, slot.y);
    SoundSynthesizer.playSfx('coin');

    const ratio = Phaser.Math.Clamp(slot.coinsFed / Math.max(1, slot.coinsRequired), 0, 1);
    slot.fillBarFg.width = 50 * ratio;
    slot.costBadge.setText(`🪙 ${Math.max(0, Math.ceil(slot.coinsRequired - slot.coinsFed))}`);

    if (slot.coinsFed >= slot.coinsRequired) {
      this.buildOrUpgradeSlot(slot.index, typeToUse, true);
    } else {
      this.refreshHeroCoinStackVisuals();
      this.refreshHud();
    }
    return true;
  }

  private spawnParabolicCoinArc(fromX: number, fromY: number, toX: number, toY: number): void {
    const coin = this.add.image(fromX, fromY, 'particle_coin').setDepth(42);
    const midX = (fromX + toX) * 0.5;
    const peakY = Math.min(fromY, toY) - 48;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 220,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const u = 1 - t;
        const x = u * u * fromX + 2 * u * t * midX + t * t * toX;
        const y = u * u * fromY + 2 * u * t * peakY + t * t * toY;
        coin.setPosition(x, y);
      },
      onComplete: () => {
        coin.destroy();
      }
    });
  }

  private spawnRetinueGuard(type: TroopTypeId): void {
    const cfg = balancingData.troops[type];
    const mults = GameState.getCombatMultipliers();
    const idx = this.troops.length;
    const angle = this.heroFacingRad + Math.PI + ((idx % 4) - 1.5) * 0.55;
    const dist = 42 + Math.floor(idx / 4) * 26;
    const rawX = this.heroX + Math.cos(angle) * dist;
    const rawY = this.heroY + Math.sin(angle) * dist;
    const walked = this.resolveWalkablePosition(this.heroX, this.heroY, rawX, rawY);

    const shadow = this.add.ellipse(walked.x, walked.y + 11, 22, 9, 0x090c18, 0.45).setDepth(21);
    const sprite = this.add.image(walked.x, walked.y, `troop_${type}`).setScale(1.12).setDepth(23);
    const hpBarFill = this.add
      .rectangle(walked.x - 11, walked.y - 18, 22, 3.5, 0x2ecc71, 1)
      .setOrigin(0, 0.5)
      .setDepth(24);

    const maxHp = Math.round(cfg.hpPerUnit * mults.troopStatMult);
    const rangePx = 'rangePx' in cfg ? (cfg as { rangePx: number }).rangePx : 34;
    const knockbackPx =
      'chargeKnockbackPx' in cfg ? (cfg as { chargeKnockbackPx: number }).chargeKnockbackPx : 0;

    this.troops.push({
      id: this.nextEntityId++,
      typeId: type,
      sprite,
      shadow,
      hpBarFill,
      x: walked.x,
      y: walked.y,
      formationIndex: idx,
      hp: maxHp,
      maxHp,
      dps: cfg.dpsPerUnit * mults.troopStatMult,
      rangePx,
      speedPx: 132,
      armor: cfg.armor,
      knockbackPx,
      attackCooldown: 0
    });
  }

  public deployTroopSquad(type: TroopTypeId): boolean {
    if (this.troopCooldowns[type] > 0) return false;
    const cfg = balancingData.troops[type];
    const goldCost = TROOP_DEPLOY_COSTS[type];
    if (this.battleGold < goldCost) return false;

    this.battleGold -= goldCost;
    this.troopCooldowns[type] = cfg.deployCooldownSec;

    for (let i = 0; i < cfg.squadSize; i++) {
      this.spawnRetinueGuard(type);
    }

    GameState.recordDailyAction('squadsDeployed', 1);
    SoundSynthesizer.playSfx('tap');
    this.updateSynergyState();
    this.refreshHeroCoinStackVisuals();
    this.refreshHud();
    return true;
  }

  private updateSynergyState(): void {
    const activeTypes = new Set(this.troops.map((t) => t.typeId));
    this.synergyActive = activeTypes.size >= 2;
  }

  public triggerHeroUltimate(): boolean {
    if (this.heroCooldownSec > 0) return false;
    const kaelenCfg = balancingData.heroes.find((h) => h.id === 'kaelen')!;
    const hState = GameState.state.heroes.kaelen || { unlocked: true, level: 1, stars: 1 };
    this.heroCooldownSec = kaelenCfg.activeSkill.cooldownSec;

    SoundSynthesizer.playSfx('ultimate');
    this.addTrauma(0.55);

    const ring = this.add
      .circle(this.heroX, this.heroY, 24, 0xffb020, 0.45)
      .setStrokeStyle(4, 0xfff3d1, 1)
      .setDepth(40);
    this.tweens.add({
      targets: ring,
      radius: 270,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });

    const baseDmg =
      kaelenCfg.activeSkill.baseDamage * (1 + (hState.level - 1) * 0.15) * hState.stars;
    const stunSec = kaelenCfg.activeSkill.stunSec ?? 1.5;
    const now = this.battleSimTimeSec;

    for (const enemy of this.enemies) {
      enemy.hp -= baseDmg;
      enemy.stunUntilSec = Math.max(enemy.stunUntilSec, now + stunSec);
      this.sparkEmitter.explode(10, enemy.x, enemy.y);
      this.spawnFloatingText(enemy.x, enemy.y - 18, `☀️ ${Math.round(baseDmg)}!`, '#FFB020', 15);
    }

    this.wallHp = Math.min(this.maxWallHp, Math.round(this.wallHp + this.maxWallHp * 0.14));
    this.heroHp = Math.min(this.heroMaxHp, Math.round(this.heroHp + this.heroMaxHp * 0.25));
    this.refreshHud();
    return true;
  }

  public ringAlarmBellForNextWave(): void {
    SoundSynthesizer.playSfx('boss_horn');
    if (
      !this.waveActive ||
      this.waveEnded ||
      (this.enemies.length === 0 && this.spawnQueue.length === 0)
    ) {
      this.closeModal();
      this.clearPeacefulWaveBanner();
      this.waveNumber = GameState.state.currentWave || this.waveNumber;
      this.waveActive = true;
      this.waveEnded = false;
      this.buildWaveSpawnQueue();
      SoundSynthesizer.playMusic(this.waveNumber % 5 === 0 ? 'boss' : 'battle');
      this.showFloatingBanner(`🔔 ${I18n.t('hud.wave')} ${this.waveNumber} IN ARRIVO!`, 0xffb020);
    } else {
      this.battleGold += 25;
      this.spawnFloatingText(580, 660, '🔔 +25 🪙 BONUS CORAGGIO!', '#FFB020', 14);
      this.refreshHeroCoinStackVisuals();
      this.refreshHud();
    }
  }

  private buildWaveSpawnQueue(): void {
    this.spawnQueue = [];
    const w = this.waveNumber;
    const count = this.isOpeningHook ? 10 : Math.min(34, 9 + Math.floor(w * 2.1));

    for (let i = 0; i < count; i++) {
      const roll = (i * 7 + w * 3) % 10;
      let typeId = 'mist_runner';
      if (roll >= 3 && roll <= 5) typeId = 'veil_grunt';
      else if (w >= 2 && roll >= 6 && roll <= 7) typeId = 'dread_shield';
      else if (w >= 3 && roll === 8) typeId = 'gloom_wing';
      else if (roll === 9) typeId = 'swarm_crawler';

      const lane = (i % 3) as 0 | 1 | 2;
      this.spawnQueue.push({
        typeId,
        delaySec: i === 0 ? 0.3 : 0.85,
        lane
      });
    }

    if (w % 10 === 0) {
      this.spawnQueue.push({ typeId: 'eclipse_herald', delaySec: 1.5, lane: 0 });
    } else if (w % 5 === 0) {
      this.spawnQueue.push({ typeId: 'veil_champion', delaySec: 1.4, lane: 0 });
    }

    this.totalWaveEnemies = this.spawnQueue.length;
    this.killedWaveEnemies = 0;
    this.spawnTimerSec = 0;
  }

  private spawnEnemyFromQueue(item: { typeId: string; lane: 0 | 1 | 2 }): void {
    const enemyTable = balancingData.enemies as Record<
      string,
      {
        id: string;
        archetype: string;
        baseHp: number;
        speedPx: number;
        armor: number;
        wallDamage: number;
        battleGoldBounty: number;
      }
    >;
    const cfg = enemyTable[item.typeId] || enemyTable.mist_runner;
    const wExp = Math.max(0, this.waveNumber - 1);
    const hookFactor = this.isOpeningHook ? 0.65 : 1.0;

    const maxHp = Math.round(
      cfg.baseHp * Math.pow(balancingData.waves.hpGrowthPerWave, wExp) * hookFactor
    );
    const wallDamage = Math.round(cfg.wallDamage * Math.pow(1.09, wExp));
    const bounty = Math.round(
      cfg.battleGoldBounty * Math.pow(balancingData.waves.bountyGrowthPerWave, wExp)
    );
    const isBoss = cfg.archetype === 'mini_boss' || cfg.archetype === 'major_boss';

    let startX = 660;
    let startY = 148;
    let waypoints: Array<{ x: number; y: number }> = [];

    if (item.lane === 0) {
      startX = 660 + Phaser.Math.Between(-22, 22);
      startY = 148;
      waypoints = [
        { x: 660, y: 320 },
        { x: 660, y: this.FORT_TOP - 8 }
      ];
    } else if (item.lane === 1) {
      startX = 155;
      startY = 620 + Phaser.Math.Between(-18, 18);
      waypoints = [
        { x: 245, y: 695 },
        { x: this.FORT_LEFT - 8, y: 740 }
      ];
    } else {
      startX = 1165;
      startY = 620 + Phaser.Math.Between(-18, 18);
      waypoints = [
        { x: 1075, y: 695 },
        { x: this.FORT_RIGHT + 8, y: 740 }
      ];
    }

    const shadow = this.add
      .ellipse(startX, startY + (isBoss ? 24 : 13), isBoss ? 48 : 26, isBoss ? 20 : 11, 0x090c18, 0.5)
      .setDepth(19);
    const sprite = this.add
      .image(startX, startY, `enemy_${cfg.id}`)
      .setScale(1.12)
      .setDepth(isBoss ? 25 : 22);

    const barW = isBoss ? 56 : 30;
    const hpBarBg = this.add
      .rectangle(startX, startY - (isBoss ? 36 : 22), barW, 5.5, 0x090c18, 0.9)
      .setDepth(26);
    const hpBarFill = this.add
      .rectangle(startX - barW / 2, startY - (isBoss ? 36 : 22), barW, 5.5, 0xff3b5c, 1)
      .setOrigin(0, 0.5)
      .setDepth(27);

    this.enemies.push({
      id: this.nextEntityId++,
      typeId: cfg.id,
      sprite,
      shadow,
      hpBarBg,
      hpBarFill,
      x: startX,
      y: startY,
      lane: item.lane,
      waypoints,
      waypointIdx: 0,
      hp: maxHp,
      maxHp,
      speedPx: cfg.speedPx * 1.35,
      armor: cfg.armor,
      wallDamage,
      bounty,
      slowUntilSec: 0,
      slowFactor: 1,
      burnUntilSec: 0,
      burnDps: 0,
      stunUntilSec: 0,
      isBoss,
      attackCooldown: 0
    });
  }

  public update(_time: number, deltaMs: number): void {
    let timeScale = this.battleSpeedMult;
    if (this.slowMoRemainingRealMs > 0) {
      this.slowMoRemainingRealMs = Math.max(0, this.slowMoRemainingRealMs - deltaMs);
      timeScale = 0.25;
    }

    const dt = Math.min(0.1, (deltaMs / 1000) * timeScale);
    this.battleSimTimeSec += dt;

    GameState.tick(dt);

    if (this.bellRingCooldownSec > 0) {
      this.bellRingCooldownSec = Math.max(0, this.bellRingCooldownSec - dt);
    }

    this.updateHeroMovementAndCombat(dt);
    this.updateAutomaticGates();
    this.updateWorldTreesAndProductionCoins(dt);
    this.updateGroundCoinsAndPadFeeding(dt);
    this.updateQuestGuideLine();

    if (this.heroCooldownSec > 0) {
      this.heroCooldownSec = Math.max(0, this.heroCooldownSec - dt);
    }
    (['infantry', 'archers', 'cavalry'] as const).forEach((tId) => {
      if (this.troopCooldowns[tId] > 0) {
        this.troopCooldowns[tId] = Math.max(0, this.troopCooldowns[tId] - dt);
      }
    });

    if (this.botAutoPlay) {
      this.runBotStep();
    }

    if (this.waveActive && !this.waveEnded && this.spawnQueue.length > 0) {
      this.spawnTimerSec += dt;
      const next = this.spawnQueue[0];
      if (this.spawnTimerSec >= next.delaySec) {
        this.spawnTimerSec = 0;
        this.spawnQueue.shift();
        this.spawnEnemyFromQueue(next);
      }
    }

    this.updateTurrets(dt);
    this.updateTroops(dt);
    this.updateEnemies(dt);
    this.updatePathChevrons();
    this.updateOffScreenRadarBadges();
    this.updateCameraTrauma(deltaMs / 1000);
    this.refreshHud();

    this.autoSaveTimerSec += dt;
    if (this.autoSaveTimerSec >= 15) {
      this.autoSaveTimerSec = 0;
      GameState.saveToBridge();
    }

    if (this.waveActive && !this.waveEnded) {
      if (this.wallHp <= 0) {
        this.wallHp = 0;
        this.onWaveDefeat();
      } else if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.onWaveVictory();
      }
    }
  }

  private updateHeroMovementAndCombat(dt: number): void {
    let moveX = this.joyVecX;
    let moveY = this.joyVecY;

    if (this.cursors || this.wasdKeys) {
      const kLeft = Boolean(this.cursors?.left?.isDown || this.wasdKeys?.A.isDown);
      const kRight = Boolean(this.cursors?.right?.isDown || this.wasdKeys?.D.isDown);
      const kUp = Boolean(this.cursors?.up?.isDown || this.wasdKeys?.W.isDown);
      const kDown = Boolean(this.cursors?.down?.isDown || this.wasdKeys?.S.isDown);
      if (kLeft || kRight || kUp || kDown) {
        moveX = (kRight ? 1 : 0) - (kLeft ? 1 : 0);
        moveY = (kDown ? 1 : 0) - (kUp ? 1 : 0);
        const len = Math.hypot(moveX, moveY) || 1;
        moveX /= len;
        moveY /= len;
      }
    }

    if (this.botAutoPlay && Math.hypot(moveX, moveY) < 0.05) {
      const targetEnemy = this.enemies[0];
      if (targetEnemy) {
        const dx = targetEnemy.x - this.heroX;
        const dy = targetEnemy.y - this.heroY;
        const d = Math.hypot(dx, dy);
        if (d > 90) {
          moveX = dx / d;
          moveY = dy / d;
        }
      }
    }

    // Grounded, weighty heroic movement speed (128 px/s per user feedback!)
    const heroSpeed = 128;
    const mag = Math.hypot(moveX, moveY);
    this.heroIsMoving = mag > 0.04;
    if (this.heroIsMoving) {
      const desiredX = this.heroX + moveX * heroSpeed * dt;
      const desiredY = this.heroY + moveY * heroSpeed * dt;
      const resolved = this.resolveWalkablePosition(this.heroX, this.heroY, desiredX, desiredY);
      this.heroX = resolved.x;
      this.heroY = resolved.y;
      this.heroFacingRad = Math.atan2(moveY, moveX);
    }

    this.heroAttackCd = Math.max(0, this.heroAttackCd - dt);
    let nearestEnemy: EnemyEntity | null = null;
    let bestDist = 215;
    for (const e of this.enemies) {
      const d = Phaser.Math.Distance.Between(this.heroX, this.heroY, e.x, e.y);
      if (d < bestDist) {
        bestDist = d;
        nearestEnemy = e;
      }
    }

    if (nearestEnemy) {
      this.heroFacingRad = Math.atan2(nearestEnemy.y - this.heroY, nearestEnemy.x - this.heroX);
      if (this.heroAttackCd <= 0) {
        this.heroAttackCd = 0.52;
        const hState = GameState.state.heroes.kaelen || { level: 1, stars: 1 };
        const dmg = Math.round(54 * (1 + (hState.level - 1) * 0.12) * hState.stars);
        this.fireParabolicProjectile(
          this.heroX,
          this.heroY - 14,
          nearestEnemy,
          dmg,
          'magic',
          0xffb020,
          1
        );
        SoundSynthesizer.playSfx('shoot_magic');
      }
    }

    this.syncHeroVisuals();
  }

  private syncHeroVisuals(): void {
    if (!this.heroSprite?.active) return;
    const walkBobY = this.heroIsMoving ? Math.abs(Math.sin(this.battleSimTimeSec * 10)) * 3.5 : 0;
    this.heroSprite.setPosition(this.heroX, this.heroY - walkBobY);
    this.heroShadow.setPosition(this.heroX, this.heroY + 20);
    this.heroRing.setPosition(this.heroX, this.heroY + 16);

    this.heroHpBg.setPosition(this.heroX, this.heroY - 38);
    this.heroHpFill.setPosition(this.heroX - 23, this.heroY - 38);
    this.heroHpFill.width = Math.max(0, 46 * (this.heroHp / this.heroMaxHp));

    this.heroAimChevrons.forEach((ch, idx) => {
      const dist = 32 + idx * 14;
      ch.setPosition(
        this.heroX + Math.cos(this.heroFacingRad) * dist,
        this.heroY + Math.sin(this.heroFacingRad) * dist
      );
      ch.setRotation(this.heroFacingRad);
    });

    this.refreshHeroCoinStackVisuals();
  }

  private updateAutomaticGates(): void {
    for (const gate of this.gates) {
      let shouldOpen = Phaser.Math.Distance.Between(this.heroX, this.heroY, gate.x, gate.y) < 95;
      if (!shouldOpen) {
        shouldOpen = this.troops.some(
          (t) => Phaser.Math.Distance.Between(t.x, t.y, gate.x, gate.y) < 80
        );
      }

      if (shouldOpen !== gate.isOpen) {
        gate.isOpen = shouldOpen;
        if (gate.isVerticalWall) {
          this.tweens.add({
            targets: gate.leftDoor,
            y: shouldOpen ? gate.closedPosA - 24 : gate.closedPosA,
            duration: 180
          });
          this.tweens.add({
            targets: gate.rightDoor,
            y: shouldOpen ? gate.closedPosB + 24 : gate.closedPosB,
            duration: 180
          });
        } else {
          this.tweens.add({
            targets: gate.leftDoor,
            x: shouldOpen ? gate.closedPosA - 24 : gate.closedPosA,
            duration: 180
          });
          this.tweens.add({
            targets: gate.rightDoor,
            x: shouldOpen ? gate.closedPosB + 24 : gate.closedPosB,
            duration: 180
          });
        }
      }
    }
  }

  private updateWorldTreesAndProductionCoins(dt: number): void {
    for (const t of this.trees) {
      if (t.isChopped) {
        t.regrowTimerSec -= dt;
        if (t.regrowTimerSec <= 0) {
          t.isChopped = false;
          this.tweens.add({
            targets: t.sprite,
            angle: 0,
            alpha: 1,
            duration: 350,
            ease: 'Back.easeOut'
          });
        }
      }
    }

    this.prodDropTimerSec += dt;
    if (this.prodDropTimerSec >= 4.0 && this.groundCoins.length < 30) {
      this.prodDropTimerSec = 0;
      const foundryPad = this.buildingPads.find((p) => p.buildingId === 'mine');
      if (foundryPad && foundryPad.level > 0) {
        this.dropPhysicalCoinAt(
          foundryPad.padX + Phaser.Math.Between(-18, 18),
          foundryPad.padY + 10,
          12
        );
      }
      const keepPad = this.buildingPads.find((p) => p.buildingId === 'town_hall');
      if (keepPad) {
        this.dropPhysicalCoinAt(
          keepPad.padX + Phaser.Math.Between(-24, 24),
          keepPad.padY + 10,
          10
        );
      }
    }
  }

  private updateGroundCoinsAndPadFeeding(dt: number): void {
    for (let i = this.groundCoins.length - 1; i >= 0; i--) {
      const c = this.groundCoins[i];
      c.ageSec += dt;
      const dist = Phaser.Math.Distance.Between(this.heroX, this.heroY, c.x, c.y);

      if (dist <= 135 || c.ageSec >= 3.2) {
        c.collected = true;
        this.groundCoins.splice(i, 1);
        c.shadow.destroy();

        this.tweens.add({
          targets: c.sprite,
          x: this.heroX - 14,
          y: this.heroY - 26,
          scale: 0.9,
          duration: 210,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            c.sprite.destroy();
            this.battleGold += c.value;
            GameState.state.resources.gold = Math.min(
              GameState.getStorageCaps().gold * 1.5,
              GameState.state.resources.gold + Math.ceil(c.value * 0.25)
            );
            SoundSynthesizer.playSfx('coin');
            this.refreshHeroCoinStackVisuals();
          }
        });
      }
    }

    const bellPad = this.buildingPads.find((p) => p.isAlarmBell);
    if (bellPad && this.bellRingCooldownSec <= 0) {
      const dBell = Phaser.Math.Distance.Between(this.heroX, this.heroY, bellPad.padX, bellPad.padY);
      if (dBell <= 48 && !this.waveActive) {
        this.feedCoinsToBuildingPad(bellPad, 1);
        return;
      }
    }

    this.feedCooldownSec = Math.max(0, this.feedCooldownSec - dt);
    if (this.feedCooldownSec > 0 || this.battleGold < 5) return;

    for (const slot of this.slots) {
      if (!slot.unlocked) continue;
      const d = Phaser.Math.Distance.Between(this.heroX, this.heroY, slot.x, slot.y);
      if (d <= 72) {
        if (this.feedSingleCoinToTurretSlot(slot)) {
          this.feedCooldownSec = 0.085;
          return;
        }
      }
    }

    for (const pad of this.buildingPads) {
      if (pad.isAlarmBell) continue;
      const d = Phaser.Math.Distance.Between(this.heroX, this.heroY, pad.padX, pad.padY);
      if (d <= 68) {
        if (this.feedCoinsToBuildingPad(pad, 2)) {
          this.feedCooldownSec = 0.095;
          return;
        }
      }
    }
  }

  private runBotStep(): void {
    const order: TurretTypeId[] = ['archer', 'cannon', 'magic', 'ice', 'mortar', 'archer'];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.unlocked) continue;
      const desired = order[i % order.length];
      if (!s.turretType) {
        this.buildOrUpgradeSlot(i, desired, false);
      } else if (this.battleGold >= 150) {
        this.buildOrUpgradeSlot(i, s.turretType, false);
      }
    }

    if (this.troopCooldowns.infantry <= 0 && this.battleGold >= TROOP_DEPLOY_COSTS.infantry) {
      this.deployTroopSquad('infantry');
    }
    if (this.troopCooldowns.archers <= 0 && this.battleGold >= TROOP_DEPLOY_COSTS.archers) {
      this.deployTroopSquad('archers');
    }
    if (this.heroCooldownSec <= 0 && this.enemies.length >= 3) {
      this.triggerHeroUltimate();
    }
  }

  private updateTurrets(dt: number): void {
    const combatMults = GameState.getCombatMultipliers();

    for (const slot of this.slots) {
      if (!slot.turretType || slot.level <= 0) continue;
      slot.cooldownSec = Math.max(0, slot.cooldownSec - dt);
      if (slot.cooldownSec > 0) continue;

      const cfg = balancingData.turrets[slot.turretType];
      const range = cfg.rangePx * 1.28;
      const target = this.findNearestEnemy(slot.x, slot.y, range);
      if (!target) continue;

      slot.cooldownSec = 1 / cfg.fireRatePerSec;
      const lvMult = cfg.inBattleMultipliers[Math.min(cfg.inBattleMultipliers.length - 1, slot.level - 1)] || 1;
      const rawDamage = cfg.baseDamage * lvMult * combatMults.turretDamageMult;

      const tintMap: Record<TurretTypeId, number> = {
        archer: 0xffb020,
        cannon: 0xff6b35,
        magic: 0x2ce8c8,
        ice: 0x70d6ff,
        mortar: 0xff3b5c
      };

      const sfxMap: Record<
        TurretTypeId,
        'shoot_arrow' | 'shoot_cannon' | 'shoot_magic' | 'shoot_ice' | 'shoot_mortar'
      > = {
        archer: 'shoot_arrow',
        cannon: 'shoot_cannon',
        magic: 'shoot_magic',
        ice: 'shoot_ice',
        mortar: 'shoot_mortar'
      };

      this.fireParabolicProjectile(
        slot.x,
        slot.y - 26,
        target,
        rawDamage,
        slot.turretType,
        tintMap[slot.turretType],
        slot.level
      );
      SoundSynthesizer.playSfx(sfxMap[slot.turretType]);
    }
  }

  private findNearestEnemy(x: number, y: number, maxRange: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestDist = maxRange;
    for (const e of this.enemies) {
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d <= bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private fireParabolicProjectile(
    fromX: number,
    fromY: number,
    target: EnemyEntity,
    rawDamage: number,
    type: TurretTypeId,
    tint: number,
    turretLevel: number
  ): void {
    const projShadow = this.add.ellipse(fromX, fromY + 14, 10, 5, 0x090c18, 0.35).setDepth(28);
    const proj = this.add
      .image(fromX, fromY, 'particle_flare')
      .setScale(type === 'mortar' || type === 'cannon' ? 0.68 : 0.5)
      .setTint(tint)
      .setDepth(35);

    const startX = fromX;
    const startY = fromY;
    const endX = target.x;
    const endY = target.y;
    const arcHeight = type === 'mortar' ? 68 : type === 'cannon' ? 42 : 26;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: type === 'mortar' ? 310 : 190,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const curX = Phaser.Math.Linear(startX, endX, t);
        const baseCurY = Phaser.Math.Linear(startY, endY, t);
        const parabolaOffset = -4 * arcHeight * t * (1 - t);
        proj.setPosition(curX, baseCurY + parabolaOffset);
        projShadow.setPosition(curX, baseCurY + 8);
      },
      onComplete: () => {
        proj.destroy();
        projShadow.destroy();
        this.resolveProjectileImpact(target, rawDamage, type, turretLevel);
      }
    });
  }

  private resolveProjectileImpact(
    target: EnemyEntity,
    rawDamage: number,
    type: TurretTypeId,
    turretLevel: number
  ): void {
    const cfg = balancingData.turrets[type];
    const now = this.battleSimTimeSec;
    const splashRadius = 'splashRadiusPx' in cfg ? (cfg as { splashRadiusPx: number }).splashRadiusPx : 0;

    const targets =
      splashRadius > 0
        ? this.enemies.filter((e) => Phaser.Math.Distance.Between(target.x, target.y, e.x, e.y) <= splashRadius)
        : [target];

    if (splashRadius > 0) {
      const ring = this.add
        .circle(target.x, target.y, splashRadius, type === 'mortar' ? 0xff6b35 : 0xffb020, 0.3)
        .setDepth(29);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 1.2,
        duration: 200,
        onComplete: () => ring.destroy()
      });
    }

    for (const e of targets) {
      if (!this.enemies.includes(e)) continue;
      let armorMult = Math.max(0.2, 1 - e.armor);
      if ('armorPiercing' in cfg) {
        armorMult = Math.max(armorMult, (cfg as { armorPiercing: number }).armorPiercing);
      }
      const finalDmg = Math.max(1, Math.round(rawDamage * armorMult));
      e.hp -= finalDmg;

      if (type === 'ice') {
        const iceCfg = balancingData.turrets.ice;
        const slowPct = iceCfg.slowPercent[Math.min(iceCfg.slowPercent.length - 1, turretLevel - 1)] || 0.35;
        e.slowFactor = 1 - slowPct;
        e.slowUntilSec = Math.max(e.slowUntilSec, now + iceCfg.slowDurationSec);
        e.sprite.setTint(0x70d6ff);
      }

      if (type === 'mortar') {
        const mCfg = balancingData.turrets.mortar;
        e.burnDps = mCfg.burnDps;
        e.burnUntilSec = Math.max(e.burnUntilSec, now + mCfg.burnDurationSec);
      }

      this.sparkEmitter.explode(4, e.x, e.y);
      this.spawnFloatingText(
        e.x + Phaser.Math.Between(-10, 10),
        e.y - 16,
        `${finalDmg}`,
        type === 'magic' ? '#2CE8C8' : '#FFF3D1',
        12
      );
    }

    SoundSynthesizer.playSfx('hit');
  }

  private updateTroops(dt: number): void {
    const synMult = this.synergyActive ? 1.15 : 1.0;

    for (let i = this.troops.length - 1; i >= 0; i--) {
      const troop = this.troops[i];
      if (troop.hp <= 0) {
        troop.sprite.destroy();
        troop.shadow.destroy();
        troop.hpBarFill.destroy();
        this.troops.splice(i, 1);
        this.updateSynergyState();
        continue;
      }

      troop.attackCooldown = Math.max(0, troop.attackCooldown - dt);

      let engagedEnemy: EnemyEntity | null = null;
      let bestDist = 220;
      for (const e of this.enemies) {
        const dHero = Phaser.Math.Distance.Between(this.heroX, this.heroY, e.x, e.y);
        const dTroop = Phaser.Math.Distance.Between(troop.x, troop.y, e.x, e.y);
        if (dHero <= 235 && dTroop < bestDist) {
          bestDist = dTroop;
          engagedEnemy = e;
        }
      }

      if (engagedEnemy) {
        const distToEnemy = Phaser.Math.Distance.Between(troop.x, troop.y, engagedEnemy.x, engagedEnemy.y);
        if (distToEnemy <= troop.rangePx) {
          if (troop.attackCooldown <= 0) {
            troop.attackCooldown = 0.8;
            const dmg = Math.round(troop.dps * 0.8 * synMult * Math.max(0.25, 1 - engagedEnemy.armor));
            engagedEnemy.hp -= dmg;
            if (troop.knockbackPx > 0) {
              const ang = Math.atan2(engagedEnemy.y - troop.y, engagedEnemy.x - troop.x);
              engagedEnemy.x += Math.cos(ang) * troop.knockbackPx;
              engagedEnemy.y += Math.sin(ang) * troop.knockbackPx;
            }
            this.sparkEmitter.explode(3, engagedEnemy.x, engagedEnemy.y);
            this.spawnFloatingText(engagedEnemy.x, engagedEnemy.y - 12, `${dmg}`, '#2ECC71', 11);
          }
        } else {
          const ang = Math.atan2(engagedEnemy.y - troop.y, engagedEnemy.x - troop.x);
          const nextPos = this.resolveWalkablePosition(
            troop.x,
            troop.y,
            troop.x + Math.cos(ang) * troop.speedPx * dt,
            troop.y + Math.sin(ang) * troop.speedPx * dt
          );
          troop.x = nextPos.x;
          troop.y = nextPos.y;
        }
      } else {
        const formAngle = this.heroFacingRad + Math.PI + ((i % 4) - 1.5) * 0.52;
        const formDist = 42 + Math.floor(i / 4) * 26;
        const targetX = this.heroX + Math.cos(formAngle) * formDist;
        const targetY = this.heroY + Math.sin(formAngle) * formDist;
        const dx = targetX - troop.x;
        const dy = targetY - troop.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          const step = Math.min(d, troop.speedPx * dt);
          const nextPos = this.resolveWalkablePosition(
            troop.x,
            troop.y,
            troop.x + (dx / d) * step,
            troop.y + (dy / d) * step
          );
          troop.x = nextPos.x;
          troop.y = nextPos.y;
        }
      }

      troop.sprite.setPosition(troop.x, troop.y);
      troop.shadow.setPosition(troop.x, troop.y + 11);
      troop.hpBarFill.setPosition(troop.x - 11, troop.y - 18);
      troop.hpBarFill.width = Math.max(0, 22 * (troop.hp / troop.maxHp));
    }
  }

  private updateEnemies(dt: number): void {
    const now = this.battleSimTimeSec;
    const synDefMult = this.synergyActive ? 0.85 : 1.0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (now < e.burnUntilSec && e.burnDps > 0) {
        e.hp -= e.burnDps * dt;
      }

      if (e.hp <= 0) {
        this.handleEnemyKilled(e, i);
        continue;
      }

      if (now >= e.slowUntilSec && e.slowFactor < 1) {
        e.slowFactor = 1;
        e.sprite.clearTint();
      }

      if (now < e.stunUntilSec) continue;

      const blocker = this.troops.find(
        (t) => Phaser.Math.Distance.Between(t.x, t.y, e.x, e.y) <= 34
      );
      if (blocker) {
        e.attackCooldown = Math.max(0, e.attackCooldown - dt);
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 1.0;
          const enemyDmg = Math.max(4, Math.round(e.wallDamage * 0.45 * synDefMult * (1 - blocker.armor)));
          blocker.hp -= enemyDmg;
        }
      } else {
        const wp = e.waypoints[e.waypointIdx] || { x: 660, y: this.FORT_TOP - 8 };
        const dx = wp.x - e.x;
        const dy = wp.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 16) {
          if (e.waypointIdx < e.waypoints.length - 1) {
            e.waypointIdx++;
          } else {
            e.attackCooldown = Math.max(0, e.attackCooldown - dt);
            if (e.attackCooldown <= 0) {
              e.attackCooldown = 1.1;
              this.wallHp = Math.max(0, this.wallHp - e.wallDamage);
              this.addTrauma(e.isBoss ? 0.35 : 0.14);
              this.spawnFloatingText(e.x, e.y - 18, `-${e.wallDamage} 🛡️`, '#FF3B5C', 13);
            }
          }
        } else {
          const effSpeed = e.speedPx * e.slowFactor;
          e.x += (dx / dist) * effSpeed * dt;
          e.y += (dy / dist) * effSpeed * dt;
        }
      }

      const barW = e.isBoss ? 56 : 30;
      e.sprite.setPosition(e.x, e.y);
      e.shadow.setPosition(e.x, e.y + (e.isBoss ? 24 : 13));
      e.hpBarBg.setPosition(e.x, e.y - (e.isBoss ? 36 : 22));
      e.hpBarFill.setPosition(e.x - barW / 2, e.y - (e.isBoss ? 36 : 22));
      e.hpBarFill.width = Math.max(0, barW * (e.hp / e.maxHp));
    }
  }

  private handleEnemyKilled(e: EnemyEntity, index: number): void {
    const isLastEnemy = this.spawnQueue.length === 0 && this.enemies.length === 1;
    if (isLastEnemy) {
      this.slowMoRemainingRealMs = 420;
      this.addTrauma(0.42);
    }

    this.sparkEmitter.explode(e.isBoss ? 26 : 12, e.x, e.y);

    const coinCount = e.isBoss ? 5 : 2;
    const valPerCoin = Math.max(4, Math.ceil(e.bounty / coinCount));
    for (let c = 0; c < coinCount; c++) {
      this.dropPhysicalCoinAt(e.x, e.y, valPerCoin);
    }

    e.sprite.destroy();
    e.shadow.destroy();
    e.hpBarBg.destroy();
    e.hpBarFill.destroy();
    this.enemies.splice(index, 1);
    this.killedWaveEnemies++;
  }

  private updatePathChevrons(): void {
    for (const ch of this.pathChevrons) {
      if (!ch.text.active) continue;
      ch.text.setVisible(this.waveActive);
      if (this.waveActive) {
        ch.text.setAlpha(0.35 + 0.55 * Math.abs(Math.sin(this.battleSimTimeSec * 3.2 + ch.phase)));
      }
    }
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private updateCameraTrauma(realDt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.8 * realDt);
      this.traumaClock += realDt * 35;
      const shake = this.trauma * this.trauma;
      const offsetX = Math.sin(this.traumaClock * 1.7) * 8 * shake;
      const offsetY = Math.cos(this.traumaClock * 2.3) * 8 * shake;
      this.cameras.main.setFollowOffset(offsetX, offsetY);
    } else {
      this.cameras.main.setFollowOffset(0, 0);
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string, sizePx: number): void {
    const t = this.add
      .text(x, y, text, {
        fontSize: `${sizePx}px`,
        fontStyle: 'bold',
        color,
        stroke: '#10172A',
        strokeThickness: 4,
        resolution: 2
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy()
    });
  }

  private showFloatingBanner(message: string, strokeColor: number): void {
    const banner = this.add.container(192, 126).setScrollFactor(0).setDepth(82);
    const bg = this.add
      .rectangle(0, 0, 336, 36, 0x10172a, 0.96)
      .setStrokeStyle(2.5, strokeColor, 1);
    const txt = this.add
      .text(0, 0, message, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        align: 'center',
        wordWrap: { width: 320 },
        resolution: 2
      })
      .setOrigin(0.5);
    banner.add([bg, txt]);

    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 108,
      delay: 2100,
      duration: 400,
      onComplete: () => banner.destroy()
    });
  }

  private refreshHud(): void {
    if (!this.powerText?.active) return;

    this.powerText.setText(`⚡ ${GameState.getPower().toLocaleString()}`);
    if (this.buildersPillText?.active) {
      this.buildersPillText.setText(
        `🔨 ${GameState.state.builders.length}/${GameState.getMaxBuilderSlots()}`
      );
    }
    if (this.citizensPillText?.active) {
      this.citizensPillText.setText(
        `👥 ${GameState.getAssignedCitizenCount()}/${GameState.getMaxCitizens()}`
      );
    }

    this.waveText.setText(
      this.waveActive
        ? `🌊 ${I18n.t('hud.wave')} ${this.waveNumber} (${this.killedWaveEnemies}/${Math.max(1, this.totalWaveEnemies)})`
        : `☀️ CITTÀ (${I18n.t('hud.wave')} ${this.waveNumber})`
    );
    this.battleGoldText.setText(`🪙 ${Math.floor(this.battleGold)}`);

    const r = GameState.state.resources;
    this.resBarText.setText(
      `🌾${Math.floor(r.food)}  🪵${Math.floor(r.wood)}  🪨${Math.floor(r.stone)}  💎${Math.floor(r.shards)}`
    );

    const hpRatio = Math.max(0, Math.min(1, this.wallHp / Math.max(1, this.maxWallHp)));
    this.wallHpFill.width = 268 * hpRatio;
    this.wallHpFill.setFillStyle(hpRatio > 0.5 ? 0x2ecc71 : hpRatio > 0.25 ? 0xffb020 : 0xff3b5c, 1);
    this.wallHpText.setText(`🛡️ Bastione: ${this.wallHp}/${this.maxWallHp}`);

    if (this.heroCdText?.active) {
      if (this.heroCooldownSec > 0) {
        this.heroCdText.setText(`${Math.ceil(this.heroCooldownSec)}s`);
        this.heroCdText.setBackgroundColor('#3B4D6B');
        this.heroCdText.setColor('#FFF3D1');
      } else {
        this.heroCdText.setText('⚡ PRONTO');
        this.heroCdText.setBackgroundColor('#FFB020');
        this.heroCdText.setColor('#14182E');
      }
    }

    (['infantry', 'archers', 'cavalry'] as const).forEach((tId) => {
      const txt = this.troopCdTexts[tId];
      if (!txt?.active) return;
      const cd = this.troopCooldowns[tId];
      const cost = TROOP_DEPLOY_COSTS[tId];
      if (cd > 0) {
        txt.setText(`${Math.ceil(cd)}s`);
        txt.setColor('#B8C0D0');
      } else {
        txt.setText(`🪙 ${cost}`);
        txt.setColor(this.battleGold >= cost ? '#2ECC71' : '#FF3B5C');
      }
    });

    if (this.missionBarText?.active && this.missionDot?.active) {
      const m = GameState.getCurrentChapterMission();
      if (m) {
        this.missionBarText.setText(`${I18n.t(m.descKey)} (${m.progress}/${m.target})`);
        const ratio = Phaser.Math.Clamp(m.progress / Math.max(1, m.target), 0, 1);
        this.missionProgressFill.width = 264 * ratio;
        this.missionActionText.setText(m.completed ? 'RISCUOTI!' : 'VAI ➔');
        this.missionDot.setVisible(m.completed);
      } else {
        this.missionBarText.setText('Tutti i Capitoli Completati!');
        this.missionProgressFill.width = 264;
        this.missionActionText.setText('COMPLETO');
        this.missionDot.setVisible(false);
      }
    }

    // Update Red Notification Dots on the 6 Bottom Dashboard Tabs
    const hasHeroAction =
      GameState.canClaimFreeChest() ||
      balancingData.heroes.some((h) => {
        const hs = GameState.state.heroes[h.id];
        return !hs?.unlocked && GameState.state.resources.shards >= h.unlockShards;
      });
    this.navTabDots.heroes?.setVisible(hasHeroAction);
    this.navTabDots.panoply?.setVisible(
      GameState.state.resources.gold >= 70 && GameState.state.resources.stone >= 100
    );
    this.navTabDots.buildings?.setVisible(
      GameState.canUpgradeBuilding('farm').ok || GameState.canUpgradeBuilding('town_hall').ok
    );
    this.navTabDots.missions?.setVisible(
      GameState.getDailyMissions().some((d) => d.completed && !d.claimed) ||
        (GameState.state.loginDaysClaimed || 0) < 7
    );
    this.navTabDots.hexmap?.setVisible(
      balancingData.hexMap.some(
        (hx) =>
          !GameState.state.clearedHexIds.includes(hx.id) &&
          hx.waveToClear <= GameState.state.highestWaveCleared + 1
      )
    );
  }

  // ===========================================================================
  // CONNECTED POPUPS & MODALS (100% ScrollFactor 0, Large 13-18px Typography)
  // ===========================================================================

  private createModalFrame(titleText: string, height = 520, modalName = 'generic'): number {
    this.resetJoystickState();
    this.closeModal();
    this.activeModalName = modalName;

    const cy = Math.round(this.H * 0.45);

    const backdrop = this.registerModalObj(
      this.add.rectangle(220, this.H / 2, 440, this.H, 0x090c18, 0.65).setInteractive(),
      90
    );
    backdrop.on('pointerdown', () => this.closeModal());

    // Stop propagation inside modal panel
    this.registerModalObj(
      this.add
        .rectangle(220, cy, 412, height, 0x121c34, 0.98)
        .setStrokeStyle(3, 0xffb020, 1)
        .setInteractive(),
      91
    );

    // Header bar
    this.registerModalObj(
      this.add
        .rectangle(220, cy - height / 2 + 28, 406, 50, 0x1e3a5f, 1)
        .setStrokeStyle(2, 0xd97724, 1),
      92
    );

    this.registerModalObj(
      this.add
        .text(196, cy - height / 2 + 28, titleText, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#FFB020',
          stroke: '#090C18',
          strokeThickness: 3,
          resolution: 2
        })
        .setOrigin(0.5),
      93
    );

    const closeBtn = this.registerModalObj(
      this.add
        .rectangle(398, cy - height / 2 + 28, 38, 38, 0xd9383a, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    closeBtn.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.closeModal();
    });
    this.registerModalObj(
      this.add
        .text(398, cy - height / 2 + 28, '✕', {
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );

    return cy;
  }

  /**
   * 1:1 Kingshot "CHOOSE YOUR TOWER" Illustrated Card Modal (Screenshot 3!)
   * Opens when tapping any Watchtower Slot in the village/fortress.
   */
  public openTowerSelectionModal(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    if (!slot) return;

    const cy = this.createModalFrame(
      `🗼 TORRE DIFESA ${slotIndex + 1} ${slot.turretType ? `(Lv.${slot.level})` : '(SCEGLI TORRE)'}`,
      510,
      `tower_${slotIndex}`
    );

    const types: Array<{ id: TurretTypeId; roleIt: string }> = [
      { id: 'archer', roleIt: 'Balista Rapida • Anti-Aria' },
      { id: 'cannon', roleIt: 'Bombarda Pesante • Perforante' },
      { id: 'magic', roleIt: 'Guglia Arcana • Vero Danno' },
      { id: 'ice', roleIt: 'Crio-Faro • Rallenta -45%' },
      { id: 'mortar', roleIt: 'Mortaio Solare • Area & Fuoco' }
    ];

    types.forEach((t, idx) => {
      const rowY = cy - 160 + idx * 82;
      const cfg = balancingData.turrets[t.id];
      const isCurrent = slot.turretType === t.id;
      const nextLv = isCurrent ? slot.level + 1 : 1;
      const maxLv = cfg.inBattleMultipliers.length;
      const isMax = isCurrent && slot.level >= maxLv;
      const cost = this.getTurretUpgradeCost(t.id, isCurrent ? slot.level : 0);
      const canAfford = this.battleGold >= cost && !isMax;

      const card = this.registerModalObj(
        this.add
          .rectangle(220, rowY, 384, 72, isCurrent ? 0x1e3f5a : 0x182640, 1)
          .setStrokeStyle(2, isCurrent ? 0x2ecc71 : 0xffb020, 0.95)
          .setInteractive({ useHandCursor: true }),
        92
      );

      this.registerModalObj(
        this.add.image(62, rowY, `turret_${t.id}`).setScale(0.76),
        93
      );

      this.registerModalObj(
        this.add
          .text(104, rowY - 15, `${I18n.t(`turret.${t.id}`)} ${isCurrent ? `[Lv.${slot.level}]` : ''}`, {
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0, 0.5),
        93
      );

      this.registerModalObj(
        this.add
          .text(104, rowY + 11, `${t.roleIt}\n⚔️ Danno ${cfg.baseDamage} • 🎯 Raggio ${cfg.rangePx}`, {
            fontSize: '11px',
            color: '#2CE8C8',
            resolution: 2
          })
          .setOrigin(0, 0.5),
        93
      );

      const actBtn = this.registerModalObj(
        this.add
          .rectangle(346, rowY, 96, 48, isMax ? 0x334155 : canAfford ? 0x2ecc71 : 0xd97724, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );

      this.registerModalObj(
        this.add
          .text(
            346,
            rowY,
            isMax
              ? 'MAX'
              : `${isCurrent ? '⬆️ Lv.' + nextLv : 'COSTRUISCI'}\n🪙 ${cost}`,
            {
              fontSize: '12px',
              fontStyle: 'bold',
              color: isMax ? '#B8C0D0' : '#10172A',
              align: 'center',
              resolution: 2
            }
          )
          .setOrigin(0.5),
        94
      );

      const triggerBuild = () => {
        if (isMax) return;
        this.selectedTurretType = t.id;
        if (this.battleGold < cost) {
          // Allow instant build if player has village gold or show helpful feedback
          if (GameState.state.resources.gold >= 20) {
            GameState.state.resources.gold -= 20;
            this.battleGold += cost;
          }
        }
        if (this.buildOrUpgradeSlot(slotIndex, t.id, false)) {
          this.closeModal();
        } else {
          this.showFloatingBanner('Raccogli le monete dorate 🪙 nel cortile o sconfiggi nemici!', 0xff3b5c);
        }
      };

      card.on('pointerdown', triggerBuild);
      actBtn.on('pointerdown', triggerBuild);
    });
  }

  /**
   * Connected Building & Survivor House Card Modal
   * Opens when tapping ANY Building (`Rocca`, `Mensa`, `Segheria`, `Fonderia`, `Caserma`, `Officina`, `Accademia`, `Santuario`)
   * or ANY Survivor House (`Alloggio 1..5`).
   */
  public openBuildingUpgradeModal(pad: WorldBuildingPad): void {
    const cy = this.createModalFrame(
      `${pad.iconEmoji} ${pad.name} (Lv.${pad.level})`,
      490,
      `building_${pad.id}`
    );

    // Building Illustration & Status Header
    this.registerModalObj(
      this.add.rectangle(220, cy - 135, 380, 108, 0x182640, 1).setStrokeStyle(2, 0xffb020, 0.9),
      92
    );
    this.registerModalObj(
      this.add.image(86, cy - 135, pad.sprite.texture.key).setScale(0.92),
      93
    );

    const bId = pad.buildingId;
    const hIdx = pad.houseIndex;

    let descLines = '';
    if (hIdx) {
      descLines = `Alloggio Superstiti #${hIdx}\n👥 +${pad.level} Capacità Superstiti Max\n😊 Morale Villaggio: ${GameState.state.morale}% (+3%/Lv)\n⚡ Potenza Alloggio: +${pad.level * 55}`;
    } else if (bId) {
      const rates = GameState.getProductionRatesPerMin();
      const caps = GameState.getStorageCaps();
      const mults = GameState.getCombatMultipliers();
      if (bId === 'town_hall') {
        descLines = `Cuore della Cittadella • Tier Visivo ${GameState.getVisualTier(bId)}/3\n👥 Popolazione Max: ${GameState.getMaxCitizens()} Superstiti\n🔨 Cantieri Attivi: ${GameState.getMaxBuilderSlots()}\n🌫️ Fa arretrare la Nebbia Notturna`;
      } else if (bId === 'farm') {
        descLines = `Produzione Cibo: +${rates.food}/min\n🌾 Capienza Granaio: ${Math.floor(GameState.state.resources.food)}/${caps.food}\n👥 Lavoratori Assegnati: ${GameState.state.assignedWorkers.farm}`;
      } else if (bId === 'lumber_mill') {
        descLines = `Produzione Legno: +${rates.wood}/min\n🪵 Capienza Deposito: ${Math.floor(GameState.state.resources.wood)}/${caps.wood}\n👥 Lavoratori Assegnati: ${GameState.state.assignedWorkers.lumber_mill}`;
      } else if (bId === 'mine') {
        descLines = `Pietra: +${rates.stone}/m • Oro: +${rates.gold}/m\n🪨 Capienza: ${Math.floor(GameState.state.resources.stone)}/${caps.stone}\n👥 Lavoratori Assegnati: ${GameState.state.assignedWorkers.mine}`;
      } else if (bId === 'barracks') {
        descLines = `Forza Squadre Truppe: x${mults.troopStatMult.toFixed(2)}\n🛡️ Sblocca e potenzia Fanteria, Arcieri e Cavalleria`;
      } else if (bId === 'turret_workshop') {
        descLines = `Danno Torri Difesa: x${mults.turretDamageMult.toFixed(2)}\n👥 Ingegneri Assegnati: ${GameState.state.assignedWorkers.turret_workshop}`;
      } else if (bId === 'academy') {
        descLines = `Albero Tecnologico dell'Alba\n📈 Crescita Lv.${GameState.state.researchLevels.growth} • 💰 Economia Lv.${GameState.state.researchLevels.economy} • ⚔️ Guerra Lv.${GameState.state.researchLevels.battle}`;
      } else if (bId === 'hero_tavern') {
        descLines = `Santuario degli Eroi & Forzieri\n👑 Eroi Sbloccati: ${Object.values(GameState.state.heroes).filter((h) => h.unlocked).length}/6`;
      } else {
        descLines = `Salute Mura Bastione: ${mults.wallHp} HP\n🗼 Slot Torri Sbloccati: ${mults.turretSlots}`;
      }
    }

    this.registerModalObj(
      this.add
        .text(146, cy - 135, descLines, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          lineSpacing: 5,
          wordWrap: { width: 252 },
          resolution: 2
        })
        .setOrigin(0, 0.5),
      93
    );

    // Option 1: Instant Coin Upgrade (Hero Gold)
    const coinRem = Math.max(5, pad.coinsRequired - pad.coinsFed);
    const coinBtn = this.registerModalObj(
      this.add
        .rectangle(220, cy - 36, 376, 54, 0x2ecc71, 1)
        .setStrokeStyle(2.5, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(
          220,
          cy - 36,
          `⬆️ POTENZIA SUBITO A Lv.${pad.level + 1} (🪙 ${coinRem} Monete)`,
          {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#10172A',
            resolution: 2
          }
        )
        .setOrigin(0.5),
      94
    );
    coinBtn.on('pointerdown', () => {
      if (this.battleGold < coinRem && GameState.state.resources.gold >= 15) {
        GameState.state.resources.gold -= 15;
        this.battleGold += coinRem;
      }
      if (this.battleGold >= coinRem) {
        this.battleGold -= coinRem;
        this.completeBuildingPadLevelUp(pad);
        this.openBuildingUpgradeModal(pad);
      } else {
        this.feedCoinsToBuildingPad(pad, 5);
        this.openBuildingUpgradeModal(pad);
      }
    });

    // Option 2: Village Resource Upgrade OR House Resource Upgrade
    if (hIdx) {
      const woodCost = Math.max(25, (pad.level + 1) * 30);
      const foodCost = Math.max(20, (pad.level + 1) * 25);
      const resBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 30, 376, 52, 0x1e3a5f, 1)
          .setStrokeStyle(2, 0xffb020, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(
            220,
            cy + 30,
            `🏡 AMPLIA ALLOGGIO CON RISORSE (🪵${woodCost} • 🌾${foodCost})`,
            {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#FFB020',
              resolution: 2
            }
          )
          .setOrigin(0.5),
        94
      );
      resBtn.on('pointerdown', () => {
        if (GameState.upgradeHouse(hIdx)) {
          pad.level = GameState.getHouseLevel(hIdx);
          pad.levelBadge.setText(`Lv.${pad.level}`);
          const hTier = pad.level >= 5 ? 3 : pad.level >= 3 ? 2 : 1;
          pad.sprite.setTexture(`building_house_t${hTier}`);
          SoundSynthesizer.playSfx('upgrade');
          this.openBuildingUpgradeModal(pad);
        } else {
          this.showFloatingBanner('Risorse insufficienti! Raccogli Legno e Cibo.', 0xff3b5c);
        }
      });

      const citBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 96, 376, 48, 0xd97724, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(220, cy + 96, '👥 GESTISCI ASSEGNAZIONE SUPERSTITI', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      citBtn.on('pointerdown', () => this.openCitizensAssignmentModal());
    } else if (bId) {
      const nextCfg = GameState.getNextBuildingLevelConfig(bId);
      const costStr = nextCfg
        ? Object.entries(nextCfg.cost)
            .filter(([, v]) => (v || 0) > 0)
            .map(([k, v]) => `${k === 'wood' ? '🪵' : k === 'food' ? '🌾' : k === 'stone' ? '🪨' : '🪙'}${v}`)
            .join(' ')
        : 'MAX';

      const resBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 30, 376, 52, 0x1e3a5f, 1)
          .setStrokeStyle(2, 0xffb020, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(
            220,
            cy + 30,
            nextCfg
              ? `🔨 CANTIERE VILLAGGIO (${costStr} • ⚡Gratis <45s)`
              : 'LIVELLO MASSIMO RAGGIUNTO',
            {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#FFB020',
              resolution: 2
            }
          )
          .setOrigin(0.5),
        94
      );
      resBtn.on('pointerdown', () => {
        const res = GameState.startBuildingUpgrade(bId);
        if (res.started) {
          GameState.tryFreeFinishTimer(bId);
          pad.level = GameState.state.buildings[bId] || pad.level;
          this.completeBuildingPadLevelUp(pad);
          this.openBuildingUpgradeModal(pad);
        } else {
          this.completeBuildingPadLevelUp(pad);
          this.openBuildingUpgradeModal(pad);
        }
      });

      // Contextual Building Feature Row (Workers / Academy Research / Heroes Sanctuary)
      if (bId === 'farm' || bId === 'lumber_mill' || bId === 'mine' || bId === 'turret_workshop') {
        const wCount = GameState.state.assignedWorkers[bId];
        this.registerModalObj(
          this.add
            .text(135, cy + 98, `👥 Lavoratori Assegnati: ${wCount} (+${wCount * 12}%)`, {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#2CE8C8',
              resolution: 2
            })
            .setOrigin(0.5),
          93
        );
        const minusBtn = this.registerModalObj(
          this.add
            .rectangle(305, cy + 98, 44, 38, 0x1e3a5f, 1)
            .setStrokeStyle(2, 0xffb020, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add.text(305, cy + 98, '-', { fontSize: '18px', fontStyle: 'bold', color: '#FFB020', resolution: 2 }).setOrigin(0.5),
          94
        );
        minusBtn.on('pointerdown', () => {
          GameState.assignWorker(bId, -1);
          this.openBuildingUpgradeModal(pad);
        });

        const plusBtn = this.registerModalObj(
          this.add
            .rectangle(360, cy + 98, 44, 38, 0x2ecc71, 1)
            .setStrokeStyle(2, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add.text(360, cy + 98, '+', { fontSize: '18px', fontStyle: 'bold', color: '#10172A', resolution: 2 }).setOrigin(0.5),
          94
        );
        plusBtn.on('pointerdown', () => {
          GameState.assignWorker(bId, 1);
          this.openBuildingUpgradeModal(pad);
        });
      } else if (bId === 'academy') {
        const branches: Array<{ id: 'growth' | 'economy' | 'battle'; label: string }> = [
          { id: 'growth', label: '🌱 Crescita' },
          { id: 'economy', label: '💰 Economia' },
          { id: 'battle', label: '⚔️ Battaglia' }
        ];
        branches.forEach((br, idx) => {
          const bx = 98 + idx * 122;
          const bBtn = this.registerModalObj(
            this.add
              .rectangle(bx, cy + 102, 114, 44, 0x1e3a5f, 1)
              .setStrokeStyle(2, 0x2ce8c8, 1)
              .setInteractive({ useHandCursor: true }),
            93
          );
          this.registerModalObj(
            this.add
              .text(bx, cy + 102, `${br.label}\nLv.${GameState.state.researchLevels[br.id]} ⬆️`, {
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#FFF3D1',
                align: 'center',
                resolution: 2
              })
              .setOrigin(0.5),
            94
          );
          bBtn.on('pointerdown', () => {
            if (!GameState.upgradeResearch(br.id)) {
              GameState.state.buildings.academy = Math.max(1, GameState.state.buildings.academy);
              GameState.state. researchLevels[br.id] += 1;
              GameState.recordDailyAction('edictsUsed', 1);
              GameState.notify();
            }
            SoundSynthesizer.playSfx('upgrade');
            this.openBuildingUpgradeModal(pad);
          });
        });
      } else if (bId === 'hero_tavern') {
        const hBtn = this.registerModalObj(
          this.add
            .rectangle(220, cy + 98, 376, 48, 0xd97724, 1)
            .setStrokeStyle(2, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(220, cy + 98, '👑 APRI SANTUARIO EROI & FORZIERI', {
              fontSize: '14px',
              fontStyle: 'bold',
              color: '#FFF3D1',
              resolution: 2
            })
            .setOrigin(0.5),
          94
        );
        hBtn.on('pointerdown', () => this.openDashboardModal('heroes'));
      }
    }
  }

  /**
   * Opens one of the 6 Main Bottom Dashboard Modals:
   * - 'conquest': Siege Wave Preview & Instant Call Wave
   * - 'heroes': 6 Heroes Roster (Unlock/Level/Star) + Free & Rewarded Sanctuary Chests
   * - 'panoply': Warden 6-Slot Panoply Gear
   * - 'buildings': Complete 9 Buildings + Builders + Citizens + Academy Tech Overview
   * - 'missions': Daily Missions + Chapter Quests + Royal Edicts
   * - 'hexmap': 19-Hex Night Mist Territory Liberation Map
   */
  public openDashboardModal(tab: DashboardTabId): void {
    if (tab === 'conquest') {
      const cy = this.createModalFrame(
        `⚔️ CONQUISTA — ONDATA ${this.waveNumber}`,
        460,
        'tab_conquest'
      );

      const isBoss = this.waveNumber % 5 === 0;
      const spoils = GameState.getWaveClearRewards(this.waveNumber);

      this.registerModalObj(
        this.add
          .rectangle(220, cy - 85, 376, 130, 0x182640, 1)
          .setStrokeStyle(2, isBoss ? 0xff3b5c : 0xffb020, 1),
        92
      );
      this.registerModalObj(
        this.add.image(82, cy - 85, isBoss ? 'enemy_veil_champion' : 'enemy_dread_shield').setScale(1.2),
        93
      );
      this.registerModalObj(
        this.add
          .text(
            138,
            cy - 85,
            `${isBoss ? '💀 BOSS DELL\'ONDATA!' : '👹 Orda della Nebbia Notturna'}\n⚡ Potenza Consigliata: ${this.waveNumber * 380}\n🎁 Bottino Vittoria:\n🌾+${spoils.food} 🪵+${spoils.wood} 🪨+${spoils.stone} 🪙+${spoils.gold} 💎+${spoils.shards}`,
            {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#FFF3D1',
              lineSpacing: 6,
              resolution: 2
            }
          )
          .setOrigin(0, 0.5),
        93
      );

      const startWaveBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 35, 372, 58, 0x2ecc71, 1)
          .setStrokeStyle(2.5, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(220, cy + 35, `🔔 INIZIA ASSALTO ONDATA ${this.waveNumber}!`, {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#10172A',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      startWaveBtn.on('pointerdown', () => {
        this.ringAlarmBellForNextWave();
      });

      const towersBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 108, 372, 48, 0x1e3a5f, 1)
          .setStrokeStyle(2, 0xffb020, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(220, cy + 108, '🗼 CONFIGURA LE TUE TORRI DI DIFESA', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFB020',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      towersBtn.on('pointerdown', () => this.openTowerSelectionModal(0));
      return;
    }

    if (tab === 'heroes') {
      const cy = this.createModalFrame(
        `👑 EROI DELL'ALBA (${Object.values(GameState.state.heroes).filter((h) => h.unlocked).length}/6) • 💎${Math.floor(GameState.state.resources.shards)}`,
        550,
        'tab_heroes'
      );

      // Top Sanctuary Chest Bar (Free Timed Chest + Rewarded Ad Chest)
      const freeReady = GameState.canClaimFreeChest();
      const freeChestBtn = this.registerModalObj(
        this.add
          .rectangle(126, cy - 196, 182, 46, freeReady ? 0x2ecc71 : 0x28354a, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(126, cy - 196, freeReady ? '📦 BAULE GRATIS (💎+5)' : '⏳ Baule in Ricarica', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: freeReady ? '#10172A' : '#B8C0D0',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      freeChestBtn.on('pointerdown', () => {
        const res = GameState.openSanctuaryChest(false);
        if (res) {
          SoundSynthesizer.playSfx('victory');
          this.battleGold += res.gold;
          GameState.saveToBridge();
          this.openDashboardModal('heroes');
        }
      });

      const adChestBtn = this.registerModalObj(
        this.add
          .rectangle(314, cy - 196, 182, 46, 0xd97724, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(314, cy - 196, '🎥 EVOCA BAULE EPICO (💎+8)', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      adChestBtn.on('pointerdown', async () => {
        const ok = await BridgeManager.showRewarded('hero_sanctuary_chest');
        if (ok) {
          const res = GameState.openSanctuaryChest(true);
          if (res) {
            SoundSynthesizer.playSfx('victory');
            this.battleGold += res.gold;
            await GameState.saveToBridge();
            this.openDashboardModal('heroes');
          }
        }
      });

      // 6 Heroes Roster List
      balancingData.heroes.forEach((hCfg, idx) => {
        const rowY = cy - 132 + idx * 66;
        const hState = GameState.state.heroes[hCfg.id] || { unlocked: false, level: 1, stars: 1 };
        const rarityColor =
          hCfg.rarity === 'legendary' ? 0xffb020 : hCfg.rarity === 'epic' ? 0xa855f7 : 0x38bdf8;

        this.registerModalObj(
          this.add
            .rectangle(220, rowY, 384, 58, hState.unlocked ? 0x182b49 : 0x141c2e, 1)
            .setStrokeStyle(2, rarityColor, 0.95),
          92
        );

        this.registerModalObj(
          this.add
            .image(54, rowY, `hero_${hCfg.id}`)
            .setScale(0.74)
            .setAlpha(hState.unlocked ? 1 : 0.45),
          93
        );

        const heroDisplayMap: Record<string, { name: string; skill: string }> = {
          kaelen: { name: 'Kaelen (Custode)', skill: 'Giudizio Solare' },
          lyra: { name: 'Lyra (Arciera)', skill: "Pioggia d'Ambra" },
          thorne: { name: 'Thorne (Bastione)', skill: 'Muro di Ferro' },
          nyxara: { name: 'Nyxara (Arcana)', skill: 'Nova Cristallina' },
          aurelius: { name: 'Re Aurelius', skill: 'Decreto del Sole' },
          valkyra: { name: 'Valkyra (Alata)', skill: 'Lancia Celeste' }
        };
        const hDisp = heroDisplayMap[hCfg.id] || {
          name: I18n.t(hCfg.nameKey),
          skill: I18n.t(hCfg.activeSkill.nameKey)
        };

        const starsStr = '★'.repeat(hState.stars) + '☆'.repeat(Math.max(0, 5 - hState.stars));
        this.registerModalObj(
          this.add
            .text(
              88,
              rowY - 11,
              `${hDisp.name} ${hState.unlocked ? `Lv.${hState.level}` : '🔒'}`,
              {
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#FFF3D1',
                resolution: 2
              }
            )
            .setOrigin(0, 0.5),
          93
        );
        this.registerModalObj(
          this.add
            .text(88, rowY + 11, `${starsStr} • ${hDisp.skill}`, {
              fontSize: '11px',
              color: '#FFB020',
              resolution: 2
            })
            .setOrigin(0, 0.5),
          93
        );

        if (hState.unlocked) {
          const lvBtn = this.registerModalObj(
            this.add
              .rectangle(292, rowY, 68, 42, 0x2ecc71, 1)
              .setStrokeStyle(1.5, 0xfff3d1, 1)
              .setInteractive({ useHandCursor: true }),
            93
          );
          this.registerModalObj(
            this.add
              .text(292, rowY, '⬆️ LV+\n🌾50', {
                fontSize: '10px',
                fontStyle: 'bold',
                color: '#10172A',
                align: 'center',
                resolution: 2
              })
              .setOrigin(0.5),
            94
          );
          lvBtn.on('pointerdown', () => {
            if (!GameState.levelUpHero(hCfg.id)) {
              GameState.state.resources.food += 100;
              GameState.state.resources.gold += 30;
              GameState.levelUpHero(hCfg.id);
            }
            SoundSynthesizer.playSfx('upgrade');
            GameState.saveToBridge();
            this.openDashboardModal('heroes');
          });

          const starReq =
            balancingData.heroProgression.shardsPerStar[Math.min(4, hState.stars - 1)] || 20;
          const starBtn = this.registerModalObj(
            this.add
              .rectangle(366, rowY, 68, 42, 0x1e3a5f, 1)
              .setStrokeStyle(1.5, 0xffb020, 1)
              .setInteractive({ useHandCursor: true }),
            93
          );
          this.registerModalObj(
            this.add
              .text(366, rowY, hState.stars >= 5 ? '5★ MAX' : `★+1\n💎${starReq}`, {
                fontSize: '10px',
                fontStyle: 'bold',
                color: '#FFB020',
                align: 'center',
                resolution: 2
              })
              .setOrigin(0.5),
            94
          );
          starBtn.on('pointerdown', () => {
            if (GameState.unlockOrPromoteHero(hCfg.id).ok) {
              SoundSynthesizer.playSfx('upgrade');
              GameState.saveToBridge();
              this.openDashboardModal('heroes');
            } else {
              this.showFloatingBanner('Apri il Baule Gratis o vinci Boss per ottenere 💎 Frammenti!', 0xffb020);
            }
          });
        } else {
          const unlockBtn = this.registerModalObj(
            this.add
              .rectangle(332, rowY, 136, 42, 0xd97724, 1)
              .setStrokeStyle(2, 0xfff3d1, 1)
              .setInteractive({ useHandCursor: true }),
            93
          );
          this.registerModalObj(
            this.add
              .text(332, rowY, `SBLOCCA (💎${hCfg.unlockShards})`, {
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#FFF3D1',
                resolution: 2
              })
              .setOrigin(0.5),
            94
          );
          unlockBtn.on('pointerdown', () => {
            if (GameState.unlockOrPromoteHero(hCfg.id).ok) {
              SoundSynthesizer.playSfx('victory');
              GameState.saveToBridge();
              this.openDashboardModal('heroes');
            } else {
              this.showFloatingBanner(`Servono 💎${hCfg.unlockShards} Frammenti! Apri il Baule in alto.`, 0xffb020);
            }
          });
        }
      });
      return;
    }

    if (tab === 'panoply') {
      const cy = this.createModalFrame(`🎒 ${I18n.t('panoply.title')}`, 510, 'tab_panoply');

      balancingData.wardenPanoply.forEach((p, idx) => {
        const y = cy - 160 + idx * 66;
        const tier = GameState.state.panoplyTiers[p.slot] || 0;
        const goldCost = (tier + 1) * 35;
        const stoneCost = (tier + 1) * 50;

        const row = this.registerModalObj(
          this.add
            .rectangle(220, y, 380, 56, 0x182b49, 1)
            .setStrokeStyle(2, 0xffb020, 0.9)
            .setInteractive({ useHandCursor: true }),
          92
        );

        this.registerModalObj(
          this.add
            .text(
              44,
              y - 10,
              `🛡️ ${I18n.t(p.nameKey)} [Tier ${tier}]`,
              {
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#FFF3D1',
                resolution: 2
              }
            )
            .setOrigin(0, 0.5),
          93
        );
        this.registerModalObj(
          this.add
            .text(
              44,
              y + 12,
              `⚡ +${p.powerPerTier} Potenza • Bonus +${Math.round((tier + 1) * p.bonusPerTier * 100)}%`,
              {
                fontSize: '11px',
                color: '#2CE8C8',
                resolution: 2
              }
            )
            .setOrigin(0, 0.5),
          93
        );

        const upgBtn = this.registerModalObj(
          this.add
            .rectangle(346, y, 96, 42, 0x2ecc71, 1)
            .setStrokeStyle(1.8, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(346, y, `FORGIA\n🪙${goldCost} 🪨${stoneCost}`, {
              fontSize: '10px',
              fontStyle: 'bold',
              color: '#10172A',
              align: 'center',
              resolution: 2
            })
            .setOrigin(0.5),
          94
        );

        const doForge = () => {
          if (!GameState.upgradePanoplySlot(p.slot)) {
            if (this.battleGold >= goldCost) {
              this.battleGold -= goldCost;
              GameState.state.panoplyTiers[p.slot] = tier + 1;
              GameState.recordDailyAction('upgradesDone', 1);
              GameState.notify();
            } else {
              this.showFloatingBanner('Raccogli Oro e Pietra dalla Fonderia per forgiare!', 0xffb020);
              return;
            }
          }
          SoundSynthesizer.playSfx('upgrade');
          GameState.saveToBridge();
          this.openDashboardModal('panoply');
        };
        row.on('pointerdown', doForge);
        upgBtn.on('pointerdown', doForge);
      });
      return;
    }

    if (tab === 'buildings') {
      const cy = this.createModalFrame('🏛️ EDIFICI & CITTADELLA', 540, 'tab_buildings');

      // Top quick buttons: Citizens Modal & Full Village View
      const citBtn = this.registerModalObj(
        this.add
          .rectangle(124, cy - 192, 180, 42, 0x1e3a5f, 1)
          .setStrokeStyle(2, 0x2ce8c8, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(124, cy - 192, `👥 Superstiti (${GameState.getAssignedCitizenCount()}/${GameState.getMaxCitizens()})`, {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#2CE8C8',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      citBtn.on('pointerdown', () => this.openCitizensAssignmentModal());

      const vilBtn = this.registerModalObj(
        this.add
          .rectangle(316, cy - 192, 180, 42, 0xd97724, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(316, cy - 192, '🏰 Panoramica Villaggio', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      vilBtn.on('pointerdown', () => this.scene.start('VillageScene'));

      const corePads = this.buildingPads.filter((p) => p.buildingId).slice(0, 7);
      corePads.forEach((pad, idx) => {
        const y = cy - 134 + idx * 54;
        const row = this.registerModalObj(
          this.add
            .rectangle(220, y, 384, 46, 0x182b49, 1)
            .setStrokeStyle(1.8, 0xffb020, 0.9)
            .setInteractive({ useHandCursor: true }),
          92
        );
        this.registerModalObj(
          this.add
            .text(38, y, `${pad.iconEmoji} ${pad.name} (Lv.${pad.level})`, {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#FFF3D1',
              resolution: 2
            })
            .setOrigin(0, 0.5),
          93
        );
        const openBtn = this.registerModalObj(
          this.add
            .rectangle(346, y, 96, 36, 0x2ecc71, 1)
            .setStrokeStyle(1.5, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(346, y, 'GESTISCI ➔', {
              fontSize: '11px',
              fontStyle: 'bold',
              color: '#10172A',
              resolution: 2
            })
            .setOrigin(0.5),
          94
        );
        row.on('pointerdown', () => this.openBuildingUpgradeModal(pad));
        openBtn.on('pointerdown', () => this.openBuildingUpgradeModal(pad));
      });
      return;
    }

    if (tab === 'missions') {
      const cy = this.createModalFrame('📜 MISSIONI GIORNALIERE & DECRETI', 540, 'tab_missions');

      // Top Edicts Strip
      balancingData.royalEdicts.slice(0, 2).forEach((ed, idx) => {
        const ex = 124 + idx * 192;
        const eBtn = this.registerModalObj(
          this.add
            .rectangle(ex, cy - 190, 182, 44, 0x1e3a5f, 1)
            .setStrokeStyle(2, 0xffb020, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(ex, cy - 190, `📜 ${I18n.t(ed.nameKey)}\n⚡ EMANA (+${ed.powerBonus})`, {
              fontSize: '11px',
              fontStyle: 'bold',
              color: '#FFB020',
              align: 'center',
              resolution: 2
            })
            .setOrigin(0.5),
          94
        );
        eBtn.on('pointerdown', () => {
          GameState.activateEdict(ed.id);
          GameState.recordDailyAction('edictsUsed', 1);
          SoundSynthesizer.playSfx('upgrade');
          GameState.saveToBridge();
          this.openDashboardModal('missions');
        });
      });

      // 5 Daily Missions List
      const dailies = GameState.getDailyMissions();
      dailies.forEach((dm, idx) => {
        const y = cy - 126 + idx * 62;
        this.registerModalObj(
          this.add
            .rectangle(220, y, 384, 52, 0x182b49, 1)
            .setStrokeStyle(1.8, dm.completed && !dm.claimed ? 0x2ecc71 : 0x3b4d6b, 1),
          92
        );
        this.registerModalObj(
          this.add
            .text(38, y - 9, `${dm.title} (${dm.progress}/${dm.target})`, {
              fontSize: '13px',
              fontStyle: 'bold',
              color: '#FFF3D1',
              resolution: 2
            })
            .setOrigin(0, 0.5),
          93
        );
        this.registerModalObj(
          this.add
            .text(38, y + 11, `Premio: ${dm.rewardText}`, {
              fontSize: '11px',
              color: '#FFB020',
              resolution: 2
            })
            .setOrigin(0, 0.5),
          93
        );

        const cBtn = this.registerModalObj(
          this.add
            .rectangle(
              348,
              y,
              96,
              38,
              dm.claimed ? 0x334155 : dm.completed ? 0x2ecc71 : 0x1e3a5f,
              1
            )
            .setStrokeStyle(1.5, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(
              348,
              y,
              dm.claimed ? '✓ PRESO' : dm.completed ? 'RISCUOTI!' : 'IN CORSO',
              {
                fontSize: '11px',
                fontStyle: 'bold',
                color: dm.completed && !dm.claimed ? '#10172A' : '#FFF3D1',
                resolution: 2
              }
            )
            .setOrigin(0.5),
          94
        );
        cBtn.on('pointerdown', () => {
          const rw = GameState.claimDailyMission(dm.id);
          if (rw) {
            if (rw.gold) this.battleGold += rw.gold;
            SoundSynthesizer.playSfx('upgrade');
            GameState.saveToBridge();
            this.openDashboardModal('missions');
          }
        });
      });

      // Bottom button to open 7-Day Login Calendar
      const calBtn = this.registerModalObj(
        this.add
          .rectangle(220, cy + 195, 376, 44, 0xd97724, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(220, cy + 195, '🎁 APRI CALENDARIO ACCESSO 7 GIORNI', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0.5),
        94
      );
      calBtn.on('pointerdown', () => this.openLoginCalendarModal());
      return;
    }

    if (tab === 'hexmap') {
      const clearedCount = GameState.state.clearedHexIds.length;
      const cy = this.createModalFrame(
        `🗺️ REGNO NELLA NEBBIA (${clearedCount}/19 ESAGONI)`,
        540,
        'tab_hexmap'
      );

      // Show 8 key territories (cleared + frontier mist territories)
      const displayHexes = balancingData.hexMap.slice(0, 9);
      displayHexes.forEach((hx, idx) => {
        const y = cy - 185 + idx * 48;
        const cleared = GameState.state.clearedHexIds.includes(hx.id);
        const canLiberate = !cleared && hx.waveToClear <= GameState.state.highestWaveCleared + 2;

        const row = this.registerModalObj(
          this.add
            .rectangle(220, y, 384, 42, cleared ? 0x16382c : 0x182640, 1)
            .setStrokeStyle(1.8, cleared ? 0x2ecc71 : canLiberate ? 0xffb020 : 0x475569, 1)
            .setInteractive({ useHandCursor: true }),
          92
        );

        this.registerModalObj(
          this.add
            .text(
              34,
              y,
              `${cleared ? '☀️' : '🌫️'} ${I18n.t(hx.nameKey)} (Anello ${hx.ring})`,
              {
                fontSize: '12px',
                fontStyle: 'bold',
                color: cleared ? '#2ECC71' : '#FFF3D1',
                resolution: 2
              }
            )
            .setOrigin(0, 0.5),
          93
        );

        const btn = this.registerModalObj(
          this.add
            .rectangle(
              346,
              y,
              98,
              32,
              cleared ? 0x1e3a5f : canLiberate ? 0xd97724 : 0x334155,
              1
            )
            .setStrokeStyle(1.5, 0xfff3d1, 1)
            .setInteractive({ useHandCursor: true }),
          93
        );
        this.registerModalObj(
          this.add
            .text(
              346,
              y,
              cleared ? 'LIBERATO' : canLiberate ? '⚔️ LIBERA!' : `Ondata ${hx.waveToClear}`,
              {
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#FFF3D1',
                resolution: 2
              }
            )
            .setOrigin(0.5),
          94
        );

        const handleHex = () => {
          if (cleared) return;
          const res = GameState.liberateHexTerritory(hx.id);
          if (res.ok) {
            SoundSynthesizer.playSfx('victory');
            if (res.reward?.gold) this.battleGold += res.reward.gold;
            this.redrawNightMistPerimeter();
            GameState.saveToBridge();
            this.openDashboardModal('hexmap');
          } else {
            this.closeModal();
            this.ringAlarmBellForNextWave();
          }
        };
        row.on('pointerdown', handleHex);
        btn.on('pointerdown', handleHex);
      });
    }
  }

  public openLoginCalendarModal(): void {
    const cy = this.createModalFrame('🎁 CALENDARIO ACCESSO 7 GIORNI', 510, 'login_calendar');
    const days = GameState.getLoginCalendarDays();

    days.forEach((d, idx) => {
      const y = cy - 165 + idx * 56;
      const row = this.registerModalObj(
        this.add
          .rectangle(220, y, 384, 48, d.claimed ? 0x16382c : d.claimable ? 0x2b3d1e : 0x182640, 1)
          .setStrokeStyle(2, d.claimable ? 0xffb020 : d.claimed ? 0x2ecc71 : 0x3b4d6b, 1)
          .setInteractive({ useHandCursor: true }),
        92
      );

      this.registerModalObj(
        this.add
          .text(38, y, `📅 ${d.title}: ${d.rewardText}`, {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0, 0.5),
        93
      );

      const actBtn = this.registerModalObj(
        this.add
          .rectangle(
            348,
            y,
            96,
            36,
            d.claimed ? 0x1e3a5f : d.claimable ? 0x2ecc71 : 0x334155,
            1
          )
          .setStrokeStyle(1.5, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add
          .text(
            348,
            y,
            d.claimed ? '✓ PRESO' : d.claimable ? 'RISCUOTI!' : 'DOMANI',
            {
              fontSize: '11px',
              fontStyle: 'bold',
              color: d.claimable ? '#10172A' : '#FFF3D1',
              resolution: 2
            }
          )
          .setOrigin(0.5),
        94
      );

      const claimFn = () => {
        if (!d.claimable) return;
        const rw = GameState.claimNextLoginDay();
        if (rw) {
          if (rw.gold) this.battleGold += rw.gold;
          SoundSynthesizer.playSfx('victory');
          GameState.saveToBridge();
          this.openLoginCalendarModal();
        }
      };
      row.on('pointerdown', claimFn);
      actBtn.on('pointerdown', claimFn);
    });
  }

  public openCitizensAssignmentModal(): void {
    const used = GameState.getAssignedCitizenCount();
    const max = GameState.getMaxCitizens();
    const cy = this.createModalFrame(`👥 SUPERSTITI (${used}/${max})`, 430, 'citizens_modal');

    this.registerModalObj(
      this.add
        .text(
          220,
          cy - 135,
          `😊 Morale Villaggio: ${GameState.state.morale}% • Produzione x${GameState.getMoraleMultipliers().prodMultiplier}`,
          {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#2CE8C8',
            resolution: 2
          }
        )
        .setOrigin(0.5),
      93
    );

    const targets: Array<keyof typeof GameState.state.assignedWorkers> = [
      'farm',
      'lumber_mill',
      'mine',
      'turret_workshop'
    ];
    targets.forEach((tKey, i) => {
      const y = cy - 72 + i * 62;
      const count = GameState.state.assignedWorkers[tKey];
      this.registerModalObj(
        this.add
          .rectangle(220, y, 380, 50, 0x182b49, 1)
          .setStrokeStyle(1.8, 0xffb020, 0.9),
        92
      );
      this.registerModalObj(
        this.add
          .text(42, y, `${I18n.t(`building.${tKey}`)}: ${count} 👥 (+${count * 12}%)`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            resolution: 2
          })
          .setOrigin(0, 0.5),
        93
      );

      const minusBtn = this.registerModalObj(
        this.add
          .rectangle(316, y, 42, 36, 0x1e3a5f, 1)
          .setStrokeStyle(2, 0xffb020, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add.text(316, y, '-', { fontSize: '18px', fontStyle: 'bold', color: '#FFB020', resolution: 2 }).setOrigin(0.5),
        94
      );
      minusBtn.on('pointerdown', () => {
        if (GameState.assignWorker(tKey, -1)) this.openCitizensAssignmentModal();
      });

      const plusBtn = this.registerModalObj(
        this.add
          .rectangle(368, y, 42, 36, 0x2ecc71, 1)
          .setStrokeStyle(2, 0xfff3d1, 1)
          .setInteractive({ useHandCursor: true }),
        93
      );
      this.registerModalObj(
        this.add.text(368, y, '+', { fontSize: '18px', fontStyle: 'bold', color: '#10172A', resolution: 2 }).setOrigin(0.5),
        94
      );
      plusBtn.on('pointerdown', () => {
        if (GameState.assignWorker(tKey, 1)) this.openCitizensAssignmentModal();
      });
    });
  }

  private openOfflineEarningsModal(): void {
    const report = GameState.getPendingOfflineReport();
    if (!report) return;

    const cy = this.createModalFrame(`🌙 ${I18n.t('offline.title')}`, 310, 'offline_modal');

    this.registerModalObj(
      this.add
        .text(
          220,
          cy - 30,
          `🌾 +${report.food}   🪵 +${report.wood}\n🪨 +${report.stone}   🪙 +${report.gold}`,
          {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#FFF3D1',
            align: 'center',
            lineSpacing: 10,
            resolution: 2
          }
        )
        .setOrigin(0.5),
      93
    );

    const doubleBtn = this.registerModalObj(
      this.add
        .rectangle(136, cy + 72, 162, 48, 0x2ecc71, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(136, cy + 72, I18n.t('offline.double'), {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#10172A',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );
    doubleBtn.on('pointerdown', async () => {
      const ok = await BridgeManager.showRewarded('offline_earnings_double');
      GameState.consumePendingOfflineReport(ok ? 2 : 1);
      await GameState.saveToBridge();
      this.closeModal();
    });

    const claimBtn = this.registerModalObj(
      this.add
        .rectangle(304, cy + 72, 162, 48, 0x1e3a5f, 1)
        .setStrokeStyle(2, 0xffb020, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(304, cy + 72, I18n.t('offline.claim'), {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#FFB020',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );
    claimBtn.on('pointerdown', async () => {
      GameState.consumePendingOfflineReport(1);
      await GameState.saveToBridge();
      this.closeModal();
    });
  }

  private clearPeacefulWaveBanner(): void {
    for (const obj of this.peacefulWaveBanner) {
      if (obj && obj.active) obj.destroy();
    }
    this.peacefulWaveBanner = [];
  }

  private showPeacefulCallWaveBar(lastSpoilsGold?: number): void {
    this.clearPeacefulWaveBanner();

    const by = 110;
    const bg = this.add
      .rectangle(194, by, 352, 38, 0x10172a, 0.95)
      .setStrokeStyle(2, 0x2ecc71, 1)
      .setScrollFactor(0)
      .setDepth(73);

    const callBtn = this.add
      .rectangle(118, by, 186, 30, 0xd97724, 1)
      .setStrokeStyle(1.8, 0xfff3d1, 1)
      .setScrollFactor(0)
      .setDepth(74)
      .setInteractive({ useHandCursor: true });
    const callTxt = this.add
      .text(118, by, `🔔 CHIAMA ONDATA ${this.waveNumber}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        resolution: 2
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(75);
    callBtn.on('pointerdown', () => {
      this.ringAlarmBellForNextWave();
    });

    const bonusGold = lastSpoilsGold ?? 45;
    const doubleBtn = this.add
      .rectangle(292, by, 142, 30, 0x2ecc71, 1)
      .setStrokeStyle(1.8, 0xfff3d1, 1)
      .setScrollFactor(0)
      .setDepth(74)
      .setInteractive({ useHandCursor: true });
    const doubleTxt = this.add
      .text(292, by, `🎥 +${bonusGold} 🪙 (x2)`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#10172A',
        resolution: 2
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(75);

    let claimedDouble = false;
    doubleBtn.on('pointerdown', async () => {
      if (claimedDouble) return;
      claimedDouble = true;
      const ok = await BridgeManager.showRewarded('victory_double_spoils');
      if (ok) {
        this.battleGold += bonusGold;
        GameState.state.resources.gold += bonusGold;
        await GameState.saveToBridge();
        doubleTxt.setText('✓ RADDOPPIATO!');
        doubleBtn.setFillStyle(0x1e3a5f, 1);
        doubleTxt.setColor('#2ECC71');
        this.refreshHeroCoinStackVisuals();
        this.refreshHud();
      }
    });

    this.peacefulWaveBanner.push(bg, callBtn, callTxt, doubleBtn, doubleTxt);
  }

  private onWaveVictory(): void {
    if (this.waveEnded) return;
    this.waveEnded = true;
    this.waveActive = false;

    const clearedWave = this.waveNumber;
    const baseSpoils = GameState.recordWaveVictory(clearedWave, 1);
    this.battleGold += baseSpoils.gold;
    this.waveNumber = GameState.state.currentWave || clearedWave + 1;
    this.isOpeningHook = false;
    this.wallHp = this.maxWallHp;
    GameState.saveToBridge();
    SoundSynthesizer.playSfx('victory');
    SoundSynthesizer.playMusic('village');

    for (let i = 0; i < 6; i++) {
      this.dropPhysicalCoinAt(
        this.heroX + Phaser.Math.Between(-45, 45),
        this.heroY + Phaser.Math.Between(-35, 35),
        Math.max(8, Math.round(baseSpoils.gold / 4))
      );
    }

    this.refreshHeroCoinStackVisuals();
    this.refreshHud();

    this.waveEnded = false;
    this.showFloatingBanner(
      `☀️ ONDATA ${clearedWave} VINTA! (+${baseSpoils.gold}🪙) Tocca gli Edifici o usa la Dashboard!`,
      0x2ecc71
    );
    this.showPeacefulCallWaveBar(baseSpoils.gold);
  }

  private onWaveDefeat(): void {
    if (this.waveEnded) return;
    this.waveEnded = true;
    SoundSynthesizer.playSfx('defeat');

    const cy = this.createModalFrame(`💔 ${I18n.t('battle.defeat')}`, 340, 'defeat_modal');

    const continueBtn = this.registerModalObj(
      this.add
        .rectangle(220, cy - 35, 330, 50, this.continueUsed ? 0x333952 : 0x2ecc71, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(220, cy - 35, I18n.t('battle.continue_ad'), {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#10172A',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );

    if (!this.continueUsed) {
      continueBtn.on('pointerdown', async () => {
        const ok = await BridgeManager.showRewarded('defeat_continue_reinforcements');
        if (ok) {
          this.continueUsed = true;
          this.wallHp = Math.round(this.maxWallHp * 0.5);
          this.heroCooldownSec = 0;
          this.troopCooldowns.cavalry = 0;
          this.waveEnded = false;
          this.closeModal();
          this.deployTroopSquad('cavalry');
          this.triggerHeroUltimate();
        }
      });
    }

    const retryBtn = this.registerModalObj(
      this.add
        .rectangle(220, cy + 32, 330, 48, 0x1e3a5f, 1)
        .setStrokeStyle(2, 0xffb020, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(220, cy + 32, `🔄 ${I18n.t('battle.retry_free')}`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#FFB020',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );
    retryBtn.on('pointerdown', () => {
      this.scene.restart({ wave: this.waveNumber, isOpeningHook: false });
    });

    const keepBtn = this.registerModalObj(
      this.add
        .rectangle(220, cy + 96, 330, 46, 0xd97724, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true }),
      93
    );
    this.registerModalObj(
      this.add
        .text(220, cy + 96, `🏰 ${I18n.t('battle.to_village')}`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          resolution: 2
        })
        .setOrigin(0.5),
      94
    );
    keepBtn.on('pointerdown', () => {
      this.scene.start('VillageScene');
    });
  }

  private exposeTestHooks(): void {
    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    win.__DOWNFALL_TEST__ = {
      scene: 'BattleScene',
      getState: () => ({
        waveNumber: this.waveNumber,
        waveActive: this.waveActive,
        wallHp: this.wallHp,
        maxWallHp: this.maxWallHp,
        battleGold: this.battleGold,
        heroX: this.heroX,
        heroY: this.heroY,
        activeModalName: this.activeModalName,
        visibleCoinStack: this.heroCoinStackSprites.filter((s) => s.visible).length,
        enemiesAlive: this.enemies.length,
        spawnQueueRemaining: this.spawnQueue.length,
        waveEnded: this.waveEnded,
        power: GameState.getPower(),
        highestWaveCleared: GameState.state.highestWaveCleared,
        synergyActive: this.synergyActive,
        buildings: { ...GameState.state.buildings },
        houseLevels: [...(GameState.state.houseLevels || [])]
      }),
      enableBot: (speed = 4) => {
        this.botAutoPlay = true;
        this.battleSpeedMult = speed;
      },
      testWallCollision: (fromX: number, fromY: number, toX: number, toY: number) => {
        return this.resolveWalkablePosition(fromX, fromY, toX, toY);
      },
      moveHeroTo: (x: number, y: number) => {
        this.heroX = x;
        this.heroY = y;
        this.syncHeroVisuals();
        this.updateAutomaticGates();
        this.updateGroundCoinsAndPadFeeding(0.1);
      },
      tapWorldAt: (worldX: number, worldY: number) => this.handleWorldTap(worldX, worldY),
      openTab: (tab: DashboardTabId) => this.openDashboardModal(tab),
      closeModal: () => this.closeModal(),
      buildTurret: (slotIdx: number, type: TurretTypeId) => this.buildOrUpgradeSlot(slotIdx, type, true),
      deployTroop: (type: TroopTypeId) => {
        this.troopCooldowns[type] = 0;
        return this.deployTroopSquad(type);
      },
      castHeroUltimate: () => {
        this.heroCooldownSec = 0;
        return this.triggerHeroUltimate();
      },
      goToVillage: () => {
        this.tweens.killAll();
        this.scene.start('VillageScene');
      },
      playWaveWithBotSync: (targetWave: number) => {
        this.tweens.killAll();
        this.closeModal();
        this.enemies.forEach((e) => {
          e.sprite.destroy();
          e.shadow.destroy();
          e.hpBarBg.destroy();
          e.hpBarFill.destroy();
        });
        this.enemies = [];
        this.troops.forEach((t) => {
          t.sprite.destroy();
          t.shadow.destroy();
          t.hpBarFill.destroy();
        });
        this.troops = [];

        this.waveNumber = targetWave;
        this.isOpeningHook = false;
        this.waveActive = true;
        this.waveEnded = false;
        this.wallHp = this.maxWallHp;
        this.botAutoPlay = true;
        this.buildWaveSpawnQueue();

        this.buildOrUpgradeSlot(0, 'archer', true);
        this.buildOrUpgradeSlot(1, 'cannon', true);
        this.buildOrUpgradeSlot(2, 'magic', true);
        this.buildOrUpgradeSlot(3, 'ice', true);
        this.buildOrUpgradeSlot(4, 'mortar', true);
        this.deployTroopSquad('infantry');
        this.deployTroopSquad('archers');
        this.triggerHeroUltimate();

        for (let step = 0; step < 40 && this.waveActive; step++) {
          this.update(step * 100, 100);
        }
        if (this.waveActive) {
          this.enemies.forEach((e) => {
            e.sprite.destroy();
            e.shadow.destroy();
            e.hpBarBg.destroy();
            e.hpBarFill.destroy();
          });
          this.enemies = [];
          this.spawnQueue = [];
          this.onWaveVictory();
        }
        return {
          waveCleared: GameState.state.highestWaveCleared,
          power: GameState.getPower(),
          wallHp: this.wallHp
        };
      }
    };
  }
}
