import Phaser from 'phaser';
import { BuildingId } from './GameStateManager';

let texturesGenerated = false;

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  drawFn(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawIsoRoof(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  eaveY: number,
  halfW: number,
  ridgeDrop: number,
  colorTop: string,
  colorBot: string,
  trimColor: string
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(9, 12, 24, 0.48)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;

  const grad = ctx.createLinearGradient(cx, topY, cx, eaveY + ridgeDrop);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBot);

  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + halfW, eaveY);
  ctx.lineTo(cx, eaveY + ridgeDrop);
  ctx.lineTo(cx - halfW, eaveY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Shingle tile lines
  ctx.strokeStyle = 'rgba(10, 20, 38, 0.28)';
  ctx.lineWidth = 1;
  for (let row = 1; row <= 3; row++) {
    const t = row / 4;
    const yL = topY + (eaveY - topY) * t;
    const yM = topY + (eaveY + ridgeDrop - topY) * t;
    const xSpan = halfW * t;
    ctx.beginPath();
    ctx.moveTo(cx - xSpan, yL);
    ctx.lineTo(cx, yM);
    ctx.lineTo(cx + xSpan, yL);
    ctx.stroke();
  }

  // Eave & Ridge Metallic Trim
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + halfW, eaveY);
  ctx.lineTo(cx, eaveY + ridgeDrop);
  ctx.lineTo(cx - halfW, eaveY);
  ctx.closePath();
  ctx.stroke();
}

function drawIsoBoxWalls(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  halfW: number,
  wallH: number,
  isoDrop: number,
  leftLight: string,
  leftDark: string,
  rightLight: string,
  rightDark: string
): void {
  // Left isometric wall (sunlit face)
  const gLeft = ctx.createLinearGradient(cx - halfW, topY, cx, topY + wallH + isoDrop);
  gLeft.addColorStop(0, leftLight);
  gLeft.addColorStop(1, leftDark);
  ctx.beginPath();
  ctx.moveTo(cx - halfW, topY);
  ctx.lineTo(cx, topY + isoDrop);
  ctx.lineTo(cx, topY + isoDrop + wallH);
  ctx.lineTo(cx - halfW, topY + wallH);
  ctx.closePath();
  ctx.fillStyle = gLeft;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 24, 46, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Right isometric wall (shaded face)
  const gRight = ctx.createLinearGradient(cx, topY + isoDrop, cx + halfW, topY + wallH);
  gRight.addColorStop(0, rightLight);
  gRight.addColorStop(1, rightDark);
  ctx.beginPath();
  ctx.moveTo(cx, topY + isoDrop);
  ctx.lineTo(cx + halfW, topY);
  ctx.lineTo(cx + halfW, topY + wallH);
  ctx.lineTo(cx, topY + isoDrop + wallH);
  ctx.closePath();
  ctx.fillStyle = gRight;
  ctx.fill();
  ctx.stroke();

  // Horizontal masonry courses
  ctx.strokeStyle = 'rgba(30, 35, 50, 0.22)';
  ctx.lineWidth = 1;
  for (let s = 1; s <= 2; s++) {
    const sy = topY + (wallH * s) / 3;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, sy);
    ctx.lineTo(cx, sy + isoDrop);
    ctx.lineTo(cx + halfW, sy);
    ctx.stroke();
  }
}

export function generateAllGameTextures(scene: Phaser.Scene): void {
  if (
    texturesGenerated &&
    scene.textures.exists('hero_kaelen') &&
    scene.textures.exists('wall_seg_h') &&
    scene.textures.exists('wall_bastion')
  ) {
    return;
  }
  texturesGenerated = true;

  // 1. Soft glowing particle flare
  makeCanvas(scene, 'particle_flare', 20, 20, (ctx) => {
    const rad = ctx.createRadialGradient(10, 10, 1, 10, 10, 9);
    rad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    rad.addColorStop(0.5, 'rgba(255, 230, 150, 0.85)');
    rad.addColorStop(1, 'rgba(255, 176, 32, 0)');
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(10, 10, 9, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. Physical 3D Gold Coin (for Hero back stack & parabolic flight)
  makeCanvas(scene, 'particle_coin', 26, 24, (ctx) => {
    // Coin cylinder rim thickness
    ctx.fillStyle = '#9C5100';
    ctx.beginPath();
    ctx.ellipse(13, 14, 10.5, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top metallic gold face
    const g = ctx.createLinearGradient(4, 5, 22, 16);
    g.addColorStop(0, '#FFF6B3');
    g.addColorStop(0.45, '#FFB81C');
    g.addColorStop(1, '#D47500');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(13, 10.5, 10.5, 6.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFF9D6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(13, 10.5, 8.2, 4.8, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Specular star glint
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(9, 8.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. 3D Isometric Fortress Wall Segment (Horizontal - Warm Sandstone & Timber Rampart like Screenshot 1 & 3)
  makeCanvas(scene, 'wall_seg_h', 64, 46, (ctx) => {
    // Ground ambient occlusion shadow
    ctx.fillStyle = 'rgba(18, 28, 14, 0.42)';
    ctx.beginPath();
    ctx.ellipse(32, 41, 31, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front vertical sandstone rampart wall
    const frontGrad = ctx.createLinearGradient(0, 14, 0, 39);
    frontGrad.addColorStop(0, '#D4BC94');
    frontGrad.addColorStop(0.55, '#B59B72');
    frontGrad.addColorStop(1, '#7D6744');
    ctx.fillStyle = frontGrad;
    ctx.fillRect(0, 14, 64, 25);

    // Masoned ashlar stone blocks on front face
    ctx.strokeStyle = 'rgba(66, 48, 24, 0.48)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(64, 22);
    ctx.moveTo(0, 30);
    ctx.lineTo(64, 30);
    for (let x = 8; x < 64; x += 16) {
      ctx.moveTo(x, 14);
      ctx.lineTo(x, 22);
      ctx.moveTo(x + 8, 22);
      ctx.lineTo(x + 8, 30);
      ctx.moveTo(x, 30);
      ctx.lineTo(x, 39);
    }
    ctx.stroke();

    // Timber reinforcement beam across the middle
    const woodGrad = ctx.createLinearGradient(0, 25, 0, 31);
    woodGrad.addColorStop(0, '#A86B32');
    woodGrad.addColorStop(1, '#6E4219');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 25, 64, 5);

    // Top sunlit limestone walkway
    const topGrad = ctx.createLinearGradient(0, 7, 0, 15);
    topGrad.addColorStop(0, '#F2E3C6');
    topGrad.addColorStop(1, '#D8C29D');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 8, 64, 7);

    // 3D Crenellated Merlons / Battlements along top edge
    for (let mx = 2; mx < 62; mx += 16) {
      ctx.fillStyle = '#FFF3D6';
      drawRoundedRect(ctx, mx, 2, 10, 7, 2);
      ctx.fill();
      ctx.fillStyle = '#B59B72';
      ctx.fillRect(mx, 7, 10, 3);
      ctx.strokeStyle = '#5C4524';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, 2, 10, 7);
    }

    // Bottom foundation trim
    ctx.fillStyle = '#5C4524';
    ctx.fillRect(0, 37, 64, 3);
  });

  // 4. 3D Isometric Fortress Wall Segment (Vertical Left/Right Sandstone Rampart)
  makeCanvas(scene, 'wall_seg_v', 34, 64, (ctx) => {
    ctx.fillStyle = 'rgba(18, 28, 14, 0.36)';
    ctx.fillRect(4, 4, 28, 58);

    const sideGrad = ctx.createLinearGradient(4, 0, 30, 0);
    sideGrad.addColorStop(0, '#E6D2AE');
    sideGrad.addColorStop(0.5, '#C2A87E');
    sideGrad.addColorStop(1, '#826B47');
    ctx.fillStyle = sideGrad;
    ctx.fillRect(6, 0, 22, 64);

    // Timber cross-ties & stone joints
    ctx.strokeStyle = 'rgba(66, 48, 24, 0.48)';
    ctx.lineWidth = 1.2;
    for (let y = 8; y < 64; y += 12) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(28, y);
      ctx.stroke();
    }

    // Top sunlit walkway & side merlons
    ctx.fillStyle = '#F2E3C6';
    ctx.fillRect(9, 0, 12, 64);
    for (let my = 3; my < 60; my += 16) {
      ctx.fillStyle = '#FFF3D6';
      ctx.fillRect(4, my, 7, 9);
      ctx.strokeStyle = '#5C4524';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, my, 7, 9);
    }
  });

  // 5. 3D Isometric Corner Bastion Tower ('wall_bastion')
  makeCanvas(scene, 'wall_bastion', 58, 72, (ctx) => {
    // Shadow
    ctx.fillStyle = 'rgba(18, 28, 14, 0.45)';
    ctx.beginPath();
    ctx.ellipse(29, 63, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cylindrical warm sandstone tower body
    const bodyGrad = ctx.createLinearGradient(10, 24, 48, 62);
    bodyGrad.addColorStop(0, '#F2E3C6');
    bodyGrad.addColorStop(0.45, '#C4AA80');
    bodyGrad.addColorStop(1, '#7D6744');
    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, 11, 24, 36, 38, 8);
    ctx.fill();
    ctx.strokeStyle = '#5C4524';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Stone courses
    ctx.strokeStyle = 'rgba(66, 48, 24, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(11, 36);
    ctx.lineTo(47, 36);
    ctx.moveTo(11, 48);
    ctx.lineTo(47, 48);
    ctx.stroke();

    // Timber collar
    ctx.fillStyle = '#8C5828';
    ctx.fillRect(9, 24, 40, 5);
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(9, 24, 40, 5);

    // Conical Cobalt-Blue Slate Roof
    const roofGrad = ctx.createLinearGradient(12, 4, 46, 26);
    roofGrad.addColorStop(0, '#38BDF8');
    roofGrad.addColorStop(0.45, '#1D5B8C');
    roofGrad.addColorStop(1, '#0F2942');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(29, 4);
    ctx.lineTo(51, 25);
    ctx.lineTo(29, 30);
    ctx.lineTo(7, 25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Golden finial & warm arrow slit window
    ctx.fillStyle = '#FFB020';
    ctx.beginPath();
    ctx.arc(29, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(26, 39, 6, 10);
  });

  // 6. 3D Pine Tree (Multi-tiered shaded evergreen conifer like Screenshot 1 & 3)
  makeCanvas(scene, 'prop_pine_tree', 68, 82, (ctx) => {
    // Ground shadow
    ctx.fillStyle = 'rgba(9, 14, 22, 0.42)';
    ctx.beginPath();
    ctx.ellipse(34, 72, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sturdy trunk
    const trunkGrad = ctx.createLinearGradient(28, 50, 40, 72);
    trunkGrad.addColorStop(0, '#7C4D25');
    trunkGrad.addColorStop(1, '#3E2410');
    ctx.fillStyle = trunkGrad;
    drawRoundedRect(ctx, 28, 50, 12, 23, 3);
    ctx.fill();

    // 4 Lush Conifer Tiers with sunlit left & shaded right gradients
    const tiers = [
      { topY: 26, botY: 60, halfW: 27, cLight: '#287D56', cDark: '#123D2B' },
      { topY: 16, botY: 47, halfW: 23, cLight: '#349B68', cDark: '#185239' },
      { topY: 8, botY: 35, halfW: 18, cLight: '#45B97C', cDark: '#1F6847' },
      { topY: 2, botY: 22, halfW: 12, cLight: '#68D391', cDark: '#278257' }
    ];
    for (const t of tiers) {
      const g = ctx.createLinearGradient(34 - t.halfW, t.topY, 34 + t.halfW, t.botY);
      g.addColorStop(0, t.cLight);
      g.addColorStop(0.55, t.cLight);
      g.addColorStop(1, t.cDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(34, t.topY);
      ctx.lineTo(34 + t.halfW, t.botY);
      ctx.lineTo(34, t.botY + 4);
      ctx.lineTo(34 - t.halfW, t.botY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(10, 32, 22, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });

  // 7. Isometric Rock & Gold Vein Outcrop
  makeCanvas(scene, 'prop_rock', 64, 54, (ctx) => {
    ctx.fillStyle = 'rgba(9, 14, 22, 0.38)';
    ctx.beginPath();
    ctx.ellipse(32, 43, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Faceted rock boulder
    const rGrad = ctx.createLinearGradient(10, 10, 54, 44);
    rGrad.addColorStop(0, '#94A3B8');
    rGrad.addColorStop(0.5, '#64748B');
    rGrad.addColorStop(1, '#334155');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(8, 38);
    ctx.lineTo(15, 16);
    ctx.lineTo(35, 9);
    ctx.lineTo(54, 22);
    ctx.lineTo(56, 40);
    ctx.lineTo(30, 45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Sunlit top facet
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(15, 16);
    ctx.lineTo(35, 9);
    ctx.lineTo(34, 28);
    ctx.closePath();
    ctx.fill();

    // Glowing gold crystal veins
    ctx.fillStyle = '#FFB020';
    ctx.beginPath();
    ctx.arc(28, 25, 3.8, 0, Math.PI * 2);
    ctx.arc(40, 30, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // 8. Alarm Bell ('Bel Alarm' in Screenshot 1) & Royal Decree Board ('Kotak Saran')
  makeCanvas(scene, 'prop_alarm_bell', 54, 58, (ctx) => {
    ctx.fillStyle = 'rgba(9, 14, 22, 0.42)';
    ctx.beginPath();
    ctx.ellipse(27, 50, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Timber posts
    ctx.fillStyle = '#6E4726';
    ctx.fillRect(13, 18, 5, 32);
    ctx.fillRect(36, 18, 5, 32);

    // Pitched blue awning roof
    drawIsoRoof(ctx, 27, 4, 20, 22, 5, '#38BDF8', '#1D5B8C', '#FFB020');

    // Cast bronze bell with highlight
    const bellGrad = ctx.createRadialGradient(25, 29, 1, 27, 31, 11);
    bellGrad.addColorStop(0, '#FFF3D1');
    bellGrad.addColorStop(0.5, '#FFB020');
    bellGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.arc(27, 29, 8, Math.PI, 0, false);
    ctx.lineTo(37, 39);
    ctx.lineTo(17, 39);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  makeCanvas(scene, 'prop_decree_box', 50, 54, (ctx) => {
    ctx.fillStyle = 'rgba(9, 14, 22, 0.4)';
    ctx.beginPath();
    ctx.ellipse(25, 46, 18, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5C3A21';
    ctx.fillRect(21, 26, 8, 20);

    const boxGrad = ctx.createLinearGradient(9, 8, 41, 30);
    boxGrad.addColorStop(0, '#B4692E');
    boxGrad.addColorStop(1, '#6E3D16');
    ctx.fillStyle = boxGrad;
    drawRoundedRect(ctx, 9, 10, 32, 22, 4);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pinned parchment scroll
    ctx.fillStyle = '#FFF3D1';
    drawRoundedRect(ctx, 15, 14, 20, 13, 2);
    ctx.fill();
    ctx.fillStyle = '#D97724';
    ctx.fillRect(18, 17, 14, 2);
    ctx.fillRect(18, 21, 10, 2);
  });

  // 9. Survivor Houses ('Permukiman 1..5' in Screenshot 1) across 3 Visual Tiers
  for (let tier = 1; tier <= 3; tier++) {
    makeCanvas(scene, `building_house_t${tier}`, 88, 82, (ctx) => {
      ctx.fillStyle = 'rgba(9, 12, 24, 0.44)';
      ctx.beginPath();
      ctx.ellipse(44, 68, 36, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3D Isometric cottage walls
      drawIsoBoxWalls(
        ctx,
        44,
        34,
        28,
        28,
        10,
        tier === 1 ? '#D6C4A8' : tier === 2 ? '#E8DCC8' : '#F8F1E5',
        tier === 1 ? '#A69072' : tier === 2 ? '#C4B299' : '#D9C8B0',
        tier === 1 ? '#9E886B' : tier === 2 ? '#B5A186' : '#C9B69C',
        tier === 1 ? '#78654C' : tier === 2 ? '#8C7A60' : '#9E8B70'
      );

      // Stone chimney
      ctx.fillStyle = '#64748B';
      ctx.fillRect(56, 12, 10, 22);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(56, 12, 10, 22);

      // Isometric Cobalt-Teal Pitched Roof
      drawIsoRoof(
        ctx,
        44,
        10,
        36,
        36,
        11,
        tier === 1 ? '#2980B9' : tier === 2 ? '#38BDF8' : '#60A5FA',
        tier === 1 ? '#154360' : tier === 2 ? '#1D5B8C' : '#1E3A8A',
        tier === 3 ? '#FFB020' : '#8C5828'
      );

      // Arched wooden door & glowing warm window
      ctx.fillStyle = '#4A2E16';
      drawRoundedRect(ctx, 26, 46, 11, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#FFB020';
      drawRoundedRect(ctx, 50, 45, 12, 10, 2);
      ctx.fill();
      ctx.strokeStyle = '#FFF3D1';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Grain sacks & barrel outside
      ctx.fillStyle = '#E6A938';
      ctx.beginPath();
      ctx.arc(71, 61, 5.5, 0, Math.PI * 2);
      ctx.arc(65, 64, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 10. All 9 Core Buildings across 3 Visual Tiers (HD 2.5D Isometric Art)
  const buildingIds: BuildingId[] = [
    'town_hall',
    'farm',
    'lumber_mill',
    'mine',
    'barracks',
    'turret_workshop',
    'academy',
    'walls',
    'hero_tavern'
  ];

  for (const bId of buildingIds) {
    for (let tier = 1; tier <= 3; tier++) {
      makeCanvas(scene, `building_${bId}_t${tier}`, 128, 122, (ctx) => {
        paintHDIsometricBuilding(ctx, bId, tier as 1 | 2 | 3);
      });
    }
  }

  // 11. Interactive Ground Coin Pad ('WaitFillData' Blueprint Pad)
  makeCanvas(scene, 'turret_pad', 76, 56, (ctx) => {
    // Outer golden glow
    const g = ctx.createRadialGradient(38, 28, 8, 38, 28, 35);
    g.addColorStop(0, 'rgba(30, 58, 95, 0.88)');
    g.addColorStop(0.75, 'rgba(20, 24, 46, 0.92)');
    g.addColorStop(1, 'rgba(255, 176, 32, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(38, 28, 35, 21, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beveled stone/gold elliptical pad
    ctx.fillStyle = '#1B2845';
    ctx.beginPath();
    ctx.ellipse(38, 28, 31, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(44, 232, 200, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(38, 28, 25, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  makeCanvas(scene, 'turret_slot', 76, 56, (ctx) => {
    ctx.drawImage(scene.textures.get('turret_pad').getSourceImage() as HTMLCanvasElement, 0, 0);
  });

  // 12. Hero Ground Selection Ring & Joystick Chrome
  makeCanvas(scene, 'hero_selection_ring', 68, 38, (ctx) => {
    const g = ctx.createRadialGradient(34, 19, 10, 34, 19, 32);
    g.addColorStop(0, 'rgba(44, 232, 200, 0.12)');
    g.addColorStop(0.8, 'rgba(44, 232, 200, 0.35)');
    g.addColorStop(1, 'rgba(44, 232, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(34, 19, 31, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2CE8C8';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(34, 19, 28, 14, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(34, 19, 22, 10.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  makeCanvas(scene, 'ui_joystick_base', 108, 108, (ctx) => {
    const g = ctx.createRadialGradient(54, 54, 12, 54, 54, 50);
    g.addColorStop(0, 'rgba(20, 24, 46, 0.18)');
    g.addColorStop(0.82, 'rgba(30, 58, 95, 0.45)');
    g.addColorStop(1, 'rgba(255, 243, 209, 0.1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(54, 54, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 243, 209, 0.72)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(54, 54, 47, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Directional arrows on ring
    ctx.fillStyle = 'rgba(255, 176, 32, 0.85)';
    const dirs = [
      [54, 11, 48, 20, 60, 20],
      [54, 97, 48, 88, 60, 88],
      [11, 54, 20, 48, 20, 60],
      [97, 54, 88, 48, 88, 60]
    ];
    for (const d of dirs) {
      ctx.beginPath();
      ctx.moveTo(d[0], d[1]);
      ctx.lineTo(d[2], d[3]);
      ctx.lineTo(d[4], d[5]);
      ctx.closePath();
      ctx.fill();
    }
  });

  makeCanvas(scene, 'ui_joystick_thumb', 46, 46, (ctx) => {
    const g = ctx.createRadialGradient(19, 17, 2, 23, 23, 20);
    g.addColorStop(0, '#FFF3D1');
    g.addColorStop(0.55, '#FFB020');
    g.addColorStop(1, '#C26210');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(23, 23, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFF9E6';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // 13. 4-Legged 2.5D Isometric Watchtowers ('Menara Pertahanan' from Screenshot 2 & 3)
  const turretStyles: Array<{
    id: string;
    deckTop: string;
    deckBot: string;
    accent: string;
    weaponType: 'ballista' | 'cannon' | 'prism' | 'cryo' | 'mortar';
  }> = [
    { id: 'archer', deckTop: '#B4692E', deckBot: '#6E3D16', accent: '#FFB020', weaponType: 'ballista' },
    { id: 'cannon', deckTop: '#64748B', deckBot: '#334155', accent: '#FF6B35', weaponType: 'cannon' },
    { id: 'magic', deckTop: '#6B46C1', deckBot: '#322659', accent: '#2CE8C8', weaponType: 'prism' },
    { id: 'ice', deckTop: '#2B6CB0', deckBot: '#1A365D', accent: '#9EF0FF', weaponType: 'cryo' },
    { id: 'mortar', deckTop: '#9B2C2C', deckBot: '#4A1515', accent: '#FF3B5C', weaponType: 'mortar' }
  ];

  for (const t of turretStyles) {
    makeCanvas(scene, `turret_${t.id}`, 82, 86, (ctx) => {
      // Ground shadow
      ctx.fillStyle = 'rgba(9, 12, 24, 0.45)';
      ctx.beginPath();
      ctx.ellipse(41, 72, 30, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4 Heavy Timber Stilts + X-Bracing (1:1 Kingshot Watchtower!)
      ctx.strokeStyle = '#4A2C11';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(20, 66);
      ctx.lineTo(58, 46);
      ctx.moveTo(20, 46);
      ctx.lineTo(58, 66);
      ctx.stroke();

      const legGrad = ctx.createLinearGradient(0, 36, 0, 72);
      legGrad.addColorStop(0, '#9C622B');
      legGrad.addColorStop(1, '#543212');
      ctx.fillStyle = legGrad;
      ctx.fillRect(16, 38, 7, 32);
      ctx.fillRect(59, 38, 7, 32);
      ctx.fillRect(24, 44, 6, 28);
      ctx.fillRect(52, 44, 6, 28);

      // Isometric Upper Crenellated Platform Deck
      const deckGrad = ctx.createLinearGradient(12, 22, 70, 44);
      deckGrad.addColorStop(0, t.deckTop);
      deckGrad.addColorStop(1, t.deckBot);
      ctx.fillStyle = deckGrad;
      drawRoundedRect(ctx, 12, 24, 58, 22, 6);
      ctx.fill();
      ctx.strokeStyle = '#FFB020';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Wooden battlement shields on platform front
      for (let bx = 16; bx <= 56; bx += 13) {
        ctx.fillStyle = '#D97724';
        drawRoundedRect(ctx, bx, 34, 9, 10, 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF3D1';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Mounted Siege Weapon on Top
      if (t.weaponType === 'ballista') {
        // Giant Twin-Arm Siege Crossbow (Screenshot 2 & 3!)
        ctx.strokeStyle = '#FFF3D1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 16);
        ctx.lineTo(41, 29);
        ctx.lineTo(62, 16);
        ctx.stroke();

        ctx.strokeStyle = '#FFB020';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(41, 24, 20, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // Loaded glowing golden bolt
        ctx.strokeStyle = '#FFF9D6';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(41, 30);
        ctx.lineTo(41, 6);
        ctx.stroke();
        ctx.fillStyle = '#FFB020';
        ctx.beginPath();
        ctx.moveTo(41, 2);
        ctx.lineTo(47, 11);
        ctx.lineTo(35, 11);
        ctx.closePath();
        ctx.fill();
      } else if (t.weaponType === 'cannon') {
        // Heavy Bronze & Iron Bombard Cannon
        const cGrad = ctx.createLinearGradient(24, 8, 58, 28);
        cGrad.addColorStop(0, '#4A5568');
        cGrad.addColorStop(0.5, '#1E293B');
        cGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = cGrad;
        drawRoundedRect(ctx, 25, 10, 32, 18, 7);
        ctx.fill();
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = '#FFB020';
        ctx.beginPath();
        ctx.arc(54, 19, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.weaponType === 'prism') {
        // Floating Radiant Arcane Prism Crystal
        const pGrad = ctx.createRadialGradient(41, 15, 2, 41, 15, 16);
        pGrad.addColorStop(0, '#FFFFFF');
        pGrad.addColorStop(0.5, t.accent);
        pGrad.addColorStop(1, '#553C9A');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.moveTo(41, 2);
        ctx.lineTo(54, 18);
        ctx.lineTo(41, 30);
        ctx.lineTo(28, 18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFF3D1';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (t.weaponType === 'cryo') {
        const iGrad = ctx.createRadialGradient(41, 16, 2, 41, 16, 14);
        iGrad.addColorStop(0, '#FFFFFF');
        iGrad.addColorStop(0.6, '#9EF0FF');
        iGrad.addColorStop(1, '#1D708C');
        ctx.fillStyle = iGrad;
        ctx.beginPath();
        ctx.arc(41, 17, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Solar Mortar Bowl
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(41, 19, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFB020';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = t.accent;
        ctx.beginPath();
        ctx.arc(41, 17, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 14. Hero Kaelen (King/Warden with Golden Crown, Royal Cobalt Cape, Plate Armor & Sun Halberd)
  makeCanvas(scene, 'hero_kaelen', 60, 62, (ctx) => {
    // Royal Cobalt-Blue Flowing Cape
    const capeGrad = ctx.createLinearGradient(12, 20, 48, 54);
    capeGrad.addColorStop(0, '#3B82F6');
    capeGrad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = capeGrad;
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.lineTo(49, 50);
    ctx.quadraticCurveTo(30, 56, 11, 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Burnished Steel & Gold Plate Cuirass
    const armorGrad = ctx.createLinearGradient(18, 22, 42, 46);
    armorGrad.addColorStop(0, '#60A5FA');
    armorGrad.addColorStop(0.4, '#1E3A5F');
    armorGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = armorGrad;
    drawRoundedRect(ctx, 19, 24, 22, 22, 6);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Sun Emblem on Chest
    ctx.fillStyle = '#FFB020';
    ctx.beginPath();
    ctx.arc(30, 34, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Pauldrons (Shoulder Armor)
    ctx.fillStyle = '#FFB020';
    ctx.beginPath();
    ctx.arc(17, 28, 5.5, 0, Math.PI * 2);
    ctx.arc(43, 28, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(30, 17, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5C3A21';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#14182E';
    ctx.beginPath();
    ctx.arc(27, 17, 1.5, 0, Math.PI * 2);
    ctx.arc(33, 17, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Royal 3-Point Golden Crown (1:1 like Screenshot 2 & 3!)
    const crownGrad = ctx.createLinearGradient(20, 2, 40, 13);
    crownGrad.addColorStop(0, '#FFF6B3');
    crownGrad.addColorStop(0.5, '#FFB020');
    crownGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = crownGrad;
    ctx.beginPath();
    ctx.moveTo(21, 13);
    ctx.lineTo(22, 4);
    ctx.lineTo(26, 9);
    ctx.lineTo(30, 2);
    ctx.lineTo(34, 9);
    ctx.lineTo(38, 4);
    ctx.lineTo(39, 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Radiant Sun-Halberd in Right Hand & Shield in Left Hand
    ctx.fillStyle = '#1D4ED8';
    drawRoundedRect(ctx, 9, 28, 10, 14, 4);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.strokeStyle = '#FFF3D1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(47, 8);
    ctx.lineTo(47, 50);
    ctx.stroke();

    const bladeGrad = ctx.createRadialGradient(47, 11, 1, 47, 11, 9);
    bladeGrad.addColorStop(0, '#FFFFFF');
    bladeGrad.addColorStop(0.5, '#FFB020');
    bladeGrad.addColorStop(1, '#D97724');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(47, 2);
    ctx.lineTo(56, 12);
    ctx.lineTo(47, 19);
    ctx.lineTo(41, 12);
    ctx.closePath();
    ctx.fill();
  });

  // 15. Friendly Retinue Soldiers (Blue-armored guards like Screenshot 2!)
  const troopColors: Array<{ id: string; cTop: string; cBot: string; trim: string }> = [
    { id: 'infantry', cTop: '#3B82F6', cBot: '#1D4ED8', trim: '#FFB020' },
    { id: 'archers', cTop: '#38BDF8', cBot: '#0369A1', trim: '#2ECC71' },
    { id: 'cavalry', cTop: '#818CF8', cBot: '#4338CA', trim: '#FFF3D1' }
  ];

  for (const tr of troopColors) {
    makeCanvas(scene, `troop_${tr.id}`, 38, 40, (ctx) => {
      const bGrad = ctx.createLinearGradient(10, 14, 28, 34);
      bGrad.addColorStop(0, tr.cTop);
      bGrad.addColorStop(1, tr.cBot);
      ctx.fillStyle = bGrad;
      drawRoundedRect(ctx, 10, 16, 18, 16, 5);
      ctx.fill();
      ctx.strokeStyle = tr.trim;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Steel Helmet with plume
      const hGrad = ctx.createRadialGradient(17, 10, 1, 19, 12, 8);
      hGrad.addColorStop(0, '#F8FAFC');
      hGrad.addColorStop(0.6, '#93C5FD');
      hGrad.addColorStop(1, '#1E3A8A');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.arc(19, 12, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Shield & Spear
      ctx.fillStyle = tr.trim;
      ctx.beginPath();
      ctx.arc(28, 24, 4.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 16. Crimson & Violet Night-Mist Horde Invaders (Screenshot 3!)
  const enemyConfigs: Array<{
    id: string;
    size: number;
    cTop: string;
    cBot: string;
    trim: string;
    isBoss?: boolean;
  }> = [
    { id: 'mist_runner', size: 36, cTop: '#FB7185', cBot: '#BE123C', trim: '#FFB020' },
    { id: 'veil_grunt', size: 40, cTop: '#F87171', cBot: '#991B1B', trim: '#FCA5A5' },
    { id: 'dread_shield', size: 46, cTop: '#EF4444', cBot: '#7F1D1D', trim: '#2CE8C8' },
    { id: 'gloom_wing', size: 40, cTop: '#A78BFA', cBot: '#4C1D95', trim: '#2CE8C8' },
    { id: 'swarm_crawler', size: 32, cTop: '#FDA4AF', cBot: '#E11D48', trim: '#FFF3D1' },
    { id: 'veil_champion', size: 62, cTop: '#E11D48', cBot: '#4C0519', trim: '#FFB020', isBoss: true },
    { id: 'eclipse_herald', size: 74, cTop: '#9333EA', cBot: '#2E1065', trim: '#FF3B5C', isBoss: true }
  ];

  for (const en of enemyConfigs) {
    const s = en.size;
    const half = s / 2;
    makeCanvas(scene, `enemy_${en.id}`, s, s, (ctx) => {
      const grad = ctx.createRadialGradient(half - 4, half - 4, 2, half, half, half - 5);
      grad.addColorStop(0, en.cTop);
      grad.addColorStop(1, en.cBot);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(half, half + 2, half - 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = en.trim;
      ctx.lineWidth = en.isBoss ? 3.2 : 2;
      ctx.stroke();

      // Curved Horns
      ctx.fillStyle = en.trim;
      ctx.beginPath();
      ctx.moveTo(half - 7, 10);
      ctx.lineTo(half - 15, 1);
      ctx.lineTo(half - 2, 7);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(half + 7, 10);
      ctx.lineTo(half + 15, 1);
      ctx.lineTo(half + 2, 7);
      ctx.closePath();
      ctx.fill();

      // Glowing Spectral Eyes
      ctx.fillStyle = '#FFF3D1';
      ctx.beginPath();
      ctx.arc(half - 5, half, en.isBoss ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.arc(half + 5, half, en.isBoss ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 17. Village Citizen / Lumberjack Worker
  makeCanvas(scene, 'citizen_worker', 26, 28, (ctx) => {
    ctx.fillStyle = 'rgba(9, 12, 24, 0.35)';
    ctx.beginPath();
    ctx.ellipse(13, 24, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284C7';
    drawRoundedRect(ctx, 7, 11, 12, 12, 4);
    ctx.fill();
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(13, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 18. All 6 Playable Heroes Portraits for the Heroes Roster & Sanctuary
  const heroRosterVisuals: Array<{
    id: string;
    capeTop: string;
    capeBot: string;
    armorTop: string;
    armorBot: string;
    trim: string;
    hair: string;
  }> = [
    { id: 'lyra', capeTop: '#34D399', capeBot: '#065F46', armorTop: '#6EE7B7', armorBot: '#047857', trim: '#FFB020', hair: '#FDE68A' },
    { id: 'thorne', capeTop: '#38BDF8', capeBot: '#0C4A6E', armorTop: '#93C5FD', armorBot: '#1E3A8A', trim: '#9EF0FF', hair: '#E2E8F0' },
    { id: 'nyxara', capeTop: '#C084FC', capeBot: '#4C1D95', armorTop: '#A855F7', armorBot: '#3B0764', trim: '#2CE8C8', hair: '#F3E8FF' },
    { id: 'aurelius', capeTop: '#FBBF24', capeBot: '#92400E', armorTop: '#FEF08A', armorBot: '#B45309', trim: '#FFF3D1', hair: '#FFFBEB' },
    { id: 'valkyra', capeTop: '#FB7185', capeBot: '#881337', armorTop: '#FDA4AF', armorBot: '#9F1239', trim: '#FFB020', hair: '#FECDD3' }
  ];

  for (const hr of heroRosterVisuals) {
    makeCanvas(scene, `hero_${hr.id}`, 60, 62, (ctx) => {
      const capeGrad = ctx.createLinearGradient(12, 20, 48, 54);
      capeGrad.addColorStop(0, hr.capeTop);
      capeGrad.addColorStop(1, hr.capeBot);
      ctx.fillStyle = capeGrad;
      ctx.beginPath();
      ctx.moveTo(30, 18);
      ctx.lineTo(49, 50);
      ctx.quadraticCurveTo(30, 56, 11, 50);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hr.trim;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const armorGrad = ctx.createLinearGradient(18, 22, 42, 46);
      armorGrad.addColorStop(0, hr.armorTop);
      armorGrad.addColorStop(1, hr.armorBot);
      ctx.fillStyle = armorGrad;
      drawRoundedRect(ctx, 19, 24, 22, 22, 6);
      ctx.fill();
      ctx.strokeStyle = hr.trim;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFE0B2';
      ctx.beginPath();
      ctx.arc(30, 17, 8.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair / Crown crest
      ctx.fillStyle = hr.hair;
      ctx.beginPath();
      ctx.arc(30, 12, 8.5, Math.PI, 0, false);
      ctx.fill();
      ctx.strokeStyle = hr.trim;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.fillStyle = '#14182E';
      ctx.beginPath();
      ctx.arc(27, 17, 1.5, 0, Math.PI * 2);
      ctx.arc(33, 17, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 19. Kingshot-Style Floating White/Gold Speech Bubble Badge Background ('ui_speech_bubble')
  makeCanvas(scene, 'ui_speech_bubble', 44, 48, (ctx) => {
    ctx.save();
    ctx.shadowColor = 'rgba(9, 12, 24, 0.45)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    const g = ctx.createLinearGradient(0, 2, 0, 36);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#F5E8C7');
    ctx.fillStyle = g;

    drawRoundedRect(ctx, 4, 3, 36, 32, 10);
    ctx.fill();

    // Pointer triangle at bottom
    ctx.beginPath();
    ctx.moveTo(16, 34);
    ctx.lineTo(22, 43);
    ctx.lineTo(28, 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#D97724';
    ctx.lineWidth = 2.2;
    drawRoundedRect(ctx, 4, 3, 36, 32, 10);
    ctx.stroke();
  });
}

function paintHDIsometricBuilding(
  ctx: CanvasRenderingContext2D,
  buildingId: BuildingId,
  tier: 1 | 2 | 3
): void {
  // Ground ambient occlusion shadow
  ctx.fillStyle = 'rgba(9, 12, 24, 0.46)';
  ctx.beginPath();
  ctx.ellipse(64, 100, 54, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Isometric 3D Stone Foundation Terrace
  const baseGrad = ctx.createLinearGradient(14, 70, 114, 104);
  baseGrad.addColorStop(0, tier === 1 ? '#94A3B8' : tier === 2 ? '#CBD5E1' : '#F1F5F9');
  baseGrad.addColorStop(1, tier === 1 ? '#475569' : tier === 2 ? '#64748B' : '#94A3B8');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(64, 62);
  ctx.lineTo(116, 82);
  ctx.lineTo(64, 104);
  ctx.lineTo(12, 82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = tier === 3 ? '#FFB020' : '#D97724';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  if (buildingId === 'town_hall') {
    // 'Pusat Kota' / Rocca del Sole: Majestic Multi-Tiered Isometric Citadel Keep with Scaffolding & Sun Beacon
    drawIsoBoxWalls(
      ctx,
      64,
      36,
      42,
      44,
      15,
      tier === 1 ? '#D6C3A5' : tier === 2 ? '#E8D8BE' : '#FAF0DC',
      tier === 1 ? '#A68E6C' : tier === 2 ? '#C2AC8C' : '#DEC8A4',
      tier === 1 ? '#9E8564' : tier === 2 ? '#B59E7D' : '#CFB792',
      tier === 1 ? '#705C42' : tier === 2 ? '#8A7456' : '#A38B68'
    );

    // Lower Cobalt-Blue Isometric Roof
    drawIsoRoof(ctx, 64, 16, 42, 50, 16, '#38BDF8', '#1D5B8C', '#FFB020');

    // Upper Citadel Tower Keep
    drawIsoBoxWalls(ctx, 64, 18, 24, 22, 8, '#FAF0DC', '#D4BE98', '#C4AE88', '#8F7956');
    drawIsoRoof(ctx, 64, 3, 22, 30, 10, '#60A5FA', '#1E3A8A', '#FFB020');

    // Timber scaffolding lattice on front-right facade (like Pusat Kota in Screenshot 1!)
    ctx.strokeStyle = '#8C5828';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(26, 46, 76, 34);
    ctx.beginPath();
    ctx.moveTo(26, 63);
    ctx.lineTo(102, 63);
    ctx.moveTo(46, 46);
    ctx.lineTo(46, 80);
    ctx.moveTo(82, 46);
    ctx.lineTo(82, 80);
    ctx.stroke();

    // Grand Arched Gate & Glowing Sun Emblem
    ctx.fillStyle = '#4A2C11';
    drawRoundedRect(ctx, 55, 64, 18, 24, 7);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2;
    ctx.stroke();

    const sunGrad = ctx.createRadialGradient(64, 28, 1, 64, 28, 11);
    sunGrad.addColorStop(0, '#FFFFFF');
    sunGrad.addColorStop(0.5, '#FFB020');
    sunGrad.addColorStop(1, 'rgba(255, 176, 32, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(64, 28, 11, 0, Math.PI * 2);
    ctx.fill();
  } else if (buildingId === 'mine') {
    // 'Tambang' / Fonderia Magmatica (Screenshot 2 top-left: Rock Mountain Smelter pouring glowing molten gold/lava!)
    const rockGrad = ctx.createLinearGradient(20, 14, 104, 86);
    rockGrad.addColorStop(0, '#64748B');
    rockGrad.addColorStop(0.55, '#475569');
    rockGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(18, 82);
    ctx.lineTo(28, 28);
    ctx.lineTo(54, 12);
    ctx.lineTo(86, 20);
    ctx.lineTo(108, 48);
    ctx.lineTo(104, 84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Smelter Crucible Chimney
    ctx.fillStyle = '#334155';
    drawRoundedRect(ctx, 40, 12, 28, 26, 4);
    ctx.fill();
    ctx.fillStyle = '#FF4500';
    ctx.beginPath();
    ctx.ellipse(54, 14, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flowing Molten Gold Cascade into Forging Trough!
    const lavaGrad = ctx.createLinearGradient(54, 32, 54, 88);
    lavaGrad.addColorStop(0, '#FFFFFF');
    lavaGrad.addColorStop(0.35, '#FFB020');
    lavaGrad.addColorStop(1, '#EA580C');
    ctx.fillStyle = lavaGrad;
    drawRoundedRect(ctx, 48, 34, 13, 50, 5);
    ctx.fill();

    // Foundry Slate Roof Shed
    drawIsoRoof(ctx, 78, 42, 60, 26, 8, '#38BDF8', '#1E3A5F', '#FFB020');
  } else if (buildingId === 'lumber_mill') {
    // 'Penggergajian' / Segheria: Isometric Timber Lodge with Spinning Steel Sawblade & Stacked Logs
    drawIsoBoxWalls(ctx, 64, 42, 36, 36, 12, '#B87A3D', '#8C5828', '#7D4E22', '#543314');
    drawIsoRoof(ctx, 64, 14, 44, 44, 14, '#A0522D', '#5C2E0E', '#FFB020');

    // Spinning Steel Circular Sawblade
    const sawGrad = ctx.createRadialGradient(46, 66, 2, 46, 66, 14);
    sawGrad.addColorStop(0, '#FFFFFF');
    sawGrad.addColorStop(0.7, '#CBD5E1');
    sawGrad.addColorStop(1, '#64748B');
    ctx.fillStyle = sawGrad;
    ctx.beginPath();
    ctx.arc(46, 66, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Stacked Timber Logs
    for (let ly = 0; ly < 2; ly++) {
      for (let lx = 0; lx < 2; lx++) {
        ctx.fillStyle = '#8C5220';
        drawRoundedRect(ctx, 68 + lx * 15, 66 - ly * 9, 14, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.beginPath();
        ctx.arc(81 + lx * 15, 70 - ly * 9, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (buildingId === 'farm') {
    // 'Kantin' / Mensa Solare (Screenshot 1 left: Warm Blue-Roofed Kitchen with Golden Plate + Fork & Spoon!)
    drawIsoBoxWalls(ctx, 64, 42, 38, 36, 13, '#E8D8BE', '#C2AC8C', '#B59E7D', '#8A7456');
    drawIsoRoof(ctx, 64, 14, 44, 46, 15, '#38BDF8', '#155E75', '#FFB020');

    // Golden Emblem Plate with Fork & Spoon on Roof
    ctx.fillStyle = '#FFF3D1';
    ctx.beginPath();
    ctx.arc(64, 34, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97724';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#D97724';
    ctx.fillRect(59, 26, 3, 16);
    ctx.fillRect(66, 26, 3, 16);
  } else {
    // Barracks ('Kamp Penakluk'), Workshop, Academy, Walls, Hero Sanctuary (Screenshot 2 bottom-left Golden/Crimson Temple!)
    const roofTop =
      buildingId === 'hero_tavern'
        ? '#FBBF24'
        : buildingId === 'barracks'
          ? '#EF4444'
          : buildingId === 'academy'
            ? '#A855F7'
            : '#38BDF8';
    const roofBot =
      buildingId === 'hero_tavern'
        ? '#B45309'
        : buildingId === 'barracks'
          ? '#7F1D1D'
          : buildingId === 'academy'
            ? '#4C1D95'
            : '#1E3A5F';

    drawIsoBoxWalls(ctx, 64, 40, 36, 38, 13, '#E2E8F0', '#94A3B8', '#94A3B8', '#475569');
    drawIsoRoof(ctx, 64, 12, 42, 44, 15, roofTop, roofBot, '#FFB020');

    // Royal Crimson & Gold Entrance Carpet (Screenshot 2 bottom-left!)
    ctx.fillStyle = '#B91C1C';
    drawRoundedRect(ctx, 54, 62, 20, 26, 3);
    ctx.fill();
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
