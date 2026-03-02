# Sistema Gestione Ore Lavoro

Sistema per la gestione delle ore di lavoro dei dipendenti con autenticazione, dashboard admin e integrazione Google Sheets.

**Versione:** backend v2.3 · frontend v2.2
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
├── index.html              # Login (V2.2)
├── dashboard.html          # Dashboard dipendente
├── admin.html              # Dashboard admin
├── config.js               # Config + Utils + PageGuard (frontend)
├── vercel.json             # Configurazione deploy Vercel
├── package.json            # Metadati progetto
├── backend/
│   └── code.gs            # API Google Apps Script (V2.3)
├── api/
│   └── proxy.js           # Proxy Vercel → Apps Script (CORS)
└── Script/                 # Script menu interno Google Sheets
    ├── Config.gs           # Costanti e configurazione backend
    ├── Main.gs             # Menu onOpen() nel foglio
    ├── Utils.gs            # Funzioni utility condivise
    ├── GestionePassword.gs # Cambio password da menu Sheets
    ├── ReportCommercialista.gs # Generazione PDF/Excel su Drive
    ├── CalcoloCantieri.gs  # Ricalcolo totali ore cantieri
    └── SystemDiagnostic.gs # Diagnostica e health check
```

### Differenza tra `backend/code.gs` e `Script/`

| | `backend/code.gs` | `Script/*.gs` |
|---|---|---|
| Scopo | API HTTP per il frontend web | Menu interattivo dentro Google Sheets |
| Chiamato da | Browser via proxy Vercel | Utente che apre il foglio Google Sheets |
| Funzioni | Login, salva ore, lettura cantieri | Archivia dati, cambia password, genera report |

Entrambi vanno nello stesso progetto Apps Script del foglio.

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
- `F3` → ore mese corrente
- `G3` → ore mese precedente
- `H3` → ore anno corrente

Formule per F3, G3, H3:

```excel
F3 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))

G3 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY())-1,1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY()),1))

H3 =SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),1,1),A:A,"<"&DATE(YEAR(TODAY())+1,1,1))
```

### 2. Google Apps Script

1. Apri il Google Sheets → **Estensioni** → **Apps Script**
2. Crea i seguenti file nel progetto (copia i contenuti dalla cartella `Script/`):
   - `Config.gs`
   - `Main.gs`
   - `Utils.gs`
   - `GestionePassword.gs`
   - `ReportCommercialista.gs`
   - `CalcoloCantieri.gs`
   - `SystemDiagnostic.gs`
3. Crea un file aggiuntivo e incolla il contenuto di `backend/code.gs`
4. Dal menu del foglio: **Sistema Gestionale** → **Inizializza sistema** (prima esecuzione)
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

## Aggiornamenti

### Frontend (index, dashboard, admin, config.js)
1. Modifica i file nel repository GitHub
2. Push → Vercel rideploya automaticamente

### Backend API (backend/code.gs)
1. Modifica il file in **Estensioni** → **Apps Script**
2. **Deploy** → **Gestisci distribuzioni** → **Modifica** → **Versione: Nuova**

### Script menu (Script/*.gs)
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
