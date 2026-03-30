/**
 * Authentication.gs - Gestione Autenticazione e Sessioni
 *
 * Gestisce il login degli utenti, la verifica delle password (plain text e hash
 * SHA-256), la lettura delle ore riepilogative dal foglio personale e la
 * validazione del ruolo admin. È il modulo di ingresso per qualsiasi accesso
 * autenticato al sistema.
 *
 * USATO DA: ApiRouter.gs (endpoint 'authenticate' e 'validateAdmin')
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICAZIONE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Autentica un utente verificando username, stato attivo e password.
 *
 * Implementa autenticazione robusta con mapping dinamico delle colonne tramite
 * buildColumnMap(). Supporta sia password plain text (fallback legacy) sia hash
 * SHA-256 (metodo sicuro). Se l'autenticazione plain text va a buon fine,
 * auto-migra silenziosamente l'hash nel foglio.
 *
 * FLUSSO INTERNO:
 *   1. Legge gli header del foglio Utenti e costruisce columnMap
 *   2. Verifica che le colonne obbligatorie esistano
 *   3. Cerca l'utente per username (match esatto)
 *   4. Verifica che l'utente sia attivo (colonna 'Attivo' === 'Si'/'si'/'SI')
 *   5. Chiama verifyUserPassword() per validare la password
 *   6. Se plain text ok → auto-migra l'hash nel foglio (non bloccante)
 *   7. Genera il session token con generateSessionToken()
 *   8. Legge le ore dal foglio personale con getUserHoursFromSheet()
 *   9. Restituisce struttura completa con dati utente e token
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='authenticate')
 *              ApiRouter.gs → doPost() (action='authenticate')
 * CHIAMA:      getWorksheet(), buildColumnMap(), verifyUserPassword(),
 *              generatePasswordHash(), generateSessionToken(),
 *              getUserHoursFromSheet(), handleError(), Logger.auth/warn/info/debug
 *
 * @param {string} userId   - Username dell'utente (campo 'Username' nel foglio).
 * @param {string} password - Password in chiaro fornita dall'utente.
 * @returns {{
 *   success: boolean,
 *   message: string,
 *   data?: {
 *     idUtente: string, userId: string, name: string, email: string,
 *     telefono: string, dataAssunzione: string, ruolo: string,
 *     oreMese: number, oreMesePrecedente: number, oreAnno: number,
 *     rowIndex: number, authMethod: string
 *   },
 *   sessionToken?: string,
 *   systemInfo?: { version, build, mode, authMethod, hashSupport, installType }
 * }} Risposta autenticazione.
 *
 * @example
 * const res = authenticateUser('mario.rossi', 'password123');
 * // res → { success: true, data: { name: 'Mario Rossi', ruolo: 'Dipendente', ... },
 * //          sessionToken: 'mario.rossi_1709123456_abc' }
 */
function authenticateUser(userId, password) {
  try {
    Logger.auth('Tentativo autenticazione per:', userId);

    const sheet = getWorksheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return { success: false, message: 'Nessun dato utente trovato nel foglio' };
    }

    // STEP 1: Leggi header e mappa colonne
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);

    // Verifica colonne essenziali
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
        userRowIndex = i + 2;
        break;
      }
    }

    if (!userRow) {
      Logger.warn('Credenziali non valide per:', userId);
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
      Logger.warn('Password non valida per utente:', userId);
      return { success: false, message: 'Credenziali non valide o utente inattivo' };
    }

    // STEP 6: Auto-migrazione hash se necessario
    if (passwordResult.needsMigration) {
      try {
        const newHash = generatePasswordHash(password);
        const hashColumn = columnMap['Password Hash'] || columnMap['PasswordHash'];

        if (hashColumn !== undefined) {
          sheet.getRange(userRowIndex, hashColumn + 1).setValue(newHash);
          Logger.info('Hash auto-generato e salvato per utente:', userId);
          passwordResult.authMethod = 'plain_migrated';
        }
      } catch (e) {
        Logger.warn('Errore auto-migrazione hash (non critico):', e.message);
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

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICA PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica la password di un utente confrontando con hash o plain text.
 *
 * Implementa la logica di autenticazione a doppio livello:
 *   - Caso 1 (sicuro): confronta l'hash SHA-256 dell'input con il campo 'Password Hash'
 *   - Caso 2 (legacy): confronta in chiaro con il campo 'Password'; segnala migrazione
 *   - Caso 3: nessuna password configurata → sempre non valido
 *
 * FLUSSO INTERNO:
 *   1. Legge passwordPlain e passwordHash dalla riga utente
 *   2. Genera inputPasswordHash da generatePasswordHash(password)
 *   3. Se passwordHash presente → confronto hash
 *   4. Altrimenti confronto plain text → needsMigration=true se ok
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser()
 * CHIAMA:      generatePasswordHash(), Logger.debug/warn/error
 *
 * @param {Array<*>}         userRow   - Riga dati utente dal foglio.
 * @param {string}           password  - Password in chiaro fornita dall'utente.
 * @param {Object.<string,number>} columnMap - Mappa colonne da buildColumnMap().
 * @returns {{
 *   valid: boolean,
 *   authMethod: 'hash'|'plain_fallback'|'plain_migrated'|'no_password'|'error',
 *   needsMigration: boolean
 * }} Risultato verifica.
 */
function verifyUserPassword(userRow, password, columnMap) {
  try {
    const passwordPlain = userRow[columnMap['Password']] || '';
    const passwordHash = userRow[columnMap['Password Hash']] || '';

    const inputPasswordHash = generatePasswordHash(password);

    // Caso 1: Verifica con hash (metodo sicuro)
    if (passwordHash && passwordHash !== '') {
      Logger.debug('Verificando con password hash (SICURO)...');

      const hashValid = (passwordHash === inputPasswordHash);

      return {
        valid: hashValid,
        authMethod: 'hash',
        needsMigration: false
      };
    }

    // Caso 2: Fallback con password plain text
    if (passwordPlain && passwordPlain !== '') {
      Logger.warn('FALLBACK: Verificando con password plain text...');

      const plainValid = (passwordPlain.toString() === password.toString());

      return {
        valid: plainValid,
        authMethod: 'plain_fallback',
        needsMigration: plainValid
      };
    }

    // Caso 3: Nessuna password configurata
    Logger.warn('PROBLEMA: Utente senza password configurata');
    return {
      valid: false,
      authMethod: 'no_password',
      needsMigration: false
    };

  } catch (error) {
    Logger.error('Errore verifica password:', error);
    return {
      valid: false,
      authMethod: 'error',
      needsMigration: false
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LETTURA ORE UTENTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legge le ore riepilogative dal foglio personale di un dipendente.
 *
 * Prima tenta di leggere dalle celle SUMIFS predefinite (F2, G2, H2). Se tutte
 * e tre risultano 0 (cioè le formule non sono presenti o non hanno dati), fa un
 * fallback calcolando manualmente le ore iterando le righe dati dalla riga 5
 * in poi, suddividendo per mese corrente, mese precedente e anno corrente.
 *
 * FLUSSO INTERNO:
 *   1. Cerca il foglio con nome userName tramite getSheetSafely()
 *   2. Legge celle F2, G2, H2 (SUMIFS) in un'unica chiamata getValues() batch
 *   3. Se tutti 0 → scansiona righe dati (riga 5+) e calcola manualmente
 *   4. Restituisce { oreMeseCorrente, oreMesePrecedente, oreAnnoCorrente }
 *
 * CHIAMATA DA: Authentication.gs → authenticateUser()
 *              SheetsDAO.gs → getUserInfo(), getOtherUserInfo()
 * CHIAMA:      getSheetSafely(), Logger.warn/error
 *
 * @param {string} userName - Nome completo del dipendente (= nome del suo foglio).
 * @returns {{ oreMeseCorrente: number, oreMesePrecedente: number, oreAnnoCorrente: number }}
 *          Ore calcolate; tutti 0 se il foglio non esiste o è vuoto.
 */
function getUserHoursFromSheet(userName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = getSheetSafely(ss, userName);

    if (!userSheet) {
      Logger.warn('Foglio "' + userName + '" non trovato');
      return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
    }

    // Prima prova: leggi dalle celle SUMIFS (F2, G2, H2).
    // F2, G2, H2 sono contigue — una sola chiamata getValues() invece di 3 getValue().
    var oreRange = userSheet.getRange('F2:H2').getValues()[0];
    var oreMeseCorrente   = parseFloat(oreRange[0]) || 0;
    var oreMesePrecedente = parseFloat(oreRange[1]) || 0;
    var oreAnnoCorrente   = parseFloat(oreRange[2]) || 0;

    // Fallback: se le celle SUMIFS sono tutte 0, calcola direttamente dai dati
    if (oreMeseCorrente === 0 && oreMesePrecedente === 0 && oreAnnoCorrente === 0) {
      var lastRow = userSheet.getLastRow();
      var firstDataRow = CONFIG.DATA_STRUCTURE.HEADER_ROWS + 1; // riga 5

      if (lastRow >= firstDataRow) {
        var numRows = lastRow - firstDataRow + 1;
        // Legge colonne A (Data) e D (Ore) — indici 0 e 3
        var data = userSheet.getRange(firstDataRow, 1, numRows, 4).getValues();

        var oggi = new Date();
        var meseCorrente = oggi.getMonth();
        var annoCorrente = oggi.getFullYear();
        var mesePrecedente = meseCorrente === 0 ? 11 : meseCorrente - 1;
        var annoPrecedente = meseCorrente === 0 ? annoCorrente - 1 : annoCorrente;

        for (var i = 0; i < data.length; i++) {
          var dataLavoro = data[i][0]; // colonna A
          var ore = parseFloat(data[i][3]) || 0; // colonna D

          if (!dataLavoro || ore <= 0) continue;

          var d;
          if (dataLavoro instanceof Date) {
            d = dataLavoro;
          } else {
            d = new Date(dataLavoro);
            if (isNaN(d.getTime())) continue;
          }

          var anno = d.getFullYear();
          var mese = d.getMonth();

          if (anno === annoCorrente && mese === meseCorrente) {
            oreMeseCorrente += ore;
          }
          if (anno === annoPrecedente && mese === mesePrecedente) {
            oreMesePrecedente += ore;
          }
          if (anno === annoCorrente) {
            oreAnnoCorrente += ore;
          }
        }
      }
    }

    return {
      oreMeseCorrente: oreMeseCorrente,
      oreMesePrecedente: oreMesePrecedente,
      oreAnnoCorrente: oreAnnoCorrente
    };

  } catch (error) {
    Logger.error('Errore lettura ore per ' + userName + ':', error);
    return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAZIONE ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida che il token di sessione appartenga a un utente con ruolo admin.
 *
 * Esegue due controlli distinti:
 *   1. Valida la sessione con validateSessionToken()
 *   2. Verifica nel foglio Utenti che l'utente abbia ruolo Admin/Administrator
 *      e sia attivo (colonna J = 'Si')
 *
 * Se userId non è fornito, lo estrae dal token (prima parte prima di '_').
 *
 * FLUSSO INTERNO:
 *   1. validateSessionToken() → rifiuta se token non valido
 *   2. Estrae userId dal token se non passato
 *   3. Legge foglio Utenti con getMainSpreadsheet()
 *   4. Scansiona righe cercando userId (colonna G, indice 6)
 *   5. Controlla Attivo (colonna J, indice 9) e Ruolo (colonna F, indice 5)
 *   6. Restituisce successo con permissions array o errore specifico
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='validateAdmin')
 *              ApiRouter.gs → doPost() (action='validateAdmin')
 * CHIAMA:      validateSessionToken(), getMainSpreadsheet(), Logger.debug/warn/error/critical
 *
 * @param {string} sessionToken - Token sessione nel formato "{userId}_{ts}_{random}".
 * @param {string} [userId]     - Username opzionale; se omesso viene estratto dal token.
 * @returns {{
 *   success: boolean,
 *   message: string,
 *   data?: {
 *     userId: string, userName: string, adminLevel: string,
 *     permissions: string[]
 *   }
 * }} Risultato validazione admin.
 *
 * @example
 * const res = validateAdmin('admin_1709123456_abc', 'admin');
 * // res → { success: true, data: { userId: 'admin', adminLevel: 'full', ... } }
 */
function validateAdmin(sessionToken, userId) {
  Logger.debug('validateAdmin chiamata con:', {sessionToken: sessionToken, userId: userId});

  try {
    // 1. Verifica token sessione
    if (!validateSessionToken(sessionToken)) {
      Logger.warn('Token sessione non valido');
      return { success: false, message: 'Sessione non valida' };
    }
    Logger.debug('Token sessione valido');

    // 2. Ottieni userId dal token se non fornito
    if (!userId) {
      const tokenParts = String(sessionToken).split('_');
      userId = tokenParts.slice(0, tokenParts.length - 2).join('_');
      Logger.debug('UserId estratto dal token:', userId);
    }

    // 3. Verifica se l'utente è admin nel foglio
    const spreadsheet = getMainSpreadsheet();
    const userSheet = spreadsheet.getSheetByName(SHEET_NAMES.UTENTI);

    if (!userSheet) {
      Logger.error('Foglio Utenti non trovato');
      return { success: false, message: 'Foglio Utenti non trovato' };
    }

    const data = userSheet.getDataRange().getValues();
    Logger.debug('Dati utenti letti, righe:', data.length);

    // 4. Costruisci mappa colonne dagli header (robusto a variazioni nell'ordine)
    const headers = data[0];
    const columnMap = buildColumnMap(headers);

    // Cerca l'utente nelle righe
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentUserId = row[columnMap['Username']]; // mapping dinamico
      const userRole = row[columnMap['Ruolo']];         // mapping dinamico
      const isActive = row[columnMap['Attivo']];        // mapping dinamico
      const userName = row[columnMap['Nome Completo']]; // mapping dinamico

      Logger.debug('Controllo riga ' + i + ':', {
        currentUserId: currentUserId,
        userRole: userRole,
        isActive: isActive,
        userName: userName
      });

      if (currentUserId === userId) {
        Logger.debug('Utente trovato:', userName);

        if (!(isActive === 'Si' || isActive === 'SI' || isActive === 'si' || isActive === true)) {
          Logger.warn('Utente non attivo, valore colonna Attivo:', isActive);
          return { success: false, message: 'Utente non attivo' };
        }

        // 5. Controlla se è admin usando ADMIN_VALIDATION per coerenza col resto del codebase
        const isAdmin = ADMIN_VALIDATION.isAdminRole(userRole);

        Logger.debug('Controllo admin:', {
          userRole: userRole,
          isAdmin: isAdmin
        });

        if (isAdmin) {
          Logger.debug('Utente admin validato:', userId);
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
          Logger.warn('Utente non ha privilegi admin, ruolo:', userRole);
          return { success: false, message: 'Utente non ha privilegi admin' };
        }
      }
    }

    Logger.warn('Utente non trovato:', userId);
    return { success: false, message: 'Utente non trovato' };

  } catch (error) {
    Logger.critical('Errore in validateAdmin:', error);
    return {
      success: false,
      message: 'Errore validazione admin: ' + error.toString(),
      error: error.toString()
    };
  }
}
