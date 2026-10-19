# CREDITS & LICENSES (`CREDITS.md`)

Questo file traccia la provenienza e la licenza di ogni asset grafico, audio, font e libreria inclusi nel progetto **Downfall — L'Assedio dell'Alba**, garantendo il 100% di conformità per l'uso commerciale su **Playgama**, **YouTube Playables** e portali partner.

## 1. Librerie Software
- **Phaser 4** (`phaser` v4.2.1) — © Photon Storm Ltd. — Licenza: **MIT License** (Uso commerciale consentito).
- **Playgama Bridge SDK** (`@playgama/bridge` v2.3.1 / `public/playgama-bridge.js`) — © Playgama — Licenza: **MIT / Apache-2.0** (Uso commerciale consentito).
- **TypeScript & Vite** — Licenza: **MIT / Apache-2.0** (Strumenti di compilazione in fase di build).

## 2. Grafica, Texture HD 2.5D e Concept Art
- **Tavola di Stile & Concept Art (`docs/styleboard/*`)** — Generati su misura tramite **Google Gemini Image Generation** con direzione artistica originale del progetto (*Downfall — La Rocca del Sole*).
- **Texture In-Game 2.5D Isometriche (`src/systems/AssetGenerator.ts`)** — Dipinte proceduralmente su Canvas HTML5 ad alta densità al boot del gioco (100% codice proprietario originale, zero dipendenze esterne, zero violazioni di copyright). Include:
  - 8 Edifici della Rocca in 3 Livelli Visivi ciascuno (24 varianti architettoniche + 3 livelli per gli Alloggi Superstiti),
  - 5 Archetipi di Torrette difensive (Balista d'Ambra, Cannone Tonante, Guglia Arcana, Obelisco di Gelo, Mortaio Solare),
  - 6 Eroi dell'Alba (Kaelen, Lyra, Thorne, Nyxara, Re Aurelius, Valkyra) e 3 Truppe (Fanteria, Arcieri, Cavalleria),
  - 7 Archetipi di Nemici e Boss della Nebbia Notturna,
  - Interfaccia Utente e Fumetti Fluttuanti (*Floating Speech Bubbles*).

## 3. Audio e Musica (`src/systems/SoundSynthesizer.ts`)
- **Motore Audio Sintetizzato Web Audio API (`SoundSynthesizer.ts`)** — 100% generato matematicamente in tempo reale tramite oscillatori, inviluppi ADSR e filtri Web Audio API (3 colonne sonore dinamiche per Villaggio, Battaglia e Boss + 11 effetti sonori polifonici). Zero file audio di terze parti, zero problemi di copyright o Content ID su YouTube Playables.
