# Sistema Gestione Ore Lavoro

Sistema per la gestione delle ore di lavoro dei dipendenti con autenticazione, dashboard admin e integrazione Google Sheets.

**Versione:** v2.0
**Status:** Operativo

---

## Architettura Reale

```
Browser
  └── Vercel (hosting statico)
        ├── index.html       (login)
        ├── dashboard.html   (dipendente)
        ├── admin.html       (admin)
        ├── config.js        (logica frontend)
        └── /api/proxy       (proxy serverless)
                │
                │  HTTP GET con parametri query string
                ▼
        Google Apps Script   (backend/code.gs, container-bound)
                │
                ▼
        Google Sheets        (database)
                ├── Foglio "Utenti"
                ├── Foglio "Cantieri"
                └── Foglio "[Nome Dipendente]" × N
```

Il frontend non chiama direttamente Google Apps Script. Tutte le richieste passano per il proxy Vercel (`api/proxy.js`) che aggiunge gli header CORS necessari.

Lo script `backend/code.gs` è **container-bound**: va incollato nell'editor Script del Google Sheets, non creato come progetto standalone.

---

## Struttura File

```
ore-lavoro/
├── index.html              # Login
├── dashboard.html          # Dashboard dipendente
├── admin.html              # Dashboard admin
├── config.js               # Config + Utils + PageGuard (frontend)
├── vercel.json             # Configurazione deploy Vercel
├── package.json            # Metadati progetto
├── api/
│   └── proxy.js           # Proxy Vercel → Apps Script (CORS)
└── Script/                 # Tutti gli script Google Apps Script
    ├── Config.gs           # Costanti globali (ID foglio, azienda, validazione)
    ├── Main.gs             # Menu onOpen() nel foglio
    ├── ApiRouter.gs        # doGet/doPost, routing verso moduli API
    ├── Authentication.gs   # Login, session token, hash SHA-256
    ├── UserAPI.gs          # API utenti (salvataggio ore, lettura mensile)
    ├── AdminAPI.gs         # API admin (cantieri, dipendenti, edit/delete)
    ├── SheetsDAO.gs        # Data access layer per Google Sheets
    ├── Utils.gs            # Logger, date, helper condivisi
    ├── UtilsMenu.gs        # Dialog e input da menu Sheets
    ├── ArchivioOre.gs      # Archiviazione annuale su Drive
    ├── GestionePassword.gs # Cambio password da menu Sheets
    ├── CalcoloCantieri.gs  # Ricalcolo totali ore cantieri
    ├── ReportCommercialista.gs # Generazione PDF/Excel su Drive
    └── SystemDiagnostic.gs # Diagnostica e health check
```

### Struttura degli script in `Script/`

| Gruppo | File | Chiamato da |
|--------|------|-------------|
| API HTTP (frontend) | `ApiRouter.gs`, `Authentication.gs`, `UserAPI.gs`, `AdminAPI.gs`, `SheetsDAO.gs` | Browser via proxy Vercel |
| Menu Sheets | `Main.gs`, `UtilsMenu.gs`, `GestionePassword.gs`, `ArchivioOre.gs`, `CalcoloCantieri.gs`, `ReportCommercialista.gs`, `SystemDiagnostic.gs` | Utente che apre il foglio Google Sheets |
| Condivisi | `Config.gs`, `Utils.gs` | Tutti gli script sopra |

Tutti i file vanno nello stesso progetto Apps Script del foglio.

### Descrizione degli script

#### `Config.gs`
Costanti globali condivise da tutti gli altri script. Contiene:
- `CONFIG` — ID spreadsheet, fogli di sistema, dati azienda, cartelle Drive, struttura dati, validazioni
- `SHEET_NAMES` — nomi canonici dei fogli di sistema (es. `SHEET_NAMES.UTENTI`, `SHEET_NAMES.CANTIERI`); tutti gli script usano questa costante invece di stringhe hardcoded
- `COLUMNS` / `COLUMNS_CANTIERI` — mapping colonne per indice (0-based)
- `USER_SHEET_CELLS` — riferimenti celle riepilogative (`F2`, `G2`, `H2`)
- `ADMIN_CONFIG` / `CACHE_CONFIG` — configurazione admin e cache
- `ERROR_MESSAGES` / `SUCCESS_MESSAGES` — messaggi centralizzati
- Funzioni helper: `initializeSystem()`, `getMainSpreadsheet()`, `isSystemSheet()`, `validateConfiguration()`

#### `Main.gs`
Entry point del foglio Google Sheets. Registra il trigger `onOpen()` che costruisce il menu **🏢 Sistema Gestionale** con 4 sottomenu (Archivio, Gestione Password, Report Commercialista, Gestione Cantieri). Contiene anche le voci dinamiche basate sullo stato di salute del sistema (primo setup, conflitto, sistema ok). Espone wrapper leggeri per tutte le azioni del menu che delegano alle funzioni `execute*` dei moduli specializzati.

#### `ApiRouter.gs`
Entry point HTTP della web app. Implementa `doGet()` e `doPost()` che ricevono le richieste dal proxy Vercel e le smistano ai moduli corretti in base al parametro `action`. Gestisce 16 azioni suddivise in tre categorie: endpoint pubblici (`ping`, `authenticate`), endpoint utente (`saveWorkEntry`, `getCantieri`, `getUserInfo`, `getMonthlyWorkData`) e endpoint admin (`validateAdmin`, `getCantieriOverview`, `getDipendentiList`, `getDipendenteTimeline`, `getOtherUserInfo`, `getOtherUserMonthlyData`, `getAllCantieriForAdmin`, `updateWorkEntry`, `deleteWorkEntry`, `invalidateCache`).

#### `Authentication.gs`
Gestione login e sessioni. `authenticateUser()` legge gli header del foglio Utenti in modo dinamico, verifica la password (plain text o SHA-256), esegue la migrazione automatica a hash al primo login e genera il session token. `validateSessionToken()` verifica la validità del token. `validateAdmin()` controlla che il token appartenga a un ruolo admin. `generatePasswordHash()` implementa SHA-256 con salt fisso.

#### `UserAPI.gs`
API per i dipendenti. `saveWorkEntry()` valida e salva una riga ore nel foglio del dipendente (colonne A-E), poi aggiorna i totali nel foglio Cantieri via `SheetsDAO.gs`. `getMonthlyWorkData()` restituisce il calendario mensile del dipendente con tutte le registrazioni del mese richiesto.

#### `AdminAPI.gs`
API riservate agli amministratori, tutte con verifica token admin obbligatoria. `getCantieriAdminOverview()` restituisce la panoramica cantieri in due modalità (`mese` o `totali`) con cache CacheService. `getDipendentiListAdmin()` restituisce la lista dipendenti con ore e stato. `getDipendenteTimelineAdmin()` e `getOtherUserMonthlyData()` permettono di vedere i dati di un dipendente specifico. `updateWorkEntry()` e `deleteWorkEntry()` consentono la modifica o cancellazione di registrazioni. `invalidateAdminCache()` svuota la cache manualmente.

#### `SheetsDAO.gs`
Data Access Layer. Centralizza le letture/scritture dirette sui fogli Google Sheets usate da più moduli. Tutte le funzioni accedono ai fogli tramite la costante `SHEET_NAMES` (definita in `Config.gs`) invece di stringhe hardcoded, garantendo coerenza con il resto del backend. `updateCantiereHours()` aggiorna le colonne G-J (ore totali, ultimo aggiornamento, ultimo dipendente, contatore) del foglio `SHEET_NAMES.CANTIERI`. `getCantieri()` restituisce la lista cantieri con stato `Aperto` leggendo da `SHEET_NAMES.CANTIERI`. `getUserInfo()` e `getOtherUserInfo()` leggono i dati utente dal foglio Utenti. `getAllCantieriForAdmin()` restituisce tutti i cantieri senza filtro di stato, anch'essa tramite `SHEET_NAMES.CANTIERI`.

#### `Utils.gs`
Funzioni di supporto condivise da tutti i moduli API. Fornisce:
- `Logger` — oggetto con metodi `debug`, `info`, `warn`, `error`, `auth`, `save`, `critical` (filtrati da `PRODUCTION_CONFIG`)
- `handleError()` — gestione errori centralizzata con risposta strutturata
- `getSheetSafely()` / `getWorksheet()` — accesso sicuro ai fogli
- `parseDateFlexible()` — parsing date in formato italiano o ISO
- `validateHours()` — validazione valore ore (0-24)
- `createCORSResponse()` — costruisce la risposta HTTP con header CORS
- `generateSessionToken()` / `buildColumnMap()` — token di sessione e mapping dinamico colonne

#### `UtilsMenu.gs`
Funzioni di supporto per gli script del menu Sheets (non usate dalle API). Contiene utility per date (`formatDateItalian`, `parseItalianDate`, `extractYear`, `dateMatches`), validazioni (`validateNumber`, `validateYear`), lettura dipendenti attivi (`getActiveEmployeeNames()`), e funzioni dialog per interazione utente dal menu Sheets (`showConfirmDialog`, `showInputDialog`, `showErrorMessage`, `showSuccessMessage`).

#### `ArchivioOre.gs`
Archiviazione annuale delle ore. Copia il foglio di un dipendente in un nuovo spreadsheet su Google Drive (cartella `Archivi Ore Lavorate/ANNO/`), genera i file Excel e PDF, poi elimina dal foglio originale le righe dell'anno archiviato. Funzioni principali: `executeArchiveAllPreviousYear()` (tutti i dipendenti), `executeArchiveSingleEmployee()` (singolo con selezione), `executeArchiveWithCustomYear()` (anno personalizzato), `displayArchiveStatus()` (stato archivi su Drive).

#### `GestionePassword.gs`
Cambio password da menu Sheets. `executeChangeEmployeePassword()` guida l'admin attraverso un flusso in tre passi: selezione utente, inserimento nuova password, aggiornamento nel foglio Utenti con hash SHA-256. Legge le colonne in modo dinamico tramite mapping header. Funzione `getUsersList()` per lista utenti attivi.

#### `CalcoloCantieri.gs`
Ricalcolo totali ore cantieri. `executeRecalculateConstructionSites()` percorre tutti i fogli dipendente, somma le ore per cantiere e riscrive le colonne G-J del foglio Cantieri. Mostra un riepilogo delle correzioni effettuate. Utile per correggere disallineamenti tra i totali e i dati effettivi.

#### `ReportCommercialista.gs`
Generazione report su Google Drive. `executeGenerateMonthlyReport()` genera un file Excel per il mese selezionato con le ore di tutti i dipendenti. `executeGenerateYearlyReport()` produce il riepilogo annuale. I file vengono salvati nella cartella `Report Commercialista` configurata in `Config.gs`. I dati aziendali nel report (nome, P.IVA, ecc.) si configurano in `CONFIG.COMPANY`.

#### `SystemDiagnostic.gs`
Diagnostica e health check. `checkSystemHealth()` esegue controlli rapidi (< 2 secondi) usati da `Main.gs` per il menu dinamico: verifica connessione database, ID spreadsheet, fogli obbligatori, permessi. `runSystemDiagnostics()` esegue una diagnostica completa con report dettagliato. Restituisce stato `healthy`, `needs_setup` o `conflict`.

---

## Funzionalità Implementate

### Per i dipendenti (dashboard.html)
- Login con hash SHA-256 (auto-migrazione da plain text al primo accesso)
- Inserimento ore per data e cantiere
- Statistiche mese corrente, mese precedente, anno corrente
- Auto-logout dopo 30 minuti di inattività
- Design responsive

### Per gli admin (admin.html)
- Accesso automatico dopo login se ruolo = `Admin` o `Administrator`
- Vista globale cantieri con toggle "mese corrente / totali assoluti"
- Lista dipendenti con ore e stato
- Calendario mensile per singolo dipendente
- Auto-refresh ogni 30 minuti

### Menu Google Sheets (Script/)
- **Archivio:** archivia anni precedenti per tutti o per singolo dipendente
- **Gestione Password:** cambio password con dialog interattivo
- **Report Commercialista:** genera PDF ed Excel mensili/annuali su Google Drive
- **Gestione Cantieri:** ricalcolo totali ore con report correzioni
- **Diagnostica:** health check del sistema (configurazione, fogli, permessi)

### Sicurezza
- Password hash SHA-256 con salt fisso (`OreLavoro2025_Salt_`)
- Auto-migrazione: la prima volta che un utente plain-text effettua il login, la password viene convertita in hash
- Mappatura colonne dinamica: il backend legge gli header per nome, non per posizione fissa
- Token di sessione generato lato server ad ogni login

---

## Setup

### 1. Google Sheets — struttura fogli

**Foglio "Utenti"** (10 colonne, A→J):

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| ID Utente | Nome Completo | Email | Telefono | Data Assunzione | Ruolo | Username | Password | Password Hash | Attivo |
| U001 | Mario Rossi | mario@email.com | 123456789 | 01/01/2024 | Dipendente | mario.rossi | password123 | | Si |
| U002 | Anna Verdi | anna@email.com | 987654321 | 01/03/2024 | Admin | anna.verdi | admin123 | | Si |

Valori validi per **Ruolo**: `Dipendente`, `Admin`, `Administrator`
Valori validi per **Attivo**: `Si`, `SI`, `si`

**Foglio "Cantieri"** (minimo 4 colonne, fino a J):

| A | B | C | D | ... | G | H | I | J |
|---|---|---|---|---|---|---|---|---|
| ID Cantiere | Nome Progetto | Indirizzo | Stato Lavori | ... | Ore Totali | Ultimo Aggiornamento | Ultimo Dipendente | N. Inserimenti |
| C001 | Costruzione Villa | Via Roma 123 | Aperto | | 0 | | | 0 |

Le colonne G→J vengono aggiornate automaticamente dal backend ad ogni inserimento ore.

**Foglio per ogni dipendente** (nome = "Nome Completo" del foglio Utenti):

```
A1: Data    B1: Cantiere ID    C1: Nome Cantiere    D1: Ore    E1: Note
```

Celle riepilogative (lette dal backend):
- `F2` → ore mese corrente
- `G2` → ore mese precedente
- `H2` → ore anno corrente

Formule per F2, G2, H2:

```excel
F2 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))

G2 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY())-1,1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY()),1))

H2 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),1,1),A:A,"<"&DATE(YEAR(TODAY())+1,1,1))
```

### 2. Google Apps Script

1. Apri il Google Sheets → **Estensioni** → **Apps Script**
2. Crea un file per ognuno dei 14 script nella cartella `Script/` e copia il relativo contenuto:
   - `Config.gs`, `Main.gs`, `Utils.gs`, `UtilsMenu.gs`
   - `ApiRouter.gs`, `Authentication.gs`, `UserAPI.gs`, `AdminAPI.gs`, `SheetsDAO.gs`
   - `ArchivioOre.gs`, `GestionePassword.gs`, `CalcoloCantieri.gs`, `ReportCommercialista.gs`, `SystemDiagnostic.gs`
3. Dal menu del foglio: **Sistema Gestionale** → **Inizializza sistema** (prima esecuzione)
5. **Deploy** → **Nuova distribuzione** → **App web**
   - Esegui come: **Me**
   - Accesso: **Chiunque**
6. Copia l'URL generato

### 3. Proxy Vercel

Apri `api/proxy.js` e aggiorna la costante con l'URL copiato al passo precedente:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TUO_ID/exec';
```

> Alternativa: usa una variabile d'ambiente Vercel (`process.env.APPS_SCRIPT_URL`) per non esporre l'URL nel codice.

### 4. Deploy su Vercel

1. Crea repository GitHub e carica il progetto
2. Importa il repository su [vercel.com](https://vercel.com)
3. Nessun build command — il progetto è statico (già configurato in `vercel.json`)
4. Il sito sarà disponibile su `https://nome-progetto.vercel.app`

`config.js` è già configurato con URL relativo `/api/proxy`: non serve modificarlo.

---

## Gestione Utenti

### Aggiungere un dipendente

1. Nel foglio **Utenti** aggiungi una riga:
   ```
   U003 | Giuseppe Bianchi | giuseppe@email.com | 345678901 | 15/06/2024 | Dipendente | giuseppe.bianchi | password123 | | Si
   ```
2. Crea un foglio chiamato esattamente **Giuseppe Bianchi**
3. Aggiungi intestazioni in riga 1 e le formule in F3, G3, H3

### Disattivare un dipendente

Nel foglio **Utenti**, colonna J (`Attivo`): cambia `Si` in `No`.

### Cambiare password

Dal menu del foglio Google Sheets: **Sistema Gestionale** → **Gestione Password** → **Cambia password dipendente**

---

## Gestione Cantieri

### Aggiungere un cantiere

Nel foglio **Cantieri**:
```
C005 | Ristrutturazione Ufficio | Via Milano 45 | Aperto
```

### Chiudere un cantiere

Colonna D (`Stato Lavori`): cambia `Aperto` in `Chiuso`. Il cantiere non apparirà più nella lista del frontend.

### Ricalcolare i totali

Dal menu Google Sheets: **Sistema Gestionale** → **Gestione Cantieri** → **Ricalcola totali ore cantieri**

Questo percorre tutti i fogli dipendente e riscrive i valori nelle colonne G→J del foglio Cantieri.

---

## Troubleshooting

### "Errore di connessione" nel browser
- Controlla che `api/proxy.js` contenga l'URL corretto di Apps Script
- Verifica che il deployment Apps Script sia pubblico (`Anyone`)
- Controlla il log delle funzioni in Vercel (tab **Functions**)

### "Login non funziona"
- Controlla che username e password siano nel foglio **Utenti**
- Verifica che la colonna J (`Attivo`) sia `Si`
- Se la colonna H (`Password Hash`) è vuota, viene usata la password plain dalla colonna I — questo è il comportamento previsto al primo accesso

### "Cantieri non si caricano"
- Verifica che esista il foglio **Cantieri**
- Verifica che almeno un cantiere abbia `Stato Lavori` = `Aperto`

### "Ore non si salvano"
- Verifica che esista un foglio col nome esatto del dipendente (uguale a "Nome Completo" nel foglio Utenti)
- Controlla i permessi di scrittura del Google Sheets

### "Menu non appare in Google Sheets"
- Ricarica il foglio (il menu viene creato da `onOpen()`)
- Controlla **Estensioni** → **Apps Script** → **Esecuzioni** per errori

---

## Report Commercialista

Dal menu Google Sheets: **Sistema Gestionale** → **Report Commercialista**

I report vengono salvati su Google Drive nella cartella `Report Commercialista`.
Formati disponibili: PDF e Excel (.xlsx).

Per configurare i dati aziendali che appaiono nel report, modifica `Script/Config.gs`:

```js
COMPANY: {
  NAME: 'La Tua Azienda SRL',
  ADDRESS: 'Via Roma 123, 00100 Roma',
  VAT: 'IT12345678901',
  ...
}
```

---

## Changelog

### 2026-03-02 — code-review-docs — Rilascio versione 2.0

- La codebase attuale con tutte le fix applicate viene formalmente denominata **v2.0**.
- Il backup del codice precedente in produzione (`backend/backupOLDcode.gs`) rappresenta la **v1.0** e rimane read-only come riferimento storico.

---

### 2026-03-02 — gas-code-agent — Refactoring qualita codice backend

- **FIX-02**: Tutti i nomi foglio hardcoded nei file `AdminAPI.gs`, `ApiRouter.gs`, `Authentication.gs`, `CalcoloCantieri.gs`, `GestionePassword.gs`, `UserAPI.gs` sostituiti con le costanti `SHEET_NAMES` di `Config.gs`.
- **FIX-03**: Funzioni duplicate (`generatePasswordHash`, `formatFileName`, `getCurrentDateFormatted`) rimosse da `UtilsMenu.gs`; versioni canoniche mantenute in `Utils.gs` e `Config.gs`.
- **FIX-05**: Risposte API di `AdminAPI.gs` uniformate al formato `{ success, message, data }` (rimossi campi `modalita` e `loadTime`).
- **FIX-06**: Sostituiti tutti i `console.log/warn/error` in `Authentication.gs` con il logger centralizzato (`Logger.auth`, `Logger.debug`, `Logger.info`, `Logger.warn`, `Logger.error`).
- **FIX-07**: 3 occorrenze della stringa hardcoded `'Cantieri'` in `SheetsDAO.gs` sostituite con `SHEET_NAMES.CANTIERI` nelle funzioni `updateCantiereHours()` (riga 23), `getCantieri()` (riga 105) e `getAllCantieriForAdmin()` (riga 157). `SheetsDAO.gs` è ora completamente allineato alla convenzione `SHEET_NAMES` condivisa da tutto il backend.

---

### 2026-03-02 — ui-frontend-developer — Fix Sicurezza UI (FIX-09, FIX-10, FIX-11, FIX-12)

- **FIX-09 — XSS in `admin.html`**: Aggiunta funzione `Utils.escapeHtml()` in `config.js`. Applicata in 5 punti di `admin.html` (`renderCantieri()`, `showDayDetails()`, `showDeleteConfirmation()`, `loadAllCantieriForEdit()`, `loadDipendenti()`) per prevenire injection di HTML arbitrario tramite dati provenienti dal server.
- **FIX-10 — XSS in `dashboard.html`**: Applicata `Utils.escapeHtml()` nella funzione `showDayDetails()` di `dashboard.html` sui campi `entry.cantiere`, `entry.ore`, `entry.note`.
- **FIX-11 — `.trim()` sulla password in `index.html`**: Rimosso `.trim()` dal campo password prima dell'invio al backend. Il trim rimane applicato solo allo username. Una password con spazi significativi veniva silenziosamente alterata prima dell'autenticazione.
- **FIX-12 — `console.*` con dati sensibili in produzione**: Sostituiti 30 `console.*` totali con `ProductionLogger` in tutti e 3 gli HTML (`index.html`: 9, `admin.html`: 16, `dashboard.html`: 5) e in `config.js` (9 nelle utility). Rimosso `window.getAdminState` da `admin.html` per eliminare l'esposizione dello stato admin sulla finestra globale.

---

### 2026-03-02 — ui-frontend-developer — Fix rendering ore calendario admin (FIX-16)

**File modificato**: `admin.html` (riga 542)
**Summary**: Corretto campo inesistente `workDay.ore` in `workDay.totalOre` nella logica di rendering del calendario mensile in `admin.html`.
**Details**: Il calendario mensile della dashboard admin non mostrava mai le ore nelle celle dei giorni lavorativi. La causa era l'accesso a `workDay.ore`, campo non presente nella struttura restituita dall'API `getOtherUserMonthlyData`. Il campo corretto, coerente con la risposta effettiva dell'API, e `workDay.totalOre`. Le due API (`getMonthlyWorkData` per i dipendenti e `getOtherUserMonthlyData` per gli admin) hanno strutture dati intenzionalmente diverse: nessuna modifica backend e stata necessaria. Il fix e puramente frontend e circoscritto a una singola riga.
**Status**: Completato

---

### 2026-03-02 — ui-frontend-developer — Accessibilita modale e navigazione tastiera (FIX-13, FIX-14)

**File modificati**: `dashboard.html`, `admin.html`

**FIX-13 — Attributi ARIA e focus trap sui modal**

Aggiunti attributi di accessibilita (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) ai modal `#dayDetailsPopup` e `#deleteConfirmModal` in entrambi i file. Implementata la utility `createFocusTrap(dialogElement)` che circoscrive la navigazione da tastiera all'interno del dialogo aperto: calcola dinamicamente gli elementi interattivi focusabili, intercetta il tasto Tab (e Shift+Tab) per mantenere il focus nel perimetro del modal, chiude il dialogo alla pressione di Escape e ripristina il focus all'elemento che aveva il focus prima dell'apertura. In `dashboard.html` la trap viene attivata su `#dayDetailsPopup`; in `admin.html` viene attivata sia su `#dayDetailsPopup` sia su `#deleteConfirmModal` tramite le variabili `currentPopupFocusTrap` e `currentDeleteModalFocusTrap`.

**FIX-14 — Navigazione tastiera su elementi interattivi non-button**

In `dashboard.html`: gli elementi `.footer-item` (navigazione inferiore) hanno ricevuto `role="button"`, `tabindex="0"`, `aria-label` descrittivo e `aria-current="page"` sull'elemento attivo. Aggiunto handler `keydown` che intercetta Enter e Space per attivare il click, in modo da equiparare il comportamento a quello di un elemento `<button>` nativo. In `admin.html`: gli elementi `.toggle-option` (toggle "Totali Assoluti / Mese Corrente") hanno ricevuto `role="button"`, `tabindex="0"` e `aria-pressed` dinamico (aggiornato a `true`/`false` al cambio selezione). Aggiunto handler `keydown` con attivazione Enter/Space sugli stessi elementi.

**Status**: Completato

---

## Aggiornamenti

### Frontend (index, dashboard, admin, config.js)
1. Modifica i file nel repository GitHub
2. Push → Vercel rideploya automaticamente

### Script API (`ApiRouter.gs`, `Authentication.gs`, `UserAPI.gs`, `AdminAPI.gs`, `SheetsDAO.gs`)
1. Modifica i file in **Estensioni** → **Apps Script**
2. **Deploy** → **Gestisci distribuzioni** → **Modifica** → **Versione: Nuova**

### Script menu (`Main.gs`, `GestionePassword.gs`, `CalcoloCantieri.gs`, ecc.)
1. Modifica i file in Apps Script
2. Le modifiche sono attive immediatamente (nessun deploy necessario)

---

## Limiti del Sistema

| Risorsa | Limite |
|---|---|
| Dipendenti | ~10 (ottimale per performance) |
| Google Sheets | 10 milioni di celle totali |
| Apps Script runtime | 6 minuti per esecuzione |
| Sessione utente | 30 minuti di inattività |
| Vercel proxy timeout | 30 secondi per richiesta |

---

## Licenza

MIT License — libero per uso commerciale e personale.
