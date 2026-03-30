/**
 * test_config.gs - Test manuali per il modulo Config.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica della configurazione di sistema.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): Config.gs
 */

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
