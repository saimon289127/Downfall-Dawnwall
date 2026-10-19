import fs from 'node:fs';
import path from 'node:path';

const balancePath = path.resolve('src/config/balancing.json');
const balance = JSON.parse(fs.readFileSync(balancePath, 'utf8'));

function computePower(state) {
  let power = 0;
  for (const [bId, lvl] of Object.entries(state.buildings)) {
    if (lvl > 0 && balance.buildings[bId]) {
      const entry = balance.buildings[bId].levels.find((l) => l.level === lvl);
      if (entry) power += entry.power;
    }
  }
  for (const h of state.heroes) {
    const base = balance.powerFormula.heroBaseRarityPower[h.rarity] || 350;
    const starMult = balance.powerFormula.heroStarMultipliers[Math.min(h.stars - 1, 4)] || 1;
    power += Math.round((base + h.level * balance.powerFormula.heroLevelWeight) * starMult);
  }
  power += state.clearedHexes * balance.powerFormula.hexClearedWeight;
  return power;
}

function getProductionRatesPerMin(state) {
  const farmLvl = state.buildings.farm || 1;
  const lumberLvl = state.buildings.lumber_mill || 1;
  const mineLvl = state.buildings.mine || 0;

  const farmEntry = balance.buildings.farm.levels[farmLvl - 1];
  const lumberEntry = balance.buildings.lumber_mill.levels[lumberLvl - 1];
  const mineEntry = mineLvl > 0 ? balance.buildings.mine.levels[mineLvl - 1] : null;

  return {
    food: farmEntry ? farmEntry.ratePerMin : 0,
    wood: lumberEntry ? lumberEntry.ratePerMin : 0,
    stone: mineEntry ? mineEntry.stonePerMin : 0,
    gold: mineEntry ? mineEntry.goldPerMin : 0,
    caps: {
      food: farmEntry ? farmEntry.cap : 600,
      wood: lumberEntry ? lumberEntry.cap : 600,
      stone: mineEntry ? mineEntry.stoneCap : 500,
      gold: mineEntry ? mineEntry.goldCap : 150
    }
  };
}

function canAfford(resources, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if ((resources[k] || 0) < v) return false;
  }
  return true;
}

function payCost(resources, cost) {
  for (const [k, v] of Object.entries(cost)) {
    resources[k] -= v;
  }
}

function simulate7Days() {
  const state = {
    resources: { ...balance.startingState.resources },
    buildings: { ...balance.startingState.buildings },
    heroes: [{ id: 'kaelen', rarity: 'rare', level: 1, stars: 1 }],
    wave: 1,
    clearedHexes: 1,
    totalUpgrades: 0
  };

  console.log('=== DAWNWALL MATHEMATICAL BALANCE VERIFICATION ===');
  console.log(`Initial Power: ${computePower(state)}`);

  // Simulate Session 1 (First 15 minutes = 900 seconds, in 30s steps)
  let builderBusyUntil = 0;
  let session1Upgrades = 0;
  for (let t = 0; t <= 900; t += 15) {
    const rates = getProductionRatesPerMin(state);
    state.resources.food = Math.min(rates.caps.food * 2, state.resources.food + (rates.food * 15) / 60);
    state.resources.wood = Math.min(rates.caps.wood * 2, state.resources.wood + (rates.wood * 15) / 60);
    state.resources.stone = Math.min(rates.caps.stone * 2, state.resources.stone + (rates.stone * 15) / 60);
    state.resources.gold = Math.min(rates.caps.gold * 2, state.resources.gold + (rates.gold * 15) / 60);

    // Every 120s, win a battle wave
    if (t > 0 && t % 120 === 0) {
      const mult = Math.pow(balance.waves.clearRewardFormula.waveMultiplier, state.wave - 1);
      state.resources.food += Math.round(balance.waves.clearRewardFormula.baseFood * mult);
      state.resources.wood += Math.round(balance.waves.clearRewardFormula.baseWood * mult);
      state.resources.stone += Math.round(balance.waves.clearRewardFormula.baseStone * mult);
      state.resources.gold += Math.round(balance.waves.clearRewardFormula.baseGold * mult);
      state.wave += 1;
      for (const hex of balance.hexMap) {
        if (hex.waveToClear === state.wave - 1) state.clearedHexes += 1;
      }
    }

    if (t >= builderBusyUntil) {
      // Pick cheapest available upgrade unlocked by Town Hall
      const thLvl = state.buildings.town_hall;
      const candidates = Object.keys(balance.buildings).filter((bId) => {
        const b = balance.buildings[bId];
        const curLvl = state.buildings[bId] || 0;
        if (curLvl >= b.maxLevel) return false;
        if (bId !== 'town_hall' && curLvl >= thLvl) return false;
        if (b.unlockTownHall && thLvl < b.unlockTownHall) return false;
        return true;
      });
      // Sort by next level timeSec
      candidates.sort((a, b) => {
        const nextA = balance.buildings[a].levels[state.buildings[a] || 0];
        const nextB = balance.buildings[b].levels[state.buildings[b] || 0];
        return nextA.timeSec - nextB.timeSec;
      });
      for (const bId of candidates) {
        const nextSpec = balance.buildings[bId].levels[state.buildings[bId] || 0];
        if (canAfford(state.resources, nextSpec.cost)) {
          payCost(state.resources, nextSpec.cost);
          state.buildings[bId] = (state.buildings[bId] || 0) + 1;
          // Free instant finish for <45s timers in first session
          const effectiveTime = nextSpec.timeSec <= balance.meta.freeSpeedupThresholdSeconds ? 5 : nextSpec.timeSec * 0.5;
          builderBusyUntil = t + effectiveTime;
          session1Upgrades += 1;
          state.totalUpgrades += 1;
          break;
        }
      }
    }
  }

  console.log(
    `[Session 1 - 15 min] Upgrades: ${session1Upgrades} | Town Hall Lv.${state.buildings.town_hall} | Wave: ${state.wave} | Power: ${computePower(state)}`
  );

  // Simulate Days 1 to 7 (3 sessions/day + offline collection)
  for (let day = 1; day <= 7; day++) {
    for (let session = 1; session <= 3; session++) {
      // Offline earnings (capped by storage cap)
      const rates = getProductionRatesPerMin(state);
      const offlineMins = 240; // 4h between sessions
      state.resources.food += Math.min(rates.caps.food, rates.food * offlineMins);
      state.resources.wood += Math.min(rates.caps.wood, rates.wood * offlineMins);
      state.resources.stone += Math.min(rates.caps.stone, rates.stone * offlineMins);
      state.resources.gold += Math.min(rates.caps.gold, rates.gold * offlineMins);

      // Play 2 waves per session
      for (let w = 0; w < 2; w++) {
        const mult = Math.pow(balance.waves.clearRewardFormula.waveMultiplier, state.wave - 1);
        state.resources.food += Math.round(balance.waves.clearRewardFormula.baseFood * mult);
        state.resources.wood += Math.round(balance.waves.clearRewardFormula.baseWood * mult);
        state.resources.stone += Math.round(balance.waves.clearRewardFormula.baseStone * mult);
        state.resources.gold += Math.round(balance.waves.clearRewardFormula.baseGold * mult);
        state.wave += 1;
        for (const hex of balance.hexMap) {
          if (hex.waveToClear === state.wave - 1) state.clearedHexes += 1;
        }
      }

      // Attempt up to 3 building upgrades per session
      for (let u = 0; u < 3; u++) {
        const thLvl = state.buildings.town_hall;
        const candidates = Object.keys(balance.buildings).filter((bId) => {
          const b = balance.buildings[bId];
          const curLvl = state.buildings[bId] || 0;
          if (curLvl >= b.maxLevel) return false;
          if (bId !== 'town_hall' && curLvl >= thLvl) return false;
          if (b.unlockTownHall && thLvl < b.unlockTownHall) return false;
          return true;
        });
        // Prioritize town_hall if all core buildings are near thLvl, else lowest level
        candidates.sort((a, b) => (state.buildings[a] || 0) - (state.buildings[b] || 0));
        for (const bId of candidates) {
          const nextSpec = balance.buildings[bId].levels[state.buildings[bId] || 0];
          if (canAfford(state.resources, nextSpec.cost)) {
            payCost(state.resources, nextSpec.cost);
            state.buildings[bId] = (state.buildings[bId] || 0) + 1;
            state.totalUpgrades += 1;
            break;
          }
        }
      }

      // Level up hero & unlock heroes over days
      if (state.heroes[0].level < 30) state.heroes[0].level += 1;
      if (day === 2 && session === 1 && state.heroes.length < 2) {
        state.heroes.push({ id: 'lyra', rarity: 'rare', level: 3, stars: 2 });
      }
      if (day === 4 && session === 1 && state.heroes.length < 3) {
        state.heroes.push({ id: 'thorne', rarity: 'epic', level: 8, stars: 2 });
      }
      if (day === 7 && session === 1 && state.heroes.length < 4) {
        state.heroes.push({ id: 'aurelius', rarity: 'legendary', level: 12, stars: 3 });
      }
    }
    console.log(
      `[Day ${day}] TH Lv.${state.buildings.town_hall} | Total Upgrades: ${state.totalUpgrades} | Wave: ${state.wave} | Hexes: ${state.clearedHexes}/19 | Power: ${computePower(state)} | Gold: ${Math.round(state.resources.gold)}`
    );
  }
}

simulate7Days();
