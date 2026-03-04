/**
 * UtilsMenu.gs — Funzioni Utility per i Moduli Menu
 *
 * Raccolta di helper condivisi tra i moduli accessibili dal menu Sheets
 * (ArchivioOre, GestionePassword, ReportCommercialista, CalcoloCantieri).
 * A differenza di Utils.gs (che gestisce autenticazione GAS, CORS, session token),
 * questo file si occupa di:
 *   - Gestione date in formato italiano (DD/MM/YYYY)
 *   - Validazione input (numeri, anni, mesi, password)
 *   - Accesso sicuro ai fogli Sheets
 *   - Operazioni Drive (cartelle, file Excel, PDF)
 *   - Aggregazione dati (filtro per anno, totale ore, raggruppamento cantieri)
 *   - UI helpers (confirm, input, messaggi)
 *   - Performance e debug utility
 *   - Custom function TOTALE_ORE_CANTIERE() per celle Sheets
 *
 * USATO DA: ArchivioOre.gs, GestionePassword.gs, ReportCommercialista.gs,
 *           CalcoloCantieri.gs, Main.gs (performSystemDiagnostics)
 */

// ─────────────────────────────────────────────────────────────────────────────
// GESTIONE DATE — conversione e verifica date in formato italiano
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte un oggetto Date in stringa formato italiano DD/MM/YYYY.
 *
 * Usato per formattare date da inserire in report e file Excel.
 * Restituisce stringa vuota se la data non è valida.
 *
 * CHIAMATA DA: ReportCommercialista.gs, ArchivioOre.gs
 * CHIAMA:      Date.prototype.toLocaleDateString()
 *
 * @param {Date} date - Oggetto Date da formattare.
 * @returns {string} Data in formato DD/MM/YYYY, o stringa vuota se invalida.
 * @example
 * formatDateItalian(new Date(2025, 0, 15)); // '15/01/2025'
 */
function formatDateItalian(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return date.toLocaleDateString('it-IT');
}

/**
 * Parsea una stringa data italiana (DD/MM/YYYY) in oggetto Date.
 *
 * Usa una regex per estrarre giorno, mese e anno dalla stringa. Restituisce
 * null se il formato non corrisponde o la data risultante è invalida.
 *
 * CHIAMATA DA: extractYear(), dateMatches(), filterRowsByYear()
 * CHIAMA:      (nessuna funzione esterna)
 *
 * @param {string} dateString - Stringa data in formato DD/MM/YYYY.
 * @returns {Date|null} Oggetto Date, o null se la stringa è invalida.
 * @example
 * parseItalianDate('15/01/2025'); // new Date(2025, 0, 15)
 * parseItalianDate('invalid');    // null
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
 * Estrae l'anno numerico da un valore data (Date o stringa italiana DD/MM/YYYY).
 *
 * Supporta sia oggetti Date diretti (da celle Sheets con formato data) sia
 * stringhe nel formato italiano. Restituisce null per qualsiasi altro tipo.
 *
 * CHIAMATA DA: dateMatches(), filterRowsByYear()
 * CHIAMA:      parseItalianDate()
 *
 * @param {Date|string} dateValue - Data come oggetto Date o stringa DD/MM/YYYY.
 * @returns {number|null} Anno a 4 cifre, o null se non estraibile.
 * @example
 * extractYear(new Date(2025, 0, 15)); // 2025
 * extractYear('15/01/2025');          // 2025
 * extractYear('non-data');            // null
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
 * Verifica se un valore data appartiene a un determinato mese e anno.
 *
 * Usato per filtrare righe del foglio dipendente per periodo. Supporta
 * sia Date objects sia stringhe italiane DD/MM/YYYY.
 *
 * CHIAMATA DA: ReportCommercialista.gs, ArchivioOre.gs
 * CHIAMA:      extractYear(), parseItalianDate()
 *
 * @param {Date|string} dateValue - Data da verificare.
 * @param {number}      month     - Mese atteso (1-12).
 * @param {number}      year      - Anno atteso (es. 2025).
 * @returns {boolean} true se la data corrisponde al mese/anno forniti.
 * @example
 * dateMatches(new Date(2025, 0, 15), 1, 2025); // true
 * dateMatches('15/02/2025', 1, 2025);           // false
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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAZIONI — controllo input utente da dialog menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un input numerico con opzionale controllo min/max.
 *
 * Usato per validare valori ore, anno, mese prima di operazioni sui fogli.
 *
 * CHIAMATA DA: validateYear(), validateMonth()
 * CHIAMA:      (nessuna funzione esterna)
 *
 * @param {*}       value - Valore da validare (verrà convertito via parseFloat).
 * @param {number|null} min - Valore minimo ammesso (null = nessun limite).
 * @param {number|null} max - Valore massimo ammesso (null = nessun limite).
 * @returns {{ valid: boolean, value?: number, error?: string }}
 * @example
 * validateNumber('8', 0, 24);  // { valid: true, value: 8 }
 * validateNumber('-1', 0, 24); // { valid: false, error: 'Valore minimo: 0' }
 */
function validateNumber(value, min = null, max = null) {
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Valore non numerico' };
  if (min !== null && num < min) return { valid: false, error: `Valore minimo: ${min}` };
  if (max !== null && num > max) return { valid: false, error: `Valore massimo: ${max}` };
  return { valid: true, value: num };
}

/**
 * Valida un anno confrontandolo con il range consentito da CONFIG.VALIDATION.
 *
 * Utilizza MIN_YEAR e MAX_YEAR definiti in Config.gs. Il valore viene
 * troncato a intero per evitare anni con decimali.
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      validateNumber(), CONFIG.VALIDATION
 *
 * @param {number|string} year - Anno da validare.
 * @returns {{ valid: boolean, value?: number, error?: string }}
 * @example
 * validateYear(2025); // { valid: true, value: 2025 }
 * validateYear(1800); // { valid: false, error: 'Valore minimo: ...' }
 */
function validateYear(year) {
  const validation = validateNumber(year, CONFIG.VALIDATION.MIN_YEAR, CONFIG.VALIDATION.MAX_YEAR);
  if (!validation.valid) return validation;
  return { valid: true, value: Math.floor(validation.value) };
}

/**
 * Valida un mese nell'intervallo 1-12.
 *
 * CHIAMATA DA: ReportCommercialista.gs
 * CHIAMA:      validateNumber()
 *
 * @param {number|string} month - Mese da validare (1-12).
 * @returns {{ valid: boolean, value?: number, error?: string }}
 * @example
 * validateMonth(6);  // { valid: true, value: 6 }
 * validateMonth(13); // { valid: false, error: 'Valore massimo: 12' }
 */
function validateMonth(month) {
  const validation = validateNumber(month, 1, 12);
  if (!validation.valid) return validation;
  return { valid: true, value: Math.floor(validation.value) };
}

/**
 * Valida una password rispetto ai requisiti minimi di lunghezza.
 *
 * Controlla che la password sia una stringa non vuota e con lunghezza
 * >= CONFIG.VALIDATION.MIN_PASSWORD_LENGTH. Restituisce la password
 * trimmed in caso di successo.
 *
 * CHIAMATA DA: GestionePassword.gs
 * CHIAMA:      CONFIG.VALIDATION, ERROR_MESSAGES
 *
 * @param {string} password - Password da validare.
 * @returns {{ valid: boolean, value?: string, error?: string }}
 * @example
 * validatePassword('abc');    // { valid: false, error: 'Password troppo corta' }
 * validatePassword('secret'); // { valid: true, value: 'secret' }
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

// ─────────────────────────────────────────────────────────────────────────────
// GESTIONE FOGLI — accesso sicuro ai fogli dello spreadsheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se un foglio con il nome dato esiste nello spreadsheet.
 *
 * Wrapper sicuro attorno a getSheetByName() — non lancia eccezioni.
 *
 * CHIAMATA DA: ArchivioOre.gs, CalcoloCantieri.gs
 * CHIAMA:      Spreadsheet.getSheetByName()
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - Spreadsheet target.
 * @param {string} sheetName - Nome del foglio da cercare.
 * @returns {boolean} true se il foglio esiste.
 */
function sheetExists(spreadsheet, sheetName) {
  try {
    return spreadsheet.getSheetByName(sheetName) !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Ottiene un foglio per nome lanciando un'eccezione se non trovato.
 *
 * A differenza di getSheetSafely() in Utils.gs (che ritorna null),
 * questa funzione lancia sempre un'eccezione descrittiva se il foglio
 * è assente, adatta per i moduli menu che usano try/catch a livello superiore.
 *
 * CHIAMATA DA: ArchivioOre.gs, GestionePassword.gs, ReportCommercialista.gs
 * CHIAMA:      Spreadsheet.getSheetByName(), ERROR_MESSAGES.SHEET_NOT_FOUND
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - Spreadsheet target.
 * @param {string} sheetName - Nome del foglio.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Il foglio trovato.
 * @throws {Error} Se il foglio non esiste.
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
 * Restituisce la lista dei nomi dei fogli dipendente (esclude fogli di sistema).
 *
 * Recupera tutti i fogli dello spreadsheet principale, filtra via isSystemSheet()
 * (definita in Config.gs) per escludere Utenti, Cantieri, Amministrazione, ecc.,
 * e restituisce la lista ordinata alfabeticamente.
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs, CalcoloCantieri.gs,
 *              TOTALE_ORE_CANTIERE()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), isSystemSheet() (Config.gs)
 *
 * @returns {string[]} Nomi dei fogli dipendente in ordine alfabetico.
 * @throws {Error} Se impossibile leggere i fogli (es. permessi mancanti).
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
 * Conta le righe dati di un foglio dipendente (esclude le righe header).
 *
 * Usa CONFIG.DATA_STRUCTURE.HEADER_ROWS (4) per sapere quante righe saltare.
 * Restituisce 0 se il foglio è vuoto o ha solo header.
 *
 * CHIAMATA DA: ArchivioOre.gs, SystemDiagnostic.gs
 * CHIAMA:      Sheet.getLastRow(), CONFIG.DATA_STRUCTURE.HEADER_ROWS
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Foglio dipendente.
 * @returns {number} Numero di righe dati (>= 0).
 */
function countDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  return Math.max(0, lastRow - CONFIG.DATA_STRUCTURE.HEADER_ROWS);
}

/**
 * Restituisce il range dati di un foglio dipendente escludendo le righe header.
 *
 * Se il foglio non ha dati oltre le righe header, restituisce null.
 * Il range inizia dalla riga CONFIG.DATA_STRUCTURE.HEADER_ROWS + 1.
 *
 * CHIAMATA DA: ReportCommercialista.gs, CalcoloCantieri.gs, TOTALE_ORE_CANTIERE()
 * CHIAMA:      Sheet.getLastRow(), Sheet.getLastColumn(), Sheet.getRange(),
 *              CONFIG.DATA_STRUCTURE.HEADER_ROWS
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Foglio dipendente.
 * @returns {GoogleAppsScript.Spreadsheet.Range|null} Range dati, o null se vuoto.
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

// ─────────────────────────────────────────────────────────────────────────────
// GESTIONE DRIVE — cartelle e file su Google Drive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trova una cartella Drive per nome, o la crea se non esiste.
 *
 * Cerca all'interno di parentFolder (default: root Drive). Se la cartella
 * esiste la ritorna, altrimenti la crea. Usato da ArchivioOre.gs e
 * ReportCommercialista.gs per garantire l'esistenza delle cartelle di output.
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      DriveApp.getRootFolder(), Folder.getFoldersByName(), Folder.createFolder()
 *
 * @param {string}                                      folderName   - Nome cartella da trovare/creare.
 * @param {GoogleAppsScript.Drive.Folder|null}          parentFolder - Cartella padre (null = root).
 * @returns {GoogleAppsScript.Drive.Folder} La cartella trovata o creata.
 * @throws {Error} Se impossibile accedere o creare la cartella.
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
 * Sposta un file Drive in una cartella target rimuovendolo da tutte le cartelle correnti.
 *
 * Itera su tutti i parent attuali del file, rimuove il file da ognuno, poi lo
 * aggiunge alla targetFolder. Necessario perché i nuovi file creati da GAS
 * finiscono nel root Drive dell'account di servizio.
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      File.getParents(), Folder.removeFile(), Folder.addFile()
 *
 * @param {GoogleAppsScript.Drive.File}   file         - File da spostare.
 * @param {GoogleAppsScript.Drive.Folder} targetFolder - Cartella di destinazione.
 * @returns {boolean} true se l'operazione ha avuto successo.
 * @throws {Error} Se lo spostamento fallisce.
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

// ─────────────────────────────────────────────────────────────────────────────
// GESTIONE DATI — filtro, aggregazione e raggruppamento righe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtra un array di righe dati mantenendo o escludendo quelle di un anno specifico.
 *
 * Legge la colonna data tramite CONFIG.DATA_STRUCTURE.COLUMNS.DATA e usa
 * extractYear() per il confronto. Il parametro keepMatching controlla la direzione
 * del filtro (true = tieni le righe dell'anno, false = escludi le righe dell'anno).
 *
 * CHIAMATA DA: ArchivioOre.gs
 * CHIAMA:      extractYear(), CONFIG.DATA_STRUCTURE.COLUMNS.DATA
 *
 * @param {Array[]}  data         - Array di righe (getValues()).
 * @param {number}   targetYear   - Anno di riferimento.
 * @param {boolean}  keepMatching - true per tenere le righe dell'anno; false per escluderle.
 * @returns {Array[]} Sottoinsieme delle righe filtrate.
 */
function filterRowsByYear(data, targetYear, keepMatching = true) {
  return data.filter(row => {
    const year = extractYear(row[CONFIG.DATA_STRUCTURE.COLUMNS.DATA]);
    const matches = year === targetYear;
    return keepMatching ? matches : !matches;
  });
}

/**
 * Calcola il totale ore da un array di righe dati.
 *
 * Somma i valori della colonna ORE (CONFIG.DATA_STRUCTURE.COLUMNS.ORE)
 * convertendo ogni cella con parseFloat. Valori non numerici contano come 0.
 *
 * CHIAMATA DA: ReportCommercialista.gs, CalcoloCantieri.gs
 * CHIAMA:      CONFIG.DATA_STRUCTURE.COLUMNS.ORE
 *
 * @param {Array[]} rows - Array di righe (getValues()).
 * @returns {number} Somma delle ore (arrotondamento non applicato).
 */
function calculateTotalHours(rows) {
  return rows.reduce((total, row) => {
    const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
    return total + hours;
  }, 0);
}

/**
 * Raggruppa un array di righe dati per cantiere (ID + nome + totale ore + conteggio giorni).
 *
 * Produce un oggetto con una chiave per ogni cantiereId univoco. Ogni entry
 * contiene id, name, totalHours e dayCount. Usato per il riepilogo cantieri
 * nei report mensili e annuali.
 *
 * CHIAMATA DA: ReportCommercialista.gs
 * CHIAMA:      CONFIG.DATA_STRUCTURE.COLUMNS
 *
 * @param {Array[]} rows - Array di righe dati (getValues()).
 * @returns {{ [cantiereId: string]: { id: string, name: string, totalHours: number, dayCount: number } }}
 * @example
 * const grouped = groupRowsByConstructionSite(data);
 * // { 'C001': { id: 'C001', name: 'Cantiere A', totalHours: 40, dayCount: 5 } }
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

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT E CREAZIONE FILE — generazione Excel e PDF tramite UrlFetchApp
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Esporta uno spreadsheet Google in formato Excel (.xlsx) e lo salva su Drive.
 *
 * Usa l'API Google Docs Export via UrlFetchApp con OAuth token per scaricare
 * il file .xlsx e salvarlo nella cartella Drive specificata.
 * Nota: conta come chiamata UrlFetchApp (quota GAS giornaliera).
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      ScriptApp.getOAuthToken(), UrlFetchApp.fetch(), Folder.createFile()
 *
 * @param {string}                                spreadsheetId - ID dello spreadsheet sorgente.
 * @param {string}                                fileName      - Nome file senza estensione.
 * @param {GoogleAppsScript.Drive.Folder}         targetFolder  - Cartella Drive di destinazione.
 * @returns {GoogleAppsScript.Drive.File} Il file Excel creato su Drive.
 * @throws {Error} Se l'esportazione fallisce (HTTP non-200 o errore rete).
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
 * Esporta un foglio specifico di uno spreadsheet Google in formato PDF e lo salva su Drive.
 *
 * Usa l'API Google Docs Export con parametri PDF (A4, portrait, fit width, senza
 * griglia e titoli). Il parametro sheetId seleziona il foglio specifico da esportare.
 * Conta come chiamata UrlFetchApp (quota GAS giornaliera).
 *
 * CHIAMATA DA: ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      ScriptApp.getOAuthToken(), UrlFetchApp.fetch(), Folder.createFile()
 *
 * @param {string}                        spreadsheetId - ID dello spreadsheet sorgente.
 * @param {number}                        sheetId       - ID numerico del foglio (gid).
 * @param {string}                        fileName      - Nome file senza estensione.
 * @param {GoogleAppsScript.Drive.Folder} targetFolder  - Cartella Drive di destinazione.
 * @returns {GoogleAppsScript.Drive.File} Il file PDF creato su Drive.
 * @throws {Error} Se l'esportazione fallisce.
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

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS — dialog e messaggi per le operazioni da menu Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra un dialog di conferma YES/NO e restituisce la scelta dell'utente.
 *
 * CHIAMATA DA: ArchivioOre.gs, GestionePassword.gs, CalcoloCantieri.gs
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {string} title   - Titolo del dialog.
 * @param {string} message - Testo del messaggio.
 * @returns {boolean} true se l'utente ha cliccato YES.
 */
function showConfirmDialog(title, message) {
  const ui = SpreadsheetApp.getUi();
  return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
}

/**
 * Mostra un dialog di input testuale e restituisce il testo inserito.
 *
 * Se l'utente clicca CANCEL restituisce null. Se l'utente conferma ma non
 * inserisce nulla, restituisce defaultValue (stringa vuota per default).
 *
 * CHIAMATA DA: GestionePassword.gs, ArchivioOre.gs, ReportCommercialista.gs
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {string} title        - Titolo del dialog.
 * @param {string} message      - Testo del prompt.
 * @param {string} defaultValue - Valore di ritorno se l'utente non inserisce nulla (default '').
 * @returns {string|null} Testo inserito, o null se l'utente ha cliccato CANCEL.
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
 * Mostra un messaggio di successo all'utente tramite alert modale.
 *
 * CHIAMATA DA: ArchivioOre.gs, GestionePassword.gs, ReportCommercialista.gs
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {string} message - Messaggio di successo da mostrare.
 * @returns {void}
 */
function showSuccessMessage(message) {
  SpreadsheetApp.getUi().alert(message);
}

/**
 * Mostra un messaggio di errore all'utente, con opzionale dettaglio dell'eccezione.
 *
 * Se error è fornito, aggiunge una sezione "Dettagli:" con error.toString().
 *
 * CHIAMATA DA: ArchivioOre.gs, GestionePassword.gs, ReportCommercialista.gs,
 *              CalcoloCantieri.gs
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {string}     message - Messaggio principale di errore.
 * @param {Error|null} error   - Eccezione opzionale da appendere ai dettagli.
 * @returns {void}
 */
function showErrorMessage(message, error = null) {
  let fullMessage = message;
  if (error) {
    fullMessage += `\n\nDettagli: ${error.toString()}`;
  }
  SpreadsheetApp.getUi().alert(fullMessage);
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE E DEBUG — timing e logging dettagliato
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Misura il tempo di esecuzione di una funzione e restituisce il risultato.
 *
 * Esegue func(...args), misura la durata in secondi e stampa nel log.
 * In caso di eccezione, la cattura e la include nel risultato senza rilanciare.
 * Usato per benchmark e ottimizzazione delle funzioni batch.
 *
 * CHIAMATA DA: CalcoloCantieri.gs, ReportCommercialista.gs
 * CHIAMA:      (qualsiasi funzione passata come parametro)
 *
 * @param {Function} func - Funzione da misurare.
 * @param {...*}     args - Argomenti da passare alla funzione.
 * @returns {{ success: boolean, result?: *, error?: Error, duration: string }}
 *   Oggetto con esito, risultato o errore, e durata in secondi (es. '1.23').
 * @example
 * const res = measureExecutionTime(executeRecalculateConstructionSites);
 * console.log('Durata:', res.duration + 's');
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
 * Stampa un messaggio di log dettagliato con timestamp e dati opzionali.
 *
 * Usato per debug durante lo sviluppo. I dati vengono serializzati con
 * JSON.stringify(data, null, 2) per leggibilità nel log GAS.
 *
 * CHIAMATA DA: CalcoloCantieri.gs, ArchivioOre.gs
 * CHIAMA:      console.log()
 *
 * @param {string} message - Messaggio descrittivo.
 * @param {*}      data    - Dati opzionali da serializzare (null = nessun dato).
 * @returns {void}
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
 * Formatta un numero con separatori decimali italiani (virgola, punto migliaia).
 *
 * Usa toLocaleString('it-IT') per il formato standard italiano.
 * Restituisce '0,00' per valori NaN.
 *
 * CHIAMATA DA: ReportCommercialista.gs
 * CHIAMA:      Number.prototype.toLocaleString()
 *
 * @param {number} number   - Numero da formattare.
 * @param {number} decimals - Numero di cifre decimali (default 2).
 * @returns {string} Numero formattato (es. 1.234,56).
 * @example
 * formatNumberItalian(1234.567, 2); // '1.234,57'
 * formatNumberItalian(NaN);         // '0,00'
 */
function formatNumberItalian(number, decimals = 2) {
  if (isNaN(number)) return '0,00';
  return number.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM FUNCTION — formula personalizzata per celle Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcola il totale ore lavorate su un cantiere specifico da tutti i fogli dipendente.
 *
 * Funzione personalizzata utilizzabile direttamente nelle celle Sheets con la
 * sintassi =TOTALE_ORE_CANTIERE("C001"). Scansiona tutti i fogli dipendente
 * (escludendo i fogli di sistema) e somma le ore dove CANTIERE_ID corrisponde.
 * Il risultato è arrotondato a 1 decimale.
 *
 * ATTENZIONE PERFORMANCE: questa funzione legge TUTTI i fogli dipendente ad
 * ogni ricalcolo. Su spreadsheet con molti dipendenti o molti dati può essere
 * lenta. Usare con moderazione nelle celle (non in loop).
 *
 * FLUSSO INTERNO:
 *   1. Verifica che cantiereId sia valido
 *   2. getActiveEmployeeNames() per la lista fogli dipendente
 *   3. Per ogni dipendente: getDataRange() → getValues() → somma se siteId === cantiereId
 *   4. Arrotonda a 1 decimale e ritorna
 *
 * CHIAMATA DA: celle Google Sheets (formula diretta)
 * CHIAMA:      getActiveEmployeeNames(), getMainSpreadsheet(), getDataRange(),
 *              CONFIG.DATA_STRUCTURE.COLUMNS
 *
 * @param {string} cantiereId - ID del cantiere (es. 'C001').
 * @returns {number} Totale ore (es. 47.5), o 0 se nessun dato trovato.
 * @customfunction
 * @example
 * // In una cella Sheets:
 * =TOTALE_ORE_CANTIERE("C001")
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
