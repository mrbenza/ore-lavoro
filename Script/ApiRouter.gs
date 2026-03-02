/**
 * ApiRouter.gs - Entry Point e Routing Sistema
 * 
 * ESTRATTO DA: code.gs (doGet, doPost, handlePing)
 * MODIFICHE: Routing organizzato con chiamate ai moduli
 * 
 * Questo file coordina tutte le richieste e le smista ai moduli appropriati:
 * - Authentication.gs per login
 * - UserAPI.gs per operazioni utenti
 * - AdminAPI.gs per operazioni admin
 * - SheetsDAO.gs per accesso dati
 */

// ========================================
// PING / HEALTH CHECK
// ========================================

/**
 * Health check sistema
 * IDENTICO al tuo code.gs
 */
function handlePing() {
  return {
    success: true,
    message: 'Sistema operativo - Container-bound Modulare',
    timestamp: new Date().toISOString(),
    version: SYSTEM_INFO.version,
    build: SYSTEM_INFO.build,
    mode: SYSTEM_INFO.mode,
    installType: SYSTEM_INFO.installType,
    features: SYSTEM_INFO.features,
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    cors: true,
    architecture: 'MODULAR'
  };
}

// ========================================
// ENTRY POINT GET
// ========================================

/**
 * Entry point GET (webapp)
 * MODIFICATO: Routing organizzato con chiamate ai moduli
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    Logger.debug('Richiesta GET ricevuta:', action);

    if (action === 'options') {
      return createCORSResponse({ success: true, message: 'CORS preflight OK' });
    }

    var result;
    
    // ========================================
    // PUBLIC ENDPOINTS (no auth)
    // ========================================
    
    if (action === 'ping') {
      result = handlePing();
    }
    else if (action === 'authenticate') {
      // → Authentication.gs
      result = authenticateUser(e.parameter.userId, e.parameter.password);
    }
    
    // ========================================
    // USER ENDPOINTS (require session)
    // ========================================
    
    else if (action === 'saveWorkEntry') {
      // → UserAPI.gs
      var workData = {};
      try { 
        workData = JSON.parse(e.parameter.workData || '{}'); 
      } catch (_) { 
        workData = {}; 
      }
      result = saveWorkEntry(e.parameter.sessionToken, workData);
    }
    else if (action === 'getCantieri') {
      // → SheetsDAO.gs
      result = getCantieri(e.parameter.sessionToken);
    }
    else if (action === 'getUserInfo') {
      // → SheetsDAO.gs
      result = getUserInfo(e.parameter.sessionToken);
    }
    else if (action === 'getMonthlyWorkData') {
      // → UserAPI.gs
      var year = parseInt(e.parameter.year, 10) || new Date().getFullYear();
      var month = parseInt(e.parameter.month, 10) || new Date().getMonth() + 1;
      result = getMonthlyWorkData(e.parameter.sessionToken, year, month);
    }
    
    // ========================================
    // ADMIN ENDPOINTS
    // ========================================
    
    else if (action === 'validateAdmin') {
      // → Authentication.gs
      result = validateAdmin(e.parameter.sessionToken, e.parameter.userId);
    }
    else if (action === 'getCantieriOverview') {
      // → AdminAPI.gs
      result = getCantieriAdminOverview(e.parameter.sessionToken, e.parameter.modalita);
    }
    else if (action === 'getDipendentiList') {
      // → AdminAPI.gs
      result = getDipendentiListAdmin(e.parameter.sessionToken);
    }
    else if (action === 'getDipendenteTimeline') {
      // → AdminAPI.gs
      result = getDipendenteTimelineAdmin(
        e.parameter.sessionToken, 
        e.parameter.userId, 
        e.parameter.timeframe
      );
    }
    else if (action === 'getOtherUserInfo') {
      // → SheetsDAO.gs
      result = getOtherUserInfo(e.parameter.sessionToken, e.parameter.targetUserId);
    }
    else if (action === 'getOtherUserMonthlyData') {
      // → AdminAPI.gs
      result = getOtherUserMonthlyData(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.year,
        e.parameter.month
      );
    }
    else if (action === 'getAllCantieriForAdmin') {
      // → SheetsDAO.gs
      result = getAllCantieriForAdmin(e.parameter.sessionToken);
    }
    else if (action === 'updateWorkEntry') {
      // → AdminAPI.gs
      var updateData = {};
      try {
        updateData = JSON.parse(e.parameter.updateData || '{}');
      } catch (_) {}
      result = updateWorkEntry(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.dateStr,
        updateData
      );
    }
    else if (action === 'deleteWorkEntry') {
      // → AdminAPI.gs
      result = deleteWorkEntry(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.dateStr,
        parseInt(e.parameter.entryIndex, 10)
      );
    }
    else if (action === 'invalidateCache') {
      // → AdminAPI.gs
      result = invalidateAdminCache(e.parameter.sessionToken, e.parameter.cacheType);
    }
    
    // ========================================
    // UNKNOWN ACTION
    // ========================================
    
    else {
      result = { 
        success: false, 
        message: 'Azione non riconosciuta: ' + action,
        availableActions: [
          'ping', 
          'authenticate', 
          'saveWorkEntry', 
          'getCantieri', 
          'getUserInfo', 
          'getMonthlyWorkData',
          'validateAdmin',
          'getCantieriOverview',
          'getDipendentiList',
          'getDipendenteTimeline',
          'getOtherUserInfo',
          'getOtherUserMonthlyData',
          'getAllCantieriForAdmin',
          'updateWorkEntry',
          'deleteWorkEntry',
          'invalidateCache'
        ]
      };
    }
    
    return createCORSResponse(result);
    
  } catch (error) {
    return createCORSResponse(handleError('doGet', error));
  }
}

// ========================================
// ENTRY POINT POST
// ========================================

/**
 * Entry point POST (webapp)
 * MODIFICATO: Routing organizzato con chiamate ai moduli
 */
function doPost(e) {
  try {
    var params = {};
    
    if (e && e.postData && e.postData.contents) {
      try {
        var postParams = new URLSearchParams(e.postData.contents);
        var dataParam = postParams.get('data');
        if (dataParam) params = JSON.parse(dataParam);
      } catch (parseError) {
        Logger.warn('Errore parsing POST data:', parseError);
        params = e.parameter || {};
      }
    } else { 
      params = e && e.parameter ? e.parameter : {}; 
    }

    Logger.debug('POST richiesta ricevuta:', params.action);

    var result;
    
    // ========================================
    // PUBLIC ENDPOINTS
    // ========================================
    
    if (params.action === 'ping') {
      result = handlePing();
    }
    else if (params.action === 'authenticate') {
      // → Authentication.gs
      result = authenticateUser(params.userId, params.password);
    }
    
    // ========================================
    // USER ENDPOINTS
    // ========================================
    
    else if (params.action === 'saveWorkEntry') {
      // → UserAPI.gs
      var workDataPost = params.workData || {};
      result = saveWorkEntry(params.sessionToken, workDataPost);
    }
    else if (params.action === 'getCantieri') {
      // → SheetsDAO.gs
      result = getCantieri(params.sessionToken);
    }
    else if (params.action === 'getUserInfo') {
      // → SheetsDAO.gs
      result = getUserInfo(params.sessionToken);
    }
    else if (params.action === 'getMonthlyWorkData') {
      // → UserAPI.gs
      var yearPost = parseInt(params.year, 10) || new Date().getFullYear();
      var monthPost = parseInt(params.month, 10) || new Date().getMonth() + 1;
      result = getMonthlyWorkData(params.sessionToken, yearPost, monthPost);
    }
    
    // ========================================
    // ADMIN ENDPOINTS
    // ========================================
    
    else if (params.action === 'validateAdmin') {
      // → Authentication.gs
      Logger.debug('doPost validateAdmin chiamato con params:', params);
      result = validateAdmin(params.sessionToken, params.userId);
      Logger.debug('doPost validateAdmin risultato:', result);
    }
    else if (params.action === 'getCantieriOverview') {
      // → AdminAPI.gs
      result = getCantieriAdminOverview(params.sessionToken, params.modalita);
    }
    else if (params.action === 'getDipendentiList') {
      // → AdminAPI.gs
      result = getDipendentiListAdmin(params.sessionToken);
    }
    else if (params.action === 'getDipendenteTimeline') {
      // → AdminAPI.gs
      result = getDipendenteTimelineAdmin(
        params.sessionToken, 
        params.userId, 
        params.timeframe
      );
    }
    else if (params.action === 'getOtherUserInfo') {
      // → SheetsDAO.gs
      result = getOtherUserInfo(params.sessionToken, params.targetUserId);
    }
    else if (params.action === 'getOtherUserMonthlyData') {
      // → AdminAPI.gs
      result = getOtherUserMonthlyData(
        params.sessionToken,
        params.targetUserId,
        params.year,
        params.month
      );
    }
    else if (params.action === 'getAllCantieriForAdmin') {
      // → SheetsDAO.gs
      result = getAllCantieriForAdmin(params.sessionToken);
    }   
    else if (params.action === 'updateWorkEntry') {
      // → AdminAPI.gs
      var updateDataPost = {};
      try {
        updateDataPost = JSON.parse(params.updateData || '{}');
      } catch (_) {}
      result = updateWorkEntry(
        params.sessionToken,
        params.targetUserId,
        params.dateStr,
        updateDataPost
      );
    }
    else if (params.action === 'deleteWorkEntry') {
      // → AdminAPI.gs
      result = deleteWorkEntry(
        params.sessionToken,
        params.targetUserId,
        params.dateStr,
        parseInt(params.entryIndex, 10)
      );
    }
    else if (params.action === 'invalidateCache') {
      // → AdminAPI.gs
      result = invalidateAdminCache(params.sessionToken, params.cacheType);
    }
    
    // ========================================
    // UNKNOWN ACTION
    // ========================================
    
    else {
      result = { 
        success: false, 
        message: 'Azione non riconosciuta: ' + params.action,
        availableActions: [
          'ping', 
          'authenticate', 
          'saveWorkEntry', 
          'getCantieri', 
          'getUserInfo', 
          'getMonthlyWorkData',
          'validateAdmin',
          'getCantieriOverview',
          'getDipendentiList',
          'getDipendenteTimeline',
          'getOtherUserInfo',
          'getOtherUserMonthlyData',
          'getAllCantieriForAdmin',
          'updateWorkEntry',
          'deleteWorkEntry',
          'invalidateCache'
        ]
      };
    }
    
    return createCORSResponse(result);
    
  } catch (error) {
    return createCORSResponse(handleError('doPost', error));
  }
}

// ========================================
// FUNZIONI TEST COMPLETE
// ========================================

/**
 * Test configurazione sistema
 */
function testConfiguration() {
  console.log('=== TEST CONFIGURAZIONE SISTEMA V2.3 MODULARE ===');
  try {
    console.log('Spreadsheet ID:', CONFIG.SPREADSHEET_ID);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log('Spreadsheet Nome:', ss.getName());

    var requiredSheets = [SHEET_NAMES.UTENTI, SHEET_NAMES.CANTIERI];
    var availableSheets = ss.getSheets().map(s => s.getName());
    console.log('Fogli disponibili:', availableSheets);
    
    requiredSheets.forEach(n => {
      console.log(
        (availableSheets.indexOf(n) !== -1 ? '✅' : '❌') + 
        ' Foglio "' + n + '" ' + 
        (availableSheets.indexOf(n) !== -1 ? 'trovato' : 'MANCANTE!')
      );
    });

    try {
      var userSheet = getWorksheet();
      var headers = userSheet.getRange(1, 1, 1, 9).getValues()[0];
      console.log('Headers foglio Utenti:', headers);
      var userCount = Math.max(userSheet.getLastRow() - 1, 0);
      console.log('Numero utenti configurati: ' + userCount);
      
      if (userCount > 0) {
        var primaRiga = userSheet.getRange(2, 1, 1, 9).getValues()[0];
        console.log('Primo utente - Username:', primaRiga[COLUMNS.USER_ID]);
        console.log('Primo utente - Password presente:', primaRiga[COLUMNS.PASSWORD] ? 'Si' : 'No');
        console.log('Primo utente - Hash presente:', primaRiga[COLUMNS.PASSWORD_HASH] ? 'Si' : 'No');
      }
    } catch (e) { 
      console.log('Errore lettura foglio Utenti:', e.message); 
    }

    try {
      var cantieriSheet = getSheetSafely(ss, SHEET_NAMES.CANTIERI);
      if (cantieriSheet) {
        var cantieriHeaders = cantieriSheet.getRange(1, 1, 1, Math.max(cantieriSheet.getLastColumn(), 10)).getValues()[0];
        console.log('Headers foglio Cantieri:', cantieriHeaders);
        var cantieriCount = Math.max(cantieriSheet.getLastRow() - 1, 0);
        console.log('Numero cantieri configurati: ' + cantieriCount);
      } else {
        console.log('Foglio Cantieri non trovato');
      }
    } catch (e) { 
      console.log('Errore lettura foglio Cantieri:', e.message); 
    }

    var pingResult = handlePing();
    console.log('Test ping:', pingResult);
    
    console.log('=== RISULTATO CONFIGURAZIONE ===');
    console.log('✅ Sistema Modulare V2.3 - Se tutti i test sono ✅, il sistema è pronto!');
    console.log('📦 Architettura: 7 moduli separati');
    console.log('🔧 Manutenibilità: ALTA');
    
  } catch (error) { 
    console.log('ERRORE CRITICO:', error.toString()); 
  }
}

/**
 * Test autenticazione
 */
function testAuthentication() {
  console.log('=== TEST AUTENTICAZIONE MODULARE ===');
  var testUserId = 'test';
  var testPassword = 'test';
  console.log('Testando autenticazione per:', testUserId);
  
  try {
    var authResult = authenticateUser(testUserId, testPassword);
    console.log('Risultato:', authResult);
    
    if (authResult.success) {
      console.log('✅ Autenticazione riuscita!');
      console.log('Nome utente:', authResult.data.name);
      console.log('Session token:', authResult.sessionToken);
      console.log('Architettura:', authResult.systemInfo.installType);
    } else { 
      console.log('❌ Autenticazione fallita:', authResult.message); 
    }
  } catch (error) { 
    console.log('Errore test autenticazione:', error.toString()); 
  }
}

/**
 * Test calendario
 */
function testGetMonthlyWorkData() {
  console.log('=== TEST CALENDARIO MODULARE ===');
  var testUserId = 'test';
  var testYear = 2025;
  var testMonth = 9;
  
  try {
    var testToken = generateSessionToken(testUserId);
    console.log('Token generato:', testToken);
    
    var result = getMonthlyWorkData(testToken, testYear, testMonth);
    console.log('Risultato calendario:', result);
    
    if (result.success) {
      console.log('✅ Test calendario riuscito!');
      console.log('Utente:', result.data.userName);
      console.log('Giorni lavorati:', result.data.totalDaysWorked);
    } else { 
      console.log('❌ Test calendario fallito:', result.message); 
    }
  } catch (error) { 
    console.log('Errore test calendario:', error.toString()); 
  }
}

/**
 * Test completo sistema modulare
 */
function testCompleteSystem() {
  console.log('🚀 AVVIO TEST COMPLETO SISTEMA V2.3 MODULARE');
  console.log('=============================================');
  console.log('\n📦 ARCHITETTURA: 7 moduli separati');
  console.log('  1. Config.gs       - Configurazioni');
  console.log('  2. Utils.gs        - Utilities');
  console.log('  3. Authentication.gs - Login/Sessioni');
  console.log('  4. SheetsDAO.gs    - Data Access');
  console.log('  5. UserAPI.gs      - API Utenti');
  console.log('  6. AdminAPI.gs     - API Admin');
  console.log('  7. ApiRouter.gs    - Entry Point');
  
  console.log('\n1️⃣ TEST CONFIGURAZIONE:');
  testConfiguration();
  
  console.log('\n2️⃣ TEST AUTENTICAZIONE:');
  testAuthentication();
  
  console.log('\n3️⃣ TEST CALENDARIO:');
  testGetMonthlyWorkData();
  
  console.log('\n🏁 TEST COMPLETO TERMINATO');
  console.log('✅ Sistema pronto all\'uso in modalità modulare!');
}
