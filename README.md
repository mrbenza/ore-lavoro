# Sistema Gestione Ore Lavoro

Applicazione per registrare, controllare e rendicontare le ore lavorate dai dipendenti.

Il sistema usa un frontend statico su Vercel, un backend Google Apps Script e Google Sheets come database operativo.

**Versione app:** v2.2  
**Stato:** operativo

---

## Cosa fa

### Dipendenti

- Login con username e password.
- Inserimento ore per data, cantiere e note.
- Calendario mensile con le registrazioni gia inserite.
- Avviso se si stanno inserendo ore in una giornata gia compilata.
- Cambio password self-service dalla pagina Profilo.
- Auto-logout dopo inattivita.
- Modal novita al primo accesso dopo un cambio versione.

### Amministratori

- Dashboard dedicata dopo il login admin.
- Panoramica cantieri con ore del mese o totali assoluti.
- Calendario mensile per ogni dipendente, inclusi account non attivi; i totali ore vengono letti dalle celle riepilogative del foglio dipendente e mostrano `--` durante il cambio selezione.
- Creazione utenti dipendenti e admin.
- Attivazione/disattivazione account.
- Cambio password dipendente.
- Modifica, creazione ed eliminazione registrazioni ore.
- Verifica allineamento e ricalcolo totali cantieri.
- Report mensili e annuali per commercialista.
- Statistiche aggregate tramite foglio `Amministrazione`.

### Google Sheets

- `Utenti`: anagrafica, credenziali, ruoli e stato account.
- `Cantieri`: anagrafica cantieri e totali ore.
- `[Nome Dipendente]`: registrazioni ore del singolo dipendente.
- `Amministrazione`: aggregazioni statistiche e riepiloghi.

Gli admin non hanno bisogno di un foglio personale, a meno che debbano anche registrare ore come dipendenti.

Nei fogli dipendente le righe dati iniziano dalla riga 5. Le celle `F2:H2` contengono le etichette riepilogative, mentre `F3:H3` contengono le formule per mese corrente, mese precedente e anno corrente.

---

## Architettura

```text
Browser
  -> Vercel
       -> index.html / dashboard.html / admin.html
       -> config.js
       -> api/proxy.js
            -> Google Apps Script (Script/*.gs)
                 -> Google Sheets
```

Il frontend non chiama direttamente Google Apps Script. Le richieste passano da `api/proxy.js`, che gestisce CORS e inoltra verso l'URL Apps Script configurato in Vercel.

---

## File principali

```text
ore-lavoro/
├── index.html
├── dashboard.html
├── admin.html
├── config.js
├── news.json
├── api/
│   └── proxy.js
├── Script/
│   ├── Config.gs
│   ├── Main.gs
│   ├── ApiRouter.gs
│   ├── Authentication.gs
│   ├── UserAPI.gs
│   ├── AdminAPI.gs
│   ├── SheetsDAO.gs
│   ├── GestioneUtenti.gs
│   ├── GestionePassword.gs
│   ├── CalcoloCantieri.gs
│   ├── ReportCommercialista.gs
│   ├── ArchivioOre.gs
│   ├── Statistiche.gs
│   ├── SystemDiagnostic.gs
│   ├── Utils.gs
│   └── UtilsMenu.gs
└── documentazione
```

Gli script in `Script/*.gs` vanno copiati nello stesso progetto Apps Script collegato al Google Sheets.

---

## Documentazione

- [GUIDA-AGGIORNAMENTO.md](GUIDA-AGGIORNAMENTO.md): procedura breve per pubblicare una nuova versione.
- [MILESTONES.md](MILESTONES.md): funzionalita raggiunte e roadmap.
- [Changelog.log](Changelog.log): storico di tutte le modifiche effettuate.
- [FIXES.md](FIXES.md): bug scoperti, decisioni tecniche e fix risolti.
- [SHEET_SCHEMA.md](SHEET_SCHEMA.md): struttura del database Google Sheets.
- [AMMINISTRAZIONE_SCHEMA.md](AMMINISTRAZIONE_SCHEMA.md): struttura e logica del foglio `Amministrazione`.
- [PROJECT_MAP.md](PROJECT_MAP.md): mappa tecnica dettagliata del codice.
- [GUIDA-LOGO.md](GUIDA-LOGO.md): sostituzione del logo nella pagina login.
- [AGENTS.md](AGENTS.md): regole operative per agenti e responsabilita sui file.

---

## Setup rapido

### Google Sheets

1. Crea o apri il foglio Google Sheets usato come database.
2. Prepara i fogli documentati in [SHEET_SCHEMA.md](SHEET_SCHEMA.md).
3. Apri **Estensioni -> Apps Script**.
4. Crea i file Apps Script corrispondenti ai file in `Script/`.
5. Copia il contenuto dei file `.gs`.
6. Crea una distribuzione **App web**:
   - Esegui come: **Me**
   - Accesso: **Chiunque**
7. Copia l'URL `/exec` della distribuzione.

### Vercel

1. Importa il repository in Vercel.
2. Configura la variabile d'ambiente:

```text
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

3. Lascia il progetto statico: non serve build command.
4. Pubblica.

`config.js` usa gia l'endpoint relativo `/api/proxy`.

---

## Uso operativo

### Account

- Per disattivare un utente o un admin, imposta `Attivo = No` nel foglio `Utenti`.
- Gli utenti con `Attivo = No` non possono fare login.
- Gli admin con `Attivo = No` non superano la validazione admin.

### Cantieri

- I dipendenti vedono solo cantieri con stato `Aperto`.
- Gli admin possono vedere e gestire tutti i cantieri dalla dashboard.
- I totali cantieri vengono aggiornati dagli inserimenti ore e possono essere ricalcolati dagli strumenti admin.

### Report

I report commercialista si generano dal menu Google Sheets o dalla dashboard admin, in base alle funzioni esposte. I dati aziendali si configurano dal menu del foglio senza modificare codice.

---

## Versioning

La versione frontend e' definita in `config.js`:

```js
CONFIG.VERSION.frontend
```

`news.json` contiene il testo mostrato nel modal novita. Il confronto logico usa `CONFIG.VERSION.frontend`.

Per pubblicare una nuova versione, segui [GUIDA-AGGIORNAMENTO.md](GUIDA-AGGIORNAMENTO.md).

---

## Limiti

| Risorsa | Limite pratico |
|---|---|
| Dipendenti | circa 10 per uso ottimale |
| Google Sheets | 10 milioni di celle |
| Apps Script | 6 minuti per esecuzione |
| Sessione frontend | auto-logout dopo inattivita |
| Vercel proxy | timeout funzione 30 secondi |

---

## Licenza

MIT License.
