// ===== CONFIG.GS - CONFIGURAZIONI CENTRALI UNIFICATE =====
// Versione unificata: Menu GSheet + API Web

// ========================================
// CONFIGURAZIONE PRODUZIONE (per API)
// ========================================
const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,
  LOG_LEVEL: 'ERROR',
  LOG_AUTH: true,
  LOG_CRITICAL_ERRORS: true,
  LOG_SAVE_OPERATIONS: true
};
// ========================================
// CONFIGURAZIONE PRINCIPALE
// ========================================

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
  
  // Dati azienda
  COMPANY: {
    NAME: 'La Tua Azienda SRL',
    ADDRESS: 'Via Roma 123, 00100 Roma',
    VAT: 'IT12345678901',
    PHONE: '+39 06 1234567',
    EMAIL: 'info@tuaazienda.it'
  },

  // Cartelle Drive
  FOLDERS: {
    ARCHIVE: 'Archivi Ore Lavorate',
    REPORTS: 'Report Commercialista'
  },
  
  // Struttura dati
  DATA_STRUCTURE: {
    HEADER_ROWS: 4,
    COLUMNS: {
      DATA: 0,          // Colonna A - Data
      CANTIERE_ID: 1,   // Colonna B - ID Cantiere
      CANTIERE_NOME: 2, // Colonna C - Nome Cantiere
      ORE: 3,           // Colonna D - Ore lavorate
      NOTE: 4           // Colonna E - Note
    }
  },
  
  // Date
  DATES: {
    CURRENT_YEAR: new Date().getFullYear(),
    get DEFAULT_ARCHIVE_YEAR() { return this.CURRENT_YEAR - 1; }
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
    MAX_YEAR: 2030,
    MIN_HOURS: 0,
    MAX_HOURS: 24,
    MAX_WORK_DESCRIPTION: 500,
    MAX_NOTES: 200
  }
};

// ========================================
// NOMI FOGLI (per API)
// ========================================
const USER_SHEET_NAME = 'Utenti';

const SHEET_NAMES = {
  UTENTI: 'Utenti',
  CANTIERI: 'Cantieri',
  AMMINISTRAZIONE: 'Amministrazione'
};

// ========================================
// INFO SISTEMA (per API)
// ========================================
const SYSTEM_INFO = {
  version: '2.0',
  build: '2026.03.02 - Modulare',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Container-bound script modulare',
  features: ['Hash Password SHA-256', 'CORS Headers', 'Calendario', 'Admin Dashboard'],
  installType: 'CONTAINER_BOUND_MODULAR'
};

// ========================================
// MAPPING COLONNE FOGLIO UTENTI
// ========================================
const COLUMNS = {
  ID_UTENTE: 0,        // Colonna A
  NOME: 1,             // Colonna B  
  EMAIL: 2,            // Colonna C
  TELEFONO: 3,         // Colonna D
  DATA_ASSUNZIONE: 4,  // Colonna E
  RUOLO: 5,            // Colonna F
  USER_ID: 6,          // Colonna G - Username
  PASSWORD: 7,         // Colonna H
  PASSWORD_HASH: 8,    // Colonna I
  ATTIVO: 9            // Colonna J
};

// ========================================
// MAPPING COLONNE FOGLIO CANTIERI
// ========================================
const COLUMNS_CANTIERI = {
  ID: 0,
  NOME: 1,
  INDIRIZZO: 2,
  STATO: 3,
  DATA_INIZIO: 4,
  DATA_FINE: 5,
  ORE_TOTALI: 6,
  ULTIMO_UPDATE: 7,
  ULTIMO_DIPENDENTE: 8,
  NUM_INSERIMENTI: 9
};

// ========================================
// CELLE ORE UTENTE
// ========================================
const USER_SHEET_CELLS = {
  ORE_MESE_CORRENTE: 'F2',
  ORE_MESE_PRECEDENTE: 'G2',
  ANNO_CORRENTE: 'H2'
};

// ========================================
// RUOLI UTENTE
// ========================================
const USER_ROLES = {
  ADMIN: 'Admin',
  ADMINISTRATOR: 'Administrator',
  DIPENDENTE: 'Dipendente'
};

// ========================================
// CONFIGURAZIONE ADMIN
// ========================================
const ADMIN_CONFIG = {
  REQUIRED_ROLES: ['Admin', 'Administrator', 'admin', 'administrator'],
  REFRESH_INTERVAL: 300000, // 5 minuti
  DEFAULT_TIMEFRAME: '30days',
  
  TIMEFRAMES: {
    THIRTY_DAYS: '30days',
    LAST_MONTH: 'lastMonth',
    CURRENT_YEAR: 'year'
  },
  
  CANTIERI_MODES: {
    MESE_CORRENTE: 'mese',
    TOTALI_ASSOLUTI: 'totali'
  }
};

// ========================================
// VALIDAZIONI ADMIN
// ========================================
const ADMIN_VALIDATION = {
  VALID_TIMEFRAMES: ['30days', 'lastMonth', 'year'],
  VALID_CANTIERI_MODES: ['mese', 'totali'],
  REQUIRED_ROLES: ['Admin', 'Administrator', 'admin', 'administrator'],
  
  isAdminRole: function(ruolo) {
    if (!ruolo) return false;
    return this.REQUIRED_ROLES.some(r => r.toLowerCase() === ruolo.toLowerCase());
  },
  
  isValidTimeframe: function(timeframe) {
    return this.VALID_TIMEFRAMES.includes(timeframe);
  },
  
  isValidCantieriMode: function(mode) {
    return this.VALID_CANTIERI_MODES.includes(mode);
  }
};

// ========================================
// CACHE ADMIN
// ========================================
const CACHE_CONFIG = {
  CANTIERI_OVERVIEW: 1800,     // 30 minuti
  DIPENDENTI_LIST: 300,        // 5 minuti  
  USER_TIMELINE: 600,          // 10 minuti
  TIMELINE_DATA: 120,          // 2 minuti
  
  CACHE_KEYS: {
    CANTIERI_TOTALI: 'admin_cantieri_totali',
    CANTIERI_MESE: 'admin_cantieri_mese_',
    DIPENDENTI: 'admin_dipendenti_list',
    TIMELINE: 'admin_timeline_'
  }
};

// ========================================
// DEBUG ADMIN
// ========================================
const ADMIN_DEBUG = {
  ENABLED: true,
  LOG_PERFORMANCE: true,
  
  log: function(message, data = null) {
    if (this.ENABLED) {
      console.log(`[ADMIN] ${message}`, data || '');
    }
  },
  
  logPerformance: function(operation, startTime) {
    if (this.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`[ADMIN PERF] ${operation}: ${duration}ms`);
    }
  }
};

// ========================================
// VALIDAZIONE ORE E NUMERI
// ========================================
const VALIDATION_RULES = {
  MIN_HOURS: 0,
  MAX_HOURS: 24,
  MIN_PASSWORD_LENGTH: 4,
  MAX_WORK_DESCRIPTION: 500,
  MAX_NOTES: 200
};

// ========================================
// MESSAGGI ERRORE
// ========================================
const ERROR_MESSAGES = {
  NO_USERS: 'Nessun utente trovato nel sistema',
  NO_EMPLOYEES: 'Nessun dipendente attivo trovato',
  INVALID_YEAR: `Anno deve essere tra ${CONFIG.VALIDATION.MIN_YEAR} e ${CONFIG.VALIDATION.MAX_YEAR}`,
  SHEET_NOT_FOUND: (name) => `Foglio "${name}" non trovato`,
  PASSWORD_TOO_SHORT: `Password deve essere almeno ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caratteri`,
  OPERATION_CANCELLED: 'Operazione annullata dall\'utente',
  GENERIC_ERROR: 'Si è verificato un errore imprevisto'
};

// ========================================
// MESSAGGI SUCCESSO
// ========================================
const SUCCESS_MESSAGES = {
  SYSTEM_INITIALIZED: 'Sistema inizializzato correttamente',
  ARCHIVE_COMPLETED: 'Archiviazione completata con successo',
  PASSWORD_UPDATED: 'Password aggiornata correttamente',
  REPORT_GENERATED: 'Report generato correttamente',
  CALCULATION_COMPLETED: 'Calcolo totali completato'
};

// ========================================
// FUNZIONI HELPER CONFIGURAZIONE
// ========================================

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
 * Verifica configurazione valida
 */
function validateConfiguration() {
  const errors = [];
  
  try {
    const ss = getMainSpreadsheet();
    
    // Verifica foglio Utenti
    if (!ss.getSheetByName(USER_SHEET_NAME)) {
      errors.push('Foglio "' + USER_SHEET_NAME + '" non trovato');
    }
    
    // Verifica foglio Cantieri
    if (!ss.getSheetByName(SHEET_NAMES.CANTIERI)) {
      errors.push('Foglio "Cantieri" non trovato');
    }
    
  } catch (error) {
    errors.push('Errore accesso spreadsheet: ' + error.message);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Test configurazione
 */
function testConfig() {
  console.log('=== TEST CONFIGURAZIONE UNIFICATA ===');
  console.log('Spreadsheet ID:', CONFIG.SPREADSHEET_ID);
  console.log('Versione:', SYSTEM_INFO.version);
  console.log('Build:', SYSTEM_INFO.build);
  
  const validation = validateConfiguration();
  console.log('Configurazione valida:', validation.valid);
  
  if (!validation.valid) {
    console.log('Errori:', validation.errors);
  }
  
  console.log('=== TEST COMPLETATO ===');
}
