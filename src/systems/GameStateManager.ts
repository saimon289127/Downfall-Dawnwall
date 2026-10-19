import balancingData from '../config/balancing.json';
import { BridgeManager } from './BridgeManager';

export type ResourceKey = 'food' | 'wood' | 'stone' | 'gold' | 'shards';
export type BuildingId =
  | 'town_hall'
  | 'farm'
  | 'lumber_mill'
  | 'mine'
  | 'barracks'
  | 'turret_workshop'
  | 'walls'
  | 'academy'
  | 'hero_tavern';

export interface ActiveTimer {
  buildingId: BuildingId;
  targetLevel: number;
  startedAtMs: number;
  endsAtMs: number;
  totalSec: number;
}

export interface OfflineReport {
  elapsedSec: number;
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

export interface SaveStateV1 {
  version: 1;
  savedAtMs: number;
  tutorialHookCompleted: boolean;
  currentWave: number;
  highestWaveCleared: number;
  resources: Record<ResourceKey, number>;
  buildings: Record<BuildingId, number>;
  builders: ActiveTimer[];
  secondBuilderUnlockedUntilMs: number;
  morale: number;
  assignedWorkers: {
    farm: number;
    lumber_mill: number;
    mine: number;
    turret_workshop: number;
  };
  edictActiveUntilMs: Record<string, number>;
  edictCooldownUntilMs: Record<string, number>;
  panoplyTiers: Record<string, number>;
  heroes: Record<string, { unlocked: boolean; level: number; stars: number }>;
  clearedHexIds: string[];
  claimedMissionIds: string[];
  researchLevels: {
    growth: number;
    economy: number;
    battle: number;
  };
  houseLevels?: number[];
  nextFreeChestAtMs?: number;
  chestsOpened?: number;
  loginDaysClaimed?: number;
  claimedDailyIds?: string[];
  dailyCounters?: {
    wavesCleared: number;
    upgradesDone: number;
    squadsDeployed: number;
    turretsBuilt: number;
    edictsUsed: number;
  };
}

export class GameStateManagerClass {
  public state: SaveStateV1;
  private lastBackupJson = '';
  private listeners: Array<() => void> = [];
  private pendingOfflineReport: OfflineReport | null = null;

  constructor() {
    this.state = this.createDefaultState();
  }

  public createDefaultState(nowMs = Date.now()): SaveStateV1 {
    const start = balancingData.startingState;
    return {
      version: 1,
      savedAtMs: nowMs,
      tutorialHookCompleted: false,
      currentWave: 1,
      highestWaveCleared: 0,
      resources: {
        food: start.resources.food,
        wood: start.resources.wood,
        stone: start.resources.stone,
        gold: start.resources.gold,
        shards: start.resources.shards
      },
      buildings: {
        town_hall: start.buildings.town_hall,
        farm: start.buildings.farm,
        lumber_mill: start.buildings.lumber_mill,
        mine: start.buildings.mine,
        barracks: start.buildings.barracks,
        turret_workshop: start.buildings.turret_workshop,
        academy: start.buildings.academy,
        walls: start.buildings.walls,
        hero_tavern: start.buildings.hero_tavern
      },
      builders: [],
      secondBuilderUnlockedUntilMs: 0,
      morale: 90,
      assignedWorkers: {
        farm: 2,
        lumber_mill: 2,
        mine: 1,
        turret_workshop: 1
      },
      edictActiveUntilMs: {},
      edictCooldownUntilMs: {},
      panoplyTiers: {
        helm: 1,
        cuirass: 1,
        gauntlets: 1,
        greaves: 0,
        halberd: 1,
        banner: 0
      },
      heroes: {
        kaelen: { unlocked: true, level: 1, stars: 1 },
        lyra: { unlocked: false, level: 1, stars: 1 },
        thorne: { unlocked: false, level: 1, stars: 1 },
        nyxara: { unlocked: false, level: 1, stars: 1 },
        aurelius: { unlocked: false, level: 1, stars: 1 },
        valkyra: { unlocked: false, level: 1, stars: 1 }
      },
      clearedHexIds: ['hex_0'],
      claimedMissionIds: [],
      researchLevels: {
        growth: 0,
        economy: 0,
        battle: 0
      },
      houseLevels: [1, 1, 1, 1, 1],
      nextFreeChestAtMs: 0,
      chestsOpened: 0,
      loginDaysClaimed: 0,
      claimedDailyIds: [],
      dailyCounters: {
        wavesCleared: 0,
        upgradesDone: 0,
        squadsDeployed: 0,
        turretsBuilt: 0,
        edictsUsed: 0
      }
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public notify(): void {
    for (const l of this.listeners) {
      l();
    }
  }

  public getVisualTier(buildingId: BuildingId): 1 | 2 | 3 {
    const lv = Math.max(1, this.state.buildings[buildingId] || 1);
    if (lv >= 7) return 3;
    if (lv >= 4) return 2;
    return 1;
  }

  public getHouseLevel(houseIndex: number): number {
    if (!this.state.houseLevels) {
      this.state.houseLevels = [1, 1, 1, 1, 1];
    }
    return this.state.houseLevels[houseIndex - 1] ?? 1;
  }

  public upgradeHouse(houseIndex: number): boolean {
    if (!this.state.houseLevels) {
      this.state.houseLevels = [1, 1, 1, 1, 1];
    }
    const idx = houseIndex - 1;
    if (idx < 0 || idx >= 5) return false;
    const cur = this.state.houseLevels[idx] || 0;
    if (cur >= 10) return false;
    const woodCost = Math.max(25, (cur + 1) * 30);
    const foodCost = Math.max(20, (cur + 1) * 25);
    if (this.state.resources.wood < woodCost || this.state.resources.food < foodCost) {
      return false;
    }
    this.state.resources.wood -= woodCost;
    this.state.resources.food -= foodCost;
    this.state.houseLevels[idx] = cur + 1;
    this.state.morale = Math.min(100, this.state.morale + 3);
    this.recordDailyAction('upgradesDone', 1);
    this.notify();
    return true;
  }

  public getMaxCitizens(): number {
    const thLv = Math.max(1, Math.min(10, this.state.buildings.town_hall));
    const base = balancingData.citizenSystem.basePopulationByTownHall[thLv - 1] || 6;
    const houses = this.state.houseLevels || [1, 1, 1, 1, 1];
    const houseBonus = houses.reduce((acc, lv) => acc + Math.max(0, lv - 1), 0);
    return base + this.state.researchLevels.growth * 2 + houseBonus;
  }

  public getAssignedCitizenCount(): number {
    const w = this.state.assignedWorkers;
    return w.farm + w.lumber_mill + w.mine + w.turret_workshop;
  }

  public assignWorker(target: keyof SaveStateV1['assignedWorkers'], delta: number): boolean {
    const current = this.state.assignedWorkers[target];
    const next = current + delta;
    if (next < 0) return false;
    if (delta > 0 && this.getAssignedCitizenCount() >= this.getMaxCitizens()) return false;
    this.state.assignedWorkers[target] = next;
    this.notify();
    return true;
  }

  public getMoraleMultipliers(): { prodMultiplier: number; buildSpeedMultiplier: number } {
    const morale = this.state.morale;
    for (const tier of balancingData.citizenSystem.moraleTiers) {
      if (morale >= tier.minMorale) {
        return {
          prodMultiplier: tier.prodMultiplier,
          buildSpeedMultiplier: tier.buildSpeedMultiplier
        };
      }
    }
    return { prodMultiplier: 1.0, buildSpeedMultiplier: 1.0 };
  }

  public getStorageCaps(): Record<ResourceKey, number> {
    const farmLv = this.state.buildings.farm;
    const millLv = this.state.buildings.lumber_mill;
    const mineLv = this.state.buildings.mine;

    const farmCfg = farmLv > 0 ? balancingData.buildings.farm.levels[farmLv - 1] : null;
    const millCfg = millLv > 0 ? balancingData.buildings.lumber_mill.levels[millLv - 1] : null;
    const mineCfg = mineLv > 0 ? balancingData.buildings.mine.levels[mineLv - 1] : null;

    const econMult = 1 + this.state.researchLevels.economy * 0.15;

    return {
      food: Math.round(((farmCfg?.cap ?? 500) + 400) * econMult),
      wood: Math.round(((millCfg?.cap ?? 500) + 400) * econMult),
      stone: Math.round(((mineCfg?.stoneCap ?? 300) + 250) * econMult),
      gold: Math.round(((mineCfg?.goldCap ?? 120) + 150) * econMult),
      shards: 9999
    };
  }

  public getProductionRatesPerMin(nowMs = Date.now()): { food: number; wood: number; stone: number; gold: number } {
    const farmLv = this.state.buildings.farm;
    const millLv = this.state.buildings.lumber_mill;
    const mineLv = this.state.buildings.mine;

    const farmBase = farmLv > 0 ? balancingData.buildings.farm.levels[farmLv - 1].ratePerMin : 0;
    const millBase = millLv > 0 ? balancingData.buildings.lumber_mill.levels[millLv - 1].ratePerMin : 0;
    const stoneBase = mineLv > 0 ? balancingData.buildings.mine.levels[mineLv - 1].stonePerMin : 0;
    const goldBase = mineLv > 0 ? balancingData.buildings.mine.levels[mineLv - 1].goldPerMin : 4;

    const workerBonus = balancingData.citizenSystem.workerBonusPerAssigned;
    const moraleMult = this.getMoraleMultipliers().prodMultiplier;
    const edictDoubleShift = (this.state.edictActiveUntilMs.double_shift || 0) > nowMs ? 1.5 : 1.0;
    const bannerMult = 1 + (this.state.panoplyTiers.banner || 0) * 0.08;
    const econResearchMult = 1 + this.state.researchLevels.economy * 0.1;

    const globalMult = moraleMult * edictDoubleShift * bannerMult * econResearchMult;

    return {
      food: Math.round(farmBase * (1 + this.state.assignedWorkers.farm * workerBonus) * globalMult),
      wood: Math.round(millBase * (1 + this.state.assignedWorkers.lumber_mill * workerBonus) * globalMult),
      stone: Math.round(stoneBase * (1 + this.state.assignedWorkers.mine * workerBonus) * globalMult),
      gold: Math.round(goldBase * (1 + this.state.assignedWorkers.mine * workerBonus) * globalMult)
    };
  }

  public tick(deltaSec: number, nowMs = Date.now()): void {
    if (deltaSec <= 0) return;

    // 1. Passive resource accumulation clamped to storage cap
    const rates = this.getProductionRatesPerMin(nowMs);
    const caps = this.getStorageCaps();

    (['food', 'wood', 'stone', 'gold'] as const).forEach((key) => {
      const gained = (rates[key] / 60) * deltaSec;
      if (this.state.resources[key] < caps[key]) {
        this.state.resources[key] = Math.min(caps[key], this.state.resources[key] + gained);
      }
    });

    // 2. Complete any finished construction timers
    let completedAny = false;
    const remaining: ActiveTimer[] = [];
    for (const timer of this.state.builders) {
      if (nowMs >= timer.endsAtMs) {
        this.state.buildings[timer.buildingId] = timer.targetLevel;
        completedAny = true;
      } else {
        remaining.push(timer);
      }
    }
    if (completedAny) {
      this.state.builders = remaining;
      this.notify();
    }
  }

  public getMaxBuilderSlots(nowMs = Date.now()): number {
    if (this.state.buildings.town_hall >= 4) return 2;
    if (this.state.secondBuilderUnlockedUntilMs > nowMs) return 2;
    return 1;
  }

  public getNextBuildingLevelConfig(buildingId: BuildingId): {
    nextLevel: number;
    cost: Partial<Record<ResourceKey, number>>;
    timeSec: number;
    requiredTownHall: number;
  } | null {
    const currentLv = this.state.buildings[buildingId] || 0;
    const bCfg = balancingData.buildings[buildingId];
    if (!bCfg || currentLv >= bCfg.maxLevel) return null;

    const nextLevel = currentLv + 1;
    const lvData = bCfg.levels.find((l) => l.level === nextLevel);
    if (!lvData) return null;

    const unlockTh = ('unlockTownHall' in bCfg ? (bCfg as { unlockTownHall: number }).unlockTownHall : 1) || 1;
    const reqTh = buildingId === 'town_hall' ? currentLv : Math.max(unlockTh, nextLevel);

    const moraleBuildMult = this.getMoraleMultipliers().buildSpeedMultiplier;
    const growthResearchMult = 1 + this.state.researchLevels.growth * 0.1;
    const adjustedTimeSec = Math.max(
      0,
      Math.round(lvData.timeSec / (moraleBuildMult * growthResearchMult))
    );

    return {
      nextLevel,
      cost: lvData.cost as Partial<Record<ResourceKey, number>>,
      timeSec: adjustedTimeSec,
      requiredTownHall: reqTh
    };
  }

  public canUpgradeBuilding(buildingId: BuildingId, nowMs = Date.now()): { ok: boolean; reason?: string } {
    if (this.state.builders.some((b) => b.buildingId === buildingId)) {
      return { ok: false, reason: 'busy' };
    }
    if (this.state.builders.length >= this.getMaxBuilderSlots(nowMs)) {
      return { ok: false, reason: 'no_builder' };
    }
    const next = this.getNextBuildingLevelConfig(buildingId);
    if (!next) return { ok: false, reason: 'max_level' };

    if (buildingId !== 'town_hall' && this.state.buildings.town_hall < next.requiredTownHall) {
      return { ok: false, reason: 'need_town_hall' };
    }

    for (const [res, amt] of Object.entries(next.cost)) {
      if ((this.state.resources[res as ResourceKey] || 0) < (amt || 0)) {
        return { ok: false, reason: `need_${res}` };
      }
    }
    return { ok: true };
  }

  public startBuildingUpgrade(buildingId: BuildingId, nowMs = Date.now()): { started: boolean; instant: boolean } {
    const check = this.canUpgradeBuilding(buildingId, nowMs);
    if (!check.ok) return { started: false, instant: false };

    const next = this.getNextBuildingLevelConfig(buildingId)!;
    for (const [res, amt] of Object.entries(next.cost)) {
      this.state.resources[res as ResourceKey] -= amt || 0;
    }

    if (next.timeSec <= 0) {
      this.state.buildings[buildingId] = next.nextLevel;
      this.notify();
      return { started: true, instant: true };
    }

    this.state.builders.push({
      buildingId,
      targetLevel: next.nextLevel,
      startedAtMs: nowMs,
      endsAtMs: nowMs + next.timeSec * 1000,
      totalSec: next.timeSec
    });
    this.notify();
    return { started: true, instant: false };
  }

  public tryFreeFinishTimer(buildingId: BuildingId, nowMs = Date.now()): boolean {
    const idx = this.state.builders.findIndex((b) => b.buildingId === buildingId);
    if (idx === -1) return false;
    const timer = this.state.builders[idx];
    const remSec = (timer.endsAtMs - nowMs) / 1000;
    if (remSec <= balancingData.meta.freeSpeedupThresholdSeconds) {
      this.state.buildings[timer.buildingId] = timer.targetLevel;
      this.state.builders.splice(idx, 1);
      this.notify();
      return true;
    }
    return false;
  }

  public applyRewardedSpeedup(buildingId: BuildingId, nowMs = Date.now()): boolean {
    const idx = this.state.builders.findIndex((b) => b.buildingId === buildingId);
    if (idx === -1) return false;
    const timer = this.state.builders[idx];
    const remMs = Math.max(0, timer.endsAtMs - nowMs);
    const reductionMs = Math.max(
      balancingData.meta.rewardedSpeedupFlatSeconds * 1000,
      Math.round(remMs * balancingData.meta.rewardedSpeedupPercent)
    );
    timer.endsAtMs = Math.max(nowMs, timer.endsAtMs - reductionMs);
    if (timer.endsAtMs <= nowMs) {
      this.state.buildings[timer.buildingId] = timer.targetLevel;
      this.state.builders.splice(idx, 1);
    }
    this.notify();
    return true;
  }

  public activateEdict(edictId: string, nowMs = Date.now()): boolean {
    const cfg = balancingData.royalEdicts.find((e) => e.id === edictId);
    if (!cfg) return false;
    if ((this.state.edictCooldownUntilMs[edictId] || 0) > nowMs) return false;

    this.state.edictCooldownUntilMs[edictId] = nowMs + cfg.cooldownSec * 1000;
    if (cfg.durationSec > 0) {
      this.state.edictActiveUntilMs[edictId] = nowMs + cfg.durationSec * 1000;
    }

    if (edictId === 'rush_build') {
      for (const timer of this.state.builders) {
        const rem = Math.max(0, timer.endsAtMs - nowMs);
        timer.endsAtMs -= Math.round(rem * 0.25);
      }
      this.tick(0.01, nowMs);
    } else if (edictId === 'festival_dawn') {
      this.state.morale = 100;
      const caps = this.getStorageCaps();
      this.state.resources.food = Math.min(caps.food, this.state.resources.food + 200);
      this.state.resources.gold = Math.min(caps.gold, this.state.resources.gold + 40);
    }

    this.notify();
    return true;
  }

  public upgradePanoplySlot(slot: string): boolean {
    const cfg = balancingData.wardenPanoply.find((p) => p.slot === slot);
    if (!cfg) return false;
    const currentTier = this.state.panoplyTiers[slot] || 0;
    if (currentTier >= 10) return false;
    const goldCost = (currentTier + 1) * 35;
    const stoneCost = (currentTier + 1) * 50;
    if (this.state.resources.gold < goldCost || this.state.resources.stone < stoneCost) {
      return false;
    }
    this.state.resources.gold -= goldCost;
    this.state.resources.stone -= stoneCost;
    this.state.panoplyTiers[slot] = currentTier + 1;
    this.notify();
    return true;
  }

  public upgradeResearch(branch: 'growth' | 'economy' | 'battle'): boolean {
    if (this.state.buildings.academy < 1) return false;
    const lv = this.state.researchLevels[branch];
    if (lv >= 10) return false;
    const goldCost = (lv + 1) * 30;
    const woodCost = (lv + 1) * 80;
    if (this.state.resources.gold < goldCost || this.state.resources.wood < woodCost) return false;
    this.state.resources.gold -= goldCost;
    this.state.resources.wood -= woodCost;
    this.state.researchLevels[branch] = lv + 1;
    this.notify();
    return true;
  }

  public getCombatMultipliers(nowMs = Date.now()): {
    turretDamageMult: number;
    troopStatMult: number;
    wallHp: number;
    turretSlots: number;
  } {
    const workshopLv = Math.max(1, this.state.buildings.turret_workshop);
    const barracksLv = Math.max(1, this.state.buildings.barracks);
    const wallLv = Math.max(1, this.state.buildings.walls);

    const baseTurretMult = balancingData.buildings.turret_workshop.levels[workshopLv - 1].turretDamageMult;
    const baseTroopMult = balancingData.buildings.barracks.levels[barracksLv - 1].troopStatMult;
    const wallCfg = balancingData.buildings.walls.levels[wallLv - 1];

    const martialMult = (this.state.edictActiveUntilMs.martial_law || 0) > nowMs ? 1.15 : 1.0;
    const halberdMult = 1 + (this.state.panoplyTiers.halberd || 0) * 0.1;
    const cuirassMult = 1 + (this.state.panoplyTiers.cuirass || 0) * 0.1;
    const helmMult = 1 + (this.state.panoplyTiers.helm || 0) * 0.08;
    const battleTechMult = 1 + this.state.researchLevels.battle * 0.12;
    const workerTurretMult = 1 + this.state.assignedWorkers.turret_workshop * 0.06;

    return {
      turretDamageMult: baseTurretMult * martialMult * halberdMult * battleTechMult * workerTurretMult,
      troopStatMult: baseTroopMult * martialMult * helmMult * battleTechMult,
      wallHp: Math.round(wallCfg.wallHp * cuirassMult),
      turretSlots: wallCfg.turretSlots
    };
  }

  public getWaveClearRewards(waveNumber: number): Record<ResourceKey, number> {
    const f = balancingData.waves.clearRewardFormula;
    const mult = Math.pow(f.waveMultiplier, Math.max(0, waveNumber - 1));
    const isMajorBoss = waveNumber % 10 === 0;
    const isMiniBoss = !isMajorBoss && waveNumber % 5 === 0;
    return {
      food: Math.round(f.baseFood * mult),
      wood: Math.round(f.baseWood * mult),
      stone: Math.round(f.baseStone * mult),
      gold: Math.round(f.baseGold * mult),
      shards: isMajorBoss ? f.majorBossShardDrop : isMiniBoss ? f.bossShardDrop : 1
    };
  }

  public recordWaveVictory(waveNumber: number, multiplier = 1): Record<ResourceKey, number> {
    const baseRewards = this.getWaveClearRewards(waveNumber);
    const caps = this.getStorageCaps();
    const granted: Record<ResourceKey, number> = {
      food: Math.round(baseRewards.food * multiplier),
      wood: Math.round(baseRewards.wood * multiplier),
      stone: Math.round(baseRewards.stone * multiplier),
      gold: Math.round(baseRewards.gold * multiplier),
      shards: Math.round(baseRewards.shards * multiplier)
    };

    // During victory spoils, allow slight overflow or cap cleanly
    this.state.resources.food = Math.min(caps.food * 1.5, this.state.resources.food + granted.food);
    this.state.resources.wood = Math.min(caps.wood * 1.5, this.state.resources.wood + granted.wood);
    this.state.resources.stone = Math.min(caps.stone * 1.5, this.state.resources.stone + granted.stone);
    this.state.resources.gold = Math.min(caps.gold * 1.5, this.state.resources.gold + granted.gold);
    this.state.resources.shards += granted.shards;

    this.state.tutorialHookCompleted = true;
    if (waveNumber > this.state.highestWaveCleared) {
      this.state.highestWaveCleared = waveNumber;
    }
    this.state.currentWave = this.state.highestWaveCleared + 1;

    // Auto-unlock hex territories whose waveToClear is reached
    for (const hex of balancingData.hexMap) {
      if (hex.waveToClear <= this.state.highestWaveCleared && !this.state.clearedHexIds.includes(hex.id)) {
        this.state.clearedHexIds.push(hex.id);
        if (hex.bonus.type === 'hero_unlock' && 'heroId' in hex.bonus && hex.bonus.heroId) {
          const h = this.state.heroes[hex.bonus.heroId];
          if (h) h.unlocked = true;
        }
      }
    }

    this.recordDailyAction('wavesCleared', 1);
    this.notify();
    return granted;
  }

  public recordDailyAction(
    key: 'wavesCleared' | 'upgradesDone' | 'squadsDeployed' | 'turretsBuilt' | 'edictsUsed',
    delta = 1
  ): void {
    if (!this.state.dailyCounters) {
      this.state.dailyCounters = {
        wavesCleared: 0,
        upgradesDone: 0,
        squadsDeployed: 0,
        turretsBuilt: 0,
        edictsUsed: 0
      };
    }
    this.state.dailyCounters[key] = (this.state.dailyCounters[key] || 0) + delta;
  }

  public unlockOrPromoteHero(heroId: string): { ok: boolean; action?: 'unlocked' | 'promoted' } {
    const cfg = balancingData.heroes.find((h) => h.id === heroId);
    if (!cfg) return { ok: false };
    const hState = this.state.heroes[heroId] || { unlocked: false, level: 1, stars: 1 };
    this.state.heroes[heroId] = hState;

    if (!hState.unlocked) {
      const req = cfg.unlockShards || 10;
      if (this.state.resources.shards < req) return { ok: false };
      this.state.resources.shards -= req;
      hState.unlocked = true;
      hState.level = 1;
      hState.stars = 1;
      this.notify();
      return { ok: true, action: 'unlocked' };
    }

    if (hState.stars >= 5) return { ok: false };
    const shardTable = balancingData.heroProgression.shardsPerStar;
    const req = shardTable[Math.min(shardTable.length - 1, hState.stars - 1)] || 20;
    if (this.state.resources.shards < req) return { ok: false };
    this.state.resources.shards -= req;
    hState.stars += 1;
    this.notify();
    return { ok: true, action: 'promoted' };
  }

  public levelUpHero(heroId: string): boolean {
    const hState = this.state.heroes[heroId];
    if (!hState || !hState.unlocked || hState.level >= balancingData.heroProgression.maxLevel) {
      return false;
    }
    const foodCost = Math.round(
      balancingData.heroProgression.xpCostBase *
        Math.pow(balancingData.heroProgression.xpCostGrowth, hState.level - 1)
    );
    const goldCost = Math.max(10, Math.round(foodCost * 0.28));
    if (this.state.resources.food < foodCost || this.state.resources.gold < goldCost) {
      return false;
    }
    this.state.resources.food -= foodCost;
    this.state.resources.gold -= goldCost;
    hState.level += 1;
    this.recordDailyAction('upgradesDone', 1);
    this.notify();
    return true;
  }

  public canClaimFreeChest(nowMs = Date.now()): boolean {
    return nowMs >= (this.state.nextFreeChestAtMs || 0);
  }

  public openSanctuaryChest(
    isRewardedAd = false,
    nowMs = Date.now()
  ): { shards: number; gold: number; food: number; wood: number; heroUnlocked?: string } | null {
    if (!isRewardedAd && !this.canClaimFreeChest(nowMs)) {
      return null;
    }
    const tavernLv = Math.max(1, this.state.buildings.hero_tavern || 1);
    const cdHours =
      balancingData.buildings.hero_tavern.levels[Math.min(9, tavernLv - 1)]?.freeChestCooldownHours || 4.0;
    if (!isRewardedAd) {
      this.state.nextFreeChestAtMs = nowMs + cdHours * 3600 * 1000;
    }
    this.state.chestsOpened = (this.state.chestsOpened || 0) + 1;

    const shards = isRewardedAd ? 8 : 5;
    const gold = isRewardedAd ? 65 : 40;
    const food = isRewardedAd ? 180 : 110;
    const wood = isRewardedAd ? 180 : 110;

    this.state.resources.shards += shards;
    this.state.resources.gold += gold;
    this.state.resources.food += food;
    this.state.resources.wood += wood;

    let heroUnlocked: string | undefined;
    if (!this.state.heroes.lyra?.unlocked && this.state.resources.shards >= 10 && isRewardedAd) {
      this.state.heroes.lyra = { unlocked: true, level: 1, stars: 1 };
      heroUnlocked = 'lyra';
    }

    this.notify();
    return { shards, gold, food, wood, heroUnlocked };
  }

  public getLoginCalendarDays(): Array<{
    day: number;
    title: string;
    rewardText: string;
    claimed: boolean;
    claimable: boolean;
    reward: Partial<Record<ResourceKey, number>>;
  }> {
    const claimedCount = this.state.loginDaysClaimed || 0;
    const schedule: Array<{
      day: number;
      title: string;
      rewardText: string;
      reward: Partial<Record<ResourceKey, number>>;
    }> = [
      { day: 1, title: 'Giorno 1', rewardText: '🌾200 🪵200 🪙60', reward: { food: 200, wood: 200, gold: 60 } },
      { day: 2, title: 'Giorno 2', rewardText: '💎10 Frammenti Lyra', reward: { shards: 10, gold: 80 } },
      { day: 3, title: 'Giorno 3', rewardText: '🪨250 🪙120 🌾300', reward: { stone: 250, gold: 120, food: 300 } },
      { day: 4, title: 'Giorno 4', rewardText: '💎15 Frammenti + 🪙150', reward: { shards: 15, gold: 150 } },
      { day: 5, title: 'Giorno 5', rewardText: '💎20 Eroe Thorne!', reward: { shards: 20, stone: 350 } },
      { day: 6, title: 'Giorno 6', rewardText: '🌾600 🪵600 🪙250', reward: { food: 600, wood: 600, gold: 250 } },
      { day: 7, title: 'Giorno 7', rewardText: '💎35 Re Aurelius!', reward: { shards: 35, gold: 500 } }
    ];

    return schedule.map((s, idx) => ({
      ...s,
      claimed: idx < claimedCount,
      claimable: idx === claimedCount
    }));
  }

  public claimNextLoginDay(): Partial<Record<ResourceKey, number>> | null {
    const claimedCount = this.state.loginDaysClaimed || 0;
    const days = this.getLoginCalendarDays();
    const target = days[claimedCount];
    if (!target) return null;

    this.state.loginDaysClaimed = claimedCount + 1;
    for (const [k, v] of Object.entries(target.reward)) {
      this.state.resources[k as ResourceKey] += v || 0;
    }
    if (target.day === 2 && this.state.heroes.lyra) {
      this.state.heroes.lyra.unlocked = true;
    }
    if (target.day === 5 && this.state.heroes.thorne) {
      this.state.heroes.thorne.unlocked = true;
    }
    if (target.day === 7 && this.state.heroes.aurelius) {
      this.state.heroes.aurelius.unlocked = true;
    }
    this.notify();
    return target.reward;
  }

  public getDailyMissions(): Array<{
    id: string;
    title: string;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
    rewardText: string;
    reward: Partial<Record<ResourceKey, number>>;
  }> {
    const c = this.state.dailyCounters || {
      wavesCleared: 0,
      upgradesDone: 0,
      squadsDeployed: 0,
      turretsBuilt: 0,
      edictsUsed: 0
    };
    const claimedIds = this.state.claimedDailyIds || [];
    const list = [
      {
        id: 'd_wave',
        title: 'Respingi 1 Ondata della Nebbia',
        progress: Math.max(c.wavesCleared, this.state.highestWaveCleared > 0 ? 1 : 0),
        target: 1,
        rewardText: '🪙55 💎3',
        reward: { gold: 55, shards: 3 }
      },
      {
        id: 'd_upg',
        title: 'Potenzia 2 Edifici o Alloggi',
        progress: c.upgradesDone,
        target: 2,
        rewardText: '🪵180 🪨90',
        reward: { wood: 180, stone: 90 }
      },
      {
        id: 'd_troop',
        title: 'Schiera 2 Squadre di Truppe',
        progress: c.squadsDeployed,
        target: 2,
        rewardText: '🌾200 🪙45',
        reward: { food: 200, gold: 45 }
      },
      {
        id: 'd_turret',
        title: 'Costruisci o Potenzia 2 Torri',
        progress: c.turretsBuilt,
        target: 2,
        rewardText: '🪵160 🪙50',
        reward: { wood: 160, gold: 50 }
      },
      {
        id: 'd_edict',
        title: 'Emana 1 Decreto o Ricerca',
        progress: c.edictsUsed,
        target: 1,
        rewardText: '💎5 🪙65',
        reward: { shards: 5, gold: 65 }
      }
    ];

    return list.map((item) => ({
      ...item,
      progress: Math.min(item.target, item.progress),
      completed: item.progress >= item.target,
      claimed: claimedIds.includes(item.id)
    }));
  }

  public claimDailyMission(id: string): Partial<Record<ResourceKey, number>> | null {
    if (!this.state.claimedDailyIds) this.state.claimedDailyIds = [];
    if (this.state.claimedDailyIds.includes(id)) return null;
    const m = this.getDailyMissions().find((d) => d.id === id);
    if (!m || !m.completed) return null;

    this.state.claimedDailyIds.push(id);
    for (const [k, v] of Object.entries(m.reward)) {
      this.state.resources[k as ResourceKey] += v || 0;
    }
    this.notify();
    return m.reward;
  }

  public liberateHexTerritory(hexId: string): { ok: boolean; reward?: Partial<Record<ResourceKey, number>> } {
    if (this.state.clearedHexIds.includes(hexId)) return { ok: false };
    const hex = balancingData.hexMap.find((h) => h.id === hexId);
    if (!hex) return { ok: false };
    // Allow liberating the next frontier hex or any hex within current wave + 2
    if (hex.waveToClear > this.state.highestWaveCleared + 2) {
      return { ok: false };
    }
    this.state.clearedHexIds.push(hexId);
    const reward: Partial<Record<ResourceKey, number>> = {
      food: 160 + hex.ring * 80,
      wood: 160 + hex.ring * 80,
      stone: 90 + hex.ring * 50,
      gold: 55 + hex.ring * 35,
      shards: 3 + hex.ring * 2
    };
    for (const [k, v] of Object.entries(reward)) {
      this.state.resources[k as ResourceKey] += v || 0;
    }
    if (hex.bonus.type === 'hero_unlock' && 'heroId' in hex.bonus && hex.bonus.heroId) {
      const h = this.state.heroes[hex.bonus.heroId];
      if (h) h.unlocked = true;
    }
    this.notify();
    return { ok: true, reward };
  }

  public getCurrentChapterMission(): {
    id: string;
    chapter: number;
    type: string;
    buildingId?: string;
    descKey: string;
    progress: number;
    target: number;
    completed: boolean;
    reward: Partial<Record<ResourceKey, number>>;
  } | null {
    for (const m of balancingData.chapterMissions) {
      if (this.state.claimedMissionIds.includes(m.id)) continue;
      let progress = 0;
      if (m.type === 'clear_wave') {
        progress = this.state.highestWaveCleared;
      } else if (m.type === 'building_level' && m.buildingId) {
        progress = this.state.buildings[m.buildingId as BuildingId] || 0;
      }
      return {
        id: m.id,
        chapter: m.chapter,
        type: m.type,
        buildingId: 'buildingId' in m ? (m.buildingId as string | undefined) : undefined,
        descKey: m.descKey,
        progress: Math.min(m.target, progress),
        target: m.target,
        completed: progress >= m.target,
        reward: m.reward as Partial<Record<ResourceKey, number>>
      };
    }
    return null;
  }

  public claimCurrentChapterMission(): Partial<Record<ResourceKey, number>> | null {
    const current = this.getCurrentChapterMission();
    if (!current || !current.completed) return null;

    this.state.claimedMissionIds.push(current.id);
    for (const [res, amt] of Object.entries(current.reward)) {
      this.state.resources[res as ResourceKey] += amt || 0;
    }
    this.notify();
    return current.reward;
  }

  public getPower(): number {
    let total = 0;

    // 1. Buildings power
    for (const [bId, lv] of Object.entries(this.state.buildings)) {
      if (lv <= 0) continue;
      const bCfg = balancingData.buildings[bId as BuildingId];
      const lvEntry = bCfg?.levels.find((l) => l.level === lv);
      if (lvEntry) total += lvEntry.power;
    }

    // 2. Heroes power
    for (const hCfg of balancingData.heroes) {
      const hState = this.state.heroes[hCfg.id];
      if (!hState?.unlocked) continue;
      const baseRarity = balancingData.powerFormula.heroBaseRarityPower[hCfg.rarity as 'rare' | 'epic' | 'legendary'] || 350;
      const starMult = balancingData.powerFormula.heroStarMultipliers[Math.min(4, Math.max(0, hState.stars - 1))] || 1;
      total += Math.round((baseRarity + hState.level * balancingData.powerFormula.heroLevelWeight) * starMult);
    }

    // 3. Warden Panoply power
    for (const pCfg of balancingData.wardenPanoply) {
      const tier = this.state.panoplyTiers[pCfg.slot] || 0;
      total += tier * pCfg.powerPerTier;
    }

    // 4. Research + Hexes + Waves + Survivor Houses
    const researchTotal =
      this.state.researchLevels.growth +
      this.state.researchLevels.economy +
      this.state.researchLevels.battle;
    total += researchTotal * balancingData.powerFormula.researchNodeWeight;
    total += this.state.clearedHexIds.length * balancingData.powerFormula.hexClearedWeight;
    total += this.state.highestWaveCleared * 85;
    const houseBonusPower = (this.state.houseLevels || []).reduce(
      (acc, lv) => acc + Math.max(0, lv - 1) * 55,
      0
    );
    total += houseBonusPower;

    return Math.round(total);
  }

  public calculateOfflineEarnings(savedAtMs: number, nowMs = Date.now()): OfflineReport | null {
    const elapsedSec = Math.floor((nowMs - savedAtMs) / 1000);
    if (elapsedSec < 60) return null;

    const maxSec = balancingData.meta.maxOfflineHours * 3600;
    const cappedSec = Math.min(elapsedSec, maxSec);
    const rates = this.getProductionRatesPerMin(nowMs);
    const caps = this.getStorageCaps();

    const food = Math.min(
      Math.max(0, caps.food - Math.floor(this.state.resources.food)),
      Math.floor((rates.food / 60) * cappedSec)
    );
    const wood = Math.min(
      Math.max(0, caps.wood - Math.floor(this.state.resources.wood)),
      Math.floor((rates.wood / 60) * cappedSec)
    );
    const stone = Math.min(
      Math.max(0, caps.stone - Math.floor(this.state.resources.stone)),
      Math.floor((rates.stone / 60) * cappedSec)
    );
    const gold = Math.min(
      Math.max(0, caps.gold - Math.floor(this.state.resources.gold)),
      Math.floor((rates.gold / 60) * cappedSec)
    );

    if (food + wood + stone + gold <= 0) return null;
    return { elapsedSec: cappedSec, food, wood, stone, gold };
  }

  public consumePendingOfflineReport(multiplier = 1): OfflineReport | null {
    if (!this.pendingOfflineReport) return null;
    const r = this.pendingOfflineReport;
    this.pendingOfflineReport = null;
    const caps = this.getStorageCaps();
    this.state.resources.food = Math.min(caps.food * multiplier, this.state.resources.food + r.food * multiplier);
    this.state.resources.wood = Math.min(caps.wood * multiplier, this.state.resources.wood + r.wood * multiplier);
    this.state.resources.stone = Math.min(caps.stone * multiplier, this.state.resources.stone + r.stone * multiplier);
    this.state.resources.gold = Math.min(caps.gold * multiplier, this.state.resources.gold + r.gold * multiplier);
    this.notify();
    return r;
  }

  public getPendingOfflineReport(): OfflineReport | null {
    return this.pendingOfflineReport;
  }

  public serialize(nowMs = Date.now()): string {
    this.state.savedAtMs = nowMs;
    return JSON.stringify(this.state);
  }

  public deserialize(rawJson: string, nowMs = Date.now()): boolean {
    try {
      const parsed = JSON.parse(rawJson) as Partial<SaveStateV1>;
      if (!parsed || parsed.version !== 1 || !parsed.resources || !parsed.buildings) {
        return false;
      }
      const defaults = this.createDefaultState(nowMs);
      this.state = {
        ...defaults,
        ...parsed,
        resources: { ...defaults.resources, ...parsed.resources },
        buildings: { ...defaults.buildings, ...parsed.buildings },
        assignedWorkers: { ...defaults.assignedWorkers, ...(parsed.assignedWorkers || {}) },
        panoplyTiers: { ...defaults.panoplyTiers, ...(parsed.panoplyTiers || {}) },
        researchLevels: { ...defaults.researchLevels, ...(parsed.researchLevels || {}) }
      };

      const offline = this.calculateOfflineEarnings(this.state.savedAtMs, nowMs);
      if (offline) {
        this.pendingOfflineReport = offline;
      }
      // Advance any completed construction timers while offline
      this.tick(0.1, nowMs);
      return true;
    } catch {
      return false;
    }
  }

  public async saveToBridge(nowMs = Date.now()): Promise<void> {
    const primary = this.serialize(nowMs);
    const backup = this.lastBackupJson || primary;
    this.lastBackupJson = primary;
    await BridgeManager.saveRaw(primary, backup);
  }

  public async loadFromBridge(nowMs = Date.now()): Promise<boolean> {
    const { primary, backup } = await BridgeManager.loadRaw();
    if (primary && this.deserialize(primary, nowMs)) {
      this.lastBackupJson = primary;
      return true;
    }
    if (backup && this.deserialize(backup, nowMs)) {
      this.lastBackupJson = backup;
      return true;
    }
    return false;
  }
}

export const GameState = new GameStateManagerClass();
