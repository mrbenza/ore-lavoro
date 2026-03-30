/**
 * test_archivioore.gs - Test manuali per il modulo ArchivioOre.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica dell'archiviazione ore.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): ArchivioOre.gs, UtilsMenu.gs, Config.gs
 */

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
