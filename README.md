# ☀️ Downfall — L'Assedio dell'Alba (*Dawnwall*)

Gioco HTML5 **Mobile Strategy + Tower Defense + 2.5D Base Building** realizzato con **Phaser 4 + TypeScript + Vite** e integrato nativamente con **Playgama Bridge SDK** per la pubblicazione su **Playgama** e **YouTube Playables**.

---

## 🎮 Gioca Subito (Mobile / iPhone 16 Pro Max / Desktop)

- **GitHub Pages (Giocabile direttamente da Safari iPhone o Desktop a PC spento)**:
  👉 **[https://saimon289127.github.io/Downfall-Dawnwall/](https://saimon289127.github.io/Downfall-Dawnwall/)**
- **Pacchetti `.zip` Pronti al Download**:
  - 📦 **[`Downfall-Playgama-Release.zip`](./releases/Downfall-Playgama-Release.zip)** — Build di produzione pronta per l'upload diretto su Playgama / YouTube Playables (`< 2.5 MiB` totali, zero CDN esterne, avvio `< 1s`).
  - 📦 **[`Downfall-Full-Project.zip`](./releases/Downfall-Full-Project.zip)** — Sorgente completo TypeScript + test automatizzati + documentazione + build.

---

## ✨ Caratteristiche Principali (Architettura 1:1 Clean-Room)

1. **Loop 1 — Vallata Fortificata 2.5D & Battaglia Tower Defense**:
   - **Controllo Diretto dell'Eroe (Kaelen)** con joystick virtuale *floating* fluido (`128 px/s`), collisioni fisiche 3D contro le mura in pietra (`CityCollider`) e apertura automatica dei 3 cancelli (`North / West / East Gate`).
   - **Zaino di Monete Fisico (`Hero Coin Stack`)** e raccolta magnetica con lancio parabolico sulle pedane di costruzione *on-demand*.
   - **5 Archetipi di Torrette** (*Balista d'Ambra, Cannone Tonante, Guglia Arcana, Obelisco di Gelo, Mortaio Solare*) selezionabili toccando qualsiasi torre tramite il popup illustrato **"SCEGLI LA TUA TORRE"**.
   - **3 Squadre di Truppe** (*Fanteria, Arcieri, Cavalleria*) con **Sinergia di Formazione (+15% ATK/DEF)** e abilità suprema attiva **Giudizio Solare**.
   - **Mini-Boss ogni 5 ondate** e **Boss Maggiore (Araldo dell'Eclissi) ogni 10 ondate** con musica dedicata, scosse della camera (*Trauma Shake*), numeri di danno fluttuanti e *Slow-Motion* sull'ultimo colpo.

2. **Loop 2 — Città Interattiva, 5 Alloggi Superstiti & Costruzione Base**:
   - **Tutti gli edifici e i 5 Alloggi Superstiti sono collegati**: toccando qualsiasi edificio, casa, torre o campana nella vallata (o nella schermata Città) si apre il relativo pannello di potenziamento e gestione.
   - **Fumetti Fluttuanti (*Speech Bubbles*)** in stile Kingshot sopra ogni struttura con stato, icona e pallino rosso di notifica.
   - **8 Edifici Principali** (*Rocca del Sole, Mensa Solare, Segheria, Fonderia Magmatica, Caserma dell'Alba, Officina Torrette, Accademia Solare, Santuario degli Eroi*) con **3 Livelli Visivi** distinti ciascuno + **5 Alloggi Superstiti** potenziabili.
   - **Gestione Superstiti & Morale**, **4 Decreti Reali** e **Albero di Ricerca dell'Accademia** (*Crescita, Economia, Battaglia*).

3. **Loop 3 — Meta-Progressione, 6 Eroi, 19 Esagoni nella Nebbia & Dashboard a 6 Tab**:
   - **Dashboard Inferiore a 6 Tab** (*⚔️ Conquista, 👑 Eroi, 🎒 Panoplia, 🏛️ Edifici, 📜 Decreti, 🗺️ Regno*) + **Pergamena Missioni a Capitoli** sempre visibile con pulsante rapido `VAI ➔ / RISCUOTI!`.
   - **6 Eroi dell'Alba** (*Kaelen, Lyra, Thorne, Nyxara, Re Aurelius, Valkyra*) con rarità, livelli, promozione fino a 5★ e Bauli del Santuario (Gratis a tempo + Epico con Rewarded Ad).
   - **Panoplia del Custode (6 Reliquie)**, **Mappa del Regno a 19 Esagoni nella Nebbia**, **Calendario Accesso 7 Giorni**, **5 Missioni Giornaliere** e **Guadagni Offline ("Mentre eri via...")**.

4. **Tecnologia & Conformità Playgama / YouTube Playables**:
   - **6 Lingue complete** (`IT`, `EN`, `ES`, `PT`, `FR`, `DE`) in file JSON dedicati.
   - **100% Full-Bleed su iPhone 16 Pro Max Safari** (`computeLogicalHeight()` dinamico con coordinate touch perfette anche con camera in movimento).
   - **Playgama Bridge v2.3.1** integrato offline con salvataggio automatico, gestione pausa/audio e annunci Rewarded / Interstitial conformi.

---

## 🛠️ Comandi di Sviluppo e Test QA

```bash
npm install
npm run dev          # Avvia il server di sviluppo Vite
npm run build        # Compila TypeScript e genera il pacchetto dist/
npm run test:unit    # Esegue la suite di test logici ed economici
npm run test:balance # Esegue la simulazione matematica a 7 giorni
npm run test:e2e     # Esegue la suite E2E Playwright (WebKit iPhone 16 Pro Max + Chromium)
```
