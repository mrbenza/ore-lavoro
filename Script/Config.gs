// ===== CONFIG.GS - CONFIGURAZIONI CENTRALI =====

/**
 * Configurazioni globali del sistema
 */
const CONFIG = {
  // Database principale
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId(),
  
  // Fogli di sistema (non processare come dipendenti)
  SYSTEM_SHEETS: [
    'Amministrazione', 
    'Utenti', 
    'Cantieri', 
    'Foglio Cantieri Base', 
    'Foglio utente Base', 
    'Foglio Utenti Base', 
    'Tracking Archivi'
  ],
  
  // Cartelle Drive
  FOLDERS: {
    ARCHIVE: 'Archivi Ore Lavorate',
    REPORTS: 'Report Commercialista'
  },
  
  // Struttura dati
  DATA_STRUCTURE: {
    HEADER_ROWS: 4,
    COLUMNS: {
      DATA: 0,      // Colonna A - Data
      CANTIERE_ID: 1, // Colonna B - ID Cantiere
      CANTIERE_NOME: 2, // Colonna C - Nome Cantiere
      ORE: 3,       // Colonna D - Ore lavorate
      NOTE: 4       // Colonna E - Note
    }
  },
  
  // Date
  DATES: {
    CURRENT_YEAR: new Date().getFullYear(),
    get DEFAULT_ARCHIVE_YEAR() { return this.CURRENT_YEAR - 1; }
  },
  
  // Dati azienda
  COMPANY: {
    NAME: 'La Tua Azienda SRL',
    ADDRESS: 'Via Roma 123, 00100 Roma',
    VAT: 'IT12345678901',
    PHONE: '+39 06 1234567',
    EMAIL: 'info@tuaazienda.it'
  },
  
  // Tariffe orarie (per report commercialista)
  HOURLY_RATES: {
    DEFAULT: 25.00,
    OVERTIME: 35.00,
    HOLIDAY: 40.00
  },
  
  // Validazioni
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 4,
    MIN_YEAR: 2020,
    MAX_YEAR: 2030
  }
};

/**
 * Inizializza il sistema salvando l'ID dello spreadsheet
 */
function initializeSystem() {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    PropertiesService.getScriptProperties().setProperty('MAIN_SHEET_ID', spreadsheetId);
    console.log('Sistema inizializzato con ID:', spreadsheetId);
    return { success: true, message: 'Sistema inizializzato correttamente' };
  } catch (error) {
    console.error('Errore inizializzazione:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Ottiene lo spreadsheet principale
 */
function getMainSpreadsheet() {
  try {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } catch (error) {
    console.error('Errore apertura spreadsheet principale:', error);
    throw new Error('Impossibile accedere al database principale');
  }
}

/**
 * Verifica se un foglio è di sistema (da escludere dai dipendenti)
 */
function isSystemSheet(sheetName) {
  return CONFIG.SYSTEM_SHEETS.includes(sheetName) || 
         sheetName.includes('Base') || 
         sheetName.includes('_20');
}

/**
 * Valida un anno
 */
function isValidYear(year) {
  return year >= CONFIG.VALIDATION.MIN_YEAR && year <= CONFIG.VALIDATION.MAX_YEAR;
}

/**
 * Formatta nome file rimuovendo caratteri speciali
 */
function formatFileName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Ottiene data corrente formattata
 */
function getCurrentDateFormatted() {
  return new Date().toLocaleDateString('it-IT');
}

/**
 * Nomi mesi in italiano
 */
function getMonthName(monthNumber) {
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 
    'Maggio', 'Giugno', 'Luglio', 'Agosto', 
    'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  return months[monthNumber - 1] || 'Mese non valido';
}

/**
 * Costanti per messaggi di errore comuni
 */
const ERROR_MESSAGES = {
  NO_USERS: 'Nessun utente trovato nel sistema',
  NO_EMPLOYEES: 'Nessun dipendente attivo trovato',
  INVALID_YEAR: `Anno deve essere tra ${CONFIG.VALIDATION.MIN_YEAR} e ${CONFIG.VALIDATION.MAX_YEAR}`,
  SHEET_NOT_FOUND: (name) => `Foglio "${name}" non trovato`,
  PASSWORD_TOO_SHORT: `Password deve essere almeno ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caratteri`,
  OPERATION_CANCELLED: 'Operazione annullata dall\'utente',
  GENERIC_ERROR: 'Si è verificato un errore imprevisto'
};

/**
 * Costanti per messaggi di successo
 */
const SUCCESS_MESSAGES = {
  SYSTEM_INITIALIZED: 'Sistema inizializzato correttamente',
  ARCHIVE_COMPLETED: 'Archiviazione completata con successo',
  PASSWORD_UPDATED: 'Password aggiornata correttamente',
  REPORT_GENERATED: 'Report generato correttamente',
  CALCULATION_COMPLETED: 'Calcolo totali completato'
};
