# Foglio `Amministrazione` — Schema e Guida

> **Progetto:** Gestione Ore Lavoro
> **File GAS di riferimento:** `Statistiche.gs`, `Config.gs`
> **Ultimo aggiornamento schema:** 2026-03-05

---

## Panoramica

Il foglio `Amministrazione` è il **database delle statistiche aggregate**. Non contiene inserimenti manuali — viene scritto esclusivamente da `Statistiche.gs` tramite trigger automatici o su richiesta dal menu.

Il foglio ospita **tre tabelle affiancate**, separate da colonne grigie (G e N). Ogni tabella ha uno scopo diverso e un colore header distinto.

```
A        F  G  H        M  N  O              AE  AH
┌──────────┐░░┌──────────┐░░┌──────────────────┐  ┌──────────┐
│TABELLA A │  │TABELLA B │  │    TABELLA C     │  │  GUIDA   │
│Cantieri  │  │Dipendenti│  │Riepilogo annuale │  │          │
│per mese  │  │per mese  │  │12 mesi + totale  │  │          │
└──────────┘░░└──────────┘░░└──────────────────┘  └──────────┘
```

**Riga 1:** header congelato, altezza 40px, font 11pt bold
**Riga 2+:** dati, una riga per entità
**Colonna G e N:** separatori visivi grigi — non contengono dati
**Colonna AH:** guida integrata (testo esplicativo)

---

## Tabella A — Ore Cantieri `(colonne A:F)`

**Header:** sfondo blu `#1a237e`
**Scopo:** ore lavorate per ogni cantiere, mese per mese
**Chiave univoca:** `Anno + Mese + CantiereId`

| Colonna | Indice¹ | Header | Tipo | Esempio | Descrizione |
|---------|---------|--------|------|---------|-------------|
| A | 0 | `Anno` | Number | `2026` | Anno di riferimento |
| B | 1 | `Mese` | Number | `3` | Mese 1–12 |
| C | 2 | `Cantiere ID` | String | `C001` | ID cantiere (da foglio `Cantieri` col. A) |
| D | 3 | `Nome Cantiere` | String | `Villa Rossi` | Nome denormalizzato da foglio `Cantieri` |
| E | 4 | `Ore Totali` | Number | `120.5` | Somma ore di tutti i dipendenti per quel cantiere nel mese |
| F | 5 | `Aggiornato` | Date | `05/03/2026` | Data ultimo aggiornamento (formato DD/MM/YYYY) |

¹ *Indici 0-based, come restituiti da `getValues()`.*

**Esempio dati:**
```
Anno  Mese  Cantiere ID  Nome Cantiere        Ore Totali  Aggiornato
2026  2     C001         Ristrutturazione...  120         05/03/2026
2026  2     C005         Casa Unifamiliare    40          05/03/2026
2026  3     C001         Ristrutturazione...  88          05/03/2026
```

---

## Tabella B — Ore Dipendenti `(colonne H:M)`

**Header:** sfondo verde `#1b5e20`
**Scopo:** ore lavorate da ogni dipendente, mese per mese
**Chiave univoca:** `Anno + Mese + UserId`

| Colonna | Indice | Header | Tipo | Esempio | Descrizione |
|---------|--------|--------|------|---------|-------------|
| H | 7 | `Anno` | Number | `2026` | Anno di riferimento |
| I | 8 | `Mese` | Number | `3` | Mese 1–12 |
| J | 9 | `User ID` | String | `mario.rossi` | Username (da foglio `Utenti` col. Username) |
| K | 10 | `Nome Dipendente` | String | `Mario Rossi` | Nome completo denormalizzato |
| L | 11 | `Ore Totali` | Number | `88` | Somma ore del dipendente nel mese |
| M | 12 | `Aggiornato` | Date | `05/03/2026` | Data ultimo aggiornamento (formato DD/MM/YYYY) |

**Esempio dati:**
```
Anno  Mese  User ID       Nome Dipendente  Ore Totali  Aggiornato
2026  2     mario.rossi   Mario Rossi      88          05/03/2026
2026  2     anna.neri     Anna Neri        96          05/03/2026
2026  3     luigi.bianchi Luigi Bianchi    72          05/03/2026
```

---

## Tabella C — Riepilogo Annuale `(colonne O:AE)`

**Header:** sfondo viola `#4a148c`
**Scopo:** visione annuale completa con breakdown mensile per ogni cantiere e dipendente
**Chiave univoca:** `Anno + Tipo + EntityId`

| Colonna | Indice | Header | Tipo | Esempio | Descrizione |
|---------|--------|--------|------|---------|-------------|
| O | 14 | `Anno` | Number | `2026` | Anno di riferimento |
| P | 15 | `Tipo` | String | `cantiere` | Valori possibili: `cantiere` oppure `dipendente` |
| Q | 16 | `Entity ID` | String | `C001` | CantiereId o UserId in base al Tipo |
| R | 17 | `Nome` | String | `Villa Rossi` | Nome cantiere o dipendente |
| S | 18 | `Gen` | Number | `40` | Ore totali Gennaio |
| T | 19 | `Feb` | Number | `35` | Ore totali Febbraio |
| U | 20 | `Mar` | Number | `88` | Ore totali Marzo |
| V | 21 | `Apr` | Number | `76` | Ore totali Aprile |
| W | 22 | `Mag` | Number | `92` | Ore totali Maggio |
| X | 23 | `Giu` | Number | `80` | Ore totali Giugno |
| Y | 24 | `Lug` | Number | `72` | Ore totali Luglio |
| Z | 25 | `Ago` | Number | `48` | Ore totali Agosto |
| AA | 26 | `Set` | Number | `88` | Ore totali Settembre |
| AB | 27 | `Ott` | Number | `96` | Ore totali Ottobre |
| AC | 28 | `Nov` | Number | `84` | Ore totali Novembre |
| AD | 29 | `Dic` | Number | `60` | Ore totali Dicembre |
| AE | 30 | `Totale Anno` | Number | `859` | Somma Gen–Dic |

**Calcolo `MESI_START + (mese - 1)`:**
Per accedere al mese M (1=Gen, 12=Dic) usare indice `18 + (M - 1)`.

**Esempio dati:**
```
Anno  Tipo        Entity ID     Nome          Gen  Feb  Mar  ...  Dic  Totale
2026  cantiere    C001          Villa Rossi   0    120  88   ...  0    312
2026  cantiere    C005          Casa Unif.    0    40   56   ...  0    148
2026  dipendente  mario.rossi   Mario Rossi   0    88   72   ...  0    640
```

---

## Separatori visivi

| Colonna | Larghezza | Ruolo |
|---------|-----------|-------|
| G | 18 px | Separatore Tabella A / Tabella B |
| N | 18 px | Separatore Tabella B / Tabella C |
| AH | 380 px | Guida integrata nel foglio |

> **Importante:** Non inserire dati nelle colonne G e N. Non modificare la colonna AH.

---

## Costante GAS `SHEET_STATS` (in `Config.gs`)

```javascript
const SHEET_STATS = {
  SHEET_NAME: 'Amministrazione',
  CANTIERI: {
    START_COL: 0,   // colonna A
    ANNO: 0, MESE: 1, CANTIERE_ID: 2, NOME_CANTIERE: 3, ORE_TOTALI: 4, DATA_AGG: 5
  },
  DIPENDENTI: {
    START_COL: 7,   // colonna H
    ANNO: 7, MESE: 8, USER_ID: 9, NOME: 10, ORE_TOTALI: 11, DATA_AGG: 12
  },
  RIEPILOGO: {
    START_COL: 14,  // colonna O
    ANNO: 14, TIPO: 15, ENTITY_ID: 16, NOME: 17,
    MESI_START: 18, // colonna S = Gennaio (indice 18)
    TOTALE_ANNO: 30 // colonna AE
  }
};
```

---

## Ciclo di aggiornamento

```
Ogni giorno 04:00
    └─► aggregaDatiGiornalieri()
            └─► _aggiornaStatsMese(anno, meseCorrente)
                    ├─► _upsertStatsCantieri()   → Tabella A
                    └─► _upsertStatsDipendenti() → Tabella B

1° del mese 04:00
    └─► aggregaDatiMensile()
            └─► _aggiornaStatsMese(anno, mesePassato)  ← snapshot mese chiuso
            └─► _aggiornaRiepilogoAnnuale(anno)         → Tabella C

Da menu / API
    └─► forzaAggregazioneCompleta()
            ├─► _aggiornaStatsMese(anno, 1..meseCorrente)  → Tabella A + B
            └─► _aggiornaRiepilogoAnnuale(anno)             → Tabella C
```

---

## API frontend

```javascript
// Lettura dati (admin only)
Utils.callAPI({ action: 'getStatistiche', sessionToken, anno: 2026 })
// → { success, anno, data: { cantieri[], dipendenti[], riepilogo[] } }

// Ricalcolo forzato (admin only, ~20-30 sec)
Utils.callAPI({ action: 'forzaAggregazione', sessionToken })
// → { success, message: 'Aggregazione completata' }
```

---

## Prima configurazione (run once)

1. Carica `Statistiche.gs` e `Config.gs` aggiornati su Apps Script
2. **Menu → Statistiche → Setup foglio Amministrazione**
   *(elimina e ricrea il foglio, lo posiziona in prima posizione, popola i dati)*
3. **Menu → Statistiche → Installa trigger automatici**
   *(configura trigger giornaliero 04:00 e mensile 1° del mese 04:00)*

> Se i dati sembrano mancanti: **Menu → Statistiche → Forza aggregazione completa**

---

## Note importanti

- Il foglio è nella lista `CONFIG.SYSTEM_SHEETS` → non viene mai processato come foglio dipendente
- `ArchivioOre.gs` **non** legge né scrive in questo foglio
- Le tabelle A e B crescono nel tempo (una riga per mese per entità)
- La tabella C viene sovrascritta ad ogni ricalcolo annuale (upsert per Anno+Tipo+EntityId)
- Le ore in tabella A/B sono aggregate **da tutti i fogli dipendente** leggendo colonna D (Ore) filtrata per data
- I dati partono dalla riga `CONFIG.DATA_STRUCTURE.HEADER_ROWS` (riga 5) nei fogli dipendente
