/**
 * test_sheetsDAO.gs - Test manuali per il modulo SheetsDAO.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica del data access layer.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): SheetsDAO.gs, Utils.gs
 */

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
