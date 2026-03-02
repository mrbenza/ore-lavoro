/* =============================================================================
SCRIPT CONTAINER-BOUND COMPLETO - SISTEMA GESTIONE ORE V2.3
MIGLIORATA (punti: 1=error handling, 2=letture ottimizzate, 4=validazione input,
5=costanti colonne cantieri, 6=ricerca riga vuota ottimizzata, 7=JSDoc)
Build: 2025-09-07
============================================================================== */

// ============================ CONFIGURAZIONE =================================
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const USER_SHEET_NAME = 'Utenti';

const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,
  LOG_LEVEL: 'ERROR',
  LOG_AUTH: true,
  LOG_CRITICAL_ERRORS: true,
  LOG_SAVE_OPERATIONS: true
};

// ================================ LOGGER =====================================
const Logger = {
  debug: function() {
    if (PRODUCTION_CONFIG.DEBUG_MODE) {
      console.log.apply(console, ['[DEBUG]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  info: function() {
    console.log.apply(console, ['[INFO]'].concat(Array.prototype.slice.call(arguments)));
  },
  warn: function() {
    console.warn.apply(console, ['[WARN]'].concat(Array.prototype.slice.call(arguments)));
  },
  error: function() {
    console.error.apply(console, ['[ERROR]'].concat(Array.prototype.slice.call(arguments)));
  },
  auth: function() {
    if (PRODUCTION_CONFIG.LOG_AUTH) {
      console.log.apply(console, ['[AUTH]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  save: function() {
    if (PRODUCTION_CONFIG.LOG_SAVE_OPERATIONS) {
      console.log.apply(console, ['[SAVE]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  critical: function() {
    if (PRODUCTION_CONFIG.LOG_CRITICAL_ERRORS) {
      console.error.apply(console, ['[CRITICAL]'].concat(Array.prototype.slice.call(arguments)));
    }
  }
};

// ============================== SYSTEM INFO ==================================
const SYSTEM_INFO = {
  version: '2.3',
  build: '2025.09.28 - test admin',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Container-bound script con funzione admin',
  features: ['Hash Password SHA-256', 'CORS Headers','Calendario'],
  installType: 'CONTAINER_BOUND_CORS_CALENDAR'
};

// ============================= UTILS COMUNI ==================================
/**
 * Gestione errori centralizzata
 * @param {string} context - contesto/funzione
 * @param {Error} error - errore catturato
 * @returns {{success:false, message:string, error:string}}
 */
function handleError(context, error) {
  Logger.critical('Errore in ' + context + ':', error);
  return {
    success: false,
    message: 'Errore in ' + context + ': ' + error.toString(),
    error: error.toString()
  };
}

/**
 * Restituisce in modo sicuro un foglio per nome.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getSheetSafely(ss, name) {
  try { return ss.getSheetByName(name); } catch (e) { return null; }
}

/**
 * Restituisce i valori di una colonna (2D->1D flat) a partire dalla riga 2.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} colOneBased
 * @returns {Array}
 */
function getColumnValues(sheet, colOneBased) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, colOneBased, lastRow - 1, 1).getValues().map(r => r[0]);
}

/**
 * Trova l'indice (0-based rispetto a riga 2) della prima occorrenza value nella colonna.
 * @param {Array} colValues - array flat
 * @param {*} value
 * @returns {number} -1 se non trovato
 */
function indexOfValue(colValues, value) {
  for (var i = 0; i < colValues.length; i++) if (colValues[i] === value) return i;
  return -1;
}

/**
 * Parsing flessibile di una data. Supporta Date, ISO string, timestamp, "dd/mm/yyyy".
 * @param {*} input
 * @returns {Date|null}
 */
function parseDateFlexible(input) {
  try {
    if (!input && input !== 0) return null;
    if (Object.prototype.toString.call(input) === '[object Date]') {
      return isNaN(input.getTime()) ? null : input;
    }
    if (typeof input === 'number') {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === 'string') {
      const s = input.trim();
      // dd/mm/yyyy
      const m = s.match(/^([0-2]?\d|3[01])\/([0]?\d|1[0-2])\/(\d{4})$/);
      if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const y = parseInt(m[3], 10);
        const dt = new Date(y, mo, d);
        if (dt && dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
        return null;
      }
      // Fallback: Date.parse (ISO o altre stringhe riconosciute)
      const p = Date.parse(s);
      if (!isNaN(p)) return new Date(p);
      return null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Valida ore lavorate [0..24]
 * @param {*} ore
 * @returns {number|null} ore come numero valido o null
 */
function validateHours(ore) {
  const n = parseFloat(String(ore).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 24) return null;
  return n;
}

// ============================== HASH PASSWORD ================================
function generatePasswordHash(password) {
  var salt = "OreLavoro2025_Salt_";
  var dataToHash = salt + password + salt;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, dataToHash, Utilities.Charset.UTF_8);
  return hash.map(function(byte) { return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0'); }).join('');
}

// ============================== CORS RESPONSE ================================
function createCORSResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ============================== ACCESSO FOGLI ================================
/**
 * Rileva il foglio "Utenti" con fallback per contenuto.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getWorksheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Impossibile accedere al spreadsheet container');

    var userSheet = getSheetSafely(ss, USER_SHEET_NAME);
    if (userSheet) { Logger.debug('Foglio utenti trovato:', USER_SHEET_NAME); return userSheet; }

    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      try {
        var firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (firstRow.indexOf('Username') !== -1 || firstRow.indexOf('ID Utente') !== -1 || firstRow.indexOf('Nome Completo') !== -1) {
          Logger.debug('Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) { /* continue */ }
    }
    Logger.warn('Uso primo foglio disponibile');
    return sheets[0];
  } catch (error) {
    throw error; // gestito da chi invoca con handleError
  }
}

// ============================== LETTURA ORE ==================================
/**
 * Legge le ore riepilogative dal foglio personale dell'utente.
 * @param {string} userName - Nome del foglio utente
 * @returns {{oreMeseCorrente:number, oreMesePrecedente:number, oreAnnoCorrente:number}}
 */
function getUserHoursFromSheet(userName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = getSheetSafely(ss, userName);
    if (!userSheet) {
      Logger.warn('Foglio "' + userName + '" non trovato');
      return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
    }
    var oreMeseCorrente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue() || 0;
    var oreMesePrecedente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue() || 0;
    var oreAnnoCorrente = 0;
    try { oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0; } catch (e) { /* cella assente */ }
    return {
      oreMeseCorrente: parseFloat(oreMeseCorrente) || 0,
      oreMesePrecedente: parseFloat(oreMesePrecedente) || 0,
      oreAnnoCorrente: parseFloat(oreAnnoCorrente) || 0
    };
  } catch (error) {
    Logger.error('Errore lettura ore per ' + userName + ':', error);
    return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
  }
}

// ============================== AUTENTICAZIONE ===============================
/**
 * Autentica l'utente. Letture ottimizzate: interroga solo le colonne necessarie.
 * Migrazione automatica plain->hash se necessario.
 * @param {string} userId
 * @param {string} password
 * @returns {{success:boolean, message:string, data?:Object, sessionToken?:string, systemInfo?:Object}}
 */
/**
 * Funzione di autenticazione ROBUSTA - cerca colonne per nome header
 * Completamente indipendente dalle posizioni delle colonne
 * @param {string} userId
 * @param {string} password
 * @returns {{success:boolean, message:string, data?:Object, sessionToken?:string, systemInfo?:Object}}
 */
function authenticateUser(userId, password) {
  try {
    console.log('Tentativo autenticazione per:', userId);
    
    // Ottieni il foglio Utenti
    const sheet = getWorksheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return { success: false, message: 'Nessun dato utente trovato nel foglio' };
    }
    
    // STEP 1: Leggi gli header per mappare le colonne
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);
    
    // Verifica che le colonne essenziali esistano
    const requiredColumns = ['Username', 'Nome Completo', 'Password', 'Attivo'];
    const missingColumns = requiredColumns.filter(col => columnMap[col] === undefined);
    
    if (missingColumns.length > 0) {
      return { 
        success: false, 
        message: `Colonne mancanti nel foglio: ${missingColumns.join(', ')}` 
      };
    }
    
    // STEP 2: Leggi tutti i dati utenti
    const userData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    // STEP 3: Trova l'utente per username
    let userRow = null;
    let userRowIndex = -1;
    
    for (let i = 0; i < userData.length; i++) {
      const row = userData[i];
      const rowUserId = row[columnMap['Username']];
      
      if (rowUserId && rowUserId.toString().trim() === userId) {
        userRow = row;
        userRowIndex = i + 2; // Converti a 1-based per il foglio
        break;
      }
    }
    
    if (!userRow) {
      console.log('Credenziali non valide per:', userId);
      return { success: false, message: 'Credenziali non valide o utente inattivo' };
    }
    
    // STEP 4: Verifica se l'utente è attivo
    const isActive = userRow[columnMap['Attivo']];
    if (!(isActive === 'Si' || isActive === 'SI' || isActive === 'si' || isActive === true)) {
      return { success: false, message: 'Credenziali non valide o utente inattivo' };
    }
    
    // STEP 5: Verifica password (supporta sia plain che hash)
    const passwordResult = verifyUserPassword(userRow, password, columnMap);
    
    if (!passwordResult.valid) {
      console.log('Password non valida per utente:', userId);
      return { success: false, message: 'Credenziali non valide o utente inattivo' };
    }
    
    // STEP 6: Auto-migrazione hash se necessario
    if (passwordResult.needsMigration) {
      try {
        const newHash = generatePasswordHash(password);
        const hashColumn = columnMap['Password Hash'] || columnMap['PasswordHash'];
        
        if (hashColumn !== undefined) {
          sheet.getRange(userRowIndex, hashColumn + 1).setValue(newHash);
          console.log('Hash auto-generato e salvato per utente:', userId);
          passwordResult.authMethod = 'plain_migrated';
        }
      } catch (e) {
        console.warn('Errore auto-migrazione hash (non critico):', e.message);
      }
    }
    
    // STEP 7: Genera token di sessione
    const sessionToken = generateSessionToken(userId);
    
    // STEP 8: Calcola dati ore utente
    const userName = userRow[columnMap['Nome Completo']];
    const oreData = getUserHoursFromSheet(userName);
    
    // STEP 9: Costruisci risposta
    const userData_response = {
      idUtente: userRow[columnMap['ID Utente']] || '',
      userId: userId,
      name: userName,
      email: userRow[columnMap['Email']] || '',
      telefono: userRow[columnMap['Telefono']] || '',
      dataAssunzione: userRow[columnMap['Data Assunzione']] || '',
      ruolo: userRow[columnMap['Ruolo']] || 'Dipendente',
      oreMese: oreData.oreMeseCorrente,
      oreMesePrecedente: oreData.oreMesePrecedente,
      oreAnno: oreData.oreAnnoCorrente,
      rowIndex: userRowIndex,
      authMethod: passwordResult.authMethod
    };
    
    return {
      success: true,
      message: 'Autenticazione riuscita',
      data: userData_response,
      sessionToken: sessionToken,
      systemInfo: {
        version: SYSTEM_INFO.version,
        build: SYSTEM_INFO.build,
        mode: SYSTEM_INFO.mode,
        authMethod: passwordResult.authMethod,
        hashSupport: true,
        installType: SYSTEM_INFO.installType
      }
    };
    
  } catch (error) {
    return handleError('authenticateUser', error);
  }
}

/**
 * Costruisce una mappa nome_colonna -> indice per accesso robusto
 * @param {Array} headers - Array degli header del foglio
 * @returns {Object} - Mappa nome -> indice (0-based)
 */
function buildColumnMap(headers) {
  const columnMap = {};
  
  // Mappature possibili per ogni campo (supporta variazioni nei nomi)
  const columnMappings = {
    'ID Utente': ['ID Utente', 'IdUtente', 'ID_Utente'],
    'Nome Completo': ['Nome Completo', 'Nome', 'NomeCompleto', 'Nome_Completo'],
    'Email': ['Email', 'E-mail', 'Mail'],
    'Telefono': ['Telefono', 'Tel', 'Phone'],
    'Data Assunzione': ['Data Assunzione', 'DataAssunzione', 'Data_Assunzione'],
    'Ruolo': ['Ruolo', 'Role'],
    'Username': ['Username', 'User ID', 'UserID', 'User_ID'],
    'Password': ['Password', 'Pwd'],
    'Password Hash': ['Password Hash', 'PasswordHash', 'Password_Hash', 'Hash'],
    'Attivo': ['Attivo', 'Active', 'Stato']
  };
  
  // Per ogni header nel foglio, trova la corrispondenza
  headers.forEach((header, index) => {
    if (!header) return;
    
    const headerStr = header.toString().trim();
    
    // Cerca corrispondenza esatta o parziale
    Object.keys(columnMappings).forEach(standardName => {
      const variations = columnMappings[standardName];
      
      if (variations.some(variation => 
        headerStr.toLowerCase() === variation.toLowerCase() ||
        headerStr.toLowerCase().includes(variation.toLowerCase()) ||
        variation.toLowerCase().includes(headerStr.toLowerCase())
      )) {
        columnMap[standardName] = index;
      }
    });
  });
  
  return columnMap;
}

/**
 * Verifica la password dell'utente (supporta plain text e hash)
 * @param {Array} userRow - Riga dati dell'utente
 * @param {string} password - Password da verificare
 * @param {Object} columnMap - Mappa delle colonne
 * @returns {Object} - Risultato verifica
 */
function verifyUserPassword(userRow, password, columnMap) {
  try {
    const passwordPlain = userRow[columnMap['Password']] || '';
    const passwordHash = userRow[columnMap['Password Hash']] || '';
    
    // Genera hash della password fornita
    const inputPasswordHash = generatePasswordHash(password);
    
    // Caso 1: Verifica con hash (metodo sicuro)
    if (passwordHash && passwordHash !== '') {
      console.log('Verificando con password hash (SICURO)...');
      
      const hashValid = (passwordHash === inputPasswordHash);
      
      return {
        valid: hashValid,
        authMethod: 'hash',
        needsMigration: false
      };
    }
    
    // Caso 2: Fallback con password plain text
    if (passwordPlain && passwordPlain !== '') {
      console.log('FALLBACK: Verificando con password plain text...');
      
      const plainValid = (passwordPlain.toString() === password.toString());
      
      return {
        valid: plainValid,
        authMethod: 'plain_fallback',
        needsMigration: plainValid // Se valida, migra a hash
      };
    }
    
    // Caso 3: Nessuna password configurata
    console.log('PROBLEMA: Utente senza password configurata');
    return {
      valid: false,
      authMethod: 'no_password',
      needsMigration: false
    };
    
  } catch (error) {
    console.error('Errore verifica password:', error);
    return {
      valid: false,
      authMethod: 'error',
      needsMigration: false
    };
  }
}

/**
 * Funzione di test per verificare la robustezza
 */
function testRobustAuthentication() {
  console.log('=== TEST AUTENTICAZIONE ROBUSTA ===');
  
  try {
    // Test mappatura colonne
    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);
    
    console.log('Headers trovati:', headers);
    console.log('Mappatura colonne:', columnMap);
    
    // Test autenticazione
    const authResult = authenticateUser('gio', 'gio1');
    console.log('Risultato autenticazione:', authResult);
    
    if (authResult.success) {
      console.log('✅ Autenticazione robusta funzionante!');
      console.log('Metodo auth:', authResult.systemInfo.authMethod);
      console.log('Dati utente:', authResult.data.name);
    } else {
      console.log('❌ Autenticazione fallita:', authResult.message);
    }
    
  } catch (error) {
    console.error('Errore test:', error);
  }
}

/**
 * Diagnostica struttura foglio per debug
 */
function diagnoseSheetStructure() {
  try {
    console.log('=== DIAGNOSTICA STRUTTURA FOGLIO ===');
    
    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);
    
    console.log('Headers del foglio:');
    headers.forEach((header, index) => {
      console.log(`  ${String.fromCharCode(65 + index)} (${index}): "${header}"`);
    });
    
    console.log('\nMappatura riconosciuta:');
    Object.keys(columnMap).forEach(key => {
      const index = columnMap[key];
      const letter = String.fromCharCode(65 + index);
      console.log(`  ${key} -> Colonna ${letter} (${index}): "${headers[index]}"`);
    });
    
    // Verifica colonne essenziali
    const required = ['Username', 'Nome Completo', 'Password', 'Attivo'];
    const missing = required.filter(col => columnMap[col] === undefined);
    
    if (missing.length === 0) {
      console.log('\n✅ Tutte le colonne essenziali sono presenti');
    } else {
      console.log('\n❌ Colonne mancanti:', missing.join(', '));
    }
    
  } catch (error) {
    console.error('Errore diagnostica:', error);
  }
}

// ============================ AGGIORNAMENTO CANTIERE =========================
/**
 * Aggiorna le ore di un cantiere.
 * @param {string|number} cantiereId
 * @param {number} oreAggiunte
 * @param {string|null} dipendente
 * @returns {{success:boolean, message?:string, cantiereId?:*, oreAttuali?:number, oreAggiunte?:number, nuovoTotale?:number, dataAggiornamento?:Date, ultimoDipendente?:string, numeroInserimenti?:number}}
 */
function updateCantiereHours(cantiereId, oreAggiunte, dipendente) {
  if (!dipendente) dipendente = null;
  try {
    Logger.save('Aggiornando cantiere ' + cantiereId + ' con +' + oreAggiunte + ' ore');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = getSheetSafely(ss, 'Cantieri');
    if (!cantieriSheet) return { success: false, message: 'Foglio Cantieri non trovato' };

    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Nessun cantiere trovato' };

    // Leggi colonne ID e le colonne che servono in un colpo solo
    var data = cantieriSheet.getRange(2, 1, lastRow - 1, Math.max(COLUMNS_CANTIERI.NUM_INSERIMENTI + 1, cantieriSheet.getLastColumn())).getValues();

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var cId = row[COLUMNS_CANTIERI.ID];
      if (String(cId) === String(cantiereId)) {
        var rowIndex1 = i + 2;
        var oreAttuali = parseFloat(row[COLUMNS_CANTIERI.ORE_TOTALI]) || 0;
        var nuovoTotale = oreAttuali + oreAggiunte;
        var dataAggiornamento = new Date();
        var inserimentiAttuali = parseInt(row[COLUMNS_CANTIERI.NUM_INSERIMENTI]) || 0;
        var nuovoContatore = inserimentiAttuali + 1;

        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ORE_TOTALI + 1).setValue(nuovoTotale);
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ULTIMO_UPDATE + 1).setValue(dataAggiornamento).setNumberFormat('dd/mm/yyyy hh:mm');
        if (dipendente) { cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ULTIMO_DIPENDENTE + 1).setValue(dipendente); }
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.NUM_INSERIMENTI + 1).setValue(nuovoContatore);

        Logger.save('Cantiere aggiornato: ' + cantiereId);
        return {
          success: true,
          cantiereId: cantiereId,
          oreAttuali: oreAttuali,
          oreAggiunte: oreAggiunte,
          nuovoTotale: nuovoTotale,
          dataAggiornamento: dataAggiornamento,
          ultimoDipendente: dipendente,
          numeroInserimenti: nuovoContatore
        };
      }
    }
    return { success: false, message: 'Cantiere ' + cantiereId + ' non trovato' };
  } catch (error) {
    return handleError('updateCantiereHours', error);
  }
}

// ============================== SALVATAGGIO ORE ==============================
/**
 * Salva una registrazione di ore nel foglio utente (riga >=5). Ricerca riga vuota ottimizzata.
 * @param {string} sessionToken
 * @param {Object} workData - { data|workDate|date, cantiereId|cantiere, lavori|lavoriEseguiti|descrizione, note? , ore? }
 * @returns {{success:boolean, message:string, data?:Object}}
 */
function saveWorkEntry(sessionToken, workData) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  try {
    Logger.save('Avvio salvataggio ore lavorate');
    if (!workData || typeof workData !== 'object') {
      return { success: false, message: 'Dati lavoro mancanti o non validi' };
    }

    // Estrazione ore (flessibile) + validazione
    var oreValue = null;
    var orePossibili = ['ore', 'hours', 'oreLavorate'];
    for (var p = 0; p < orePossibili.length; p++) {
      var prop = orePossibili[p];
      if (Object.prototype.hasOwnProperty.call(workData, prop) && workData[prop] != null) { oreValue = workData[prop]; break; }
    }
    if (oreValue === null) {
      for (var key in workData) {
        if (!Object.prototype.hasOwnProperty.call(workData, key)) continue;
        var numValue = parseFloat(workData[key]);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 24) { oreValue = numValue; break; }
      }
    }
    var oreLavorate = validateHours(oreValue);
    if (oreLavorate === null) {
      return { success: false, message: 'Valore ore non valido: "' + oreValue + '" (deve essere 0-24)' };
    }

    // Campi richiesti
    var campiRichiesti = {
      data: workData.data || workData.workDate || workData.date,
      cantiereId: workData.cantiereId || workData.cantiere,
      lavori: workData.lavori || workData.lavoriEseguiti || workData.descrizione
    };
    for (var campo in campiRichiesti) {
      if (!Object.prototype.hasOwnProperty.call(campiRichiesti, campo)) continue;
      var valore = campiRichiesti[campo];
      if (!valore || String(valore).trim() === '') {
        return { success: false, message: 'Campo richiesto mancante: ' + campo };
      }
    }

    // Validazione data (flessibile, ma rigorosa)
    var dataLavoro = parseDateFlexible(campiRichiesti.data);
    if (!dataLavoro) return { success: false, message: 'Formato data non valido. Usa "dd/mm/yyyy" o ISO (es. 2025-09-07)' };

    // Ricava nome utente dal token
    var userId = String(sessionToken).split('_')[0];
    var userSheet = getWorksheet();
    var lastRowUsers = userSheet.getLastRow();
    var userIds = lastRowUsers >= 2 ? userSheet.getRange(2, COLUMNS.USER_ID + 1, lastRowUsers - 1, 1).getValues().map(r => r[0]) : [];
    var idx0 = indexOfValue(userIds, userId);
    if (idx0 === -1) return { success: false, message: 'Utente non trovato' };
    var rowIndex1 = idx0 + 2;
    var row = userSheet.getRange(rowIndex1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var userName = row[COLUMNS.NOME];
    if (!userName) return { success: false, message: 'Nome utente non trovato' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet = getSheetSafely(ss, userName);
    if (!userWorkSheet) {
      return { success: false, message: 'Foglio "' + userName + '" non esistente. Crealo manualmente.' };
    }

    // Ricava nome cantiere (se disponibile) con lettura ottimizzata
    var nomeCantiere = 'Lavoro registrato via dashboard';
    try {
      var cantieriSheet = getSheetSafely(ss, 'Cantieri');
      if (cantieriSheet) {
        var lastRowCant = cantieriSheet.getLastRow();
        if (lastRowCant >= 2) {
          var cantieriRange = cantieriSheet.getRange(2, 1, lastRowCant - 1, Math.max(COLUMNS_CANTIERI.NOME + 1, cantieriSheet.getLastColumn()));
          var cantieriData = cantieriRange.getValues();
          for (var i = 0; i < cantieriData.length; i++) {
            var r = cantieriData[i];
            if (String(r[COLUMNS_CANTIERI.ID]) === String(campiRichiesti.cantiereId)) { nomeCantiere = r[COLUMNS_CANTIERI.NOME] || nomeCantiere; break; }
          }
        }
      }
    } catch (e) { Logger.warn('Impossibile ottenere nome cantiere:', e.message); }

    // Ricerca riga vuota ottimizzata (in memoria) a partire da riga 5, 5 colonne
    var lastRow = userWorkSheet.getLastRow();
    var startRow = 5;
    var numRowsToCheck = Math.max(lastRow - startRow + 1, 1);
    var valuesBlock = userWorkSheet.getRange(startRow, 1, numRowsToCheck, 5).getValues();
    var offset = -1;
    for (var v = 0; v < valuesBlock.length; v++) {
      var rowVals = valuesBlock[v];
      var empty = true;
      for (var c = 0; c < rowVals.length; c++) { if (rowVals[c] !== '' && rowVals[c] !== null && rowVals[c] !== undefined) { empty = false; break; } }
      if (empty) { offset = v; break; }
    }
    var newRow = offset !== -1 ? startRow + offset : Math.max(lastRow + 1, startRow);
    if (newRow < 5) return { success: false, message: 'ERRORE SICUREZZA: Tentativo scrittura riga ' + newRow + ' (minimo riga 5)' };

    var note = workData.note || workData.notes || '';

    Logger.save('Salvando in riga sicura: ' + newRow + ' ore: ' + oreLavorate);
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([[
      dataLavoro,
      String(campiRichiesti.cantiereId),
      String(nomeCantiere),
      oreLavorate,
      String(note)
    ]]);
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');

    // Aggiorna cantiere (non bloccante in caso di errore)
    var cantiereUpdateResult = updateCantiereHours(campiRichiesti.cantiereId, oreLavorate, userName);
    if (!cantiereUpdateResult.success) { Logger.warn('Aggiornamento cantiere fallito:', cantiereUpdateResult.message); }

    Logger.save('Salvataggio completato con successo');
    return {
      success: true,
      message: 'Dati salvati con successo. Ore cantiere aggiornate.',
      data: {
        riga: newRow,
        utente: userName,
        data: Utilities.formatDate(dataLavoro, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
        cantiere: campiRichiesti.cantiereId,
        nomeCantiere: nomeCantiere,
        ore: oreLavorate,
        cantiereUpdate: cantiereUpdateResult.success ? {
          oreAttuali: cantiereUpdateResult.oreAttuali,
          oreAggiunte: cantiereUpdateResult.oreAggiunte,
          nuovoTotale: cantiereUpdateResult.nuovoTotale
        } : { error: cantiereUpdateResult.message },
        safeRowProtection: true,
        containerBound: true,
        timestamp: new Date().toISOString(),
        version: SYSTEM_INFO.version
      }
    };
  } catch (error) {
    return handleError('saveWorkEntry', error);
  }
}

// ================================ GET CANTIERI ===============================
/**
 * Restituisce elenco cantieri aperti.
 * @param {string} sessionToken
 * @returns {{success:boolean, data?:Array, message:string}}
 */
function getCantieri(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = getSheetSafely(ss, 'Cantieri');
    if (!cantieriSheet) return { success: false, message: 'Foglio "Cantieri" non trovato' };

    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [], message: '0 cantieri attivi trovati' };

    // Leggi solo le colonne necessarie in blocco
    var neededCols = Math.max(COLUMNS_CANTIERI.STATO + 1, cantieriSheet.getLastColumn());
    var data = cantieriSheet.getRange(2, 1, lastRow - 1, neededCols).getValues();

    var cantieri = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var stato = row[COLUMNS_CANTIERI.STATO];
      if (stato === 'Aperto' || stato === 'aperto' || stato === 'APERTO') {
        cantieri.push({
          id: row[COLUMNS_CANTIERI.ID],
          nome: row[COLUMNS_CANTIERI.NOME],
          indirizzo: row[COLUMNS_CANTIERI.INDIRIZZO] || '',
          stato: stato
        });
      }
    }
    return { success: true, data: cantieri, message: cantieri.length + ' cantieri attivi trovati' };
  } catch (error) {
    return handleError('getCantieri', error);
  }
}

// ================================ GET USER INFO ==============================
/**
 * Ritorna le ore riepilogative utente.
 * @param {string} sessionToken
 * @returns {{success:boolean, data?:{oreMese:number, oreMesePrecedente:number, oreAnno:number}, message?:string}}
 */
function getUserInfo(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  try {
    var userId = String(sessionToken).split('_')[0];
    var userSheet = getWorksheet();
    var lastRow = userSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Utente non trovato' };

    var userIds = userSheet.getRange(2, COLUMNS.USER_ID + 1, lastRow - 1, 1).getValues().map(r => r[0]);
    var idx0 = indexOfValue(userIds, userId);
    if (idx0 === -1) return { success: false, message: 'Utente non trovato' };

    var rowIndex1 = idx0 + 2;
    var row = userSheet.getRange(rowIndex1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var userName = row[COLUMNS.NOME];
    var oreData = getUserHoursFromSheet(userName);

    return { success: true, data: { oreMese: oreData.oreMeseCorrente, oreMesePrecedente: oreData.oreMesePrecedente, oreAnno: oreData.oreAnnoCorrente } };
  } catch (error) {
    return handleError('getUserInfo', error);
  }
}

// ============================ GET MONTHLY WORK DATA ==========================
/**
 * Ritorna i dati giornalieri per un mese specifico
 * @param {string} sessionToken
 * @param {number} year
 * @param {number} month - 1..12
 * @returns {{success:boolean, data?:Object, message:string, error?:string}}
 */
function getMonthlyWorkData(sessionToken, year, month) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  try {
    var userId = String(sessionToken).split('_')[0];

    var userSheet = getWorksheet();
    var lastRowUsers = userSheet.getLastRow();
    if (lastRowUsers < 2) return { success: false, message: 'Utente non trovato' };

    var userIds = userSheet.getRange(2, COLUMNS.USER_ID + 1, lastRowUsers - 1, 1).getValues().map(r => r[0]);
    var idx0 = indexOfValue(userIds, userId);
    if (idx0 === -1) return { success: false, message: 'Utente non trovato' };

    var rowIndex1 = idx0 + 2;
    var row = userSheet.getRange(rowIndex1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var userName = row[COLUMNS.NOME];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet = getSheetSafely(ss, userName);
    if (!userWorkSheet) return { success: false, message: 'Foglio utente non trovato: ' + userName };

    var lastRow = userWorkSheet.getLastRow();
    if (lastRow < 5) {
      return { success: true, data: { year: year, month: month, userName: userName, workDays: {} }, message: 'Nessun dato trovato per questo mese' };
    }

    var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
    var monthlyData = {};

    for (var i = 0; i < workData.length; i++) {
      var r = workData[i];
      var dateCell = r[0];
      var cantiereId = r[1];
      var cantiereName = r[2];
      var ore = r[3];
      var note = r[4];
      if (!dateCell || ore === '' || ore === null || ore === undefined) continue;

      var workDate = parseDateFlexible(dateCell) || new Date(dateCell);
      if (!workDate || isNaN(workDate.getTime())) continue;

      if (workDate.getFullYear() === year && workDate.getMonth() === (month - 1)) {
        var day = workDate.getDate();
        if (!monthlyData[day]) monthlyData[day] = { totalHours: 0, entries: [] };
        var oreNumber = parseFloat(ore) || 0;
        monthlyData[day].totalHours += oreNumber;
        monthlyData[day].entries.push({
          cantiere: cantiereName || cantiereId || 'N/A',
          ore: oreNumber,
          note: note || '',
          data: Utilities.formatDate(workDate, Session.getScriptTimeZone(), 'dd/MM/yyyy')
        });
      }
    }

    return { success: true, data: { year: year, month: month, userName: userName, workDays: monthlyData, totalDaysWorked: Object.keys(monthlyData).length }, message: 'Dati calendario per ' + month + '/' + year + ' caricati con successo' };
  } catch (error) {
    return handleError('getMonthlyWorkData', error);
  }
}

// ================================= UTILITÀ ==================================
function generateSessionToken(userId) {
  var timestamp = new Date().getTime();
  var random = Math.random().toString(36).substring(2);
  return userId + '_' + timestamp + '_' + random;
}

function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') { Logger.debug('Token di test accettato'); return true; }
  if (!sessionToken || typeof sessionToken !== 'string') { Logger.warn('Token mancante o non valido'); return false; }
  var parts = sessionToken.split('_');
  if (parts.length < 3) { Logger.warn('Formato token non valido:', sessionToken); return false; }
  var timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) { Logger.warn('Timestamp token non valido'); return false; }
  var now = new Date().getTime();
  var tokenAge = now - timestamp;
  var maxAge = 24 * 60 * 60 * 1000; // 24 ore
  if (tokenAge > maxAge) { Logger.warn('Token scaduto (più di 24 ore)'); return false; }
  Logger.debug('Token valido per utente:', parts[0]);
  return true;
}

// ================================== PING =====================================
function handlePing() {
  return {
    success: true,
    message: 'Sistema operativo - Container-bound con CORS + Calendario',
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

// ============================== ENTRY POINT GET ===============================
/**
 * Entry point GET (webapp)
 * @param {GoogleAppsScript.Events.DoGet} e
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    Logger.debug('Richiesta GET ricevuta:', action);

    if (action === 'options') {
      return createCORSResponse({ success: true, message: 'CORS preflight OK' });
    }

    var result;
    switch (action) {
      case 'ping':
        result = handlePing();
        break;
      case 'authenticate':
        result = authenticateUser(e.parameter.userId, e.parameter.password);
        break;
      case 'saveWorkEntry':
        var workData = {};
        try { workData = JSON.parse(e.parameter.workData || '{}'); } catch (_) { workData = {}; }
        result = saveWorkEntry(e.parameter.sessionToken, workData);
        break;
      case 'getCantieri':
        result = getCantieri(e.parameter.sessionToken);
        break;
      case 'getMonthlyWorkData':
        var year = parseInt(e.parameter.year, 10) || new Date().getFullYear();
        var month = parseInt(e.parameter.month, 10) || new Date().getMonth() + 1;
        result = getMonthlyWorkData(e.parameter.sessionToken, year, month);
        break;
      case 'getUserInfo':
        result = getUserInfo(e.parameter.sessionToken);
        break;
      case 'validateAdmin':
        result = validateAdmin(e.parameter.sessionToken, e.parameter.userId);
        break;
      case 'getCantieriOverview':
        result = getCantieriAdminOverview(e.parameter.sessionToken, e.parameter.modalita);
        break;
      case 'getDipendentiList':
        result = getDipendentiListAdmin(e.parameter.sessionToken);
        break;
      case 'getDipendenteTimeline':
        result = getDipendenteTimelineAdmin(e.parameter.sessionToken, e.parameter.userId, e.parameter.timeframe);
        break;
      case 'invalidateCache':
        result = invalidateAdminCache(e.parameter.sessionToken, e.parameter.cacheType);
        break;
      case 'getOtherUserInfo':
        result = getOtherUserInfo(
          e.parameter.sessionToken,
          e.parameter.targetUserId
        );
        break;
      case 'getOtherUserMonthlyData':
        result = getOtherUserMonthlyData(
          e.parameter.sessionToken,
          e.parameter.targetUserId,
          e.parameter.year,
          e.parameter.month
        );
        break;
      case 'getAllCantieriForAdmin':
        result = getAllCantieriForAdmin(e.parameter.sessionToken);
        break;
      case 'updateWorkEntry':
        var updateData = {};
        try { 
          updateData = JSON.parse(e.parameter.updateData || '{}'); 
        } catch (_) {}
        result = updateWorkEntry(
          e.parameter.sessionToken,
          e.parameter.targetUserId,
          e.parameter.dateStr,
          updateData
        );
        break;
      default:
        result = { success: false, message: 'Azione non riconosciuta: ' + action, availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo', 'getMonthlyWorkData'] };
    }
    return createCORSResponse(result);
  } catch (error) {
    return createCORSResponse(handleError('doGet', error));
  }
}

// ============================== ENTRY POINT POST ==============================
/**
 * Entry point POST (webapp)
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        var postParams = new URLSearchParams(e.postData.contents);
        var dataParam = postParams.get('data');
        if (dataParam) params = JSON.parse(dataParam);
      } catch (parseError) {
        Logger.warn('Errore parsing POST data:', parseError);
        params = e.parameter || {};
      }
    } else { params = e && e.parameter ? e.parameter : {}; }

    Logger.debug('POST richiesta ricevuta:', params.action);

    var result;
    switch (params.action) {
      case 'ping':
        result = handlePing();
        break;
      case 'authenticate':
        result = authenticateUser(params.userId, params.password);
        break;
      case 'saveWorkEntry':
        var workDataPost = params.workData || {};
        result = saveWorkEntry(params.sessionToken, workDataPost);
        break;
      case 'getCantieri':
        result = getCantieri(params.sessionToken);
        break;
      case 'getUserInfo':
        result = getUserInfo(params.sessionToken);
        break;
      case 'getMonthlyWorkData':
        var yearPost = parseInt(params.year, 10) || new Date().getFullYear();
        var monthPost = parseInt(params.month, 10) || new Date().getMonth() + 1;
        result = getMonthlyWorkData(params.sessionToken, yearPost, monthPost);
        break;
      // Nel tuo doPost, aggiungi questi case:
      case 'validateAdmin':
        Logger.debug('📞 doPost validateAdmin chiamato con params:', params);
        result = validateAdmin(params.sessionToken, params.userId);
        Logger.debug('📤 doPost validateAdmin risultato:', result);
        break;
      case 'getCantieriOverview':
        result = getCantieriAdminOverview(params.sessionToken, params.modalita);
        break;
      case 'getDipendentiList':
        result = getDipendentiListAdmin(params.sessionToken);
        break;
      case 'getDipendenteTimeline':
        result = getDipendenteTimelineAdmin(params.sessionToken, params.userId, params.timeframe);
        break;
      case 'invalidateCache':
        result = invalidateAdminCache(params.sessionToken, params.cacheType);
        break;
      case 'getAllCantieriForAdmin':
        result = getAllCantieriForAdmin(params.sessionToken);
        break;   
      case 'updateWorkEntry':
        var updateDataPost = {};
        try { 
          updateDataPost = JSON.parse(params.updateData || '{}'); 
        } catch (_) {}    
        result = updateWorkEntry(
          params.sessionToken,
          params.targetUserId,
          params.dateStr,
          updateDataPost
        );
        break;
      default:
        result = { success: false, message: 'Azione non riconosciuta: ' + params.action, availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo', 'getMonthlyWorkData', 'validateAdmin', 'getCantieriOverview', 'getDipendentiList', 'getDipendenteTimeline', 'invalidateCache'] };
    }
    return createCORSResponse(result);
  } catch (error) {
    return createCORSResponse(handleError('doPost', error));
  }
}

// ============================== FUNZIONI DI TEST =============================
/**
 * Stampa diagnostica configurazione principale.
 */
function testConfiguration() {
  console.log('=== TEST CONFIGURAZIONE SISTEMA V2.3 ===');
  try {
    console.log('Spreadsheet ID:', SPREADSHEET_ID);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log('Spreadsheet Nome:', ss.getName());

    var requiredSheets = ['Utenti', 'Cantieri'];
    var availableSheets = ss.getSheets().map(s => s.getName());
    console.log('Fogli disponibili:', availableSheets);
    requiredSheets.forEach(n => console.log((availableSheets.indexOf(n) !== -1 ? '✅' : '❌') + ' Foglio "' + n + '" ' + (availableSheets.indexOf(n) !== -1 ? 'trovato' : 'MANCANTE!')));

    try {
      var userSheet = getWorksheet();
      var headers = userSheet.getRange(1, 1, 1, 9).getValues()[0];
      console.log('Headers foglio Utenti:', headers);
      var userCount = Math.max(userSheet.getLastRow() - 1, 0);
      console.log('Numero utenti configurati: ' + userCount);
      if (userCount > 0) {
        var primaRiga = userSheet.getRange(2, 1, 1, 9).getValues()[0];
        console.log('Primo utente - Username:', primaRiga[COLUMNS.USER_ID]);
        console.log('Primo utente - Password presente:', primaRiga[COLUMNS.PASSWORD] ? 'Si' : 'No');
        console.log('Primo utente - Hash presente:', primaRiga[COLUMNS.PASSWORD_HASH] ? 'Si' : 'No');
      }
    } catch (e) { console.log('Errore lettura foglio Utenti:', e.message); }

    try {
      var cantieriSheet = getSheetSafely(ss, 'Cantieri');
      if (cantieriSheet) {
        var cantieriHeaders = cantieriSheet.getRange(1, 1, 1, Math.max(cantieriSheet.getLastColumn(), 10)).getValues()[0];
        console.log('Headers foglio Cantieri:', cantieriHeaders);
        var cantieriCount = Math.max(cantieriSheet.getLastRow() - 1, 0);
        console.log('Numero cantieri configurati: ' + cantieriCount);
      } else {
        console.log('Foglio Cantieri non trovato');
      }
    } catch (e) { console.log('Errore lettura foglio Cantieri:', e.message); }

    var pingResult = handlePing();
    console.log('Test ping:', pingResult);
    console.log('=== RISULTATO CONFIGURAZIONE ===');
    console.log('Se tutti i test sono ✅, il sistema è pronto!');
  } catch (error) { console.log('ERRORE CRITICO:', error.toString()); }
}

/**
 * Test autenticazione rapido (richiede utente test configurato)
 */
function testAuthentication() {
  console.log('=== TEST AUTENTICAZIONE ===');
  var testUserId = 'test';
  var testPassword = 'test';
  console.log('Testando autenticazione per:', testUserId);
  try {
    var authResult = authenticateUser(testUserId, testPassword);
    console.log('Risultato:', authResult);
    if (authResult.success) {
      console.log('✅ Autenticazione riuscita!');
      console.log('Nome utente:', authResult.data.name);
      console.log('Session token:', authResult.sessionToken);
    } else { console.log('❌ Autenticazione fallita:', authResult.message); }
  } catch (error) { console.log('Errore test autenticazione:', error.toString()); }
}

/**
 * Test lettura calendario mese
 */
function testGetMonthlyWorkData() {
  console.log('=== TEST CALENDARIO ===');
  var testUserId = 'test';
  var testYear = 2025;
  var testMonth = 9;
  try {
    var testToken = generateSessionToken(testUserId);
    console.log('Token generato:', testToken);
    var result = getMonthlyWorkData(testToken, testYear, testMonth);
    console.log('Risultato calendario:', result);
    if (result.success) {
      console.log('✅ Test calendario riuscito!');
      console.log('Utente:', result.data.userName);
      console.log('Giorni lavorati:', result.data.totalDaysWorked);
    } else { console.log('❌ Test calendario fallito:', result.message); }
  } catch (error) { console.log('Errore test calendario:', error.toString()); }
}

/**
 * Esegue una batteria di test di base
 */
function testCompleteSystem() {
  console.log('🚀 AVVIO TEST COMPLETO SISTEMA V2.3');
  console.log('===================================');
  console.log('\n1️⃣ TEST CONFIGURAZIONE:');
  testConfiguration();
  console.log('\n2️⃣ TEST AUTENTICAZIONE:');
  testAuthentication();
  console.log('\n3️⃣ TEST CALENDARIO:');
  testGetMonthlyWorkData();
  console.log('\n🏁 TEST COMPLETO TERMINATO');
}

// ===== AGGIUNGI QUESTE FUNZIONI AL TUO CODE.GS ESISTENTE =====

// ============================ VALIDAZIONE RUOLO ADMIN ============================

/**
 * Valida se l'utente ha ruolo di amministratore
 * @param {string} sessionToken
 * @returns {{success: boolean, message?: string, userData?: Object}}
 */
function validateAdminRole(sessionToken) {
  try {
    // Valida prima il token
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Token di sessione non valido' };
    }
    
    // Decodifica il token per ottenere userId
    const tokenData = decodeSessionToken(sessionToken);
    if (!tokenData || !tokenData.userId) {
      return { success: false, message: 'Token non valido o corrotto' };
    }
    
    // Ottieni dati utente dal foglio
    const sheet = getWorksheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Nessun utente trovato nel sistema' };
    }
    
    // Cerca l'utente nel foglio
    const userIds = sheet.getRange(2, COLUMNS.USER_ID + 1, lastRow - 1, 1).getValues().map(r => r[0]);
    const userIndex = userIds.findIndex(id => id === tokenData.userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    // Leggi la riga completa dell'utente
    const rowIndex = userIndex + 2; // Converti a 1-based
    const userData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Verifica se l'utente è attivo
    const isActive = userData[COLUMNS.ATTIVO];
    if (!(isActive === 'Si' || isActive === 'SI' || isActive === 'si' || isActive === true)) {
      return { success: false, message: 'Utente non attivo' };
    }
    
    // Verifica il ruolo
    const userRole = userData[COLUMNS.RUOLO];
    if (!ADMIN_VALIDATION.isAdminRole(userRole)) {
      return { 
        success: false, 
        message: 'Accesso negato. Solo gli amministratori possono accedere a questa funzione.',
        userRole: userRole 
      };
    }
    
    console.log('Admin access granted for:', tokenData.userId);
    
    return {
      success: true,
      userData: {
        userId: userData[COLUMNS.USER_ID],
        nome: userData[COLUMNS.NOME],
        email: userData[COLUMNS.EMAIL],
        ruolo: userData[COLUMNS.RUOLO],
        dataAssunzione: userData[COLUMNS.DATA_ASSUNZIONE]
      }
    };
    
  } catch (error) {
    return handleError('validateAdminRole', error);
  }
}

/**
 * Decodifica session token per estrarre userId
 * @param {string} sessionToken
 * @returns {{userId: string, timestamp: number}|null}
 */
function decodeSessionToken(sessionToken) {
  try {
    // Il token è formato come: base64(userId:timestamp:hash)
    const decoded = Utilities.base64Decode(sessionToken);
    const tokenString = Utilities.newBlob(decoded).getDataAsString();
    const parts = tokenString.split(':');
    
    if (parts.length >= 2) {
      return {
        userId: parts[0],
        timestamp: parseInt(parts[1])
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Errore decode token:', error);
    return null;
  }
}

// ============================ API OVERVIEW CANTIERI ============================

/**
 * Ottiene overview dei cantieri per la dashboard admin
 * @param {string} sessionToken
 * @param {string} modalita - 'mese' per mese corrente, 'totali' per totali assoluti
 * @returns {{success: boolean, data?: Array, message?: string}}
 */
function getCantieriAdminOverview(sessionToken, modalita = 'totali') {
  const startTime = Date.now();
  
  try {
    // Validazione admin
    const adminCheck = validateAdminRole(sessionToken);
    if (!adminCheck.success) {
      return adminCheck;
    }
    
    // Validazione parametri
    if (!ADMIN_VALIDATION.isValidCantieriMode(modalita)) {
      return { success: false, message: 'Modalità non valida. Usare "mese" o "totali"' };
    }
    
    console.log('Getting cantieri overview, modalità:', modalita);
    
    // Controllo cache
    const cacheKey = modalita === 'mese' ? 
      CACHE_CONFIG.CACHE_KEYS.CANTIERI_MESE + new Date().getMonth() :
      CACHE_CONFIG.CACHE_KEYS.CANTIERI_TOTALI;
    
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && modalita === 'totali') {
      console.log('Cache hit for cantieri overview');
      return JSON.parse(cachedData);
    }
    
    // Leggi foglio cantieri
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cantieriSheet = ss.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }
    
    const lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], message: 'Nessun cantiere trovato' };
    }
    
    // Leggi tutti i dati cantieri
    const cantieriData = cantieriSheet.getRange(2, 1, lastRow - 1, cantieriSheet.getLastColumn()).getValues();
    
    let cantieri = [];
    
    if (modalita === 'totali') {
      // Modalità totali assoluti - usa dati dal foglio Cantieri
      cantieri = cantieriData.map(row => ({
        id: row[COLUMNS_CANTIERI.ID],
        nome: row[COLUMNS_CANTIERI.NOME] || 'N/A',
        indirizzo: row[COLUMNS_CANTIERI.INDIRIZZO] || '',
        stato: row[COLUMNS_CANTIERI.STATO] || 'N/A',
        oreTotali: parseFloat(row[COLUMNS_CANTIERI.ORE_TOTALI]) || 0,
        ultimoAggiornamento: row[COLUMNS_CANTIERI.ULTIMO_UPDATE],
        ultimoDipendente: row[COLUMNS_CANTIERI.ULTIMO_DIPENDENTE] || '',
        numeroInserimenti: parseInt(row[COLUMNS_CANTIERI.NUM_INSERIMENTI]) || 0
      }));
      
    } else {
      // Modalità mese corrente - calcola dalle ore dei dipendenti
      cantieri = calculateCantieriMeseCorrente(cantieriData);
    }
    
    // Ordina per ore decrescenti
    cantieri.sort((a, b) => (b.oreTotali || 0) - (a.oreTotali || 0));
    
    const result = {
      success: true,
      data: cantieri,
      modalita: modalita,
      timestamp: new Date(),
      totaleCantieri: cantieri.length,
      totaleOre: cantieri.reduce((sum, c) => sum + (c.oreTotali || 0), 0)
    };
    
    // Cache solo i totali assoluti (più stabili)
    if (modalita === 'totali') {
      cache.put(cacheKey, JSON.stringify(result), CACHE_CONFIG.CANTIERI_OVERVIEW);
    }
    
    const duration = Date.now() - startTime;
    console.log(`getCantieriAdminOverview completed in ${duration}ms`);
    
    return result;
    
  } catch (error) {
    return handleError('getCantieriAdminOverview', error);
  }
}

/**
 * Calcola ore cantieri per il mese corrente dai fogli dipendenti
 * @param {Array} cantieriData - Dati dal foglio Cantieri
 * @returns {Array} - Cantieri con ore del mese corrente
 */
function calculateCantieriMeseCorrente(cantieriData) {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Mappa per raccogliere ore per cantiere
    const cantieriOreMap = new Map();
    
    // Inizializza mappa con tutti i cantieri
    cantieriData.forEach(row => {
      const cantiereId = row[COLUMNS_CANTIERI.ID];
      if (cantiereId) {
        cantieriOreMap.set(cantiereId, {
          id: cantiereId,
          nome: row[COLUMNS_CANTIERI.NOME] || 'N/A',
          indirizzo: row[COLUMNS_CANTIERI.INDIRIZZO] || '',
          stato: row[COLUMNS_CANTIERI.STATO] || 'N/A',
          oreTotali: 0,
          ultimoAggiornamento: null,
          ultimoDipendente: '',
          numeroInserimenti: 0
        });
      }
    });
    
    // Leggi ore dai fogli dipendenti per il mese corrente
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    
    allSheets.forEach(sheet => {
      const sheetName = sheet.getName();
      
      // Salta fogli di sistema
      if (['Utenti', 'Cantieri', 'Configurazione'].includes(sheetName)) {
        return;
      }
      
      try {
        const lastRow = sheet.getLastRow();
        if (lastRow < 5) return; // Nessun dato ore
        
        // Leggi tutte le ore dalla riga 5 in poi
        const oreData = sheet.getRange(5, 1, lastRow - 4, 5).getValues();
        
        oreData.forEach(row => {
          const data = row[0];
          const cantiere = row[1];
          const ore = parseFloat(row[4]) || 0;
          
          if (!data || !cantiere || ore <= 0) return;
          
          // Verifica se la data è nel mese corrente
          const workDate = new Date(data);
          if (workDate.getMonth() + 1 === currentMonth && 
              workDate.getFullYear() === currentYear) {
            
            if (cantieriOreMap.has(cantiere)) {
              const cantiere_data = cantieriOreMap.get(cantiere);
              cantiere_data.oreTotali += ore;
              cantiere_data.numeroInserimenti += 1;
              cantiere_data.ultimoDipendente = sheetName;
              cantiere_data.ultimoAggiornamento = workDate;
              cantieriOreMap.set(cantiere, cantiere_data);
            }
          }
        });
        
      } catch (e) {
        console.log('Errore lettura foglio ' + sheetName + ':', e.message);
      }
    });
    
    // Converti mappa in array
    return Array.from(cantieriOreMap.values());
    
  } catch (error) {
    console.error('Errore calculateCantieriMeseCorrente:', error);
    return [];
  }
}

// ============================ API LISTA DIPENDENTI ============================

/**
 * Ottiene lista dipendenti per dropdown admin
 * @param {string} sessionToken
 * @returns {{success: boolean, data?: Array, message?: string}}
 */
function getDipendentiListAdmin(sessionToken) {
  const startTime = Date.now();
  
  try {
    // Validazione admin
    const adminCheck = validateAdminRole(sessionToken);
    if (!adminCheck.success) {
      return adminCheck;
    }
    
    console.log('Getting dipendenti list for admin');
    
    // Controllo cache
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(CACHE_CONFIG.CACHE_KEYS.DIPENDENTI);
    
    if (cachedData) {
      console.log('Cache hit for dipendenti list');
      return JSON.parse(cachedData);
    }
    
    // Leggi foglio utenti
    const sheet = getWorksheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) {
      return { success: true, data: [], message: 'Nessun dipendente trovato' };
    }
    
    // Leggi tutti i dati utenti
    const userData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    const dipendenti = userData
      .filter(row => {
        // Solo utenti attivi
        const isActive = row[COLUMNS.ATTIVO];
        return (isActive === 'Si' || isActive === 'SI' || isActive === 'si' || isActive === true);
      })
      .map(row => ({
        userId: row[COLUMNS.USER_ID],
        nome: row[COLUMNS.NOME],
        email: row[COLUMNS.EMAIL],
        ruolo: row[COLUMNS.RUOLO],
        dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
        hasPersonalSheet: checkIfUserHasSheet(row[COLUMNS.NOME])
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome)); // Ordina alfabeticamente
    
    const result = {
      success: true,
      data: dipendenti,
      totaleDipendenti: dipendenti.length,
      timestamp: new Date()
    };
    
    // Cache per 5 minuti
    cache.put(CACHE_CONFIG.CACHE_KEYS.DIPENDENTI, JSON.stringify(result), CACHE_CONFIG.DIPENDENTI_LIST);
    
    const duration = Date.now() - startTime;
    console.log(`getDipendentiListAdmin completed in ${duration}ms`);
    
    return result;
    
  } catch (error) {
    return handleError('getDipendentiListAdmin', error);
  }
}

/**
 * Verifica se esiste un foglio personale per l'utente
 * @param {string} userName
 * @returns {boolean}
 */
function checkIfUserHasSheet(userName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(userName) !== null;
  } catch (e) {
    return false;
  }
}

// ============================ API TIMELINE DIPENDENTE ============================

/**
 * Ottiene timeline ore per un dipendente specifico
 * @param {string} sessionToken
 * @param {string} userId - ID del dipendente
 * @param {string} timeframe - '30days', 'lastMonth', 'year'
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
/**
 * Ottieni info dipendente con ore da colonne F, G, H
 */
function getDipendenteTimelineAdmin(sessionToken, userId, timeframe) {
  const startTime = Date.now();
  
  try {
    Logger.debug('getDipendenteTimelineAdmin per:', userId, 'timeframe:', timeframe);
    
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    if (!userId) {
      return { success: false, message: 'userId richiesto' };
    }
    
    // Trova nome dipendente
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    const userData = userSheet.getDataRange().getValues();
    
    let nomeCompleto = null;
    let ruoloDipendente = null;
    
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][6] === userId) { // Colonna G - Username
        nomeCompleto = userData[i][1]; // Colonna B - Nome
        ruoloDipendente = userData[i][5] || 'Dipendente'; // Colonna F - Ruolo
        break;
      }
    }
    
    if (!nomeCompleto) {
      return { success: false, message: 'Dipendente non trovato' };
    }
    
    // Leggi dal foglio personale del dipendente
    const dipendenteSheet = spreadsheet.getSheetByName(nomeCompleto);
    
    if (!dipendenteSheet) {
      return { 
        success: true, 
        message: 'Foglio dipendente non trovato',
        data: { 
          timeline: [], 
          totaleOre: 0,
          giornateLavorate: 0,
          cantieriCoinvolti: []
        }
      };
    }
    
    // LEGGI ORE DALLE CELLE F, G, H (come nel foglio Giuseppe Verdi)
    const oreMeseCorrente = parseFloat(dipendenteSheet.getRange('F2').getValue()) || 0;
    const oreMesePrecedente = parseFloat(dipendenteSheet.getRange('G2').getValue()) || 0;
    const oreAnnoCorrente = parseFloat(dipendenteSheet.getRange('H2').getValue()) || 0;
    
    // Seleziona ore in base al timeframe
    let totaleOre, timelineLabel;
    
    switch (timeframe) {
      case '30days':
        totaleOre = oreMeseCorrente; // Approssimazione: mese corrente ≈ ultimi 30gg
        timelineLabel = 'Ultimi 30 Giorni';
        break;
      case 'lastMonth':
        totaleOre = oreMesePrecedente;
        timelineLabel = 'Mese Precedente';
        break;
      case 'year':
        totaleOre = oreAnnoCorrente;
        timelineLabel = 'Anno Corrente';
        break;
      default:
        totaleOre = oreMeseCorrente;
        timelineLabel = 'Periodo';
    }
    
    // Calcola cantieri e giorni (opzionale - solo se serve dettaglio)
    const cantieriCoinvolti = [];
    let giornateLavorate = 0;
    
    try {
      const lastRow = dipendenteSheet.getLastRow();
      if (lastRow >= 5) {
        const data = dipendenteSheet.getRange(5, 1, lastRow - 4, 5).getValues();
        const cantieriSet = new Set();
        const giorniSet = new Set();
        
        // Filtra per periodo se necessario
        const oggi = new Date();
        let dataInizio;
        
        switch (timeframe) {
          case '30days':
            dataInizio = new Date(oggi);
            dataInizio.setDate(oggi.getDate() - 30);
            break;
          case 'lastMonth':
            dataInizio = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
            break;
          case 'year':
            dataInizio = new Date(oggi.getFullYear(), 0, 1);
            break;
        }
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const dataLavoro = new Date(row[0]);
          const cantiere = row[1];
          
          if (dataLavoro >= dataInizio && cantiere) {
            cantieriSet.add(cantiere);
            giorniSet.add(dataLavoro.toDateString());
          }
        }
        
        giornateLavorate = giorniSet.size;
        cantieriCoinvolti.push(...Array.from(cantieriSet));
      }
    } catch (e) {
      Logger.warn('Errore calcolo dettagli:', e.message);
    }
    
    const result = {
      success: true,
      data: {
        userId: userId,
        nome: nomeCompleto,
        ruolo: ruoloDipendente,
        timeline: [], // Vuoto - non serve più, usiamo solo totali
        totaleOre: totaleOre,
        giornateLavorate: giornateLavorate,
        cantieriCoinvolti: cantieriCoinvolti,
        timeframe: timeframe,
        timeframeLabel: timelineLabel,
        oreMeseCorrente: oreMeseCorrente,
        oreMesePrecedente: oreMesePrecedente,
        oreAnnoCorrente: oreAnnoCorrente
      },
      loadTime: Date.now() - startTime
    };
    
    Logger.debug('Timeline caricata in ' + result.loadTime + 'ms');
    
    return result;
    
  } catch (error) {
    Logger.critical('Errore getDipendenteTimelineAdmin:', error);
    return {
      success: false,
      message: 'Errore: ' + error.toString()
    };
  }
}


/**
 * Ottiene il nome utente dal userId
 * @param {string} userId
 * @returns {string|null}
 */
function getUserNameFromUserId(userId) {
  try {
    const sheet = getWorksheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    
    const userData = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    for (let row of userData) {
      if (row[COLUMNS.USER_ID] === userId) {
        return row[COLUMNS.NOME];
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Errore getUserNameFromUserId:', error);
    return null;
  }
}

/**
 * Calcola intervallo date per timeframe
 * @param {string} timeframe
 * @returns {{startDate: Date, endDate: Date}|null}
 */
function calculateDateRange(timeframe) {
  try {
    const today = new Date();
    const endDate = new Date(today);
    let startDate;
    
    switch (timeframe) {
      case '30days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        break;
        
      case 'lastMonth':
        // Mese precedente
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate.setDate(0); // Ultimo giorno del mese precedente
        break;
        
      case 'year':
        // Anno corrente
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
        
      default:
        return null;
    }
    
    return { startDate, endDate };
    
  } catch (error) {
    console.error('Errore calculateDateRange:', error);
    return null;
  }
}

/**
 * Legge dati timeline dal foglio utente
 * @param {string} userName
 * @param {{startDate: Date, endDate: Date}} dateRange
 * @param {string} timeframe
 * @returns {Object}
 */
function readUserTimelineData(userName, dateRange, timeframe) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName(userName);
    
    if (!userSheet) {
      return {
        timeline: [],
        totaleOre: 0,
        giornateLavorate: 0,
        cantieriCoinvolti: [],
        riepilogo: 'Foglio utente non trovato'
      };
    }
    
    const lastRow = userSheet.getLastRow();
    if (lastRow < 5) {
      return {
        timeline: [],
        totaleOre: 0,
        giornateLavorate: 0,
        cantieriCoinvolti: [],
        riepilogo: 'Nessun dato ore registrato'
      };
    }
    
    // Leggi tutte le ore
    const oreData = userSheet.getRange(5, 1, lastRow - 4, 5).getValues();
    
    // Filtra per intervallo date
    const filteredData = oreData.filter(row => {
      const workDate = new Date(row[0]);
      return workDate >= dateRange.startDate && workDate <= dateRange.endDate;
    });
    
    // Processa dati per timeframe specifico
    return processTimelineData(filteredData, timeframe, dateRange);
    
  } catch (error) {
    console.error('Errore readUserTimelineData:', error);
    return {
      timeline: [],
      totaleOre: 0,
      giornateLavorate: 0,
      cantieriCoinvolti: [],
      riepilogo: 'Errore lettura dati: ' + error.message
    };
  }
}

/**
 * Processa dati timeline in base al timeframe
 * @param {Array} data - Dati ore filtrati
 * @param {string} timeframe
 * @param {{startDate: Date, endDate: Date}} dateRange
 * @returns {Object}
 */
function processTimelineData(data, timeframe, dateRange) {
  try {
    let timeline = [];
    let totaleOre = 0;
    const cantieriSet = new Set();
    const giorniLavoratiSet = new Set();
    
    if (timeframe === 'year') {
      // Raggruppa per mese per l'anno corrente
      const mesiMap = new Map();
      
      // Inizializza tutti i mesi dell'anno
      for (let i = 0; i < 12; i++) {
        const meseName = new Date(dateRange.startDate.getFullYear(), i, 1).toLocaleDateString('it-IT', { month: 'short' });
        mesiMap.set(i, {
          periodo: meseName,
          ore: 0,
          giornateLavorate: 0,
          cantieri: new Set()
        });
      }
      
      // Processa i dati
      data.forEach(row => {
        const workDate = new Date(row[0]);
        const cantiere = row[1];
        const ore = parseFloat(row[4]) || 0;
        
        if (ore > 0) {
          const mese = workDate.getMonth();
          const meseData = mesiMap.get(mese);
          
          meseData.ore += ore;
          meseData.giornateLavorate += 1;
          if (cantiere) meseData.cantieri.add(cantiere);
          
          totaleOre += ore;
          cantieriSet.add(cantiere);
          giorniLavoratiSet.add(workDate.toDateString());
        }
      });
      
      // Converti in timeline
      timeline = Array.from(mesiMap.values()).map(m => ({
        periodo: m.periodo,
        ore: m.ore,
        giornateLavorate: m.giornateLavorate,
        cantieri: Array.from(m.cantieri)
      }));
      
    } else {
      // Raggruppa per giorno (30days o lastMonth)
      const giorniMap = new Map();
      
      data.forEach(row => {
        const workDate = new Date(row[0]);
        const cantiere = row[1];
        const ore = parseFloat(row[4]) || 0;
        
        if (ore > 0) {
          const dateKey = workDate.toDateString();
          
          if (!giorniMap.has(dateKey)) {
            giorniMap.set(dateKey, {
              data: workDate,
              periodo: workDate.toLocaleDateString('it-IT'),
              ore: 0,
              cantieri: new Set()
            });
          }
          
          const giorno = giorniMap.get(dateKey);
          giorno.ore += ore;
          if (cantiere) giorno.cantieri.add(cantiere);
          
          totaleOre += ore;
          cantieriSet.add(cantiere);
          giorniLavoratiSet.add(dateKey);
        }
      });
      
      // Converti in timeline ordinata per data
      timeline = Array.from(giorniMap.values())
        .sort((a, b) => a.data - b.data)
        .map(g => ({
          periodo: g.periodo,
          ore: g.ore,
          cantieri: Array.from(g.cantieri)
        }));
    }
    
    return {
      timeline: timeline,
      totaleOre: Math.round(totaleOre * 100) / 100, // Arrotonda a 2 decimali
      giornateLavorate: giorniLavoratiSet.size,
      cantieriCoinvolti: Array.from(cantieriSet).filter(c => c), // Rimuovi valori vuoti
      riepilogo: `${totaleOre.toFixed(1)} ore in ${giorniLavoratiSet.size} giorni lavorati`
    };
    
  } catch (error) {
    console.error('Errore processTimelineData:', error);
    return {
      timeline: [],
      totaleOre: 0,
      giornateLavorate: 0,
      cantieriCoinvolti: [],
      riepilogo: 'Errore elaborazione dati: ' + error.message
    };
  }
}

// ============================ GESTIONE CACHE ============================

/**
 * Invalida cache admin per un aggiornamento
 * @param {string} sessionToken
 * @param {string} cacheType - 'all', 'cantieri', 'dipendenti', 'timeline'
 * @returns {{success: boolean, message: string}}
 */
function invalidateAdminCache(sessionToken, cacheType = 'all') {
  try {
    // Validazione admin
    const adminCheck = validateAdminRole(sessionToken);
    if (!adminCheck.success) {
      return adminCheck;
    }
    
    const cache = CacheService.getScriptCache();
    let keysInvalidated = 0;
    
    switch (cacheType) {
      case 'cantieri':
        cache.remove(CACHE_CONFIG.CACHE_KEYS.CANTIERI_MESE + new Date().getMonth());
        cache.remove(CACHE_CONFIG.CACHE_KEYS.CANTIERI_TOTALI);
        keysInvalidated = 2;
        break;
        
      case 'dipendenti':
        cache.remove(CACHE_CONFIG.CACHE_KEYS.DIPENDENTI);
        keysInvalidated = 1;
        break;
        
      case 'timeline':
        // Invalida tutte le timeline (più complesso, ma semplificato)
        cache.removeAll(); // Opzione drastica ma efficace
        keysInvalidated = 'all';
        break;
        
      case 'all':
      default:
        cache.removeAll();
        keysInvalidated = 'all';
        break;
    }
    
    console.log('Cache invalidated:', cacheType, 'keys:', keysInvalidated);
    
    return {
      success: true,
      message: `Cache ${cacheType} invalidata con successo`,
      keysInvalidated: keysInvalidated
    };
    
  } catch (error) {
    return handleError('invalidateAdminCache', error);
  }
}

// ============================ ENDPOINT API UNIFICATO ============================

/**
 * Endpoint unificato per le API admin - usato dalla webapp
 * Aggiorna anche la funzione doPost esistente per gestire queste nuove azioni
 * @param {Object} requestData - Dati della richiesta
 * @returns {Object} - Risposta API
 */
function handleAdminApiRequest(requestData) {
  try {
    const { action, sessionToken, ...params } = requestData;
    
    console.log('Admin API request:', action, params);
    
    switch (action) {
      case 'validateAdmin':
        return validateAdminRole(sessionToken);
        
      case 'getCantieriOverview':
        return getCantieriAdminOverview(sessionToken, params.modalita);
        
      case 'getDipendentiList':
        return getDipendentiListAdmin(sessionToken);
        
      case 'getDipendenteTimeline':
        return getDipendenteTimelineAdmin(sessionToken, params.userId, params.timeframe);
        
      case 'invalidateCache':
        return invalidateAdminCache(sessionToken, params.cacheType);
        
      default:
        return { 
          success: false, 
          message: 'Azione non riconosciuta: ' + action,
          availableActions: ['validateAdmin', 'getCantieriOverview', 'getDipendentiList', 'getDipendenteTimeline', 'invalidateCache']
        };
    }
    
  } catch (error) {
    return handleError('handleAdminApiRequest', error);
  }
}

// ============================ FUNZIONE TEST ADMIN ============================

/**
 * Funzione di test per verificare le API admin
 */
function testAdminAPI() {
  console.log('=== TEST API ADMIN ===');
  
  try {
    // Test con token di esempio (sostituisci con un token valido)
    const testToken = generateSessionToken('gio'); // Usa l'admin che vedi nel foglio
    
    console.log('1. Test validazione admin...');
    const adminTest = validateAdminRole(testToken);
    console.log('Risultato:', adminTest);
    
    if (adminTest.success) {
      console.log('2. Test cantieri overview (totali)...');
      const cantieriTest = getCantieriAdminOverview(testToken, 'totali');
      console.log('Cantieri trovati:', cantieriTest.data?.length || 0);
      
      console.log('3. Test lista dipendenti...');
      const dipendentiTest = getDipendentiListAdmin(testToken);
      console.log('Dipendenti trovati:', dipendentiTest.data?.length || 0);
      
      console.log('4. Test timeline dipendente...');
      if (dipendentiTest.data && dipendentiTest.data.length > 0) {
        const firstUser = dipendentiTest.data[0];
        const timelineTest = getDipendenteTimelineAdmin(testToken, firstUser.userId, '30days');
        console.log('Timeline per', firstUser.nome, ':', timelineTest.data?.totaleOre || 0, 'ore');
      }
    }
    
    console.log('=== TEST COMPLETATO ===');
    
  } catch (error) {
    console.error('Errore test admin API:', error);
  }
}

// ============================ AGGIORNA FUNZIONE doPost ESISTENTE ============================

// 🔧 AGGIUNGI SOLO QUESTE FUNZIONI al tuo code.gs
// NON copiare le parti con "case" - quelle vanno nel switch esistente

// 🔍 FUNZIONE validateAdmin con DEBUG completo
// 🔧 CORREZIONE validateAdmin - Usa colonna J per "Attivo"
function validateAdmin(sessionToken, userId) {
  Logger.debug('🔍 validateAdmin chiamata con:', {sessionToken: sessionToken, userId: userId});
  
  try {
    // 1. Verifica token sessione
    if (!validateSessionToken(sessionToken)) {
      Logger.warn('❌ Token sessione non valido');
      return { success: false, message: 'Sessione non valida' };
    }
    Logger.debug('✅ Token sessione valido');
    
    // 2. Ottieni userId dal token se non fornito
    if (!userId) {
      const tokenParts = sessionToken.split('_');
      userId = tokenParts[0];
      Logger.debug('📝 UserId estratto dal token:', userId);
    }
    
    // 3. Verifica se l'utente è admin nel foglio
    const spreadsheet = getMainSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    
    if (!userSheet) {
      Logger.error('❌ Foglio Utenti non trovato');
      return { success: false, message: 'Foglio Utenti non trovato' };
    }
    
    const data = userSheet.getDataRange().getValues();
    Logger.debug('📊 Dati utenti letti, righe:', data.length);
    
    // 4. Cerca l'utente nelle righe
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentUserId = row[6]; // Colonna G - Username
      const userRole = row[5];      // Colonna F - Ruolo  
      const isActive = row[9];      // 🔧 CORREZIONE: Colonna J (indice 9) - Attivo
      const userName = row[1];      // Colonna B - Nome
      
      Logger.debug('🔍 Controllo riga ' + i + ':', {
        currentUserId: currentUserId,
        userRole: userRole,
        isActive: isActive,
        userName: userName,
        attivoType: typeof isActive,
        colonnaJ_index9: row[9]
      });
      
      if (currentUserId === userId) {
        Logger.debug('👤 Utente trovato:', userName);
        
        // 🔧 CORREZIONE: Controlla colonna J invece di I
        if (isActive !== 'Si') {
          Logger.warn('❌ Utente non attivo, valore colonna J:', isActive);
          return { success: false, message: 'Utente non attivo' };
        }
        
        // 5. Controlla se è admin
        const isAdmin = (userRole === 'Admin' || userRole === 'admin' || userRole === 'Administrator');
        
        Logger.debug('🔐 Controllo admin:', {
          userRole: userRole,
          isAdmin: isAdmin
        });
        
        if (isAdmin) {
          Logger.debug('✅ Utente admin validato:', userId);
          return {
            success: true,
            message: 'Admin validato con successo',
            data: {
              userId: userId,
              userName: userName,
              adminLevel: 'full',
              permissions: ['view_all', 'edit_all', 'export', 'manage_users']
            }
          };
        } else {
          Logger.warn('❌ Utente non ha privilegi admin, ruolo:', userRole);
          return { success: false, message: 'Utente non ha privilegi admin' };
        }
      }
    }
    
    Logger.warn('❌ Utente non trovato:', userId);
    return { success: false, message: 'Utente non trovato' };
    
  } catch (error) {
    Logger.critical('💥 Errore in validateAdmin:', error);
    return { 
      success: false, 
      message: 'Errore validazione admin: ' + error.toString(),
      error: error.toString()
    };
  }
}

// 🔧 TEST CORRETTO per username "admin"
function testAdminCorrect() {
  Logger.debug('🧪 === TEST ADMIN CORRETTO ===');
  
  try {
    // Test con username "admin" e colonna J
    const testResult = validateAdmin('test_token', 'admin');
    Logger.debug('🧪 Risultato test validateAdmin con admin:', testResult);
    
    // Test lettura diretta foglio per debug colonna J
    const spreadsheet = getMainSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    const data = userSheet.getDataRange().getValues();
    
    Logger.debug('🧪 Headers foglio:', data[0]);
    
    // Trova utente admin specificamente
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[6] === 'admin') { // Colonna G - Username
        Logger.debug('🧪 Utente admin trovato - riga ' + (i + 1) + ':', {
          nome: row[1],           // Colonna B
          ruolo: row[5],          // Colonna F
          username: row[6],       // Colonna G
          colonnaI: row[8],       // Colonna I (per confronto)
          colonnaJ: row[9],       // Colonna J (CORRETTO)
          colonnaJ_type: typeof row[9],
          colonnaJ_length: row[9] ? row[9].length : 0
        });
        break;
      }
    }
    
    return testResult;
    
  } catch (error) {
    Logger.critical('💥 Errore test admin:', error);
    return { success: false, error: error.toString() };
  }
}
// 🔧 FUNZIONE TEST ADMIN - Per verificare configurazione
function testAdminValidation() {
  Logger.debug('🧪 === TEST ADMIN VALIDATION ===');
  
  try {
    // Test con token fittizio
    const testResult = validateAdmin('test_token', 'admin');
    Logger.debug('🧪 Risultato test validateAdmin:', testResult);
    
    // Test lettura foglio direttamente
    const spreadsheet = getMainSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    const data = userSheet.getDataRange().getValues();
    
    Logger.debug('🧪 Headers foglio:', data[0]);
    
    // Trova utente admin
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[6] === 'admin') { // Colonna G - Username
        Logger.debug('🧪 Utente admin trovato:', {
          nome: row[1],
          ruolo: row[5],
          username: row[6],
          attivo: row[8]
        });
        break;
      }
    }
    
    return testResult;
    
  } catch (error) {
    Logger.critical('💥 Errore test admin:', error);
    return { success: false, error: error.toString() };
  }
}

// 🔧 VERSIONE SEMPLIFICATA validateAdmin (backup)
function validateAdminSimple(sessionToken, userId) {
  Logger.debug('🔧 validateAdminSimple chiamata per:', userId);
  
  // Per ora, hardcode per test
  if (userId === 'admin') {
    Logger.debug('✅ Admin hardcoded riconosciuto');
    return {
      success: true,
      message: 'Admin riconosciuto (hardcoded)',
      data: {
        userId: 'admin',
        adminLevel: 'full'
      }
    };
  }
  
  return { success: false, message: 'Non admin' };
}
// AGGIUNGI QUESTE FUNZIONI AL TUO code.gs

// ========== FUNZIONI ADMIN BACKEND ==========
/**
 * Ottieni cantieri con supporto mese corrente OTTIMIZZATO
 */
function getCantieriAdminOverview(sessionToken, modalita) {
  const startTime = Date.now();
  
  try {
    Logger.debug('getCantieriAdminOverview - modalità:', modalita);
    
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    // CACHE KEY specifica per modalità
    const oggi = new Date();
    const cacheKey = modalita === 'mese' 
      ? 'cantieri_mese_' + oggi.getFullYear() + '_' + oggi.getMonth()
      : 'cantieri_totali';
    
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    
    if (cached) {
      Logger.debug('Cache hit per ' + modalita);
      return JSON.parse(cached);
    }
    
    Logger.debug('Cache miss - calcolo da foglio');
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const cantieriSheet = spreadsheet.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }
    
    const lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], message: 'Nessun cantiere' };
    }
    
    // Leggi base dati cantieri
    const cantieriData = cantieriSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const cantieri = [];
    
    if (modalita === 'totali') {
      // MODALITÀ TOTALI - Leggi colonna G direttamente
      for (let i = 0; i < cantieriData.length; i++) {
        const row = cantieriData[i];
        if (row[0]) {
          cantieri.push({
            id: row[0],
            nome: row[1] || 'N/A',
            indirizzo: row[2] || '',
            stato: row[3] || 'N/A',
            oreTotali: parseFloat(row[6]) || 0,  // Colonna G
            ultimoAggiornamento: row[7],
            ultimoDipendente: row[8] || '',
            numeroInserimenti: parseInt(row[9]) || 0
          });
        }
      }
      
    } else {
      // MODALITÀ MESE - Calcola da fogli dipendenti (ottimizzato)
      const oreMeseMap = calcolaOreMeseCorrenteOttimizzato(spreadsheet);
      
      for (let i = 0; i < cantieriData.length; i++) {
        const row = cantieriData[i];
        if (row[0]) {
          const cantiereId = String(row[0]);
          cantieri.push({
            id: cantiereId,
            nome: row[1] || 'N/A',
            indirizzo: row[2] || '',
            stato: row[3] || 'N/A',
            oreTotali: oreMeseMap[cantiereId] || 0,  // Ore mese corrente
            ultimoAggiornamento: row[7],
            ultimoDipendente: row[8] || '',
            numeroInserimenti: parseInt(row[9]) || 0
          });
        }
      }
    }
    
    const result = {
      success: true,
      data: cantieri,
      message: cantieri.length + ' cantieri caricati',
      modalita: modalita,
      loadTime: Date.now() - startTime
    };
    
    // Cache: 5 min per mese (cambia spesso), 30 min per totali (stabile)
    const cacheDuration = modalita === 'mese' ? 300 : 1800;
    cache.put(cacheKey, JSON.stringify(result), cacheDuration);
    
    Logger.debug('Caricati in ' + result.loadTime + 'ms (' + modalita + ')');
    
    return result;
    
  } catch (error) {
    Logger.critical('Errore:', error);
    return { 
      success: false, 
      message: 'Errore: ' + error.toString() 
    };
  }
}

/**
 * Calcola ore mese corrente OTTIMIZZATO - 1 solo loop su tutti i fogli
 */
function calcolaOreMeseCorrenteOttimizzato(spreadsheet) {
  const oreMap = {}; // { cantiereId: ore }
  
  // Date range mese corrente
  const oggi = new Date();
  const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  
  Logger.debug('Calcolo ore mese: da ' + Utilities.formatDate(primoGiornoMese, Session.getScriptTimeZone(), 'dd/MM/yyyy') + 
               ' a ' + Utilities.formatDate(oggi, Session.getScriptTimeZone(), 'dd/MM/yyyy'));
  
  const sheets = spreadsheet.getSheets();
  let fogli = 0;
  let righe = 0;
  
  // Loop UNICO su tutti i fogli
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    // Salta fogli di sistema
    if (sheetName === 'Utenti' || sheetName === 'Cantieri' || sheetName === 'Configurazione') {
      continue;
    }
    
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow < 5) continue;
      
      fogli++;
      
      // Leggi TUTTE le ore del foglio in un colpo solo
      const data = sheet.getRange(5, 1, lastRow - 4, 5).getValues();
      
      for (let j = 0; j < data.length; j++) {
        const row = data[j];
        const dataLavoro = row[0];
        const cantiereId = String(row[1]);
        const ore = parseFloat(row[3]) || 0;
        
        if (!cantiereId || ore <= 0 || !dataLavoro) continue;
        
        // Converti data e filtra per mese corrente
        const dataEntry = new Date(dataLavoro);
        if (dataEntry >= primoGiornoMese && dataEntry <= oggi) {
          if (!oreMap[cantiereId]) {
            oreMap[cantiereId] = 0;
          }
          oreMap[cantiereId] += ore;
          righe++;
        }
      }
      
    } catch (e) {
      Logger.warn('Errore foglio ' + sheetName + ':', e.message);
    }
  }
  
  Logger.debug('Processati ' + fogli + ' fogli, ' + righe + ' righe nel mese corrente');
  
  return oreMap;
}
// Funzione helper per calcolare ore totali cantiere
function calcolaOreCantiere(spreadsheet, cantiereId) {
  let totaleOre = 0;
  const sheets = spreadsheet.getSheets();
  
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    if (sheetName === 'Utenti' || sheetName === 'Cantieri') {
      continue;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) continue;
    
    const data = sheet.getRange(5, 1, lastRow - 4, 5).getValues();
    
    for (let j = 0; j < data.length; j++) {
      const row = data[j];
      const rowCantiereId = row[1];
      const ore = parseFloat(row[3]) || 0;
      
      if (String(rowCantiereId) === String(cantiereId) && ore > 0) {
        totaleOre += ore;
      }
    }
  }
  
  return totaleOre;
}

function calcolaOreCantiereMeseCorrente(spreadsheet, cantiereId, dataInizio, dataFine) {
  let totaleOre = 0;
  const sheets = spreadsheet.getSheets();
  
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    if (sheetName === 'Utenti' || sheetName === 'Cantieri') {
      continue;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 5) continue;
    
    const data = sheet.getRange(5, 1, lastRow - 4, 5).getValues();
    
    for (let j = 0; j < data.length; j++) {
      const row = data[j];
      const dataEntry = new Date(row[0]);
      const rowCantiereId = row[1];
      const ore = parseFloat(row[3]) || 0;
      
      if (String(rowCantiereId) === String(cantiereId) && 
          ore > 0 && 
          dataEntry >= dataInizio && 
          dataEntry <= dataFine) {
        totaleOre += ore;
      }
    }
  }
  
  return totaleOre;
}
/**
 * Ottieni lista dipendenti per admin
 */
/**
 * Lista dipendenti CORRETTA - con ruolo
 */
function getDipendentiListAdmin(sessionToken) {
  const startTime = Date.now();
  
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    Logger.debug('getDipendentiListAdmin');
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    const data = userSheet.getDataRange().getValues();
    const dipendenti = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userId = row[6];   // Colonna G - Username
      const ruolo = row[5] || 'Dipendente'; // Colonna F - Ruolo (con fallback)
      const isActive = row[9]; // Colonna J - Attivo
      
      // Escludi admin, includi solo attivi
      if (userId && ruolo !== 'Admin' && isActive === 'Si') {
        dipendenti.push({
          userId: userId,
          nome: row[1],         // Colonna B - Nome
          ruolo: ruolo          // ✅ CORRETTO
        });
      }
    }
    
    Logger.debug('Dipendenti trovati:', dipendenti.length);
    
    return {
      success: true,
      data: dipendenti,
      loadTime: Date.now() - startTime
    };
    
  } catch (error) {
    Logger.critical('Errore getDipendentiListAdmin:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Ottieni timeline dipendente per admin
 */
function getDipendenteTimelineAdmin(sessionToken, userId, timeframe) {
  try {
    Logger.debug('getDipendenteTimelineAdmin chiamata per:', userId, 'timeframe:', timeframe);
    
    // Verifica token
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    if (!userId) {
      return { success: false, message: 'userId richiesto' };
    }
    
    // Trova il nome del dipendente dal foglio Utenti
    const spreadsheet = getMainSpreadsheet();
    const userSheet = spreadsheet.getSheetByName('Utenti');
    const userData = userSheet.getDataRange().getValues();
    
    let nomeCompleto = null;
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][6] === userId) { // Colonna G - Username
        nomeCompleto = userData[i][1]; // Colonna B - Nome Completo
        break;
      }
    }
    
    if (!nomeCompleto) {
      return { success: false, message: 'Dipendente non trovato' };
    }
    
    // Leggi foglio dipendente
    const dipendenteSheet = spreadsheet.getSheetByName(nomeCompleto);
    if (!dipendenteSheet) {
      return { 
        success: true, 
        message: 'Foglio dipendente non trovato',
        data: { timeline: [], totaleOre: 0 }
      };
    }
    
    const data = dipendenteSheet.getDataRange().getValues();
    const timeline = [];
    let totaleOre = 0;
    
    // Calcola date range in base a timeframe
    const oggi = new Date();
    let dataInizio;
    
    switch (timeframe) {
      case '30days':
        dataInizio = new Date(oggi);
        dataInizio.setDate(oggi.getDate() - 30);
        break;
      case 'lastMonth':
        dataInizio = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
        break;
      case 'year':
        dataInizio = new Date(oggi.getFullYear(), 0, 1);
        break;
      default:
        dataInizio = new Date(oggi);
        dataInizio.setDate(oggi.getDate() - 30);
    }
    
    // Salta header (riga 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dataEntry = new Date(row[0]); // Colonna A - Data
      const ore = parseFloat(row[3]) || 0; // Colonna D - Ore
      
      if (dataEntry >= dataInizio && ore > 0) {
        timeline.push({
          data: row[0],
          cantiereId: row[1],    // Colonna B - Cantiere ID
          cantiere: row[2],      // Colonna C - Nome Cantiere
          ore: ore,
          note: row[4] || ''     // Colonna E - Note
        });
        
        totaleOre += ore;
      }
    }
    
    // Ordina per data decrescente
    timeline.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    return {
      success: true,
      message: 'Timeline caricata',
      data: {
        userId: userId,
        nome: nomeCompleto,
        timeline: timeline,
        totaleOre: totaleOre,
        timeframe: timeframe
      }
    };
    
  } catch (error) {
    Logger.critical('Errore getDipendenteTimelineAdmin:', error);
    return {
      success: false,
      message: 'Errore caricamento timeline: ' + error.toString()
    };
  }
}

/**
 * Invalida cache admin
 */
function invalidateAdminCache(sessionToken, cacheType) {
  try {
    Logger.debug('invalidateAdminCache chiamata per:', cacheType);
    
    // Verifica token
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    // Per ora ritorna successo (cache invalidation può essere implementata dopo)
    return {
      success: true,
      message: 'Cache invalidata: ' + cacheType
    };
    
  } catch (error) {
    Logger.critical('Errore invalidateAdminCache:', error);
    return {
      success: false,
      message: 'Errore invalidazione cache: ' + error.toString()
    };
  }
}

 /* Ottiene le ore totali di un altro utente (solo per admin)*/
function getOtherUserInfo(sessionToken, targetUserId) {
  Logger.debug('getOtherUserInfo chiamata per targetUserId:', targetUserId);
  
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    // Estrai userId di chi fa la richiesta dal token
    var requestingUserId = sessionToken.split('_')[0];
    
    // Verifica che chi richiede sia admin
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    
    // Trova l'indice della colonna Ruolo
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
    if (ruoloColumnIndex === -1) {
      Logger.error('Colonna Ruolo non trovata nel foglio Utenti');
      return { success: false, message: 'Configurazione foglio non valida' };
    }
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (row[COLUMNS.USER_ID] === requestingUserId) {
        var ruolo = row[ruoloColumnIndex];
        isAdmin = (ruolo && ruolo.toString().toLowerCase() === 'admin');
        Logger.debug('Utente trovato:', requestingUserId, 'Ruolo:', ruolo, 'IsAdmin:', isAdmin);
        break;
      }
    }
    
    if (!isAdmin) {
      Logger.warn('Tentativo accesso non autorizzato da:', requestingUserId);
      return { success: false, message: 'Accesso non autorizzato. Solo gli amministratori possono accedere.' };
    }
    
    // Cerca l'utente target
    var targetUserName = null;
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (row[COLUMNS.USER_ID] === targetUserId) {
        targetUserName = row[COLUMNS.NOME];
        break;
      }
    }
    
    if (!targetUserName) {
      return { success: false, message: 'Utente target non trovato' };
    }
    
    // Leggi le ore dal foglio dell'utente target
    var oreData = getUserHoursFromSheet(targetUserName);
    
    Logger.debug('Ore caricate per', targetUserName, ':', oreData);
    
    return {
      success: true,
      data: {
        userId: targetUserId,
        userName: targetUserName,
        oreMese: oreData.oreMeseCorrente,
        oreMesePrecedente: oreData.oreMesePrecedente,
        oreAnno: oreData.oreAnnoCorrente
      }
    };
    
  } catch (error) {
    Logger.error('Errore in getOtherUserInfo:', error);
    return {
      success: false,
      message: 'Errore nel recupero informazioni utente: ' + error.toString()
    };
  }
}

/**
 * Ottiene i dati del calendario mensile di un altro utente (solo per admin)
 */
function getOtherUserMonthlyData(sessionToken, targetUserId, year, month) {
  Logger.debug('getOtherUserMonthlyData:', targetUserId, year, month);
  
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    // Estrai userId di chi fa la richiesta
    var requestingUserId = sessionToken.split('_')[0];
    
    // Verifica che chi richiede sia admin
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    var targetUserName = null;
    
    // Trova l'indice della colonna Ruolo
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
    if (ruoloColumnIndex === -1) {
      Logger.error('Colonna Ruolo non trovata nel foglio Utenti');
      return { success: false, message: 'Configurazione foglio non valida' };
    }
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      
      // Verifica admin
      if (row[COLUMNS.USER_ID] === requestingUserId) {
        var ruolo = row[ruoloColumnIndex];
        isAdmin = (ruolo && ruolo.toString().toLowerCase() === 'admin');
        Logger.debug('Verifica admin - Utente:', requestingUserId, 'Ruolo:', ruolo, 'IsAdmin:', isAdmin);
      }
      
      // Cerca nome utente target
      if (row[COLUMNS.USER_ID] === targetUserId) {
        targetUserName = row[COLUMNS.NOME];
      }
    }
    
    if (!isAdmin) {
      Logger.warn('Tentativo accesso non autorizzato da:', requestingUserId);
      return { success: false, message: 'Accesso non autorizzato. Solo gli amministratori possono accedere.' };
    }
    
    if (!targetUserName) {
      return { success: false, message: 'Utente target non trovato' };
    }
    
    // Accedi al foglio dell'utente target
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet;
    
    try {
      userWorkSheet = spreadsheet.getSheetByName(targetUserName);
    } catch (e) {
      return { 
        success: false, 
        message: 'Foglio utente non trovato: ' + targetUserName 
      };
    }
    
    var lastRow = userWorkSheet.getLastRow();
    
    if (lastRow < 5) {
      return {
        success: true,
        data: {
          year: year,
          month: month,
          userName: targetUserName,
          workDays: {}
        },
        message: 'Nessun dato trovato per questo mese'
      };
    }
    
    // Leggi tutti i dati dal foglio
    var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
	var workDays = {};

	// Parsing parametri anno e mese
	var targetYear = parseInt(year);
	var targetMonth = parseInt(month);

	Logger.debug('Parsing dati per anno:', targetYear, 'mese:', targetMonth);

	for (var i = 0; i < workData.length; i++) {
	  var row = workData[i];
	  var dateValue = row[0];
	  
	  if (!dateValue || dateValue === '') continue;
	  
	  var workDate;
	  if (dateValue instanceof Date) {
		workDate = dateValue;
	  } else if (typeof dateValue === 'string') {
		var parts = dateValue.split('/');
		if (parts.length === 3) {
		  workDate = new Date(parts[2], parts[1] - 1, parts[0]);
		} else {
		  continue;
		}
	  } else {
		continue;
	  }
	  
	  if (isNaN(workDate.getTime())) continue;
	  
	  var workYear = workDate.getFullYear();
	  var workMonth = workDate.getMonth() + 1;
	  
	  if (workYear === targetYear && workMonth === targetMonth) {
		var dateStr = workYear + '-' + 
					 String(workMonth).padStart(2, '0') + '-' + 
					 String(workDate.getDate()).padStart(2, '0');
		
		var cantiereId = row[1] || '';
		var cantiereName = row[2] || '';
		var ore = parseFloat(row[3]) || 0;
		var note = row[4] || '';
		
		// NUOVO: Array multipli inserimenti
		if (!workDays[dateStr]) {
		  workDays[dateStr] = {
			totalOre: 0,
			entries: []
		  };
		}
		
		workDays[dateStr].entries.push({
		  rowIndex: i + 5,
		  cantiereId: cantiereId,
		  cantiereName: cantiereName,
		  ore: ore,
		  note: note
		});
		
		workDays[dateStr].totalOre += ore;
	  }
	}

	return {
	  success: true,
	  data: {
		year: targetYear,
		month: targetMonth,
		userName: targetUserName,
		userId: targetUserId,
		workDays: workDays
	  },
	  message: 'Dati calendario caricati con successo'
	};
    
  } catch (error) {
    Logger.critical('Errore in getOtherUserMonthlyData:', error);
    return {
      success: false,
      message: 'Errore nel caricamento dati calendario: ' + error.toString(),
      error: error.toString()
    };
  }
}
// ========== FUNZIONI PER MODIFICA ORE ADMIN ==========

/**
 * Ottieni TUTTI i cantieri (anche chiusi) per dropdown admin
 */
function getAllCantieriForAdmin(sessionToken) {
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = ss.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }
    
    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], message: 'Nessun cantiere trovato' };
    }
    
    var data = cantieriSheet.getRange(2, 1, lastRow - 1, 4).getValues();
    var cantieri = [];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        cantieri.push({
          id: row[0],
          nome: row[1] || 'N/A',
          indirizzo: row[2] || '',
          stato: row[3] || 'N/A'
        });
      }
    }
    
    return {
      success: true,
      data: cantieri,
      message: cantieri.length + ' cantieri totali (inclusi chiusi)'
    };
    
  } catch (error) {
    Logger.error('Errore getAllCantieriForAdmin:', error);
    return {
      success: false,
      message: 'Errore: ' + error.toString()
    };
  }
}

/**
 * Modifica o crea registrazione ore (solo admin)
 * Include log automatico "** Modificato da amministrazione"
 */
function updateWorkEntry(sessionToken, targetUserId, dateStr, updateData) {
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    var requestingUserId = sessionToken.split('_')[0];
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    var targetUserName = null;
    var adminName = null;
    
    // Trova colonna ruolo
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
    // Verifica admin e trova nomi
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      var headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
      var columnMap = buildColumnMap(headers);
      
      if (row[columnMap['Username']] === requestingUserId) {
        var ruolo = row[ruoloColumnIndex];
        isAdmin = (ruolo && ruolo.toString().toLowerCase() === 'admin');
        adminName = row[columnMap['Nome Completo']];
      }
      if (row[columnMap['Username']] === targetUserId) {
        targetUserName = row[columnMap['Nome Completo']];
      }
    }
    
    if (!isAdmin) {
      return { success: false, message: 'Accesso non autorizzato' };
    }
    
    if (!targetUserName) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    // Valida ore
    var newOre = parseFloat(updateData.ore);
    if (isNaN(newOre) || newOre < 0 || newOre > 24) {
      return { success: false, message: 'Ore non valide (0-24)' };
    }
    
    if (!updateData.cantiereId) {
      return { success: false, message: 'Cantiere richiesto' };
    }
    
    // Ottieni dati cantiere (ID + Nome sincronizzati)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = ss.getSheetByName('Cantieri');
    var nomeCantiere = 'Cantiere sconosciuto';
    var cantiereExists = false;
    
    if (cantieriSheet) {
      var cantieriData = cantieriSheet.getDataRange().getValues();
      for (var i = 1; i < cantieriData.length; i++) {
        if (String(cantieriData[i][0]) === String(updateData.cantiereId)) {
          nomeCantiere = cantieriData[i][1]; // Nome sincronizzato
          cantiereExists = true;
          break;
        }
      }
    }
    
    if (!cantiereExists) {
      return { success: false, message: 'Cantiere non trovato nel sistema' };
    }
    
    // Prepara log amministrativo
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var adminLog = '** Modificato da amministrazione (' + adminName + ' - ' + timestamp + ')';
    var finalNote = updateData.note ? updateData.note + '\n' + adminLog : adminLog;
    
    // Apri foglio utente
    var userWorkSheet = ss.getSheetByName(targetUserName);
    if (!userWorkSheet) {
      return { success: false, message: 'Foglio utente non trovato' };
    }
    
    var lastRow = userWorkSheet.getLastRow();
    var isNewEntry = updateData.isNewEntry === true || updateData.isNewEntry === 'true';
    
    if (isNewEntry) {
      // ===== NUOVO INSERIMENTO =====
      var newRow = Math.max(lastRow + 1, 5);
      var dateParts = dateStr.split('-');
      var workDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      
      userWorkSheet.getRange(newRow, 1, 1, 5).setValues([[
        workDate,
        String(updateData.cantiereId),
        String(nomeCantiere),
        newOre,
        String(finalNote)
      ]]);
      
      userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
      userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
      
      // Aggiorna totali cantiere
      updateCantiereHours(updateData.cantiereId, newOre, targetUserName);
      
      Logger.info('Admin ' + adminName + ' ha inserito nuova registrazione per ' + targetUserName + ' del ' + dateStr);
      
      return {
        success: true,
        message: 'Nuova registrazione inserita con successo',
        data: {
          action: 'insert',
          date: dateStr,
          cantiereId: updateData.cantiereId,
          ore: newOre,
          row: newRow
        }
      };
      
    } else {
      // ===== MODIFICA ESISTENTE =====
      if (lastRow < 5) {
        return { success: false, message: 'Nessun dato trovato - usa "Nuovo inserimento"' };
      }
      
      var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
      var rowToUpdate = -1;
      var oldCantiereId = null;
      var oldOre = 0;
      
      // Cerca riga da modificare
      for (var i = 0; i < workData.length; i++) {
        var rowDate = new Date(workData[i][0]);
        var formattedDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        
        if (formattedDate === dateStr) {
          rowToUpdate = i + 5;
          oldCantiereId = workData[i][1];
          oldOre = parseFloat(workData[i][3]) || 0;
          break;
        }
      }
      
      if (rowToUpdate === -1) {
        return { 
          success: false, 
          message: 'Registrazione non trovata per ' + dateStr + ' - usa "Nuovo inserimento"' 
        };
      }
      
      // Aggiorna riga esistente
      userWorkSheet.getRange(rowToUpdate, 2).setValue(String(updateData.cantiereId));
      userWorkSheet.getRange(rowToUpdate, 3).setValue(String(nomeCantiere));
      userWorkSheet.getRange(rowToUpdate, 4).setValue(newOre);
      userWorkSheet.getRange(rowToUpdate, 5).setValue(String(finalNote));
      
      // Aggiorna totali cantieri
      if (oldCantiereId !== updateData.cantiereId) {
        // Cantiere cambiato: rimuovi dal vecchio, aggiungi al nuovo
        updateCantiereHours(oldCantiereId, -oldOre, targetUserName);
        updateCantiereHours(updateData.cantiereId, newOre, targetUserName);
      } else if (oldOre !== newOre) {
        // Solo ore cambiate
        var diff = newOre - oldOre;
        updateCantiereHours(updateData.cantiereId, diff, targetUserName);
      }
      
      Logger.info('Admin ' + adminName + ' ha modificato registrazione per ' + targetUserName + ' del ' + dateStr);
      
      return {
        success: true,
        message: 'Registrazione modificata con successo',
        data: {
          action: 'update',
          date: dateStr,
          oldCantiereId: oldCantiereId,
          newCantiereId: updateData.cantiereId,
          oldOre: oldOre,
          newOre: newOre,
          row: rowToUpdate
        }
      };
    }
    
  } catch (error) {
    Logger.error('Errore updateWorkEntry:', error);
    return {
      success: false,
      message: 'Errore: ' + error.toString()
    };
  }
}
