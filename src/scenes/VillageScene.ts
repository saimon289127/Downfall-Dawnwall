import Phaser from 'phaser';
import balancingData from '../config/balancing.json';
import { I18n, SupportedLocale } from '../i18n/I18nManager';
import { generateAllGameTextures } from '../systems/AssetGenerator';
import { BridgeManager } from '../systems/BridgeManager';
import { BuildingId, GameState } from '../systems/GameStateManager';
import { SoundSynthesizer } from '../systems/SoundSynthesizer';

interface BuildingNode {
  id: BuildingId;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  nameLabel: Phaser.GameObjects.Text;
  levelBadge: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  redDot: Phaser.GameObjects.Arc;
  lastLevel: number;
}

export class VillageScene extends Phaser.Scene {
  private buildingNodes: Record<string, BuildingNode> = {};
  private powerText!: Phaser.GameObjects.Text;
  private resTextLine1!: Phaser.GameObjects.Text;
  private resTextLine2!: Phaser.GameObjects.Text;
  private missionBarText!: Phaser.GameObjects.Text;
  private missionDot!: Phaser.GameObjects.Arc;
  private defendBtnText!: Phaser.GameObjects.Text;
  private activeModal: Phaser.GameObjects.Container | null = null;
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private autoSaveAccumSec = 0;

  constructor() {
    super('VillageScene');
  }

  public create(): void {
    generateAllGameTextures(this);
    SoundSynthesizer.playMusic('village');

    this.drawVillageCourtyard();
    this.createParticlesAndCitizens();
    this.createTopHud();
    this.createBottomBar();
    this.createBuildingsGrid();

    // Show offline earnings popup if player was away
    const offline = GameState.getPendingOfflineReport();
    if (offline) {
      this.openOfflineEarningsModal();
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
  }

  private drawVillageCourtyard(): void {
    const g = this.add.graphics();

    // Lush 2.5D Isometric Valley Meadow Base (matching Screenshot 1)
    g.fillStyle(0x4e8b41, 1);
    g.fillRect(0, 0, 440, 956);

    // Northern Sparkling River & Wooden Bridge at top of valley
    g.fillStyle(0xc8b078, 1);
    g.fillRect(0, 102, 440, 44);
    g.fillStyle(0x2d8bc9, 1);
    g.fillRect(0, 108, 440, 32);
    g.fillStyle(0x5ec2f2, 0.55);
    for (let rx = 20; rx < 420; rx += 75) {
      g.fillRoundedRect(rx, 118, 38, 5, 2);
    }
    // Bridge
    g.fillStyle(0x8c5828, 1);
    g.fillRoundedRect(194, 98, 52, 52, 6);
    g.lineStyle(2, 0x543418, 1);
    g.strokeRoundedRect(194, 98, 52, 52, 6);

    // Warm sunlit courtyard plaza inside the stone walls
    g.fillStyle(0x63ab52, 1);
    g.fillRoundedRect(16, 154, 408, 566, 24);
    g.fillStyle(0xc9b38c, 0.92);
    g.fillRoundedRect(34, 180, 372, 515, 22);

    // Isometric Stone Fortress Walls with Battlements
    g.lineStyle(8, 0x5c687d, 1);
    g.strokeRoundedRect(22, 162, 396, 550, 20);

    // Warm golden sunlight aura around Solar Keep
    g.fillStyle(0xffb020, 0.16);
    g.fillCircle(220, 240, 145);

    // Ochre dirt & cobblestone roads connecting Keep to all buildings
    g.lineStyle(18, 0xd8be92, 0.95);
    const keepPos = { x: 220, y: 245 };
    const roadTargets = [
      { x: 220, y: 120 },
      { x: 92, y: 345 },
      { x: 348, y: 345 },
      { x: 220, y: 425 },
      { x: 92, y: 470 },
      { x: 348, y: 470 },
      { x: 105, y: 585 },
      { x: 335, y: 585 },
      { x: 220, y: 655 }
    ];
    for (const rt of roadTargets) {
      g.lineBetween(keepPos.x, keepPos.y, rt.x, rt.y);
    }

    // Pine trees along valley perimeter + 5 Survivor Houses + Alarm Bell + Decree Box + Watchtowers
    const treePts = [
      { x: 26, y: 158 },
      { x: 62, y: 152 },
      { x: 378, y: 152 },
      { x: 414, y: 158 },
      { x: 24, y: 705 },
      { x: 414, y: 705 }
    ];
    for (const tp of treePts) {
      this.add.image(tp.x, tp.y, 'prop_pine_tree').setScale(0.72).setDepth(12);
    }

    // 5 Survivor Houses (Permukiman 1..5) — Connected to Citizens & House Upgrade!
    const housePts = [
      { x: 44, y: 245, idx: 1 },
      { x: 44, y: 395, idx: 2 },
      { x: 396, y: 245, idx: 3 },
      { x: 396, y: 395, idx: 4 },
      { x: 158, y: 585, idx: 5 }
    ];
    housePts.forEach((hp) => {
      const hSp = this.add
        .image(hp.x, hp.y, 'building_house_t2')
        .setScale(0.84)
        .setDepth(15)
        .setInteractive({ useHandCursor: true });
      hSp.on('pointerdown', () => {
        SoundSynthesizer.playSfx('tap');
        GameState.upgradeHouse(hp.idx);
        this.openCitizensModal();
      });
    });

    // Alarm Bell & Decree Box flanking the Solar Keep
    const bellSp = this.add
      .image(154, 245, 'prop_alarm_bell')
      .setScale(0.95)
      .setDepth(17)
      .setInteractive({ useHandCursor: true });
    bellSp.on('pointerdown', () => {
      SoundSynthesizer.playSfx('boss_horn');
      this.scene.start('BattleScene', { wave: GameState.state.currentWave, isOpeningHook: false });
    });

    const decreeSp = this.add
      .image(286, 245, 'prop_decree_box')
      .setScale(0.95)
      .setDepth(17)
      .setInteractive({ useHandCursor: true });
    decreeSp.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.openEdictsModal();
    });

    // Corner Watchtowers on the Perimeter Wall
    this.add
      .image(42, 178, 'turret_archer')
      .setScale(0.85)
      .setDepth(16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openBuildingModal('turret_workshop'));
    this.add
      .image(398, 178, 'turret_cannon')
      .setScale(0.85)
      .setDepth(16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openBuildingModal('turret_workshop'));
  }

  private createParticlesAndCitizens(): void {
    this.sparkEmitter = this.add.particles(0, 0, 'particle_flare', {
      speed: { min: 40, max: 140 },
      lifespan: 500,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffb020, 0xfff3d1, 0x2ecc71],
      emitting: false
    });
    this.sparkEmitter.setDepth(55);

    // Crowned Hero Kaelen patrolling the courtyard with his cyan aura ring
    const heroRing = this.add.image(220, 302, 'hero_selection_ring').setScale(0.9).setDepth(15);
    const heroSp = this.add.image(220, 290, 'hero_kaelen').setScale(1.02).setDepth(19);
    this.tweens.add({
      targets: [heroSp, heroRing],
      x: 248,
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Animated Citizen Workers walking between Solar Keep and production buildings
    const routes = [
      { x1: 220, y1: 245, x2: 92, y2: 330 },
      { x1: 220, y1: 245, x2: 348, y2: 330 },
      { x1: 220, y1: 245, x2: 92, y2: 450 },
      { x1: 220, y1: 245, x2: 335, y2: 550 }
    ];

    routes.forEach((r, idx) => {
      const citizen = this.add.image(r.x1, r.y1, 'citizen_worker').setScale(0.95).setDepth(16);
      this.tweens.add({
        targets: citizen,
        x: r.x2,
        y: r.y2,
        duration: 3100 + idx * 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
  }

  private createBuildingsGrid(): void {
    const H = this.scale?.height || 956;
    const scaleY = H < 840 ? 0.84 : 1.0;

    const layout: Array<{ id: BuildingId; x: number; y: number; icon: string }> = [
      { id: 'town_hall', x: 220, y: Math.round(225 * scaleY), icon: '👑' },
      { id: 'farm', x: 92, y: Math.round(330 * scaleY), icon: '🍴' },
      { id: 'lumber_mill', x: 348, y: Math.round(330 * scaleY), icon: '🪵' },
      { id: 'academy', x: 220, y: Math.round(400 * scaleY), icon: '📘' },
      { id: 'mine', x: 92, y: Math.round(460 * scaleY), icon: '🔥' },
      { id: 'hero_tavern', x: 348, y: Math.round(460 * scaleY), icon: '🍺' },
      { id: 'barracks', x: 102, y: Math.round(565 * scaleY), icon: '⚔️' },
      { id: 'turret_workshop', x: 338, y: Math.round(565 * scaleY), icon: '⚙️' },
      { id: 'walls', x: 220, y: Math.round(620 * scaleY), icon: '🛡️' }
    ];

    this.buildingNodes = {};
    for (const item of layout) {
      const lv = GameState.state.buildings[item.id] || 0;
      const tier = GameState.getVisualTier(item.id);
      const texKey = `building_${item.id}_t${tier}`;

      const sprite = this.add
        .image(item.x, item.y, texKey)
        .setScale(1.06)
        .setAlpha(lv > 0 ? 1 : 0.55)
        .setDepth(18)
        .setInteractive({ useHandCursor: true });

      const bBubble = this.add
        .image(item.x + 26, item.y - 38, 'ui_speech_bubble')
        .setScale(0.78)
        .setDepth(21);
      const bIcon = this.add
        .text(item.x + 26, item.y - 41, item.icon, { fontSize: '14px', resolution: 2 })
        .setOrigin(0.5)
        .setDepth(22);
      this.tweens.add({
        targets: [bBubble, bIcon],
        y: '-=4',
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      const nameLabel = this.add
        .text(item.x, item.y + (item.id === 'town_hall' ? 46 : 36), I18n.t(`building.${item.id}`), {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          stroke: '#10172A',
          strokeThickness: 4,
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(20);

      const levelBadge = this.add
        .text(item.x - 30, item.y - 26, lv > 0 ? `Lv.${lv}` : '🔒', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#14182E',
          backgroundColor: lv > 0 ? '#FFB020' : '#B8C0D0',
          padding: { x: 5, y: 1 },
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(21);

      const timerText = this.add
        .text(item.x, item.y - 46, '', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#2ECC71',
          backgroundColor: 'rgba(20,24,46,0.92)',
          padding: { x: 5, y: 2 },
          resolution: 2
        })
        .setOrigin(0.5)
        .setDepth(22)
        .setVisible(false);

      const redDot = this.add
        .circle(item.x + 40, item.y - 48, 6, 0xff3b5c, 1)
        .setStrokeStyle(1.5, 0xfff3d1, 1)
        .setDepth(23)
        .setVisible(false);

      sprite.on('pointerdown', () => {
        SoundSynthesizer.playSfx('tap');
        if (GameState.tryFreeFinishTimer(item.id)) {
          this.onBuildingLeveledUp(item.id);
          return;
        }
        this.openBuildingModal(item.id);
      });

      this.buildingNodes[item.id] = {
        id: item.id,
        x: item.x,
        y: item.y,
        sprite,
        nameLabel,
        levelBadge,
        timerText,
        redDot,
        lastLevel: lv
      };
    }

    this.refreshBuildingVisuals();
  }

  private onBuildingLeveledUp(buildingId: BuildingId): void {
    const node = this.buildingNodes[buildingId];
    if (!node) return;

    SoundSynthesizer.playSfx('upgrade');
    const tier = GameState.getVisualTier(buildingId);
    node.sprite.setTexture(`building_${buildingId}_t${tier}`);
    node.sprite.setAlpha(1);

    node.sprite.setScale(1.34, 0.75);
    this.tweens.add({
      targets: node.sprite,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 280,
      ease: 'Back.easeOut'
    });

    this.sparkEmitter.setPosition(node.x, node.y);
    this.sparkEmitter.explode(18);
    this.spawnFloatingText(node.x, node.y - 35, `⬆️ Lv.${GameState.state.buildings[buildingId]}! +POWER`, '#FFB020');
    GameState.saveToBridge();
    this.refreshBuildingVisuals();
  }

  private createTopHud(): void {
    const hud = this.add.container(0, 0).setDepth(60);
    const bg = this.add.rectangle(220, 54, 440, 108, 0x14182e, 0.95);
    const border = this.add.rectangle(220, 108, 440, 3, 0xffb020, 1);

    const powerBg = this.add
      .rectangle(220, 24, 198, 34, 0x1e3a5f, 1)
      .setStrokeStyle(2, 0xffb020, 1);
    this.powerText = this.add
      .text(220, 24, `☀️ ${I18n.t('hud.power')}: ${GameState.getPower().toLocaleString()}`, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#FFB020',
        resolution: 2
      })
      .setOrigin(0.5);

    const langBtn = this.add
      .rectangle(46, 24, 68, 30, 0x1e3a5f, 1)
      .setStrokeStyle(1.5, 0x2ce8c8, 1)
      .setInteractive({ useHandCursor: true });
    const langTxt = this.add
      .text(46, 24, `🌐 ${I18n.getLocale().toUpperCase()}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#2CE8C8',
        resolution: 2
      })
      .setOrigin(0.5);
    langBtn.on('pointerdown', () => {
      const locales = I18n.getSupportedLocales();
      const nextIdx = (locales.indexOf(I18n.getLocale()) + 1) % locales.length;
      I18n.setLocale(locales[nextIdx] as SupportedLocale);
      this.scene.restart();
    });

    const muteBtn = this.add
      .rectangle(394, 24, 64, 30, 0x1e3a5f, 1)
      .setStrokeStyle(1.5, 0xffb020, 1)
      .setInteractive({ useHandCursor: true });
    const muteTxt = this.add
      .text(394, 24, SoundSynthesizer.isMuted() ? '🔇' : '🔊', {
        fontSize: '14px',
        resolution: 2
      })
      .setOrigin(0.5);
    muteBtn.on('pointerdown', () => {
      const muted = SoundSynthesizer.toggleUserMute();
      muteTxt.setText(muted ? '🔇' : '🔊');
    });

    this.resTextLine1 = this.add
      .text(220, 58, '', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        resolution: 2
      })
      .setOrigin(0.5);

    this.resTextLine2 = this.add
      .text(220, 84, '', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#2CE8C8',
        resolution: 2
      })
      .setOrigin(0.5);

    hud.add([bg, border, powerBg, this.powerText, langBtn, langTxt, muteBtn, muteTxt, this.resTextLine1, this.resTextLine2]);
    this.updateTopHudTexts();
  }

  private createBottomBar(): void {
    const H = this.scale?.height || 956;
    const topY = H - 210;

    const bar = this.add.container(0, 0).setDepth(60);
    const bg = this.add.rectangle(220, H - 105, 440, 210, 0x14182e, 0.97);
    const topBorder = this.add.rectangle(220, topY, 440, 3, 0xffb020, 1);
    bar.add([bg, topBorder]);

    // 1. Always-visible Parchment Chapter Missions Bar
    const missionY = topY + 26;
    const missionBg = this.add
      .rectangle(220, missionY, 416, 38, 0xf5e6c8, 0.98)
      .setStrokeStyle(2, 0xd97724, 1)
      .setInteractive({ useHandCursor: true });
    this.missionBarText = this.add
      .text(24, missionY, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#2C1810',
        resolution: 2
      })
      .setOrigin(0, 0.5);
    this.missionDot = this.add.circle(416, missionY - 12, 7, 0xff3b5c, 1).setStrokeStyle(1.5, 0xffffff, 1);

    missionBg.on('pointerdown', () => {
      const claimed = GameState.claimCurrentChapterMission();
      if (claimed) {
        SoundSynthesizer.playSfx('upgrade');
        this.spawnFloatingText(220, missionY - 20, `+${I18n.t('mission.claim')}`, '#2ECC71');
        GameState.saveToBridge();
        this.refreshBuildingVisuals();
      }
    });
    bar.add([missionBg, this.missionBarText, this.missionDot]);

    // 2. Three Kingshot Meta Sub-Buttons: Citizens, Royal Edicts, Warden Panoply
    const subY = topY + 76;
    const subButtons = [
      { label: `👥 ${I18n.t('village.citizens_panel')}`, x: 80, action: () => this.openCitizensModal() },
      { label: `📜 ${I18n.t('village.edicts')}`, x: 220, action: () => this.openEdictsModal() },
      { label: `🛡️ ${I18n.t('village.panoply')}`, x: 360, action: () => this.openPanoplyModal() }
    ];

    for (const sb of subButtons) {
      const btn = this.add
        .rectangle(sb.x, subY, 130, 44, 0x1e3a5f, 1)
        .setStrokeStyle(2, 0x2ce8c8, 1)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(sb.x, subY, sb.label, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFF3D1',
          align: 'center',
          wordWrap: { width: 120 },
          resolution: 2
        })
        .setOrigin(0.5);
      btn.on('pointerdown', () => {
        SoundSynthesizer.playSfx('tap');
        sb.action();
      });
      bar.add([btn, txt]);
    }

    // 3. Large Primary Thumb CTA: DEFEND BASTION (Returns to Fortified Valley & Launches Wave)
    const defendY = H - 52;
    const defendBtn = this.add
      .rectangle(220, defendY, 404, 68, 0xd97724, 1)
      .setStrokeStyle(3, 0xffb020, 1)
      .setInteractive({ useHandCursor: true });

    this.defendBtnText = this.add
      .text(220, defendY, `⚔️ ${I18n.t('village.defend_btn')} — ${I18n.t('hud.wave')} ${GameState.state.currentWave}`, {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        resolution: 2
      })
      .setOrigin(0.5);

    defendBtn.on('pointerdown', () => {
      SoundSynthesizer.playSfx('tap');
      this.scene.start('BattleScene', { wave: GameState.state.currentWave, isOpeningHook: false });
    });

    bar.add([defendBtn, this.defendBtnText]);
  }

  private openBuildingModal(buildingId: BuildingId): void {
    this.closeActiveModal();

    const modal = this.add.container(220, 440).setDepth(85);
    const bg = this.add
      .rectangle(0, 0, 392, 330, 0x14182e, 0.97)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setInteractive();

    const currentLv = GameState.state.buildings[buildingId] || 0;
    const tier = GameState.getVisualTier(buildingId);
    const nextCfg = GameState.getNextBuildingLevelConfig(buildingId);
    const activeTimer = GameState.state.builders.find((b) => b.buildingId === buildingId);

    const icon = this.add.image(-120, -85, `building_${buildingId}_t${tier}`).setScale(0.75);
    const title = this.add
      .text(15, -105, `${I18n.t(`building.${buildingId}`)} (Lv.${currentLv})`, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#FFB020'
      })
      .setOrigin(0.5);

    const tierText = this.add
      .text(15, -78, `Visual Tier ${tier}/3 • Power +${balancingData.buildings[buildingId].levels[Math.max(0, currentLv - 1)]?.power || 60}`, {
        fontSize: '12px',
        color: '#2CE8C8'
      })
      .setOrigin(0.5);

    modal.add([bg, icon, title, tierText]);

    if (activeTimer) {
      const remSec = Math.max(0, Math.ceil((activeTimer.endsAtMs - Date.now()) / 1000));
      const isFree = remSec <= balancingData.meta.freeSpeedupThresholdSeconds;

      const timerStatus = this.add
        .text(0, -15, `⏳ Upgrading to Lv.${activeTimer.targetLevel}: ${remSec}s`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#FFF3D1'
        })
        .setOrigin(0.5);

      const actionBtn = this.add
        .rectangle(0, 45, 310, 46, isFree ? 0x2ecc71 : 0xd97724, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true });
      const actionTxt = this.add
        .text(0, 45, isFree ? `⚡ ${I18n.t('village.instant_free')}` : I18n.t('village.speedup_ad'), {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#14182E'
        })
        .setOrigin(0.5);

      actionBtn.on('pointerdown', async () => {
        if (GameState.tryFreeFinishTimer(buildingId)) {
          this.closeActiveModal();
          this.onBuildingLeveledUp(buildingId);
        } else {
          const ok = await BridgeManager.showRewarded('building_timer_speedup');
          if (ok) {
            GameState.applyRewardedSpeedup(buildingId);
            this.closeActiveModal();
            this.onBuildingLeveledUp(buildingId);
          }
        }
      });

      modal.add([timerStatus, actionBtn, actionTxt]);
    } else if (nextCfg) {
      const costParts = Object.entries(nextCfg.cost)
        .filter(([, v]) => (v || 0) > 0)
        .map(([k, v]) => `${I18n.t(`res.${k}`)}: ${v}`)
        .join('  •  ');

      const infoTxt = this.add
        .text(
          0,
          -18,
          `Next: Lv.${nextCfg.nextLevel}   ⏱️ ${nextCfg.timeSec}s\nCost: ${costParts}\nReq. ${I18n.t('building.town_hall')} Lv.${nextCfg.requiredTownHall}`,
          {
            fontSize: '12px',
            color: '#FFF3D1',
            align: 'center',
            lineSpacing: 6
          }
        )
        .setOrigin(0.5);

      const canCheck = GameState.canUpgradeBuilding(buildingId);
      const upgBtn = this.add
        .rectangle(0, 52, 310, 48, canCheck.ok ? 0x2ecc71 : 0x3b4254, 1)
        .setStrokeStyle(2, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true });

      const upgTxt = this.add
        .text(
          0,
          52,
          canCheck.ok
            ? `⬆️ ${I18n.t('village.upgrade')} (${nextCfg.timeSec <= 45 ? I18n.t('village.instant_free') : nextCfg.timeSec + 's'})`
            : `🔒 ${canCheck.reason}`,
          {
            fontSize: '14px',
            fontStyle: 'bold',
            color: canCheck.ok ? '#14182E' : '#FF3B5C'
          }
        )
        .setOrigin(0.5);

      upgBtn.on('pointerdown', () => {
        const res = GameState.startBuildingUpgrade(buildingId);
        if (res.started) {
          // Auto-apply free finish if under 45s threshold so first session feels ultra-snappy!
          if (!res.instant && nextCfg.timeSec <= balancingData.meta.freeSpeedupThresholdSeconds) {
            GameState.tryFreeFinishTimer(buildingId);
          }
          this.closeActiveModal();
          this.onBuildingLeveledUp(buildingId);
        }
      });

      modal.add([infoTxt, upgBtn, upgTxt]);
    }

    // If Academy is unlocked, show 3-branch research buttons
    if (buildingId === 'academy' && currentLv > 0) {
      const branches: Array<'growth' | 'economy' | 'battle'> = ['growth', 'economy', 'battle'];
      branches.forEach((b, idx) => {
        const bx = -115 + idx * 115;
        const rBtn = this.add
          .rectangle(bx, 118, 104, 34, 0x1e3a5f, 1)
          .setStrokeStyle(1.5, 0x2ce8c8, 1)
          .setInteractive({ useHandCursor: true });
        const rTxt = this.add
          .text(bx, 118, `${b.toUpperCase()} Lv.${GameState.state.researchLevels[b]}`, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#2CE8C8'
          })
          .setOrigin(0.5);
        rBtn.on('pointerdown', () => {
          if (GameState.upgradeResearch(b)) {
            SoundSynthesizer.playSfx('upgrade');
            this.openBuildingModal(buildingId);
          }
        });
        modal.add([rBtn, rTxt]);
      });
    }

    this.addCloseButtonToModal(modal);
    this.activeModal = modal;
  }

  private openCitizensModal(): void {
    this.closeActiveModal();
    const modal = this.add.container(220, 440).setDepth(85);
    const bg = this.add
      .rectangle(0, 0, 392, 340, 0x14182e, 0.97)
      .setStrokeStyle(2.5, 0x2ce8c8, 1)
      .setInteractive();

    const maxCit = GameState.getMaxCitizens();
    const usedCit = GameState.getAssignedCitizenCount();
    const moraleMult = GameState.getMoraleMultipliers();

    const title = this.add
      .text(
        0,
        -132,
        `👥 ${I18n.t('village.citizens_panel')} (${usedCit}/${maxCit})\n☀️ ${I18n.t('hud.morale')}: ${GameState.state.morale}% (Prod. x${moraleMult.prodMultiplier})`,
        {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#2CE8C8',
          align: 'center'
        }
      )
      .setOrigin(0.5);

    modal.add([bg, title]);

    const targets: Array<keyof typeof GameState.state.assignedWorkers> = [
      'farm',
      'lumber_mill',
      'mine',
      'turret_workshop'
    ];

    targets.forEach((tKey, i) => {
      const y = -60 + i * 52;
      const count = GameState.state.assignedWorkers[tKey];
      const rowLbl = this.add
        .text(-165, y, `${I18n.t(`building.${tKey}`)}: ${count} 👥 (+${Math.round(count * 12)}%)`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#FFF3D1'
        })
        .setOrigin(0, 0.5);

      const minusBtn = this.add
        .rectangle(105, y, 36, 32, 0x1e3a5f, 1)
        .setStrokeStyle(1.5, 0xffb020, 1)
        .setInteractive({ useHandCursor: true });
      const minusTxt = this.add.text(105, y, '-', { fontSize: '16px', fontStyle: 'bold', color: '#FFB020' }).setOrigin(0.5);
      minusBtn.on('pointerdown', () => {
        if (GameState.assignWorker(tKey, -1)) this.openCitizensModal();
      });

      const plusBtn = this.add
        .rectangle(152, y, 36, 32, 0x2ecc71, 1)
        .setStrokeStyle(1.5, 0xfff3d1, 1)
        .setInteractive({ useHandCursor: true });
      const plusTxt = this.add.text(152, y, '+', { fontSize: '16px', fontStyle: 'bold', color: '#14182E' }).setOrigin(0.5);
      plusBtn.on('pointerdown', () => {
        if (GameState.assignWorker(tKey, 1)) this.openCitizensModal();
      });

      modal.add([rowLbl, minusBtn, minusTxt, plusBtn, plusTxt]);
    });

    this.addCloseButtonToModal(modal);
    this.activeModal = modal;
  }

  private openEdictsModal(): void {
    this.closeActiveModal();
    const modal = this.add.container(220, 440).setDepth(85);
    const bg = this.add
      .rectangle(0, 0, 392, 340, 0x14182e, 0.97)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setInteractive();

    const title = this.add
      .text(0, -135, `📜 ${I18n.t('village.edicts')}`, {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#FFB020'
      })
      .setOrigin(0.5);

    modal.add([bg, title]);

    balancingData.royalEdicts.forEach((edict, idx) => {
      const y = -72 + idx * 58;
      const cdRemSec = Math.max(0, Math.ceil(((GameState.state.edictCooldownUntilMs[edict.id] || 0) - Date.now()) / 1000));
      const ready = cdRemSec <= 0;

      const btn = this.add
        .rectangle(0, y, 348, 46, ready ? 0x1e3a5f : 0x2b3044, 1)
        .setStrokeStyle(1.5, ready ? 0xffb020 : 0x555b6e, 1)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(0, y, `${I18n.t(edict.nameKey)} ${ready ? '— ⚡ ACTIVATE' : `(CD ${cdRemSec}s)`}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: ready ? '#2ECC71' : '#B8C0D0'
        })
        .setOrigin(0.5);

      btn.on('pointerdown', () => {
        if (GameState.activateEdict(edict.id)) {
          SoundSynthesizer.playSfx('upgrade');
          GameState.saveToBridge();
          this.openEdictsModal();
        }
      });

      modal.add([btn, txt]);
    });

    this.addCloseButtonToModal(modal);
    this.activeModal = modal;
  }

  private openPanoplyModal(): void {
    this.closeActiveModal();
    const modal = this.add.container(220, 440).setDepth(85);
    const bg = this.add
      .rectangle(0, 0, 392, 360, 0x14182e, 0.97)
      .setStrokeStyle(2.5, 0xffb020, 1)
      .setInteractive();

    const title = this.add
      .text(0, -148, `🛡️ ${I18n.t('village.panoply')}`, {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#FFB020'
      })
      .setOrigin(0.5);

    modal.add([bg, title]);

    balancingData.wardenPanoply.forEach((slotCfg, idx) => {
      const y = -95 + idx * 45;
      const tier = GameState.state.panoplyTiers[slotCfg.slot] || 0;
      const goldCost = (tier + 1) * 35;

      const btn = this.add
        .rectangle(0, y, 348, 38, 0x1e3a5f, 1)
        .setStrokeStyle(1.5, 0xffb020, 1)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(0, y, `${slotCfg.slot.toUpperCase()} Tier ${tier} (+${Math.round(tier * slotCfg.bonusPerTier * 100)}%) — ⬆️ 🪙${goldCost}`, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#FFF3D1'
        })
        .setOrigin(0.5);

      btn.on('pointerdown', () => {
        if (GameState.upgradePanoplySlot(slotCfg.slot)) {
          SoundSynthesizer.playSfx('upgrade');
          GameState.saveToBridge();
          this.openPanoplyModal();
        }
      });

      modal.add([btn, txt]);
    });

    this.addCloseButtonToModal(modal);
    this.activeModal = modal;
  }

  private openOfflineEarningsModal(): void {
    const report = GameState.getPendingOfflineReport();
    if (!report) return;

    this.closeActiveModal();
    const modal = this.add.container(220, 440).setDepth(90);
    const bg = this.add
      .rectangle(0, 0, 384, 280, 0x14182e, 0.98)
      .setStrokeStyle(3, 0xffb020, 1)
      .setInteractive();

    const title = this.add
      .text(0, -98, `🌙 ${I18n.t('offline.title')}`, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#FFB020'
      })
      .setOrigin(0.5);

    const details = this.add
      .text(0, -30, `🌾 +${report.food}   🪵 +${report.wood}\n🪨 +${report.stone}   🪙 +${report.gold}`, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#FFF3D1',
        align: 'center',
        lineSpacing: 8
      })
      .setOrigin(0.5);

    const doubleBtn = this.add
      .rectangle(-82, 65, 152, 44, 0x2ecc71, 1)
      .setStrokeStyle(2, 0xfff3d1, 1)
      .setInteractive({ useHandCursor: true });
    const doubleTxt = this.add
      .text(-82, 65, I18n.t('offline.double'), {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#14182E'
      })
      .setOrigin(0.5);
    doubleBtn.on('pointerdown', async () => {
      const ok = await BridgeManager.showRewarded('offline_earnings_double');
      GameState.consumePendingOfflineReport(ok ? 2 : 1);
      await GameState.saveToBridge();
      this.closeActiveModal();
    });

    const claimBtn = this.add
      .rectangle(82, 65, 152, 44, 0x1e3a5f, 1)
      .setStrokeStyle(2, 0xffb020, 1)
      .setInteractive({ useHandCursor: true });
    const claimTxt = this.add
      .text(82, 65, I18n.t('offline.claim'), {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#FFB020'
      })
      .setOrigin(0.5);
    claimBtn.on('pointerdown', async () => {
      GameState.consumePendingOfflineReport(1);
      await GameState.saveToBridge();
      this.closeActiveModal();
    });

    modal.add([bg, title, details, doubleBtn, doubleTxt, claimBtn, claimTxt]);
    this.activeModal = modal;
  }

  private addCloseButtonToModal(modal: Phaser.GameObjects.Container): void {
    const closeBtn = this.add
      .text(174, -142, '✕', {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#FF3B5C'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeActiveModal());
    modal.add(closeBtn);
  }

  private closeActiveModal(): void {
    if (this.activeModal) {
      this.activeModal.destroy();
      this.activeModal = null;
    }
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string): void {
    const txt = this.add
      .text(x, y, msg, {
        fontSize: '13px',
        fontStyle: 'bold',
        color,
        stroke: '#14182E',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(75);
    this.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: 0,
      duration: 750,
      onComplete: () => txt.destroy()
    });
  }

  public refreshBuildingVisuals(): void {
    const now = Date.now();
    for (const [bId, node] of Object.entries(this.buildingNodes)) {
      const id = bId as BuildingId;
      const lv = GameState.state.buildings[id] || 0;
      const tier = GameState.getVisualTier(id);

      node.sprite.setTexture(`building_${id}_t${tier}`);
      node.sprite.setAlpha(lv > 0 ? 1 : 0.45);
      node.levelBadge.setText(lv > 0 ? `Lv.${lv}` : '🔒');
      node.levelBadge.setBackgroundColor(lv > 0 ? '#FFB020' : '#B8C0D0');

      const activeTimer = GameState.state.builders.find((b) => b.buildingId === id);
      if (activeTimer) {
        const remSec = Math.max(0, Math.ceil((activeTimer.endsAtMs - now) / 1000));
        const isFree = remSec <= balancingData.meta.freeSpeedupThresholdSeconds;
        node.timerText.setVisible(true);
        node.timerText.setText(isFree ? `⚡ ${I18n.t('village.instant_free')}` : `⏳ ${remSec}s`);
        node.redDot.setVisible(isFree);
      } else {
        node.timerText.setVisible(false);
        const canUpg = GameState.canUpgradeBuilding(id, now).ok;
        node.redDot.setVisible(canUpg);
      }

      if (lv > node.lastLevel) {
        node.lastLevel = lv;
        this.onBuildingLeveledUp(id);
      }
    }

    this.updateTopHudTexts();
  }

  private updateTopHudTexts(): void {
    if (!this.powerText?.active) return;

    this.powerText.setText(`☀️ ${I18n.t('hud.power')}: ${GameState.getPower().toLocaleString()}`);

    const r = GameState.state.resources;
    const caps = GameState.getStorageCaps();
    this.resTextLine1.setText(
      `🌾 ${Math.floor(r.food)}/${caps.food}   🪵 ${Math.floor(r.wood)}/${caps.wood}   🪨 ${Math.floor(r.stone)}/${caps.stone}   🪙 ${Math.floor(r.gold)}/${caps.gold}`
    );

    this.resTextLine2.setText(
      `☀️ ${I18n.t('hud.morale')} ${GameState.state.morale}%   👥 ${GameState.getAssignedCitizenCount()}/${GameState.getMaxCitizens()}   🔨 ${GameState.state.builders.length}/${GameState.getMaxBuilderSlots()}   💎 ${Math.floor(r.shards)}`
    );

    if (this.missionBarText?.active && this.missionDot?.active) {
      const m = GameState.getCurrentChapterMission();
      if (m) {
        this.missionBarText.setText(
          `📜 ${I18n.t(m.descKey)} (${m.progress}/${m.target}) ${m.completed ? '— ' + I18n.t('mission.claim') : ''}`
        );
        this.missionBarText.setColor(m.completed ? '#146C3B' : '#2C1810');
        this.missionDot.setVisible(m.completed);
      } else {
        this.missionBarText.setText('📜 Tutti gli Obiettivi Completati!');
        this.missionBarText.setColor('#146C3B');
        this.missionDot.setVisible(false);
      }
    }

    if (this.defendBtnText?.active) {
      this.defendBtnText.setText(
        `${I18n.t('village.defend_btn')} — ${I18n.t('hud.wave')} ${GameState.state.currentWave}`
      );
    }
  }

  public update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    GameState.tick(dt);
    this.refreshBuildingVisuals();

    this.autoSaveAccumSec += dt;
    if (this.autoSaveAccumSec >= 15) {
      this.autoSaveAccumSec = 0;
      GameState.saveToBridge();
    }
  }

  private exposeTestHooks(): void {
    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    win.__DOWNFALL_TEST__ = {
      scene: 'VillageScene',
      getState: () => ({
        power: GameState.getPower(),
        resources: { ...GameState.state.resources },
        buildings: { ...GameState.state.buildings },
        currentWave: GameState.state.currentWave,
        highestWaveCleared: GameState.state.highestWaveCleared,
        morale: GameState.state.morale,
        assignedWorkers: { ...GameState.state.assignedWorkers }
      }),
      upgradeBuildingInstant: (buildingId: BuildingId) => {
        const next = GameState.getNextBuildingLevelConfig(buildingId);
        if (!next) return false;
        // Grant required resources if needed during automated test
        for (const [k, v] of Object.entries(next.cost)) {
          GameState.state.resources[k as keyof typeof GameState.state.resources] = Math.max(
            GameState.state.resources[k as keyof typeof GameState.state.resources],
            v || 0
          );
        }
        const res = GameState.startBuildingUpgrade(buildingId);
        if (res.started && !res.instant) {
          const timer = GameState.state.builders.find((b) => b.buildingId === buildingId);
          if (timer) timer.endsAtMs = Date.now() - 10;
          GameState.tick(0.1);
        }
        this.onBuildingLeveledUp(buildingId);
        return true;
      },
      activateEdict: (edictId: string) => GameState.activateEdict(edictId),
      upgradePanoply: (slot: string) => GameState.upgradePanoplySlot(slot),
      startBattle: (wave?: number, botAutoPlay = false) => {
        this.scene.start('BattleScene', {
          wave: wave ?? GameState.state.currentWave,
          isOpeningHook: false,
          botAutoPlay
        });
      }
    };
  }
}
