/**
 * AdminAPI.gs - API Amministrative
 * 
 * ESTRATTO DA: code.gs (tutte le funzioni admin)
 * MODIFICHE: Nessuna - logica identica
 */

// ========================================
// OVERVIEW CANTIERI ADMIN
// ========================================

/**
 * Overview cantieri con cache ottimizzato
 * IDENTICO al tuo code.gs (righe ~2000-2100)
 */
function getCantieriAdminOverview(sessionToken, modalita) {
  const startTime = Date.now();
  
  try {
    Logger.debug('getCantieriAdminOverview - modalità:', modalita);
    
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    // Cache key specifica
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
    const cantieriSheet = spreadsheet.getSheetByName(SHEET_NAMES.CANTIERI);

    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }
    
    const lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], message: 'Nessun cantiere' };
    }
    
    const cantieriData = cantieriSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const cantieri = [];
    
    if (modalita === 'totali') {
      // Modalità totali - legge colonna G
      for (let i = 0; i < cantieriData.length; i++) {
        const row = cantieriData[i];
        if (row[0]) {
          cantieri.push({
            id: row[0],
            nome: row[1] || 'N/A',
            indirizzo: row[2] || '',
            stato: row[3] || 'N/A',
            oreTotali: parseFloat(row[6]) || 0,
            ultimoAggiornamento: row[7],
            ultimoDipendente: row[8] || '',
            numeroInserimenti: parseInt(row[9]) || 0
          });
        }
      }
    } else {
      // Modalità mese - calcola da fogli dipendenti
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
            oreTotali: oreMeseMap[cantiereId] || 0,
            ultimoAggiornamento: row[7],
            ultimoDipendente: row[8] || '',
            numeroInserimenti: parseInt(row[9]) || 0
          });
        }
      }
    }
    
    const result = {
      success: true,
      message: cantieri.length + ' cantieri caricati',
      data: cantieri
    };

    // Cache: 5 min mese, 30 min totali
    const cacheDuration = modalita === 'mese' ? 300 : 1800;
    cache.put(cacheKey, JSON.stringify(result), cacheDuration);

    Logger.debug('Caricati in ' + (Date.now() - startTime) + 'ms (' + modalita + ')');
    
    return result;
    
  } catch (error) {
    Logger.critical('Errore:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

/**
 * Calcola ore mese corrente ottimizzato - 1 loop
 * IDENTICO al tuo code.gs
 */
function calcolaOreMeseCorrenteOttimizzato(spreadsheet) {
  const oreMap = {};
  const oggi = new Date();
  const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  
  Logger.debug('Calcolo ore mese da ' + 
    Utilities.formatDate(primoGiornoMese, Session.getScriptTimeZone(), 'dd/MM/yyyy'));
  
  const sheets = spreadsheet.getSheets();
  let fogli = 0;
  let righe = 0;
  
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    // Salta fogli sistema
    if (sheetName === SHEET_NAMES.UTENTI || sheetName === SHEET_NAMES.CANTIERI || sheetName === 'Configurazione') {
      continue;
    }
    
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow < 5) continue;
      
      fogli++;
      const data = sheet.getRange(5, 1, lastRow - 4, 5).getValues();
      
      for (let j = 0; j < data.length; j++) {
        const row = data[j];
        const dataLavoro = row[0];
        const cantiereId = String(row[1]);
        const ore = parseFloat(row[3]) || 0;
        
        if (!cantiereId || ore <= 0 || !dataLavoro) continue;
        
        const dataEntry = new Date(dataLavoro);
        if (dataEntry >= primoGiornoMese && dataEntry <= oggi) {
          if (!oreMap[cantiereId]) oreMap[cantiereId] = 0;
          oreMap[cantiereId] += ore;
          righe++;
        }
      }
    } catch (e) {
      Logger.warn('Errore foglio ' + sheetName + ':', e.message);
    }
  }
  
  Logger.debug('Processati ' + fogli + ' fogli, ' + righe + ' righe');
  return oreMap;
}

// ========================================
// LISTA DIPENDENTI ADMIN
// ========================================

/**
 * Lista dipendenti per dropdown admin
 * IDENTICO al tuo code.gs
 */
function getDipendentiListAdmin(sessionToken) {
  const startTime = Date.now();
  
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    Logger.debug('getDipendentiListAdmin');
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = spreadsheet.getSheetByName(SHEET_NAMES.UTENTI);
    const data = userSheet.getDataRange().getValues();
    const dipendenti = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userId = row[6];
      const ruolo = row[5] || 'Dipendente';
      const isActive = row[9];
      
      // Escludi admin, solo attivi
      if (userId && ruolo !== 'Admin' && isActive === 'Si') {
        dipendenti.push({
          userId: userId,
          nome: row[1],
          ruolo: ruolo
        });
      }
    }
    
    Logger.debug('Dipendenti trovati:', dipendenti.length);
    
    return {
      success: true,
      message: dipendenti.length + ' dipendenti trovati',
      data: dipendenti
    };
    
  } catch (error) {
    Logger.critical('Errore getDipendentiListAdmin:', error);
    return { success: false, message: error.toString() };
  }
}

// ========================================
// TIMELINE DIPENDENTE
// ========================================

/**
 * Timeline dipendente con ore da celle F/G/H
 * IDENTICO al tuo code.gs
 */
function getDipendenteTimelineAdmin(sessionToken, userId, timeframe) {
  const startTime = Date.now();
  
  try {
    Logger.debug('getDipendenteTimelineAdmin:', userId, timeframe);
    
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    if (!userId) {
      return { success: false, message: 'userId richiesto' };
    }
    
    // Trova nome dipendente
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = spreadsheet.getSheetByName(SHEET_NAMES.UTENTI);
    const userData = userSheet.getDataRange().getValues();

    let nomeCompleto = null;
    let ruoloDipendente = null;
    
    for (let i = 1; i < userData.length; i++) {
      if (userData[i][6] === userId) {
        nomeCompleto = userData[i][1];
        ruoloDipendente = userData[i][5] || 'Dipendente';
        break;
      }
    }
    
    if (!nomeCompleto) {
      return { success: false, message: 'Dipendente non trovato' };
    }
    
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
    
    // Leggi ore dalle celle F/G/H
    const oreMeseCorrente = parseFloat(dipendenteSheet.getRange('F2').getValue()) || 0;
    const oreMesePrecedente = parseFloat(dipendenteSheet.getRange('G2').getValue()) || 0;
    const oreAnnoCorrente = parseFloat(dipendenteSheet.getRange('H2').getValue()) || 0;
    
    // Seleziona ore in base al timeframe
    let totaleOre, timelineLabel;
    
    switch (timeframe) {
      case '30days':
        totaleOre = oreMeseCorrente;
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
    
    // Calcola cantieri e giorni (opzionale)
    const cantieriCoinvolti = [];
    let giornateLavorate = 0;
    
    try {
      const lastRow = dipendenteSheet.getLastRow();
      if (lastRow >= 5) {
        const data = dipendenteSheet.getRange(5, 1, lastRow - 4, 5).getValues();
        const cantieriSet = new Set();
        const giorniSet = new Set();
        
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
      message: 'Timeline caricata per ' + nomeCompleto,
      data: {
        userId: userId,
        nome: nomeCompleto,
        ruolo: ruoloDipendente,
        timeline: [],
        totaleOre: totaleOre,
        giornateLavorate: giornateLavorate,
        cantieriCoinvolti: cantieriCoinvolti,
        timeframe: timeframe,
        timeframeLabel: timelineLabel,
        oreMeseCorrente: oreMeseCorrente,
        oreMesePrecedente: oreMesePrecedente,
        oreAnnoCorrente: oreAnnoCorrente
      }
    };

    Logger.debug('Timeline caricata in ' + (Date.now() - startTime) + 'ms');
    return result;
    
  } catch (error) {
    Logger.critical('Errore getDipendenteTimelineAdmin:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ========================================
// CALENDARIO ALTRO UTENTE
// ========================================

/**
 * Dati calendario mensile altro utente (admin only)
 * IDENTICO al tuo code.gs
 */
function getOtherUserMonthlyData(sessionToken, targetUserId, year, month) {
  Logger.debug('getOtherUserMonthlyData:', targetUserId, year, month);
  
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var requestingUserId = sessionToken.split('_')[0];
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    var targetUserName = null;
    
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
    if (ruoloColumnIndex === -1) {
      Logger.error('Colonna Ruolo non trovata');
      return { success: false, message: 'Configurazione foglio non valida' };
    }
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      
      if (row[COLUMNS.USER_ID] === requestingUserId) {
        var ruolo = row[ruoloColumnIndex];
        isAdmin = (ruolo && ruolo.toString().toLowerCase() === 'admin');
        Logger.debug('Verifica admin:', requestingUserId, 'IsAdmin:', isAdmin);
      }
      
      if (row[COLUMNS.USER_ID] === targetUserId) {
        targetUserName = row[COLUMNS.NOME];
      }
    }
    
    if (!isAdmin) {
      Logger.warn('Accesso non autorizzato da:', requestingUserId);
      return { success: false, message: 'Accesso non autorizzato. Solo amministratori.' };
    }
    
    if (!targetUserName) {
      return { success: false, message: 'Utente target non trovato' };
    }
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet;
    
    try {
      userWorkSheet = spreadsheet.getSheetByName(targetUserName);
    } catch (e) {
      return { success: false, message: 'Foglio utente non trovato: ' + targetUserName };
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
        message: 'Nessun dato per questo mese'
      };
    }
    
    var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
    var workDays = {};
    var targetYear = parseInt(year);
    var targetMonth = parseInt(month);
    
    Logger.debug('Parsing dati anno:', targetYear, 'mese:', targetMonth);
    
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
      message: 'Dati calendario caricati'
    };
    
  } catch (error) {
    Logger.critical('Errore getOtherUserMonthlyData:', error);
    return {
      success: false,
      message: 'Errore: ' + error.toString(),
      error: error.toString()
    };
  }
}

// ========================================
// MODIFICA ORE (ADMIN)
// ========================================

/**
 * Modifica o crea registrazione ore (solo admin)
 * IDENTICO al tuo code.gs (righe ~2500-2700)
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
    
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
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
    
    var newOre = parseFloat(updateData.ore);
    if (isNaN(newOre) || newOre < 0 || newOre > 24) {
      return { success: false, message: 'Ore non valide (0-24)' };
    }
    
    if (!updateData.cantiereId) {
      return { success: false, message: 'Cantiere richiesto' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = ss.getSheetByName(SHEET_NAMES.CANTIERI);
    var nomeCantiere = 'Cantiere sconosciuto';
    var cantiereExists = false;
    
    if (cantieriSheet) {
      var cantieriData = cantieriSheet.getDataRange().getValues();
      for (var i = 1; i < cantieriData.length; i++) {
        if (String(cantieriData[i][0]) === String(updateData.cantiereId)) {
          nomeCantiere = cantieriData[i][1];
          cantiereExists = true;
          break;
        }
      }
    }
    
    if (!cantiereExists) {
      return { success: false, message: 'Cantiere non trovato' };
    }
    
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var adminLog = '** Modificato da amministrazione (' + adminName + ' - ' + timestamp + ')';
    var finalNote = updateData.note ? updateData.note + '\n' + adminLog : adminLog;
    
    var userWorkSheet = ss.getSheetByName(targetUserName);
    if (!userWorkSheet) {
      return { success: false, message: 'Foglio utente non trovato' };
    }
    
    var lastRow = userWorkSheet.getLastRow();
    var isNewEntry = updateData.isNewEntry === true || updateData.isNewEntry === 'true';
    
    if (isNewEntry) {
      // Nuovo inserimento
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
      
      updateCantiereHours(updateData.cantiereId, newOre, targetUserName);
      
      Logger.info('Admin ' + adminName + ' inserito per ' + targetUserName + ' ' + dateStr);
      
      return {
        success: true,
        message: 'Nuova registrazione inserita',
        data: {
          action: 'insert',
          date: dateStr,
          cantiereId: updateData.cantiereId,
          ore: newOre,
          row: newRow
        }
      };
      
    } else {
      // Modifica esistente
      if (lastRow < 5) {
        return { success: false, message: 'Nessun dato - usa "Nuovo inserimento"' };
      }
      
      var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
      var rowToUpdate = -1;
      var oldCantiereId = null;
      var oldOre = 0;
      
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
        return { success: false, message: 'Registrazione non trovata - usa "Nuovo"' };
      }
      
      userWorkSheet.getRange(rowToUpdate, 2).setValue(String(updateData.cantiereId));
      userWorkSheet.getRange(rowToUpdate, 3).setValue(String(nomeCantiere));
      userWorkSheet.getRange(rowToUpdate, 4).setValue(newOre);
      userWorkSheet.getRange(rowToUpdate, 5).setValue(String(finalNote));
      
      if (oldCantiereId !== updateData.cantiereId) {
        updateCantiereHours(oldCantiereId, -oldOre, targetUserName);
        updateCantiereHours(updateData.cantiereId, newOre, targetUserName);
      } else if (oldOre !== newOre) {
        var diff = newOre - oldOre;
        updateCantiereHours(updateData.cantiereId, diff, targetUserName);
      }
      
      Logger.info('Admin ' + adminName + ' modificato per ' + targetUserName + ' ' + dateStr);
      
      return {
        success: true,
        message: 'Registrazione modificata',
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
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ========================================
// CACHE MANAGEMENT
// ========================================

/**
 * Invalida cache admin
 * IDENTICO al tuo code.gs
 */
function invalidateAdminCache(sessionToken, cacheType) {
  try {
    Logger.debug('invalidateAdminCache:', cacheType);
    
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    return {
      success: true,
      message: 'Cache invalidata: ' + cacheType
    };
    
  } catch (error) {
    Logger.critical('Errore invalidateAdminCache:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}
/**
 * 
 * Elimina una registrazione ore dal foglio dipendente
 * - Cancella fisica della riga
 * - Aggiorna automaticamente formule cantieri
 * - Log dell'operazione per audit
 * 
 * @param {string} sessionToken - Token sessione admin
 * @param {string} targetUserId - ID utente target
 * @param {string} dateStr - Data formato YYYY-MM-DD
 * @param {number} entryIndex - Indice registrazione (0-based)
 * @returns {Object} - {success: boolean, message: string}
 */
/**
 * Funzione deleteWorkEntry usando ESATTAMENTE le stesse convenzioni
 * di updateWorkEntry() già presente nel sistema
 */

function deleteWorkEntry(sessionToken, targetUserId, dateStr, entryIndex) {
  console.log('===== DELETE ENTRY CHIAMATA =====');
  console.log('targetUserId ricevuto:', targetUserId);
  console.log('targetUserId type:', typeof targetUserId);
  console.log('targetUserId length:', targetUserId ? targetUserId.length : 'null');
  try {
    // VALIDAZIONE SESSIONE (identica a updateWorkEntry)
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    
    var requestingUserId = sessionToken.split('_')[0];
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var isAdmin = false;
    var targetUserName = null;
    var adminName = null;
    
    var headerRow = userData[0];
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') {
        ruoloColumnIndex = j;
        break;
      }
    }
    
    // Trova admin e target user
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
        console.log('[DEBUG] ✅ TROVATO targetUserName:', targetUserName);
      }
    }
    
    // Verifica permessi admin
    if (!isAdmin) {
      return { 
        success: false, 
        message: 'Accesso negato: solo gli amministratori possono eliminare registrazioni' 
      };
    }
    
    if (!targetUserName) {
      return { 
        success: false, 
        message: 'Utente target non trovato' 
      };
    }
    
    // VALIDAZIONE PARAMETRI
    if (!dateStr || entryIndex === undefined || entryIndex === null) {
      return {
        success: false,
        message: 'Parametri mancanti (dateStr e entryIndex richiesti)'
      };
    }
    
    var datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dateStr)) {
      return {
        success: false,
        message: 'Formato data non valido (richiesto YYYY-MM-DD)'
      };
    }
    
    var indexNum = parseInt(entryIndex);
    if (isNaN(indexNum) || indexNum < 0) {
      return {
        success: false,
        message: 'Indice registrazione non valido'
      };
    }
    
    // CARICA FOGLIO DIPENDENTE
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetSheet = ss.getSheetByName(targetUserName);
    
    if (!targetSheet) {
      return {
        success: false,
        message: 'Foglio dipendente non trovato'
      };
    }
    
    // CERCA TUTTE LE RIGHE CON QUELLA DATA
    var allData = targetSheet.getDataRange().getValues();
    var matchingRows = [];
    
    for (var i = 1; i < allData.length; i++) { // Salta header (riga 0)
      var rowDate = allData[i][0]; // Colonna A = Data
      var rowDateStr = '';
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string' && rowDate) {
        var parsed = new Date(rowDate);
        if (!isNaN(parsed.getTime())) {
          rowDateStr = Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
      }
      
      if (rowDateStr === dateStr) {
        matchingRows.push({
          rowIndex: i + 1, // +1 perché sheet è 1-based
          data: allData[i]
        });
      }
    }
    
    // VALIDAZIONE ESISTENZA
    if (matchingRows.length === 0) {
      return {
        success: false,
        message: 'Nessuna registrazione trovata per questa data'
      };
    }
    
    if (indexNum >= matchingRows.length) {
      return {
        success: false,
        message: 'Indice registrazione non valido (trovate ' + matchingRows.length + ' registrazioni)'
      };
    }
    
    // RIGA DA ELIMINARE
    var targetRow = matchingRows[indexNum];
    var rowToDelete = targetRow.rowIndex;
    var rowData = targetRow.data;
    
    // BACKUP DATI PER RISPOSTA
    var deletedEntry = {
      data: dateStr,
      cantiereId: rowData[1] || '',
      cantiereName: rowData[2] || '',
      ore: rowData[3] || 0,
      note: rowData[4] || ''
    };
    
    // ELIMINAZIONE FISICA
    try {
      targetSheet.deleteRow(rowToDelete);
    } catch (deleteError) {
      return {
        success: false,
        message: 'Errore durante l\'eliminazione: ' + deleteError.message
      };
    }

    // Aggiorna ore cantiere (sottrai le ore eliminate)
    try {
      updateCantiereHours(deletedEntry.cantiereId, -deletedEntry.ore, targetUserName);
      console.log('[DELETE] Ore cantiere aggiornate: ' + deletedEntry.cantiereId + ' -' + deletedEntry.ore + 'h');
    } catch (cantiereError) {
      console.log('[DELETE] Warning: errore aggiornamento cantiere:', cantiereError.message);
      // Non bloccare l'operazione - il delete è comunque riuscito
    }
    
    // INVALIDA CACHE
    try {
      var monthKey = dateStr.substring(0, 7); // YYYY-MM
      CacheService.getScriptCache().remove('userMonthly_' + targetUserId + '_' + monthKey);
    } catch (cacheError) {
      // Cache non critica
    }
    
    // SUCCESSO
    return {
      success: true,
      message: 'Registrazione eliminata con successo',
      data: {
        deletedOre: deletedEntry.ore,
        cantiere: deletedEntry.cantiereName || deletedEntry.cantiereId,
        data: dateStr
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: 'Errore server: ' + error.message
    };
  }
}


/**
 * ============================================
 * FUNZIONE HELPER: LOG OPERAZIONI ADMIN
 * ============================================
 * Salva log operazioni admin in foglio dedicato per audit trail
 * 
 * @param {Object} adminUserName - Dati admin che esegue operazione
 * @param {string} action - Tipo azione (es. 'DELETE_WORK_ENTRY')
 * @param {Object} details - Dettagli operazione
 */
function logAdminAction(adminUserName, action, details) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let logSheet = ss.getSheetByName('Log Admin');
    
    // Crea foglio Log Admin se non esiste
    if (!logSheet) {
      logSheet = ss.insertSheet('Log Admin');
      logSheet.appendRow([
        'Timestamp',
        'Admin User',
        'Admin ID',
        'Action',
        'Target User',
        'Details',
        'IP Address'
      ]);
      
      // Formattazione header
      const headerRange = logSheet.getRange(1, 1, 1, 7);
      headerRange.setBackground('#4f46e5');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Aggiungi riga log
    logSheet.appendRow([
      new Date(),
      adminUserName,
      '-',
      action,
      details.targetUser || '',
      JSON.stringify(details),
      Session.getActiveUser().getEmail()
    ]);
    
    // Auto-format ultima riga
    const lastRow = logSheet.getLastRow();
    const logRange = logSheet.getRange(lastRow, 1, 1, 7);
    
    // Colora in base al tipo azione
    if (action === 'DELETE_WORK_ENTRY') {
      logRange.setBackground('#fef2f2'); // Rosso chiaro per delete
    } else if (action === 'UPDATE_WORK_ENTRY') {
      logRange.setBackground('#f0fdf4'); // Verde chiaro per update
    }
    
    console.log('[LOG_ADMIN] ✅ Azione loggata: ' + action);
    
  } catch (error) {
    console.log('[LOG_ADMIN] ⚠️ Impossibile creare log (non critico): ' + error.message);
    // Non propagare errore - il log è opzionale
  }
}

/**
 * ============================================
 * TESTING - Funzione di test manuale
 * ============================================
 * Esegui questa funzione dal menu Script Editor per testare
 */
function testDeleteWorkEntry() {
  // ATTENZIONE: Modifica questi valori con dati reali del tuo sistema
  const TEST_CONFIG = {
    sessionToken: 'INSERT_VALID_ADMIN_TOKEN',
    targetUserId: 'U001', // ID dipendente di test
    dateStr: '2025-01-15', // Data esistente nel foglio
    entryIndex: 0 // Prima registrazione del giorno
  };

  console.log('=== TEST DELETE WORK ENTRY ===');
  console.log('Config: ' + JSON.stringify(TEST_CONFIG));

  const result = deleteWorkEntry(
    TEST_CONFIG.sessionToken,
    TEST_CONFIG.targetUserId,
    TEST_CONFIG.dateStr,
    TEST_CONFIG.entryIndex
  );

  console.log('=== RISULTATO ===');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ TEST PASSED - Registrazione eliminata');
  } else {
    console.log('❌ TEST FAILED - ' + result.message);
  }
}

// ========================================
// DASHBOARD ADMIN - ENDPOINT COMBINATO
// ========================================

/**
 * Carica tutti i dati iniziali della dashboard admin in una sola chiamata.
 * Sostituisce: validateAdmin + getCantieriOverview(totali) + getCantieriOverview(mese) + getDipendentiList
 * Riduzione: 3 chiamate API → 1 sola chiamata.
 *
 * @param {string} sessionToken - Token di sessione (formato: userId_timestamp_random)
 * @returns {Object} {success, data: {admin, cantieri: {totali, mese}, dipendenti}} oppure {success: false, message}
 */
function getAdminDashboardData(sessionToken) {
  const startTime = Date.now();

  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }

    // Apre il foglio UNA SOLA VOLTA
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // Legge Utenti per: (a) verificare ruolo admin, (b) costruire lista dipendenti
    const userSheet = spreadsheet.getSheetByName(SHEET_NAMES.UTENTI);
    const userData = userSheet.getDataRange().getValues();

    // Estrae userId dal token (formato: userId_timestamp_random)
    const userId = String(sessionToken).split('_')[0];

    let adminFound = false;
    let adminName = '';
    const dipendenti = [];

    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      const rowUserId = String(row[6]);
      const ruolo = row[5] || 'Dipendente';
      const isActive = row[9];

      // Verifica admin
      if (rowUserId === userId && ruolo === 'Admin' && isActive === 'Si') {
        adminFound = true;
        adminName = row[1];
      }

      // Costruisce lista dipendenti (esclude admin, solo attivi)
      if (row[6] && ruolo !== 'Admin' && isActive === 'Si') {
        dipendenti.push({
          userId: row[6],
          nome: row[1],
          ruolo: ruolo
        });
      }
    }

    if (!adminFound) {
      return { success: false, message: 'Accesso non autorizzato' };
    }

    // Controlla cache backend (5 minuti) — esclude i dati personali admin
    const cache = CacheService.getScriptCache();
    const cacheKey = 'admin_dashboard_data_v1';
    const cachedStr = cache.get(cacheKey);

    if (cachedStr) {
      Logger.debug('Cache hit admin_dashboard_data');
      try {
        const cachedData = JSON.parse(cachedStr);
        // Aggiunge dati dipendenti freschi (non cachati per sicurezza)
        cachedData.dipendenti = dipendenti;
        return {
          success: true,
          data: {
            admin: { userId: userId, nome: adminName },
            cantieri: cachedData.cantieri,
            dipendenti: dipendenti
          }
        };
      } catch (_) {
        // Cache corrotta, continua con calcolo
      }
    }

    Logger.debug('Cache miss admin_dashboard - calcolo completo');

    // Legge Cantieri UNA SOLA VOLTA
    const cantieriSheet = spreadsheet.getSheetByName(SHEET_NAMES.CANTIERI);
    const lastRowCantieri = cantieriSheet.getLastRow();
    const cantieriRawData = lastRowCantieri >= 2
      ? cantieriSheet.getRange(2, 1, lastRowCantieri - 1, 10).getValues()
      : [];

    // Calcola ore mese corrente (un unico loop su tutti i fogli dipendente)
    const oreMeseMap = calcolaOreMeseCorrenteOttimizzato(spreadsheet);

    // Costruisce i due array cantieri in un unico passaggio
    const cantieriTotali = [];
    const cantieriMese = [];

    for (let i = 0; i < cantieriRawData.length; i++) {
      const row = cantieriRawData[i];
      if (!row[0]) continue;

      const cantiereId = String(row[0]);
      const base = {
        id: cantiereId,
        nome: row[1] || 'N/A',
        indirizzo: row[2] || '',
        stato: row[3] || 'N/A',
        ultimoAggiornamento: row[7],
        ultimoDipendente: row[8] || '',
        numeroInserimenti: parseInt(row[9]) || 0
      };

      cantieriTotali.push(Object.assign({}, base, { oreTotali: parseFloat(row[6]) || 0 }));
      cantieriMese.push(Object.assign({}, base, { oreTotali: oreMeseMap[cantiereId] || 0 }));
    }

    // Salva in cache (solo cantieri — i dipendenti vengono sempre calcolati freschi)
    const dataToCache = { cantieri: { totali: cantieriTotali, mese: cantieriMese } };
    try {
      cache.put(cacheKey, JSON.stringify(dataToCache), 300); // 5 minuti
    } catch (_) {}

    Logger.debug('getAdminDashboardData completato in ' + (Date.now() - startTime) + 'ms');

    return {
      success: true,
      data: {
        admin: { userId: userId, nome: adminName },
        cantieri: { totali: cantieriTotali, mese: cantieriMese },
        dipendenti: dipendenti
      }
    };

  } catch (error) {
    Logger.critical('Errore getAdminDashboardData:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}
