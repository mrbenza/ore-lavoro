/**
 * test_adminapi.gs - Test manuali per il modulo AdminAPI.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica delle API amministratore.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): AdminAPI.gs, Utils.gs
 */

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
    console.log('TEST PASSED - Registrazione eliminata');
  } else {
    console.log('TEST FAILED - ' + result.message);
  }
}
