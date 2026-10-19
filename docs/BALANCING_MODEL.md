# Modello Matematico di Bilanciamento (`BALANCING_MODEL.md`)

**File di configurazione associato:** [`src/config/balancing.json`](../src/config/balancing.json)  
**Simulatore di verifica automatica:** [`scripts/verify_balance.mjs`](../scripts/verify_balance.mjs)

---

## 1. Filosofia e Obiettivi Matematici della Curva

La curva di progressione è progettata per soddisfare tre vincoli simultanei:
1. **Sessione 1 (0–15 minuti) ad altissima dopamina:** Il giocatore completa **14 potenziamenti** nei primi 15 minuti (1 level-up ogni ~60 secondi), porta la Rocca del Sole al **Livello 3**, sblocca Miniera, Taverna e Accademia, supera le prime **7–8 ondate** (incluso il primo Mini-Boss all'Ondata 5) e vede la sua **Potenza** salire da `1.215` a **`4.505`** (`+270%`).
2. **Rientri regolari guidati dai Tetti di Stoccaggio (`Cap`):** Nei livelli 1–3 i magazzini di Fattoria, Segheria e Miniera si riempiono in **20–35 minuti**; nei livelli 4–6 si riempiono in **1,5–2,5 ore**; nei livelli 7–10 si riempiono in **3,5–5 ore**, creando sessioni naturali mattino/pomeriggio/sera.
3. **Progressione di 7 Giorni senza muri né inflazione esplosiva:** I costi degli edifici crescono con fattore geometrico $\approx 2.05\times - 2.15\times$ per livello, mentre la produzione oraria combinata (edifici + bonus esagoni + bottino battaglie) cresce con fattore $\approx 1.65\times$ per livello, allungando gradualmente i tempi di attesa da pochi secondi (Lv. 1–3) a minuti (Lv. 4–5) fino a ore (Lv. 6–10), dove le **Rewarded Ads** di accelerazione (`-30 min` / `-50%`) e il raddoppio offline (`×2`) offrono un valore enorme senza mai bloccare chi gioca gratis.

---

## 2. Formule Fondamentali

### 2.1 Formula del Contatore "Potenza" (`⚡ Power`)
Il valore di Potenza mostrato in tempo reale nell'HUD superiore è calcolato in modo deterministico dallo stato salvato:

$$\text{Power}_{\text{tot}} = \sum_{b \in \text{Buildings}} P_{\text{building}}(b, L_b) + \sum_{h \in \text{Heroes}} P_{\text{hero}}(h) + \sum_{r \in \text{Research}} 150 \cdot L_r + 250 \cdot N_{\text{hex}}$$

Dove il contributo di ciascun Eroe sbloccato $h$ di rarità $R \in \{\text{Rare}, \text{Epic}, \text{Legendary}\}$, livello $L_h \in [1, 30]$ e stelle $S_h \in [1, 5]$ è:

$$P_{\text{hero}}(h) = \text{round}\Big(\big(B_R + 45 \cdot L_h\big) \cdot M_{\text{star}}(S_h)\Big)$$

con $B_{\text{Rare}} = 350$, $B_{\text{Epic}} = 600$, $B_{\text{Legendary}} = 950$ e moltiplicatore stelle $M_{\text{star}} = [1.00,\; 1.25,\; 1.60,\; 2.05,\; 2.65]$.

### 2.2 Formula DPS vs HP nelle Battaglie Tower Defense (Loop 1)
Per ogni ondata $w \in [1, 50]$, la salute dei nemici e il bottino scalano secondo:

$$\text{HP}(e, w) = \text{round}\Big(\text{HP}_{\text{base}}(e) \cdot 1.135^{(w - 1)}\Big)$$

$$\text{Bounty}(e, w) = \text{round}\Big(\text{Bounty}_{\text{base}}(e) \cdot 1.08^{(w - 1)}\Big)$$

Il danno effettivo al secondo ($\text{DPS}_{\text{eff}}$) di una torretta $T$ contro un nemico con armatura $A_e \in [0, 0.45]$ è:

$$\text{DPS}_{\text{eff}}(T, e) = \text{Dmg}(T) \cdot \text{Rate}(T) \cdot M_{\text{workshop}} \cdot M_{\text{hex}} \cdot \Big(1 - A_e \cdot (1 - \text{ArmorPierce}_T)\Big)$$

### 2.3 Guadagni Offline ("Mentre eri via…")
Al rientro dopo $\Delta t$ secondi di assenza (con $\Delta t_{\text{eff}} = \min(\Delta t,\; 8 \times 3600)$ secondi):

$$\text{Gain}_r = \min\left(\text{Cap}_r,\; \text{Rate}_r \cdot \frac{\Delta t_{\text{eff}}}{60}\right)$$

Con possibilità di **Raddoppio ($\times 2$)** tramite visione completata di una Rewarded Ad.

---

## 3. Tabelle di Progressione Edifici (Livelli 1–10)

### 3.1 Rocca del Sole (Municipio — `town_hall`)
| Livello | Aspetto Visivo | Costo Legno | Costo Pietra | Costo Oro | Tempo (`timeSec`) | Potenza | Sblocchi Principali |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | Tier 1 (Avamposto Legno) | 0 | 0 | 0 | 0s | 150 | Fattoria, Segheria, Caserma, Officina, Mura |
| **2** | Tier 1 (Avamposto Legno) | 120 | 40 | 0 | **15s** *(Gratis)* | 320 | Miniera, Taverna degli Eroi, Torretta Magica |
| **3** | Tier 1 (Avamposto Legno) | 280 | 120 | 30 | **45s** *(Gratis)* | 580 | Accademia della Luce, Obelisco di Brina (Ghiaccio) |
| **4** | Tier 2 (Rocca di Pietra) | 650 | 320 | 90 | **3m** | 980 | 2° Cantiere, Mortaio Cenerino, Cavalleria Solare |
| **5** | Tier 2 (Rocca di Pietra) | 1.400 | 750 | 220 | **10m** | 1.600 | Anello 2 Mappa Esagonale (Esagoni 7–12) |
| **6** | Tier 2 (Rocca di Pietra) | 3.000 | 1.700 | 500 | **30m** | 2.550 | Promozione Eroi 4★ |
| **7** | Tier 3 (Cittadella Solare) | 6.200 | 3.800 | 1.150 | **1h** | 4.000 | Anello 3 Mappa Esagonale (Esagoni 13–18) |
| **8** | Tier 3 (Cittadella Solare) | 12.500 | 8.000 | 2.500 | **2h** | 6.200 | Truppe d'Élite Solari |
| **9** | Tier 3 (Cittadella Solare) | 25.000 | 16.500 | 5.200 | **4h** | 9.500 | Sovraccarico del Faro Solare |
| **10** | Tier 3 (Cittadella Solare) | 50.000 | 34.000 | 11.000 | **8h** | 14.500 | Ascensione Cittadella del Sole |

### 3.2 Edifici Produttivi (`farm`, `lumber_mill`, `mine`)
| Livello | Produzione Cibo/Legno (`/min`) | Tetto Cibo/Legno (`Cap`) | Produzione Pietra / Oro (`/min`) | Tetto Pietra / Oro (`Cap`) | Tempo Costruzione |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 30 / min | 600 *(20 min)* | 22 Pietra / 5 Oro | 500 / 150 | 5s – 12s |
| **2** | 55 / min | 1.400 *(25 min)* | 40 Pietra / 10 Oro | 1.200 / 360 | 15s – 30s |
| **3** | 95 / min | 3.200 *(34 min)* | 70 Pietra / 18 Oro | 2.800 / 850 | 40s – 75s |
| **4** | 160 / min | 7.500 *(47 min)* | 120 Pietra / 32 Oro | 6.400 / 2.000 | 2m – 3.5m |
| **5** | 260 / min | 16.000 *(1h 01m)* | 200 Pietra / 55 Oro | 14.000 / 4.400 | 6m – 9m |
| **6** | 420 / min | 34.000 *(1h 21m)* | 330 Pietra / 92 Oro | 30.000 / 9.500 | 15m – 20m |
| **7** | 680 / min | 70.000 *(1h 43m)* | 540 Pietra / 150 Oro | 62.000 / 20.000 | 35m – 45m |
| **8** | 1.080 / min | 140.000 *(2h 10m)* | 860 Pietra / 245 Oro | 125.000 / 42.000 | 1.25h – 1.5h |
| **9** | 1.700 / min | 280.000 *(2h 45m)* | 1.350 Pietra / 390 Oro | 250.000 / 85.000 | 2.5h – 3h |
| **10** | 2.650 / min | 550.000 *(3h 27m)* | 2.100 Pietra / 620 Oro | 500.000 / 175.000 | 5h – 6h |

---

## 4. Bilanciamento Torrette, Truppe e Nemici

### 4.1 Le 5 Torrette (`turrets`)
| Torretta | Sblocco | Costo Oro Battaglia (Lv.1 / Lv.2 / Lv.3) | Danno Base | Cadenza (`/s`) | DPS Base (Lv.1 → Lv.3) | Gittata (`px`) | Effetto Speciale |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Balista d'Ambra** (`archer`) | TH Lv.1 | 50 / 75 / 125 | 24 | 1.80 | 43.2 → 101.5 | 210 | Colpisce volanti, 10% perforazione |
| **Bombarda di Bronzo** (`cannon`) | TH Lv.1 | 75 / 110 / 175 | 68 | 0.75 | 51.0 → 125.0 | 185 | 65% perforazione armatura, splash 48px |
| **Spira Arcana** (`magic`) | TH Lv.2 | 90 / 135 / 210 | 45 | 1.25 | 56.3 → 140.6 | 200 | 100% perforazione, catena su 2 bersagli |
| **Obelisco di Brina** (`ice`) | TH Lv.3 | 80 / 120 / 185 | 18 | 1.10 | 19.8 → 41.6 | 175 | Splash 70px, rallenta del 35%→55% (2.5s) |
| **Mortaio Cenerino** (`mortar`) | TH Lv.4 | 110 / 160 / 250 | 95 | 0.45 | 42.8 → 111.2 | 270 | Splash 95px + bruciatura 12 DPS per 3s |

### 4.2 I 7 Archetipi Nemici (`enemies`)
| Nemico | Ruolo | HP Base (Ondata 1) | Velocità (`px/s`) | Armatura | Danno alle Mura | Taglia Oro Battaglia |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Predone della Nebbia** (`mist_runner`) | Veloce / Segugio | 75 | 78 | 0% | 18 | 8 |
| **Fante del Velo** (`veil_grunt`) | Bilanciato | 135 | 52 | 10% | 28 | 12 |
| **Strisciante d'Ombra** (`swarm_crawler`) | Sciame numeroso | 45 | 68 | 0% | 10 | 5 |
| **Corazzato del Velo** (`dread_shield`) | Tank corazzato | 320 | 36 | 45% | 55 | 24 |
| **Ala Cupa** (`gloom_wing`) | Volante | 110 | 65 | 5% | 25 | 15 |
| **Campione del Velo** (`veil_champion`) | **Mini-Boss (ogni 5 ondate)** | 1.150 | 32 | 35% | 180 | 90 |
| **Araldo dell'Eclissi** (`eclipse_herald`) | **Boss Maggiore (ogni 10 ondate)** | 2.800 | 26 | 40% | 350 | 220 |

---

## 5. Risultati della Simulazione Automatica a 7 Giorni (`scripts/verify_balance.mjs`)

Eseguendo `node scripts/verify_balance.mjs` sul file `src/config/balancing.json`, otteniamo la seguente curva verificata senza alcun blocco né esplosione di valuta:

| Tappa Temporale | Livello Municipio | Totale Potenziamenti | Ondata Raggiunta | Esagoni Liberati | Potenza Totale (`⚡`) | Riserva Oro |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Avvio (Minuto 0)** | Lv. 1 | 0 | Ondata 1 | 1 / 19 | **1.215** | 80 |
| **Fine Sessione 1 (15 min)** | **Lv. 3** | **14** *(~1 ogni 64s)* | **Ondata 8** | **6 / 19** | **4.505** | 310 |
| **Fine Giorno 1** | Lv. 4 | 23 | Ondata 14 | 10 / 19 | **7.230** | 2.253 |
| **Fine Giorno 2** | Lv. 5 | 32 | Ondata 20 (2° Boss) | 12 / 19 | **11.281** | 7.003 |
| **Fine Giorno 3** | Lv. 6 | 41 | Ondata 26 | 14 / 19 | **16.246** | 17.420 |
| **Fine Giorno 4** | Lv. 7 | 50 | Ondata 32 | 15 / 19 | **24.371** | 39.659 |
| **Fine Giorno 5** | Lv. 8 | 59 | Ondata 38 | 17 / 19 | **34.786** | 86.267 |
| **Fine Giorno 6** | Lv. 9 | 68 | Ondata 44 | 18 / 19 | **49.691** | 183.453 |
| **Fine Giorno 7** | **Lv. 10** | **77** | **Ondata 50 (Boss Finale)** | **18–19 / 19** | **73.480** | 379.976 |
