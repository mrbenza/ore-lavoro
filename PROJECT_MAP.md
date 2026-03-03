# PROJECT_MAP.md — Gestione Ore Lavoro

**Data ultima modifica:** 2026-03-03
**Versione:** 1.0
**Autore:** Docs Agent

---

## 1. Architettura Generale

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (index.html / dashboard.html / admin.html)         │
│  config.js → Utils.callAPI(params)                          │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS GET /api/proxy?action=...
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  VERCEL (Node.js Serverless)                                │
│  api/proxy.js  — gestisce CORS, forwarda a GAS              │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS GET → GAS Web App URL
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT                                         │
│  ApiRouter.gs → doGet(e) / doPost(e)                        │
│  routing su parametro "action"                              │
│  ├── Authentication.gs                                      │
│  ├── UserAPI.gs                                             │
│  ├── AdminAPI.gs                                            │
│  └── SheetsDAO.gs                                           │
└───────────────────┬─────────────────────────────────────────┘
                    │ SpreadsheetApp API
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  GOOGLE SHEETS (container-bound)                            │
│  Fogli: Utenti | <NomeDipendente> | Cantieri | Admin Log    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mappa API

Tutte le routes passano attraverso `api/proxy.js` → `ApiRouter.gs` (doGet / doPost).

| action | Funzione GAS | File GAS | Note |
|--------|-------------|----------|------|
| `ping` | `handlePing()` | ApiRouter.gs | Health check, nessun token richiesto |
| `authenticate` | `authenticateUser(userId, password)` | Authentication.gs | Genera sessionToken |
| `saveWorkEntry` | `saveWorkEntry(sessionToken, workData)` | UserAPI.gs | Salva riga ore dipendente |
| `getCantieri` | `getCantieri(sessionToken)` | SheetsDAO.gs | Lista cantieri Aperto |
| `getUserInfo` | `getUserInfo(sessionToken)` | SheetsDAO.gs | Ore utente corrente |
| `getMonthlyWorkData` | `getMonthlyWorkData(sessionToken, year, month)` | UserAPI.gs | Dati calendario mensile |
| `validateAdmin` | `validateAdmin(sessionToken, userId)` | Authentication.gs | Verifica ruolo Admin |
| `getCantieriOverview` | `getCantieriAdminOverview(sessionToken, modalita)` | AdminAPI.gs | Overview cantieri (con cache) |
| `getDipendentiList` | `getDipendentiListAdmin(sessionToken)` | AdminAPI.gs | Lista dipendenti + totali ore |
| `getDipendenteTimeline` | `getDipendenteTimelineAdmin(sessionToken, userId, timeframe)` | AdminAPI.gs | Timeline ore singolo dipendente |
| `getOtherUserInfo` | `getOtherUserInfo(sessionToken, targetUserId)` | SheetsDAO.gs | Ore di altro utente (solo admin) |
| `getOtherUserMonthlyData` | `getOtherUserMonthlyData(sessionToken, targetUserId, year, month)` | AdminAPI.gs | Dati mensili per admin |
| `getAllCantieriForAdmin` | `getAllCantieriForAdmin(sessionToken)` | SheetsDAO.gs | Tutti i cantieri (anche chiusi) |
| `updateWorkEntry` | `updateWorkEntry(sessionToken, targetUserId, dateStr, updateData)` | AdminAPI.gs | Modifica riga esistente |
| `deleteWorkEntry` | `deleteWorkEntry(sessionToken, targetUserId, dateStr, entryIndex)` | AdminAPI.gs | Elimina riga ore |
| `invalidateCache` | `invalidateAdminCache(sessionToken, cacheType)` | AdminAPI.gs | Svuota cache admin |

---

## 3. Flussi Principali

### 3.1 Login (authenticate)

```
[index.html]
    │
    ├─ User compila userId + password
    ├─ authenticateUser(userId, password) → Utils.callAPI({action:'authenticate'})
    │
    ▼
[api/proxy.js]  →  [Authentication.gs: authenticateUser()]
    │
    ├─ Legge foglio Utenti (riga utente)
    ├─ verifyUserPassword() — SHA-256 hash o plain text
    ├─ getUserHoursFromSheet(userName) — legge F2/G2/H2 (SUMIFS)
    │     fallback: calcolo diretto righe 5+
    ├─ generateSessionToken(userId) — formato: userId_timestamp_random
    └─ Ritorna { token, userName, role, ore }
    │
[index.html]
    ├─ setSession(token, userName, role, ore)  ← sessionStorage
    └─ redirect → dashboard.html (o admin.html se admin)
```

### 3.2 Dashboard Dipendente — Caricamento

```
[dashboard.html: initializeApp()]
    │
    ├─► loadUserData()          — mostra nome da sessione, "..." per ore
    │
    ├─► loadCantieri()          ──► callAPI getCantieri
    │       └─ [SheetsDAO.gs: getCantieri()]
    │               └─ lista cantieri con stato "Aperto"
    │               └─ popola <select> cantieri in form
    │
    ├─► refreshUserStats()      ──► callAPI getUserInfo
    │       └─ [SheetsDAO.gs: getUserInfo()]
    │               └─ ore utente via getUserHoursFromSheet
    │               └─ aggiorna contatori ore nella UI
    │
    └─► loadCalendarData()      ──► callAPI getMonthlyWorkData
            └─ [UserAPI.gs: getMonthlyWorkData()]
                    └─ righe 5+ del foglio dipendente filtrate per mese
                    └─ raggruppa per giorno
                    └─ renderCalendar() → createDayElement()
```

### 3.3 Salvataggio Ore (saveWorkEntry)

```
[dashboard.html: saveWorkEntry()]
    │
    ├─ Valida form (data, ore, cantiere)
    ├─ callAPI({ action:'saveWorkEntry', sessionToken, workData })
    │
    ▼
[api/proxy.js]  →  [UserAPI.gs: saveWorkEntry()]
    │
    ├─ validateSessionToken(sessionToken)  — formato + scadenza 24h
    ├─ decodeSessionToken() → userId
    ├─ Scrive riga in foglio <NomeDipendente> (riga 5+)
    └─ updateCantiereHours(cantiereId, oreAggiunte, dipendente)
            └─ [SheetsDAO.gs: updateCantiereHours()]
                    └─ aggiorna col G/H/I/J foglio Cantieri
    │
[dashboard.html]
    └─ refreshUserStats()  — aggiorna ore totali visualizzate
```

### 3.4 Dashboard Admin — Caricamento

```
[admin.html: loadInitialData()]
    │
    ├─► loadCantieri()          ──► callAPI getCantieriOverview(modalita)
    │       └─ [AdminAPI.gs: getCantieriAdminOverview()]
    │               └─ cache CacheService
    │               └─ calcola ore mese o totali per cantiere
    │
    └─► loadDipendenti()        ──► callAPI getDipendentiList
            └─ [AdminAPI.gs: getDipendentiListAdmin()]
                    └─ lista dipendenti + totali ore
    │
    (selezione dipendente)
    │
    ├─► loadCalendarData()      ──► callAPI getOtherUserMonthlyData
    │       └─ [AdminAPI.gs: getOtherUserMonthlyData()]
    │
    └─► loadTotaliOre()         ──► callAPI getOtherUserInfo
            └─ [SheetsDAO.gs: getOtherUserInfo()]
                    └─ verifica ruolo admin prima di procedere
```

---

## 4. Mappa Funzioni Backend (per file GAS)

### ApiRouter.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `doGet(e)` | event object GAS | Entry point HTTP GET, routing su `e.parameter.action` | Vercel proxy |
| `doPost(e)` | event object GAS | Entry point HTTP POST, stessa logica di doGet | Vercel proxy |
| `handlePing()` | — | Risponde con status "ok", health check | doGet/doPost |

### Authentication.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `authenticateUser` | `userId, password` | Login completo: verifica credenziali, genera token, carica ore | ApiRouter |
| `verifyUserPassword` | `userRow, password, columnMap` | Verifica hash SHA-256 o plain text | authenticateUser |
| `getUserHoursFromSheet` | `userName` | Legge ore da F2/G2/H2 (SUMIFS); fallback calcolo righe 5+ | authenticateUser, getUserInfo |
| `validateAdmin` | `sessionToken, userId` | Verifica che l'utente abbia ruolo Admin/Administrator | ApiRouter |
| `testRobustAuthentication` | — | Funzione di test | Menu / test |
| `diagnoseSheetStructure` | — | Diagnostica struttura foglio Utenti | Menu / debug |

### Utils.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `handleError` | `context, error` | Crea risposta errore JSON standard | Tutti i moduli |
| `getSheetSafely` | `ss, name` | Restituisce foglio senza lanciare eccezione | Tutti i moduli |
| `getWorksheet` | — | Trova foglio Utenti per nome o per contenuto | Auth, SheetsDAO |
| `getColumnValues` | `sheet, colOneBased` | Legge colonna intera come array flat | SheetsDAO, UserAPI |
| `indexOfValue` | `colValues, value` | Ricerca con confronto `===` | SheetsDAO, UserAPI |
| `parseDateFlexible` | `input` | Parse date DD/MM/YYYY o ISO | UserAPI, AdminAPI |
| `validateHours` | `ore` | Valida range 0-24 | UserAPI |
| `generatePasswordHash` | `password` | Hash SHA-256 | GestionePassword |
| `createCORSResponse` | `data` | Wrappa risposta JSON con headers CORS | ApiRouter |
| `generateSessionToken` | `userId` | Formato: `userId_timestamp_random` | Authentication |
| `validateSessionToken` | `sessionToken` | Verifica formato e scadenza 24h | Tutti gli endpoint |
| `decodeSessionToken` | `sessionToken` | Estrae userId dal token | UserAPI, SheetsDAO, AdminAPI |
| `buildColumnMap` | `headers` | Mappa dinamica nome colonna → indice (1-based) | SheetsDAO, UserAPI |

### SheetsDAO.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `updateCantiereHours` | `cantiereId, oreAggiunte, dipendente` | Aggiorna col G/H/I/J foglio Cantieri | UserAPI.saveWorkEntry |
| `getCantieri` | `sessionToken` | Lista cantieri con stato "Aperto" | ApiRouter |
| `getAllCantieriForAdmin` | `sessionToken` | Tutti i cantieri (anche chiusi), solo admin | ApiRouter |
| `getUserInfo` | `sessionToken` | Ore utente corrente via mapping dinamico | ApiRouter |
| `getOtherUserInfo` | `sessionToken, targetUserId` | Ore di un altro utente, solo admin | ApiRouter |
| `getUserNameFromUserId` | `userId` | Risolve userId → nome display | Auth, AdminAPI |
| `checkIfUserHasSheet` | `userName` | Verifica esistenza foglio personale dipendente | UserAPI |

### UserAPI.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `saveWorkEntry` | `sessionToken, workData` | Scrive riga nel foglio dipendente (riga 5+), aggiorna cantiere | ApiRouter |
| `getMonthlyWorkData` | `sessionToken, year, month` | Righe 5+ filtrate per mese, raggruppate per giorno | ApiRouter |

### AdminAPI.gs

| Funzione | Parametri | Descrizione | Chiamato da |
|----------|-----------|-------------|-------------|
| `getCantieriAdminOverview` | `sessionToken, modalita` | Overview cantieri con cache; modalita: "mese" o "totali" | ApiRouter |
| `calcolaOreMeseCorrenteOttimizzato` | `spreadsheet` | Calcola ore mese per tutti i dipendenti iterando fogli | getCantieriAdminOverview |
| `getDipendentiListAdmin` | `sessionToken` | Lista dipendenti con totali ore, solo admin | ApiRouter |
| `getDipendenteTimelineAdmin` | `sessionToken, userId, timeframe` | Timeline ore dipendente per intervallo temporale | ApiRouter |
| `getOtherUserMonthlyData` | `sessionToken, targetUserId, year, month` | Dati mensili dipendente per vista admin | ApiRouter |
| `updateWorkEntry` | `sessionToken, targetUserId, dateStr, updateData` | Modifica riga esistente nel foglio dipendente | ApiRouter |
| `deleteWorkEntry` | `sessionToken, targetUserId, dateStr, entryIndex` | Elimina riga ore nel foglio dipendente | ApiRouter |
| `invalidateAdminCache` | `sessionToken, cacheType` | Svuota cache CacheService per tipo | ApiRouter |
| `logAdminAction` | `adminUserName, action, details` | Scrive log su foglio Amministrazione | updateWorkEntry, deleteWorkEntry |

### Config.gs

| Elemento | Tipo | Descrizione |
|----------|------|-------------|
| `CONFIG` | costante | Configurazione generale sistema |
| `SHEET_NAMES` | costante | Nomi fogli Google Sheets |
| `COLUMNS` | costante | Indici colonne foglio Utenti/dipendente |
| `COLUMNS_CANTIERI` | costante | Indici colonne foglio Cantieri |
| `USER_SHEET_CELLS` | costante | Riferimenti celle ore (F2/G2/H2) |
| `SYSTEM_INFO` | costante | Info versione sistema |
| `USER_ROLES` | costante | Ruoli: Admin, Administrator, Dipendente |
| `ADMIN_CONFIG` | costante | Soglie e limiti pannello admin |
| `CACHE_CONFIG` | costante | TTL e chiavi cache |
| `getMainSpreadsheet()` | helper | Restituisce spreadsheet principale |
| `isSystemSheet()` | helper | True se il foglio e' un foglio di sistema |
| `isValidYear()` | helper | Valida anno numerico |
| `getMonthName()` | helper | Nome mese da numero |
| `validateConfiguration()` | helper | Verifica consistenza configurazione |
| `initializeSystem()` | helper | Inizializzazione sistema alla prima apertura |

### File menu GAS (NON esposti via API)

| File | Funzioni principali | Scopo |
|------|-------------------|-------|
| `Main.gs` | `onOpen()`, wrapper vari | Menu Google Sheets: archivio, password, report, diagnostica |
| `GestionePassword.gs` | `executeChangeEmployeePassword()`, `getUsersList()`, `updateUserPassword()` | Cambio password dipendenti da menu |
| `ArchivioOre.gs` | `performEmployeeArchive(employeeName, year)` | Copia foglio + esporta Excel/PDF su Drive |
| `CalcoloCantieri.gs` | `performConstructionSitesRecalculation()` | Ricalcola totali ore per tutti i cantieri |
| `ReportCommercialista.gs` | `generateMonthlyReportComplete()`, `generateAnnualReport()` | Genera report PDF/Excel su Drive |
| `SystemDiagnostic.gs` | `checkSystemHealth()`, `performSystemDiagnostics()` | Diagnostica sistema |
| `UtilsMenu.gs` | utility varie | Supporto moduli menu: date, file Drive, dialog, calcoli |

---

## 5. Mappa Funzioni Frontend (per pagina)

### index.html

| Funzione | Trigger | API usata |
|----------|---------|-----------|
| `authenticateUser(userId, password)` | Submit form login | `authenticate` |
| `validateField()` | Input change | — |
| `clearValidation()` | Input focus | — |
| `showError()` | Errore login | — |
| `showSuccess()` | Login ok | — |
| `showSecurityInfo()` | Click info | — |
| `hideAllMessages()` | Interazione form | — |
| `setupFormValidation()` | DOMContentLoaded | — |
| `showNotification()` | Vari eventi | — |

### dashboard.html

| Funzione | Trigger | API usata |
|----------|---------|-----------|
| `initializeApp()` | DOMContentLoaded | — (chiama le seguenti) |
| `loadUserData()` | initializeApp | sessione locale |
| `refreshUserStats()` | initializeApp, post-save | `getUserInfo` |
| `loadCantieri()` | initializeApp | `getCantieri` |
| `saveWorkEntry()` | Submit form | `saveWorkEntry` |
| `loadCalendarData()` | initializeApp, navigazione mese | `getMonthlyWorkData` |
| `renderCalendar()` | loadCalendarData | — |
| `createDayElement()` | renderCalendar | — |
| `showDayDetails()` | Click giorno calendario | — |
| `closeDayDetails()` | Click chiudi | — |
| `setupForm()` | DOMContentLoaded | — |
| `validateHoursField()` | Input change | — |
| `setupNavigation()` | DOMContentLoaded | — |
| `navigateToPage()` | Click nav | — |
| `setupCalendar()` | DOMContentLoaded | — |
| `setupScrollEffect()` | DOMContentLoaded | — |
| `startAutoRefresh()` | initializeApp | `getUserInfo` (ogni 5 min) |
| `cacheElements()` | DOMContentLoaded | — |
| `checkDependencies()` | DOMContentLoaded | — |
| `debounce()` | utility | — |
| `showNotification()` | Vari eventi | — |
| `logout()` | Click logout | — (clearSession) |

### admin.html

| Funzione | Trigger | API usata |
|----------|---------|-----------|
| `loadInitialData()` | DOMContentLoaded | — (chiama le seguenti) |
| `loadCantieri()` | loadInitialData, refresh | `getCantieriOverview` |
| `loadDipendenti()` | loadInitialData | `getDipendentiList` |
| `loadCalendarData()` | Selezione dipendente, cambio mese | `getOtherUserMonthlyData` |
| `loadTotaliOre()` | Selezione dipendente | `getOtherUserInfo` |
| `refreshCantieri()` | Click refresh, cambio modalita | `getCantieriOverview` |
| `confirmDelete(entryIndex)` | Click elimina riga | `deleteWorkEntry` |
| `saveWorkEdit()` | Submit form modifica | `updateWorkEntry` |
| `loadAllCantieriForEdit()` | Apertura modal modifica | `getAllCantieriForAdmin` |
| `setupAutoRefresh()` | DOMContentLoaded | — |
| `renderCalendar()` | loadCalendarData | — |
| `showDayDetails()` | Click giorno calendario | — |
| `changeMonth()` | Click navigazione mese | `getOtherUserMonthlyData` |
| `logout()` | Click logout | — (clearSession) |

### config.js — Utils object

| Funzione | Descrizione |
|----------|-------------|
| `callAPI(params)` | Fetch GET verso `/api/proxy`, gestisce errori HTTP |
| `getSession()` | Legge dati sessione da sessionStorage |
| `setSession()` | Salva dati sessione in sessionStorage |
| `clearSession()` | Rimuove sessione (logout) |
| `isLoggedIn()` | True se token presente in sessione |
| `redirectToLogin()` | Redirect a index.html |
| `redirectToDashboard()` | Redirect a dashboard.html |
| `formatHours()` | Numero → stringa ore formattata |
| `formatCurrency()` | Numero → stringa valuta |
| `formatDate()` | Data → stringa localizzata |
| `validateHours()` | Valida range ore (0-24) |
| `validatePassword()` | Valida requisiti password |
| `validateRequired()` | Valida campo non vuoto |
| `showNotification()` | Toast di notifica |
| `showFullscreenMessage()` | Overlay messaggio a schermo intero |
| `checkAdminRedirect()` | Chiama `validateAdmin` → redirect admin.html se admin |
| `loadCantieriOverview()` | Wrapper: callAPI getCantieriOverview |
| `loadDipendentiList()` | Wrapper: callAPI getDipendentiList |
| `loadOtherUserInfo()` | Wrapper: callAPI getOtherUserInfo |
| `setupAutoLogout()` | Timer 30 min → clearSession + redirectToLogin |

### config.js — PageGuard

| Funzione | Descrizione |
|----------|-------------|
| `requireLogin()` | Redirect a login se sessione non presente |
| `redirectIfLoggedIn()` | Redirect a dashboard se gia' autenticato (usato in index.html) |

---

## 6. Struttura Google Sheets

### Fogli di sistema

| Nome foglio | Descrizione |
|-------------|-------------|
| Utenti | Anagrafica dipendenti, credenziali, ruoli. Righe dati da riga 1+ |
| Cantieri | Elenco cantieri con stato, ore totali, ore mese |
| Amministrazione | Log azioni admin (insert-only) |
| `<NomeDipendente>` | Un foglio per ogni dipendente, righe ore da riga 5+ (HEADER_ROWS = 4) |

### Foglio Utenti — colonne chiave

| Colonna | Contenuto |
|---------|-----------|
| A | userId (identificativo login) |
| B | Nome display |
| C | Password (hash SHA-256 o plain text) |
| D | Ruolo (Dipendente / Admin / Administrator) |
| E | (altri dati anagrafica) |

### Foglio dipendente (`<NomeDipendente>`) — struttura

| Riga | Contenuto |
|------|-----------|
| 1-4 | Header / intestazioni (HEADER_ROWS = 4) |
| 5+ | Righe ore lavorate |

Colonne righe ore (indicative, mapping dinamico via `buildColumnMap`):

| Colonna tipica | Contenuto |
|----------------|-----------|
| Data | Data lavoro (DD/MM/YYYY) |
| Ore | Ore lavorate (numero) |
| Cantiere | ID o nome cantiere |
| Note | Note libere |

### Foglio Cantieri — colonne chiave

| Colonna | Contenuto |
|---------|-----------|
| A | ID cantiere |
| B | Nome cantiere |
| C | Stato (Aperto / Chiuso) |
| G | Ore totali generali |
| H | Ore mese corrente |
| I | Contatore accessi/dipendenti |
| J | Altro aggregato ore |

### Celle speciali foglio dipendente

| Cella | Contenuto |
|-------|-----------|
| F2 | Ore totali (SUMIFS o calcolate) |
| G2 | Ore mese corrente |
| H2 | Ulteriore aggregato ore |

---

## 7. Note di Manutenzione

### Token di sessione

- Formato: `userId_timestamp_random`
- Scadenza: 24 ore dalla generazione
- Validazione in `Utils.gs: validateSessionToken()` — controlla formato E timestamp
- Non e' JWT: non ha firma crittografica, la scadenza e' verificata lato GAS
- `decodeSessionToken()` estrae userId splittando su `_` (posizione 0)

### Mapping dinamico colonne

- `buildColumnMap(headers)` in `Utils.gs` e' il meccanismo centrale
- NON usare indici di colonna hardcoded nei fogli dipendente
- Il mapping legge la riga header (riga 4, ultima delle HEADER_ROWS) per costruire la mappa
- Se si aggiunge una colonna al foglio dipendente, aggiornare i nomi header — il codice si adatta automaticamente

### HEADER_ROWS = 4

- Le righe 1-4 dei fogli dipendente sono riservate a intestazioni
- Tutti i loop e le query sui dati ore devono partire da riga 5 (indice 4 in getValues array 0-based)
- `UserAPI.gs` e `AdminAPI.gs` rispettano questa convenzione
- Modificare HEADER_ROWS in `Config.gs` se la struttura cambia — non modificarlo direttamente negli script

### Cache admin

- `AdminAPI.gs` usa `CacheService` di GAS per `getCantieriAdminOverview`
- TTL definito in `CACHE_CONFIG` (Config.gs)
- Per forzare aggiornamento: chiamare `invalidateCache` (action API) oppure aspettare scadenza
- Modifiche a fogli Cantieri o ore dipendenti NON invalidano automaticamente la cache

### Cantieri: stati

- Solo i cantieri con stato **"Aperto"** sono restituiti da `getCantieri` (usato nel form dipendente)
- `getAllCantieriForAdmin` restituisce tutti gli stati (Aperto + Chiuso)
- Stato gestito nel foglio Cantieri colonna C

### Flusso dati ore: doppio aggiornamento

- `saveWorkEntry` scrive nel foglio dipendente E chiama `updateCantiereHours`
- Aggiornare entrambe le destinazioni se si modifica la logica di salvataggio
- `updateWorkEntry` e `deleteWorkEntry` (admin) NON ricalcolano automaticamente i totali cantiere — verificare se e' un gap da colmare

### Ruoli utente

- Ruoli validi: `Dipendente`, `Admin`, `Administrator`
- `validateAdmin` accetta sia `Admin` che `Administrator`
- Il ruolo e' letto dal foglio Utenti e incluso nel token di sessione (campo separato in sessionStorage)

### Proxy Vercel

- `api/proxy.js` risolve il problema CORS: il browser non puo' chiamare GAS direttamente
- Il proxy forwarda tutti i parametri GET al GAS URL configurato
- Se la URL del GAS deployment cambia, aggiornare la variabile d'ambiente Vercel

### Auto-logout frontend

- `setupAutoLogout()` in `config.js` imposta un timer a 30 minuti
- La sessione e' in `sessionStorage` (non `localStorage`): viene persa alla chiusura del tab
- `startAutoRefresh()` in `dashboard.html` chiama `getUserInfo` ogni 5 minuti (mantiene la sessione "attiva" visivamente, ma non rinnova il token GAS)

---

*Documento generato da Docs Agent — 2026-03-03*
