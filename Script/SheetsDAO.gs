/**
 * SheetsDAO.gs - Data Access Object per Google Sheets
 * 
 * ESTRATTO DA: code.gs (updateCantiereHours, helper functions)
 * MODIFICHE: Nessuna - solo organizzazione
 */

// ========================================
// AGGIORNAMENTO CANTIERI
// ========================================

/**
 * Aggiorna le ore di un cantiere
 * IDENTICO al tuo code.gs (righe 300-350 circa)
 */
function updateCantiereHours(cantiereId, oreAggiunte, dipendente) {
  if (!dipendente) dipendente = null;
  
  try {
    Logger.save('Aggiornando cantiere ' + cantiereId + ' con +' + oreAggiunte + ' ore');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = getSheetSafely(ss, SHEET_NAMES.CANTIERI);

    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }

    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Nessun cantiere trovato' };
    }

    // Leggi colonne necessarie in blocco
    var data = cantieriSheet.getRange(
      2, 
      1, 
      lastRow - 1, 
      Math.max(COLUMNS_CANTIERI.NUM_INSERIMENTI + 1, cantieriSheet.getLastColumn())
    ).getValues();

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

        // Aggiorna celle
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ORE_TOTALI + 1).setValue(nuovoTotale);
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ULTIMO_UPDATE + 1)
          .setValue(dataAggiornamento)
          .setNumberFormat('dd/mm/yyyy hh:mm');
        
        if (dipendente) { 
          cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ULTIMO_DIPENDENTE + 1)
            .setValue(dipendente); 
        }
        
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.NUM_INSERIMENTI + 1)
          .setValue(nuovoContatore);

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

// ========================================
// LETTURA CANTIERI
// ========================================

/**
 * Restituisce elenco cantieri aperti
 * IDENTICO al tuo code.gs
 */
function getCantieri(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = getSheetSafely(ss, SHEET_NAMES.CANTIERI);

    if (!cantieriSheet) {
      return { success: false, message: 'Foglio "Cantieri" non trovato' };
    }

    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], message: '0 cantieri attivi trovati' };
    }

    // Leggi solo colonne necessarie
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
    
    return { 
      success: true, 
      data: cantieri, 
      message: cantieri.length + ' cantieri attivi trovati' 
    };
    
  } catch (error) {
    return handleError('getCantieri', error);
  }
}

/**
 * Ottieni TUTTI i cantieri (anche chiusi) per admin
 * IDENTICO al tuo code.gs
 */
function getAllCantieriForAdmin(sessionToken) {
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = ss.getSheetByName(SHEET_NAMES.CANTIERI);
    
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

// ========================================
// LETTURA UTENTI
// ========================================

/**
 * Ritorna info ore utente corrente.
 * Usa mapping dinamico delle colonne (come Authentication.gs) per evitare
 * dipendenza da indici fissi e garantire confronto robusto con .toString().trim().
 *
 * @param {string} sessionToken - Token di sessione nel formato "username_timestamp_hash"
 * @returns {{success: boolean, data?: {oreMese, oreMesePrecedente, oreAnno}, message?: string}}
 */
function getUserInfo(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }

  try {
    var userId = String(sessionToken).split('_')[0];
    var userSheet = getWorksheet();
    var lastRow = userSheet.getLastRow();

    if (lastRow < 2) {
      return { success: false, message: 'Utente non trovato' };
    }

    // Mapping dinamico delle colonne (come Authentication.gs)
    var headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var columnMap = buildColumnMap(headers);

    if (columnMap['Username'] === undefined) {
      return { success: false, message: 'Colonna Username non trovata nel foglio' };
    }

    // Leggi tutti i dati e cerca l'utente con .toString().trim() (come Authentication.gs)
    var userData = userSheet.getRange(2, 1, lastRow - 1, userSheet.getLastColumn()).getValues();

    var userRow = null;
    var rowIndex1 = -1;

    for (var i = 0; i < userData.length; i++) {
      var rowUsername = userData[i][columnMap['Username']];
      if (rowUsername && rowUsername.toString().trim() === userId) {
        userRow = userData[i];
        rowIndex1 = i + 2;
        break;
      }
    }

    if (!userRow) {
      return { success: false, message: 'Utente non trovato' };
    }

    var userName = userRow[columnMap['Nome Completo']];
    var oreData = getUserHoursFromSheet(userName);

    return {
      success: true,
      data: {
        oreMese: oreData.oreMeseCorrente,
        oreMesePrecedente: oreData.oreMesePrecedente,
        oreAnno: oreData.oreAnnoCorrente
      }
    };

  } catch (error) {
    return handleError('getUserInfo', error);
  }
}

/**
 * Ottiene le ore totali di un altro utente (solo admin)
 * IDENTICO al tuo code.gs
 */
function getOtherUserInfo(sessionToken, targetUserId) {
  Logger.debug('getOtherUserInfo chiamata per targetUserId:', targetUserId);
  
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var requestingUserId = sessionToken.split('_')[0];
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    
    // Trova colonna Ruolo
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
    
    // Verifica admin
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
    
    // Cerca utente target
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

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Ottiene nome utente dal userId
 * IDENTICO al tuo code.gs
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
 * Verifica se esiste foglio per utente
 */
function checkIfUserHasSheet(userName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(userName) !== null;
  } catch (e) {
    return false;
  }
}

// ========================================
// FUNZIONI TEST
// ========================================

/**
 * Test SheetsDAO
 */
function testSheetsDAO() {
  console.log('=== TEST SHEETS DAO ===');
  
  try {
    // Test getCantieri
    const testToken = generateSessionToken('test');
    const cantieriResult = getCantieri(testToken);
    console.log('Cantieri trovati:', cantieriResult.data?.length || 0);
    
    // Test getUserInfo
    const userInfoResult = getUserInfo(testToken);
    console.log('Info utente:', userInfoResult);
    
    console.log('=== TEST COMPLETATO ===');
    
  } catch (error) {
    console.error('Errore test:', error);
  }
}
