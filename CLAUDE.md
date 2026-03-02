# CLAUDE.md — Sistema Multi-Agente
## Progetto: Sistema Gestione Ore Lavoro v2.3
**Stack:** Vercel (frontend) + Google Apps Script (backend) + Google Sheets (database)

---

## Struttura del progetto

```
ore-lavoro/
├── Script/                        ← backend GAS (CODE AGENT)
│   ├── Main.gs                    ← onOpen(), menu principale
│   ├── Config.gs                  ← costanti globali (ID foglio, azienda, validazione)
│   ├── Authentication.gs          ← login, session token, hash SHA-256
│   ├── ApiRouter.gs               ← doGet/doPost, routing verso moduli API
│   ├── AdminAPI.gs                ← API riservate agli admin
│   ├── UserAPI.gs                 ← API utenti (salvataggio ore, lettura mensile)
│   ├── Utils.gs                   ← logger, date, helper condivisi
│   ├── UtilsMenu.gs               ← dialog, input, messaggi UI Sheets
│   ├── ArchivioOre.gs             ← archiviazione annuale (Excel + PDF su Drive)
│   ├── GestionePassword.gs        ← cambio password da menu Sheets
│   ├── CalcoloCantieri.gs         ← ricalcolo totali ore per cantiere
│   ├── ReportCommercialista.gs    ← report PDF/Excel mensile e annuale
│   ├── SystemDiagnostic.gs        ← health check e diagnostica
│   └── SheetsDAO/                 ← data access layer per Google Sheets
│
├── backend/
│   └── backupOLDcode.gs           ← backup codice precedente (NON modificare)
│
├── api/
│   └── proxy.js                   ← proxy Vercel → Apps Script (gestione CORS)
│
├── index.html                     ← pagina login (UI AGENT)
├── dashboard.html                 ← dashboard dipendente (UI AGENT)
├── admin.html                     ← dashboard amministratore (UI AGENT)
├── config.js                      ← logica frontend: auth, PageGuard, utility
├── vercel.json                    ← configurazione deploy Vercel
├── CLAUDE.md                      ← questo file (DOCS AGENT)
└── SHEET_SCHEMA.md                ← schema Google Sheets (DOCS AGENT + SHEET AGENT)
```

---

## Agenti

### ORCHESTRATOR
Gestisce qualsiasi richiesta in ingresso e coordina gli altri agenti.
- Analizza la natura della richiesta
- Decide quale/i agente/i coinvolgere e in quale ordine
- Rispetta sempre le regole di coordinamento definite sotto

---

### CODE AGENT
**File di competenza:**
- `Script/*.gs` (tutti i 13 file)
- `api/proxy.js`
- `config.js`

**Compiti:**
- Bug fix sulla logica server-side GAS
- Implementazione logica business (salvataggio ore, autenticazione, report)
- Nuovi script GAS o moduli API
- Modifiche al routing (`ApiRouter.gs`) e alle API (`UserAPI.gs`, `AdminAPI.gs`)

**NON tocca:** file `.html`, `CLAUDE.md`, `SHEET_SCHEMA.md`, file di test

---

### UI AGENT
**File di competenza:**
- `index.html`
- `dashboard.html`
- `admin.html`

**Compiti:**
- Sviluppo e modifica componenti UI
- Ottimizzazione responsive/mobile
- Implementazione chiamate `google.script.run` o fetch verso `api/proxy.js`
- Gestione sessione lato frontend (auto-logout, PageGuard)

**NON tocca:** file `.gs`, `CLAUDE.md`, `SHEET_SCHEMA.md`

---

### TEST AGENT
**File di competenza:** `test_*.gs` (da creare in `Script/`)

**Compiti:**
- Scrivere test per ogni modifica di Code Agent o UI Agent
- Eseguire i test e riportare i risultati all'Orchestrator
- I test devono coprire: autenticazione, salvataggio ore, lettura dati, routing API

**NON tocca:** file di produzione `.gs` o `.html`

---

### SHEET AGENT
**File di competenza:** struttura Google Sheets (documentata in `SHEET_SCHEMA.md`)

**Fogli esistenti:**
- `Utenti` — credenziali e anagrafica utenti
- `Cantieri` — anagrafica progetti/cantieri
- `[Nome Dipendente]` — un foglio per ogni dipendente (registrazioni ore)
- `Amministrazione` — tracking operazioni di sistema

**Compiti:**
- Aggiunta nuove colonne o nuovi fogli
- Modifiche allo schema dati
- Mantenimento coerenza tra struttura Sheets e codice GAS
- Coordinamento con Code Agent prima di modificare colonne già referenziate nel codice

**NON tocca:** file `.gs`, file `.html`, `CLAUDE.md`

---

### DOCS AGENT
**File di competenza:**
- `CLAUDE.md`
- `SHEET_SCHEMA.md`

**Compiti:**
- Aggiornare `CLAUDE.md` dopo ogni modifica rilevante degli altri agenti
- Aggiornare `SHEET_SCHEMA.md` dopo ogni modifica di Sheet Agent
- Mantenere la struttura del progetto in questo file allineata con i file reali

**NON tocca:** file `.gs`, file `.html`

---

## Regole di coordinamento

1. **Separazione dei file** — Ogni agente tocca esclusivamente i propri file di competenza.

2. **Test obbligatori** — Test Agent viene sempre chiamato dopo Code Agent e dopo UI Agent, prima di considerare la modifica completata.

3. **Documentazione per ultima** — Docs Agent viene sempre chiamato come ultimo step.

4. **Flusso standard:**
   ```
   Richiesta → ORCHESTRATOR
                    │
                    ├─► CODE AGENT  e/o  UI AGENT  e/o  SHEET AGENT
                    │
                    ├─► TEST AGENT        (sempre, dopo ogni modifica)
                    │
                    └─► DOCS AGENT        (sempre, per ultimo)
   ```

5. **Conflitti di schema** — Se Code Agent deve modificare colonne referenziate, coordina prima con Sheet Agent tramite l'Orchestrator.

6. **`backend/backupOLDcode.gs` è read-only** — nessun agente deve modificarlo.

---

## Flusso dati

```
Browser (Vercel)
    │
    ├── index.html / dashboard.html / admin.html
    │         └── config.js  (logica auth frontend)
    │                   │
    │              api/proxy.js  (gestione CORS)
    │                   │
    │         ┌─────────▼──────────┐
    │         │  Google Apps Script │
    │         │  ApiRouter.gs       │
    │         │  (doGet / doPost)   │
    │         └──┬─────────────┬───┘
    │            │             │
    │     Authentication.gs   UserAPI.gs / AdminAPI.gs
    │            │             │
    │         ┌──▼─────────────▼───┐
    │         │   Google Sheets     │
    │         │   (database)        │
    │         └────────────────────┘
```

---

## Stack tecnico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | HTML/CSS/JS | Hosted su Vercel |
| Proxy | `api/proxy.js` | Node.js, gestisce CORS |
| Backend | Google Apps Script | Container-bound su Google Sheets |
| Database | Google Sheets | Schema documentato in `SHEET_SCHEMA.md` |
| Autenticazione | Session token + SHA-256 | Gestita da `Authentication.gs` |
| Archiviazione | Google Drive | Report PDF/Excel tramite `ArchivioOre.gs` |
