/**
 * ArchivioOre.gs — Archiviazione Annuale Ore Lavorate su Google Drive
 *
 * Gestisce il processo completo di archiviazione storica delle ore lavorate
 * per ogni dipendente. Per ogni dipendente archivato:
 *   - Crea uno spreadsheet temporaneo con copia formattata del foglio
 *   - Esporta il file in formato Excel (.xlsx) e PDF su Google Drive
 *   - Rimuove le righe dell'anno archiviato dal foglio originale
 *   - Sposta gli export nella cartella Drive dell'anno corrispondente
 *
 * La cartella di destinazione è CONFIG.FOLDERS.ARCHIVE su Google Drive.
 * L'anno di default è CONFIG.DATES.DEFAULT_ARCHIVE_YEAR (anno precedente).
 *
 * USATO DA: Main.gs → onOpen() (menu "Archivio Ore")
 * DIPENDE DA: UtilsMenu.gs (helper UI, Drive, filtri)
 *             Config.gs (CONFIG, SHEET_NAMES, ERROR_MESSAGES)
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT MENU — funzioni chiamate direttamente dal menu Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avvia l'archiviazione di tutti i dipendenti per l'anno precedente.
 *
 * Legge CONFIG.DATES.DEFAULT_ARCHIVE_YEAR (anno corrente - 1) e, dopo
 * conferma utente, delega a executeArchiveMultipleEmployees().
 *
 * FLUSSO INTERNO:
 *   1. Determina l'anno da archiviare (DEFAULT_ARCHIVE_YEAR)
 *   2. Mostra dialog di conferma YES/NO
 *   3. Se YES → executeArchiveMultipleEmployees(year)
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets)
 * CHIAMA:      showConfirmDialog() (UtilsMenu.gs), executeArchiveMultipleEmployees()
 *
 * @returns {void}
 */
function executeArchiveAllPreviousYear() {
  const year = CONFIG.DATES.DEFAULT_ARCHIVE_YEAR;
  const message = `Confermi l'archiviazione di TUTTI i dipendenti per l'anno ${year}?\n\nVerranno creati file Excel e PDF per ogni dipendente.`;

  if (showConfirmDialog('Conferma Archiviazione', message)) {
    executeArchiveMultipleEmployees(year);
  }
}

/**
 * Avvia l'archiviazione di un singolo dipendente tramite dialog di selezione.
 *
 * Recupera la lista dei dipendenti attivi e mostra il dialog HTML
 * con selettore dipendente e campo anno. Se non ci sono dipendenti
 * mostra un messaggio di errore.
 *
 * FLUSSO INTERNO:
 *   1. getActiveEmployeeNames() → lista dipendenti
 *   2. Se vuota → showErrorMessage(NO_EMPLOYEES)
 *   3. showArchiveEmployeeDialog(employees)
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets)
 * CHIAMA:      getActiveEmployeeNames() (UtilsMenu.gs), showArchiveEmployeeDialog(),
 *              showErrorMessage() (UtilsMenu.gs), ERROR_MESSAGES.NO_EMPLOYEES
 *
 * @returns {void}
 */
function executeArchiveSingleEmployee() {
  const employees = getActiveEmployeeNames();

  if (employees.length === 0) {
    showErrorMessage(ERROR_MESSAGES.NO_EMPLOYEES);
    return;
  }

  showArchiveEmployeeDialog(employees);
}

/**
 * Avvia l'archiviazione di tutti i dipendenti per un anno scelto dall'utente.
 *
 * Mostra un dialog di input testo per inserire l'anno, lo valida con
 * validateYear() e poi chiede conferma prima di procedere con l'archiviazione
 * multipla.
 *
 * FLUSSO INTERNO:
 *   1. showInputDialog() → input anno
 *   2. Se annullato → return
 *   3. validateYear(yearInput) → se non valido → showErrorMessage
 *   4. showConfirmDialog() → se YES → executeArchiveMultipleEmployees(year)
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets)
 * CHIAMA:      showInputDialog(), validateYear(), showConfirmDialog(),
 *              showErrorMessage(), executeArchiveMultipleEmployees()
 *              Tutte in UtilsMenu.gs / Config.gs
 *
 * @returns {void}
 */
function executeArchiveWithCustomYear() {
  const yearInput = showInputDialog(
    'Selezione Anno',
    `Inserisci l'anno da archiviare (${CONFIG.VALIDATION.MIN_YEAR}-${CONFIG.VALIDATION.MAX_YEAR}):`,
    CONFIG.DATES.DEFAULT_ARCHIVE_YEAR.toString()
  );

  if (!yearInput) return;

  const yearValidation = validateYear(yearInput);
  if (!yearValidation.valid) {
    showErrorMessage(yearValidation.error);
    return;
  }

  const year = yearValidation.value;
  const message = `Confermi l'archiviazione di TUTTI i dipendenti per l'anno ${year}?`;

  if (showConfirmDialog('Conferma Archiviazione', message)) {
    executeArchiveMultipleEmployees(year);
  }
}

/**
 * Mostra lo stato degli archivi Drive: anni archiviati e numero di file per anno.
 *
 * Accede alla cartella CONFIG.FOLDERS.ARCHIVE, elenca le sottocartelle con
 * nome numerico (es. "2024"), conta i file in ognuna e mostra un riepilogo
 * testuale tramite alert UI. Le cartelle vengono ordinate per anno decrescente.
 *
 * FLUSSO INTERNO:
 *   1. findOrCreateFolder(CONFIG.FOLDERS.ARCHIVE) → cartella base
 *   2. Itera sottocartelle filtrando per nome numerico a 4 cifre
 *   3. countFilesInFolder() per ogni sottocartella
 *   4. showSuccessMessage() con riepilogo
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets)
 * CHIAMA:      findOrCreateFolder() (UtilsMenu.gs), countFilesInFolder(),
 *              showSuccessMessage(), showErrorMessage() (UtilsMenu.gs)
 *
 * @returns {void}
 */
function displayArchiveStatus() {
  try {
    const archiveFolder = findOrCreateFolder(CONFIG.FOLDERS.ARCHIVE);
    const yearFolders = [];
    const folderIterator = archiveFolder.getFolders();

    while (folderIterator.hasNext()) {
      const folder = folderIterator.next();
      const folderName = folder.getName();

      if (/^\d{4}$/.test(folderName)) {
        const fileCount = countFilesInFolder(folder);
        yearFolders.push({
          year: parseInt(folderName),
          fileCount: fileCount,
          url: folder.getUrl()
        });
      }
    }

    yearFolders.sort((a, b) => b.year - a.year);

    let statusMessage = 'STATO ARCHIVI ORE LAVORATE\n\n';
    statusMessage += `Cartella principale: ${archiveFolder.getName()}\n`;
    statusMessage += `Anni archiviati: ${yearFolders.length}\n\n`;

    if (yearFolders.length > 0) {
      statusMessage += 'DETTAGLIO PER ANNO:\n';
      yearFolders.forEach(folder => {
        statusMessage += `${folder.year}: ${folder.fileCount} file archiviati\n`;
      });
    } else {
      statusMessage += 'Nessun archivio presente.';
    }

    showSuccessMessage(statusMessage);

  } catch (error) {
    showErrorMessage('Impossibile leggere stato archivi', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIALOG — interfaccia HTML per selezione singolo dipendente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra il dialog HTML modale per la selezione del dipendente da archiviare.
 *
 * Genera un HtmlOutput con un form che contiene: selettore dipendente (lista
 * passata come parametro), input anno con min/max da CONFIG, pulsanti
 * "Archivia" e "Annulla". Al click "Archivia" invoca via google.script.run
 * la funzione executeSingleEmployeeArchive(employee, year).
 * Il feedback di stato viene mostrato inline nel dialog senza chiuderlo.
 *
 * CHIAMATA DA: executeArchiveSingleEmployee()
 * CHIAMA:      (google.script.run → executeSingleEmployeeArchive — lato client)
 *
 * @param {string[]} employees - Lista nomi dipendenti da mostrare nel selettore.
 * @returns {void}
 */
function showArchiveEmployeeDialog(employees) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h3>Archivia Singolo Dipendente</h3>

      <div style="margin: 15px 0;">
        <label><strong>Dipendente:</strong></label>
        <select id="employee" style="width: 100%; padding: 8px; margin-top: 5px;">
          ${employees.map(emp => `<option value="${emp}">${emp}</option>`).join('')}
        </select>
      </div>

      <div style="margin: 15px 0;">
        <label><strong>Anno:</strong></label>
        <input type="number" id="year" value="${CONFIG.DATES.DEFAULT_ARCHIVE_YEAR}"
               min="${CONFIG.VALIDATION.MIN_YEAR}" max="${CONFIG.VALIDATION.MAX_YEAR}"
               style="width: 100%; padding: 8px; margin-top: 5px;">
      </div>

      <div style="background: #f0f8ff; padding: 10px; border-radius: 5px; margin: 15px 0;">
        <small>I file saranno salvati nella cartella "${CONFIG.FOLDERS.ARCHIVE}" su Google Drive</small>
      </div>

      <div style="margin-top: 20px;">
        <button onclick="executeArchive()"
                style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
          Archivia
        </button>
        <button onclick="google.script.host.close()"
                style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin-left: 10px; cursor: pointer;">
          Annulla
        </button>
      </div>

      <div id="status" style="margin-top: 15px; font-weight: bold;"></div>
    </div>

    <script>
      function executeArchive() {
        const employee = document.getElementById('employee').value;
        const year = parseInt(document.getElementById('year').value);

        if (!employee) {
          alert('Seleziona un dipendente');
          return;
        }

        if (isNaN(year)) {
          alert('Anno non valido');
          return;
        }

        const btn = document.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = 'Archiviazione...';

        document.getElementById('status').innerHTML = 'Archiviazione in corso...';
        document.getElementById('status').style.color = '#007bff';

        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              document.getElementById('status').innerHTML =
                'Archiviazione completata!<br>' +
                'Righe archiviate: ' + result.dataRows + '<br>' +
                'Ore totali: ' + result.totalHours;
              document.getElementById('status').style.color = '#28a745';
            } else {
              document.getElementById('status').innerHTML = (result.error || 'Errore sconosciuto');
              document.getElementById('status').style.color = '#dc3545';
            }

            btn.disabled = false;
            btn.innerHTML = 'Archivia';
          })
          .withFailureHandler(function(error) {
            document.getElementById('status').innerHTML = 'Errore: ' + error.message;
            document.getElementById('status').style.color = '#dc3545';

            btn.disabled = false;
            btn.innerHTML = 'Archivia';
          })
          .executeSingleEmployeeArchive(employee, year);
      }
    </script>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(450)
    .setHeight(400);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Archivia Dipendente');
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATORI — coordinamento archiviazione singola e multipla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esegue l'archiviazione di un singolo dipendente e mostra il risultato.
 *
 * Chiamata da google.script.run nel dialog HTML (showArchiveEmployeeDialog).
 * Delega l'archiviazione effettiva a performEmployeeArchive() e, in caso di
 * successo, mostra un riepilogo testuale con showSuccessMessage().
 * Restituisce sempre l'oggetto result per il client-side handler.
 *
 * FLUSSO INTERNO:
 *   1. performEmployeeArchive(employeeName, year) → result
 *   2. Se result.success → showSuccessMessage() con riepilogo
 *   3. Restituisce result al chiamante (google.script.run callback)
 *
 * CHIAMATA DA: showArchiveEmployeeDialog() → google.script.run.executeSingleEmployeeArchive()
 * CHIAMA:      performEmployeeArchive(), showSuccessMessage() (UtilsMenu.gs)
 *
 * @param {string} employeeName - Nome completo del dipendente (= nome foglio).
 * @param {number} year         - Anno da archiviare.
 * @returns {{ success: boolean, dataRows: number, totalHours: number, error?: string }}
 */
function executeSingleEmployeeArchive(employeeName, year) {
  try {
    const result = performEmployeeArchive(employeeName, year);

    if (result.success) {
      const message = `Archiviazione completata per ${employeeName}\n\n` +
        `Anno: ${year}\n` +
        `Righe archiviate: ${result.dataRows}\n` +
        `Ore totali: ${result.totalHours}\n\n` +
        `File salvati in: ${CONFIG.FOLDERS.ARCHIVE}/${year}/`;

      showSuccessMessage(message);
    }

    return result;

  } catch (error) {
    console.error('Errore archiviazione singola:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Esegue l'archiviazione di tutti i dipendenti attivi per un anno.
 *
 * Itera su tutti i dipendenti restituiti da getActiveEmployeeNames(), chiama
 * performEmployeeArchive() per ognuno, accumula i risultati e infine mostra
 * il riepilogo con showArchiveMultipleResults(). Gli errori su singoli
 * dipendenti non bloccano gli altri (fail-soft).
 *
 * FLUSSO INTERNO:
 *   1. getActiveEmployeeNames() → lista dipendenti
 *   2. Se vuota → showErrorMessage(NO_EMPLOYEES)
 *   3. Per ogni dipendente: performEmployeeArchive() → accumula in results
 *   4. showArchiveMultipleResults(results)
 *
 * CHIAMATA DA: executeArchiveAllPreviousYear(), executeArchiveWithCustomYear()
 * CHIAMA:      getActiveEmployeeNames() (UtilsMenu.gs), performEmployeeArchive(),
 *              showArchiveMultipleResults(), showErrorMessage() (UtilsMenu.gs)
 *
 * @param {number} year - Anno da archiviare.
 * @returns {void}
 */
function executeArchiveMultipleEmployees(year) {
  const employees = getActiveEmployeeNames();

  if (employees.length === 0) {
    showErrorMessage(ERROR_MESSAGES.NO_EMPLOYEES);
    return;
  }

  const results = {
    year: year,
    total: employees.length,
    successful: 0,
    failed: 0,
    details: [],
    totalHours: 0
  };

  employees.forEach(employeeName => {
    try {
      const result = performEmployeeArchive(employeeName, year);

      if (result.success) {
        results.successful++;
        results.totalHours += result.totalHours;
        results.details.push(`Successo: ${employeeName} - ${result.dataRows} righe, ${result.totalHours}h`);
      } else {
        results.failed++;
        results.details.push(`Errore: ${employeeName} - ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      results.failed++;
      results.details.push(`Errore: ${employeeName} - ${error.message}`);
    }
  });

  showArchiveMultipleResults(results);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGICA ARCHIVIAZIONE — operazioni effettive su fogli e Drive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esegue l'archiviazione completa di un singolo dipendente per un anno.
 *
 * Questa è la funzione tecnica principale del modulo. Coordina: creazione
 * struttura Drive, copia foglio con formattazione, filtro dati per anno,
 * rimozione dati archiviati dal foglio originale, export Excel/PDF, e
 * cleanup dello spreadsheet temporaneo.
 *
 * FLUSSO INTERNO:
 *   1. getMainSpreadsheet() → foglio principale
 *   2. getSheetSafe() → foglio dipendente
 *   3. createArchiveStructure(year, employeeName) → cartella + nome file
 *   4. SpreadsheetApp.create() → spreadsheet archivio temporaneo
 *   5. copySheetWithFormatting() → copia foglio nel temporaneo
 *   6. filterSheetDataByYear(archiveSheet, year, keepMatching=true) → mantieni solo anno
 *   7. Se dataRows > 0:
 *      a. filterSheetDataByYear(employeeSheet, year, keepMatching=false) → rimuovi dall'originale
 *      b. createArchiveExportFiles() → Excel + PDF su Drive
 *      c. moveFileToFolder() → sposta spreadsheet in cartella archivio
 *      d. Utilities.sleep(2000) → attesa sicurezza prima di cestinare
 *      e. archiveFile.setTrashed(true) → elimina spreadsheet temporaneo
 *   8. Se dataRows === 0: cestina direttamente lo spreadsheet vuoto
 *
 * CHIAMATA DA: executeSingleEmployeeArchive(), executeArchiveMultipleEmployees()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              createArchiveStructure(), copySheetWithFormatting(),
 *              filterSheetDataByYear(), createArchiveExportFiles(),
 *              moveFileToFolder() (UtilsMenu.gs), debugLog() (UtilsMenu.gs),
 *              SpreadsheetApp.create(), DriveApp.getFileById()
 *
 * @param {string} employeeName - Nome del dipendente (= nome foglio Sheets).
 * @param {number} year         - Anno da archiviare.
 * @returns {{
 *   success: boolean,
 *   employeeName: string,
 *   year: number,
 *   dataRows: number,
 *   totalHours: number,
 *   error: string|null
 * }} Risultato archiviazione.
 */
function performEmployeeArchive(employeeName, year) {
  const result = {
    success: false,
    employeeName: employeeName,
    year: year,
    dataRows: 0,
    totalHours: 0,
    error: null
  };

  try {
    debugLog(`Inizio archiviazione: ${employeeName} - Anno ${year}`);

    const spreadsheet = getMainSpreadsheet();
    const employeeSheet = getSheetSafe(spreadsheet, employeeName);

    const archiveStructure = createArchiveStructure(year, employeeName);

    const archiveSpreadsheet = SpreadsheetApp.create(archiveStructure.fileName);
    const archiveFile = DriveApp.getFileById(archiveSpreadsheet.getId());

    const archiveSheet = copySheetWithFormatting(employeeSheet, archiveSpreadsheet, employeeName);

    const filterResult = filterSheetDataByYear(archiveSheet, year, true);
    result.dataRows = filterResult.dataRows;
    result.totalHours = filterResult.totalHours;

    if (result.dataRows > 0) {
      filterSheetDataByYear(employeeSheet, year, false);

      createArchiveExportFiles(archiveSpreadsheet, archiveStructure.targetFolder, archiveStructure.fileName);

      moveFileToFolder(archiveFile, archiveStructure.targetFolder);

      Utilities.sleep(2000);
      archiveFile.setTrashed(true);

      result.success = true;
      debugLog(`Archiviazione completata: ${employeeName}`, { dataRows: result.dataRows, totalHours: result.totalHours });

    } else {
      archiveFile.setTrashed(true);
      result.error = `Nessun dato trovato per l'anno ${year}`;
      debugLog(`Nessun dato trovato: ${employeeName} - Anno ${year}`);
    }

  } catch (error) {
    console.error(`Errore archiviazione ${employeeName}:`, error);
    result.error = error.message;
  }

  return result;
}

/**
 * Crea la struttura di cartelle Drive per l'archivio e restituisce nome file.
 *
 * Garantisce l'esistenza di: cartella base (CONFIG.FOLDERS.ARCHIVE) e
 * sottocartella anno (es. "2024"). Il nome file generato combina anno e
 * nome dipendente normalizzato per il filesystem Drive.
 *
 * CHIAMATA DA: performEmployeeArchive()
 * CHIAMA:      findOrCreateFolder() (UtilsMenu.gs), formatFileName() (Config.gs)
 *
 * @param {number} year         - Anno archivio.
 * @param {string} employeeName - Nome dipendente (usato per il nome file).
 * @returns {{ targetFolder: GoogleAppsScript.Drive.Folder, fileName: string }}
 */
function createArchiveStructure(year, employeeName) {
  const baseFolder = findOrCreateFolder(CONFIG.FOLDERS.ARCHIVE);
  const yearFolder = findOrCreateFolder(year.toString(), baseFolder);

  return {
    targetFolder: yearFolder,
    fileName: `${year}_${formatFileName(employeeName)}`
  };
}

/**
 * Copia un foglio Sheets in un altro spreadsheet replicando valori e formattazione.
 *
 * Copia in batch: valori, sfondo, colori font, famiglie font, dimensioni font,
 * grassetto, allineamento orizzontale e verticale, formati numerici, larghezze
 * colonne e formule. Le operazioni di formattazione sono singolarmente
 * protette da try/catch per non bloccare la copia se un attributo fallisce.
 *
 * FLUSSO INTERNO:
 *   1. Legge dimensioni fonte con getDataRange()
 *   2. Ridimensiona il foglio target se necessario
 *   3. setValues() per i dati
 *   4. setBackgrounds/setFontColors/setFontFamilies/setFontSizes/setFontWeights (try/catch)
 *   5. setHorizontalAlignments/setVerticalAlignments/setNumberFormats (try/catch)
 *   6. setColumnWidth per ogni colonna (try/catch)
 *   7. Copia formule cella per cella (try/catch)
 *
 * CHIAMATA DA: performEmployeeArchive()
 * CHIAMA:      Sheet.getDataRange(), Sheet.getRange(), debugLog() (UtilsMenu.gs)
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet}       sourceSheet       - Foglio sorgente.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} targetSpreadsheet - Spreadsheet di destinazione.
 * @param {string}                                   newName           - Nome del foglio nel target.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Il foglio copiato nel targetSpreadsheet.
 */
function copySheetWithFormatting(sourceSheet, targetSpreadsheet, newName) {
  const sourceRange = sourceSheet.getDataRange();
  const numRows = sourceRange.getNumRows();
  const numCols = sourceRange.getNumColumns();

  let targetSheet = targetSpreadsheet.getSheets()[0];
  targetSheet.setName(newName);

  const currentRows = targetSheet.getMaxRows();
  const currentCols = targetSheet.getMaxColumns();

  if (currentRows < numRows) {
    targetSheet.insertRowsAfter(currentRows, numRows - currentRows);
  }
  if (currentCols < numCols) {
    targetSheet.insertColumnsAfter(currentCols, numCols - currentCols);
  }

  const targetRange = targetSheet.getRange(1, 1, numRows, numCols);

  targetRange.setValues(sourceRange.getValues());

  try {
    targetRange.setBackgrounds(sourceRange.getBackgrounds());
    targetRange.setFontColors(sourceRange.getFontColors());
    targetRange.setFontFamilies(sourceRange.getFontFamilies());
    targetRange.setFontSizes(sourceRange.getFontSizes());
    targetRange.setFontWeights(sourceRange.getFontWeights());
    targetRange.setHorizontalAlignments(sourceRange.getHorizontalAlignments());
    targetRange.setVerticalAlignments(sourceRange.getVerticalAlignments());
  } catch (error) {
    debugLog('Errore copia formattazione base', error);
  }

  try {
    targetRange.setNumberFormats(sourceRange.getNumberFormats());
  } catch (error) {
    debugLog('Errore copia formati numerici', error);
  }

  for (let col = 1; col <= numCols; col++) {
    try {
      targetSheet.setColumnWidth(col, sourceSheet.getColumnWidth(col));
    } catch (error) {
      debugLog(`Errore copia larghezza colonna ${col}`, error);
    }
  }

  try {
    const formulas = sourceRange.getFormulas();
    for (let row = 0; row < formulas.length; row++) {
      for (let col = 0; col < formulas[row].length; col++) {
        if (formulas[row][col]) {
          targetSheet.getRange(row + 1, col + 1).setFormula(formulas[row][col]);
        }
      }
    }
  } catch (error) {
    debugLog('Errore copia formule', error);
  }

  return targetSheet;
}

/**
 * Filtra le righe dati di un foglio per anno, mantenendo o rimuovendo quelle dell'anno target.
 *
 * Legge tutti i dati del foglio (inclusi gli header), separa le righe header
 * (CONFIG.DATA_STRUCTURE.HEADER_ROWS) da quelle dati, filtra per anno usando
 * extractYear() sulla colonna DATA, poi riscrive il foglio con soli i dati
 * filtrati. Elimina le righe eccedenti con deleteRows() per non lasciare
 * righe vuote in fondo. Se keepMatching=true calcola anche il totale ore.
 *
 * FLUSSO INTERNO:
 *   1. getDataRange() → tutti i dati + sfondi
 *   2. Separa header e righe dati
 *   3. Filtra righe per extractYear() === targetYear (se keepMatching) o !== (se !keepMatching)
 *   4. sheet.clear()
 *   5. Riscrive header + righe filtrate con setValues() + setBackgrounds()
 *   6. Elimina righe eccedenti
 *   7. Restituisce { dataRows, totalHours }
 *
 * CHIAMATA DA: performEmployeeArchive() (due volte: una su archivio, una su originale)
 * CHIAMA:      extractYear() (UtilsMenu.gs), debugLog() (UtilsMenu.gs),
 *              CONFIG.DATA_STRUCTURE.HEADER_ROWS, CONFIG.DATA_STRUCTURE.COLUMNS
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet        - Foglio da filtrare (modificato in-place).
 * @param {number}                             targetYear   - Anno di riferimento per il filtro.
 * @param {boolean}                            keepMatching - true = mantieni righe dell'anno;
 *                                                           false = rimuovi righe dell'anno.
 * @returns {{ dataRows: number, totalHours: number }}
 *   Numero di righe nel risultato filtrato e ore totali (calcolate solo se keepMatching=true).
 */
function filterSheetDataByYear(sheet, targetYear, keepMatching) {
  const dataRange = sheet.getDataRange();
  const allData = dataRange.getValues();
  const allBackgrounds = dataRange.getBackgrounds();
  const numCols = dataRange.getNumColumns();

  const headerRows = CONFIG.DATA_STRUCTURE.HEADER_ROWS;
  const headerData = allData.slice(0, headerRows);
  const headerBackgrounds = allBackgrounds.slice(0, headerRows);

  const filteredData = [];
  const filteredBackgrounds = [];
  let totalHours = 0;

  for (let i = headerRows; i < allData.length; i++) {
    const row = allData[i];
    const rowYear = extractYear(row[CONFIG.DATA_STRUCTURE.COLUMNS.DATA]);
    const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;

    const shouldKeep = keepMatching ? (rowYear === targetYear) : (rowYear !== targetYear);

    if (shouldKeep && rowYear !== null) {
      filteredData.push(row);
      filteredBackgrounds.push(allBackgrounds[i]);

      if (keepMatching) {
        totalHours += hours;
      }
    }
  }

  sheet.clear();

  const finalData = headerData.concat(filteredData);
  const finalBackgrounds = headerBackgrounds.concat(filteredBackgrounds);

  if (finalData.length > 0) {
    const finalRange = sheet.getRange(1, 1, finalData.length, numCols);
    finalRange.setValues(finalData);

    try {
      finalRange.setBackgrounds(finalBackgrounds);
    } catch (error) {
      debugLog('Errore ripristino backgrounds', error);
    }
  }

  const totalRows = sheet.getMaxRows();
  if (totalRows > finalData.length) {
    sheet.deleteRows(finalData.length + 1, totalRows - finalData.length);
  }

  return {
    dataRows: filteredData.length,
    totalHours: Math.round(totalHours * 100) / 100
  };
}

/**
 * Crea i file di export (Excel e PDF) da uno spreadsheet archivio verso Drive.
 *
 * Chiama createExcelFile() e createPDFFile() (entrambe in UtilsMenu.gs) per
 * lo stesso spreadsheet. Gli errori su singoli formati sono loggati ma non
 * bloccanti: l'archiviazione continua anche se uno dei due export fallisce.
 *
 * FLUSSO INTERNO:
 *   1. Recupera ID spreadsheet e gid del primo foglio
 *   2. createExcelFile() → file .xlsx su Drive
 *   3. createPDFFile() → file .pdf su Drive
 *   4. Restituisce array di descrizioni file creati
 *
 * CHIAMATA DA: performEmployeeArchive()
 * CHIAMA:      createExcelFile() (UtilsMenu.gs), createPDFFile() (UtilsMenu.gs),
 *              debugLog() (UtilsMenu.gs)
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet  - Spreadsheet sorgente.
 * @param {GoogleAppsScript.Drive.Folder}            targetFolder - Cartella Drive di destinazione.
 * @param {string}                                   baseFileName - Nome base dei file (senza estensione).
 * @returns {string[]} Lista descrittiva dei file creati (es. ['Excel: 2024_Mario.xlsx', 'PDF: ...']).
 */
function createArchiveExportFiles(spreadsheet, targetFolder, baseFileName) {
  const spreadsheetId = spreadsheet.getId();
  const sheetId = spreadsheet.getSheets()[0].getSheetId();
  const filesCreated = [];

  try {
    const excelFile = createExcelFile(spreadsheetId, baseFileName, targetFolder);
    filesCreated.push(`Excel: ${excelFile.getName()}`);
    debugLog('File Excel creato', { fileName: excelFile.getName() });
  } catch (error) {
    console.error('Errore creazione Excel:', error);
  }

  try {
    const pdfFile = createPDFFile(spreadsheetId, sheetId, baseFileName, targetFolder);
    filesCreated.push(`PDF: ${pdfFile.getName()}`);
    debugLog('File PDF creato', { fileName: pdfFile.getName() });
  } catch (error) {
    console.error('Errore creazione PDF:', error);
  }

  debugLog('File export creati', { files: filesCreated });
  return filesCreated;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER DRIVE — utility per conteggio file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conta il numero di file presenti direttamente in una cartella Drive.
 *
 * Itera su tutti i file della cartella con getFiles() e conta le iterazioni.
 * Non include le sottocartelle nel conteggio.
 *
 * CHIAMATA DA: displayArchiveStatus()
 * CHIAMA:      Folder.getFiles()
 *
 * @param {GoogleAppsScript.Drive.Folder} folder - Cartella Drive da ispezionare.
 * @returns {number} Numero di file nella cartella.
 */
function countFilesInFolder(folder) {
  let count = 0;
  const fileIterator = folder.getFiles();
  while (fileIterator.hasNext()) {
    fileIterator.next();
    count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI RISULTATI — messaggi di esito archiviazione multipla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra il riepilogo dei risultati di un'archiviazione multipla tramite alert UI.
 *
 * Formatta un messaggio testuale con riepilogo aggregato (successi, errori,
 * ore totali) e dettagli per dipendente (limitati a 10 per evitare messaggi
 * troppo lunghi). Il titolo del dialogo indica se ci sono stati errori.
 *
 * CHIAMATA DA: executeArchiveMultipleEmployees()
 * CHIAMA:      formatNumberItalian() (UtilsMenu.gs), SpreadsheetApp.getUi()
 *
 * @param {{
 *   year: number,
 *   total: number,
 *   successful: number,
 *   failed: number,
 *   details: string[],
 *   totalHours: number
 * }} results - Oggetto risultati accumulato da executeArchiveMultipleEmployees().
 * @returns {void}
 */
function showArchiveMultipleResults(results) {
  let message = `ARCHIVIAZIONE COMPLETATA - ANNO ${results.year}\n\n`;
  message += `RIEPILOGO:\n`;
  message += `Successi: ${results.successful}\n`;
  message += `Errori: ${results.failed}\n`;
  message += `Totale dipendenti: ${results.total}\n`;
  message += `Ore totali archiviate: ${formatNumberItalian(results.totalHours)}\n\n`;

  if (results.details.length > 0) {
    message += `DETTAGLI:\n`;
    results.details.join('\n') + '\n\n';

    // Limita i dettagli se sono troppi
    const maxDetails = 10;
    if (results.details.length > maxDetails) {
      message += results.details.slice(0, maxDetails).join('\n') + '\n';
      message += `... e altri ${results.details.length - maxDetails} risultati\n\n`;
    } else {
      message += results.details.join('\n') + '\n\n';
    }
  }

  message += `File salvati in: ${CONFIG.FOLDERS.ARCHIVE}/${results.year}/`;

  const title = results.failed === 0 ? 'Archiviazione Completata' : 'Archiviazione Completata con Errori';

  SpreadsheetApp.getUi().alert(title + '\n\n' + message);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST E DIAGNOSTICA — funzioni per verificare il corretto funzionamento
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Verifica l'integrità del sistema di archiviazione senza archiviare dati.
 *
 * Esegue 4 controlli: (1) accessibilità cartella archivi su Drive,
 * (2) presenza di dipendenti attivi, (3) accessibilità dei fogli dei
 * primi 3 dipendenti, (4) funzionalità di extractYear().
 * Mostra il risultato di ogni test tramite alert UI. Non modifica dati.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets, voce diagnostica)
 * CHIAMA:      findOrCreateFolder() (UtilsMenu.gs), getActiveEmployeeNames() (UtilsMenu.gs),
 *              getMainSpreadsheet() (Config.gs), extractYear() (UtilsMenu.gs),
 *              showSuccessMessage(), showErrorMessage() (UtilsMenu.gs)
 *
 * @returns {void}
 */
function verifyArchiveSystem() {
  try {
    let status = 'VERIFICA SISTEMA ARCHIVIAZIONE\n\n';

    // Test 1: Cartella base
    try {
      const archiveFolder = findOrCreateFolder(CONFIG.FOLDERS.ARCHIVE);
      status += `Cartella archivi: OK (${archiveFolder.getName()})\n`;
    } catch (error) {
      status += `Cartella archivi: ERRORE (${error.message})\n`;
    }

    // Test 2: Dipendenti
    const employees = getActiveEmployeeNames();
    status += `Dipendenti trovati: ${employees.length}\n`;

    // Test 3: Accesso fogli
    let accessibleSheets = 0;
    employees.slice(0, 3).forEach(emp => {
      try {
        const spreadsheet = getMainSpreadsheet();
        const sheet = spreadsheet.getSheetByName(emp);
        if (sheet) accessibleSheets++;
      } catch (error) {
        // Ignora errori singoli
      }
    });
    status += `Fogli accessibili (test su 3): ${accessibleSheets}/3\n`;

    // Test 4: Funzioni utility
    try {
      const testYear = extractYear(new Date());
      status += `Estrazione anno: OK (${testYear})\n`;
    } catch (error) {
      status += `Estrazione anno: ERRORE\n`;
    }

    status += `\nSTATO GENERALE: ${employees.length > 0 && accessibleSheets > 0 ? 'FUNZIONANTE' : 'PROBLEMI RILEVATI'}`;

    showSuccessMessage(status);

  } catch (error) {
    showErrorMessage('Errore verifica sistema', error);
  }
}
