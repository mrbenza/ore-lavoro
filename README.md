# Sistema Gestione Ore Lavoro

Sistema per la gestione delle ore di lavoro dei dipendenti con autenticazione, dashboard admin e integrazione Google Sheets.

**Versione:** v2.1
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
                ├── Foglio "Amministrazione"
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
├── GUIDA-LOGO.md           # Guida sostituzione logo aziendale (login)
├── api/
│   └── proxy.js           # Proxy Vercel → Apps Script (CORS)
└── Script/                 # Tutti gli script Google Apps Script
    ├── Config.gs           # Costanti globali (azienda, validazione, PropertiesService)
    ├── Main.gs             # Menu onOpen() con stato dinamico (healthy/warning/critical)
    ├── ApiRouter.gs        # doGet/doPost, routing verso moduli API
    ├── Authentication.gs   # Login, session token, hash SHA-256
    ├── UserAPI.gs          # API utenti (salvataggio ore, lettura mensile)
    ├── AdminAPI.gs         # API admin (cantieri, dipendenti, edit/delete)
    ├── SheetsDAO.gs        # Data access layer per Google Sheets
    ├── Utils.gs            # Logger, date, helper condivisi
    ├── UtilsMenu.gs        # Dialog e input da menu Sheets
    ├── ArchivioOre.gs      # Archiviazione annuale su Drive
    ├── GestionePassword.gs # Cambio password (menu Sheets + self-service dipendente)
    ├── CalcoloCantieri.gs  # Ricalcolo totali ore cantieri
    ├── ReportCommercialista.gs # Generazione PDF/Excel su Drive
    ├── Statistiche.gs      # Aggregazione storica ore (trigger giornaliero/mensile)
    └── SystemDiagnostic.gs # Diagnostica e health check (3 stati: healthy/warning/critical)
```

### Struttura degli script in `Script/`

| Gruppo | File | Chiamato da |
|--------|------|-------------|
| API HTTP (frontend) | `ApiRouter.gs`, `Authentication.gs`, `UserAPI.gs`, `AdminAPI.gs`, `SheetsDAO.gs` | Browser via proxy Vercel |
| Menu Sheets | `Main.gs`, `UtilsMenu.gs`, `GestionePassword.gs`, `ArchivioOre.gs`, `CalcoloCantieri.gs`, `ReportCommercialista.gs`, `Statistiche.gs`, `SystemDiagnostic.gs` | Utente che apre il foglio Google Sheets |
| Condivisi | `Config.gs`, `Utils.gs` | Tutti gli script sopra |

Tutti i file vanno nello stesso progetto Apps Script del foglio.

### Descrizione degli script

#### `Config.gs`
Costanti globali condivise da tutti gli altri script. Contiene:
- `CONFIG` — dati azienda (letti da `PropertiesService` con fallback ai default), fogli di sistema, cartelle Drive, struttura dati, validazioni
- `SHEET_NAMES` — nomi canonici dei fogli di sistema; tutti gli script usano questa costante invece di stringhe hardcoded
- `COLUMNS` / `COLUMNS_CANTIERI` — mapping colonne per indice (0-based)
- `USER_SHEET_CELLS` — riferimenti celle riepilogative (`F2`, `G2`, `H2`)
- `ADMIN_CONFIG` / `CACHE_CONFIG` — configurazione admin e cache
- `ERROR_MESSAGES` / `SUCCESS_MESSAGES` — messaggi centralizzati
- Funzioni helper: `getMainSpreadsheet()` (alias di `SpreadsheetApp.getActiveSpreadsheet()`), `isSystemSheet()`, `validateConfiguration()`, `configuraDatiAzienda()` (form step-by-step per configurare nome, indirizzo, P.IVA, telefono, email)

#### `Main.gs`
Entry point del foglio Google Sheets. Registra il trigger `onOpen()` che costruisce il menu **Sistema Gestionale** con 4 sottomenu (Archivio, Gestione Password, Report Commercialista, Gestione Cantieri). Il menu è **dinamico a 3 stati** basato su `checkSystemHealth()`: `healthy` (icona `🔧`), `warning` (icona `⚠️`), `critical` (icona `🚨`). In tutti i casi la voce diagnostica chiama sempre `runSystemDiagnostics()`. Espone wrapper leggeri per tutte le azioni del menu che delegano alle funzioni dei moduli specializzati.

#### `ApiRouter.gs`
Entry point HTTP della web app. Implementa `doGet()` e `doPost()` che ricevono le richieste dal proxy Vercel e le smistano ai moduli corretti in base al parametro `action`. Gestisce le azioni suddivise in tre categorie: endpoint pubblici (`ping`, `authenticate`), endpoint utente (`saveWorkEntry`, `getCantieri`, `getUserInfo`, `getMonthlyWorkData`, `cambiaPassword`) e endpoint admin (`validateAdmin`, `getCantieriOverview`, `getDipendentiList`, `getDipendenteTimeline`, `getOtherUserInfo`, `getOtherUserMonthlyData`, `getAllCantieriForAdmin`, `updateWorkEntry`, `deleteWorkEntry`, `invalidateCache`).

#### `Authentication.gs`
Gestione login e sessioni. `authenticateUser()` legge gli header del foglio Utenti in modo dinamico, verifica la password (plain text o SHA-256), esegue la migrazione automatica a hash al primo login e genera il session token. `validateSessionToken()` verifica la validità del token. `validateAdmin()` controlla che il token appartenga a un ruolo admin. `generatePasswordHash()` implementa SHA-256 con salt fisso.

#### `UserAPI.gs`
API per i dipendenti. `saveWorkEntry()` valida e salva una riga ore nel foglio del dipendente (colonne A-E), poi aggiorna i totali nel foglio Cantieri via `SheetsDAO.gs`. `getMonthlyWorkData()` restituisce il calendario mensile del dipendente con tutte le registrazioni del mese richiesto.

#### `AdminAPI.gs`
API riservate agli amministratori, tutte con verifica token admin obbligatoria. `getCantieriAdminOverview()` restituisce la panoramica cantieri in due modalità (`mese` o `totali`) con cache CacheService. `getDipendentiListAdmin()` restituisce la lista dipendenti con ore e stato. `getDipendenteTimelineAdmin()` e `getOtherUserMonthlyData()` permettono di vedere i dati di un dipendente specifico. `updateWorkEntry()` e `deleteWorkEntry()` consentono la modifica o cancellazione di registrazioni. `invalidateAdminCache()` svuota la cache manualmente.

#### `SheetsDAO.gs`
Data Access Layer. Centralizza le letture/scritture dirette sui fogli Google Sheets usate da più moduli. Tutte le funzioni accedono ai fogli tramite la costante `SHEET_NAMES` invece di stringhe hardcoded. `updateCantiereHours()` aggiorna le colonne G-J del foglio Cantieri. `getCantieri()` restituisce la lista cantieri con stato `Aperto`. `getUserInfo()` e `getOtherUserInfo()` leggono i dati utente dal foglio Utenti. `getAllCantieriForAdmin()` restituisce tutti i cantieri senza filtro di stato.

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
Cambio password da menu Sheets e self-service per i dipendenti. `executeChangeEmployeePassword()` guida l'admin attraverso un flusso in tre passi: selezione utente, inserimento nuova password, aggiornamento nel foglio Utenti con hash SHA-256. `cambiaPasswordUtente()` gestisce il cambio password self-service dal frontend (verifica la password attuale prima di aggiornare). `getUsersList()` restituisce la lista utenti attivi.

#### `CalcoloCantieri.gs`
Ricalcolo totali ore cantieri. `executeRecalculateConstructionSites()` percorre tutti i fogli dipendente, somma le ore per cantiere e riscrive le colonne G-J del foglio Cantieri. Mostra un riepilogo delle correzioni effettuate. Utile per correggere disallineamenti tra i totali e i dati effettivi.

#### `ReportCommercialista.gs`
Generazione report su Google Drive. `executeGenerateMonthlyReport()` genera un file Excel per il mese selezionato con le ore di tutti i dipendenti (dettaglio giornaliero: Data e Ore). `executeGenerateYearlyReport()` produce il riepilogo annuale. I file vengono salvati nella cartella `Report Commercialista` configurata in `Config.gs`. I dati aziendali nel report si configurano dal menu: **Report Commercialista** → **Configura dati azienda** (oppure modificando direttamente `CONFIG.COMPANY` in `Config.gs`). Palette colori professionale: navy `#1e3a5f`, blu `#2563eb`, azzurro `#eff6ff`.

#### `Statistiche.gs`
Aggregazione statistica delle ore storiche. `setupAmministrazioneSheet()` è il punto di ingresso unico: crea il foglio `Amministrazione`, aggrega tutti i dati storici in un'unica passata O(N) tramite `forzaAggregazioneStorica()`, e installa automaticamente i trigger. Trigger attivi: giornaliero alle 4:00 e mensile il 1° del mese alle 4:00. `_installaTriggers()` gestisce l'installazione trigger senza UI.

#### `SystemDiagnostic.gs`
Diagnostica e health check. `checkSystemHealth()` esegue controlli rapidi (< 2 secondi) usati da `Main.gs` per il menu dinamico: verifica connessione database, moduli critici, fogli obbligatori, accesso Drive. Restituisce uno dei tre stati: `healthy`, `warning`, `critical`. `runSystemDiagnostics()` esegue una diagnostica completa con report dettagliato mostrato in un dialog.

---

## Funzionalità Implementate

### Per i dipendenti (dashboard.html)
- Login con hash SHA-256 (auto-migrazione da plain text al primo accesso)
- Inserimento ore per data e cantiere
- **Warning ore duplicate**: prima di salvare, mostra un modal di conferma se il giorno ha già ore inserite (anche per mesi passati)
- **Cambio password self-service** dalla tab "Profilo" (verifica password attuale + aggiornamento con hash)
- Statistiche mese corrente, mese precedente, anno corrente
- Navigazione con **sidebar a sinistra su desktop** (≥ 900px) e **tab bar in basso su mobile** (stile admin.html)
- Cache mensile frontend (`monthlyCache`) per evitare chiamate ripetute a `getMonthlyWorkData`
- Placeholder "Caricamento cantieri..." durante il caricamento del select cantieri
- Auto-logout dopo 30 minuti di inattività

### Per gli admin (admin.html)
- Accesso automatico dopo login se ruolo = `Admin` o `Administrator`
- Vista globale cantieri con toggle "mese corrente / totali assoluti"
- Lista dipendenti con ore e stato
- Calendario mensile per singolo dipendente
- Auto-refresh ogni 30 minuti

### Menu Google Sheets (Script/)
- **Archivio:** archivia anni precedenti per tutti o per singolo dipendente
- **Gestione Password:** cambio password con dialog interattivo (admin → dipendente)
- **Report Commercialista:** genera PDF ed Excel mensili/annuali su Google Drive; voce "Configura dati azienda" per impostare ragione sociale, P.IVA ecc. senza toccare il codice
- **Gestione Cantieri:** ricalcolo totali ore con report correzioni
- **Diagnostica:** health check del sistema con menu dinamico a 3 stati

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
2. Crea un file per ognuno dei 15 script nella cartella `Script/` e copia il relativo contenuto:
   - `Config.gs`, `Main.gs`, `Utils.gs`, `UtilsMenu.gs`
   - `ApiRouter.gs`, `Authentication.gs`, `UserAPI.gs`, `AdminAPI.gs`, `SheetsDAO.gs`
   - `ArchivioOre.gs`, `GestionePassword.gs`, `CalcoloCantieri.gs`, `ReportCommercialista.gs`, `SystemDiagnostic.gs`, `Statistiche.gs`
3. **Deploy** → **Nuova distribuzione** → **App web**
   - Esegui come: **Me**
   - Accesso: **Chiunque**
4. Copia l'URL generato

Non è necessario alcun passo di inizializzazione manuale: il menu si attiva automaticamente all'apertura del foglio, e `setupAmministrazioneSheet()` (in `Statistiche.gs`) può essere eseguita una tantum per creare il foglio Amministrazione e installare i trigger.

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

- **Admin**: dal menu del foglio Google Sheets: **Sistema Gestionale** → **Gestione Password** → **Cambia password dipendente**
- **Dipendente (self-service)**: dalla dashboard → tab **Profilo** → form cambio password (richiede la password attuale)

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
Il dettaglio giornaliero riporta: Data e Ore (il campo Cantiere è stato rimosso per semplicità).

Per configurare i dati aziendali che appaiono nel report:
- Dal menu: **Sistema Gestionale** → **Report Commercialista** → **Configura dati azienda** (form interattivo, senza toccare il codice)
- Oppure direttamente in `Script/Config.gs`, modificando `CONFIG.COMPANY` (il valore viene poi sovrascritto da `PropertiesService` se configurato via menu)

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

## Changelog

### 2026-03-09 — UI Agent + Code Agent — Feature/Refactor

**File modificati:** `dashboard.html`, `Script/GestionePassword.gs`, `Script/ApiRouter.gs`, `Script/Statistiche.gs`, `Script/SystemDiagnostic.gs`, `Script/Main.gs`, `Script/Config.gs`, `Script/ReportCommercialista.gs`, `GUIDA-LOGO.md`

**Funzionalita frontend (dashboard.html):**
- Warning ore duplicate: modal di conferma prima del salvataggio se il giorno ha gia ore inserite (anche per mesi passati)
- Cambio password self-service dalla tab "Profilo" (verifica password attuale, aggiornamento con hash)
- Sidebar desktop (>=900px) + tab bar mobile, in linea con admin.html
- Nuova tab "Profilo" con form cambio password
- Placeholder "Caricamento cantieri..." nel select durante il caricamento
- Cache mensile (`monthlyCache`) per evitare chiamate ridondanti a `getMonthlyWorkData`

**GestionePassword.gs:** aggiunta `cambiaPasswordUtente()` per il cambio password self-service dal frontend; route `cambiaPassword` aggiunta in `ApiRouter.gs`.

**Statistiche.gs (nuovo):** `forzaAggregazioneStorica()` aggrega tutti i dati storici in O(N); `setupAmministrazioneSheet()` come unico punto di ingresso (crea foglio + aggrega + installa trigger); trigger giornaliero alle 4:00 e mensile il 1° del mese alle 4:00; rimossa `forzaAggregazioneAnnoStorico()`.

**SystemDiagnostic.gs:** rimossa dipendenza da `MAIN_SHEET_ID`/`PropertiesService`; `checkSystemHealth()` semplificato a 3 stati (`healthy`/`warning`/`critical`); rimosso falso errore "Sistema non inizializzato"; rimosse funzioni inutili (`showSystemWarnings`, `quickSystemTest`, `functionExists`, ecc.).

**Main.gs:** menu dinamico a 3 stati con icona adattiva; rimosse funzioni di inizializzazione obsolete (`initializeSystemSetup`, `checkSystemInitializationStatus`, ecc.) e funzioni diagnostica duplicate.

**Config.gs:** `CONFIG.COMPANY` legge da `PropertiesService` con fallback ai default; `getMainSpreadsheet()` semplificata; rimossa `initializeSystem()`; aggiunta `configuraDatiAzienda()`.

**ReportCommercialista.gs:** rimossa sezione "Riepilogo Cantieri"; dettaglio giornaliero ridotto a Data e Ore; nuova palette colori professionale; `autoResizeColumns` con larghezze minime garantite; voce menu "Configura dati azienda".

**GUIDA-LOGO.md (nuovo):** guida per sostituire il logo aziendale nella pagina di login.

---

## Licenza

MIT License — libero per uso commerciale e personale.
