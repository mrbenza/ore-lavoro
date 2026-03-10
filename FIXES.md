# FIXES.md — Backlog interventi tecnici

> I fix qui sotto sono ordinati per priorità e pronti per essere implementati.

---

## ALTA SEVERITÀ

*(Nessun fix di alta severità in attesa)*

---

## MEDIA SEVERITÀ

---

### ANOMALIA-01 — `proxy.js` converte sempre tutto in GET verso GAS
**File:** `api/proxy.js` riga 52
**Problema:** Il proxy inoltra **sempre** le richieste a GAS come GET (anche le POST del frontend). Conseguenza: i dati di `saveWorkEntry` (ore, cantiere, sessionToken, data) finiscono in query string URL invece che nel body.
**Intervento (2 file):**
1. `api/proxy.js` — quando `req.method === 'POST'`, inoltrare POST a GAS con body `data=JSON.stringify(requestData)` in `application/x-www-form-urlencoded` (formato già supportato da `doPost` in `ApiRouter.gs` righe 386-389)
2. `ApiRouter.gs` — rimuovere il case `saveWorkEntry` da `doGet()` (riga 154-163), che diventa inutile e potenzialmente pericoloso

---

### FIX-01 — URL Google Apps Script hardcoded in `api/proxy.js`
**File:** `api/proxy.js` riga 17
**Problema:** L'URL dell'endpoint GAS è nel codice sorgente, dovrebbe stare in una variabile d'ambiente.
**Intervento:**
1. Aggiungere la variabile `GOOGLE_APPS_SCRIPT_URL` al file `.env` di Vercel
2. Modificare `api/proxy.js` riga 17:
```js
// Prima
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';

// Dopo
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
```

---

### ~~FIX-02 — Nomi fogli hardcoded in 10+ file invece delle costanti Config.gs~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Aggiunto `SHEET_NAMES` in `Config.gs`. Sostituite tutte le 10 occorrenze hardcoded in `AdminAPI.gs`, `ApiRouter.gs`, `Authentication.gs`, `CalcoloCantieri.gs`, `GestionePassword.gs`, `UserAPI.gs`.

---

### ~~ANOMALIA-03 — `updateUserPassword()` salva la password in chiaro nel foglio~~ ❌ FALSO POSITIVO
**Chiuso il 2026-03-10.**
Comportamento intenzionale: l'amministrazione deve poter conoscere la password reale degli utenti. Non ci sono dati sensibili nel sistema. Nessun intervento necessario.

---

### ~~FIX-03 — Funzioni duplicate tra `Config.gs` e `UtilsMenu.gs`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Eliminati da `UtilsMenu.gs`: `generatePasswordHash()`, `formatFileName()`, `getCurrentDateFormatted()`. Versioni canoniche mantenute in `Utils.gs` e `Config.gs`.

---

## BASSA SEVERITÀ

---

### FIX-04 — Funzioni test nei file di produzione
**Problema:** Funzioni di test manuali sono definite nei file di produzione invece di stare in file `test_*.gs` separati (dominio del Test Agent).

| File | Funzione |
|------|----------|
| `Authentication.gs` | `testRobustAuthentication()`, `diagnoseSheetStructure()` |
| `UserAPI.gs` | `testUserAPI()` |
| `Utils.gs` | `testUtils()` |
| `AdminAPI.gs` | `testDeleteWorkEntry()` |
| `ArchivioOre.gs` | `testSingleArchive()` |
| `ReportCommercialista.gs` | `testReportSystem()` |
| `Config.gs` | `testConfig()` |
| `SheetsDAO.gs` | `testSheetsDAO()` |

**Intervento:** Spostare ogni funzione nel file `Script/test_[modulo].gs` corrispondente.

---

### ~~FIX-05 — Risposte API non uniformi~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Rimossi `modalita` e `loadTime` dalle 3 response di `AdminAPI.gs`. Tutte le risposte di successo seguono ora il formato `{ success, message, data }`.

---

### ~~FIX-06 — Logging inconsistente (`console.log` vs `Logger`)~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Sostituite tutte le 11 chiamate `console.log/warn/error` in `Authentication.gs` con i metodi appropriati del logger centralizzato (`Logger.auth`, `Logger.debug`, `Logger.info`, `Logger.warn`, `Logger.error`).

---

### ~~FIX-07 — Nomi foglio hardcoded residui in `SheetsDAO.gs`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Trovate e corrette 3 occorrenze in `SheetsDAO.gs` (righe 23, 105, 157) nelle funzioni `updateCantiereHours()`, `getCantieri()`, `getAllCantieriForAdmin()`. Tutte sostituire con `SHEET_NAMES.CANTIERI`.

---

### ~~FIX-08 — `UtilsMenu.gs` contiene funzioni di utilita generica duplicate rispetto a `Utils.gs`~~ ❌ FALSO POSITIVO
**Chiuso il 2026-03-02.**
`UtilsMenu.gs` contiene le utility per il **menu del foglio Google** (dialogs, helper GSheet UI). `Utils.gs` contiene le utility per il **backend API**. I due file hanno contesti distinti e corretti.
Non esiste conflitto di naming reale: `getSheetSafe()` (UtilsMenu) e `getSheetSafely()` (Utils) sono funzioni con nomi diversi; `debugLog()` e `Logger` sono oggetti diversi. Le uniche funzioni effettivamente duplicate erano le 3 già rimosse con FIX-03.
