# SHEET_SCHEMA.md — Schema Google Sheets

> Documentazione della struttura del database Google Sheets del progetto.
> Aggiornare dopo ogni modifica allo schema (responsabilità: Sheet Agent + Docs Agent).

---

## Foglio: `Utenti`

Contiene le credenziali e l'anagrafica di tutti gli utenti del sistema.

| Colonna | Header | Tipo | Esempio | Note |
|---------|--------|------|---------|------|
| A | ID Utente | String | `U001` | Identificativo univoco |
| B | Nome Completo | String | `Mario Rossi` | Corrisponde al nome del foglio dipendente |
| C | Email | String | `mario@azienda.com` | Email aziendale |
| D | Telefono | String | `3391234567` | Contatto |
| E | Data Assunzione | Date | `01/01/2024` | Formato DD/MM/YYYY |
| F | Ruolo | String | `Dipendente` | Valori: `Dipendente`, `Admin`, `Administrator` |
| G | Username | String | `mario.rossi` | Usato per il login |
| H | Password | String | `password123` | Plain text (auto-migra a hash al primo login) |
| I | Password Hash | String | `(hash SHA-256)` | Generato da `Authentication.gs` con salt fisso |
| J | Attivo | String | `Si` | Valori: `Si` = attivo, `No` = disattivo |

**Header dinamici:** `Authentication.gs` legge le intestazioni in riga 1 per mappare le colonne dinamicamente — non fare affidamento sulle posizioni fisse nel codice.

---

## Foglio: `Cantieri`

Anagrafica dei progetti/cantieri. Le colonne G-J sono aggiornate automaticamente da `CalcoloCantieri.gs`.

| Colonna | Header | Tipo | Esempio | Note |
|---------|--------|------|---------|------|
| A | ID Cantiere | String | `C001` | Identificativo univoco |
| B | Nome Progetto | String | `Costruzione Villa` | Nome visualizzato in dashboard |
| C | Indirizzo | String | `Via Roma 123, Milano` | Ubicazione cantiere |
| D | Stato Lavori | String | `Aperto` | Valori: `Aperto`, `Chiuso` — filtra cantieri attivi |
| ... | (colonne custom) | — | — | Eventuali colonne aggiuntive |
| G | Ore Totali | Number | `120` | Aggiornato automaticamente da `CalcoloCantieri.gs` |
| H | Ultimo Aggiornamento | Date | `15/01/2025` | Auto-riempito |
| I | Ultimo Dipendente | String | `Mario Rossi` | Auto-riempito |
| J | N. Inserimenti | Number | `8` | Contatore inserimenti, auto-riempito |

**Attenzione:** Le colonne G-J sono gestite dal backend. Non modificarle manualmente.

---

## Foglio: `[Nome Dipendente]`

Un foglio per ogni dipendente attivo. Il nome del foglio corrisponde al valore nella colonna B del foglio `Utenti` (Nome Completo).

### Struttura righe

| Colonna | Header (Riga 1) | Tipo | Esempio | Note |
|---------|----------------|------|---------|------|
| A | Data | Date | `15/01/2025` | Formato DD/MM/YYYY |
| B | Cantiere ID | String | `C001` | Riferimento a foglio Cantieri col. A |
| C | Nome Cantiere | String | `Costruzione Villa` | Denormalizzato per leggibilità |
| D | Ore | Number | `8` | Ore lavorate (max 24, deve essere numerico) |
| E | Note | String | `Lavori fondamenta` | Facoltativo |

### Celle riepilogative (lette da `Authentication.gs` / `UserAPI.gs`)

| Cella | Contenuto | Formula di esempio |
|-------|-----------|-------------------|
| F3 | Ore mese corrente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))` |
| G3 | Ore mese precedente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY())-1,1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY()),1))` |
| H3 | Ore anno corrente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),1,1),A:A,"<"&DATE(YEAR(TODAY())+1,1,1))` |

**Attenzione:** Le righe dati iniziano dalla riga 2. La riga 1 contiene gli header. Le celle F3, G3, H3 devono restare libere da inserimenti manuali.

---

## Foglio: `Amministrazione`

Foglio di sistema per tracking operazioni. Gestito internamente da GAS.

> Schema da documentare in dettaglio — attualmente in uso da `ArchivioOre.gs`.

---

## Fogli di sistema (non processati come dipendenti)

I seguenti fogli sono esclusi dal processing automatico dei dipendenti (definiti in `Config.gs → SYSTEM_SHEETS`):

- `Amministrazione`
- `Utenti`
- `Cantieri`
- `Foglio Cantieri Base`
- (eventuali altri fogli di template o sistema)

---

## Note generali

- **Formato date:** sempre `DD/MM/YYYY` su Sheets; le conversioni sono gestite da `Utils.gs`
- **ID univoci:** non riutilizzare ID cancellati (cantieri o utenti)
- **Aggiunta colonne:** coordinarsi con Code Agent — verificare che `Authentication.gs` e altri file non referenzino posizioni fisse
- **Nuovo dipendente:** creare il foglio con nome identico al campo "Nome Completo" in `Utenti`, poi aggiungere le formule in F3, G3, H3
