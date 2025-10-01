// ===== UTILS.GS - FUNZIONI UTILITY COMUNI - VERSIONE CORRETTA =====

// ===== GESTIONE DATE =====

/**
 * Converte una data in formato italiano (DD/MM/YYYY)
 */
function formatDateItalian(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return date.toLocaleDateString('it-IT');
}

/**
 * Parsea una data da stringa italiana (DD/MM/YYYY) a oggetto Date
 */
function parseItalianDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  
  const matches = dateString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!matches) return null;
  
  const [, day, month, year] = matches;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Estrae l'anno da una data (supporta Date object e stringhe italiane)
 */
function extractYear(dateValue) {
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    return dateValue.getFullYear();
  }
  
  if (typeof dateValue === 'string') {
    const parsed = parseItalianDate(dateValue);
    return parsed ? parsed.getFullYear() : null;
  }
  
  return null;
}

/**
 * Verifica se una data appartiene a un determinato mese/anno
 */
function dateMatches(dateValue, month, year) {
  const parsedYear = extractYear(dateValue);
  if (!parsedYear || parsedYear !== year) return false;
  
  let parsedMonth = null;
  if (dateValue instanceof Date) {
    parsedMonth = dateValue.getMonth() + 1;
  } else if (typeof dateValue === 'string') {
    const parsed = parseItalianDate(dateValue);
    parsedMonth = parsed ? parsed.getMonth() + 1 : null;
  }
  
  return parsedMonth === month;
}

// ===== VALIDAZIONI =====

/**
 * Valida input numerico
 */
function validateNumber(value, min = null, max = null) {
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Valore non numerico' };
  if (min !== null && num < min) return { valid: false, error: `Valore minimo: ${min}` };
  if (max !== null && num > max) return { valid: false, error: `Valore massimo: ${max}` };
  return { valid: true, value: num };
}

/**
 * Valida anno
 */
function validateYear(year) {
  const validation = validateNumber(year, CONFIG.VALIDATION.MIN_YEAR, CONFIG.VALIDATION.MAX_YEAR);
  if (!validation.valid) return validation;
  return { valid: true, value: Math.floor(validation.value) };
}

/**
 * Valida mese (1-12)
 */
function validateMonth(month) {
  const validation = validateNumber(month, 1, 12);
  if (!validation.valid) return validation;
  return { valid: true, value: Math.floor(validation.value) };
}

/**
 * Valida password
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password obbligatoria' };
  }
  if (password.length < CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
    return { valid: false, error: ERROR_MESSAGES.PASSWORD_TOO_SHORT };
  }
  return { valid: true, value: password.trim() };
}

// ===== GESTIONE FOGLI =====

/**
 * Verifica se un foglio esiste
 */
function sheetExists(spreadsheet, sheetName) {
  try {
    return spreadsheet.getSheetByName(sheetName) !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Ottiene un foglio con gestione errori
 */
function getSheetSafe(spreadsheet, sheetName) {
  try {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error(ERROR_MESSAGES.SHEET_NOT_FOUND(sheetName));
    return sheet;
  } catch (error) {
    console.error(`Errore accesso foglio "${sheetName}":`, error);
    throw error;
  }
}

/**
 * Ottiene lista dipendenti attivi (esclude fogli di sistema)
 */
function getActiveEmployeeNames() {
  try {
    const spreadsheet = getMainSpreadsheet();
    return spreadsheet.getSheets()
      .map(sheet => sheet.getName())
      .filter(name => !isSystemSheet(name))
      .sort();
  } catch (error) {
    console.error('Errore lettura dipendenti:', error);
    throw new Error('Impossibile ottenere lista dipendenti');
  }
}

/**
 * Conta righe con dati (esclude header)
 */
function countDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  return Math.max(0, lastRow - CONFIG.DATA_STRUCTURE.HEADER_ROWS);
}

/**
 * Ottiene range dati (esclude header)
 */
function getDataRange(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= CONFIG.DATA_STRUCTURE.HEADER_ROWS) {
    return null;
  }
  
  return sheet.getRange(
    CONFIG.DATA_STRUCTURE.HEADER_ROWS + 1, 
    1, 
    lastRow - CONFIG.DATA_STRUCTURE.HEADER_ROWS, 
    lastCol
  );
}

// ===== GESTIONE DRIVE =====

/**
 * Trova o crea cartella Drive
 */
function findOrCreateFolder(folderName, parentFolder = null) {
  try {
    const parent = parentFolder || DriveApp.getRootFolder();
    const iterator = parent.getFoldersByName(folderName);
    
    return iterator.hasNext() ? iterator.next() : parent.createFolder(folderName);
  } catch (error) {
    console.error(`Errore gestione cartella "${folderName}":`, error);
    throw new Error(`Impossibile creare/accedere cartella: ${folderName}`);
  }
}

/**
 * Sposta file in cartella specifica
 */
function moveFileToFolder(file, targetFolder) {
  try {
    const currentParents = file.getParents();
    while (currentParents.hasNext()) {
      currentParents.next().removeFile(file);
    }
    
    targetFolder.addFile(file);
    return true;
  } catch (error) {
    console.error('Errore spostamento file:', error);
    throw new Error(`Impossibile spostare file: ${error.message}`);
  }
}

// ===== GESTIONE DATI =====

/**
 * Filtra righe per anno specifico
 */
function filterRowsByYear(data, targetYear, keepMatching = true) {
  return data.filter(row => {
    const year = extractYear(row[CONFIG.DATA_STRUCTURE.COLUMNS.DATA]);
    const matches = year === targetYear;
    return keepMatching ? matches : !matches;
  });
}

/**
 * Calcola totale ore da array di righe
 */
function calculateTotalHours(rows) {
  return rows.reduce((total, row) => {
    const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
    return total + hours;
  }, 0);
}

/**
 * Raggruppa righe per cantiere
 */
function groupRowsByConstructionSite(rows) {
  const grouped = {};
  
  rows.forEach(row => {
    const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID] || 'N/A';
    const siteName = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_NOME] || 'Sconosciuto';
    const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
    
    if (!grouped[siteId]) {
      grouped[siteId] = {
        id: siteId,
        name: siteName,
        totalHours: 0,
        dayCount: 0
      };
    }
    
    grouped[siteId].totalHours += hours;
    grouped[siteId].dayCount++;
  });
  
  return grouped;
}

// ===== GENERAZIONE HASH PASSWORD =====

/**
 * Genera hash sicuro per password
 */
function generatePasswordHash(password) {
  const salt = "OreLavoro2025_Salt_";
  const dataToHash = salt + password + salt;
  
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    dataToHash,
    Utilities.Charset.UTF_8
  );
  
  return hash.map(byte => {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

// ===== EXPORT E CREAZIONE FILE =====

/**
 * Crea file Excel da spreadsheet
 */
function createExcelFile(spreadsheetId, fileName, targetFolder) {
  try {
    const token = ScriptApp.getOAuthToken();
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob().setName(fileName + '.xlsx');
      return targetFolder.createFile(blob);
    } else {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('Errore creazione Excel:', error);
    throw new Error(`Impossibile creare file Excel: ${error.message}`);
  }
}

/**
 * Crea file PDF da spreadsheet
 */
function createPDFFile(spreadsheetId, sheetId, fileName, targetFolder) {
  try {
    const token = ScriptApp.getOAuthToken();
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
      `format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&` +
      `pagenumbers=false&gridlines=false&fzr=false&gid=${sheetId}`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob().setName(fileName + '.pdf');
      return targetFolder.createFile(blob);
    } else {
      throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('Errore creazione PDF:', error);
    throw new Error(`Impossibile creare file PDF: ${error.message}`);
  }
}

// ===== UI HELPERS - VERSIONE CORRETTA =====

/**
 * Mostra dialog di conferma
 */
function showConfirmDialog(title, message) {
  const ui = SpreadsheetApp.getUi();
  return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
}

/**
 * Mostra dialog di input
 */
function showInputDialog(title, message, defaultValue = '') {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    return response.getResponseText().trim() || defaultValue;
  }
  
  return null;
}

/**
 * Mostra messaggio di successo
 */
function showSuccessMessage(message) {
  SpreadsheetApp.getUi().alert(message);
}

/**
 * Mostra messaggio di errore
 */
function showErrorMessage(message, error = null) {
  let fullMessage = message;
  if (error) {
    fullMessage += `\n\nDettagli: ${error.toString()}`;
  }
  SpreadsheetApp.getUi().alert(fullMessage);
}

// ===== PERFORMANCE E DEBUG =====

/**
 * Misura tempo di esecuzione di una funzione
 */
function measureExecutionTime(func, ...args) {
  const startTime = new Date();
  try {
    const result = func.apply(null, args);
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`Esecuzione completata in ${duration}s`);
    return { success: true, result, duration };
  } catch (error) {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`Errore dopo ${duration}s:`, error);
    return { success: false, error, duration };
  }
}

/**
 * Log dettagliato per debug
 */
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${message}`;
  
  if (data) {
    logMessage += `\nDati: ${JSON.stringify(data, null, 2)}`;
  }
  
  console.log(logMessage);
}

/**
 * Formatta numero con separatori decimali italiani
 */
function formatNumberItalian(number, decimals = 2) {
  if (isNaN(number)) return '0,00';
  return number.toLocaleString('it-IT', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

/**
 * Formatta nome file rimuovendo caratteri speciali
 */
function formatFileName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Ottiene data corrente formattata
 */
function getCurrentDateFormatted() {
  return new Date().toLocaleDateString('it-IT');
}

/**
 * Funzione personalizzata per Google Sheets: calcola ore totali cantiere
 * @param {string} cantiereId - ID del cantiere
 * @return {number} Ore totali
 * @customfunction
 */
function TOTALE_ORE_CANTIERE(cantiereId) {
  if (!cantiereId || cantiereId === '') return 0;
  
  try {
    const employeeNames = getActiveEmployeeNames();
    let totalHours = 0;
    
    employeeNames.forEach(employeeName => {
      try {
        const spreadsheet = getMainSpreadsheet();
        const sheet = spreadsheet.getSheetByName(employeeName);
        if (!sheet) return;
        
        const dataRange = getDataRange(sheet);
        if (!dataRange) return;
        
        const data = dataRange.getValues();
        
        data.forEach(row => {
          const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID];
          const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
          
          if (siteId === cantiereId && hours > 0) {
            totalHours += hours;
          }
        });
      } catch (error) {
        console.warn(`Errore lettura ${employeeName}:`, error);
      }
    });
    
    return Math.round(totalHours * 10) / 10;
  } catch (error) {
    console.error(`Errore TOTALE_ORE_CANTIERE per ${cantiereId}:`, error);
    return 0;
  }
}
