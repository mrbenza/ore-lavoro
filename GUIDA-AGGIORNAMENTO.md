# Mini Guida Aggiornamento App

Checklist operativa per pubblicare una nuova versione del Sistema Gestione Ore.

## 1. Decidi cosa cambia

- Solo frontend: `index.html`, `dashboard.html`, `admin.html`, `config.js`, `news.json`, `api/proxy.js`.
- Backend Apps Script: uno o piu' file in `Script/*.gs`.
- Schema Google Sheets: colonne, fogli o formule documentate in `SHEET_SCHEMA.md` o `AMMINISTRAZIONE_SCHEMA.md`.

Se cambia lo schema, aggiorna prima il foglio Google Sheets e poi il codice che legge quelle colonne.

## 2. Aggiorna versione e novita'

In `config.js` aggiorna l'unica versione usata dall'app:

```js
VERSION: {
    frontend: '2.3.0'
}
```

Poi aggiorna `news.json`:

```json
{
  "version": "2.3.0",
  "title": "Novita' versione 2.3",
  "items": [
    "Prima novita' visibile agli utenti",
    "Seconda novita' visibile agli utenti"
  ]
}
```

Il modal novita' viene mostrato automaticamente al primo accesso degli utenti quando `CONFIG.VERSION.frontend` cambia.

## 3. Verifica locale

Esegui almeno:

```bash
npm run build
```

Per controllare il frontend in locale:

```bash
npm run dev
```

Apri `http://localhost:3000` e verifica login, dashboard dipendente, dashboard admin e modal novita'.

## 4. Pubblica frontend su Vercel

1. Fai commit e push sul repository collegato a Vercel.
2. Vercel ridistribuisce automaticamente il sito statico.
3. Verifica che la variabile `GOOGLE_APPS_SCRIPT_URL` sia ancora valorizzata nelle Environment Variables di Vercel.

## 5. Pubblica backend Apps Script

Se hai modificato file in `Script/*.gs`, copia i file aggiornati nel progetto Apps Script collegato al Google Sheets.

Per modifiche agli endpoint chiamati dal frontend crea una nuova versione della web app:

1. Apps Script -> Deploy -> Gestisci distribuzioni.
2. Modifica la distribuzione web app.
3. Versione -> Nuova versione.
4. Conferma e conserva l'URL `/exec`.

Se l'URL cambia, aggiorna `GOOGLE_APPS_SCRIPT_URL` su Vercel e ridistribuisci.

## 6. Controlli post-rilascio

- `index.html`: footer mostra la nuova versione.
- `dashboard.html`: il modal novita' appare al primo accesso.
- Dipendente: inserimento ore, calendario mensile, cambio password.
- Admin: lista dipendenti, panoramica cantieri, modifica/cancellazione ore, report.
- Google Sheets: menu "Sistema Gestionale" visibile e diagnostica senza errori critici.

## 7. Aggiorna documentazione

- `README.md`: changelog sintetico della release.
- `SHEET_SCHEMA.md`: solo se cambia la struttura dei fogli.
- `AGENTS.md`: solo se cambiano file, responsabilita' o flussi del progetto.
