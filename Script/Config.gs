// ===== CONFIG.GS - CONFIGURAZIONI CENTRALI UNIFICATE =====
// Versione unificata: Menu GSheet + API Web
//
// Questo file è il cuore della configurazione del sistema.
// Contiene TUTTE le costanti condivise tra i moduli GAS e le funzioni
// helper di configurazione (initializeSystem, validateConfiguration, ecc.).
//
// USATO DA: tutti gli altri file .gs del progetto.
// NON modificare i valori di COLUMNS o COLUMNS_CANTIERI senza allineare SheetsDAO.gs,
// UserAPI.gs, AdminAPI.gs, Authentication.gs e SHEET_SCHEMA.md (tramite Sheet Agent).

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAZIONE PRODUZIONE — flag runtime che controllano logging e modalità.
// Usata da Utils.gs → oggetto Logger per decidere quali livelli stampare.
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,
  LOG_LEVEL: 'ERROR',
  LOG_AUTH: true,
  LOG_CRITICAL_ERRORS: true,
  LOG_SAVE_OPERATIONS: true
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — oggetto principale di configurazione.
// Contiene ID spreadsheet (letto da ScriptProperties), lista fogli di sistema,
// dati azienda, cartelle Drive, struttura dati, validazioni.
// USATO DA: tutti i moduli. Modificare SPREADSHEET_ID aggiornando la
// PropertiesService (via initializeSystem()), non hardcoding diretto.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  // Database principale
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID') || '',

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

  // Dati azienda — usati da ReportCommercialista.gs nella generazione report PDF/Excel
  COMPANY: {
    NAME: 'La Tua Azienda SRL',
    ADDRESS: 'Via Roma 123, 00100 Roma',
    VAT: 'IT12345678901',
    PHONE: '+39 06 1234567',
    EMAIL: 'info@tuaazienda.it'
  },

  // Cartelle Drive — usate da ArchivioOre.gs e ReportCommercialista.gs
  FOLDERS: {
    ARCHIVE: 'Archivi Ore Lavorate',
    REPORTS: 'Report Commercialista'
  },

  // Struttura dati — descrive la posizione delle colonne nei fogli dipendente (riga base 4, dati da riga 5)
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

  // Date — usate per default archiviazione e report
  DATES: {
    CURRENT_YEAR: new Date().getFullYear(),
    get DEFAULT_ARCHIVE_YEAR() { return this.CURRENT_YEAR - 1; }
  },

  // Tariffe orarie — non attualmente usate nella logica, presenti per uso futuro
  HOURLY_RATES: {
    DEFAULT: 25.00,
    OVERTIME: 35.00,
    HOLIDAY: 40.00
  },

  // Validazioni — valori limite per ore, password, anno, testi
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

// ─────────────────────────────────────────────────────────────────────────────
// NOMI FOGLI — costanti per i fogli di sistema principali.
// Usare SEMPRE queste costanti negli accessor (getSheetByName, getSheetSafely).
// NON usare stringhe letterali come 'Cantieri' o 'Utenti' nel codice GAS.
// ─────────────────────────────────────────────────────────────────────────────
const USER_SHEET_NAME = 'Utenti'; // Legacy alias — preferire SHEET_NAMES.UTENTI

const SHEET_NAMES = {
  UTENTI: 'Utenti',
  CANTIERI: 'Cantieri',
  AMMINISTRAZIONE: 'Amministrazione'
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM_INFO — metadati versione sistema esposti dal ping endpoint.
// Restituiti da handlePing() in ApiRouter.gs.
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_INFO = {
  version: '2.0',
  build: '2026.03.02 - Modulare',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Container-bound script modulare',
  features: ['Hash Password SHA-256', 'CORS Headers', 'Calendario', 'Admin Dashboard'],
  installType: 'CONTAINER_BOUND_MODULAR'
};

// ─────────────────────────────────────────────────────────────────────────────
// COLUMNS — mapping colonne del foglio "Utenti" (indici 0-based).
// Usato da Authentication.gs, UserAPI.gs, AdminAPI.gs, SheetsDAO.gs.
// ATTENZIONE: questi indici fissi sono un fallback; il codice preferisce il
// mapping dinamico tramite buildColumnMap() (Utils.gs).
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// COLUMNS_CANTIERI — mapping colonne del foglio "Cantieri" (indici 0-based).
// Usato da SheetsDAO.gs (updateCantiereHours, getCantieri) e AdminAPI.gs.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// USER_SHEET_CELLS — celle riepilogative nel foglio personale del dipendente.
// Lette da Authentication.gs (getUserHoursFromSheet) e AdminAPI.gs
// (getDipendenteTimelineAdmin). Se le formule SUMIFS sono assenti, il codice
// cade in fallback calcolando le ore dalle righe dati.
// ─────────────────────────────────────────────────────────────────────────────
const USER_SHEET_CELLS = {
  ORE_MESE_CORRENTE: 'F2',
  ORE_MESE_PRECEDENTE: 'G2',
  ANNO_CORRENTE: 'H2'
};

// ─────────────────────────────────────────────────────────────────────────────
// USER_ROLES — ruoli utente riconosciuti dal sistema.
// La verifica effettiva dei ruoli avviene in Authentication.gs (validateAdmin)
// e in varie funzioni admin con confronto case-insensitive.
// ─────────────────────────────────────────────────────────────────────────────
const USER_ROLES = {
  ADMIN: 'Admin',
  ADMINISTRATOR: 'Administrator',
  DIPENDENTE: 'Dipendente'
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN_CONFIG — configurazione specifica per le funzioni admin.
// Usata da AdminAPI.gs per cache, timeframe e modalità cantieri.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN_VALIDATION — oggetto con funzioni di validazione per parametri admin.
// Usato da AdminAPI.gs prima di eseguire operazioni privilegiate.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// CACHE_CONFIG — durate cache (secondi) per le varie chiavi admin.
// Usato da AdminAPI.gs → getCantieriAdminOverview() con CacheService.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN_DEBUG — logger specifico per operazioni admin con flag ENABLED.
// Separato dal Logger di Utils.gs per permettere toggle indipendente.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION_RULES — regole di validazione condivise (duplica parziale di
// CONFIG.VALIDATION per retrocompatibilità con moduli che la referenziano).
// ─────────────────────────────────────────────────────────────────────────────
const VALIDATION_RULES = {
  MIN_HOURS: 0,
  MAX_HOURS: 24,
  MIN_PASSWORD_LENGTH: 4,
  MAX_WORK_DESCRIPTION: 500,
  MAX_NOTES: 200
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR_MESSAGES — messaggi di errore user-facing centralizzati.
// Usati in ArchivioOre.gs, ReportCommercialista.gs, CalcoloCantieri.gs.
// NOTA: Le stringhe letterali come 'Foglio "Cantieri" non trovato' sono testo
// UI e NON devono referenziare SHEET_NAMES (solo gli accessor lo devono fare).
// ─────────────────────────────────────────────────────────────────────────────
const ERROR_MESSAGES = {
  NO_USERS: 'Nessun utente trovato nel sistema',
  NO_EMPLOYEES: 'Nessun dipendente attivo trovato',
  INVALID_YEAR: `Anno deve essere tra ${CONFIG.VALIDATION.MIN_YEAR} e ${CONFIG.VALIDATION.MAX_YEAR}`,
  SHEET_NOT_FOUND: (name) => `Foglio "${name}" non trovato`,
  PASSWORD_TOO_SHORT: `Password deve essere almeno ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caratteri`,
  OPERATION_CANCELLED: 'Operazione annullata dall\'utente',
  GENERIC_ERROR: 'Si è verificato un errore imprevisto'
};

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS_MESSAGES — messaggi di successo user-facing centralizzati.
// Attualmente non tutti sono usati attivamente; presenti per coerenza API.
// ─────────────────────────────────────────────────────────────────────────────
const SUCCESS_MESSAGES = {
  SYSTEM_INITIALIZED: 'Sistema inizializzato correttamente',
  ARCHIVE_COMPLETED: 'Archiviazione completata con successo',
  PASSWORD_UPDATED: 'Password aggiornata correttamente',
  REPORT_GENERATED: 'Report generato correttamente',
  CALCULATION_COMPLETED: 'Calcolo totali completato'
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNZIONI HELPER CONFIGURAZIONE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salva l'ID dello spreadsheet attivo nelle ScriptProperties.
 *
 * Questa funzione deve essere eseguita manualmente la prima volta che lo script
 * viene collegato a un nuovo spreadsheet. Imposta MAIN_SHEET_ID che viene poi
 * letto da CONFIG.SPREADSHEET_ID all'avvio del runtime GAS.
 *
 * FLUSSO INTERNO:
 *   1. Legge l'ID dello spreadsheet attivo tramite SpreadsheetApp.getActiveSpreadsheet()
 *   2. Salva l'ID in ScriptProperties con chiave 'MAIN_SHEET_ID'
 *   3. Restituisce oggetto {success, message}
 *
 * CHIAMATA DA: Main.gs → initializeSystemSetup() → executeSystemInitialization()
 * CHIAMA:      SpreadsheetApp.getActiveSpreadsheet(), PropertiesService.getScriptProperties()
 *
 * @returns {{ success: boolean, message: string }} Risultato operazione.
 *
 * @example
 * const res = initializeSystem();
 * // res → { success: true, message: 'Sistema inizializzato correttamente' }
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
 * Apre e restituisce lo spreadsheet principale del sistema.
 *
 * Prova prima con CONFIG.SPREADSHEET_ID (da ScriptProperties); se non presente
 * usa lo spreadsheet attivo come fallback. Lancia eccezione se inaccessibile.
 *
 * FLUSSO INTERNO:
 *   1. Legge CONFIG.SPREADSHEET_ID (da PropertiesService)
 *   2. Se presente apre con SpreadsheetApp.openById()
 *   3. Altrimenti usa SpreadsheetApp.getActiveSpreadsheet()
 *
 * CHIAMATA DA: ArchivioOre.gs, CalcoloCantieri.gs, ReportCommercialista.gs,
 *              GestionePassword.gs, Authentication.gs (validateAdmin),
 *              SystemDiagnostic.gs
 * CHIAMA:      SpreadsheetApp.openById()
 *
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} Lo spreadsheet principale.
 * @throws {Error} Se lo spreadsheet non è accessibile.
 */
function getMainSpreadsheet() {
  try {
    var id = CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId();
    return SpreadsheetApp.openById(id);
  } catch (error) {
    console.error('Errore apertura spreadsheet principale:', error);
    throw new Error('Impossibile accedere al database principale');
  }
}

/**
 * Verifica se un nome foglio appartiene all'elenco dei fogli di sistema.
 *
 * Fogli di sistema sono quelli elencati in CONFIG.SYSTEM_SHEETS, più quelli
 * contenenti la parola 'Base' (template) o '_20' (archivi con anno nel nome).
 * Usata da UtilsMenu.gs (getActiveEmployeeNames) e SystemDiagnostic.gs per
 * escludere i fogli non-dipendente dalle elaborazioni.
 *
 * CHIAMATA DA: UtilsMenu.gs → getActiveEmployeeNames()
 *              SystemDiagnostic.gs → checkSystemHealth(), performSystemDiagnostics()
 * CHIAMA:      (nessuna)
 *
 * @param {string} sheetName - Nome del foglio da verificare.
 * @returns {boolean} true se il foglio è di sistema, false se è un foglio dipendente.
 *
 * @example
 * isSystemSheet('Utenti')     // → true
 * isSystemSheet('Mario Rossi') // → false
 * isSystemSheet('Mario_2023') // → true  (contiene '_20')
 */
function isSystemSheet(sheetName) {
  return CONFIG.SYSTEM_SHEETS.includes(sheetName) ||
         sheetName.includes('Base') ||
         sheetName.includes('_20');
}

/**
 * Verifica se un anno è nel range configurato (MIN_YEAR..MAX_YEAR).
 *
 * CHIAMATA DA: ArchivioOre.gs (validateYear in UtilsMenu.gs la usa internamente)
 * CHIAMA:      (nessuna)
 *
 * @param {number} year - Anno da validare.
 * @returns {boolean} true se l'anno è valido.
 */
function isValidYear(year) {
  return year >= CONFIG.VALIDATION.MIN_YEAR && year <= CONFIG.VALIDATION.MAX_YEAR;
}

/**
 * Formatta una stringa per uso come nome file rimuovendo caratteri speciali.
 *
 * Sostituisce qualsiasi carattere non alfanumerico (tranne - e _) con
 * underscore, poi collassa underscore multipli. Usata da ArchivioOre.gs e
 * ReportCommercialista.gs per costruire nomi file Drive.
 *
 * CHIAMATA DA: ArchivioOre.gs → createArchiveStructure()
 *              ReportCommercialista.gs → createEmployeeMonthlyReport(), createSummaryReport()
 * CHIAMA:      (nessuna)
 *
 * @param {string} name - Stringa da normalizzare (es. nome dipendente).
 * @returns {string} Stringa normalizzata sicura per nomi file.
 *
 * @example
 * formatFileName('Mario Rossi (2025)') // → 'Mario_Rossi__2025_'
 */
function formatFileName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Restituisce la data corrente formattata in italiano (DD/MM/YYYY).
 *
 * CHIAMATA DA: non risulta chiamata da altri file  // ⚠️ DEAD CODE: non risulta chiamata da altri file
 * CHIAMA:      (nessuna)
 *
 * @returns {string} Data corrente nel formato locale italiano.
 */
function getCurrentDateFormatted() {
  return new Date().toLocaleDateString('it-IT');
}

/**
 * Converte un numero di mese (1-12) nel nome italiano corrispondente.
 *
 * Usata da ReportCommercialista.gs per etichettare report mensili e da
 * ApiRouter.gs → testGetMonthlyWorkData() nei test.
 *
 * CHIAMATA DA: ReportCommercialista.gs → generateMonthlyReportComplete(),
 *              executeTestSingleReport()
 * CHIAMA:      (nessuna)
 *
 * @param {number} monthNumber - Numero del mese (1 = Gennaio, 12 = Dicembre).
 * @returns {string} Nome del mese in italiano, o 'Mese non valido' se fuori range.
 *
 * @example
 * getMonthName(3)  // → 'Marzo'
 * getMonthName(13) // → 'Mese non valido'
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
 * Verifica che la configurazione di sistema sia valida controllando i fogli essenziali.
 *
 * Controlla l'esistenza del foglio 'Utenti' e del foglio 'Cantieri'.
 * Usata da testConfig() e potenzialmente da SystemDiagnostic.gs.
 *
 * FLUSSO INTERNO:
 *   1. Apre lo spreadsheet con getMainSpreadsheet()
 *   2. Controlla presenza foglio Utenti
 *   3. Controlla presenza foglio Cantieri
 *   4. Restituisce { valid, errors }
 *
 * CHIAMATA DA: testConfig() (questo file)
 * CHIAMA:      getMainSpreadsheet()
 *
 * @returns {{ valid: boolean, errors: string[] }} Risultato validazione.
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
 * Esegue un test di configurazione e stampa i risultati nel log GAS.
 *
 * Funzione di debug da eseguire manualmente dall'editor GAS per verificare
 * lo stato del sistema. Non viene chiamata in produzione.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      validateConfiguration()
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
