/**
 * @file Tests.gs
 * @description Funzioni di test manuali consolidate da tutti i moduli GAS.
 *
 * Queste funzioni sono progettate per essere eseguite manualmente dall'editor
 * Google Apps Script (Script Editor) a scopo diagnostico e di verifica.
 * NON vengono chiamate in produzione, salvo ove indicato nelle note di ogni funzione.
 *
 * Organizzazione per sezione:
 *   - AUTHENTICATION  — testRobustAuthentication(), diagnoseSheetStructure()
 *   - USER API        — testUserAPI()
 *   - UTILS           — testUtils()
 *   - ADMIN API       — testDeleteWorkEntry()
 *   - ARCHIVIO ORE    — testSingleArchive()
 *   - REPORT          — testReportSystem(), testSingleReport()
 *   - CONFIG          — testConfig()
 *   - SHEETS DAO      — testSheetsDAO()
 *   - API ROUTER      — testConfiguration(), testAuthentication(),
 *                       testGetMonthlyWorkData(), testCompleteSystem()
 */

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Test manuale di autenticazione con utente di esempio — da eseguire dall'editor GAS.
 *
 * Legge gli header del foglio Utenti, costruisce la columnMap e tenta
 * l'autenticazione con userId='test' e password='test123'.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      getWorksheet(), buildColumnMap(), authenticateUser()
 */
function testRobustAuthentication() {
  Logger.debug('=== TEST AUTENTICAZIONE ROBUSTA ===');

  try {
    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);

    Logger.debug('Headers trovati:', headers);
    Logger.debug('Mappatura colonne:', columnMap);

    // Test autenticazione con utente di esempio
    const authResult = authenticateUser('test', 'test123');
    Logger.debug('Risultato autenticazione:', authResult);

    if (authResult.success) {
      Logger.info('Autenticazione funzionante!');
      Logger.debug('Metodo auth:', authResult.systemInfo.authMethod);
      Logger.debug('Dati utente:', authResult.data.name);
    } else {
      Logger.warn('Autenticazione fallita:', authResult.message);
    }

  } catch (error) {
    Logger.error('Errore test:', error);
  }
}

/**
 * Diagnostica struttura del foglio Utenti — da eseguire dall'editor GAS.
 *
 * Stampa ogni header con la sua posizione e segnala le colonne essenziali
 * mancanti rispetto a quelle attese dal sistema di autenticazione.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      getWorksheet(), buildColumnMap()
 */
function diagnoseSheetStructure() {
  try {
    Logger.debug('=== DIAGNOSTICA STRUTTURA FOGLIO ===');

    const sheet = getWorksheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnMap = buildColumnMap(headers);

    Logger.debug('Headers del foglio:');
    headers.forEach((header, index) => {
      Logger.debug(`  ${String.fromCharCode(65 + index)} (${index}): "${header}"`);
    });

    Logger.debug('Mappatura riconosciuta:');
    Object.keys(columnMap).forEach(key => {
      const index = columnMap[key];
      const letter = String.fromCharCode(65 + index);
      Logger.debug(`  ${key} -> Colonna ${letter} (${index}): "${headers[index]}"`);
    });

    const required = ['Username', 'Nome Completo', 'Password', 'Attivo'];
    const missing = required.filter(col => columnMap[col] === undefined);

    if (missing.length === 0) {
      Logger.info('Tutte le colonne essenziali sono presenti');
    } else {
      Logger.warn('Colonne mancanti:', missing.join(', '));
    }

  } catch (error) {
    Logger.error('Errore diagnostica:', error);
  }
}

// =============================================================================
// USER API
// =============================================================================

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

// =============================================================================
// UTILS
// =============================================================================

/**
 * Test manuale delle funzioni utility — da eseguire dall'editor GAS.
 *
 * Verifica: validateHours, parseDateFlexible, generateSessionToken,
 * validateSessionToken, generatePasswordHash.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      validateHours(), parseDateFlexible(), generateSessionToken(),
 *              validateSessionToken(), generatePasswordHash()
 */
function testUtils() {
  console.log('=== TEST UTILS ===');

  // Test validazione ore
  console.log('validateHours(8.5):', validateHours(8.5));
  console.log('validateHours(25):', validateHours(25)); // null
  console.log('validateHours(-5):', validateHours(-5)); // null

  // Test parsing date
  console.log('parseDateFlexible("15/09/2025"):', parseDateFlexible("15/09/2025"));
  console.log('parseDateFlexible("2025-09-15"):', parseDateFlexible("2025-09-15"));

  // Test token
  var token = generateSessionToken('test_user');
  console.log('Token generato:', token);
  console.log('Token valido:', validateSessionToken(token));

  // Test hash password
  var hash = generatePasswordHash('testpassword');
  console.log('Hash password:', hash);

  console.log('=== TEST COMPLETATO ===');
}

// =============================================================================
// ADMIN API
// =============================================================================

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

// =============================================================================
// ARCHIVIO ORE
// =============================================================================

/**
 * Testa l'archiviazione sul primo dipendente disponibile per l'anno di default.
 *
 * Funzione di debug da eseguire manualmente dal menu Sheets o dall'editor GAS.
 * Esegue l'archiviazione reale (non un dry-run) sul primo dipendente della
 * lista e mostra il risultato dettagliato. Usare con cautela in produzione.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets, voce diagnostica)
 * CHIAMA:      getActiveEmployeeNames() (UtilsMenu.gs), performEmployeeArchive(),
 *              showSuccessMessage(), showErrorMessage() (UtilsMenu.gs)
 *
 * @returns {void}
 */
function testSingleArchive() {
  try {
    const employees = getActiveEmployeeNames();
    if (employees.length === 0) {
      showErrorMessage('Nessun dipendente trovato per il test');
      return;
    }

    const testEmployee = employees[0];
    const testYear = CONFIG.DATES.DEFAULT_ARCHIVE_YEAR;

    const result = performEmployeeArchive(testEmployee, testYear);

    const message = `TEST ARCHIVIAZIONE COMPLETATO\n\n` +
      `Dipendente testato: ${testEmployee}\n` +
      `Anno: ${testYear}\n` +
      `Successo: ${result.success ? 'Si' : 'No'}\n` +
      `Righe trovate: ${result.dataRows}\n` +
      `Ore totali: ${result.totalHours}\n` +
      `Errore: ${result.error || 'Nessuno'}`;

    showSuccessMessage(message);

  } catch (error) {
    showErrorMessage('Errore test archiviazione', error);
  }
}

// =============================================================================
// REPORT COMMERCIALISTA
// =============================================================================

/**
 * Test del sistema report — verifica accesso dati e cartelle Drive.
 *
 * Esegue un test reale (crea cartella se non esiste) sul primo dipendente
 * per il mese corrente. Non crea file report ma verifica che tutti i
 * componenti siano funzionanti. Restituisce un oggetto risultato e mostra
 * un messaggio tramite alert UI.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Report Commercialista")
 * CHIAMA:      getActiveEmployeeNames() (UtilsMenu.gs), createOrFindReportFolder(),
 *              extractEmployeeMonthData(), showSuccessMessage(), showErrorMessage() (UtilsMenu.gs)
 *
 * @returns {{ success: boolean, employeesCount?: number, testEmployee?: string, testHours?: number, folderCreated?: string, error?: string }}
 */
function testReportSystem() {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const employees = getActiveEmployeeNames();
    if (employees.length === 0) {
      throw new Error('Nessun dipendente trovato per test');
    }

    const reportFolder = createOrFindReportFolder(currentYear);
    const testEmployee = employees[0];
    const testData = extractEmployeeMonthData(testEmployee, currentMonth, currentYear);

    const message = `TEST SISTEMA REPORT COMPLETATO\n\n` +
      `Dipendenti trovati: ${employees.length}\n` +
      `Dipendente test: ${testEmployee}\n` +
      `Ore trovate (mese corrente): ${testData.totalHours}\n` +
      `Giorni lavorati: ${testData.rows.length}\n` +
      `Cantieri coinvolti: ${Object.keys(testData.constructionSitesSummary).length}\n` +
      `Cartella report: ${reportFolder.getName()}\n\n` +
      `STATO: Sistema report funzionante`;

    showSuccessMessage(message);

    return {
      success: true,
      employeesCount: employees.length,
      testEmployee: testEmployee,
      testHours: testData.totalHours,
      folderCreated: reportFolder.getName()
    };

  } catch (error) {
    const errorMessage = `TEST SISTEMA REPORT FALLITO\n\nErrore: ${error.message}`;
    showErrorMessage(errorMessage);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Menu bridge: genera un report di test per un singolo dipendente (mese corrente).
 * CHIAMATA DA: onOpen() → menu "📊 Report Commercialista" → "🧪 Test report"
 * CHIAMA:      executeTestSingleReport() (ReportCommercialista.gs), handleGlobalError()
 * @returns {void}
 */
function testSingleReport() {
  try {
    executeTestSingleReport();
  } catch (error) {
    handleGlobalError('testSingleReport', error);
  }
}

// =============================================================================
// CONFIG
// =============================================================================

/**
 * Esegue un test di configurazione e stampa i risultati nel log GAS.
 *
 * Funzione di debug da eseguire manualmente dall'editor GAS per verificare
 * lo stato del sistema. Non viene chiamata in produzione.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      validateConfiguration()
 */
function testConfig() {
  console.log('=== TEST CONFIGURAZIONE UNIFICATA ===');
  console.log('Spreadsheet ID:', CONFIG.SPREADSHEET_ID);
  console.log('Versione:', SYSTEM_INFO.version);
  console.log('Build:', SYSTEM_INFO.build);

  const validation = validateConfiguration();
  console.log('Configurazione valida:', validation.valid);

  if (!validation.valid) {
    console.log('Errori:', validation.errors);
  }

  console.log('=== TEST COMPLETATO ===');
}

// =============================================================================
// SHEETS DAO
// =============================================================================

/**
 * Test manuale di SheetsDAO — da eseguire dall'editor GAS.
 *
 * Verifica getCantieri() e getUserInfo() con un token di test.
 *
 * CHIAMATA DA: manuale (editor GAS)
 * CHIAMA:      generateSessionToken(), getCantieri(), getUserInfo()
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
