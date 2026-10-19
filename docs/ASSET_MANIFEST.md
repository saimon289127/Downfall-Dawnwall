# Elenco Completo degli Asset & Budget di Peso (`ASSET_MANIFEST.md`)

**Vincoli Tecnici Obbligatori:**
- **Pacchetto Iniziale:** `< 5 MiB` (Target preventivato: **~3,45 MiB** tutto incluso)
- **Pacchetto Totale:** `< 15 MiB`
- **Dimensione Singolo File:** `< 512 KiB` per ogni singolo file (atlas suddivisi e audio OGG/MP3 compresso a 96–112 kbps)
- **Zero CDN Esterni:** Tutti i font, immagini, atlas, audio e file JSON di lingua sono inclusi localmente nel pacchetto (solo `playgama-bridge.js` viene caricato secondo specifica Playgama).

---

## 1. Riepilogo Budget di Peso per Categoria

| Categoria | Formato & Impacchettamento | N. File Stimati | Peso Max per File | Peso Totale Stimato |
| :--- | :--- | :---: | :---: | :---: |
| **Codice Motore (Phaser 4 + Bridge + Gioco)** | JS/CSS minificati (Vite Rollup chunks) | 3 | ≤ 450 KiB | **~620 KiB** |
| **Atlas Edifici Villaggio (9 edifici × 3 Tier)** | 2 Texture Atlas WebP/PNG (`1024×1024`) | 2 | ≤ 380 KiB | **~680 KiB** |
| **Atlas Torrette & Proiettili (5 torrette × 3 Tier)** | 1 Texture Atlas WebP/PNG (`1024×1024`) | 1 | ≤ 320 KiB | **~290 KiB** |
| **Atlas Unità & Eroi (Truppe, Nemici, Boss, 6 Eroi)** | 2 Texture Atlas WebP/PNG (`1024×1024`) | 2 | ≤ 420 KiB | **~780 KiB** |
| **Mappa, Terreno, Nebbia & Cornici Desktop** | 1 Texture Atlas WebP/PNG (`1024×1024`) | 1 | ≤ 350 KiB | **~320 KiB** |
| **UI, Icone, Ritratti Eroi, Particelle & Font** | 1 Atlas UI (`1024×512`) + 1 Font `.woff2` | 2 | ≤ 220 KiB | **~280 KiB** |
| **Audio: 3 Tracce Musicali (Villaggio, Battaglia, Boss)** | 3 file `.mp3` / `.ogg` (loopabili, 64–96 kbps) | 3 | ≤ 260 KiB | **~680 KiB** |
| **Audio: 18 Effetti Sonori (SFX Sprite)** | 1 Audio Sprite `.mp3` / `.ogg` + JSON | 2 | ≤ 180 KiB | **~160 KiB** |
| **Localizzazione (6 Lingue JSON) + Balancing** | 7 file `.json` (`en, it, es, pt, fr, de`) | 7 | ≤ 25 KiB | **~90 KiB** |
| **TOTALE PACCHETTO INIZIALE E COMPLESSIVO** | — | **23 file** | **Max 450 KiB** | **~3.900 KiB (~3,81 MiB)** |

---

## 2. Elenco Dettagliato Asset Grafici (2D / 2.5D Isometrici)

### 2.1 Edifici del Villaggio (`atlas_buildings_1`, `atlas_buildings_2`)
Ogni edificio possiede **3 aspetti visivi distinti** (Tier 1: Legno & Tende d'Ambra Lv.1–3; Tier 2: Pietra Scolpita & Cobalto Lv.4–6; Tier 3: Bronzo Dorato & Cristalli Solari Lv.7–10) più l'impalcatura di cantiere:
1. `town_hall_t1`, `town_hall_t2`, `town_hall_t3` — **Rocca del Sole (Municipio)** (`256×256 px`, pivot `0.5, 0.78`)
2. `farm_t1`, `farm_t2`, `farm_t3` — **Fattoria Solare** (`192×192 px`, grano dorato e mulino solare)
3. `lumber_mill_t1`, `lumber_mill_t2`, `lumber_mill_t3` — **Segheria di Bosco Caldo** (`192×192 px`, ruota idraulica/sega circolare di bronzo)
4. `mine_t1`, `mine_t2`, `mine_t3` — **Miniera delle Vene d'Oro** (`192×192 px`, carrelli minerari e cristalli d'oro)
5. `barracks_t1`, `barracks_t2`, `barracks_t3` — **Caserma della Guardia** (`208×208 px`, rastrelliere d'armi e cortile d'addestramento)
6. `turret_workshop_t1`, `turret_workshop_t2`, `turret_workshop_t3` — **Officina delle Torrette** (`208×208 px`, forgia e ingranaggi d'ambra)
7. `walls_t1`, `walls_t2`, `walls_t3` — **Mura del Baluardo e Porta del Sole** (`256×160 px` per segmento + bracieri accesi)
8. `academy_t1`, `academy_t2`, `academy_t3` — **Accademia della Luce** (`208×208 px`, astrolabio e cupola prismatica)
9. `hero_tavern_t1`, `hero_tavern_t2`, `hero_tavern_t3` — **Taverna degli Eroi** (`208×208 px`, insegna dorata, lanterna calda e forziere)
10. `scaffold_overlay` — Impalcatura di costruzione animata + martello (`192×192 px`).

### 2.2 Torrette Difensive (`atlas_turrets`)
Ogni torretta ha base isometrica + torretta/cristallo superiore con **3 livelli di evoluzione in battaglia** e animazione di attacco/rinculo:
1. `turret_archer_lv1..3` — **Balista d'Ambra** (`128×128 px`, 4 frame: idle, carica, scocco, recupero) + proiettile `bolt_amber`.
2. `turret_cannon_lv1..3` — **Bombarda di Bronzo** (`128×128 px`, 4 frame: idle, fuoco, rinculo, fumo) + proiettile `shell_bronze`.
3. `turret_magic_lv1..3` — **Spira Arcana Solare** (`128×144 px`, cristallo flottante + bagliore di carica) + raggio `beam_solar`.
4. `turret_ice_lv1..3` — **Obelisco di Brina** (`128×144 px`, runa criogenica pulsante) + onda `nova_frost`.
5. `turret_mortar_lv1..3` — **Mortaio Cenerino** (`136×136 px`, bocca di fuoco pesante) + proiettile `meteor_cinder` + decal `scorch_zone`.
6. `turret_slot_empty`, `turret_slot_highlight` — Slot predefinito in pietra con runa solare (`96×64 px`).

### 2.3 Truppe, Eroi e Nemici (`atlas_units_1`, `atlas_units_2`)
Ogni unità ha **4 stati d'animazione obbligatori**: `idle` (4 frame), `walk` (6 frame), `attack` (4 frame), `death` (4 frame):
- **3 Truppe Alleate (`64×64 px` per frame):**
  1. `troop_infantry` — **Guardia dello Scudo** (spada corta e scudo torre blu/oro).
  2. `troop_archer` — **Balestriere del Faro** (cappuccio cobalto e balestra d'ambra).
  3. `troop_cavalry` — **Lanciere Solare** (`80×80 px`, destriero bardato e lancia lucente).
- **6 Eroi sul Campo (`88×88 px` per frame) + 6 Ritratti HD (`128×128 px`):**
  1. `hero_kaelen` — **Ser Kaelen, Guardiano dell'Alba** (Raro — alabarda solare e scudo-lanterna).
  2. `hero_lyra` — **Lyra Ventodambra** (Raro — doppia balestra ripetitrice e mantello piumato).
  3. `hero_thorne` — **Mastro Thorne** (Epico — bastone di cristallo glaciale e barba runica).
  4. `hero_nyxara` — **Nyxara del Velo Infranto** (Epico — sfere alchemiche solari).
  5. `hero_aurelius` — **Re Aurelius** (Leggendario — armatura imperiale dorata e spadone del sole).
  6. `hero_valkyra` — **Valkyra Aladorata** (Leggendario — ali di luce ambrata e lancia celeste).
- **7 Nemici della Nebbia:**
  1. `enemy_mist_runner` — **Predone della Nebbia** (`64×64 px`, segugio d'ombra con artigli ottanio).
  2. `enemy_veil_grunt` — **Fante del Velo** (`64×64 px`, guerriero spettrale con lama spezzata).
  3. `enemy_swarm_crawler` — **Strisciante d'Ombra** (`48×48 px`, parassita rapido della nebbia).
  4. `enemy_dread_shield` — **Corazzato del Velo** (`80×80 px`, colosso in armatura d'ossidiana e scudo).
  5. `enemy_gloom_wing` — **Ala Cupa** (`72×72 px`, gargoyle/spettro alato).
  6. `boss_veil_champion` — **Campione del Velo** (`112×112 px`, Mini-Boss ogni 5 ondate con mazza runica).
  7. `boss_eclipse_herald` — **Araldo dell'Eclissi** (`144×144 px`, Boss Maggiore ogni 10 ondate con incensiere incatenato e corna viola).

### 2.4 Mappa Esagonale, Ambiente e UI (`atlas_environment`, `atlas_ui`)
- **Mappa Territorio:** 6 varianti di tessera esagonale (`hex_meadow`, `hex_forest`, `hex_quarry`, `hex_gold_vein`, `hex_ruins`, `hex_shrine`), texture Nebbia animabile (`mist_cloud_tile`), icone ricompensa esagono.
- **Cornici Desktop Illustrate (No-Black-Bars per YouTube Playables):** `desktop_wing_left`, `desktop_wing_right` (bastioni in pietra dorata con stendardi e bracieri che affiancano la colonna `9:16` su monitor orizzontali).
- **UI & Feedback:** Scudo Potenza (`badge_power_shield`), icone risorse (`icon_food`, `icon_wood`, `icon_stone`, `icon_gold`, `icon_shard`), badge `Red Dot` pulsante, pulsanti 9-slice (`btn_primary_green`, `btn_gold`, `btn_rewarded_purple`, `panel_slate_frame`), 3 forzieri (`chest_wood`, `chest_silver`, `chest_sun_gold`), particelle (`part_spark`, `part_coin`, `part_mist`, `part_ice`, `part_ring`).

---

## 3. Elenco Asset Audio (`assets/audio/`)

Tutti gli asset audio sono compressi in formato `.mp3` / `.ogg` (compatibilità universale iOS Safari WebKit + Android Chrome) e gestiti tramite bus separati (`MusicBus`, `SfxBus`, `UiBus`) collegati agli eventi `AUDIO_STATE_CHANGED` e `PAUSE_STATE_CHANGED` di Playgama Bridge:

### 3.1 Tracce Musicali (Loopabili)
1. `bgm_village_hearth.mp3` (~210 KiB, 45s loop) — Chitarra acustica calda, flauto dolce, archi leggeri e crepitio del braciere solare.
2. `bgm_battle_march.mp3` (~230 KiB, 45s loop) — Percussioni tattiche, ottoni eroici e ostinato d'archi ad alta tensione.
3. `bgm_boss_eclipse.mp3` (~240 KiB, 45s loop) — Coro epico oscuro, timpani pesanti e fanfara d'ottoni per le ondate 5/10.

### 3.2 Effetti Sonori (18 SFX in Audio Sprite `sfx_master.mp3`)
1. `sfx_ui_tap` — Tocco morbido e reattivo sui pulsanti.
2. `sfx_ui_popup` — Apertura finestra/forziere (`whoosh` caldo).
3. `sfx_power_up` — Tintinnio ascendente cristallino all'aumento del contatore Potenza.
4. `sfx_collect_food_wood` — Raccolta risorse dal villaggio.
5. `sfx_collect_coin` — Moneta raccolta / arrivo al contatore.
6. `sfx_building_upgrade` — Colpo di martello + accordo trionfale di completamento edificio.
7. `sfx_hex_unlock` — Dissolvenza magica della Nebbia e accensione del faro sull'esagono.
8. `sfx_chest_open` — Apertura forziere con rivelazione frammenti eroe.
9. `sfx_turret_place` — Piazzamento solido torretta sullo slot di pietra.
10. `sfx_shoot_arrow` — Scocco rapido Balista d'Ambra (con variazione pitch `±6%`).
11. `sfx_shoot_cannon` — Esplosione Bombarda di Bronzo.
12. `sfx_shoot_magic` — Scarica prismatica Spira Arcana.
13. `sfx_shoot_ice` — Cristallizzazione Obelisco di Brina.
14. `sfx_shoot_mortar` — Lancio e impatto Mortaio Cenerino.
15. `sfx_troop_horn` — Corno di schieramento Truppe dalla Caserma.
16. `sfx_hero_ultimate` — Attivazione Abilità Suprema dell'Eroe.
17. `sfx_boss_warning` — Rintocco cupo d'allarme all'arrivo del Boss della Nebbia.
18. `sfx_victory_fanfare` / `sfx_defeat_horn` — Jingle di fine battaglia.
