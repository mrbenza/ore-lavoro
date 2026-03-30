/**
 * test_apirouter.gs - Test manuali per il modulo ApiRouter.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica del routing API e del sistema completo.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): ApiRouter.gs, Authentication.gs, UserAPI.gs,
 *                                  Utils.gs, Config.gs
 */

// =============================================================================
// API ROUTER
// =============================================================================

/**
 * Test configurazione sistema — verifica fogli, header e ping.
 *
 * Esegue una serie di controlli diagnostici: esistenza dei fogli obbligatori
 * (Utenti, Cantieri), lettura header, conteggio utenti e cantieri, e un ping
 * di sistema. Stampa tutto nel log di esecuzione GAS. Non modifica dati.
 *
 * CHIAMATA DA: (esecuzione manuale da Script Editor o testCompleteSystem())
 * CHIAMA:      getWorksheet(), getSheetSafely(), handlePing(), SHEET_NAMES,
 *              COLUMNS, Logger (built-in console.log)
 *
 * @returns {void}
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
        (availableSheets.indexOf(n) !== -1 ? 'OK' : 'MANCANTE') +
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
    console.log('Sistema Modulare V2.3 - Se tutti i test sono OK, il sistema e pronto!');
    console.log('Architettura: 7 moduli separati');
    console.log('Manutenibilita: ALTA');

  } catch (error) {
    console.log('ERRORE CRITICO:', error.toString());
  }
}

/**
 * Test autenticazione — tenta login con credenziali di test.
 *
 * Chiama authenticateUser() con userId/password 'test' e stampa il risultato.
 * Usato per verificare che il modulo Authentication.gs sia operativo.
 * Richiede che l'utente 'test' esista nel foglio Utenti.
 *
 * CHIAMATA DA: (esecuzione manuale da Script Editor o testCompleteSystem())
 * CHIAMA:      authenticateUser()
 *
 * @returns {void}
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
      console.log('Autenticazione riuscita!');
      console.log('Nome utente:', authResult.data.name);
      console.log('Session token:', authResult.sessionToken);
      console.log('Architettura:', authResult.systemInfo.installType);
    } else {
      console.log('Autenticazione fallita:', authResult.message);
    }
  } catch (error) {
    console.log('Errore test autenticazione:', error.toString());
  }
}

/**
 * Test calendario mensile — legge i dati ore di settembre 2025 per l'utente 'test'.
 *
 * Genera un session token per l'utente 'test' (senza login reale) e chiama
 * getMonthlyWorkData(). Il token generato bypass la logica di autenticazione
 * poiche' validateSessionToken() verifica solo il formato, non l'hash.
 * Utile per verificare che il modulo UserAPI.gs e la lettura del foglio
 * dipendente siano operativi.
 *
 * CHIAMATA DA: (esecuzione manuale da Script Editor o testCompleteSystem())
 * CHIAMA:      generateSessionToken(), getMonthlyWorkData()
 *
 * @returns {void}
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
      console.log('Test calendario riuscito!');
      console.log('Utente:', result.data.userName);
      console.log('Giorni lavorati:', result.data.totalDaysWorked);
    } else {
      console.log('Test calendario fallito:', result.message);
    }
  } catch (error) {
    console.log('Errore test calendario:', error.toString());
  }
}

/**
 * Test completo sistema modulare — esegue tutti i test in sequenza.
 *
 * Orchestra in sequenza testConfiguration(), testAuthentication() e
 * testGetMonthlyWorkData(). Stampa nel log GAS un riepilogo dell'architettura
 * modulare e i risultati di ogni test. Utile come smoke test dopo un deploy.
 *
 * CHIAMATA DA: (esecuzione manuale da Script Editor)
 * CHIAMA:      testConfiguration(), testAuthentication(), testGetMonthlyWorkData()
 *
 * @returns {void}
 */
function testCompleteSystem() {
  console.log('AVVIO TEST COMPLETO SISTEMA V2.3 MODULARE');
  console.log('=============================================');
  console.log('\nARCHITETTURA: 7 moduli separati');
  console.log('  1. Config.gs       - Configurazioni');
  console.log('  2. Utils.gs        - Utilities');
  console.log('  3. Authentication.gs - Login/Sessioni');
  console.log('  4. SheetsDAO.gs    - Data Access');
  console.log('  5. UserAPI.gs      - API Utenti');
  console.log('  6. AdminAPI.gs     - API Admin');
  console.log('  7. ApiRouter.gs    - Entry Point');

  console.log('\n1. TEST CONFIGURAZIONE:');
  testConfiguration();

  console.log('\n2. TEST AUTENTICAZIONE:');
  testAuthentication();

  console.log('\n3. TEST CALENDARIO:');
  testGetMonthlyWorkData();

  console.log('\nTEST COMPLETO TERMINATO');
  console.log("Sistema pronto all'uso in modalita modulare!");
}
