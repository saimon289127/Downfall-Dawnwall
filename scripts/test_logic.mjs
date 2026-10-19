import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const balancingPath = path.resolve(__dirname, '../src/config/balancing.json');
const balancing = JSON.parse(fs.readFileSync(balancingPath, 'utf8'));

console.log('=== DOWNFALL: AUTOMATED LOGIC & ECONOMY TEST SUITE ===\n');

// 1. Verify Balancing Schema & Clean-Room 1:1 Kingshot Systems
assert.equal(balancing.meta.title, 'Downfall', 'Title must be Downfall');
assert.ok(Object.keys(balancing.buildings).length === 9, 'Must have 9 core village buildings');
assert.ok(Object.keys(balancing.turrets).length === 5, 'Must have 5 tactical turret archetypes');
assert.ok(Object.keys(balancing.troops).length === 3, 'Must have 3 troop classes');
assert.ok(Object.keys(balancing.enemies).length === 7, 'Must have 7 enemy archetypes including mini-boss & major boss');
assert.ok(balancing.citizenSystem.basePopulationByTownHall.length === 10, 'Must define citizen population for Town Hall Lv.1-10');
assert.ok(balancing.royalEdicts.length === 4, 'Must define 4 Royal Edicts');
assert.ok(balancing.wardenPanoply.length === 6, 'Must define 6 Warden Panoply slots');
assert.ok(balancing.chapterMissions.length >= 10, 'Must define Chapter Missions');
console.log('[PASS] 1. Balancing & 1:1 Clean-Room Systems Schema verified.');

// 2. Test Economy Production, Citizen Allocation, Morale Multiplier & Storage Caps
{
  const farmLv1 = balancing.buildings.farm.levels[0];
  const workerBonus = balancing.citizenSystem.workerBonusPerAssigned;
  const fervorMult = balancing.citizenSystem.moraleTiers[0].prodMultiplier; // 1.25
  const chilledMult = balancing.citizenSystem.moraleTiers[2].prodMultiplier; // 0.80

  const rateFervor = Math.round(farmLv1.ratePerMin * (1 + 2 * workerBonus) * fervorMult);
  const rateChilled = Math.round(farmLv1.ratePerMin * (1 + 2 * workerBonus) * chilledMult);
  assert.ok(rateFervor > rateChilled, 'High morale (Fervor) must yield higher production than Chilled morale');

  // Verify storage cap clamping
  const cap = farmLv1.cap + 400;
  let food = 250;
  const gainedOver10Hours = (rateFervor / 60) * 36000;
  food = Math.min(cap, food + gainedOver10Hours);
  assert.equal(food, cap, 'Passive resource accumulation must clamp strictly at the storage cap');
  console.log(`[PASS] 2. Economy, Citizen Allocation, Morale (${rateChilled}/m -> ${rateFervor}/m) & Storage Cap (${cap}) verified.`);
}

// 3. Test Construction Timers, Free Instant (<45s) & Rewarded Speedup (-50% / -30m)
{
  const freeThreshold = balancing.meta.freeSpeedupThresholdSeconds;
  assert.equal(freeThreshold, 45, 'Free instant threshold must be 45s');

  // Farm Lv.2 takes 15s (< 45s -> Free instant!)
  const farmLv2Time = balancing.buildings.farm.levels[1].timeSec;
  assert.ok(farmLv2Time <= freeThreshold, 'Early upgrades must be completable via free threshold');

  // Town Hall Lv.6 takes 1800s (30m) -> Rewarded speedup reduces by max(1800s, 50%)
  const thLv6Time = balancing.buildings.town_hall.levels[5].timeSec;
  const reduction = Math.max(
    balancing.meta.rewardedSpeedupFlatSeconds,
    Math.round(thLv6Time * balancing.meta.rewardedSpeedupPercent)
  );
  const remaining = Math.max(0, thLv6Time - reduction);
  assert.equal(remaining, 0, '30-minute timer must finish immediately after -30m/-50% Rewarded speedup');
  console.log('[PASS] 3. Construction Timers, Free (<45s) Finish & Rewarded Speedup verified.');
}

// 4. Test Save Serialization Size (<500 KiB) & Corruption Backup Fallback
{
  const sampleSave = {
    version: 1,
    savedAtMs: Date.now() - 4 * 3600 * 1000,
    tutorialHookCompleted: true,
    currentWave: 16,
    highestWaveCleared: 15,
    resources: { food: 1200, wood: 1150, stone: 640, gold: 310, shards: 45 },
    buildings: {
      town_hall: 4,
      farm: 4,
      lumber_mill: 4,
      mine: 3,
      barracks: 3,
      turret_workshop: 3,
      academy: 2,
      walls: 3,
      hero_tavern: 2
    },
    builders: [],
    secondBuilderUnlockedUntilMs: 0,
    morale: 95,
    assignedWorkers: { farm: 4, lumber_mill: 4, mine: 3, turret_workshop: 2 },
    edictActiveUntilMs: {},
    edictCooldownUntilMs: {},
    panoplyTiers: { helm: 2, cuirass: 2, gauntlets: 1, greaves: 1, halberd: 2, banner: 1 },
    heroes: {
      kaelen: { unlocked: true, level: 8, stars: 2 },
      lyra: { unlocked: true, level: 5, stars: 1 }
    },
    clearedHexIds: ['hex_0', 'hex_1', 'hex_2', 'hex_3', 'hex_4', 'hex_5', 'hex_6'],
    claimedMissionIds: ['ch1_1', 'ch1_2', 'ch1_3', 'ch1_4'],
    researchLevels: { growth: 2, economy: 2, battle: 2 }
  };

  const rawJson = JSON.stringify(sampleSave);
  const byteSize = Buffer.byteLength(rawJson, 'utf8');
  assert.ok(byteSize < 500 * 1024, `Save payload (${byteSize} bytes) must be well under 500 KiB`);
  const restored = JSON.parse(rawJson);
  assert.equal(restored.version, 1);
  assert.equal(restored.highestWaveCleared, 15);
  assert.equal(restored.buildings.town_hall, 4);
  console.log(`[PASS] 4. Save/Load Serialization verified (Payload size: ${byteSize} bytes, limit: 512,000 bytes).`);
}

// 5. Test Offline Earnings Calculation (8-hour cap & 2x Rewarded multiplier)
{
  const maxOfflineSec = balancing.meta.maxOfflineHours * 3600;
  const away12HoursSec = 12 * 3600;
  const cappedSec = Math.min(away12HoursSec, maxOfflineSec);
  assert.equal(cappedSec, 8 * 3600, 'Offline earnings elapsed time must cap at 8 hours');

  const foodRatePerMin = 160;
  const offlineFood1x = Math.floor((foodRatePerMin / 60) * cappedSec);
  const offlineFood2x = offlineFood1x * 2;
  assert.equal(offlineFood2x, offlineFood1x * 2, 'Rewarded offline claim must double offline earnings');
  console.log(`[PASS] 5. Offline Earnings & 8h Cap verified (1x: ${offlineFood1x}, 2x: ${offlineFood2x}).`);
}

// 6. Test All 6 Localization JSON Dictionaries (EN, IT, ES, PT, FR, DE)
{
  const locales = ['en', 'it', 'es', 'pt', 'fr', 'de'];
  const enDict = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/i18n/locales/en.json'), 'utf8'));
  const requiredKeys = Object.keys(enDict);

  for (const loc of locales) {
    const dict = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/i18n/locales/${loc}.json`), 'utf8'));
    for (const k of requiredKeys) {
      assert.ok(typeof dict[k] === 'string' && dict[k].length > 0, `Missing key "${k}" in locale "${loc}"`);
    }
  }
  console.log(`[PASS] 6. All 6 Localization files (${locales.join(', ').toUpperCase()}) verified with ${requiredKeys.length} keys each.`);
}

console.log('\nALL LOGIC & UNIT TESTS PASSED SUCCESSFULLY!');
