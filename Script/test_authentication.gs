/**
 * test_authentication.gs - Test manuali per il modulo Authentication.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica dell'autenticazione.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): Authentication.gs, Utils.gs
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
