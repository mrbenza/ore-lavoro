# FIXES.md — Backlog interventi tecnici

> I fix qui sotto sono ordinati per priorità e pronti per essere implementati.

---

## ALTA SEVERITÀ

---

### ~~FIX-09 — XSS in `admin.html`: innerHTML con dati server non escapati~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Aggiunta `Utils.escapeHtml()` in `config.js`. Applicata in 5 punti di `admin.html`: `renderCantieri()`, `showDayDetails()`, `showDeleteConfirmation()`, `loadAllCantieriForEdit()`, `loadDipendenti()`.

---

### ~~FIX-10 — XSS in `dashboard.html`: innerHTML con dati server non escapati~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Applicata `Utils.escapeHtml()` in `showDayDetails()` di `dashboard.html` su `entry.cantiere`, `entry.ore`, `entry.note`.

---

### ~~FIX-11 — Password `.trim()` prima dell'invio in `index.html`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Rimosso `.trim()` dal campo password in `index.html`. Trim mantenuto solo sullo username.

---

### ~~FIX-12 — `console.log` con dati sensibili in produzione~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Sostituiti 30 `console.*` totali con `ProductionLogger` in `index.html` (9), `admin.html` (16), `dashboard.html` (5), `config.js` (9 nelle utility). Rimosso `window.getAdminState` da `admin.html`.

---

## MEDIA SEVERITÀ

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

### ~~FIX-03 — Funzioni duplicate tra `Config.gs` e `UtilsMenu.gs`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Eliminati da `UtilsMenu.gs`: `generatePasswordHash()`, `formatFileName()`, `getCurrentDateFormatted()`. Versioni canoniche mantenute in `Utils.gs` e `Config.gs`.

---

### ~~FIX-13 — Modal senza attributi ARIA e senza focus trap~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Aggiunti `role="dialog"`, `aria-modal="true"`, `aria-labelledby` a `#dayDetailsPopup` (entrambe le pagine) e `#deleteConfirmModal` (admin). Implementata utility `createFocusTrap()` in entrambi i file: focus trap attivo all'apertura, Escape per chiudere, ripristino del focus all'elemento originale alla chiusura.

---

### ~~FIX-14 — Elementi interattivi implementati come `<div>` non accessibili da tastiera~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
`dashboard.html`: `.footer-item` ricevono `role="button"`, `tabindex="0"`, `aria-label`, `aria-current="page"` e handler keydown Enter/Space. `admin.html`: `.toggle-option` ricevono `role="button"`, `tabindex="0"`, `aria-pressed` dinamico e handler keydown Enter/Space.

---

### FIX-15 — `sessionToken` inviato come query param GET
**File:** `config.js` (funzione `Utils.callAPI()`)
**Problema:** Il token di sessione viene appeso all'URL come query param. Viene registrato nei log del proxy Vercel, salvato nella history del browser e potenzialmente esposto nell'header `Referer`.
**Intervento:** Valutare passaggio a POST con body JSON per tutte le chiamate autenticate, o almeno spostare il token in un header HTTP custom.

---

### ~~FIX-16 — Bug campo `workDay.ore` in `admin.html`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Bug puntuale: `admin.html` riga 542 leggeva `workDay.ore` (inesistente) invece di `workDay.totalOre` (campo corretto restituito da `getOtherUserMonthlyData`). Le ore non apparivano mai nelle celle del calendario admin. Le due API hanno strutture intenzionalmente diverse — nessuna modifica backend necessaria.

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
