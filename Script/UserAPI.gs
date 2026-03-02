/**
 * UserAPI.gs - API per Utenti Standard
 * 
 * ESTRATTO DA: code.gs (saveWorkEntry, getMonthlyWorkData)
 * MODIFICHE: Nessuna - logica identica
 */

// ========================================
// SALVATAGGIO ORE LAVORO
// ========================================

/**
 * Salva registrazione ore nel foglio utente (riga >=5)
 * IDENTICO al tuo code.gs (righe 350-550 circa)
 * Questa è la funzione più complessa - 200+ righe
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
      if (Object.prototype.hasOwnProperty.call(workData, prop) && workData[prop] != null) { 
        oreValue = workData[prop]; 
        break; 
      }
    }
    
    if (oreValue === null) {
      for (var key in workData) {
        if (!Object.prototype.hasOwnProperty.call(workData, key)) continue;
        var numValue = parseFloat(workData[key]);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 24) { 
          oreValue = numValue; 
          break; 
        }
      }
    }
    
    var oreLavorate = validateHours(oreValue);
    if (oreLavorate === null) {
      return { 
        success: false, 
        message: 'Valore ore non valido: "' + oreValue + '" (deve essere 0-24)' 
      };
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

    // Validazione data
    var dataLavoro = parseDateFlexible(campiRichiesti.data);
    if (!dataLavoro) {
      return { 
        success: false, 
        message: 'Formato data non valido. Usa "dd/mm/yyyy" o ISO (es. 2025-09-07)' 
      };
    }

    // Ricava nome utente dal token
    var userId = String(sessionToken).split('_')[0];
    var userSheet = getWorksheet();
    var lastRowUsers = userSheet.getLastRow();
    var userIds = lastRowUsers >= 2 ? 
      userSheet.getRange(2, COLUMNS.USER_ID + 1, lastRowUsers - 1, 1).getValues().map(r => r[0]) : 
      [];
    
    var idx0 = indexOfValue(userIds, userId);
    if (idx0 === -1) return { success: false, message: 'Utente non trovato' };
    
    var rowIndex1 = idx0 + 2;
    var row = userSheet.getRange(rowIndex1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var userName = row[COLUMNS.NOME];
    if (!userName) return { success: false, message: 'Nome utente non trovato' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet = getSheetSafely(ss, userName);
    if (!userWorkSheet) {
      return { 
        success: false, 
        message: 'Foglio "' + userName + '" non esistente. Crealo manualmente.' 
      };
    }

    // Ricava nome cantiere (se disponibile)
    var nomeCantiere = 'Lavoro registrato via dashboard';
    try {
      var cantieriSheet = getSheetSafely(ss, SHEET_NAMES.CANTIERI);
      if (cantieriSheet) {
        var lastRowCant = cantieriSheet.getLastRow();
        if (lastRowCant >= 2) {
          var cantieriRange = cantieriSheet.getRange(
            2, 
            1, 
            lastRowCant - 1, 
            Math.max(COLUMNS_CANTIERI.NOME + 1, cantieriSheet.getLastColumn())
          );
          var cantieriData = cantieriRange.getValues();
          for (var i = 0; i < cantieriData.length; i++) {
            var r = cantieriData[i];
            if (String(r[COLUMNS_CANTIERI.ID]) === String(campiRichiesti.cantiereId)) { 
              nomeCantiere = r[COLUMNS_CANTIERI.NOME] || nomeCantiere; 
              break; 
            }
          }
        }
      }
    } catch (e) { 
      Logger.warn('Impossibile ottenere nome cantiere:', e.message); 
    }

    // Ricerca riga vuota ottimizzata (in memoria) >= riga 5
    var lastRow = userWorkSheet.getLastRow();
    var startRow = 5;
    var numRowsToCheck = Math.max(lastRow - startRow + 1, 1);
    var valuesBlock = userWorkSheet.getRange(startRow, 1, numRowsToCheck, 5).getValues();
    var offset = -1;
    
    for (var v = 0; v < valuesBlock.length; v++) {
      var rowVals = valuesBlock[v];
      var empty = true;
      for (var c = 0; c < rowVals.length; c++) { 
        if (rowVals[c] !== '' && rowVals[c] !== null && rowVals[c] !== undefined) { 
          empty = false; 
          break; 
        } 
      }
      if (empty) { 
        offset = v; 
        break; 
      }
    }
    
    var newRow = offset !== -1 ? startRow + offset : Math.max(lastRow + 1, startRow);
    
    // PROTEZIONE SICUREZZA
    if (newRow < 5) {
      return { 
        success: false, 
        message: 'ERRORE SICUREZZA: Tentativo scrittura riga ' + newRow + ' (minimo riga 5)' 
      };
    }

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

    // Aggiorna cantiere (non bloccante)
    var cantiereUpdateResult = updateCantiereHours(
      campiRichiesti.cantiereId, 
      oreLavorate, 
      userName
    );
    
    if (!cantiereUpdateResult.success) { 
      Logger.warn('Aggiornamento cantiere fallito:', cantiereUpdateResult.message); 
    }

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

// ========================================
// CALENDARIO MENSILE
// ========================================

/**
 * Ritorna dati giornalieri per un mese specifico
 * IDENTICO al tuo code.gs (righe 550-650 circa)
 */
function getMonthlyWorkData(sessionToken, year, month) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var userId = String(sessionToken).split('_')[0];

    var userSheet = getWorksheet();
    var lastRowUsers = userSheet.getLastRow();
    if (lastRowUsers < 2) {
      return { success: false, message: 'Utente non trovato' };
    }

    var userIds = userSheet.getRange(2, COLUMNS.USER_ID + 1, lastRowUsers - 1, 1)
      .getValues()
      .map(r => r[0]);
    var idx0 = indexOfValue(userIds, userId);
    
    if (idx0 === -1) {
      return { success: false, message: 'Utente non trovato' };
    }

    var rowIndex1 = idx0 + 2;
    var row = userSheet.getRange(rowIndex1, 1, 1, userSheet.getLastColumn()).getValues()[0];
    var userName = row[COLUMNS.NOME];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet = getSheetSafely(ss, userName);
    
    if (!userWorkSheet) {
      return { success: false, message: 'Foglio utente non trovato: ' + userName };
    }

    var lastRow = userWorkSheet.getLastRow();
    if (lastRow < 5) {
      return { 
        success: true, 
        data: { 
          year: year, 
          month: month, 
          userName: userName, 
          workDays: {} 
        }, 
        message: 'Nessun dato trovato per questo mese' 
      };
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
        if (!monthlyData[day]) {
          monthlyData[day] = { totalHours: 0, entries: [] };
        }
        
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

    return { 
      success: true, 
      data: { 
        year: year, 
        month: month, 
        userName: userName, 
        workDays: monthlyData, 
        totalDaysWorked: Object.keys(monthlyData).length 
      }, 
      message: 'Dati calendario per ' + month + '/' + year + ' caricati con successo' 
    };
    
  } catch (error) {
    return handleError('getMonthlyWorkData', error);
  }
}

// ========================================
// FUNZIONI TEST
// ========================================

/**
 * Test UserAPI
 */
function testUserAPI() {
  console.log('=== TEST USER API ===');
  
  try {
    const testToken = generateSessionToken('test');
    
    // Test getMonthlyWorkData
    console.log('Test calendario mensile...');
    const calendarResult = getMonthlyWorkData(testToken, 2025, 9);
    console.log('Giorni lavorati:', calendarResult.data?.totalDaysWorked || 0);
    
    console.log('=== TEST COMPLETATO ===');
    
  } catch (error) {
    console.error('Errore test:', error);
  }
}
