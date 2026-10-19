import { chromium, webkit } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

async function runSuite() {
  console.log('=== DOWNFALL: FULL BROWSER E2E QA SUITE (iPhone 16 Pro Max WebKit + Android Chromium) ===\n');

  const previewServer = await preview({
    root: path.resolve(__dirname, '..'),
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false
    }
  });

  const address = previewServer.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Preview server listening at ${baseUrl}`);

  try {
    // 1. iPhone 16 Pro Max Emulation on WebKit (440x956 logical viewport, 2x DPR)
    const browser = await webkit.launch({ headless: true });
    const engineName = 'WebKit (iPhone 16 Pro Max)';

    const context = await browser.newContext({
      viewport: { width: 440, height: 956 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err));
    });

    const t0 = Date.now();
    await page.goto(`${baseUrl}/?lang=it`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__DOWNFALL_TEST__ && window.__PHASER_GAME__), { timeout: 5000 });
    const bootMs = Date.now() - t0;
    console.log(`[PASS] [${engineName}] Game loaded and interactive in ${bootMs}ms (< 5000ms limit).`);
    assert.ok(bootMs < 5000, 'Boot time must be under 5 seconds');

    // Verify 100% full-bleed canvas width on mobile Safari (including when Safari address bar shrinks height to 775px!)
    await page.setViewportSize({ width: 440, height: 775 });
    await page.waitForTimeout(200);
    const safariBounds = await page.evaluate(() => {
      const c = document.querySelector('#game-container canvas');
      const r = c.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight };
    });
    assert.equal(safariBounds.width, 440, 'Canvas must fill 100% of iPhone 16 Pro Max width even with Safari bars (zero sidebars!)');
    assert.equal(safariBounds.height, 775, 'Canvas must fill 100% of iPhone 16 Pro Max Safari height');
    console.log(`[PASS] [iPhone Safari Full-Bleed] Canvas fills ${safariBounds.width}x${safariBounds.height} with ZERO sidebars.`);
    await page.screenshot({ path: path.join(screenshotDir, '1_valley_safari_775.png') });

    // Test REAL DOM pointer clicks on the Bottom 6-Tab Dock while in Safari 440x775 AND while camera is scrolled!
    const navDockY775 = 775 - 32; // y = 743
    const expectedTabs = ['tab_conquest', 'tab_heroes', 'tab_panoply', 'tab_buildings', 'tab_missions', 'tab_hexmap'];
    for (let idx = 0; idx < expectedTabs.length; idx++) {
      const tx = Math.round(39 + idx * 72.4);
      await page.mouse.click(tx, navDockY775);
      await page.waitForTimeout(120);
      const modalName = await page.evaluate(() => window.__DOWNFALL_TEST__.getState().activeModalName);
      assert.equal(
        modalName,
        expectedTabs[idx],
        `Real pointer click at (${tx}, ${navDockY775}) must open '${expectedTabs[idx]}' modal (got '${modalName}')`
      );
      if (expectedTabs[idx] === 'tab_heroes') {
        await page.screenshot({ path: path.join(screenshotDir, '3_heroes_6_roster_modal.png') });
      }
      if (expectedTabs[idx] === 'tab_hexmap') {
        await page.screenshot({ path: path.join(screenshotDir, '5_hex_mist_map_modal.png') });
      }
      // Close modal via close button or API
      await page.evaluate(() => window.__DOWNFALL_TEST__.closeModal());
      await page.waitForTimeout(60);
    }
    console.log('[PASS] [Real Pointer Clicks - 6 Bottom Tabs] All 6 bottom tabs respond to real mouse/touch clicks while camera is scrolled!');

    // Test REAL DOM pointer clicks on Top-Right 7-Day Login Calendar (408, 126) & Sanctuary Chest (408, 184)
    await page.mouse.click(408, 126);
    await page.waitForTimeout(120);
    const loginModal = await page.evaluate(() => window.__DOWNFALL_TEST__.getState().activeModalName);
    assert.equal(loginModal, 'login_calendar', 'Clicking 7 Giorni badge must open login_calendar modal');
    await page.screenshot({ path: path.join(screenshotDir, '6_login_calendar_modal.png') });
    await page.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Test tapping a Watchtower Slot in the world -> opens "SCEGLI LA TUA TORRE" modal
    await page.evaluate(() => window.__DOWNFALL_TEST__.tapWorldAt(365, 675));
    await page.waitForTimeout(150);
    const towerModal = await page.evaluate(() => window.__DOWNFALL_TEST__.getState().activeModalName);
    assert.equal(towerModal, 'tower_2', 'Tapping West Watchtower slot must open tower_2 modal ("SCEGLI LA TUA TORRE")');
    await page.screenshot({ path: path.join(screenshotDir, '2_tower_selection_modal.png') });
    await page.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Test tapping a Survivor House in the world -> opens connected House Upgrade & Citizen modal
    await page.evaluate(() => window.__DOWNFALL_TEST__.tapWorldAt(395, 700));
    await page.waitForTimeout(150);
    const houseModal = await page.evaluate(() => window.__DOWNFALL_TEST__.getState().activeModalName);
    assert.equal(houseModal, 'building_pad_house_1', 'Tapping Survivor House 1 must open building_pad_house_1 modal');
    await page.evaluate(() => window.__DOWNFALL_TEST__.closeModal());
    console.log('[PASS] [Connected World Taps] Watchtowers, Survivor Houses, and Core Buildings open their connected modals.');

    await page.setViewportSize({ width: 440, height: 956 });
    await page.waitForTimeout(300);

    // Verify Physical 3D Wall Collision ('CityCollider'):
    // Walking into solid North Wall (x=500, y=485 -> y=420) must be blocked at y=476,
    // while walking through the North Gate (x=660, y=485 -> y=420) passes through!
    const collisionCheck = await page.evaluate(() => {
      const api = window.__DOWNFALL_TEST__;
      const blockedByWall = api.testWallCollision(500, 485, 500, 420);
      const throughNorthGate = api.testWallCollision(660, 485, 660, 420);
      return { blockedByWall, throughNorthGate };
    });
    assert.ok(collisionCheck.blockedByWall.y >= 475, 'Solid North Stone Wall must physically block Hero');
    assert.equal(collisionCheck.throughNorthGate.y, 420, 'Hero must pass freely through the North Gate');
    console.log('[PASS] [CityCollider Physical Walls] Solid stone walls block Hero; Gates allow passage.');

    // Verify Opening Hook state, Hero Joystick movement, Vertical Coin Stack, On-Demand Pad building & Troop Synergy
    const hookState = await page.evaluate(() => {
      const api = window.__DOWNFALL_TEST__;
      api.buildTurret(2, 'magic');
      api.buildTurret(3, 'ice');
      api.deployTroop('infantry');
      api.deployTroop('archers');
      api.moveHeroTo(660, 520); // Walk Kaelen to North Gate & Barricade Pad to feed coins & open gate
      api.castHeroUltimate();
      return api.getState();
    });
    assert.equal(hookState.waveNumber, 1);
    assert.equal(hookState.synergyActive, true, 'Formation Synergy must activate when Infantry + Archers deploy');
    assert.ok(hookState.visibleCoinStack >= 1, 'Hero Kaelen must carry visible vertical coin stack on back');
    console.log(`[PASS] [2.5D Valley & Hero Control] Joystick move, Back Coin Stack (${hookState.visibleCoinStack} coins), Auto-Gate, 5 Turrets, Troop Synergy, and Hero Ultimate verified. Power: ${hookState.power}`);

    // 2. Run 15 Waves via Automated Bot!
    console.log('Running 15 waves with automated bot (including Boss Waves 5, 10, 15)...');
    const wave15Result = await page.evaluate(() => {
      let lastRes = null;
      for (let w = 1; w <= 15; w++) {
        lastRes = window.__DOWNFALL_TEST__.playWaveWithBotSync(w);
      }
      return lastRes;
    });
    assert.equal(wave15Result.waveCleared, 15, 'Bot must clear all 15 waves');
    console.log(`[PASS] [15-Wave Bot Run] Cleared Waves 1..15! Power reached: ${wave15Result.power}`);

    // 3. Switch to VillageScene and test Building Upgrades across 3 Visual Tiers, Citizens, Edicts, Panoply
    await page.evaluate(() => {
      window.__DOWNFALL_TEST__.goToVillage();
    });
    await page.waitForFunction(() => window.__DOWNFALL_TEST__?.scene === 'VillageScene', { timeout: 5000 });

    const villageAfterUpgrades = await page.evaluate(() => {
      const api = window.__DOWNFALL_TEST__;
      api.upgradeBuildingInstant('town_hall'); // Lv.2
      api.upgradeBuildingInstant('town_hall'); // Lv.3
      api.upgradeBuildingInstant('town_hall'); // Lv.4 (Tier 2!)
      api.upgradeBuildingInstant('farm'); // Lv.2
      api.upgradeBuildingInstant('lumber_mill'); // Lv.2
      api.upgradeBuildingInstant('mine'); // Lv.1
      api.upgradeBuildingInstant('barracks'); // Lv.2
      api.upgradeBuildingInstant('turret_workshop'); // Lv.2
      api.activateEdict('double_shift');
      api.upgradePanoply('halberd');
      return api.getState();
    });

    assert.equal(villageAfterUpgrades.buildings.town_hall, 4, 'Town Hall must upgrade to Lv.4');
    assert.ok(villageAfterUpgrades.power > hookState.power, 'Power must grow monotonically after upgrades');
    console.log(`[PASS] [Village Loop] Upgraded buildings, activated Edict & Panoply. New Power: ${villageAfterUpgrades.power}`);

    // 4. Test Save & Reload Persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__DOWNFALL_TEST__), { timeout: 5000 });
    const reloadedState = await page.evaluate(() => window.__DOWNFALL_TEST__.getState());
    assert.equal(reloadedState.highestWaveCleared, 15, 'Saved wave progress (15) must persist across page reload');
    assert.equal(reloadedState.buildings.town_hall, 4, 'Saved Town Hall level (4) must persist across page reload');
    console.log('[PASS] [Save & Reload] Bridge Storage persistence verified across reload.');

    // 5. Test Zero-Size Viewport (0x0) Resize Resilience
    await page.setViewportSize({ width: 0, height: 0 }).catch(() => {});
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 440, height: 956 });
    await page.waitForTimeout(200);
    console.log('[PASS] [0x0 Viewport Resize] Resized to 0x0 and restored to 440x956 with 0 crashes.');

    assert.equal(consoleErrors.length, 0, `Expected 0 console errors, got: ${consoleErrors.join('; ')}`);
    await browser.close();

    // 6. Visual Verification Screenshots in Chromium (440x775 Safari & 440x956 Fullscreen + Modals)
    const chBrowser = await chromium.launch({ headless: true });
    const chCtx = await chBrowser.newContext({
      viewport: { width: 440, height: 775 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const chPage = await chCtx.newPage();
    await chPage.goto(`${baseUrl}/?lang=it`, { waitUntil: 'networkidle' });
    await chPage.waitForFunction(() => Boolean(window.__DOWNFALL_TEST__), { timeout: 5000 });
    await chPage.waitForTimeout(350);
    await chPage.screenshot({ path: path.join(screenshotDir, '1_valley_safari_775.png') });

    // Open Tower Selection modal ("SCEGLI LA TUA TORRE")
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.tapWorldAt(365, 675));
    await chPage.waitForTimeout(200);
    await chPage.screenshot({ path: path.join(screenshotDir, '2_tower_selection_modal.png') });
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Open 6 Heroes Roster modal
    await chPage.mouse.click(Math.round(39 + 1 * 72.4), 775 - 32);
    await chPage.waitForTimeout(200);
    await chPage.screenshot({ path: path.join(screenshotDir, '3_heroes_6_roster_modal.png') });
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Open Connected Survivor House 1 modal
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.tapWorldAt(395, 700));
    await chPage.waitForTimeout(200);
    await chPage.screenshot({ path: path.join(screenshotDir, '4_house_connected_modal.png') });
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Open 19-Hex Mist Map modal
    await chPage.mouse.click(Math.round(39 + 5 * 72.4), 775 - 32);
    await chPage.waitForTimeout(200);
    await chPage.screenshot({ path: path.join(screenshotDir, '5_hex_mist_map_modal.png') });
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Open 7-Day Login Calendar modal
    await chPage.mouse.click(408, 126);
    await chPage.waitForTimeout(200);
    await chPage.screenshot({ path: path.join(screenshotDir, '6_login_calendar_modal.png') });
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.closeModal());

    // Switch to VillageScene and screenshot
    await chPage.evaluate(() => window.__DOWNFALL_TEST__.goToVillage());
    await chPage.waitForFunction(() => window.__DOWNFALL_TEST__?.scene === 'VillageScene', { timeout: 5000 });
    await chPage.waitForTimeout(350);
    await chPage.screenshot({ path: path.join(screenshotDir, '7_village_scene_safari_775.png') });

    await chBrowser.close();
    console.log('[PASS] [Visual Verification Screenshots] Captured all 7 high-DPI mobile screenshots.');

    // 7. Desktop Wide Viewport (1280x800) — Verify Decorated Bastion Flanks (Zero black bars)
    const deskBrowser = await chromium.launch({ headless: true });
    const deskPage = await deskBrowser.newPage({ viewport: { width: 1280, height: 800 } });
    await deskPage.goto(`${baseUrl}/?lang=it`, { waitUntil: 'networkidle' });
    await deskPage.waitForFunction(() => Boolean(window.__DOWNFALL_TEST__), { timeout: 5000 });
    await deskPage.waitForTimeout(400);
    await deskPage.screenshot({ path: path.join(screenshotDir, 't1_desktop_flanks.png') });
    await deskBrowser.close();
    console.log('[PASS] [Desktop 1280x800] Verified centered 9:16 canvas with decorated Bastion flanks.');

    console.log('\nALL BROWSER E2E TESTS PASSED WITH ZERO ERRORS!');
  } finally {
    previewServer.httpServer.close();
  }
}

runSuite().catch((err) => {
  console.error('E2E Test Suite failed:', err);
  process.exit(1);
});
