# FIXES.md — Backlog interventi tecnici

> I fix qui sotto sono ordinati per priorità e pronti per essere implementati.

---

## ALTA SEVERITÀ

*(Nessun fix di alta severità in attesa)*

---

## MEDIA SEVERITÀ

---

### ~~ANOMALIA-01 — `proxy.js` converte sempre tutto in GET verso GAS~~ ❌ NON RISOLVIBILE LATO PROXY
**Chiuso il 2026-03-10.**
GAS converte i POST in GET durante il redirect OAuth, perdendo il body. Testato: `doPost` riceve `e.postData` vuoto → `action = undefined`. Il GET è l'unico metodo affidabile con GAS deployato come web app. Comportamento accettato.

---

### ANOMALIA-01b — Dati sensibili (sessionToken) in query string URL
**File:** `api/proxy.js`
**Problema:** Il proxy inoltra sempre le richieste a GAS come GET. I dati di `saveWorkEntry` (sessionToken, ore, cantiere, data) finiscono nell'URL e sono visibili nei log di server/rete/browser.
**Rischio reale:** basso — sistema interno, pochi utenti, nessuna esposizione pubblica. Non è una falla critica.
**Decisione (2026-03-30):** ❌ Non si interviene. Rischio accettato consapevolmente per il contesto d'uso.

---

### ~~FIX-01 — URL Google Apps Script hardcoded in `api/proxy.js`~~ ❌ FALSO POSITIVO
**Chiuso il 2026-03-19.**
`proxy.js` usa già `process.env.GOOGLE_APPS_SCRIPT_URL` (riga 31) con check esplicito e HTTP 500 se mancante. Banner documentativo in cima al file. Nessun intervento necessario.

---

### ~~FIX-02 — Nomi fogli hardcoded in 10+ file invece delle costanti Config.gs~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Aggiunto `SHEET_NAMES` in `Config.gs`. Sostituite tutte le 10 occorrenze hardcoded in `AdminAPI.gs`, `ApiRouter.gs`, `Authentication.gs`, `CalcoloCantieri.gs`, `GestionePassword.gs`, `UserAPI.gs`.

---

### ~~ANOMALIA-02 — `logAdminAction()` mai chiamata~~ ❌ FALSO POSITIVO
**Chiuso il 2026-03-10.**
Il tracciamento admin è già gestito inline: `updateWorkEntry()` scrive `"** Modificato da amministrazione (admin - data)"` nella colonna Note del foglio utente. `logAdminAction()` è dead code — rimossa.

---

### ~~ANOMALIA-03 — `updateUserPassword()` salva la password in chiaro nel foglio~~ ❌ FALSO POSITIVO
**Chiuso il 2026-03-10.**
Comportamento intenzionale: l'amministrazione deve poter conoscere la password reale degli utenti. Non ci sono dati sensibili nel sistema. Nessun intervento necessario.

---

### ~~FIX-03 — Funzioni duplicate tra `Config.gs` e `UtilsMenu.gs`~~ ✅ RISOLTO
**Risolto il 2026-03-02.**
Eliminati da `UtilsMenu.gs`: `generatePasswordHash()`, `formatFileName()`, `getCurrentDateFormatted()`. Versioni canoniche mantenute in `Utils.gs` e `Config.gs`.

---

## ALTA SEVERITÀ

### ~~BUG-07 — `deleteWorkEntry` poteva cancellare righe header con formule SUMIFS~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
Il ciclo in `AdminAPI.gs` partiva da `i=1` (riga 2) invece che `i=4` (riga 5). Le righe 2-4 contengono formule SUMIFS. Corretto a `i=4`.

### ~~BUG-09 — Username con underscore rompeva l'estrazione userId dal token~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
`sessionToken.split('_')[0]` troncava username con underscore (es. `mario_rossi` → `mario`). Corretto in 11 occorrenze su 7 file con `parts.slice(0, parts.length - 2).join('_')`.

### ~~BUG-04 — Ruolo "Administrator" rifiutato in 5 funzioni admin~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
`toLowerCase() === 'admin'` non includeva `'administrator'`. Sostituito con `ADMIN_VALIDATION.isAdminRole()` in `getOtherUserMonthlyData`, `updateWorkEntry`, `deleteWorkEntry`, `updateCantiereStato`, `cambiaPasswordDipendente` + bonus fix in `SheetsDAO.gs`.

### ~~BUG-05 — `getOtherUserMonthlyData` crashava con TypeError se il foglio non esisteva~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
`getSheetByName()` ritorna `null` (non lancia eccezione). Aggiunto null guard esplicito prima di qualsiasi chiamata sul foglio.

### ~~BUG-01 — `validateAdmin` usava indici fissi di colonna~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
`validateAdmin` in `Authentication.gs` usava `row[6]`, `row[5]`, `row[9]` hardcoded. Sostituito con `buildColumnMap()` + accesso per nome colonna + `ADMIN_VALIDATION.isAdminRole()`.

---

## BASSA SEVERITÀ

---

### ~~FIX-04 — Funzioni test nei file di produzione~~ ✅ RISOLTO
**Risolto il 2026-03-30.**
Le funzioni di test erano già state consolidate in `Tests.gs`. Splittate in 9 file `test_*.gs` per modulo (`test_authentication.gs`, `test_userapi.gs`, `test_utils.gs`, `test_adminapi.gs`, `test_archivioore.gs`, `test_reportcommercialista.gs`, `test_config.gs`, `test_sheetsDAO.gs`, `test_apirouter.gs`). `Tests.gs` ridotto a solo header/indice. Nessun file di produzione modificato.

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
