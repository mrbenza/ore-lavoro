// ===== ARCHIVIO_ORE.GS - GESTIONE ARCHIVIAZIONE - VERSIONE CORRETTA =====

/**
 * Archivia tutti i dipendenti per l'anno precedente
 */
function executeArchiveAllPreviousYear() {
  const year = CONFIG.DATES.DEFAULT_ARCHIVE_YEAR;
  const message = `Confermi l'archiviazione di TUTTI i dipendenti per l'anno ${year}?\n\nVerranno creati file Excel e PDF per ogni dipendente.`;
  
  if (showConfirmDialog('Conferma Archiviazione', message)) {
    executeArchiveMultipleEmployees(year);
  }
}

/**
 * Archivia singolo dipendente con dialog di selezione
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
 * Archivia con selezione anno personalizzato
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
 * Mostra stato degli archivi
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

/**
 * Mostra dialog per selezione dipendente da archiviare
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

/**
 * Esegue archiviazione singolo dipendente (chiamata da dialog)
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
 * Esegue archiviazione multipla di dipendenti
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

/**
 * Esegue l'archiviazione effettiva di un dipendente
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
 * Crea struttura cartelle per archivio
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
 * Copia foglio con tutta la formattazione
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
 * Filtra dati di un foglio per anno specifico
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
 * Crea file di export (Excel e PDF) da spreadsheet
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

/**
 * Conta file in una cartella Drive
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

/**
 * Mostra risultati archiviazione multipla
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

/**
 * Test archiviazione singola per debugging
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
 * Verifica integritÃ  sistema archiviazione
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
