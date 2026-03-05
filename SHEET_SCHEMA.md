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
| F2 | Ore mese corrente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))` |
| G2 | Ore mese precedente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),MONTH(TODAY())-1,1),A:A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY()),1))` |
| H2 | Ore anno corrente | `=SUMIFS(D:D,A:A,">="&DATE(YEAR(TODAY()),1,1),A:A,"<"&DATE(YEAR(TODAY())+1,1,1))` |

**Attenzione:** Le righe dati iniziano dalla riga 2. La riga 1 contiene gli header. Le celle F2, G2, H2 devono restare libere da inserimenti manuali (non inserire mai dati nella riga 2 delle colonne F-H).

---

## Foglio: `Amministrazione`

Foglio di sistema per statistiche aggregate. Ospita tre tabelle distinte separate da colonne
vuota di separazione. Le tabelle sono popolate dallo script `Statistiche.gs` che gira
quotidianamente e mensilmente tramite trigger GAS. Il foglio non viene mai letto o scritto
da `ArchivioOre.gs`.

**Configurazione foglio:**
- Riga 1: header di ciascuna tabella (riga congelata)
- Dati a partire dalla riga 2
- Tre tabelle affiancate con colonne vuote di separazione tra di loro

---

### Tabella A — Ore Cantieri (colonne A–F, indici 0-based 0–5)

Una riga per ogni combinazione anno + mese + cantiere.

| Colonna | Indice (0-based) | Header | Tipo | Esempio | Note |
|---------|-----------------|--------|------|---------|------|
| A | 0 | `Anno` | Number | `2025` | Anno di riferimento |
| B | 1 | `Mese` | Number | `3` | Mese 1-12 |
| C | 2 | `CantiereId` | String | `C001` | Riferimento colonna A del foglio `Cantieri` |
| D | 3 | `NomeCantiere` | String | `Costruzione Villa` | Denormalizzato da foglio `Cantieri` col. B |
| E | 4 | `OreTotali` | Number | `120.5` | Somma ore di tutti i dipendenti per quel cantiere nel mese |
| F | 5 | `DataAggiornamento` | Date | `05/03/2025` | Formato DD/MM/YYYY, data ultimo aggiornamento riga |

**Colonna G (indice 6): vuota — separatore tra Tabella A e Tabella B.**

---

### Tabella B — Ore Dipendenti (colonne H–M, indici 0-based 7–12)

Una riga per ogni combinazione anno + mese + dipendente.

| Colonna | Indice (0-based) | Header | Tipo | Esempio | Note |
|---------|-----------------|--------|------|---------|------|
| H | 7 | `Anno` | Number | `2025` | Anno di riferimento |
| I | 8 | `Mese` | Number | `3` | Mese 1-12 |
| J | 9 | `UserId` | String | `mario.rossi` | Corrisponde a colonna G del foglio `Utenti` (Username) |
| K | 10 | `NomeDipendente` | String | `Mario Rossi` | Denormalizzato da foglio `Utenti` col. B |
| L | 11 | `OreTotali` | Number | `88` | Somma ore del dipendente nel mese |
| M | 12 | `DataAggiornamento` | Date | `05/03/2025` | Formato DD/MM/YYYY, data ultimo aggiornamento riga |

**Colonna N (indice 13): vuota — separatore tra Tabella B e Tabella C.**

---

### Tabella C — Riepilogo Annuale (colonne O–AE, indici 0-based 14–30)

Una riga per ogni combinazione anno + tipo entità (cantiere o dipendente) + entità.
Le 12 colonne mensili sono fisse (una per mese, da Gennaio a Dicembre).

| Colonna | Indice (0-based) | Header | Tipo | Esempio | Note |
|---------|-----------------|--------|------|---------|------|
| O | 14 | `Anno` | Number | `2025` | Anno di riferimento |
| P | 15 | `Tipo` | String | `cantiere` | Valori: `cantiere` oppure `dipendente` |
| Q | 16 | `EntityId` | String | `C001` | CantiereId o UserId a seconda del Tipo |
| R | 17 | `NomeEntita` | String | `Costruzione Villa` | Nome cantiere o nome dipendente |
| S | 18 | `OreGen` | Number | `40` | Ore totali Gennaio |
| T | 19 | `OreFeb` | Number | `35` | Ore totali Febbraio |
| U | 20 | `OreMar` | Number | `88` | Ore totali Marzo |
| V | 21 | `OreApr` | Number | `76` | Ore totali Aprile |
| W | 22 | `OreMag` | Number | `92` | Ore totali Maggio |
| X | 23 | `OreGiu` | Number | `80` | Ore totali Giugno |
| Y | 24 | `OreLug` | Number | `72` | Ore totali Luglio |
| Z | 25 | `OreAgo` | Number | `48` | Ore totali Agosto |
| AA | 26 | `OreSet` | Number | `88` | Ore totali Settembre |
| AB | 27 | `OreOtt` | Number | `96` | Ore totali Ottobre |
| AC | 28 | `OreNov` | Number | `84` | Ore totali Novembre |
| AD | 29 | `OreDic` | Number | `60` | Ore totali Dicembre |
| AE | 30 | `TotaleAnno` | Number | `859` | Somma ore annuali (OreGen + ... + OreDic) |

---

### Costante GAS — `SHEET_STATS` (da inserire in `Config.gs`)

```javascript
const SHEET_STATS = {
  SHEET_NAME: 'Amministrazione',
  CANTIERI: {
    START_COL: 0,   // col A
    ANNO: 0, MESE: 1, CANTIERE_ID: 2, NOME_CANTIERE: 3, ORE_TOTALI: 4, DATA_AGG: 5
  },
  DIPENDENTI: {
    START_COL: 7,   // col H
    ANNO: 7, MESE: 8, USER_ID: 9, NOME: 10, ORE_TOTALI: 11, DATA_AGG: 12
  },
  RIEPILOGO: {
    START_COL: 14,  // col O
    ANNO: 14, TIPO: 15, ENTITY_ID: 16, NOME: 17,
    MESI_START: 18, // col S = indice 18 (Gennaio)
    TOTALE_ANNO: 30 // col AE = indice 30
  }
};
```

**Attenzione:** Le tre tabelle condividono lo stesso foglio ma sono completamente
indipendenti. Lo script `Statistiche.gs` deve gestire ciascuna tabella come un range
separato, usando `START_COL` come punto di partenza per le operazioni di lettura/scrittura.

---

## Fogli di sistema (non processati come dipendenti)

I seguenti fogli sono esclusi dal processing automatico dei dipendenti (definiti in `Config.gs → SYSTEM_SHEETS`):

- `Amministrazione` — tracking operazioni interne
- `Utenti` — anagrafica e credenziali
- `Cantieri` — anagrafica progetti
- `Foglio Cantieri Base` — template foglio cantiere
- `Foglio utente Base` — template foglio dipendente (minuscolo)
- `Foglio Utenti Base` — template foglio dipendente (maiuscolo)
- `Tracking Archivi` — log delle operazioni di archiviazione

Oltre ai nomi espliciti, `isSystemSheet()` in `Config.gs` esclude automaticamente qualsiasi foglio il cui nome contiene `Base` o `_20` (pattern anni archiviati).

---

## Note generali

- **Formato date:** sempre `DD/MM/YYYY` su Sheets; le conversioni sono gestite da `Utils.gs`
- **ID univoci:** non riutilizzare ID cancellati (cantieri o utenti)
- **Aggiunta colonne:** coordinarsi con Code Agent — verificare che `Authentication.gs` e altri file non referenzino posizioni fisse
- **Nuovo dipendente:** creare il foglio con nome identico al campo "Nome Completo" in `Utenti`, poi aggiungere le formule in F3, G3, H3
