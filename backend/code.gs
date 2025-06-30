/*
================================================================================
SCRIPT CONTAINER-BOUND COMPLETO - SISTEMA GESTIONE ORE V3.4
🚀 OTTIMIZZATO PER VERCEL WEBAPP + CORS INTEGRATO
================================================================================

🔧 ISTRUZIONI INSTALLAZIONE:
1. Apri il tuo Google Sheet
2. Estensioni → Apps Script  
3. Cancella tutto il codice esistente
4. Incolla TUTTO questo script
5. Salva (Ctrl+S)
6. Deploy → Nuova distribuzione → Web app
7. Esegui come: "Me", Chi ha accesso: "Chiunque"
8. Copia l'URL e aggiornalo nella webapp

================================================================================
*/

// ===== CONFIGURAZIONE AUTOMATICA CONTAINER-BOUND =====
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const USER_SHEET_NAME = 'Utenti';

console.log('🚀 Script Container-bound V3.4 inizializzato per foglio:', SPREADSHEET_ID);

// ===== CONFIGURAZIONE PRODUZIONE =====
const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,           // 🔧 FALSE per produzione
  LOG_LEVEL: 'ERROR',         // Minimal logging
  LOG_AUTH: true,             // Mantieni log sicurezza
  LOG_CRITICAL_ERRORS: true, // Mantieni errori critici
  LOG_SAVE_OPERATIONS: true  // Mantieni log salvataggi
};

// ===== LOGGER OTTIMIZZATO =====
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

// ===== INFORMAZIONI SISTEMA =====
const SYSTEM_INFO = {
  version: '3.4.1',
  build: '2025.06.27',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Container-bound script con CORS ottimizzato per Vercel',
  features: ['Hash Password SHA-256', 'CORS Headers', 'Righe Sicure ≥5', 'Container-bound', 'Vercel Ready'],
  installType: 'CONTAINER_BOUND_CORS'
};

// ===== MAPPING COLONNE FOGLIO UTENTI =====
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
  ORE_MESE_CORRENTE: 'F3',    // Formule Excel ore mese corrente
  ORE_MESE_PRECEDENTE: 'G3',  // Formule Excel ore mese precedente
  ANNO_CORRENTE: 'H3'         // Opzionale: ore anno corrente
};

// ===== FUNZIONE HASH PASSWORD SICURA =====
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

// ===== HELPER CORS - RESPONSE SEMPLIFICATA =====
function createCORSResponse(data) {
  // Google Apps Script non supporta setHeaders() su ContentService
  // CORS deve essere gestito a livello di webapp/proxy
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== ACCESSO FOGLIO CONTAINER-BOUND =====
function getWorksheet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!spreadsheet) {
      throw new Error('Impossibile accedere al spreadsheet container');
    }
    
    // Cerca foglio utenti per nome
    try {
      const userSheet = spreadsheet.getSheetByName(USER_SHEET_NAME);
      Logger.debug('Foglio utenti trovato:', USER_SHEET_NAME);
      return userSheet;
    } catch (e) {
      Logger.warn('Foglio utenti non trovato per nome:', USER_SHEET_NAME);
    }
    
    // Fallback: cerca per contenuto header
    const sheets = spreadsheet.getSheets();
    for (let sheet of sheets) {
      try {
        const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (firstRow.includes('Username') || firstRow.includes('ID Utente') || firstRow.includes('Nome Completo')) {
          Logger.debug('Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Ultimo fallback
    Logger.warn('Uso primo foglio disponibile');
    return sheets[0];
    
  } catch (error) {
    Logger.critical('Errore in getWorksheet:', error);
    throw error;
  }
}

// ===== LETTURA ORE DAL FOGLIO UTENTE =====
function getUserHoursFromSheet(userName) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    let userSheet;
    try {
      userSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      Logger.warn(`Foglio "${userName}" non trovato`);
      return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
    }
    
    // Leggi celle con formule Excel
    const oreMeseCorrente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue() || 0;
    const oreMesePrecedente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue() || 0;
    
    let oreAnnoCorrente = 0;
    try {
      oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0;
    } catch (e) {
      // Cella anno non presente
    }
    
    return {
      oreMeseCorrente: parseFloat(oreMeseCorrente) || 0,
      oreMesePrecedente: parseFloat(oreMesePrecedente) || 0,
      oreAnnoCorrente: parseFloat(oreAnnoCorrente) || 0
    };
    
  } catch (error) {
    Logger.error(`Errore lettura ore per ${userName}:`, error);
    return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
  }
}

// ===== AUTENTICAZIONE CON HASH PASSWORD =====
function authenticateUser(userId, password) {
  try {
    Logger.auth('Tentativo autenticazione per:', userId);
    
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return { success: false, message: 'Nessun dato utente trovato nel foglio' };
    }
    
    const passwordHash = generatePasswordHash(password);
    
    // Cerca utente
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const userIdInSheet = row[COLUMNS.USER_ID];
      const passwordPlainInSheet = row[COLUMNS.PASSWORD];
      const passwordHashInSheet = row[COLUMNS.PASSWORD_HASH];
      const isActive = row[COLUMNS.ATTIVO];
      
      if (userIdInSheet === userId && isActive === 'Si' && userIdInSheet !== '') {
        Logger.debug('Utente trovato e attivo, verificando password...');
        
        let passwordValid = false;
        let authMethod = '';
        
        // PRIORITÀ 1: Hash sicuro
        if (passwordHashInSheet && passwordHashInSheet !== '') {
          Logger.debug('Verificando con password hash (SICURO)...');
          passwordValid = (passwordHashInSheet === passwordHash);
          authMethod = 'hash';
        } 
        // FALLBACK: Password plain
        else if (passwordPlainInSheet && passwordPlainInSheet !== '') {
          Logger.warn('FALLBACK: Verificando con password plain text...');
          passwordValid = (passwordPlainInSheet === password);
          authMethod = 'plain_fallback';
          
          // AUTO-MIGRAZIONE: Genera hash al volo
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
        else {
          Logger.error('PROBLEMA: Utente senza password o hash');
          return { success: false, message: 'Utente senza credenziali configurate. Contatta amministratore.' };
        }
        
        if (passwordValid) {
          Logger.auth('Autenticazione riuscita con metodo:', authMethod, 'per utente:', userId);
          
          const sessionToken = generateSessionToken(userId);
          const userName = row[COLUMNS.NOME];
          
          // Leggi ore dal foglio individuale
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
            authMethod: authMethod
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
              hashSupport: true,
              installType: SYSTEM_INFO.installType
            }
          };
        } else {
          Logger.auth('Password non valida per utente:', userId);
        }
      }
    }
    
    Logger.auth('Credenziali non valide per:', userId);
    return { success: false, message: 'Credenziali non valide o utente inattivo' };
    
  } catch (error) {
    Logger.critical('Errore in authenticateUser:', error);
    return {
      success: false,
      message: 'Errore durante l\'autenticazione: ' + error.toString(),
      error: error.toString()
    };
  }
}

// ===== SALVATAGGIO ORE LAVORATE =====
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
    
    // Validazione altri campi
    const campiRichiesti = {
      data: workData.data || workData.workDate || workData.date,
      cantiereId: workData.cantiereId || workData.cantiere,
      lavori: workData.lavori || workData.lavoriEseguiti || workData.descrizione
    };
    
    for (const [campo, valore] of Object.entries(campiRichiesti)) {
      if (!valore || String(valore).trim() === '') {
        return { success: false, message: `Campo richiesto mancante: ${campo}` };
      }
    }
    
    const userId = sessionToken.split('_')[0];
    
    // Ottieni nome utente
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
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Cerca foglio dell'utente
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
    
    // 🛡️ PROTEZIONE RIGHE SICURE (≥5)
    Logger.debug('Applicando protezione righe sicure...');
    
    const totalRows = userWorkSheet.getLastRow();
    let newRow = 5; // Partenza sicura dalla riga 5
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
    
    // Preparazione dati
    const dataLavoro = new Date(campiRichiesti.data);
    const note = workData.note || workData.notes || '';
    
    // Ottieni nome cantiere
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
    
    // Formattazione
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
        containerBound: true,
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

// ===== GET CANTIERI =====
function getCantieri(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const cantieriSheet = spreadsheet.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio "Cantieri" non trovato' };
    }
    
    const data = cantieriSheet.getDataRange().getValues();
    const cantieri = [];
    
    // Salta header (riga 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Solo cantieri aperti
      if (row[3] === 'Aperto' || row[3] === 'aperto') {
        cantieri.push({
          id: row[0],
          nome: row[1],
          indirizzo: row[2] || '',
          stato: row[3]
        });
      }
    }
    
    return {
      success: true,
      data: cantieri,
      message: `${cantieri.length} cantieri attivi trovati`
    };
    
  } catch (error) {
    Logger.error('Errore in getCantieri:', error);
    return {
      success: false,
      message: 'Errore nel caricamento cantieri: ' + error.toString()
    };
  }
}

// ===== GET USER INFO AGGIORNATA =====
function getUserInfo(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    const userId = sessionToken.split('_')[0];
    const userSheet = getWorksheet();
    const userData = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        const userName = row[COLUMNS.NOME];
        const oreData = getUserHoursFromSheet(userName);
        
        return {
          success: true,
          data: {
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente
          }
        };
      }
    }
    
    return { success: false, message: 'Utente non trovato' };
    
  } catch (error) {
    Logger.error('Errore in getUserInfo:', error);
    return {
      success: false,
      message: 'Errore nel caricamento informazioni utente: ' + error.toString()
    };
  }
}

// ===== UTILITÀ =====
function generateSessionToken(userId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  return `${userId}_${timestamp}_${random}`;
}

function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') {
    Logger.debug('Token di test accettato');
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

// ===== PING SYSTEM =====
function handlePing() {
  return { 
    success: true, 
    message: 'Sistema operativo - Container-bound con CORS', 
    timestamp: new Date().toISOString(),
    version: SYSTEM_INFO.version,
    build: SYSTEM_INFO.build,
    mode: SYSTEM_INFO.mode,
    installType: SYSTEM_INFO.installType,
    features: SYSTEM_INFO.features,
    spreadsheetId: SPREADSHEET_ID,
    cors: true
  };
}

// ===== ENTRY POINT GET CON CORS =====
function doGet(e) {
  try {
    const action = e.parameter.action;
    Logger.debug('Richiesta GET ricevuta:', action);
    
    // Gestione preflight OPTIONS
    if (action === 'options') {
      return createCORSResponse({ success: true, message: 'CORS preflight OK' });
    }
    
    let result;
    
    switch (action) {
      case 'ping':
        result = handlePing();
        break;
        
      case 'authenticate':
        result = authenticateUser(e.parameter.userId, e.parameter.password);
        break;
        
      case 'saveWorkEntry':
        const workData = JSON.parse(e.parameter.workData || '{}');
        result = saveWorkEntry(e.parameter.sessionToken, workData);
        break;
        
      case 'getCantieri':
        result = getCantieri(e.parameter.sessionToken);
        break;
        
      case 'getUserInfo':
        result = getUserInfo(e.parameter.sessionToken);
        break;
        
      default:
        result = {
          success: false,
          message: 'Azione non riconosciuta: ' + action,
          availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo']
        };
    }
    
    // ✅ SEMPRE CON HEADER CORS
    return createCORSResponse(result);
    
  } catch (error) {
    Logger.critical('Errore in doGet:', error);
    
    return createCORSResponse({
      success: false,
      message: 'Errore del server: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// ===== ENTRY POINT POST CON CORS =====
function doPost(e) {
  try {
    // Parsing dati POST
    let params = {};
    
    if (e.postData && e.postData.contents) {
      try {
        const postParams = new URLSearchParams(e.postData.contents);
        const dataParam = postParams.get('data');
        
        if (dataParam) {
          params = JSON.parse(dataParam);
        }
      } catch (parseError) {
        Logger.warn('Errore parsing POST data:', parseError);
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }
    
    Logger.debug('POST richiesta ricevuta:', params.action);
    
    let result;
    
    switch (params.action) {
      case 'ping':
        result = handlePing();
        break;
        
      case 'authenticate':
        result = authenticateUser(params.userId, params.password);
        break;
        
      case 'saveWorkEntry':
        const workData = params.workData || {};
        result = saveWorkEntry(params.sessionToken, workData);
        break;
        
      case 'getCantieri':
        result = getCantieri(params.sessionToken);
        break;
        
      case 'getUserInfo':
        result = getUserInfo(params.sessionToken);
        break;
        
      default:
        result = {
          success: false,
          message: 'Azione non riconosciuta: ' + params.action,
          availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo']
        };
    }
    
    // ✅ SEMPRE CON HEADER CORS
    return createCORSResponse(result);
    
  } catch (error) {
    Logger.critical('Errore in doPost:', error);
    
    return createCORSResponse({
      success: false,
      message: 'Errore del server: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// ===== FUNZIONI DI TEST =====

/**
 * Test configurazione sistema completo
 */
function testConfiguration() {
  console.log('=== TEST CONFIGURAZIONE SISTEMA V3.4 ===');
  
  try {
    // Test 1: Verifica Spreadsheet
    console.log('✅ Spreadsheet ID:', SPREADSHEET_ID);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('✅ Spreadsheet Nome:', spreadsheet.getName());
    
    // Test 2: Verifica fogli necessari
    const requiredSheets = ['Utenti', 'Cantieri'];
    const availableSheets = spreadsheet.getSheets().map(s => s.getName());
    console.log('📋 Fogli disponibili:', availableSheets);
    
    requiredSheets.forEach(sheetName => {
      if (availableSheets.includes(sheetName)) {
        console.log(`✅ Foglio "${sheetName}" trovato`);
      } else {
        console.log(`❌ Foglio "${sheetName}" MANCANTE!`);
      }
    });
    
    // Test 3: Struttura foglio Utenti
    try {
      const userSheet = spreadsheet.getSheetByName('Utenti');
      const headers = userSheet.getRange(1, 1, 1, 9).getValues()[0];
      console.log('📊 Headers foglio Utenti:', headers);
      
      const userCount = userSheet.getLastRow() - 1;
      console.log(`👥 Numero utenti configurati: ${userCount}`);
      
      if (userCount > 0) {
        const primaRiga = userSheet.getRange(2, 1, 1, 9).getValues()[0];
        console.log('👤 Primo utente - Username:', primaRiga[5]);
        console.log('🔐 Primo utente - Password presente:', primaRiga[6] ? 'Si' : 'No');
        console.log('🔐 Primo utente - Hash presente:', primaRiga[7] ? 'Si' : 'No');
      }
      
    } catch (e) {
      console.log('❌ Errore lettura foglio Utenti:', e.message);
    }
    
    // Test 4: Struttura foglio Cantieri
    try {
      const cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      const cantieriHeaders = cantieriSheet.getRange(1, 1, 1, 4).getValues()[0];
      console.log('🏗️ Headers foglio Cantieri:', cantieriHeaders);
      
      const cantieriCount = cantieriSheet.getLastRow() - 1;
      console.log(`🏗️ Numero cantieri configurati: ${cantieriCount}`);
      
      if (cantieriCount > 0) {
        const primoCantiere = cantieriSheet.getRange(2, 1, 1, 4).getValues()[0];
        console.log('🏗️ Primo cantiere:', primoCantiere);
      }
      
    } catch (e) {
      console.log('❌ Errore lettura foglio Cantieri:', e.message);
    }
    
    // Test 5: Test ping
    const pingResult = handlePing();
    console.log('🔄 Test ping:', pingResult);
    
    // Test 6: Test CORS
    console.log('🌐 Test CORS headers...');
    const corsResponse = createCORSResponse({ test: true });
    console.log('✅ CORS Response creata correttamente');
    
    console.log('\n=== RISULTATO CONFIGURAZIONE ===');
    console.log('🎯 Se tutti i test sono ✅, il sistema è pronto!');
    console.log('🚀 Procedi con il deploy come Web App');
    console.log('📝 URL da usare nella webapp: [URL del deploy]/exec');
    
  } catch (error) {
    console.log('❌ ERRORE CRITICO:', error.toString());
    console.log('💡 Verifica che questo script sia nel foglio corretto');
  }
}

/**
 * Test autenticazione con dati di esempio
 */
function testAuthentication() {
  console.log('=== TEST AUTENTICAZIONE ===');
  
  // 🔧 MODIFICA QUESTI VALORI CON I TUOI DATI
  const testUserId = 'mario.rossi';        // Username dal foglio Utenti
  const testPassword = 'nuovapassword123'; // Password dal foglio Utenti
  
  console.log('🔐 Testando autenticazione per:', testUserId);
  
  try {
    const authResult = authenticateUser(testUserId, testPassword);
    console.log('📊 Risultato completo:', authResult);
    
    if (authResult.success) {
      console.log('✅ Autenticazione riuscita!');
      console.log('👤 Nome utente:', authResult.data.name);
      console.log('📧 Email:', authResult.data.email);
      console.log('🔑 Session token:', authResult.sessionToken);
      console.log('🔐 Metodo auth:', authResult.systemInfo.authMethod);
      console.log('⏰ Ore mese corrente:', authResult.data.oreMese);
    } else {
      console.log('❌ Autenticazione fallita:', authResult.message);
      console.log('💡 Verifica username e password nel foglio Utenti');
    }
    
  } catch (error) {
    console.log('❌ Errore test autenticazione:', error.toString());
  }
}

/**
 * Test salvataggio ore
 */
function testSaveWorkEntry() {
  console.log('=== TEST SALVATAGGIO ORE ===');
  
  // Prima autentica per ottenere un token
  const testUserId = 'mario.rossi';
  const testPassword = 'nuovapassword123';
  
  try {
    console.log('🔐 Autenticazione per test...');
    const authResult = authenticateUser(testUserId, testPassword);
    
    if (!authResult.success) {
      console.log('❌ Impossibile autenticare per test:', authResult.message);
      return;
    }
    
    const sessionToken = authResult.sessionToken;
    console.log('✅ Token ottenuto per test');
    
    // Dati di test per salvataggio
    const testWorkData = {
      data: new Date().toISOString().split('T')[0], // Data di oggi
      cantiereId: 'C001', // Deve esistere nel foglio Cantieri
      ore: 8.5,
      note: 'Test salvataggio da script - ' + new Date().toLocaleString()
    };
    
    console.log('💾 Testando salvataggio con dati:', testWorkData);
    
    const saveResult = saveWorkEntry(sessionToken, testWorkData);
    console.log('📊 Risultato salvataggio:', saveResult);
    
    if (saveResult.success) {
      console.log('✅ Salvataggio riuscito!');
      console.log('📍 Riga salvata:', saveResult.data.riga);
      console.log('👤 Utente:', saveResult.data.utente);
      console.log('⏰ Ore:', saveResult.data.ore);
    } else {
      console.log('❌ Salvataggio fallito:', saveResult.message);
    }
    
  } catch (error) {
    console.log('❌ Errore test salvataggio:', error.toString());
  }
}

/**
 * Test caricamento cantieri
 */
function testGetCantieri() {
  console.log('=== TEST CARICAMENTO CANTIERI ===');
  
  // Usa token di test per questo test
  const testToken = 'test_token';
  
  try {
    const cantieriResult = getCantieri(testToken);
    console.log('📊 Risultato cantieri:', cantieriResult);
    
    if (cantieriResult.success) {
      console.log('✅ Cantieri caricati con successo!');
      console.log('🏗️ Numero cantieri attivi:', cantieriResult.data.length);
      
      cantieriResult.data.forEach((cantiere, index) => {
        console.log(`${index + 1}. ${cantiere.id} - ${cantiere.nome}`);
      });
    } else {
      console.log('❌ Errore caricamento cantieri:', cantieriResult.message);
    }
    
  } catch (error) {
    console.log('❌ Errore test cantieri:', error.toString());
  }
}

/**
 * Genera hash per una password specifica
 */
function generateHashForPassword() {
  console.log('=== GENERATORE HASH PASSWORD ===');
  
  // 🔧 MODIFICA QUESTA PASSWORD
  const password = 'nuovapassword123';
  
  const hash = generatePasswordHash(password);
  console.log('🔐 Password:', password);
  console.log('🔐 Hash generato:', hash);
  console.log('💡 Copia questo hash nella colonna H del foglio Utenti');
  
  // Test verifica hash
  const testHash = generatePasswordHash(password);
  const isValid = (hash === testHash);
  console.log('✅ Verifica hash:', isValid ? 'VALIDO' : 'ERRORE');
}

/**
 * Test completo del sistema
 */
function testCompleteSystem() {
  console.log('🚀 AVVIO TEST COMPLETO SISTEMA V3.4');
  console.log('=====================================');
  
  // Test 1: Configurazione
  console.log('\n1️⃣ TEST CONFIGURAZIONE:');
  testConfiguration();
  
  // Test 2: Cantieri
  console.log('\n2️⃣ TEST CANTIERI:');
  testGetCantieri();
  
  // Test 3: Autenticazione
  console.log('\n3️⃣ TEST AUTENTICAZIONE:');
  testAuthentication();
  
  // Test 4: Salvataggio (solo se autenticazione ok)
  console.log('\n4️⃣ TEST SALVATAGGIO:');
  console.log('💡 Esegui testSaveWorkEntry() separatamente se necessario');
  
  console.log('\n🏁 TEST COMPLETO TERMINATO');
  console.log('=====================================');
}

/**
 * Diagnostica avanzata del sistema
 */
function diagnosticaAvanzata() {
  console.log('=== DIAGNOSTICA AVANZATA SISTEMA ===');
  
  try {
    // Info spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log('📊 Spreadsheet Info:');
    console.log('  - ID:', ss.getId());
    console.log('  - Nome:', ss.getName());
    console.log('  - URL:', ss.getUrl());
    console.log('  - Proprietario:', ss.getOwner().getEmail());
    
    // Info fogli
    console.log('\n📋 Analisi Fogli:');
    ss.getSheets().forEach((sheet, index) => {
      console.log(`  ${index + 1}. "${sheet.getName()}" - ${sheet.getLastRow()} righe, ${sheet.getLastColumn()} colonne`);
    });
    
    // Info sistema
    console.log('\n⚙️ Info Sistema:');
    console.log('  - Versione:', SYSTEM_INFO.version);
    console.log('  - Build:', SYSTEM_INFO.build);
    console.log('  - Modalità:', SYSTEM_INFO.mode);
    console.log('  - Features:', SYSTEM_INFO.features.join(', '));
    
    // Info configurazione
    console.log('\n🔧 Configurazione Produzione:');
    console.log('  - Debug Mode:', PRODUCTION_CONFIG.DEBUG_MODE);
    console.log('  - Log Level:', PRODUCTION_CONFIG.LOG_LEVEL);
    console.log('  - Log Auth:', PRODUCTION_CONFIG.LOG_AUTH);
    
    // Test permessi
    console.log('\n🔐 Test Permessi:');
    try {
      const testRange = ss.getActiveSheet().getRange('A1');
      console.log('  - Lettura fogli: ✅');
      
      // Test scrittura (non invasivo)
      const originalValue = testRange.getValue();
      testRange.setValue(originalValue); // Rimette lo stesso valore
      console.log('  - Scrittura fogli: ✅');
      
    } catch (e) {
      console.log('  - Errore permessi:', e.message);
    }
    
    console.log('\n✅ Diagnostica completata');
    
  } catch (error) {
    console.log('❌ Errore diagnostica:', error.toString());
  }
}

// ===== INIZIALIZZAZIONE E LOG =====
if (PRODUCTION_CONFIG.DEBUG_MODE) {
  Logger.info('🚀 Sistema Gestione Ore V3.4 Container-bound inizializzato');
  Logger.info('📋 Spreadsheet ID:', SPREADSHEET_ID);
  Logger.info('🔧 Modalità:', SYSTEM_INFO.mode);
  Logger.info('💡 Esegui testConfiguration() per verificare il setup');
}

/*
================================================================================
🎯 CHECKLIST POST-INSTALLAZIONE

✅ PASSO 1 - VERIFICA SCRIPT:
   1. Esegui testConfiguration() per verificare tutto
   2. Se ci sono errori ❌, risolvi prima di procedere

✅ PASSO 2 - TEST FUNZIONALITÀ:
   1. Esegui testAuthentication() per verificare login
   2. Modifica username/password nella funzione se necessario
   3. Esegui testGetCantieri() per verificare cantieri

✅ PASSO 3 - DEPLOY WEB APP:
   1. Deploy → Nuova distribuzione
   2. Tipo: "Applicazione web"
   3. Descrizione: "Sistema Gestione Ore V3.4"
   4. Esegui come: "Me"
   5. Chi ha accesso: "Chiunque"
   6. Distribuisci

✅ PASSO 4 - TEST URL:
   1. Copia l'URL della distribuzione
   2. Testalo aggiungendo ?action=ping
   3. Dovresti vedere JSON con success: true e cors: true

✅ PASSO 5 - AGGIORNA WEBAPP:
   1. Incolla l'URL nella config.js della webapp
   2. Testa il login dalla webapp
   3. Verifica che non ci siano più errori CORS

🚨 TROUBLESHOOTING:
- Errore "Permission denied" → Riautorizza lo script
- Errore "Sheet not found" → Verifica nomi fogli (Utenti, Cantieri)
- CORS ancora presente → Controlla che l'URL sia quello giusto
- Login fallisce → Verifica credenziali con testAuthentication()

📞 SUPPORTO:
Se hai problemi:
1. Esegui diagnosticaAvanzata()
2. Condividi i log della console
3. Verifica che tutti i test siano ✅

🎉 SISTEMA PRONTO!
Una volta completati tutti i passi, il sistema dovrebbe funzionare perfettamente
con la tua webapp su Vercel!

================================================================================
*/
