/**
 * test_reportcommercialista.gs - Test manuali per il modulo ReportCommercialista.gs
 *
 * Funzioni di test da eseguire manualmente dall'editor Google Apps Script
 * a scopo diagnostico e di verifica del sistema di report.
 * NON vengono chiamate in produzione.
 *
 * Dipende da (scope globale GAS): ReportCommercialista.gs, UtilsMenu.gs
 */

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
 * CHIAMATA DA: onOpen() → menu "Report Commercialista" → "Test report"
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
