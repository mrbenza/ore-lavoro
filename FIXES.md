# FIXES.md - Bug, anomalie e decisioni tecniche

Questo file raccoglie bug scoperti, fix risolti e anomalie accettate.

Per lo storico completo delle modifiche usare `Changelog.log`.
Per milestone e roadmap usare `MILESTONES.md`.

---

## Fix aperti

### Alta severita

Nessun fix aperto di alta severita.

### Media severita

Nessun fix aperto di media severita.

### Bassa severita

Nessun fix aperto di bassa severita.

---

## Fix risolti

### BUG-13 - Creazione admin generava un foglio personale inutile

**Risolto:** 2026-05-04  
**File:** `Script/GestioneUtenti.gs`

`creaUtenteCore()` creava sempre un foglio personale, anche per ruoli admin. Ora salta la creazione del foglio per `Admin` e `Administrator`, lasciandola attiva per i dipendenti.

### BUG-12 - Contatore inserimenti cantieri cresceva anche su cancellazione/modifica

**Risolto:** 2026-05-04  
**File:** `Script/SheetsDAO.gs`

`updateCantiereHours()` incrementava sempre `N. Inserimenti`, anche con ore negative o differenze di modifica. Ora usa un delta contatore: +1 su inserimento, -1 su cancellazione, 0 sulle modifiche che non cambiano il numero reale di righe ore.

### BUG-11 - Proxy loggava password, token e payload sensibili

**Risolto:** 2026-05-04  
**File:** `api/proxy.js`

Il flusso resta GET verso Google Apps Script per compatibilita con il deploy GAS, ma il proxy maschera nei log `password`, `nuovaPassword`, `vecchiaPassword`, `sessionToken`, `workData`, `updateData`, `datiJSON` e la response con `sessionToken`.

### BUG-10 - Modifica admin multi-entry aggiornata sulla riga sbagliata

**Risolto:** 2026-05-04  
**File:** `admin.html`, `Script/AdminAPI.gs`

Quando una giornata aveva piu registrazioni, il frontend conservava `selectedEntryIndex` ma non lo inviava al backend. `updateWorkEntry()` cercava solo la prima riga con quella data. Ora il frontend invia `rowIndex` e `entryIndex`; il backend usa `rowIndex` come identificatore primario e verifica che appartenga alla data richiesta.

### BUG-09 - Username con underscore rompeva l'estrazione userId dal token

**Risolto:** 2026-03-30

`sessionToken.split('_')[0]` troncava username con underscore. Corretto usando `parts.slice(0, parts.length - 2).join('_')`.

### BUG-07 - `deleteWorkEntry` poteva cancellare righe header con formule SUMIFS

**Risolto:** 2026-03-30

Il ciclo in `AdminAPI.gs` partiva dalla riga sbagliata. Corretto per iniziare dalle righe dati effettive.

### BUG-05 - `getOtherUserMonthlyData` crashava se il foglio non esisteva

**Risolto:** 2026-03-30

Aggiunto null guard esplicito prima di usare il foglio dipendente.

### BUG-04 - Ruolo `Administrator` rifiutato in funzioni admin

**Risolto:** 2026-03-30

Sostituiti confronti manuali con `ADMIN_VALIDATION.isAdminRole()`.

### BUG-01 - `validateAdmin` usava indici fissi di colonna

**Risolto:** 2026-03-30

Sostituito accesso hardcoded con `buildColumnMap()` e accesso per nome colonna.

### FIX-07 - Nomi foglio hardcoded residui in `SheetsDAO.gs`

**Risolto:** 2026-03-02

Sostituite le occorrenze residue con `SHEET_NAMES.CANTIERI`.

### FIX-06 - Logging inconsistente in `Authentication.gs`

**Risolto:** 2026-03-02

Sostituiti `console.log/warn/error` con il logger centralizzato.

### FIX-05 - Risposte API non uniformi

**Risolto:** 2026-03-02

Uniformate le risposte principali al formato `{ success, message, data }`.

### FIX-03 - Funzioni duplicate tra `Config.gs` e `UtilsMenu.gs`

**Risolto:** 2026-03-02

Rimosse duplicazioni e mantenute versioni canoniche.

### FIX-02 - Nomi fogli hardcoded

**Risolto:** 2026-03-02

Aggiunto `SHEET_NAMES` in `Config.gs` e sostituite le occorrenze principali.

---

## Anomalie e decisioni tecniche

### ANOMALIA-01 - Proxy verso Apps Script in GET

**Stato:** accettata

Google Apps Script con web app e redirect puo perdere il body POST. Il proxy continua quindi a inoltrare verso GAS come GET. Il rischio e' mitigato mascherando i log applicativi del proxy.

### ANOMALIA-02 - Password in chiaro nel foglio `Utenti`

**Stato:** accettata temporaneamente

Il sistema mantiene sia `Password` sia `Password Hash`. Operativamente era richiesto che l'amministrazione potesse conoscere o impostare la password reale. Da rivalutare in roadmap se si decide di passare a gestione solo hash/reset password.

### ANOMALIA-03 - Dead code documentato

**Stato:** accettata

Sono presenti funzioni marcate come dead code o duplicate storiche. Non sono state rimosse tutte per evitare regressioni non necessarie. La pulizia e' in roadmap a bassa priorita.
