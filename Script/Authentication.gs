/**
 * Authentication.gs - Gestione Autenticazione e Sessioni
 * 
 * ESTRATTO DA: code.gs (authenticateUser, verifyUserPassword, getUserHoursFromSheet)
 * MODIFICHE: Nessuna modifica alla logica - solo organizzazione
 */

// ========================================
// AUTENTICAZIONE PRINCIPALE
// ========================================

/**
 * Autentica l'utente - ROBUSTA con column mapping
 * IDENTICO al tuo code.gs (righe 135-300 circa)
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

// ========================================
// VERIFICA PASSWORD
// ========================================

/**
 * Verifica password utente (supporta plain e hash)
 * IDENTICO al tuo code.gs
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

// ========================================
// LETTURA ORE UTENTE
// ========================================

/**
 * Legge ore riepilogative dal foglio personale dell'utente.
 * Prima prova le celle SUMIFS (F2, G2, H2); se tutte a 0 (formule mancanti),
 * calcola direttamente dalle righe dati (riga 5 in poi, HEADER_ROWS = 4).
 *
 * @param {string} userName - Nome completo utente (= nome foglio personale)
 * @return {{oreMeseCorrente: number, oreMesePrecedente: number, oreAnnoCorrente: number}}
 */
function getUserHoursFromSheet(userName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = getSheetSafely(ss, userName);

    if (!userSheet) {
      Logger.warn('Foglio "' + userName + '" non trovato');
      return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
    }

    // Prima prova: leggi dalle celle SUMIFS (F2, G2, H2)
    var oreMeseCorrente = parseFloat(userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue()) || 0;
    var oreMesePrecedente = parseFloat(userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue()) || 0;
    var oreAnnoCorrente = 0;
    try {
      oreAnnoCorrente = parseFloat(userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue()) || 0;
    } catch (e) { /* cella assente */ }

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

// ========================================
// VALIDAZIONE ADMIN
// ========================================

/**
 * Valida se l'utente ha ruolo admin
 * IDENTICO al tuo code.gs
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
      const tokenParts = sessionToken.split('_');
      userId = tokenParts[0];
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
    
    // 4. Cerca l'utente nelle righe
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const currentUserId = row[6]; // Colonna G - Username
      const userRole = row[5];      // Colonna F - Ruolo  
      const isActive = row[9];      // Colonna J - Attivo
      const userName = row[1];      // Colonna B - Nome
      
      Logger.debug('Controllo riga ' + i + ':', {
        currentUserId: currentUserId,
        userRole: userRole,
        isActive: isActive,
        userName: userName
      });
      
      if (currentUserId === userId) {
        Logger.debug('Utente trovato:', userName);
        
        if (isActive !== 'Si') {
          Logger.warn('Utente non attivo, valore colonna J:', isActive);
          return { success: false, message: 'Utente non attivo' };
        }
        
        // 5. Controlla se è admin
        const isAdmin = (userRole === 'Admin' || userRole === 'admin' || userRole === 'Administrator');
        
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

// ========================================
// FUNZIONI TEST AUTHENTICATION
// ========================================

/**
 * Test autenticazione robusta
 */
function testRobustAuthentication() {
  Logger.debug('=== TEST AUTENTICAZIONE ROBUSTA ===');

  try {
    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);

    Logger.debug('Headers trovati:', headers);
    Logger.debug('Mappatura colonne:', columnMap);

    // Test autenticazione con utente di esempio
    const authResult = authenticateUser('test', 'test123');
    Logger.debug('Risultato autenticazione:', authResult);

    if (authResult.success) {
      Logger.info('Autenticazione funzionante!');
      Logger.debug('Metodo auth:', authResult.systemInfo.authMethod);
      Logger.debug('Dati utente:', authResult.data.name);
    } else {
      Logger.warn('Autenticazione fallita:', authResult.message);
    }

  } catch (error) {
    Logger.error('Errore test:', error);
  }
}

/**
 * Diagnostica struttura foglio
 */
function diagnoseSheetStructure() {
  try {
    Logger.debug('=== DIAGNOSTICA STRUTTURA FOGLIO ===');

    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);

    Logger.debug('Headers del foglio:');
    headers.forEach((header, index) => {
      Logger.debug(`  ${String.fromCharCode(65 + index)} (${index}): "${header}"`);
    });

    Logger.debug('Mappatura riconosciuta:');
    Object.keys(columnMap).forEach(key => {
      const index = columnMap[key];
      const letter = String.fromCharCode(65 + index);
      Logger.debug(`  ${key} -> Colonna ${letter} (${index}): "${headers[index]}"`);
    });

    const required = ['Username', 'Nome Completo', 'Password', 'Attivo'];
    const missing = required.filter(col => columnMap[col] === undefined);

    if (missing.length === 0) {
      Logger.info('Tutte le colonne essenziali sono presenti');
    } else {
      Logger.warn('Colonne mancanti:', missing.join(', '));
    }

  } catch (error) {
    Logger.error('Errore diagnostica:', error);
  }
}
