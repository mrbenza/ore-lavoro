/**
 * Utils.gs - Funzioni Utility e Helper
 *
 * Raccoglie tutte le funzioni di supporto condivise tra i moduli GAS:
 * logger, gestione errori, helper fogli, parsing date, validazioni,
 * hash password, CORS response, session token, column mapping.
 *
 * USATO DA: Authentication.gs, ApiRouter.gs, AdminAPI.gs, UserAPI.gs,
 *           SheetsDAO.gs, Main.gs, GestionePassword.gs
 */

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER — oggetto singleton con livelli debug/info/warn/error/auth/save/critical.
// I livelli rispettano i flag in PRODUCTION_CONFIG (Config.gs).
// Usato da tutti i moduli con Logger.debug(), Logger.error(), ecc.
// ─────────────────────────────────────────────────────────────────────────────

const Logger = {
  /**
   * Log di debug — attivo solo se PRODUCTION_CONFIG.DEBUG_MODE === true.
   * Non stampare mai in produzione; usare per tracciare valori intermedi.
   */
  debug: function() {
    if (PRODUCTION_CONFIG.DEBUG_MODE) {
      console.log.apply(console, ['[DEBUG]'].concat(Array.prototype.slice.call(arguments)));
    }
  },

  /**
   * Log informativo — sempre attivo. Usare per eventi non critici.
   */
  info: function() {
    console.log.apply(console, ['[INFO]'].concat(Array.prototype.slice.call(arguments)));
  },

  /**
   * Log di warning — sempre attivo. Usare per situazioni anomale non bloccanti.
   */
  warn: function() {
    console.warn.apply(console, ['[WARN]'].concat(Array.prototype.slice.call(arguments)));
  },

  /**
   * Log di errore — sempre attivo. Usare per eccezioni catturate.
   */
  error: function() {
    console.error.apply(console, ['[ERROR]'].concat(Array.prototype.slice.call(arguments)));
  },

  /**
   * Log di autenticazione — attivo se PRODUCTION_CONFIG.LOG_AUTH === true.
   * Usare in Authentication.gs per tracciare tentativi di login.
   */
  auth: function() {
    if (PRODUCTION_CONFIG.LOG_AUTH) {
      console.log.apply(console, ['[AUTH]'].concat(Array.prototype.slice.call(arguments)));
    }
  },

  /**
   * Log di salvataggio — attivo se PRODUCTION_CONFIG.LOG_SAVE_OPERATIONS === true.
   * Usare in UserAPI.gs e SheetsDAO.gs per tracciare scritture su Sheets.
   */
  save: function() {
    if (PRODUCTION_CONFIG.LOG_SAVE_OPERATIONS) {
      console.log.apply(console, ['[SAVE]'].concat(Array.prototype.slice.call(arguments)));
    }
  },

  /**
   * Log critico — attivo se PRODUCTION_CONFIG.LOG_CRITICAL_ERRORS === true.
   * Usare per errori che richiedono attenzione immediata (catch di funzioni API).
   */
  critical: function() {
    if (PRODUCTION_CONFIG.LOG_CRITICAL_ERRORS) {
      console.error.apply(console, ['[CRITICAL]'].concat(Array.prototype.slice.call(arguments)));
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gestione centralizzata degli errori — restituisce struttura risposta standard.
 *
 * Logga l'errore a livello CRITICAL e restituisce l'oggetto {success, message, error}
 * compatibile con il formato atteso dal frontend e da ApiRouter.gs.
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser()
 *              UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 *              ApiRouter.gs → doGet(), doPost()
 * CHIAMA:      Logger.critical()
 *
 * @param {string} context - Nome della funzione in cui si è verificato l'errore.
 * @param {Error}  error   - Oggetto errore catturato dal catch.
 * @returns {{ success: false, message: string, error: string }} Risposta di errore.
 *
 * @example
 * } catch (error) {
 *   return handleError('saveWorkEntry', error);
 * }
 */
function handleError(context, error) {
  Logger.critical('Errore in ' + context + ':', error);
  return {
    success: false,
    message: 'Errore in ' + context + ': ' + error.toString(),
    error: error.toString()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTIONE FOGLI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce un foglio per nome senza propagare eccezioni.
 *
 * Wrapper di sicurezza attorno a ss.getSheetByName() che restituisce null
 * invece di lanciare un'eccezione se il foglio non esiste o c'è un errore.
 * Usato ovunque si accede a fogli con nome variabile (fogli dipendente).
 *
 * CHIAMATA DA: Authentication.gs → getUserHoursFromSheet()
 *              UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 *              SheetsDAO.gs → updateCantiereHours(), getCantieri()
 *              ApiRouter.gs → testConfiguration()
 * CHIAMA:      ss.getSheetByName()
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss   - Spreadsheet su cui cercare.
 * @param {string}                                   name - Nome del foglio.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null} Foglio trovato o null.
 *
 * @example
 * const sheet = getSheetSafely(ss, 'Mario Rossi');
 * if (!sheet) return { success: false, message: 'Foglio non trovato' };
 */
function getSheetSafely(ss, name) {
  try {
    return ss.getSheetByName(name);
  } catch (e) {
    return null;
  }
}

/**
 * Trova e restituisce il foglio "Utenti" con logica di fallback progressiva.
 *
 * Strategia:
 *   1. Cerca per nome esatto usando USER_SHEET_NAME ('Utenti')
 *   2. Se non trovato, scansiona tutti i fogli cercando gli header standard
 *      ('Username', 'ID Utente', 'Nome Completo')
 *   3. Come ultima risorsa restituisce il primo foglio disponibile
 *
 * Questa logica rende il sistema robusto a rinominazioni accidentali del foglio
 * o a spreadsheet con struttura non standard.
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser()
 *              UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 *              AdminAPI.gs → getOtherUserMonthlyData(), updateWorkEntry(), deleteWorkEntry()
 *              SheetsDAO.gs → getUserInfo(), getOtherUserInfo()
 * CHIAMA:      getSheetSafely(), Logger.debug(), Logger.warn()
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Foglio Utenti.
 * @throws {Error} Se SpreadsheetApp.getActiveSpreadsheet() fallisce.
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
 * Restituisce i valori di una colonna (da riga 2 in poi) come array piatto.
 *
 * Converte il risultato 2D di getRange().getValues() in un array 1D
 * che può essere iterato con indexOfValue().
 *
 * CHIAMATA DA: UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 * CHIAMA:      sheet.getRange()
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet        - Foglio sorgente.
 * @param {number}                             colOneBased  - Indice colonna (1-based).
 * @returns {Array<*>} Array di valori della colonna dalla riga 2 in poi.
 */
function getColumnValues(sheet, colOneBased) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, colOneBased, lastRow - 1, 1).getValues().map(r => r[0]);
}

/**
 * Trova l'indice (0-based rispetto a riga 2) della prima occorrenza di un valore.
 *
 * Usata insieme a getColumnValues() per localizzare righe utente nei fogli.
 *
 * CHIAMATA DA: UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 * CHIAMA:      (nessuna)
 *
 * @param {Array<*>} colValues - Array di valori (output di getColumnValues).
 * @param {*}        value     - Valore da cercare.
 * @returns {number} Indice 0-based o -1 se non trovato.
 */
function indexOfValue(colValues, value) {
  for (var i = 0; i < colValues.length; i++)
    if (colValues[i] === value) return i;
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING E VALIDAZIONI DATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte in modo flessibile una data da vari formati a oggetto Date.
 *
 * Supporta:
 *   - Oggetti Date (passthrough con validità)
 *   - Numeri (timestamp ms)
 *   - Stringhe nel formato dd/mm/yyyy (formato italiano)
 *   - Stringhe ISO 8601 e altri formati accettati da Date.parse()
 *
 * Restituisce null se il valore non è convertibile, mai eccezioni.
 *
 * FLUSSO INTERNO:
 *   1. Controlla se è già un Date valido → ritorna direttamente
 *   2. Se numero → new Date(input)
 *   3. Se stringa: prova regex dd/mm/yyyy → poi Date.parse()
 *   4. Qualsiasi errore → null
 *
 * CHIAMATA DA: UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 *              UtilsMenu.gs → parseItalianDate() (funzione parallela, non questa)
 * CHIAMA:      (nessuna)
 *
 * @param {Date|string|number} input - Valore data da convertire.
 * @returns {Date|null} Oggetto Date valido o null se non convertibile.
 *
 * @example
 * parseDateFlexible('15/09/2025') // → Date(2025, 8, 15)
 * parseDateFlexible('2025-09-15') // → Date(2025, 8, 15)
 * parseDateFlexible('invalid')    // → null
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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAZIONI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un valore di ore lavorate, accettando il range [0..24].
 *
 * Converte la virgola in punto prima del parsing (supporto formato italiano).
 * Restituisce null se il valore è fuori range o non numerico.
 *
 * CHIAMATA DA: UserAPI.gs → saveWorkEntry()
 * CHIAMA:      (nessuna)
 *
 * @param {string|number} ore - Valore ore da validare (es. "8,5" o 8.5).
 * @returns {number|null} Ore validate come float, o null se non valide.
 *
 * @example
 * validateHours('8,5') // → 8.5
 * validateHours(25)    // → null
 * validateHours('abc') // → null
 */
function validateHours(ore) {
  const n = parseFloat(String(ore).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 24) return null;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// HASH PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera l'hash SHA-256 di una password con salt fisso.
 *
 * Usa Utilities.computeDigest() con algoritmo SHA-256. Il salt è prefisso e
 * suffisso della stringa hasciata. Questo garantisce che lo stesso salt sia
 * usato su tutti i login, evitando mismatch.
 *
 * ATTENZIONE: il salt è hardcoded nel codice. Cambiarlo renderebbe tutte le
 * password esistenti non più valide.
 *
 * FLUSSO INTERNO:
 *   1. Costruisce stringa: salt + password + salt
 *   2. Calcola digest SHA-256 come array di byte
 *   3. Converte ogni byte in hex a 2 cifre (gestendo byte negativi JS)
 *   4. Restituisce stringa hex di 64 caratteri
 *
 * CHIAMATA DA: Authentication.gs → verifyUserPassword() (genera hash dell'input)
 *              Authentication.gs → authenticateUser() (per auto-migrazione)
 *              GestionePassword.gs → updateUserPassword()
 *              ApiRouter.gs → testConfiguration() (verifica esistenza)
 * CHIAMA:      Utilities.computeDigest()
 *
 * @param {string} password - Password in chiaro da hashare.
 * @returns {string} Hash SHA-256 in formato hex (64 caratteri).
 *
 * @example
 * generatePasswordHash('miapassword') // → 'a3f1...' (64 caratteri hex)
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

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea una risposta HTTP JSON con header appropriati per CORS.
 *
 * Serializza i dati in JSON e li restituisce come TextOutput con MIME type JSON.
 * GAS imposta automaticamente Content-Type; il CORS effettivo è gestito da
 * api/proxy.js su Vercel. Questa funzione è il singolo punto di uscita di
 * tutte le risposte di doGet() e doPost() in ApiRouter.gs.
 *
 * CHIAMATA DA: ApiRouter.gs → doGet(), doPost()
 * CHIAMA:      ContentService.createTextOutput()
 *
 * @param {object} data - Oggetto da serializzare come risposta JSON.
 * @returns {GoogleAppsScript.Content.TextOutput} TextOutput con MIME JSON.
 */
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TOKEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un token di sessione univoco per un utente.
 *
 * Formato: {userId}_{timestamp}_{random}
 * Il timestamp permette di verificare la scadenza (24h) in validateSessionToken().
 * Il componente random garantisce unicità anche per lo stesso utente.
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser()
 *              ApiRouter.gs → testGetMonthlyWorkData(), testAuthentication()
 * CHIAMA:      (nessuna)
 *
 * @param {string} userId - Username dell'utente (estratto dal foglio Utenti).
 * @returns {string} Token nel formato "{userId}_{timestamp}_{random}".
 *
 * @example
 * generateSessionToken('mario.rossi')
 * // → 'mario.rossi_1709123456789_k3f9x2'
 */
function generateSessionToken(userId) {
  var timestamp = new Date().getTime();
  var random = Math.random().toString(36).substring(2);
  return userId + '_' + timestamp + '_' + random;
}

/**
 * Valida un token di sessione verificando formato e scadenza (24 ore).
 *
 * Logica di validazione:
 *   1. Token speciali 'test' e 'test_token' sono sempre validi (per debug)
 *   2. Il token deve essere una stringa non vuota
 *   3. Deve avere almeno 3 parti separate da underscore
 *   4. La seconda parte deve essere un timestamp numerico
 *   5. Il token non deve essere più vecchio di 24 ore
 *
 * CHIAMATA DA: ApiRouter.gs → doGet(), doPost() (implicito tramite funzioni API)
 *              Authentication.gs → validateAdmin()
 *              AdminAPI.gs → getCantieriAdminOverview(), getDipendentiListAdmin(),
 *                            getDipendenteTimelineAdmin(), getOtherUserMonthlyData(),
 *                            updateWorkEntry(), deleteWorkEntry(), invalidateAdminCache()
 *              SheetsDAO.gs → getCantieri(), getUserInfo(), getOtherUserInfo(),
 *                             getAllCantieriForAdmin()
 *              UserAPI.gs → saveWorkEntry(), getMonthlyWorkData()
 * CHIAMA:      Logger.debug(), Logger.warn()
 *
 * @param {string} sessionToken - Token da validare nel formato "{userId}_{ts}_{random}".
 * @returns {boolean} true se il token è valido e non scaduto.
 *
 * @example
 * validateSessionToken('mario_1709123456789_abc') // → true
 * validateSessionToken('mario_1234_x')            // → false (scaduto)
 * validateSessionToken('test')                    // → true (token di debug)
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
 * Decodifica un token di sessione estraendo userId e timestamp.
 *
 * Non valida la scadenza — usare validateSessionToken() per quella verifica.
 * Utile quando si vuole solo sapere chi è l'utente senza ri-validare.
 *
 * CHIAMATA DA: non risulta chiamata da altri file  // ⚠️ DEAD CODE: non risulta chiamata da altri file
 *              (le funzioni API estraggono userId direttamente con split('_')[0])
 * CHIAMA:      (nessuna)
 *
 * @param {string} sessionToken - Token di sessione.
 * @returns {{ userId: string, timestamp: number }|null} Oggetto decodificato o null.
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

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN MAPPING (per autenticazione robusta)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Costruisce una mappa {nomeColonnaStandard: indice} dagli header del foglio Utenti.
 *
 * Permette di accedere alle colonne per nome semantico anziché per indice fisso,
 * rendendo il codice robusto a variazioni nell'ordine delle colonne del foglio.
 *
 * La mappa riconosce varianti dei nomi (es. 'User ID', 'UserID', 'Username' → 'Username').
 * Il matching è case-insensitive e usa confronto "contains" bidirezionale.
 *
 * FLUSSO INTERNO:
 *   1. Itera ogni header del foglio
 *   2. Per ogni standard name (es. 'Username') controlla se l'header corrisponde
 *      a una delle sue varianti riconosciute
 *   3. Popola columnMap[standardName] = indice
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser(), verifyUserPassword()
 *              AdminAPI.gs → updateWorkEntry(), deleteWorkEntry()
 *              SheetsDAO.gs → getUserInfo()
 *              GestionePassword.gs → getColumnMapping() (funzione parallela specializzata)
 * CHIAMA:      (nessuna)
 *
 * @param {Array<string>} headers - Array di header letti dal foglio (riga 1).
 * @returns {Object.<string, number>} Mappa {nomeStandard: indice0based}.
 *
 * @example
 * const headers = ['ID Utente', 'Nome Completo', 'Email', ..., 'Username', ...];
 * const map = buildColumnMap(headers);
 * // map → { 'ID Utente': 0, 'Nome Completo': 1, 'Email': 2, 'Username': 6, ... }
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

// ─────────────────────────────────────────────────────────────────────────────
// FUNZIONI TEST UTILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test manuale delle funzioni utility — da eseguire dall'editor GAS.
 *
 * Verifica: validateHours, parseDateFlexible, generateSessionToken,
 * validateSessionToken, generatePasswordHash.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      validateHours(), parseDateFlexible(), generateSessionToken(),
 *              validateSessionToken(), generatePasswordHash()
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
