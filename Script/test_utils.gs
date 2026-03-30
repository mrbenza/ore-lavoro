/**
 * test_utils.gs - Test manuali per il modulo Utils.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica delle funzioni utility.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): Utils.gs
 */

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
