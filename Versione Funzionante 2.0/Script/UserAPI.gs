/**
 * UserAPI.gs - API per Utenti Standard
 *
 * Espone le operazioni che ogni dipendente autenticato può eseguire:
 * - Salvataggio di una registrazione ore (saveWorkEntry)
 * - Lettura del calendario mensile (getMonthlyWorkData)
 *
 * Tutte le funzioni validano il session token prima di agire.
 *
 * USATO DA: ApiRouter.gs (endpoint 'saveWorkEntry', 'getMonthlyWorkData')
 */

// ─────────────────────────────────────────────────────────────────────────────
// SALVATAGGIO ORE LAVORO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salva una registrazione ore nel foglio personale del dipendente.
 *
 * È la funzione più critica del sistema: scrive una nuova riga nel foglio
 * del dipendente (sempre dalla riga 5 in poi, per proteggere l'header a 4 righe)
 * e aggiorna le ore totali del cantiere nel foglio Cantieri.
 *
 * Supporta nomi di campo flessibili da parte del client:
 *   - ore: 'ore' | 'hours' | 'oreLavorate'
 *   - data: 'data' | 'workDate' | 'date'
 *   - cantiere: 'cantiereId' | 'cantiere'
 *   - lavori: 'lavori' | 'lavoriEseguiti' | 'descrizione'
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken con validateSessionToken()
 *   2. Estrae e valida il valore ore (supporto virgola italiana, range 0-24)
 *   3. Estrae e valida i campi obbligatori (data, cantiereId, lavori)
 *   4. Parsea la data con parseDateFlexible()
 *   5. Ricava userName dal userId estratto dal token
 *   6. Legge il nome del cantiere dal foglio Cantieri
 *   7. Trova la prima riga vuota >= 5 nel foglio dipendente (scan in-memory)
 *   8. Protezione sicurezza: blocca scrittura se riga < 5
 *   9. Scrive la riga con setValues() (batch unico: 5 colonne)
 *  10. Chiama updateCantiereHours() (non bloccante)
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='saveWorkEntry')
 *              ApiRouter.gs → doPost() (action='saveWorkEntry')
 * CHIAMA:      validateSessionToken(), validateHours(), parseDateFlexible(),
 *              getWorksheet(), getSheetSafely(), getColumnValues(), indexOfValue(),
 *              updateCantiereHours(), Logger.save/warn, handleError()
 *
 * @param {string} sessionToken - Token sessione "{username}_{ts}_{random}".
 * @param {{
 *   data?: string,        workDate?: string,    date?: string,
 *   ore?: number,         hours?: number,       oreLavorate?: number,
 *   cantiereId?: string,  cantiere?: string,
 *   lavori?: string,      lavoriEseguiti?: string, descrizione?: string,
 *   note?: string,        notes?: string
 * }} workData - Dati della registrazione da salvare.
 * @returns {{
 *   success: boolean,
 *   message: string,
 *   data?: {
 *     riga: number, utente: string, data: string,
 *     cantiere: string, nomeCantiere: string, ore: number,
 *     cantiereUpdate: object, safeRowProtection: boolean,
 *     containerBound: boolean, timestamp: string, version: string
 *   }
 * }} Risultato salvataggio.
 *
 * @example
 * saveWorkEntry('mario_1709_abc', {
 *   data: '15/09/2025', cantiereId: 'C001',
 *   lavori: 'Posa piastrelle', ore: 8
 * });
 * // → { success: true, data: { riga: 42, utente: 'Mario Rossi', ore: 8, ... } }
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

    // Campi richiesti — supporto nomi alternativi
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

    // Ricava nome cantiere (se disponibile) — non bloccante
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

    // PROTEZIONE SICUREZZA: impedisce scrittura nelle righe header
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

// ─────────────────────────────────────────────────────────────────────────────
// CALENDARIO MENSILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce i dati giornalieri di un dipendente per un mese specifico.
 *
 * Legge tutte le righe dati del foglio personale (dalla riga 5) e filtra
 * per anno e mese. Aggrega le ore per giorno in un dizionario {day: {totalHours, entries}}.
 *
 * FLUSSO INTERNO:
 *   1. Estrae userId dal token, trova userName nel foglio Utenti
 *   2. Apre il foglio personale con getSheetSafely()
 *   3. Legge righe 5+ (5 colonne: data, cantiereId, cantiereName, ore, note)
 *   4. Filtra per getFullYear() === year e getMonth()+1 === month
 *   5. Aggrega per giorno del mese: { totalHours, entries[] }
 *   6. Restituisce { year, month, userName, workDays, totalDaysWorked }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getMonthlyWorkData')
 *              ApiRouter.gs → doPost() (action='getMonthlyWorkData')
 *              ApiRouter.gs → testGetMonthlyWorkData()
 * CHIAMA:      validateSessionToken(), getWorksheet(), getSheetSafely(),
 *              parseDateFlexible(), handleError()
 *
 * @param {string} sessionToken - Token sessione.
 * @param {number} year         - Anno (es. 2025).
 * @param {number} month        - Mese 1-12.
 * @returns {{
 *   success: boolean,
 *   data?: {
 *     year: number, month: number, userName: string,
 *     workDays: Object.<number, { totalHours: number, entries: Array<{ cantiere, ore, note, data }> }>,
 *     totalDaysWorked: number
 *   },
 *   message?: string
 * }} Dati calendario mensile.
 *
 * @example
 * const res = getMonthlyWorkData('mario_1709_abc', 2025, 9);
 * // res → { success: true, data: { workDays: { 15: { totalHours: 8, entries: [...] } }, totalDaysWorked: 20 } }
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

// ─────────────────────────────────────────────────────────────────────────────
// FUNZIONI TEST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test manuale di UserAPI — da eseguire dall'editor GAS.
 *
 * Genera un token di test e chiama getMonthlyWorkData() per settembre 2025.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      generateSessionToken(), getMonthlyWorkData()
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
