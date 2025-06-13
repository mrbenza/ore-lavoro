# 🏗️ Sistema Gestione Ore Lavoro

Sistema completo per la gestione delle ore di lavoro dei dipendenti con autenticazione sicura e integrazione Google Sheets.

## 🎯 Demo Live

**🔗 [Accedi al Sistema](https://tuo-username.github.io/work-hours-system/)**

### Credenziali di Test
- **UserID:** mario.rossi
- **Password:** nuovapassword123

## 🏗️ Architettura

```
Frontend (GitHub Pages) ←→ Google Apps Script ←→ Google Sheets
```

### **Frontend**
- Pagina login responsive
- Design moderno glassmorphism
- Autenticazione sicura
- Gestione errori avanzata

### **Backend**
- Google Apps Script come API server
- Integrazione diretta con Google Sheets
- Token di sessione
- Validazione utenti

### **Database**
- Google Sheets come database
- Struttura dati ottimizzata
- Calcoli automatici
- Backup automatico

## 🚀 Setup e Deploy

### 1. **Setup Google Apps Script**

1. Vai su [script.google.com](https://script.google.com)
2. Crea nuovo progetto
3. Incolla il codice del backend (fornito separatamente)
4. Salva come "Sistema Gestione Ore"

### 2. **Deploy del Google Apps Script**

1. Nel Google Apps Script: **Deploy** → **New deployment**
2. Tipo: **Web app**
3. Impostazioni:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. **Deploy** e copia l'URL

### 3. **Configurazione Frontend**

1. Apri `index.html`
2. Trova la riga:
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
   ```
3. Sostituisci `YOUR_SCRIPT_ID` con l'ID del tuo script

### 4. **Deploy su GitHub Pages**

1. Crea repository GitHub
2. Carica i file del progetto
3. Vai in **Settings** → **Pages**
4. Source: **Deploy from a branch**
5. Branch: **main** / **master**
6. Salva

### 5. **Configurazione Google Sheets**

Il sistema si collega al foglio Google Sheets con questa struttura:

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID Utente | Nome Completo | Email | Telefono | Ruolo | Data Assunzione | Stipendio Orario € | UserID | Password | Password Hash | Attivo | Ore Totali Mese | Guadagno Mese € |

## 🔧 Configurazione

### **Variabili da configurare:**

**Nel Google Apps Script:**
```javascript
const SPREADSHEET_ID = 'TUO_SPREADSHEET_ID';
const USER_SHEET_NAME = 'Nome_Foglio_Utenti';
```

**Nel frontend:**
```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TUO_SCRIPT_ID/exec';
```

## 🛡️ Sicurezza

- ✅ Autenticazione utente richiesta
- ✅ Token di sessione temporanei
- ✅ Validazione lato server
- ✅ Nessuna API key esposta
- ✅ Accesso controllato al database

## 📱 Funzionalità

### **Utenti**
- [x] Login sicuro
- [x] Visualizzazione profilo
- [x] Aggiornamento ore lavorate
- [x] Calcolo automatico stipendio

### **Amministratori**
- [x] Gestione dipendenti
- [x] Report mensili
- [x] Statistiche aziendali
- [x] Controllo accessi

### **Sistema**
- [x] Backup automatico Google Sheets
- [x] Scalabilità automatica
- [x] Deployment zero-config
- [x] Mobile responsive

## 🚀 API Endpoints

Il Google Apps Script espone questi endpoint:

### **POST** `/exec`

**Autenticazione:**
```json
{
  "action": "authenticate",
  "userId": "mario.rossi",
  "password": "password123"
}
```

**Informazioni Utente:**
```json
{
  "action": "getUserInfo",
  "sessionToken": "mario.rossi_1234567890_abc123"
}
```

**Aggiornamento Ore:**
```json
{
  "action": "updateHours",
  "sessionToken": "mario.rossi_1234567890_abc123",
  "hours": 8.5
}
```

**Report Mensile:**
```json
{
  "action": "getMonthlyReport",
  "sessionToken": "mario.rossi_1234567890_abc123"
}
```

## 🎨 Personalizzazione

### **Colori e Temi**
Modifica le variabili CSS in `index.html`:
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #f093fb;
}
```

### **Logo e Branding**
Sostituisci l'emoji logo con il tuo:
```html
<div class="logo">🏢</div>
```

## 📊 Struttura File

```
work-hours-system/
├── index.html          # Pagina login principale
├── README.md           # Documentazione
├── backend.js          # Codice Google Apps Script
└── assets/
    └── screenshots/    # Screenshot del sistema
```

## 🐛 Troubleshooting

### **Errore di connessione**
- Verifica l'URL del Google Apps Script
- Controlla che il deployment sia pubblico
- Verifica i permessi del foglio Google

### **Login non funziona**
- Controlla le credenziali nel foglio Google
- Verifica che l'utente sia attivo (colonna "Attivo" = "Si")
- Controlla i log del Google Apps Script

### **Errore CORS**
- Il Google Apps Script gestisce automaticamente CORS
- Verifica che il deployment sia pubblico

## 📈 Roadmap

- [ ] Dashboard utente completa
- [ ] Pannello admin avanzato
- [ ] Notifiche email automatiche
- [ ] App mobile (PWA)
- [ ] Integration con sistemi payroll
- [ ] Gestione ferie e permessi
- [ ] Timesheet dettagliati
- [ ] Reporting avanzato

## 🤝 Contributi

Contributi benvenuti! Apri una Issue o Pull Request.

## 📄 Licenza

MIT License - vedi [LICENSE](LICENSE) per dettagli.

---

**Sviluppato con ❤️ per la gestione efficiente delle ore di lavoro**
