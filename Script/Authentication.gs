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
    console.log('Tentativo autenticazione per:', userId);
    
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
        needsMigration: plainValid
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

// ========================================
// LETTURA ORE UTENTE
// ========================================

/**
 * Legge ore riepilogative dal foglio personale dell'utente
 * IDENTICO al tuo code.gs
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
    
    try { 
      oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0; 
    } catch (e) { 
      /* cella assente */ 
    }
    
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
    const userSheet = spreadsheet.getSheetByName('Utenti');
    
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
  console.log('=== TEST AUTENTICAZIONE ROBUSTA ===');
  
  try {
    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);
    
    console.log('Headers trovati:', headers);
    console.log('Mappatura colonne:', columnMap);
    
    // Test autenticazione con utente di esempio
    const authResult = authenticateUser('test', 'test123');
    console.log('Risultato autenticazione:', authResult);
    
    if (authResult.success) {
      console.log('✅ Autenticazione funzionante!');
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
 * Diagnostica struttura foglio
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
