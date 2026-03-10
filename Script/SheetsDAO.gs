/**
 * SheetsDAO.gs - Data Access Object per Google Sheets
 *
 * Centralizza tutte le operazioni di lettura/scrittura sui fogli principali:
 * - Aggiornamento ore cantieri (updateCantiereHours)
 * - Lettura cantieri (getCantieri, getAllCantieriForAdmin)
 * - Lettura ore utente (getUserInfo, getOtherUserInfo)
 * - Helper per lookup utenti
 *
 * USATO DA: UserAPI.gs, AdminAPI.gs, ApiRouter.gs
 */

// ─────────────────────────────────────────────────────────────────────────────
// AGGIORNAMENTO CANTIERI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna le ore totali di un cantiere nel foglio "Cantieri".
 *
 * Dopo ogni salvataggio/modifica/eliminazione di ore, questa funzione
 * incrementa (o decrementa, se oreAggiunte è negativo) il contatore ORE_TOTALI
 * del cantiere e aggiorna i campi ULTIMO_UPDATE, ULTIMO_DIPENDENTE e
 * NUM_INSERIMENTI. Legge le colonne in blocco per efficienza.
 *
 * FLUSSO INTERNO:
 *   1. Recupera il foglio Cantieri con getSheetSafely()
 *   2. Legge tutte le righe in un'unica getRange().getValues()
 *   3. Cerca il cantiere per ID (confronto stringa)
 *   4. Aggiorna i 4 campi in memoria nell'array già letto, poi riscrive l'intera
 *      riga con un unico setValues() (batch) — riduce le chiamate API da 4 a 1.
 *      Applica il number format di ULTIMO_UPDATE con una singola chiamata separata.
 *   5. Restituisce oggetto con ore prima e dopo l'aggiornamento
 *
 * CHIAMATA DA: UserAPI.gs → saveWorkEntry()
 *              AdminAPI.gs → updateWorkEntry() (insert e update)
 *              AdminAPI.gs → deleteWorkEntry() (con oreAggiunte negativo)
 * CHIAMA:      getSheetSafely(), Logger.save/error, handleError()
 *
 * @param {string|number} cantiereId  - ID del cantiere da aggiornare.
 * @param {number}        oreAggiunte - Ore da aggiungere (negativo per sottrarre).
 * @param {string|null}   [dipendente] - Nome dipendente da registrare in ULTIMO_DIPENDENTE.
 * @returns {{
 *   success: boolean,
 *   cantiereId?: string,
 *   oreAttuali?: number,
 *   oreAggiunte?: number,
 *   nuovoTotale?: number,
 *   dataAggiornamento?: Date,
 *   ultimoDipendente?: string,
 *   numeroInserimenti?: number,
 *   message?: string
 * }} Risultato aggiornamento.
 *
 * @example
 * updateCantiereHours('C001', 8, 'Mario Rossi');
 * // → { success: true, oreAttuali: 40, oreAggiunte: 8, nuovoTotale: 48, ... }
 * updateCantiereHours('C001', -8, 'Mario Rossi'); // elimina
 * // → { success: true, nuovoTotale: 40, ... }
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

        // Aggiorna i campi nell'array in memoria, poi riscrivi l'intera riga
        // con un unico setValues() — 1 chiamata API invece di 4.
        row[COLUMNS_CANTIERI.ORE_TOTALI]        = nuovoTotale;
        row[COLUMNS_CANTIERI.ULTIMO_UPDATE]     = dataAggiornamento;
        row[COLUMNS_CANTIERI.ULTIMO_DIPENDENTE] = dipendente !== null ? dipendente : row[COLUMNS_CANTIERI.ULTIMO_DIPENDENTE];
        row[COLUMNS_CANTIERI.NUM_INSERIMENTI]   = nuovoContatore;

        cantieriSheet.getRange(rowIndex1, 1, 1, row.length).setValues([row]);

        // Applica il number format alla sola cella ULTIMO_UPDATE (richiede chiamata separata)
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.ULTIMO_UPDATE + 1)
          .setNumberFormat('dd/mm/yyyy hh:mm');

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

// ─────────────────────────────────────────────────────────────────────────────
// LETTURA CANTIERI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce l'elenco dei cantieri con stato "Aperto" per la dashboard dipendente.
 *
 * Filtra il foglio Cantieri restituendo solo i cantieri con stato 'Aperto',
 * 'aperto' o 'APERTO'. Questa lista viene usata dal frontend per popolare il
 * dropdown di selezione cantiere nel form di inserimento ore.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Legge foglio Cantieri con getSheetSafely()
 *   3. Filtra per colonna STATO == 'Aperto' (case-insensitive)
 *   4. Restituisce array di {id, nome, indirizzo, stato}
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getCantieri')
 *              ApiRouter.gs → doPost() (action='getCantieri')
 * CHIAMA:      validateSessionToken(), getSheetSafely(), handleError()
 *
 * @param {string} sessionToken - Token di sessione.
 * @returns {{
 *   success: boolean,
 *   data?: Array<{ id: *, nome: string, indirizzo: string, stato: string }>,
 *   message?: string
 * }} Lista cantieri aperti.
 *
 * @example
 * const res = getCantieri('mario_1709123456_abc');
 * // res → { success: true, data: [{id:'C001', nome:'Edificio A', ...}], message: '2 cantieri attivi trovati' }
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
 * Restituisce tutti i cantieri (aperti e chiusi) per la dashboard admin.
 *
 * Non filtra per stato, permettendo agli admin di selezionare qualsiasi cantiere
 * durante la modifica delle ore di un dipendente. Legge solo le prime 4 colonne
 * (ID, Nome, Indirizzo, Stato).
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Accede al foglio Cantieri con ss.getSheetByName()
 *   3. Legge colonne A-D per tutte le righe dati
 *   4. Include tutti i cantieri con ID non vuoto
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getAllCantieriForAdmin')
 *              ApiRouter.gs → doPost() (action='getAllCantieriForAdmin')
 * CHIAMA:      validateSessionToken(), Logger.error
 *
 * @param {string} sessionToken - Token di sessione.
 * @returns {{
 *   success: boolean,
 *   data?: Array<{ id: *, nome: string, indirizzo: string, stato: string }>,
 *   message?: string
 * }} Lista completa cantieri.
 *
 * @example
 * const res = getAllCantieriForAdmin('admin_1709123456_abc');
 * // res → { success: true, data: [...], message: '5 cantieri totali (inclusi chiusi)' }
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

// ─────────────────────────────────────────────────────────────────────────────
// LETTURA UTENTI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce le ore riepilogative dell'utente corrente (identificato dal token).
 *
 * Usa mapping dinamico delle colonne tramite buildColumnMap() per trovare
 * l'utente, evitando dipendenza da indici fissi. Il confronto username usa
 * .toString().trim() per robustezza. Le ore vengono lette tramite
 * getUserHoursFromSheet() (Authentication.gs).
 *
 * FLUSSO INTERNO:
 *   1. Estrae userId dal token (prima parte prima di '_')
 *   2. Legge foglio Utenti con getWorksheet()
 *   3. Costruisce columnMap dagli header
 *   4. Scansiona le righe cercando username corrispondente
 *   5. Chiama getUserHoursFromSheet(userName) per le ore
 *   6. Restituisce { oreMese, oreMesePrecedente, oreAnno }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getUserInfo')
 *              ApiRouter.gs → doPost() (action='getUserInfo')
 * CHIAMA:      validateSessionToken(), getWorksheet(), buildColumnMap(),
 *              getUserHoursFromSheet(), handleError()
 *
 * @param {string} sessionToken - Token sessione nel formato "{username}_{ts}_{random}".
 * @returns {{
 *   success: boolean,
 *   data?: { oreMese: number, oreMesePrecedente: number, oreAnno: number },
 *   message?: string
 * }} Ore riepilogative utente.
 *
 * @example
 * const res = getUserInfo('mario_1709123456_abc');
 * // res → { success: true, data: { oreMese: 40, oreMesePrecedente: 38, oreAnno: 312 } }
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
 * Restituisce le ore riepilogative di un altro utente (solo per admin).
 *
 * Verifica che il richiedente sia admin prima di restituire i dati del target.
 * La verifica admin usa indici fissi di colonna (COLUMNS.USER_ID, COLUMNS.NOME)
 * con ricerca della colonna Ruolo per nome negli header.
 *
 * FLUSSO INTERNO:
 *   1. Estrae requestingUserId dal token
 *   2. Legge foglio Utenti con getWorksheet()
 *   3. Trova l'indice della colonna 'Ruolo' dagli header
 *   4. Scansiona le righe per verificare che requestingUserId sia admin
 *   5. Scansiona le righe per trovare il nome del targetUserId
 *   6. Chiama getUserHoursFromSheet(targetUserName)
 *   7. Restituisce { userId, userName, oreMese, oreMesePrecedente, oreAnno }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getOtherUserInfo')
 *              ApiRouter.gs → doPost() (action='getOtherUserInfo')
 * CHIAMA:      validateSessionToken(), getWorksheet(), getUserHoursFromSheet(),
 *              Logger.debug/warn/error
 *
 * @param {string} sessionToken  - Token sessione dell'utente richiedente (deve essere admin).
 * @param {string} targetUserId  - Username dell'utente target.
 * @returns {{
 *   success: boolean,
 *   data?: { userId: string, userName: string, oreMese: number, oreMesePrecedente: number, oreAnno: number },
 *   message?: string
 * }} Ore riepilogative dell'utente target.
 *
 * @example
 * const res = getOtherUserInfo('admin_1709_abc', 'mario.rossi');
 * // res → { success: true, data: { userName: 'Mario Rossi', oreMese: 40, ... } }
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce il nome completo di un utente dato il suo userId.
 *
 * Scansiona il foglio Utenti usando l'indice fisso COLUMNS.USER_ID (colonna G).
 * Restituisce null se non trovato.
 *
 * CHIAMATA DA: non risulta chiamata da altri file  // ⚠️ DEAD CODE: non risulta chiamata da altri file
 *              (le funzioni che necessitano del nome lo ricercano direttamente in-line)
 * CHIAMA:      getWorksheet()
 *
 * @param {string} userId - Username da cercare.
 * @returns {string|null} Nome completo o null se non trovato.
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
 * Verifica se esiste un foglio con il nome del dipendente nello spreadsheet attivo.
 *
 * Utility usata potenzialmente per controlli di integrità prima di operazioni
 * che richiedono il foglio personale del dipendente.
 *
 * CHIAMATA DA: non risulta chiamata da altri file  // ⚠️ DEAD CODE: non risulta chiamata da altri file
 * CHIAMA:      SpreadsheetApp.getActiveSpreadsheet().getSheetByName()
 *
 * @param {string} userName - Nome completo del dipendente (= nome del foglio).
 * @returns {boolean} true se il foglio esiste.
 */
function checkIfUserHasSheet(userName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(userName) !== null;
  } catch (e) {
    return false;
  }
}

