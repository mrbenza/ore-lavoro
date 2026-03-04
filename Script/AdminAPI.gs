/**
 * AdminAPI.gs - API Amministrative
 *
 * Espone le operazioni riservate agli amministratori:
 * - Overview cantieri con ore totali o mensili (con cache)
 * - Lista dipendenti per dropdown admin
 * - Timeline ore dipendente per timeframe
 * - Dati calendario mensile di un altro utente
 * - Modifica/inserimento registrazioni ore (updateWorkEntry)
 * - Eliminazione registrazioni ore (deleteWorkEntry)
 * - Invalidazione cache (invalidateAdminCache)
 * - Log audit operazioni admin (logAdminAction)
 *
 * Tutte le funzioni validano il session token. Le operazioni su altri utenti
 * verificano anche che il richiedente abbia ruolo admin.
 *
 * USATO DA: ApiRouter.gs (endpoint admin)
 */

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW CANTIERI ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce la panoramica cantieri per la dashboard admin con cache.
 *
 * Supporta due modalità:
 *   - 'totali': legge direttamente la colonna ORE_TOTALI dal foglio Cantieri
 *     (dati cumulativi storici, cache 30 minuti)
 *   - 'mese' (default): calcola le ore del mese corrente scansionando tutti
 *     i fogli dipendente tramite calcolaOreMeseCorrenteOttimizzato()
 *     (cache 5 minuti, chiave dipende da anno+mese)
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Costruisce cache key in base alla modalità
 *   3. Se cache hit → restituisce JSON parsato
 *   4. Altrimenti legge foglio Cantieri e popola array cantieri
 *   5. In modalità 'mese' chiama calcolaOreMeseCorrenteOttimizzato()
 *   6. Mette in cache il risultato e lo restituisce
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getCantieriOverview')
 *              ApiRouter.gs → doPost() (action='getCantieriOverview')
 * CHIAMA:      validateSessionToken(), calcolaOreMeseCorrenteOttimizzato(),
 *              CacheService.getScriptCache(), Logger.debug/critical
 *
 * @param {string} sessionToken - Token sessione.
 * @param {string} [modalita]   - 'totali' o 'mese' (default 'mese').
 * @returns {{
 *   success: boolean,
 *   data?: Array<{ id, nome, indirizzo, stato, oreTotali, ultimoAggiornamento, ultimoDipendente, numeroInserimenti }>,
 *   message?: string
 * }} Lista cantieri con ore.
 *
 * @example
 * getCantieriAdminOverview('admin_1709_abc', 'totali');
 * // → { success: true, data: [{ id:'C001', nome:'Edificio A', oreTotali: 312, ... }] }
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
 * Calcola le ore del mese corrente per cantiere scansionando tutti i fogli dipendente.
 *
 * Ottimizzato per minimizzare le chiamate API Sheets: legge ogni foglio dipendente
 * una sola volta e aggrega le ore per cantiereId in una Map. Esclude i fogli di
 * sistema (Utenti, Cantieri, Configurazione). I fogli che causano errori vengono
 * saltati silenziosamente con un warning.
 *
 * FLUSSO INTERNO:
 *   1. Calcola primoGiornoMese (1° del mese corrente)
 *   2. Itera tutti i fogli dello spreadsheet
 *   3. Salta fogli di sistema per nome
 *   4. Per ogni foglio dipendente legge righe 5+ (5 colonne)
 *   5. Filtra le righe con data >= primoGiornoMese e <= oggi
 *   6. Accumula ore per cantiereId nella oreMap
 *
 * CHIAMATA DA: AdminAPI.gs → getCantieriAdminOverview() (modalità 'mese')
 * CHIAMA:      Logger.debug/warn, Utilities.formatDate(), Session.getScriptTimeZone()
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - Spreadsheet da scansionare.
 * @returns {Object.<string, number>} Mappa {cantiereId: oreTotali} per il mese corrente.
 *
 * @example
 * const mappa = calcolaOreMeseCorrenteOttimizzato(SpreadsheetApp.getActiveSpreadsheet());
 * // mappa → { 'C001': 45.5, 'C002': 12.0, ... }
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

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DIPENDENTI ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce la lista dei dipendenti attivi (non admin) per il dropdown admin.
 *
 * Legge il foglio Utenti e filtra escludendo gli utenti con ruolo 'Admin'
 * e quelli non attivi (colonna J != 'Si'). Il risultato viene usato dal
 * frontend admin per popolare il selettore del dipendente target nelle
 * operazioni di visualizzazione e modifica ore.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Legge foglio Utenti con getSheetByName()
 *   3. Itera righe saltando header
 *   4. Include solo utenti con userId, ruolo != 'Admin', Attivo == 'Si'
 *   5. Restituisce array di { userId, nome, ruolo }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getDipendentiList')
 *              ApiRouter.gs → doPost() (action='getDipendentiList')
 * CHIAMA:      validateSessionToken(), Logger.debug/critical
 *
 * @param {string} sessionToken - Token sessione (non richiede ruolo admin).
 * @returns {{
 *   success: boolean,
 *   data?: Array<{ userId: string, nome: string, ruolo: string }>,
 *   message?: string
 * }} Lista dipendenti attivi.
 *
 * @example
 * getDipendentiListAdmin('admin_1709_abc');
 * // → { success: true, data: [{ userId: 'mario.rossi', nome: 'Mario Rossi', ruolo: 'Dipendente' }] }
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

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE DIPENDENTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce il riepilogo ore di un dipendente per un timeframe specifico.
 *
 * Legge le ore dalle celle riepilogative F2/G2/H2 del foglio personale
 * (valori pre-calcolati da formule SUMIFS) e selezione in base al timeframe.
 * In aggiunta, calcola il numero di giornate lavorate e i cantieri coinvolti
 * scansionando le righe dati del foglio (dalla riga 5).
 *
 * Timeframe supportati:
 *   - '30days': mese corrente (cella F2)
 *   - 'lastMonth': mese precedente (cella G2)
 *   - 'year': anno corrente (cella H2)
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken e userId
 *   2. Trova il nome del dipendente dal foglio Utenti (colonna G → colonna B)
 *   3. Apre il foglio personale del dipendente
 *   4. Legge F2, G2, H2 per le ore aggregate
 *   5. Seleziona totaleOre in base al timeframe
 *   6. Scansiona righe 5+ per calcolare giornateLavorate e cantieriCoinvolti
 *   7. Restituisce struttura dati completa
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getDipendenteTimeline')
 *              ApiRouter.gs → doPost() (action='getDipendenteTimeline')
 * CHIAMA:      validateSessionToken(), Logger.debug/warn/critical
 *
 * @param {string} sessionToken - Token sessione.
 * @param {string} userId       - Username del dipendente target.
 * @param {string} timeframe    - '30days' | 'lastMonth' | 'year'.
 * @returns {{
 *   success: boolean,
 *   data?: {
 *     userId: string, nome: string, ruolo: string, timeline: Array,
 *     totaleOre: number, giornateLavorate: number, cantieriCoinvolti: string[],
 *     timeframe: string, timeframeLabel: string,
 *     oreMeseCorrente: number, oreMesePrecedente: number, oreAnnoCorrente: number
 *   },
 *   message?: string
 * }} Timeline dipendente.
 *
 * @example
 * getDipendenteTimelineAdmin('admin_1709_abc', 'mario.rossi', '30days');
 * // → { success: true, data: { totaleOre: 160, giornateLavorate: 20, ... } }
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

// ─────────────────────────────────────────────────────────────────────────────
// CALENDARIO ALTRO UTENTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce i dati del calendario mensile di un altro utente (solo admin).
 *
 * Verifica che il richiedente sia admin cercando il ruolo nel foglio Utenti,
 * poi legge il foglio personale del dipendente target e filtra le righe per
 * anno e mese. Restituisce un dizionario {dateStr: {totalOre, entries}} dove
 * dateStr è nel formato YYYY-MM-DD.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Estrae requestingUserId dal token
 *   3. Legge foglio Utenti, trova colonna Ruolo dagli header
 *   4. Verifica che requestingUserId abbia ruolo 'admin'
 *   5. Trova targetUserName dal foglio Utenti
 *   6. Apre il foglio personale del target
 *   7. Legge righe 5+ e filtra per year/month
 *   8. Restituisce workDays con entries per data
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getOtherUserMonthlyData')
 *              ApiRouter.gs → doPost() (action='getOtherUserMonthlyData')
 * CHIAMA:      validateSessionToken(), getWorksheet(), Logger.debug/warn/error/critical
 *
 * @param {string}        sessionToken  - Token sessione (deve essere admin).
 * @param {string}        targetUserId  - Username del dipendente target.
 * @param {string|number} year          - Anno (es. 2025).
 * @param {string|number} month         - Mese 1-12.
 * @returns {{
 *   success: boolean,
 *   data?: {
 *     year: number, month: number, userName: string, userId: string,
 *     workDays: Object.<string, { totalOre: number, entries: Array<{ rowIndex, cantiereId, cantiereName, ore, note }> }>
 *   },
 *   message?: string
 * }} Dati calendario mensile del dipendente target.
 *
 * @example
 * getOtherUserMonthlyData('admin_1709_abc', 'mario.rossi', 2025, 9);
 * // → { success: true, data: { workDays: { '2025-09-15': { totalOre: 8, entries: [...] } } } }
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

// ─────────────────────────────────────────────────────────────────────────────
// MODIFICA ORE (ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modifica una registrazione ore esistente o ne crea una nuova (solo admin).
 *
 * Supporta due modalità in base a updateData.isNewEntry:
 *   - isNewEntry === true: inserisce una nuova riga nel foglio del dipendente
 *   - isNewEntry === false (default): cerca la prima riga con la data specificata e la aggiorna
 *
 * Verifica la validità del cantiere nel foglio Cantieri. Aggiunge un log
 * "(Modificato da amministrazione)" nelle note della riga. Aggiorna le ore
 * del cantiere (incrementale se modifica, compensativo se cambia cantiere).
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Verifica che il richiedente sia admin (cerca ruolo nel foglio Utenti)
 *   3. Trova targetUserName dal foglio Utenti
 *   4. Valida ore (0-24) e cantiereId
 *   5. Verifica esistenza cantiere nel foglio Cantieri
 *   6. Se isNewEntry: appende riga >= 5, chiama updateCantiereHours(+newOre)
 *   7. Se modifica: cerca riga per dateStr, aggiorna celle, gestisce delta ore cantiere
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='updateWorkEntry')
 *              ApiRouter.gs → doPost() (action='updateWorkEntry')
 * CHIAMA:      validateSessionToken(), getWorksheet(), buildColumnMap(),
 *              updateCantiereHours(), Logger.info/error
 *
 * @param {string} sessionToken  - Token sessione admin.
 * @param {string} targetUserId  - Username del dipendente target.
 * @param {string} dateStr       - Data in formato YYYY-MM-DD.
 * @param {{
 *   ore: number,
 *   cantiereId: string,
 *   note?: string,
 *   isNewEntry?: boolean
 * }} updateData - Dati della modifica.
 * @returns {{
 *   success: boolean,
 *   message: string,
 *   data?: { action: 'insert'|'update', date: string, cantiereId: string, ore: number, row: number }
 * }} Risultato operazione.
 *
 * @example
 * updateWorkEntry('admin_1709_abc', 'mario.rossi', '2025-09-15',
 *   { ore: 8, cantiereId: 'C001', note: 'Correzione', isNewEntry: true });
 * // → { success: true, data: { action: 'insert', row: 42, ... } }
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

// ─────────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalida la cache admin per il tipo specificato.
 *
 * Attualmente restituisce sempre successo senza effettuare operazioni reali
 * sulla cache (stub). La gestione cache è integrata direttamente in
 * getCantieriAdminOverview() con chiavi specifiche per mese/totali.
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='invalidateCache')
 *              ApiRouter.gs → doPost() (action='invalidateCache')
 * CHIAMA:      validateSessionToken(), Logger.debug/critical
 *
 * @param {string} sessionToken - Token sessione.
 * @param {string} cacheType    - Tipo cache da invalidare (es. 'cantieri', 'dipendenti').
 * @returns {{ success: boolean, message: string }} Risultato invalidazione.
 */
function invalidateAdminCache(sessionToken, cacheType) {
  try {
    Logger.debug('invalidateAdminCache:', cacheType);

    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }

    const cache = CacheService.getScriptCache();
    const today = new Date();

    if (cacheType === 'cantieri' || !cacheType) {
      // Rimuove chiave totali + chiavi mese degli ultimi 24 mesi
      const keysToRemove = ['cantieri_totali'];
      for (var i = 0; i < 24; i++) {
        var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        keysToRemove.push('cantieri_mese_' + d.getFullYear() + '_' + d.getMonth());
      }
      cache.removeAll(keysToRemove);
      Logger.debug('Cache cantieri rimossa, chiavi:', keysToRemove.length);
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
// ─────────────────────────────────────────────────────────────────────────────
// DELETE REGISTRAZIONE — eliminazione fisica riga dipendente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina fisicamente una registrazione ore dal foglio dipendente.
 *
 * Permette all'admin di cancellare una singola entry per data e indice.
 * Dopo la cancellazione aggiorna le ore cumulative del cantiere interessato
 * (sottraendo le ore eliminate) e invalida la cache mensile per quell'utente.
 * L'operazione è atomica: se il delete fisico fallisce la funzione ritorna
 * errore senza toccare i cantieri. Se il cantiere update fallisce, il delete
 * rimane comunque valido (non critico).
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Determina isAdmin e risolve targetUserName dal foglio Utenti
 *   3. Valida parametri (dateStr YYYY-MM-DD, entryIndex >= 0)
 *   4. Apre foglio dipendente, raccoglie tutte le righe che matchano dateStr
 *   5. Verifica che entryIndex sia < matchingRows.length
 *   6. deleteRow() sulla riga target (1-based)
 *   7. Chiama updateCantiereHours() con ore negativo (non bloccante)
 *   8. Invalida chiave cache mensile CacheService (non bloccante)
 *   9. Ritorna { success, message, data: { deletedOre, cantiere, data } }
 *
 * CHIAMATA DA: ApiRouter.gs → doPost() (action='deleteWorkEntry')
 * CHIAMA:      validateSessionToken(), getWorksheet(), buildColumnMap(),
 *              updateCantiereHours(), CacheService.getScriptCache()
 *
 * @param {string} sessionToken  - Token sessione (deve appartenere a un admin).
 * @param {string} targetUserId  - Username del dipendente target (es. 'U001').
 * @param {string} dateStr       - Data in formato YYYY-MM-DD.
 * @param {number} entryIndex    - Indice 0-based della registrazione nel giorno.
 * @returns {{ success: boolean, message: string, data?: { deletedOre: number, cantiere: string, data: string } }}
 * @example
 * // Elimina la prima registrazione del 15 gen 2025 per U001
 * deleteWorkEntry('U001_1234567890_abc', 'U001', '2025-01-15', 0);
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


// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG — persistenza operazioni admin su foglio 'Log Admin'
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ DEAD CODE: non risulta chiamata da altri file
// (deleteWorkEntry non la chiama — il log audit non è attualmente attivo)
/**
 * Salva un'operazione amministrativa nel foglio 'Log Admin' per audit trail.
 *
 * Crea il foglio 'Log Admin' se non esiste (con header formattato) e poi
 * appende una riga con timestamp, dati admin, tipo azione e dettagli JSON.
 * La riga viene colorata in base al tipo azione (rosso per DELETE, verde per
 * UPDATE). Gli errori sono silently swallowed: il log è considerato opzionale
 * e non deve bloccare le operazioni principali.
 *
 * FLUSSO INTERNO:
 *   1. Apre il foglio 'Log Admin' (o lo crea con header se mancante)
 *   2. appendRow con timestamp, adminUserName, azione, dettagli JSON
 *   3. Colora la riga in base al tipo azione
 *   4. In caso di errore: console.log() e ritorno silenzioso
 *
 * CHIAMATA DA: (nessuno — funzione non chiamata attualmente)
 * CHIAMA:      SpreadsheetApp.openById(), Session.getActiveUser()
 *
 * @param {string} adminUserName - Nome completo dell'admin che esegue l'azione.
 * @param {string} action        - Tipo azione (es. 'DELETE_WORK_ENTRY', 'UPDATE_WORK_ENTRY').
 * @param {Object} details       - Oggetto con dettagli operazione (targetUser, ore, ecc.).
 * @returns {void}
 * @example
 * // Logga una cancellazione
 * logAdminAction('Mario Rossi', 'DELETE_WORK_ENTRY', { targetUser: 'U001', ore: 8 });
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

// ─────────────────────────────────────────────────────────────────────────────
// TEST — verifica manuale deleteWorkEntry da Script Editor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test manuale per deleteWorkEntry(), da eseguire dallo Script Editor.
 *
 * Configura i valori in TEST_CONFIG con dati reali (token admin valido,
 * userId esistente, data con registrazioni nel foglio) ed esegue la funzione.
 * Stampa il risultato nel log di esecuzione e segnala PASS/FAIL.
 * Non è un test automatico: richiede intervento umano per impostare i parametri.
 *
 * CHIAMATA DA: (esecuzione manuale da Script Editor)
 * CHIAMA:      deleteWorkEntry()
 *
 * @returns {void}
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
