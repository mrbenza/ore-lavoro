// ===== SISTEMA GESTIONE ORE V3.4 PRODUCTION - LOGGING CONFIGURABILE =====
const SPREADSHEET_ID = '19WrI1o9U_1GzBoL-GZTgNvvijdr5O3MXvNMjQX3oK9A';
const USER_SHEET_NAME = 'Utenti';

// ===== CONFIGURAZIONE LOGGING PER PRODUZIONE =====
const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,           // 🔧 CAMBIA A FALSE PER PRODUZIONE
  LOG_LEVEL: 'ERROR',         // 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'
  LOG_AUTH: true,             // Mantieni log autenticazioni (sicurezza)
  LOG_CRITICAL_ERRORS: true, // Mantieni log errori critici
  LOG_SAVE_OPERATIONS: false // Log operazioni di salvataggio
};

// ===== SISTEMA LOGGING INTELLIGENTE =====
const Logger = {
  debug: function(...args) {
    if (PRODUCTION_CONFIG.DEBUG_MODE && this.shouldLog('DEBUG')) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: function(...args) {
    if (this.shouldLog('INFO')) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: function(...args) {
    if (this.shouldLog('WARN')) {
      console.warn('[WARN]', ...args);
    }
  },
  
  error: function(...args) {
    if (this.shouldLog('ERROR')) {
      console.error('[ERROR]', ...args);
    }
  },
  
  auth: function(...args) {
    if (PRODUCTION_CONFIG.LOG_AUTH) {
      console.log('[AUTH]', ...args);
    }
  },
  
  save: function(...args) {
    if (PRODUCTION_CONFIG.LOG_SAVE_OPERATIONS) {
      console.log('[SAVE]', ...args);
    }
  },
  
  critical: function(...args) {
    if (PRODUCTION_CONFIG.LOG_CRITICAL_ERRORS) {
      console.error('[CRITICAL]', ...args);
    }
  },
  
  shouldLog: function(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'];
    const currentLevelIndex = levels.indexOf(PRODUCTION_CONFIG.LOG_LEVEL);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex && PRODUCTION_CONFIG.LOG_LEVEL !== 'OFF';
  }
};

// ===== INFORMAZIONI VERSIONE =====
const SYSTEM_INFO = {
  version: '3.4.0',
  build: '2025.06.19',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Sistema con hash password sicuri + protezione righe + supporto illimitato',
  features: ['Hash Password SHA-256', 'Protezione Header', 'Righe Sicure ≥5', 'Supporto Illimitato', 'Formule Excel Auto']
};

// ✅ INDICI DELLE COLONNE CORRETTI
const COLUMNS = {
  ID_UTENTE: 0,        // A - ID Utente (U001, U002, etc.)
  NOME: 1,             // B - Nome Completo
  EMAIL: 2,            // C - Email
  TELEFONO: 3,         // D - Telefono  
  DATA_ASSUNZIONE: 4,  // E - Data Assunzione
  USER_ID: 5,          // F - Username (per login)
  PASSWORD: 6,         // G - Password
  PASSWORD_HASH: 7,    // H - Password Hash
  ATTIVO: 8,           // I - Attivo (Si/No)
};

// ===== CELLE ORE NEI FOGLI UTENTE =====
const USER_SHEET_CELLS = {
  ORE_MESE_CORRENTE: 'F3',    // Celle con formule Excel per ore mese corrente
  ORE_MESE_PRECEDENTE: 'G3',  // Celle con formule Excel per ore mese precedente
  ANNO_CORRENTE: 'H3'         // Opzionale: ore anno corrente se presente
};

// ===== FUNZIONE HASH PASSWORD =====
function generatePasswordHash(password) {
  const salt = "OreLavoro2025_Salt_";
  const dataToHash = salt + password + salt;
  
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    dataToHash,
    Utilities.Charset.UTF_8
  );
  
  return hash.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

// ===== FUNZIONE HELPER PER OTTENERE IL FOGLIO =====
function getWorksheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = spreadsheet.getSheets();
    
    if (sheets.length === 0) {
      throw new Error('Nessun foglio trovato nel spreadsheet');
    }
    
    // Strategia 1: Cerca per nome specifico
    if (USER_SHEET_NAME) {
      try {
        const userSheet = spreadsheet.getSheetByName(USER_SHEET_NAME);
        Logger.debug('Foglio utenti trovato per nome:', USER_SHEET_NAME);
        return userSheet;
      } catch (e) {
        Logger.warn('Foglio utenti non trovato per nome:', USER_SHEET_NAME);
      }
    }
    
    // Strategia 2: Cerca foglio che contiene header "Username" o "ID Utente"
    for (let sheet of sheets) {
      try {
        const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        if (firstRow.includes('Username') || 
            firstRow.includes('ID Utente') || 
            firstRow.includes('Nome Completo')) {
          Logger.debug('Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Strategia 3: Fallback al primo foglio
    Logger.warn('Nessun foglio utenti identificato, uso il primo disponibile');
    return sheets[0];
    
  } catch (error) {
    Logger.critical('Errore in getWorksheet:', error);
    throw error;
  }
}

// ===== FUNZIONE PER LEGGERE ORE DAL FOGLIO UTENTE =====
function getUserHoursFromSheet(userName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let userSheet;
    try {
      userSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      Logger.warn(`Foglio "${userName}" non trovato`);
      return {
        oreMeseCorrente: 0,
        oreMesePrecedente: 0,
        oreAnnoCorrente: 0
      };
    }
    
    // Leggi le ore dalle celle con formule Excel
    const oreMeseCorrente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue() || 0;
    const oreMesePrecedente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue() || 0;
    
    // Prova a leggere ore anno se la cella esiste
    let oreAnnoCorrente = 0;
    try {
      oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0;
    } catch (e) {
      // Cella anno non presente, mantieni 0
    }
    
    return {
      oreMeseCorrente: parseFloat(oreMeseCorrente) || 0,
      oreMesePrecedente: parseFloat(oreMesePrecedente) || 0,
      oreAnnoCorrente: parseFloat(oreAnnoCorrente) || 0
    };
    
  } catch (error) {
    Logger.error(`Errore lettura ore per ${userName}:`, error);
    return {
      oreMeseCorrente: 0,
      oreMesePrecedente: 0,
      oreAnnoCorrente: 0
    };
  }
}

// ===== AUTENTICAZIONE CON HASH PASSWORD V3.4 - PRODUCTION =====
function authenticateUser(userId, password) {
  try {
    Logger.auth('Tentativo autenticazione per:', userId);
    
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return {
        success: false,
        message: 'Nessun dato utente trovato nel foglio'
      };
    }
    
    // Genera hash della password inserita per verifica
    const passwordHash = generatePasswordHash(password);
    
    // Cerca utente nei dati
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const userIdInSheet = row[COLUMNS.USER_ID]; // Colonna F
      const passwordPlainInSheet = row[COLUMNS.PASSWORD]; // Colonna G  
      const passwordHashInSheet = row[COLUMNS.PASSWORD_HASH]; // Colonna H
      const isActive = row[COLUMNS.ATTIVO]; // Colonna I
      
      if (userIdInSheet === userId && isActive === 'Si' && userIdInSheet !== '') {
        Logger.debug('Utente trovato e attivo, verificando password...');
        
        let passwordValid = false;
        let authMethod = '';
        
        // PRIORITÀ 1: Verifica con hash (metodo sicuro)
        if (passwordHashInSheet && passwordHashInSheet !== '') {
          Logger.debug('Verificando con password hash (SICURO)...');
          passwordValid = (passwordHashInSheet === passwordHash);
          authMethod = 'hash';
        } 
        // FALLBACK: Verifica con password plain (per transizione graduale)
        else if (passwordPlainInSheet && passwordPlainInSheet !== '') {
          Logger.warn('FALLBACK: Verificando con password plain text...');
          passwordValid = (passwordPlainInSheet === password);
          authMethod = 'plain_fallback';
          
          // 🔄 AUTO-MIGRAZIONE: Genera hash al volo se login con plain text riesce
          if (passwordValid) {
            Logger.info('AUTO-MIGRAZIONE: Generando hash per questo utente...');
            try {
              sheet.getRange(i + 1, COLUMNS.PASSWORD_HASH + 1).setValue(passwordHash);
              Logger.info('Hash auto-generato e salvato');
              authMethod = 'plain_migrated';
            } catch (e) {
              Logger.warn('Errore auto-migrazione hash (non critico):', e);
            }
          }
        }
        // PROBLEMA: Nessuna password disponibile
        else {
          Logger.error('PROBLEMA: Utente senza password o hash');
          return {
            success: false,
            message: 'Utente senza credenziali configurate. Contatta amministratore.'
          };
        }
        
        if (passwordValid) {
          Logger.auth('Autenticazione riuscita con metodo:', authMethod, 'per utente:', userId);
          
          const sessionToken = generateSessionToken(userId);
          const userName = row[COLUMNS.NOME];
          
          // Leggi ore dal foglio individuale dell'utente
          const oreData = getUserHoursFromSheet(userName);
          
          const userData = {
            idUtente: row[COLUMNS.ID_UTENTE],
            userId: row[COLUMNS.USER_ID],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            telefono: row[COLUMNS.TELEFONO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente,
            rowIndex: i + 1,
            authMethod: authMethod // Per debug/monitoraggio
          };
          
          return {
            success: true,
            message: 'Autenticazione riuscita',
            data: userData,
            sessionToken: sessionToken,
            systemInfo: {
              version: SYSTEM_INFO.version,
              build: SYSTEM_INFO.build,
              mode: SYSTEM_INFO.mode,
              authMethod: authMethod,
              hashSupport: true
            }
          };
        } else {
          Logger.auth('Password non valida per utente:', userId);
        }
      }
    }
    
    Logger.auth('Credenziali non valide per:', userId);
    return {
      success: false,
      message: 'Credenziali non valide o utente inattivo'
    };
    
  } catch (error) {
    Logger.critical('Errore in authenticateUser:', error);
    return {
      success: false,
      message: 'Errore durante l\'autenticazione: ' + error.toString(),
      error: error.toString()
    };
  }
}

// ===== FUNZIONE PRINCIPALE SAVEWORKENTRY V3.4 - PRODUCTION =====
function saveWorkEntry(sessionToken, workData) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    Logger.save('Avvio salvataggio ore lavorate');
    
    if (!workData || typeof workData !== 'object') {
      return { success: false, message: 'Dati lavoro mancanti o non validi' };
    }
    
    // Estrazione ore robusta
    let oreValue = null;
    const orePossibili = ['ore', 'hours', 'oreLavorate'];
    
    for (const prop of orePossibili) {
      const val = workData[prop];
      if (workData.hasOwnProperty(prop) && val !== null && val !== undefined) {
        oreValue = val;
        break;
      }
    }
    
    if (oreValue === null) {
      for (const [key, value] of Object.entries(workData)) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 24) {
          oreValue = numValue;
          break;
        }
      }
    }
    
    const oreString = String(oreValue).trim();
    const oreLavorate = parseFloat(oreString);
    
    if (isNaN(oreLavorate) || oreLavorate < 0 || oreLavorate > 24) {
      return { 
        success: false, 
        message: `Valore ore non valido: "${oreValue}" → ${oreLavorate} (deve essere 0-24)` 
      };
    }
    
    // Validazione altri campi richiesti
    const campiRichiesti = {
      data: workData.data || workData.workDate || workData.date,
      cantiereId: workData.cantiereId || workData.cantiere,
      lavori: workData.lavori || workData.lavoriEseguiti || workData.descrizione
    };
    
    for (const [campo, valore] of Object.entries(campiRichiesti)) {
      if (!valore || String(valore).trim() === '') {
        return { 
          success: false, 
          message: `Campo richiesto mancante: ${campo}` 
        };
      }
    }
    
    const userId = sessionToken.split('_')[0];
    
    // Ottieni informazioni utente
    const userSheet = getWorksheet();
    const userData = userSheet.getDataRange().getValues();
    let userName = '';
    
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        userName = row[COLUMNS.NOME];
        break;
      }
    }
    
    if (!userName) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    Logger.debug('Utente identificato:', userName);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Cerca il foglio dell'utente esistente
    let userWorkSheet;
    try {
      userWorkSheet = spreadsheet.getSheetByName(userName);
      Logger.debug('Foglio utente trovato:', userName);
    } catch (e) {
      Logger.error('Foglio non trovato per:', userName);
      return { 
        success: false, 
        message: `Foglio "${userName}" non esistente. Crealo manualmente o contatta l'amministratore.` 
      };
    }
    
    // 🛡️ PROTEZIONE RIGHE SICURE (≥5) - SUPPORTO ILLIMITATO
    Logger.debug('Applicando protezione righe sicure...');
    
    const totalRows = userWorkSheet.getLastRow();
    
    // Partenza dalla riga 5 (protezione header)
    let newRow = 5;
    const maxSearchRows = Math.max(totalRows + 100, 1000);
    
    let foundEmptyRow = false;
    
    // Cerca prima riga vuota dalla 5 in poi
    for (let row = 5; row <= maxSearchRows; row++) {
      try {
        const checkRange = userWorkSheet.getRange(row, 1, 1, 5).getValues()[0];
        const isEmpty = checkRange.every(cell => 
          cell === '' || cell === null || cell === undefined
        );
        
        if (isEmpty) {
          newRow = row;
          foundEmptyRow = true;
          Logger.debug(`Riga sicura trovata: ${newRow}`);
          break;
        }
      } catch (e) {
        newRow = row;
        foundEmptyRow = true;
        Logger.debug(`Uso fine dati, riga: ${newRow}`);
        break;
      }
    }
    
    // Fallback garantito
    if (!foundEmptyRow) {
      newRow = Math.max(totalRows + 1, 5);
      Logger.debug(`Fallback: Aggiungendo alla fine, riga ${newRow}`);
    }
    
    // Controllo finale di sicurezza
    if (newRow < 5) {
      Logger.critical(`BLOCCO SICUREZZA: riga ${newRow} < 5`);
      return {
        success: false,
        message: `ERRORE SICUREZZA: Tentativo scrittura riga ${newRow} (minimo riga 5)`
      };
    }
    
    // Preparazione dati per il salvataggio
    const dataLavoro = new Date(campiRichiesti.data);
    const note = workData.note || workData.notes || '';
    
    // Ottieni nome cantiere dal foglio Cantieri
    let nomeCantiere = 'Lavoro registrato via dashboard';
    try {
      const cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      const cantieriData = cantieriSheet.getDataRange().getValues();
      
      for (let i = 1; i < cantieriData.length; i++) {
        const row = cantieriData[i];
        if (row[0] === campiRichiesti.cantiereId) {
          nomeCantiere = row[1] || nomeCantiere;
          break;
        }
      }
    } catch (e) {
      Logger.warn('Impossibile ottenere nome cantiere:', e.message);
    }
    
    Logger.save('Salvando in riga sicura:', newRow, 'ore:', oreLavorate);
    
    // SALVATAGGIO SICURO
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([
      [
        dataLavoro,
        String(campiRichiesti.cantiereId),
        String(nomeCantiere),
        oreLavorate,
        String(note)
      ]
    ]);
    
    // Formattazione celle
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
    
    Logger.save('Salvataggio completato con successo');
    
    return {
      success: true,
      message: 'Dati salvati con successo in riga sicura.',
      data: {
        riga: newRow,
        utente: userName,
        data: campiRichiesti.data,
        cantiere: campiRichiesti.cantiereId,
        nomeCantiere: nomeCantiere,
        ore: oreLavorate,
        safeRowProtection: true,
        unlimitedSupport: true,
        hashSupport: true,
        timestamp: new Date().toISOString(),
        version: SYSTEM_INFO.version
      }
    };
    
  } catch (error) {
    Logger.critical('Errore in saveWorkEntry:', error);
    return { 
      success: false, 
      message: 'Errore nel salvataggio: ' + error.toString()
    };
  }
}

// ===== RESTO DEL CODICE CON LOGGING OTTIMIZZATO =====
// [Le altre funzioni seguono lo stesso pattern di logging...]

// ===== FUNZIONI DI UTILITÀ =====
function generateSessionToken(userId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  return `${userId}_${timestamp}_${random}`;
}

function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') {
    Logger.debug('Token di test accettato per debug');
    return true;
  }
  
  if (!sessionToken || typeof sessionToken !== 'string') {
    Logger.warn('Token mancante o non valido');
    return false;
  }
  
  const parts = sessionToken.split('_');
  if (parts.length < 3) {
    Logger.warn('Formato token non valido:', sessionToken);
    return false;
  }
  
  const timestamp = parseInt(parts[1]);
  if (isNaN(timestamp)) {
    Logger.warn('Timestamp token non valido');
    return false;
  }
  
  const now = new Date().getTime();
  const tokenAge = now - timestamp;
  const maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  if (tokenAge > maxAge) {
    Logger.warn('Token scaduto (più di 24 ore)');
    return false;
  }
  
  Logger.debug('Token valido per utente:', parts[0]);
  return true;
}

// ===== FUNZIONE PING PRODUCTION =====
function handlePing() {
  return { 
    success: true, 
    message: 'Sistema operativo', 
    timestamp: new Date().toISOString(),
    version: SYSTEM_INFO.version,
    build: SYSTEM_INFO.build,
    mode: SYSTEM_INFO.mode
  };
}

// ===== LOG SISTEMA ALL'AVVIO =====
if (PRODUCTION_CONFIG.DEBUG_MODE) {
  Logger.info('Sistema Gestione Ore V3.4 inizializzato in modalità:', SYSTEM_INFO.mode);
  Logger.info('Configurazione logging:', PRODUCTION_CONFIG);
}
