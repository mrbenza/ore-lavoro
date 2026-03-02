/**
 * Utils.gs - Funzioni Utility e Helper
 * 
 * ESTRATTO DA: code.gs (righe sparse - Logger, handleError, parseDateFlexible, etc.)
 * MODIFICHE: Solo organizzazione, logica identica
 */

// ========================================
// LOGGER
// ========================================

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

// ========================================
// ERROR HANDLING
// ========================================

/**
 * Gestione errori centralizzata
 * IDENTICO al tuo code.gs
 */
function handleError(context, error) {
  Logger.critical('Errore in ' + context + ':', error);
  return {
    success: false,
    message: 'Errore in ' + context + ': ' + error.toString(),
    error: error.toString()
  };
}

// ========================================
// GESTIONE FOGLI
// ========================================

/**
 * Restituisce in modo sicuro un foglio per nome
 * IDENTICO al tuo code.gs
 */
function getSheetSafely(ss, name) {
  try { 
    return ss.getSheetByName(name); 
  } catch (e) { 
    return null; 
  }
}

/**
 * Rileva il foglio "Utenti" con fallback per contenuto
 * IDENTICO al tuo code.gs
 */
function getWorksheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Impossibile accedere al spreadsheet container');

    var userSheet = getSheetSafely(ss, USER_SHEET_NAME);
    if (userSheet) { 
      Logger.debug('Foglio utenti trovato:', USER_SHEET_NAME); 
      return userSheet; 
    }

    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      try {
        var firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (firstRow.indexOf('Username') !== -1 || 
            firstRow.indexOf('ID Utente') !== -1 || 
            firstRow.indexOf('Nome Completo') !== -1) {
          Logger.debug('Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) { /* continue */ }
    }
    
    Logger.warn('Uso primo foglio disponibile');
    return sheets[0];
    
  } catch (error) {
    throw error;
  }
}

/**
 * Restituisce i valori di una colonna (2D->1D flat) a partire dalla riga 2
 * IDENTICO al tuo code.gs
 */
function getColumnValues(sheet, colOneBased) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, colOneBased, lastRow - 1, 1).getValues().map(r => r[0]);
}

/**
 * Trova l'indice (0-based rispetto a riga 2) della prima occorrenza value nella colonna
 * IDENTICO al tuo code.gs
 */
function indexOfValue(colValues, value) {
  for (var i = 0; i < colValues.length; i++) 
    if (colValues[i] === value) return i;
  return -1;
}

// ========================================
// PARSING E VALIDAZIONI DATE
// ========================================

/**
 * Parsing flessibile di una data
 * IDENTICO al tuo code.gs
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
        if (dt && dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) 
          return dt;
        return null;
      }
      // Fallback: Date.parse (ISO o altre stringhe)
      const p = Date.parse(s);
      if (!isNaN(p)) return new Date(p);
      return null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ========================================
// VALIDAZIONI
// ========================================

/**
 * Valida ore lavorate [0..24]
 * IDENTICO al tuo code.gs
 */
function validateHours(ore) {
  const n = parseFloat(String(ore).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 24) return null;
  return n;
}

// ========================================
// HASH PASSWORD
// ========================================

/**
 * Genera hash password SHA-256
 * IDENTICO al tuo code.gs
 */
function generatePasswordHash(password) {
  var salt = "OreLavoro2025_Salt_";
  var dataToHash = salt + password + salt;
  var hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    dataToHash, 
    Utilities.Charset.UTF_8
  );
  return hash.map(function(byte) { 
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0'); 
  }).join('');
}

// ========================================
// RESPONSE HELPERS
// ========================================

/**
 * Crea risposta CORS JSON
 * IDENTICO al tuo code.gs
 */
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// SESSION TOKEN
// ========================================

/**
 * Genera token di sessione
 * IDENTICO al tuo code.gs
 */
function generateSessionToken(userId) {
  var timestamp = new Date().getTime();
  var random = Math.random().toString(36).substring(2);
  return userId + '_' + timestamp + '_' + random;
}

/**
 * Valida token di sessione
 * IDENTICO al tuo code.gs
 */
function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') { 
    Logger.debug('Token di test accettato'); 
    return true; 
  }
  
  if (!sessionToken || typeof sessionToken !== 'string') { 
    Logger.warn('Token mancante o non valido'); 
    return false; 
  }
  
  var parts = sessionToken.split('_');
  if (parts.length < 3) { 
    Logger.warn('Formato token non valido:', sessionToken); 
    return false; 
  }
  
  var timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) { 
    Logger.warn('Timestamp token non valido'); 
    return false; 
  }
  
  var now = new Date().getTime();
  var tokenAge = now - timestamp;
  var maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  if (tokenAge > maxAge) { 
    Logger.warn('Token scaduto (più di 24 ore)'); 
    return false; 
  }
  
  Logger.debug('Token valido per utente:', parts[0]);
  return true;
}

/**
 * Decodifica session token per estrarre userId
 * IDENTICO al tuo code.gs
 */
function decodeSessionToken(sessionToken) {
  try {
    var parts = sessionToken.split('_');
    
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

// ========================================
// COLUMN MAPPING (per autenticazione robusta)
// ========================================

/**
 * Costruisce mappa nome_colonna -> indice
 * IDENTICO al tuo code.gs
 */
function buildColumnMap(headers) {
  const columnMap = {};
  
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
  
  headers.forEach((header, index) => {
    if (!header) return;
    
    const headerStr = header.toString().trim();
    
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

// ========================================
// FUNZIONI TEST UTILS
// ========================================

/**
 * Test utilities
 */
function testUtils() {
  console.log('=== TEST UTILS ===');
  
  // Test validazione ore
  console.log('validateHours(8.5):', validateHours(8.5));
  console.log('validateHours(25):', validateHours(25)); // null
  console.log('validateHours(-5):', validateHours(-5)); // null
  
  // Test parsing date
  console.log('parseDateFlexible("15/09/2025"):', parseDateFlexible("15/09/2025"));
  console.log('parseDateFlexible("2025-09-15"):', parseDateFlexible("2025-09-15"));
  
  // Test token
  var token = generateSessionToken('test_user');
  console.log('Token generato:', token);
  console.log('Token valido:', validateSessionToken(token));
  
  // Test hash password
  var hash = generatePasswordHash('testpassword');
  console.log('Hash password:', hash);
  
  console.log('=== TEST COMPLETATO ===');
}
