/**
 * test_userapi.gs - Test manuali per il modulo UserAPI.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica delle API utente.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): UserAPI.gs, Utils.gs
 */

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
