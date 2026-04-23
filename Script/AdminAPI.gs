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
    
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
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
 * Restituisce la lista dei dipendenti (non admin) per il dropdown admin.
 *
 * Legge il foglio Utenti e filtra escludendo gli utenti con ruolo admin.
 * Per default restituisce solo i dipendenti attivi (Attivo == 'Si').
 * Con includeInactive=true restituisce tutti i dipendenti (attivi e non),
 * utile per la gestione utenti dove l'admin deve poter vedere e riattivare
 * anche gli account disattivati.
 *
 * Usa il mapping dinamico delle colonne tramite header row per essere robusto
 * a variazioni nell'ordine delle colonne del foglio Utenti.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Legge foglio Utenti con getSheetSafe()
 *   3. Costruisce colMap da riga header (mapping dinamico)
 *   4. Itera righe saltando header
 *   5. Esclude sempre gli admin (ADMIN_VALIDATION.isAdminRole)
 *   6. Se !mostraTutti, esclude anche i non attivi (Attivo != 'Si')
 *   7. Restituisce array di { userId, nome, ruolo, attivo }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet() (action='getDipendentiList')
 *              ApiRouter.gs → doPost() (action='getDipendentiList')
 * CHIAMA:      validateSessionToken(), getMainSpreadsheet(), getSheetSafe(),
 *              ADMIN_VALIDATION.isAdminRole(), Logger.debug/critical
 *
 * @param {string}          sessionToken    - Token sessione (non richiede ruolo admin).
 * @param {string|boolean}  includeInactive - Se 'true' o true, include dipendenti non attivi.
 * @returns {{
 *   success: boolean,
 *   data?: Array<{ userId: string, nome: string, ruolo: string, attivo: string }>,
 *   message?: string
 * }} Lista dipendenti.
 *
 * @example
 * getDipendentiListAdmin('admin_1709_abc');
 * // → { success: true, data: [{ userId: 'mario.rossi', nome: 'Mario Rossi', ruolo: 'Dipendente', attivo: 'Si' }] }
 *
 * getDipendentiListAdmin('admin_1709_abc', true);
 * // → { success: true, data: [{ userId: 'mario.rossi', ... }, { userId: 'luca.bianchi', ..., attivo: 'No' }] }
 */
function getDipendentiListAdmin(sessionToken, includeInactive) {
  const startTime = Date.now();

  try {
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    Logger.debug('getDipendentiListAdmin, includeInactive:', includeInactive);

    const spreadsheet = getMainSpreadsheet();
    const userSheet = getSheetSafe(spreadsheet, SHEET_NAMES.UTENTI);
    const data = userSheet.getDataRange().getValues();

    const headers = data[0];
    const colMap = {};
    headers.forEach(function(h, i) { if (h) colMap[h.toString().trim()] = i; });

    const colUsername = colMap['Username'];
    const colNome = colMap['Nome Completo'];
    const colRuolo = colMap['Ruolo'];
    const colAttivo = colMap['Attivo'];

    if (colUsername === undefined || colNome === undefined) {
      return { success: false, message: 'Struttura foglio Utenti non valida.' };
    }

    const dipendenti = [];
    const mostraTutti = (includeInactive === 'true' || includeInactive === true);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userId = (row[colUsername] || '').toString().trim();
      const nome = (row[colNome] || '').toString().trim();
      const ruolo = (row[colRuolo] || 'Dipendente').toString().trim();
      const attivo = (row[colAttivo] || '').toString().trim();

      if (!userId || !nome) continue;

      const isAdmin = ADMIN_VALIDATION.isAdminRole(ruolo);
      if (isAdmin) continue;
      if (!mostraTutti && attivo !== 'Si') continue;

      dipendenti.push({
        userId: userId,
        nome: nome,
        ruolo: ruolo,
        attivo: attivo
      });
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
    
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
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
  
  try {
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var targetUserName = null;

    var headerRow = userData[0] || [];
    var columnMap = buildColumnMap(headerRow);
    var usernameCol = columnMap['Username'];
    var nomeCol = columnMap['Nome Completo'];

    if (usernameCol === undefined || nomeCol === undefined) {
      Logger.error('Colonne Username/Nome Completo non trovate');
      return { success: false, message: 'Configurazione foglio non valida' };
    }
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];

      if (String(row[usernameCol]).trim() === String(targetUserId).trim()) {
        targetUserName = row[nomeCol];
        break;
      }
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

    if (!userWorkSheet) {
      return { success: false, message: 'Foglio non trovato per il dipendente: ' + targetUserName };
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
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var targetUserName = null;
    var adminName = adminCheck.data.userName;
    var headerRow = userData[0] || [];
    var columnMap = buildColumnMap(headerRow);
    var usernameCol = columnMap['Username'];
    var nomeCol = columnMap['Nome Completo'];

    if (usernameCol === undefined || nomeCol === undefined) {
      return { success: false, message: 'Configurazione foglio Utenti non valida' };
    }

    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (String(row[usernameCol]).trim() === String(targetUserId).trim()) {
        targetUserName = row[nomeCol];
        break;
      }
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

    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
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
// AGGIORNAMENTO STATO CANTIERE — modifica colonna Stato Lavori
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna lo stato di un cantiere nel foglio Cantieri (colonna D).
 *
 * DESCRIZIONE ESTESA: Riceve l'ID del cantiere e il nuovo stato, trova la riga
 * corrispondente nel foglio Cantieri tramite COLUMNS_CANTIERI.ID, scrive il
 * nuovo valore in COLUMNS_CANTIERI.STATO (colonna D, indice 3) e invalida
 * la cache per forzare il reload nei client. Accetta solo stati predefiniti
 * (Aperto, Chiuso, Sospeso, In Pausa, Completato). Richiede sessione admin.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken e ruolo admin
 *   2. Verifica che nuovoStato sia tra quelli predefiniti
 *   3. Apre foglio Cantieri, scorre righe cercando COLUMNS_CANTIERI.ID == cantiereId
 *   4. Scrive nuovoStato in COLUMNS_CANTIERI.STATO + 1 (1-based)
 *   5. Invalida cache cantieri via invalidateAdminCache()
 *   6. Ritorna { success, message, data: { cantiereId, vecchioStato, nuovoStato } }
 *
 * CHIAMATA DA: ApiRouter.gs → doPost() (action='updateCantiereStato')
 * CHIAMA:      validateSessionToken(), getSheetSafely(), invalidateAdminCache(),
 *              Logger.debug, Logger.critical, COLUMNS_CANTIERI, SHEET_NAMES
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @param {string} cantiereId   - ID del cantiere (es. 'C001').
 * @param {string} nuovoStato   - Nuovo stato (Aperto|Chiuso|Sospeso|In Pausa|Completato).
 * @returns {{ success: boolean, message: string, data?: { cantiereId: string,
 *             vecchioStato: string, nuovoStato: string } }} Risultato operazione.
 * @example
 * updateCantiereStato('admin_1709123456_abc', 'C001', 'Chiuso');
 * // → { success: true, message: 'Stato cantiere C001 aggiornato: Aperto → Chiuso',
 * //     data: { cantiereId: 'C001', vecchioStato: 'Aperto', nuovoStato: 'Chiuso' } }
 */
function updateCantiereStato(sessionToken, cantiereId, nuovoStato) {
  try {
    Logger.debug('updateCantiereStato:', cantiereId, '->', nuovoStato);

    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    // Valida stato predefinito (allineato ai 3 stati del foglio Cantieri)
    var statiValidi = ['Aperto', 'Chiuso', 'Sospeso', 'Completato'];
    if (statiValidi.indexOf(nuovoStato) === -1) {
      return { success: false, message: 'Stato non valido: ' + nuovoStato };
    }

    // Trova cantiere e aggiorna stato
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = getSheetSafely(ss, SHEET_NAMES.CANTIERI);
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }

    var lastRow = cantieriSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Nessun cantiere nel foglio' };
    }

    var data = cantieriSheet.getRange(2, 1, lastRow - 1, COLUMNS_CANTIERI.STATO + 1).getValues();

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][COLUMNS_CANTIERI.ID]) === String(cantiereId)) {
        var vecchioStato = String(data[i][COLUMNS_CANTIERI.STATO] || '');
        var rowIndex1 = i + 2;
        cantieriSheet.getRange(rowIndex1, COLUMNS_CANTIERI.STATO + 1).setValue(nuovoStato);
        Logger.debug('Stato cantiere aggiornato:', cantiereId, vecchioStato, '->', nuovoStato);

        // Invalida cache cantieri
        invalidateAdminCache(sessionToken, 'cantieri');

        return {
          success: true,
          message: 'Stato cantiere ' + cantiereId + ' aggiornato: ' + vecchioStato + ' → ' + nuovoStato,
          data: { cantiereId: cantiereId, vecchioStato: vecchioStato, nuovoStato: nuovoStato }
        };
      }
    }

    return { success: false, message: 'Cantiere ' + cantiereId + ' non trovato' };

  } catch (error) {
    Logger.critical('Errore updateCantiereStato:', error);
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
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var headerRow = userData[0] || [];
    var columnMap = buildColumnMap(headerRow);
    var usernameCol = columnMap['Username'];
    var nomeCol = columnMap['Nome Completo'];

    if (usernameCol === undefined || nomeCol === undefined) {
      return { success: false, message: 'Configurazione foglio Utenti non valida' };
    }

    var targetUserName = null;
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (String(row[usernameCol]).trim() === String(targetUserId).trim()) {
        targetUserName = row[nomeCol];
        console.log('[DEBUG] TROVATO targetUserName:', targetUserName);
        break;
      }
    }

    if (!targetUserName) {
      return {
        success: false,
        message: 'Utente target non trovato'
      };
    }

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

    var indexNum = parseInt(entryIndex, 10);
    if (isNaN(indexNum) || indexNum < 0) {
      return {
        success: false,
        message: 'Indice registrazione non valido'
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetSheet = ss.getSheetByName(targetUserName);
    if (!targetSheet) {
      return {
        success: false,
        message: 'Foglio dipendente non trovato'
      };
    }

    var allData = targetSheet.getDataRange().getValues();
    var matchingRows = [];

    for (var rowIndex = 4; rowIndex < allData.length; rowIndex++) {
      var rowDate = allData[rowIndex][0];
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
          rowIndex: rowIndex + 1,
          data: allData[rowIndex]
        });
      }
    }

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

    var targetRow = matchingRows[indexNum];
    var deletedEntry = {
      data: dateStr,
      cantiereId: targetRow.data[1] || '',
      cantiereName: targetRow.data[2] || '',
      ore: targetRow.data[3] || 0,
      note: targetRow.data[4] || ''
    };

    try {
      targetSheet.deleteRow(targetRow.rowIndex);
    } catch (deleteError) {
      return {
        success: false,
        message: 'Errore durante l\'eliminazione: ' + deleteError.message
      };
    }

    try {
      updateCantiereHours(deletedEntry.cantiereId, -deletedEntry.ore, targetUserName);
      console.log('[DELETE] Ore cantiere aggiornate:', deletedEntry.cantiereId, '-', deletedEntry.ore + 'h');
    } catch (cantiereError) {
      console.log('[DELETE] Warning: errore aggiornamento cantiere:', cantiereError.message);
    }

    try {
      var monthKey = dateStr.substring(0, 7);
      CacheService.getScriptCache().remove('userMonthly_' + targetUserId + '_' + monthKey);
    } catch (cacheError) {
      // Cache non critica
    }

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
// TEST — verifica manuale deleteWorkEntry da Script Editor
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// RICALCOLO CANTIERI — wrapper API per performConstructionSitesRecalculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper API per il ricalcolo totali ore cantieri (solo admin).
 *
 * DESCRIZIONE ESTESA: Espone via HTTP la funzionalità di ricalcolo totali
 * precedentemente accessibile solo dal menu Google Sheets. Delega tutta la
 * logica a performConstructionSitesRecalculation() (CalcoloCantieri.gs) che
 * scansiona tutti i fogli dipendente e aggiorna la colonna ORE_TOTALI del
 * foglio Cantieri dove il valore differisce di oltre 0.01h. Se vengono
 * effettuate correzioni, invalida la cache cantieri per forzare il reload.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Chiama performConstructionSitesRecalculation() → result
 *   3. Se result.success && correzioni > 0 → invalidateAdminCache('cantieri')
 *   4. Costruisce risposta con { success, message, data: { corrections, ... } }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='ricalcolaCantieri')
 *              admin.html → eseguiRicalcoloCantieri()
 * CHIAMA:      validateSessionToken(), performConstructionSitesRecalculation()
 *              (CalcoloCantieri.gs), invalidateAdminCache(), Logger.debug/critical
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @returns {{ success: boolean, message: string, data?: {
 *   corrections: Array<{ id: string, name: string, oldTotal: number, newTotal: number, difference: number }>,
 *   constructionSitesUpdated: number,
 *   employeesProcessed: number,
 *   executionTime: string } }} Risultato ricalcolo.
 *
 * @example
 * ricalcolaCantieriAPI('admin_1709123456_abc');
 * // → { success: true, message: 'Ricalcolo completato: 3 correzioni in 4.2s',
 * //     data: { corrections: [...], constructionSitesUpdated: 10, employeesProcessed: 5 } }
 */
function ricalcolaCantieriAPI(sessionToken) {
  try {
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    Logger.debug('ricalcolaCantieriAPI: avvio ricalcolo');
    var result = performConstructionSitesRecalculation();

    if (result.success && result.corrections.length > 0) {
      invalidateAdminCache(sessionToken, 'cantieri');
    }

    return {
      success: result.success,
      message: result.success
        ? 'Ricalcolo completato: ' + result.corrections.length + ' correzioni in ' + result.executionTime + 's'
        : 'Ricalcolo fallito: ' + (result.error || 'errore sconosciuto'),
      data: {
        corrections: result.corrections || [],
        constructionSitesUpdated: result.constructionSitesUpdated || 0,
        employeesProcessed: result.employeesProcessed || 0,
        executionTime: result.executionTime || '0'
      }
    };

  } catch (error) {
    Logger.critical('Errore ricalcolaCantieriAPI:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICA ALLINEAMENTO — wrapper API per performDataAlignmentVerification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper API per la verifica allineamento dati cantieri (solo admin).
 *
 * DESCRIZIONE ESTESA: Espone via HTTP la funzionalità di audit read-only
 * precedentemente accessibile solo dal menu Google Sheets. Delega tutta la
 * logica a performDataAlignmentVerification() (CalcoloCantieri.gs) che
 * confronta i totali dichiarati nel foglio Cantieri con i totali reali
 * calcolati dai fogli dipendente, identificando tre categorie di problemi:
 * inconsistencies (totale dichiarato ≠ reale), orphanedHours (ore su cantieri
 * inesistenti), missingConstructionSites (cantieri referenziati ma assenti).
 * Non modifica alcun dato — operazione puramente diagnostica.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Chiama performDataAlignmentVerification() → result
 *   3. Calcola totalProblemi = inconsistencies + missingConstructionSites + orphanedHours
 *   4. Costruisce risposta con { success, message, data: { ... } }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='verificaAllineamento')
 *              admin.html → eseguiVerificaAllineamento()
 * CHIAMA:      validateSessionToken(), performDataAlignmentVerification()
 *              (CalcoloCantieri.gs), Logger.debug/critical
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @returns {{ success: boolean, message: string, data?: {
 *   inconsistencies: Array<{ siteId: string, name: string, declared: number, actual: number, difference: number }>,
 *   orphanedHours: Array<{ siteId: string, employee: string, hours: number }>,
 *   missingConstructionSites: Array<{ siteId: string, totalHours: number, employees: string[] }>,
 *   employeesAnalyzed: number,
 *   constructionSitesAnalyzed: number,
 *   totalHoursEmployee: number } }} Risultato verifica.
 *
 * @example
 * verificaAllineamentoAPI('admin_1709123456_abc');
 * // → { success: true, message: 'Tutto allineato',
 * //     data: { inconsistencies: [], orphanedHours: [], missingConstructionSites: [],
 * //             employeesAnalyzed: 5, constructionSitesAnalyzed: 10, totalHoursEmployee: 480 } }
 */
function verificaAllineamentoAPI(sessionToken) {
  try {
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    Logger.debug('verificaAllineamentoAPI: avvio verifica');
    var result = performDataAlignmentVerification();

    var totalProblemi = (result.inconsistencies || []).length +
                        (result.missingConstructionSites || []).length +
                        (result.orphanedHours || []).length;

    return {
      success: result.success,
      message: result.success
        ? (totalProblemi === 0 ? 'Tutto allineato' : totalProblemi + ' problemi rilevati')
        : 'Verifica fallita: ' + (result.error || 'errore sconosciuto'),
      data: {
        inconsistencies: result.inconsistencies || [],
        orphanedHours: result.orphanedHours || [],
        missingConstructionSites: result.missingConstructionSites || [],
        employeesAnalyzed: result.employeesAnalyzed || 0,
        constructionSitesAnalyzed: result.constructionSitesAnalyzed || 0,
        totalHoursEmployee: result.totalHoursEmployee || 0
      }
    };

  } catch (error) {
    Logger.critical('Errore verificaAllineamentoAPI:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIO PASSWORD DIPENDENTE — wrapper API per updateUserPassword
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cambia la password di un dipendente (solo admin).
 *
 * DESCRIZIONE ESTESA: Espone via HTTP la funzionalità di cambio password
 * precedentemente accessibile solo dal menu Google Sheets. Verifica il ruolo
 * admin del richiedente con lo stesso pattern di updateWorkEntry(), poi cerca
 * l'utente target tramite getUsersList() (GestionePassword.gs) per ottenere
 * rowIndex e colMap dinamici. Chiama updateUserPassword() che scrive sia la
 * password in chiaro (legacy) che l'hash SHA-256 nelle colonne 'Password' e
 * 'Password Hash' del foglio Utenti.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Verifica ruolo admin tramite scansione foglio Utenti (colonna 'Ruolo')
 *   3. Valida nuovaPassword (min 4 caratteri)
 *   4. getUsersList() → cerca utenteTarget per targetUserId
 *   5. updateUserPassword(utenteTarget, nuovaPassword) → risultato
 *   6. Ritorna { success, message }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='cambiaPassword')
 *              admin.html → eseguiCambioPassword()
 * CHIAMA:      validateSessionToken(), getWorksheet(), buildColumnMap(),
 *              getUsersList() (GestionePassword.gs),
 *              updateUserPassword() (GestionePassword.gs),
 *              Logger.debug/critical
 *
 * @param {string} sessionToken  - Token di sessione admin.
 * @param {string} targetUserId  - Username del dipendente da modificare.
 * @param {string} nuovaPassword - Nuova password in chiaro (min 4 caratteri).
 * @returns {{ success: boolean, message: string }} Esito operazione.
 *
 * @example
 * cambiaPasswordDipendente('admin_1709123456_abc', 'mario.rossi', 'nuovaPass123');
 * // → { success: true, message: 'Password aggiornata per Mario Rossi' }
 */
function cambiaPasswordDipendente(sessionToken, targetUserId, nuovaPassword) {
  try {
    var adminCheck = getAdminSessionContext(sessionToken);
    if (!adminCheck.success) {
      return { success: false, message: adminCheck.message };
    }

    // Verifica ruolo admin
    var parts = String(sessionToken).split('_');
    var requestingUserId = parts.slice(0, parts.length - 2).join('_');
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var headerRow = userData[0];
    var colMap = buildColumnMap(headerRow);
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') { ruoloColumnIndex = j; break; }
    }
    var isAdmin = false;
    for (var u = 1; u < userData.length; u++) {
      if (String(userData[u][colMap['Username']]).trim() === requestingUserId) {
        isAdmin = (ruoloColumnIndex !== -1 && ADMIN_VALIDATION.isAdminRole(userData[u][ruoloColumnIndex]));
        break;
      }
    }
    if (!isAdmin) {
      return { success: false, message: 'Accesso non autorizzato' };
    }

    // Valida password
    if (!nuovaPassword || String(nuovaPassword).trim().length < 4) {
      return { success: false, message: 'Password troppo corta (min. 4 caratteri)' };
    }

    // Trova l'utente target tramite getUsersList()
    var utenti = getUsersList();
    var utenteTarget = null;
    for (var i = 0; i < utenti.length; i++) {
      if (utenti[i].userId === String(targetUserId).trim()) {
        utenteTarget = utenti[i];
        break;
      }
    }
    if (!utenteTarget) {
      return { success: false, message: 'Utente ' + targetUserId + ' non trovato' };
    }

    // Aggiorna password
    var risultato = updateUserPassword(utenteTarget, String(nuovaPassword).trim());
    Logger.debug('cambiaPasswordDipendente:', targetUserId, risultato.success ? 'OK' : 'FAIL');

    return risultato.success
      ? { success: true, message: 'Password aggiornata per ' + utenteTarget.nome }
      : { success: false, message: risultato.message || 'Aggiornamento fallito' };

  } catch (error) {
    Logger.critical('Errore cambiaPasswordDipendente:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT COMMERCIALISTA — wrapper API per ReportCommercialista.gs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generaReportMensileAPI — Wrapper API per la generazione del report mensile commercialista.
 *
 * Verifica ruolo admin, poi delega a generateMonthlyReportComplete() in ReportCommercialista.gs.
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @param {number|string} month - Mese 1-12.
 * @param {number|string} year  - Anno.
 * @param {string} [employee]   - Nome dipendente o '__ALL__' per tutti.
 * @returns {{ success: boolean, totalHours?: number, employeesCount?: number, monthName?: string, year?: number, folderName?: string, employees?: Array, message?: string }}
 */
function generaReportMensileAPI(sessionToken, month, year, employee) {
  var adminCheck = validateAdmin(sessionToken);
  if (!adminCheck.success) {
    return { success: false, message: adminCheck.message || 'Accesso non autorizzato' };
  }
  var m = parseInt(month, 10);
  var y = parseInt(year, 10);
  var emp = employee || '__ALL__';
  if (isNaN(m) || m < 1 || m > 12) {
    return { success: false, message: 'Mese non valido' };
  }
  if (isNaN(y) || y < 2020 || y > 2030) {
    return { success: false, message: 'Anno non valido' };
  }
  return generateMonthlyReportComplete(m, y, emp);
}

/**
 * generaReportAnnualeAPI — Wrapper API per la generazione del report annuale commercialista.
 *
 * Verifica ruolo admin, poi delega a generateAnnualReport() in ReportCommercialista.gs.
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @param {number|string} year  - Anno.
 * @returns {{ success: boolean, fileName?: string, totalEmployees?: number, totalHours?: number, error?: string }}
 */
function generaReportAnnualeAPI(sessionToken, year) {
  var adminCheck = validateAdmin(sessionToken);
  if (!adminCheck.success) {
    return { success: false, message: adminCheck.message || 'Accesso non autorizzato' };
  }
  var y = parseInt(year, 10);
  if (isNaN(y) || y < 2020 || y > 2030) {
    return { success: false, message: 'Anno non valido' };
  }
  return generateAnnualReport(y);
}

/**
 * downloadFilePdfAPI — Esporta un file Google Sheets da Drive come PDF in base64.
 *
 * Verifica ruolo admin, recupera il file Drive tramite fileId, lo esporta
 * come PDF con getAs(MimeType.PDF) e restituisce il contenuto in base64.
 *
 * @param {string} sessionToken - Token di sessione admin.
 * @param {string} fileId       - ID del file Google Sheets su Drive.
 * @returns {{ success: boolean, pdf?: string, fileName?: string, message?: string }}
 */
function downloadFilePdfAPI(sessionToken, fileId) {
  var adminCheck = validateAdmin(sessionToken);
  if (!adminCheck.success) {
    return { success: false, message: adminCheck.message || 'Accesso non autorizzato' };
  }
  if (!fileId) {
    return { success: false, message: 'fileId mancante' };
  }
  try {
    var file = DriveApp.getFileById(fileId);
    var pdfBlob = file.getAs(MimeType.PDF);
    var base64 = Utilities.base64Encode(pdfBlob.getBytes());
    return {
      success: true,
      pdf: base64,
      fileName: file.getName() + '.pdf'
    };
  } catch (error) {
    return { success: false, message: 'Errore esportazione PDF: ' + error.message };
  }
}
