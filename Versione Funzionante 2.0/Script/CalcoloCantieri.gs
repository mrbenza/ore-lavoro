/**
 * CalcoloCantieri.gs — Ricalcolo Totali Ore e Verifica Allineamento Dati Cantieri
 *
 * Fornisce due operazioni distinte accessibili dal menu Sheets:
 *   1. Ricalcolo totali: ricalcola le ore cumulative di ogni cantiere nel foglio
 *      Cantieri scansionando tutti i fogli dipendente (colonna ORE_TOTALI, indice 6).
 *      Sovrascrive i valori esistenti con i valori calcolati dai dati reali.
 *   2. Verifica allineamento: audit read-only che confronta i totali dichiarati
 *      nel foglio Cantieri con quelli calcolati dai fogli dipendente,
 *      identificando inconsistenze, ore orfane e cantieri mancanti.
 *
 * Ottimizzazione chiave: loadAllEmployeeData() carica in memoria tutti i fogli
 * dipendente in un'unica operazione batch, riducendo le chiamate API Sheets.
 *
 * USATO DA: Main.gs → onOpen() (menu "Gestione Cantieri")
 * DIPENDE DA: UtilsMenu.gs (getActiveEmployeeNames, getDataRange, debugLog, showErrorMessage)
 *             Config.gs (getMainSpreadsheet, SHEET_NAMES, CONFIG.DATA_STRUCTURE)
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT MENU — funzioni chiamate direttamente dal menu Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avvia il ricalcolo immediato dei totali cantieri senza dialog iniziale.
 *
 * Progettata per essere più veloce della versione con dialog di conferma:
 * esegue il ricalcolo subito e poi mostra i risultati. In caso di errore
 * generico mostra un alert senza dettagli tecnici (errori già loggati
 * internamente da performConstructionSitesRecalculation).
 *
 * FLUSSO INTERNO:
 *   1. performConstructionSitesRecalculation() → result
 *   2. Se result.success → showSimpleRecalculationResults(result)
 *   3. Altrimenti → alert errore generico
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Cantieri")
 * CHIAMA:      performConstructionSitesRecalculation(), showSimpleRecalculationResults(),
 *              SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function executeRecalculateConstructionSites() {
  // NESSUN DIALOG INIZIALE - Parte subito senza loading!

  try {
    // Esegue il ricalcolo direttamente
    const result = performConstructionSitesRecalculation();

    if (result.success) {
      showSimpleRecalculationResults(result);
    } else {
      SpreadsheetApp.getUi().alert('Errore\n\nImpossibile completare il ricalcolo. Contatta l\'amministratore.');
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('Errore\n\nQualcosa e\' andato storto. Contatta l\'amministratore.');
  }
}

/**
 * Mostra i risultati del ricalcolo cantieri con dettaglio delle correzioni.
 *
 * Formatta due messaggi diversi in base al numero di correzioni:
 *   - 0 correzioni: messaggio positivo "tutto perfetto"
 *   - N correzioni: lista dei cantieri corretti con vecchio/nuovo totale e delta
 *     (limitata ai primi 10 cantieri se le correzioni sono più di 10)
 *
 * CHIAMATA DA: executeRecalculateConstructionSites()
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {{
 *   corrections: Array<{ id: string, name: string, oldTotal: number, newTotal: number, difference: number }>,
 *   constructionSitesUpdated: number,
 *   employeesProcessed: number
 * }} result - Risultato di performConstructionSitesRecalculation().
 * @returns {void}
 */
function showSimpleRecalculationResults(result) {
  let message;
  let title;

  if (result.corrections.length === 0) {
    // TUTTO OK - Focus positivo
    title = 'Ricalcolo Completato';
    message = `Tutto perfetto!\n\n` +
             `Cantieri controllati: ${result.constructionSitesUpdated}\n` +
             `Dipendenti processati: ${result.employeesProcessed}\n\n` +
             `Tutti i totali erano gia\' corretti.`;
  } else {
    // CORREZIONI EFFETTUATE - Con dettagli cantieri
    title = 'Ricalcolo Completato';
    message = `Operazione completata!\n\n` +
             `Correzioni effettuate: ${result.corrections.length}\n` +
             `Cantieri controllati: ${result.constructionSitesUpdated}\n` +
             `Dipendenti processati: ${result.employeesProcessed}\n\n` +
             `CANTIERI CORRETTI:\n`;

    // Mostra tutti i cantieri corretti (solo nome, senza ID)
    result.corrections.forEach((corr, index) => {
      const sign = corr.difference >= 0 ? '+' : '';
      message += `${index + 1}. ${corr.name}\n`;
      message += `   ${corr.oldTotal}h → ${corr.newTotal}h (${sign}${corr.difference.toFixed(1)}h)\n\n`;
    });

    // Limita se sono troppi (max 10)
    if (result.corrections.length > 10) {
      const first10 = result.corrections.slice(0, 10);
      message = `Operazione completata!\n\n` +
               `Correzioni effettuate: ${result.corrections.length}\n` +
               `Cantieri controllati: ${result.constructionSitesUpdated}\n` +
               `Dipendenti processati: ${result.employeesProcessed}\n\n` +
               `CANTIERI CORRETTI (primi 10):\n`;

      first10.forEach((corr, index) => {
        const sign = corr.difference >= 0 ? '+' : '';
        message += `${index + 1}. ${corr.name}\n`;
        message += `   ${corr.oldTotal}h → ${corr.newTotal}h (${sign}${corr.difference.toFixed(1)}h)\n\n`;
      });

      message += `... e altri ${result.corrections.length - 10} cantieri corretti`;
    }
  }

  SpreadsheetApp.getUi().alert(title + '\n\n' + message);
}

/**
 * Avvia la verifica dell'allineamento dati tra fogli dipendente e foglio Cantieri.
 *
 * Esegue un audit read-only (non modifica dati) e mostra i risultati.
 * In caso di errore mostra un alert generico senza dettagli tecnici.
 *
 * FLUSSO INTERNO:
 *   1. performDataAlignmentVerification() → verification
 *   2. showDetailedAlignmentResults(verification)
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Cantieri")
 * CHIAMA:      performDataAlignmentVerification(), showDetailedAlignmentResults(),
 *              SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function executeVerifyDataAlignment() {
  try {
    // Avvio immediato anche qui
    const verification = performDataAlignmentVerification();
    showDetailedAlignmentResults(verification);
  } catch (error) {
    SpreadsheetApp.getUi().alert('Errore\n\nImpossibile verificare l\'allineamento. Contatta l\'amministratore.');
  }
}

/**
 * Mostra i risultati della verifica allineamento con focus sui problemi rilevati.
 *
 * Formatta due messaggi:
 *   - 0 problemi: messaggio positivo con statistiche generali
 *   - N problemi: categorizza inconsistenze, cantieri mancanti e ore orfane,
 *     suggerisce soluzioni specifiche per ogni tipo di problema
 *
 * CHIAMATA DA: executeVerifyDataAlignment()
 * CHIAMA:      formatNumberItalian() (UtilsMenu.gs), SpreadsheetApp.getUi()
 *
 * @param {{
 *   success: boolean,
 *   employeesAnalyzed: number,
 *   constructionSitesAnalyzed: number,
 *   inconsistencies: Array<{ name: string, declared: number, actual: number }>,
 *   missingConstructionSites: Array<{ siteId: string, siteName?: string, totalHours: number }>,
 *   orphanedHours: Array<*>,
 *   totalHoursEmployee: number
 * }} result - Risultato di performDataAlignmentVerification().
 * @returns {void}
 */
function showDetailedAlignmentResults(result) {
  if (!result.success) {
    SpreadsheetApp.getUi().alert('Errore\n\nVerifica fallita. Contatta l\'amministratore.');
    return;
  }

  const totalProblems = result.inconsistencies.length + result.missingConstructionSites.length + result.orphanedHours.length;

  let title, message;

  if (totalProblems === 0) {
    // TUTTO PERFETTO - Focus positivo
    title = 'Verifica Completata - Tutto Perfetto!';
    message = `I dati sono perfettamente allineati!\n\n` +
             `Dipendenti analizzati: ${result.employeesAnalyzed}\n` +
             `Cantieri nel sistema: ${result.constructionSitesAnalyzed}\n` +
             `Ore totali: ${formatNumberItalian(result.totalHoursEmployee)}\n\n` +
             `Nessun problema rilevato.`;
  } else {
    // PROBLEMI TROVATI - Ma focus costruttivo
    title = `Verifica Completata - ${totalProblems} Problemi`;
    message = `ANALISI COMPLETATA\n\n` +
             `Dipendenti: ${result.employeesAnalyzed}\n` +
             `Cantieri: ${result.constructionSitesAnalyzed}\n` +
             `Ore totali: ${formatNumberItalian(result.totalHoursEmployee)}\n\n` +
             `PROBLEMI RILEVATI:\n`;

    if (result.inconsistencies.length > 0) {
      message += `Totali da correggere: ${result.inconsistencies.length}\n`;
      result.inconsistencies.slice(0, 3).forEach((inc) => {
        message += `  - ${inc.name}: ${inc.declared}h → ${inc.actual}h\n`;
      });
      if (result.inconsistencies.length > 3) {
        message += `  - ... e altri ${result.inconsistencies.length - 3}\n`;
      }
      message += '\n';
    }

    if (result.missingConstructionSites.length > 0) {
      message += `Cantieri mancanti: ${result.missingConstructionSites.length}\n`;
      result.missingConstructionSites.slice(0, 2).forEach((site) => {
        // Cerca il nome del cantiere dall'ID se possibile
        const displayName = site.siteName || site.siteId;
        message += `  - ${displayName} (${formatNumberItalian(site.totalHours)}h)\n`;
      });
      message += '\n';
    }

    if (result.orphanedHours.length > 0) {
      message += `Ore su cantieri inesistenti: ${result.orphanedHours.length}\n\n`;
    }

    message += `SOLUZIONE:\n`;
    if (result.inconsistencies.length > 0) {
      message += `- Usa "Ricalcola Totali" per correggere\n`;
    }
    if (result.missingConstructionSites.length > 0) {
      message += `- Aggiungi cantieri mancanti\n`;
    }
    if (result.orphanedHours.length > 0) {
      message += `- Correggi riferimenti cantieri inesistenti`;
    }
  }

  SpreadsheetApp.getUi().alert(title + '\n\n' + message);
}

/**
 * Mostra istruzioni operative per l'uso del sistema cantieri.
 *
 * Testo statico con guida step-by-step per: aggiornamento totali dopo
 * modifiche ai fogli dipendente, procedura di test e frequenza consigliata
 * dei controlli. Utile come riferimento rapido dall'interno di Sheets.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Cantieri")
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function displayConstructionSiteInstructions() {
  const instructions =
    `COME USARE IL SISTEMA CANTIERI\n\n` +

    `PROBLEMA COMUNE:\n` +
    `Quando cambi il cantiere di un dipendente, i totali non si aggiornano automaticamente.\n\n` +

    `SOLUZIONE SEMPLICE:\n` +
    `1. Modifica il cantiere nel foglio dipendente\n` +
    `2. Vai su "Gestione Cantieri"\n` +
    `3. Clicca "Ricalcola totali ore cantieri"\n` +
    `4. Aspetta qualche secondo\n` +
    `5. Controlla il risultato\n\n` +

    `COME TESTARE:\n` +
    `- Prendi nota del totale di un cantiere\n` +
    `- Cambia un cantiere di un dipendente\n` +
    `- Usa "Ricalcola totali"\n` +
    `- Verifica che i totali siano corretti\n\n` +

    `CONTROLLI PERIODICI:\n` +
    `- Usa "Verifica allineamento" ogni settimana\n` +
    `- Ricalcola dopo modifiche importanti\n` +
    `- Tieni sempre un backup\n\n` +

    `TEMPI:\n` +
    `- Ricalcolo: 2-10 secondi\n` +
    `- Verifica: 5-15 secondi\n` +
    `- Funziona con qualsiasi numero di dipendenti`;

  SpreadsheetApp.getUi().alert('Guida Sistema Cantieri\n\n' + instructions);
}

// ─────────────────────────────────────────────────────────────────────────────
// RICALCOLO TOTALI — logica di ricalcolo ore per cantiere
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esegue il ricalcolo completo dei totali ore per ogni cantiere nel foglio Cantieri.
 *
 * Strategia ottimizzata: carica tutti i fogli dipendente in memoria una sola
 * volta (loadAllEmployeeData), poi per ogni cantiere calcola il totale
 * reale con calculateSiteTotalFromData() e aggiorna la cella ORE_TOTALI
 * (colonna G, indice 6) solo se il valore differisce di oltre 0.01h.
 *
 * FLUSSO INTERNO:
 *   1. getMainSpreadsheet() → spreadsheet principale
 *   2. getSheetSafe() → foglio Cantieri
 *   3. getActiveEmployeeNames() → lista fogli dipendente
 *   4. loadAllEmployeeData() → carica tutti i dati in memoria
 *   5. Per ogni riga del foglio Cantieri:
 *      a. calculateSiteTotalFromData(siteId, allEmployeeData) → newTotal
 *      b. Se |currentTotal - newTotal| > 0.01 → setRange(i+1, 7).setValue(newTotal)
 *      c. Accumula in result.corrections
 *   6. Restituisce result con statistiche e lista correzioni
 *
 * CHIAMATA DA: executeRecalculateConstructionSites()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getActiveEmployeeNames() (UtilsMenu.gs), loadAllEmployeeData(),
 *              calculateSiteTotalFromData(), debugLog() (UtilsMenu.gs)
 *
 * @returns {{
 *   success: boolean,
 *   executionTime: string,
 *   employeesProcessed: number,
 *   constructionSitesUpdated: number,
 *   corrections: Array<{ id: string, name: string, oldTotal: number, newTotal: number, difference: number }>,
 *   error: string|null
 * }} Risultato ricalcolo.
 */
function performConstructionSitesRecalculation() {
  const startTime = new Date();
  const result = {
    success: false,
    executionTime: 0,
    employeesProcessed: 0,
    constructionSitesUpdated: 0,
    corrections: [],
    error: null
  };

  try {
    debugLog('Inizio ricalcolo totali cantieri');

    const spreadsheet = getMainSpreadsheet();
    const constructionSitesSheet = getSheetSafe(spreadsheet, SHEET_NAMES.CANTIERI);
    const employeeNames = getActiveEmployeeNames();

    if (employeeNames.length === 0) {
      throw new Error('Nessun dipendente attivo trovato');
    }

    const allEmployeeData = loadAllEmployeeData(employeeNames, spreadsheet);
    result.employeesProcessed = Object.keys(allEmployeeData).length;

    const constructionSitesData = constructionSitesSheet.getDataRange().getValues();

    for (let i = 1; i < constructionSitesData.length; i++) {
      const row = constructionSitesData[i];
      const siteId = row[0];
      const siteName = row[1] || siteId;
      const currentTotal = parseFloat(row[6]) || 0;

      if (!siteId) continue;

      const newTotal = calculateSiteTotalFromData(siteId, allEmployeeData);

      if (Math.abs(currentTotal - newTotal) > 0.01) {
        constructionSitesSheet.getRange(i + 1, 7).setValue(newTotal);

        result.corrections.push({
          id: siteId,
          name: siteName,
          oldTotal: currentTotal,
          newTotal: newTotal,
          difference: newTotal - currentTotal
        });
      }

      result.constructionSitesUpdated++;
    }

    const endTime = new Date();
    result.executionTime = ((endTime - startTime) / 1000).toFixed(1);
    result.success = true;

    debugLog('Ricalcolo completato', {
      executionTime: result.executionTime,
      corrections: result.corrections.length,
      employeesProcessed: result.employeesProcessed
    });

  } catch (error) {
    console.error('Errore nel ricalcolo cantieri:', error);
    result.error = error.message;
  }

  return result;
}

/**
 * Carica in memoria i dati di tutti i fogli dipendente per ottimizzare il ricalcolo.
 *
 * Per ogni dipendente, apre il foglio e legge il range dati (dalla riga 5)
 * con getDataRange(). I dati vengono accumulati in un oggetto con chiave
 * uguale al nome dipendente. I fogli non trovati o che causano errori vengono
 * saltati con un warning (fail-soft).
 *
 * PATTERN DI OTTIMIZZAZIONE: centralizzare qui le letture Sheets evita
 * N chiamate API (una per cantiere per dipendente) riducendole a 1 per dipendente.
 *
 * CHIAMATA DA: performConstructionSitesRecalculation()
 * CHIAMA:      getDataRange() (UtilsMenu.gs), debugLog() (UtilsMenu.gs)
 *
 * @param {string[]}                                 employeeNames - Lista nomi dipendenti.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet   - Spreadsheet principale.
 * @returns {Object.<string, Array[]>} Mappa {nomeDipendente: righe dati getValues()}.
 */
function loadAllEmployeeData(employeeNames, spreadsheet) {
  const allData = {};

  employeeNames.forEach(employeeName => {
    try {
      const employeeSheet = spreadsheet.getSheetByName(employeeName);
      if (!employeeSheet) return;

      const dataRange = getDataRange(employeeSheet);
      if (!dataRange) return;

      allData[employeeName] = dataRange.getValues();

    } catch (error) {
      console.warn(`Impossibile caricare dati per ${employeeName}:`, error);
    }
  });

  debugLog(`Caricati dati per ${Object.keys(allData).length} dipendenti`);
  return allData;
}

/**
 * Calcola il totale ore di un cantiere dai dati in memoria di tutti i dipendenti.
 *
 * Itera su tutti i dipendenti e tutte le righe dati, confronta CANTIERE_ID
 * (colonna CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID) con siteId e somma
 * le ore (CONFIG.DATA_STRUCTURE.COLUMNS.ORE). Il risultato è arrotondato
 * a 1 decimale per coerenza con i valori esistenti nel foglio Cantieri.
 *
 * CHIAMATA DA: performConstructionSitesRecalculation()
 * CHIAMA:      CONFIG.DATA_STRUCTURE.COLUMNS
 *
 * @param {string}                  siteId          - ID del cantiere da calcolare.
 * @param {Object.<string, Array[]>} allEmployeeData - Output di loadAllEmployeeData().
 * @returns {number} Totale ore arrotondato a 1 decimale.
 *
 * @example
 * const total = calculateSiteTotalFromData('C001', allData);
 * // → 47.5
 */
function calculateSiteTotalFromData(siteId, allEmployeeData) {
  let totalHours = 0;

  Object.keys(allEmployeeData).forEach(employeeName => {
    const employeeData = allEmployeeData[employeeName];

    employeeData.forEach(row => {
      const rowSiteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID];
      const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;

      if (rowSiteId === siteId && hours > 0) {
        totalHours += hours;
      }
    });
  });

  return Math.round(totalHours * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICA ALLINEAMENTO — audit read-only dei dati cantieri vs dipendenti
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esegue una verifica completa dell'allineamento tra fogli dipendente e foglio Cantieri.
 *
 * Operazione read-only (non scrive nessun dato). Confronta i totali dichiarati
 * nel foglio Cantieri con quelli reali calcolati dai fogli dipendente, e
 * identifica tre categorie di problemi:
 *   - inconsistencies: cantieri con totale dichiarato != totale reale (diff > 0.01h)
 *   - orphanedHours: ore nei fogli dipendente che referenziano cantieri non esistenti nel foglio Cantieri
 *   - missingConstructionSites: cantieri referenziati dai dipendenti ma assenti dal foglio Cantieri
 *
 * FLUSSO INTERNO:
 *   1. getMainSpreadsheet() → spreadsheet principale
 *   2. getSheetSafe() → foglio Cantieri → popola existingSites Map
 *   3. getActiveEmployeeNames() → lista dipendenti
 *   4. Per ogni dipendente: legge righe dati, aggrega ore per siteId in referencedSites
 *      e aggiorna actualTotal in existingSites; se siteId assente → orphanedHours
 *   5. Confronta existingSites (declared vs actual) → inconsistencies
 *   6. Confronta referencedSites vs existingSites → missingConstructionSites
 *   7. Restituisce oggetto result completo
 *
 * CHIAMATA DA: executeVerifyDataAlignment()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getActiveEmployeeNames() (UtilsMenu.gs), getDataRange() (UtilsMenu.gs),
 *              debugLog() (UtilsMenu.gs), CONFIG.DATA_STRUCTURE
 *
 * @returns {{
 *   success: boolean,
 *   employeesAnalyzed: number,
 *   constructionSitesAnalyzed: number,
 *   inconsistencies: Array<{ siteId: string, name: string, declared: number, actual: number, difference: number }>,
 *   orphanedHours: Array<{ siteId: string, employee: string, hours: number, rowIndex: number }>,
 *   missingConstructionSites: Array<{ siteId: string, totalHours: number, employees: string[] }>,
 *   totalHoursEmployee: number,
 *   totalHoursConstructionSites: number,
 *   error: string|null
 * }} Risultato verifica.
 */
function performDataAlignmentVerification() {
  const result = {
    success: false,
    employeesAnalyzed: 0,
    constructionSitesAnalyzed: 0,
    inconsistencies: [],
    orphanedHours: [],
    missingConstructionSites: [],
    totalHoursEmployee: 0,
    totalHoursConstructionSites: 0,
    error: null
  };

  try {
    debugLog('Inizio verifica allineamento dati');

    const spreadsheet = getMainSpreadsheet();
    const constructionSitesSheet = getSheetSafe(spreadsheet, SHEET_NAMES.CANTIERI);

    const constructionSitesData = constructionSitesSheet.getDataRange().getValues();
    const existingSites = new Map();

    for (let i = 1; i < constructionSitesData.length; i++) {
      const siteId = constructionSitesData[i][0];
      const siteName = constructionSitesData[i][1] || siteId;
      const currentTotal = parseFloat(constructionSitesData[i][6]) || 0;

      if (siteId) {
        existingSites.set(siteId, {
          name: siteName,
          declaredTotal: currentTotal,
          actualTotal: 0
        });
      }
    }

    result.constructionSitesAnalyzed = existingSites.size;

    const employeeNames = getActiveEmployeeNames();
    const referencedSites = new Map();

    employeeNames.forEach(employeeName => {
      try {
        const employeeSheet = spreadsheet.getSheetByName(employeeName);
        if (!employeeSheet) return;

        const dataRange = getDataRange(employeeSheet);
        if (!dataRange) return;

        const employeeData = dataRange.getValues();
        let employeeHours = 0;

        employeeData.forEach((row, rowIndex) => {
          const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID];
          const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;

          if (siteId && hours > 0) {
            employeeHours += hours;

            if (!referencedSites.has(siteId)) {
              referencedSites.set(siteId, { totalHours: 0, employees: [] });
            }

            referencedSites.get(siteId).totalHours += hours;
            if (!referencedSites.get(siteId).employees.includes(employeeName)) {
              referencedSites.get(siteId).employees.push(employeeName);
            }

            if (existingSites.has(siteId)) {
              existingSites.get(siteId).actualTotal += hours;
            } else {
              result.orphanedHours.push({
                siteId: siteId,
                employee: employeeName,
                hours: hours,
                rowIndex: rowIndex + CONFIG.DATA_STRUCTURE.HEADER_ROWS + 1
              });
            }
          }
        });

        result.totalHoursEmployee += employeeHours;
        result.employeesAnalyzed++;

      } catch (error) {
        console.warn(`Errore analisi ${employeeName}:`, error);
      }
    });

    existingSites.forEach((siteData, siteId) => {
      const difference = Math.abs(siteData.declaredTotal - siteData.actualTotal);

      if (difference > 0.01) {
        result.inconsistencies.push({
          siteId: siteId,
          name: siteData.name,
          declared: siteData.declaredTotal,
          actual: siteData.actualTotal,
          difference: difference
        });
      }

      result.totalHoursConstructionSites += siteData.declaredTotal;
    });

    referencedSites.forEach((siteData, siteId) => {
      if (!existingSites.has(siteId)) {
        result.missingConstructionSites.push({
          siteId: siteId,
          totalHours: siteData.totalHours,
          employees: siteData.employees
        });
      }
    });

    result.success = true;
    debugLog('Verifica allineamento completata', result);

  } catch (error) {
    console.error('Errore verifica allineamento:', error);
    result.error = error.message;
  }

  return result;
}
