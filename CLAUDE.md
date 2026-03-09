# CLAUDE.md — Sistema Multi-Agente
## Progetto: Sistema Gestione Ore Lavoro v2.0
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
│   └── SheetsDAO.gs               ← data access layer per Google Sheets
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

1. **Separazione dei file — OBBLIGATORIA**
   Ogni agente tocca esclusivamente i propri file di competenza. L'Orchestrator non modifica mai file direttamente: delega sempre all'agente corretto tramite il tool `Agent`.

2. **Uso degli agenti — OBBLIGATORIO**
   Qualsiasi modifica a file `.gs` deve essere eseguita dal `gas-code-agent`.
   Qualsiasi modifica a file `.html` deve essere eseguita dal `ui-frontend-developer`.
   Qualsiasi modifica allo schema Sheets deve essere eseguita dallo `sheet-schema-expert`.
   L'Orchestrator non scrive codice direttamente: analizza, decide, delega.

3. **Test obbligatori** — Il `gas-code-agent` (o un agente test dedicato) verifica le modifiche prima di considerarle completate.

4. **Documentazione condizionale** — Il `code-review-docs` viene chiamato come ultimo step **solo se** le modifiche sono rilevanti per README, CLAUDE.md o roadmap. Per fix minori può essere omesso.

5. **Flusso standard:**
   ```
   Richiesta → ORCHESTRATOR (analizza e delega via Agent tool)
                    │
                    ├─► gas-code-agent       (modifica *.gs, api/proxy.js, config.js)
                    │     e/o
                    ├─► ui-frontend-developer (modifica *.html)
                    │     e/o
                    ├─► sheet-schema-expert  (modifica schema Sheets)
                    │
                    ├─► gas-code-agent       (verifica/test delle modifiche)
                    │
                    └─► code-review-docs     (documentazione, se necessario)
   ```

6. **Conflitti di schema** — Se `gas-code-agent` necessita di modifiche allo schema Sheets, l'Orchestrator coinvolge prima `sheet-schema-expert`.

7. **`backend/backupOLDcode.gs` è read-only** — nessun agente deve modificarlo.

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
| Documentazione codice | JSDoc ultra-dettagliato | Tutti i 14 file `.gs` e 4 file frontend documentati al 2026-03-04 |

---

## Note tecniche — Anomalie note (2026-03-04)

Queste anomalie sono state identificate durante la code review del 2026-03-04 e documentate inline nel codice con `// ⚠️`. Non sono state corrette per non alterare comportamenti esistenti.

1. `saveWorkEntry` transita anche via GET → dati in query string (sicurezza)
2. `logAdminAction()` in `AdminAPI.gs` non chiamata → audit log admin inattivo
3. `updateUserPassword()` scrive password in chiaro + hash nel foglio
4. `invalidateAdminCache()` è uno stub → cache scade solo per timeout
5. `ProductionLogger.api()` legge chiave config errata → API logging disabilitato

## Note tecniche — Cache e ottimizzazioni frontend (2026-03-09)

- `dashboard.html` usa `monthlyCache` (oggetto JS in memoria, chiave `'YYYY-MM'`) per evitare chiamate ripetute a `getMonthlyWorkData`. La cache viene invalidata dopo ogni `saveWorkEntry` riuscito, garantendo dati freschi al salvataggio successivo.
