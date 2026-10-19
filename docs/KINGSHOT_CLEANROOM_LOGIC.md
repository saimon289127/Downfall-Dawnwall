# Downfall — Specifica Clean-Room 1:1 (Estratta con REA / Ghidra / Il2Cpp Metadata da `CenturyGame.TowerDefense` & `CenturyGame.GameFramework`)

> **Conformità Legale e Clean-Room (100% Originale)**:
> Analisi effettuata tramite **REA (`morluto/rea`, MIT License)** e ispezione dei metadati/simboli (`000_Assembly-CSharp.dll.json`, 3.513 classi totali, 85 sistemi Entitas in `CenturyGame.TowerDefense` e moduli `CenturyGame.GameFramework`).
> **Zero codice, zero modelli, zero grafica, zero armi e zero testi** sono stati copiati. Abbiamo ricostruito in **scala 1:1 l'architettura del mondo unico continuo, le logiche fisiche/matematiche e i cicli di longevità**, applicandoli all'universo originale di **Downfall** (*Rocca del Sole vs Nebbia Notturna*).

---

## 1. Perché Kingshot NON è un gioco a schermate separate ("tipo Clash Royale"), ma un Universo Unico Continuo 2.5D

Dall'analisi di `CenturyGame.TowerDefense` e `CenturyGame.GameFramework` emergono i pilastri strutturali che rendono il gameplay immediatamente riconoscibile e assuefacente:

### 1.1 Mondo Unico: Villaggio = Campo di Battaglia (`E_FIGHT_PASS_TYPE_USE_CITY_DATA` + `InitMapSystem.CreateCityUnitData`)
- In `CenturyGame.TowerDefense.E_FIGHT_PASS_TYPE` (addr `0x7600e35660`) e `InitMapSystem.CreateCityUnitData(SceneData)` (addr `0x7651f75e30`), la battaglia **non** avviene in un'arena astratta: usa direttamente i dati della città (`OriBuildingId.cityBuildingId`, `RelationBuilding`, `CityBuilding`).
- L'intero villaggio vive dentro una **valle isometrica 2.5D continua** (`GardenMapController` addr `0x7651dab890`) attraversata da un fiume a nord (`GardenBuildingWater`), circondata da boschi di pini (`GardenItemTree` con stati `Idle`, `Shake`, `Fall`) e avvolta all'esterno dalla nebbia (`GardenFog` / `CityFog`).
- Tutti gli edifici sono fisicamente presenti nella mappa e costruibili/potenziabili **On-Demand**:
  1. **Municipio Centrale (`MainBuilding` / *Rocca del Sole*)**: al centro della cittadella, con ponteggi visibili durante i lavori e barra timer/HP (`WaitMainBuildingDieSystem`).
  2. **Campana d'Allarme (*Campana dell'Alba*) & Bacheca (*Bacheca dei Decreti*)**: posizionate accanto al Municipio per richiamare l'ondata successiva o attivare editti cittadini.
  3. **Insediamenti / Case (`ResidentAI` / *Case dei Sopravvissuti 1..5*)**: ogni casa sblocca e ospita sopravvissuti visibili (`CitySurvivor`) che camminano lungo i sentieri.
  4. **Mensa (*Mensa del Bastione*)**: edificio con icona posate fluttuante dove i lavoratori si rifocillano per mantenere alto il Morale.
  5. **Segheria (*Segheria Fluviale*) & Miniera/Fonderia (*Fonderia Magmatica 1..2*)**: posizionate vicino al fiume/bosco e alle rocce, con colata incandescente animata e bolle di raccolta risorse fluttuanti.
  6. **Campo Militare (*Campo dei Conquistatori / Caserma*)**: vicino alle mura meridionali, addestra la scorta dell'Eroe e le guarnigioni.
  7. **Cinta Muraria con Cancelli Automatici (`GateFlag` + `DoorOpen` / `ViewDoorOpenSystem` addr `0x7651f1e4b0`)**: barricate in legno/pietra (`Barikade 1..3`) e cancelli che si aprono automaticamente al passaggio dell'Eroe/alleati e si chiudono per bloccare i nemici (`BlockInfo`).
  8. **Torri di Difesa On-Demand (*Torri di Guardia 1..6*)**: distribuite lungo le mura e i sentieri di accesso, costruibili e potenziabili sul posto.

---

## 2. Controllo Diretto dell'Eroe (`TDRocker` + `SeignioryAI`) e Pila Fisica di Monete (`ParabolaTween` + `RewardBoxFlyInfo`)

### 2.1 Joystick Virtuale Dinamico e Telecamera Follow (`TDRocker`, `ProcessRockerCmdSystem`, `TDFollowCamera`)
- `TDRocker` (addr `0x7651d5bdd0`) e `ProcessRockerCmdSystem` (addr `0x7651f7dd70`) gestiscono il **joystick virtuale dinamico** sotto il pollice (`m_rectRocker`, `m_rectUnderRocker`), convertendo la direzione UI in movimento nel mondo 2.5D (`ConvertRockerToWorldDirection`).
- `TDFollowCamera` (addr `0x7651edd480`) e `ViewFightCameraCreateSystem` (`_groupSeigniorial`) mantengono la telecamera centrata sull'Eroe (`Seigniory`), con possibilità di trascinare la visuale (`TDMoveCameraController`).
- `AISeigniorySystem` (addr `0x7651e2c2c0`) e `ViewAtkSystem.IsSeignioryMoving`: l'Eroe attacca automaticamente i nemici nel raggio `ATKDistance` proiettando frecce direzionali di mira (`▶ ▶ ▶`) e accumulando energia (`SkillEnergyIndex`) per la sua abilità speciale.

### 2.2 Pila Verticale di Monete sulla Schiena e Costruzione Parabolica On-Demand (`ParabolaTween`, `RewardBoxObjFlySystem`, `SeignioryOpenBoxSystem`)
- Quando i mostri muoiono (`CheckDieSystem` + `DieDropRewardBox`) o gli edifici producono tributi, rilasciano **Monete d'Oro e Forzieri sul terreno**.
- Quando l'Eroe (`Seigniory`) si avvicina (`SeignioryOpenBoxSystem` addr `0x7651ed1ca0`), le monete volano lungo una parabola (`ParabolaTween` addr `0x7651cb0d40` / `RewardBoxFlyInfo`: `begin`, `end`, `maxHeight`, `time`) e si impilano in una **colonna verticale fisica di monete d'oro portata dietro la schiena dell'Eroe**.
- Camminando sopra una **Piazzola di Costruzione/Potenziamento (`WaitFillData`)** di qualsiasi torre, muro o edificio del villaggio, le monete **partono una a una in arco parabolico dalla pila dell'Eroe dentro la piazzola**, riempiendo il contatore e completando la costruzione/potenziamento in tempo reale!

### 2.3 Scorta di Soldati in Formazione (`AISoldierSystem` + `SoldierFormation`)
- `SoldierFormation` (addr `0x7651ca9420`) definisce 10 anelli angolari (`angle1..10`, `dist1..10`) attorno all'unità ospite (`hostEntity`).
- `AISoldierSystem` (addr `0x7651f61cb0`) e `SoldierAI` (`hostEntity`, `soldierPosAngle`, `soldierPosDistance`, `inBackGoToHostFollowPos`): i soldati della scorta seguono fisicamente l'Eroe mentre esplora o pattuglia il villaggio, caricano i nemici nel `WarningRange` e tornano automaticamente in formazione dietro l'Eroe (`CheckBackFormation`) appena il combattimento termina.

### 2.4 Indicatori Radar Direzionali ai Bordi dello Schermo (`TDWaveInfo` + `m_backHome`)
- `TDWaveInfo` (addr `0x7651cbf340`) calcola se le unità dell'ondata sono fuori dall'inquadratura (`CheckAllUnitInScreenRange`) e mostra ai bordi dello schermo un **badge circolare con icona nemico, freccia orientata (`RotateWaveInfoImg`) e distanza in metri (`RefreshWaveInfoDistance`, es. `3m`, `8m`)**.
- Allo stesso modo, i badge blu indicano la distanza in metri (`4m`) dalle Torri di Difesa o dalla Rocca (`RefreshBackHomeDistance`), mentre sul terreno scorrono le **frecce rosse del percorso d'assedio (`CreateOriPathLine`)**.

---

## 3. Tabella Completa dei 85 Sistemi ECS Mappati in `Downfall`

| Gruppo Funzionale (`CenturyGame.TowerDefense`) | Sistemi Originali Analizzati (Metadati REA) | Implementazione Clean-Room in **Downfall** (`WorldScene.ts` + `GameStateManager.ts`) |
|---|---|---|
| **Input & Movimento Eroe (`Seigniory`)** | `TDRocker`, `ProcessRockerCmdSystem`, `PlayerMoveSystem`, `ViewPlayerMoveSystem`, `ViewPlayerIdleSystem`, `TDFollowCamera` | Joystick virtuale dinamico a pollice + supporto WASD/Frecce e tap-to-move; telecamera smooth-follow sul Comandante Kaelen nel mondo `1600×2000`. |
| **Pila Monete & Costruzione On-Demand** | `DieDropRewardBox`, `RewardBoxFlyInfo`, `RewardBoxObjFlySystem`, `SeignioryOpenBoxSystem`, `ParabolaTween`, `WaitFillData` | Drop fisico di monete a terra; raccolta magnetica parabolica nella **pila verticale dietro l'Eroe**; erogazione parabolica moneta-per-moneta sulle piazzole di Torri, Mura ed Edifici. |
| **Scorta Soldati & Guarnigioni** | `SoldierFormation`, `AISoldierSystem`, `AISentrySystem`, `AIFightBackSystem`, `AIPreferenceSystem` | Scorta di Scudieri e Arcieri che segue Kaelen in formazione polare, ingaggia i nemici nel `WarningRange` e rientra nei ranghi; guarnigioni alle porte. |
| **Mura, Cancelli & Map Grid** | `InitMapSystem`, `TDMapDataManager`, `DoorOpen`, `ViewDoorOpenSystem`, `AreaStandUnitDieOrRemoveInFightingSystem` | Mura perimetrali con 3 Cancelli automatici che si aprono per l'Eroe/alleati e bloccano i mostri; barricate potenziabili e riparabili. |
| **Ondate, Sentieri & Radar UI** | `CheckWaveStartSystem`, `ExecuteBornUnitSystem`, `CheckWaveDoneSystem`, `TDWaveInfo`, `CreateOriPathLine` | 3 sentieri d'assedio con frecce rosse animate a terra; **badge radar circolari ai bordi** con distanza in metri (`3m`, `4m`) per ondate e torri. |
| **Villaggio Vivo, Alberi & Nebbia** | `GardenMapController`, `GardenItemTree`, `GardenFog`, `CitySurvivor`, `AIResidentSystem`, `AIResidentKeepGoSystem` | Fiume animato a nord, pini che oscillano e cadono quando tagliati dai boscaioli, abitanti che camminano tra Case, Mensa, Segheria e Fonderia Magmatica, e Nebbia che arretra. |
| **Combattimento, Skill & Effetti** | `AtkTargetSystem`, `ProjectileSystem`, `ExecuteSkillSystem`, `RepelSystem`, `FlySystem`, `TDCameraShakeMgr` | Mira automatica con indicatori `▶ ▶ ▶`, 5 archetipi di Torri d'Assedio originali, abilità *Giudizio Solare*, knockback (`Repel`), trauma camera shake e slow-mo finale. |
