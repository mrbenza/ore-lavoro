# MILESTONES.md - Funzionalita e Roadmap

Questo file riassume le funzionalita raggiunte e le prossime direzioni del progetto.

Per il dettaglio cronologico delle singole modifiche usare `Changelog.log`.
Per bug, anomalie e fix tecnici usare `FIXES.md`.

---

## Milestone raggiunte

### v1.0 - Base storica

- Prima versione operativa del gestionale ore.
- Codice storico conservato come riferimento in `backend/backupOLDcode.gs`.
- Gestione ore basata su Google Sheets e Apps Script.

### v2.0 - Stabilizzazione backend

- Backend Apps Script riorganizzato in moduli `Script/*.gs`.
- Costanti condivise per nomi foglio e colonne.
- Risposte API uniformate nel formato `{ success, message, data }`.
- Login con hash SHA-256 e migrazione da password in chiaro.
- Accesso colonne tramite header dinamici.
- Fallback per calcolo ore utente quando mancano formule riepilogative.

### v2.1 - Gestione admin completa

- Dashboard admin responsive.
- Sidebar desktop e tab bar mobile.
- Vista cantieri con stato e totali.
- Modifica stato cantiere.
- Calendario admin per dipendente.
- Modifica, creazione ed eliminazione registrazioni ore da admin.
- Gestione utenti: crea, attiva/disattiva, cambio password.
- Strumenti admin per verifica allineamento e ricalcolo cantieri.
- Foglio `Amministrazione` con aggregazioni statistiche.
- Trigger statistiche giornalieri e mensili.

### v2.2 - UX dipendente e versioning

- Calendario mensile dipendente.
- Warning ore duplicate prima del salvataggio.
- Cache mensile frontend per ridurre chiamate ripetute.
- Cambio password self-service.
- Modal novita al cambio versione.
- Versione frontend centralizzata in `config.js`.
- Footer login con versione dinamica.
- Guida aggiornamento app.

### Hardening corrente

- Proxy Vercel mantiene GET verso Apps Script ma maschera password, token e payload sensibili nei log.
- Modifica admin delle ore usa `rowIndex` per aggiornare la registrazione corretta quando ci sono piu entry nello stesso giorno.
- Contatore `N. Inserimenti` dei cantieri aggiornato in modo coerente su inserimento, modifica e cancellazione.
- Creazione utenti admin senza foglio personale automatico.
- Calendario admin dipendente ottimizzato: lista dipendenti condivisa, account non attivi visibili, totali azzerati visivamente con `--` durante il cambio selezione e risposte obsolete ignorate.
- Celle riepilogative fogli dipendente allineate al layout operativo: etichette in `F2:H2`, formule in `F3:H3`, fallback su righe dati da riga 5.
- Documentazione separata per presentazione, changelog, fix, schema fogli e milestone.

---

## Funzionalita principali attive

### Dipendenti

- Login.
- Inserimento ore.
- Calendario mensile.
- Warning duplicati.
- Cambio password.
- Auto-logout.
- Modal novita.

### Admin

- Dashboard dedicata.
- Panoramica cantieri.
- Calendario dipendente.
- Gestione utenti.
- Gestione password.
- Gestione stato cantieri.
- Modifica e cancellazione ore.
- Report commercialista.
- Statistiche aggregate.
- Diagnostica e strumenti di riallineamento.

### Google Sheets

- Database su fogli strutturati.
- Menu operativo custom.
- Report e archiviazione su Drive.
- Ricalcolo totali.
- Aggregazione statistiche.

---

## Roadmap proposta

### Priorita alta

- Rimuovere progressivamente la password in chiaro dal foglio `Utenti`, se non e' piu necessaria a livello operativo.
- Completare test manuali Apps Script sulle correzioni recenti: modifica multi-entry, contatore cantieri, creazione admin senza foglio.
- Aggiornare `SHEET_SCHEMA.md` se cambia il significato operativo di `N. Inserimenti`.

### Priorita media

- Ridurre il traffico sensibile in query string se si trova un deploy Apps Script affidabile con POST senza perdita body.
- Consolidare `README.md`, `PROJECT_MAP.md` e JSDoc per evitare duplicazioni.
- Aggiungere una checklist di test pre-release.
- Documentare meglio il ciclo di vita admin/dipendente.

### Priorita bassa

- Pulizia dead code marcato nei commenti.
- Miglioramento testi UI e uniformita terminologica.
- Miglioramento report e statistiche visuali.
