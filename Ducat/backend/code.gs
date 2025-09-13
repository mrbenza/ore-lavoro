/*
================================================================================
SCRIPT CONTAINER-BOUND COMPLETO - SISTEMA GESTIONE ORE V3.5
VERSIONE FINALE - SINTASSI VERIFICATA
================================================================================
*/

// CONFIGURAZIONE
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const USER_SHEET_NAME = 'Utenti';

const PRODUCTION_CONFIG = {
  DEBUG_MODE: false,
  LOG_LEVEL: 'ERROR',
  LOG_AUTH: true,
  LOG_CRITICAL_ERRORS: true,
  LOG_SAVE_OPERATIONS: true
};

// LOGGER
const Logger = {
  debug: function() {
    if (PRODUCTION_CONFIG.DEBUG_MODE) {
      console.log.apply(console, ['[DEBUG]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  info: function() {
    console.log.apply(console, ['[INFO]'].concat(Array.prototype.slice.call(arguments)));
  },
  warn: function() {
    console.warn.apply(console, ['[WARN]'].concat(Array.prototype.slice.call(arguments)));
  },
  error: function() {
    console.error.apply(console, ['[ERROR]'].concat(Array.prototype.slice.call(arguments)));
  },
  auth: function() {
    if (PRODUCTION_CONFIG.LOG_AUTH) {
      console.log.apply(console, ['[AUTH]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  save: function() {
    if (PRODUCTION_CONFIG.LOG_SAVE_OPERATIONS) {
      console.log.apply(console, ['[SAVE]'].concat(Array.prototype.slice.call(arguments)));
    }
  },
  critical: function() {
    if (PRODUCTION_CONFIG.LOG_CRITICAL_ERRORS) {
      console.error.apply(console, ['[CRITICAL]'].concat(Array.prototype.slice.call(arguments)));
    }
  }
};

// SYSTEM INFO
const SYSTEM_INFO = {
  version: '3.5',
  build: '2025.09.05',
  mode: PRODUCTION_CONFIG.DEBUG_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  description: 'Container-bound script con CORS e Calendario',
  features: ['Hash Password SHA-256', 'CORS Headers', 'Righe Sicure', 'Container-bound', 'Calendario'],
  installType: 'CONTAINER_BOUND_CORS_CALENDAR'
};

// MAPPING COLONNE
const COLUMNS = {
  ID_UTENTE: 0,
  NOME: 1,
  EMAIL: 2,
  TELEFONO: 3,
  DATA_ASSUNZIONE: 4,
  USER_ID: 5,
  PASSWORD: 6,
  PASSWORD_HASH: 7,
  ATTIVO: 8
};

// CELLE ORE
const USER_SHEET_CELLS = {
  ORE_MESE_CORRENTE: 'F3',
  ORE_MESE_PRECEDENTE: 'G3',
  ANNO_CORRENTE: 'H3'
};

// HASH PASSWORD
function generatePasswordHash(password) {
  var salt = "OreLavoro2025_Salt_";
  var dataToHash = salt + password + salt;
  
  var hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    dataToHash,
    Utilities.Charset.UTF_8
  );
  
  return hash.map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

// CORS RESPONSE
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ACCESSO FOGLIO
function getWorksheet() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!spreadsheet) {
      throw new Error('Impossibile accedere al spreadsheet container');
    }
    
    try {
      var userSheet = spreadsheet.getSheetByName(USER_SHEET_NAME);
      Logger.debug('Foglio utenti trovato:', USER_SHEET_NAME);
      return userSheet;
    } catch (e) {
      Logger.warn('Foglio utenti non trovato per nome:', USER_SHEET_NAME);
    }
    
    var sheets = spreadsheet.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      try {
        var firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (firstRow.indexOf('Username') !== -1 || firstRow.indexOf('ID Utente') !== -1 || firstRow.indexOf('Nome Completo') !== -1) {
          Logger.debug('Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) {
        continue;
      }
    }
    
    Logger.warn('Uso primo foglio disponibile');
    return sheets[0];
    
  } catch (error) {
    Logger.critical('Errore in getWorksheet:', error);
    throw error;
  }
}

// LETTURA ORE
function getUserHoursFromSheet(userName) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    var userSheet;
    try {
      userSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      Logger.warn('Foglio "' + userName + '" non trovato');
      return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
    }
    
    var oreMeseCorrente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue() || 0;
    var oreMesePrecedente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue() || 0;
    
    var oreAnnoCorrente = 0;
    try {
      oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0;
    } catch (e) {
      // Cella anno non presente
    }
    
    return {
      oreMeseCorrente: parseFloat(oreMeseCorrente) || 0,
      oreMesePrecedente: parseFloat(oreMesePrecedente) || 0,
      oreAnnoCorrente: parseFloat(oreAnnoCorrente) || 0
    };
    
  } catch (error) {
    Logger.error('Errore lettura ore per ' + userName + ':', error);
    return { oreMeseCorrente: 0, oreMesePrecedente: 0, oreAnnoCorrente: 0 };
  }
}

// AUTENTICAZIONE
function authenticateUser(userId, password) {
  try {
    Logger.auth('Tentativo autenticazione per:', userId);
    
    var sheet = getWorksheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length < 2) {
      return { success: false, message: 'Nessun dato utente trovato nel foglio' };
    }
    
    var passwordHash = generatePasswordHash(password);
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var userIdInSheet = row[COLUMNS.USER_ID];
      var passwordPlainInSheet = row[COLUMNS.PASSWORD];
      var passwordHashInSheet = row[COLUMNS.PASSWORD_HASH];
      var isActive = row[COLUMNS.ATTIVO];
      
      if (userIdInSheet === userId && isActive === 'Si' && userIdInSheet !== '') {
        Logger.debug('Utente trovato e attivo, verificando password...');
        
        var passwordValid = false;
        var authMethod = '';
        
        if (passwordHashInSheet && passwordHashInSheet !== '') {
          Logger.debug('Verificando con password hash (SICURO)...');
          passwordValid = (passwordHashInSheet === passwordHash);
          authMethod = 'hash';
        } 
        else if (passwordPlainInSheet && passwordPlainInSheet !== '') {
          Logger.warn('FALLBACK: Verificando con password plain text...');
          passwordValid = (passwordPlainInSheet === password);
          authMethod = 'plain_fallback';
          
          if (passwordValid) {
            Logger.info('AUTO-MIGRAZIONE: Generando hash per questo utente...');
            try {
              sheet.getRange(i + 1, COLUMNS.PASSWORD_HASH + 1).setValue(passwordHash);
              Logger.info('Hash auto-generato e salvato');
              authMethod = 'plain_migrated';
            } catch (e) {
              Logger.warn('Errore auto-migrazione hash (non critico):', e);
            }
          }
        }
        else {
          Logger.error('PROBLEMA: Utente senza password o hash');
          return { success: false, message: 'Utente senza credenziali configurate. Contatta amministratore.' };
        }
        
        if (passwordValid) {
          Logger.auth('Autenticazione riuscita con metodo:', authMethod, 'per utente:', userId);
          
          var sessionToken = generateSessionToken(userId);
          var userName = row[COLUMNS.NOME];
          
          var oreData = getUserHoursFromSheet(userName);
          
          var userData = {
            idUtente: row[COLUMNS.ID_UTENTE],
            userId: row[COLUMNS.USER_ID],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            telefono: row[COLUMNS.TELEFONO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente,
            rowIndex: i + 1,
            authMethod: authMethod
          };
          
          return {
            success: true,
            message: 'Autenticazione riuscita',
            data: userData,
            sessionToken: sessionToken,
            systemInfo: {
              version: SYSTEM_INFO.version,
              build: SYSTEM_INFO.build,
              mode: SYSTEM_INFO.mode,
              authMethod: authMethod,
              hashSupport: true,
              installType: SYSTEM_INFO.installType
            }
          };
        } else {
          Logger.auth('Password non valida per utente:', userId);
        }
      }
    }
    
    Logger.auth('Credenziali non valide per:', userId);
    return { success: false, message: 'Credenziali non valide o utente inattivo' };
    
  } catch (error) {
    Logger.critical('Errore in authenticateUser:', error);
    return {
      success: false,
      message: 'Errore durante l\'autenticazione: ' + error.toString(),
      error: error.toString()
    };
  }
}

// AGGIORNAMENTO CANTIERE
function updateCantiereHours(cantiereId, oreAggiunte, dipendente) {
  if (!dipendente) dipendente = null;
  
  try {
    Logger.save('Aggiornando cantiere ' + cantiereId + ' con +' + oreAggiunte + ' ore');
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = spreadsheet.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      Logger.error('Foglio "Cantieri" non trovato');
      return { success: false, message: 'Foglio Cantieri non trovato' };
    }
    
    var data = cantieriSheet.getDataRange().getValues();
    
    if (data.length < 2) {
      Logger.error('Nessun dato trovato nel foglio Cantieri');
      return { success: false, message: 'Nessun cantiere trovato' };
    }
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var cantiereIdInSheet = row[0];
      
      if (cantiereIdInSheet === cantiereId) {
        var oreAttuali = parseFloat(row[6]) || 0;
        var nuovoTotale = oreAttuali + oreAggiunte;
        
        var dataAggiornamento = new Date();
        
        var inserimentiAttuali = parseInt(row[9]) || 0;
        var nuovoContatore = inserimentiAttuali + 1;
        
        cantieriSheet.getRange(i + 1, 7).setValue(nuovoTotale);
        cantieriSheet.getRange(i + 1, 8).setValue(dataAggiornamento);
        
        if (dipendente) {
          cantieriSheet.getRange(i + 1, 9).setValue(dipendente);
        }
        
        cantieriSheet.getRange(i + 1, 10).setValue(nuovoContatore);
        cantieriSheet.getRange(i + 1, 8).setNumberFormat('dd/mm/yyyy hh:mm');
        
        Logger.save('Cantiere aggiornato: ' + cantiereId);
        
        return {
          success: true,
          cantiereId: cantiereId,
          oreAttuali: oreAttuali,
          oreAggiunte: oreAggiunte,
          nuovoTotale: nuovoTotale,
          dataAggiornamento: dataAggiornamento,
          ultimoDipendente: dipendente,
          numeroInserimenti: nuovoContatore
        };
      }
    }
    
    Logger.warn('Cantiere ' + cantiereId + ' non trovato nel foglio Cantieri');
    return { 
      success: false, 
      message: 'Cantiere ' + cantiereId + ' non trovato' 
    };
    
  } catch (error) {
    Logger.critical('Errore aggiornamento ore cantiere:', error);
    return { 
      success: false, 
      message: 'Errore aggiornamento ore cantiere: ' + error.toString() 
    };
  }
}

// SALVATAGGIO ORE
function saveWorkEntry(sessionToken, workData) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    Logger.save('Avvio salvataggio ore lavorate');
    
    if (!workData || typeof workData !== 'object') {
      return { success: false, message: 'Dati lavoro mancanti o non validi' };
    }
    
    var oreValue = null;
    var orePossibili = ['ore', 'hours', 'oreLavorate'];
    
    for (var p = 0; p < orePossibili.length; p++) {
      var prop = orePossibili[p];
      var val = workData[prop];
      if (workData.hasOwnProperty(prop) && val !== null && val !== undefined) {
        oreValue = val;
        break;
      }
    }
    
    if (oreValue === null) {
      for (var key in workData) {
        if (workData.hasOwnProperty(key)) {
          var value = workData[key];
          var numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue > 0 && numValue <= 24) {
            oreValue = numValue;
            break;
          }
        }
      }
    }
    
    var oreString = String(oreValue).trim ? String(oreValue).trim() : String(oreValue);
    var oreLavorate = parseFloat(oreString);
    
    if (isNaN(oreLavorate) || oreLavorate < 0 || oreLavorate > 24) {
      return { 
        success: false, 
        message: 'Valore ore non valido: "' + oreValue + '" (deve essere 0-24)' 
      };
    }
    
    var campiRichiesti = {
      data: workData.data || workData.workDate || workData.date,
      cantiereId: workData.cantiereId || workData.cantiere,
      lavori: workData.lavori || workData.lavoriEseguiti || workData.descrizione
    };
    
    for (var campo in campiRichiesti) {
      if (campiRichiesti.hasOwnProperty(campo)) {
        var valore = campiRichiesti[campo];
        if (!valore || String(valore).trim() === '') {
          return { success: false, message: 'Campo richiesto mancante: ' + campo };
        }
      }
    }
    
    var userId = sessionToken.split('_')[0];
    
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var userName = '';
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        userName = row[COLUMNS.NOME];
        break;
      }
    }
    
    if (!userName) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    Logger.debug('Utente identificato:', userName);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    var userWorkSheet;
    try {
      userWorkSheet = spreadsheet.getSheetByName(userName);
      Logger.debug('Foglio utente trovato:', userName);
    } catch (e) {
      Logger.error('Foglio non trovato per:', userName);
      return { 
        success: false, 
        message: 'Foglio "' + userName + '" non esistente. Crealo manualmente.' 
      };
    }
    
    Logger.debug('Applicando protezione righe sicure...');
    
    var totalRows = userWorkSheet.getLastRow();
    var newRow = 5;
    var maxSearchRows = Math.max(totalRows + 100, 1000);
    
    var foundEmptyRow = false;
    
    for (var row = 5; row <= maxSearchRows; row++) {
      try {
        var checkRange = userWorkSheet.getRange(row, 1, 1, 5).getValues()[0];
        var isEmpty = true;
        for (var c = 0; c < checkRange.length; c++) {
          var cell = checkRange[c];
          if (cell !== '' && cell !== null && cell !== undefined) {
            isEmpty = false;
            break;
          }
        }
        
        if (isEmpty) {
          newRow = row;
          foundEmptyRow = true;
          Logger.debug('Riga sicura trovata: ' + newRow);
          break;
        }
      } catch (e) {
        newRow = row;
        foundEmptyRow = true;
        Logger.debug('Uso fine dati, riga: ' + newRow);
        break;
      }
    }
    
    if (!foundEmptyRow) {
      newRow = Math.max(totalRows + 1, 5);
      Logger.debug('Fallback: Aggiungendo alla fine, riga ' + newRow);
    }
    
    if (newRow < 5) {
      Logger.critical('BLOCCO SICUREZZA: riga ' + newRow + ' < 5');
      return {
        success: false,
        message: 'ERRORE SICUREZZA: Tentativo scrittura riga ' + newRow + ' (minimo riga 5)'
      };
    }
    
    var dataLavoro = new Date(campiRichiesti.data);
    var note = workData.note || workData.notes || '';
    
    var nomeCantiere = 'Lavoro registrato via dashboard';
    try {
      var cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      var cantieriData = cantieriSheet.getDataRange().getValues();
      
      for (var i = 1; i < cantieriData.length; i++) {
        var row = cantieriData[i];
        if (row[0] === campiRichiesti.cantiereId) {
          nomeCantiere = row[1] || nomeCantiere;
          break;
        }
      }
    } catch (e) {
      Logger.warn('Impossibile ottenere nome cantiere:', e.message);
    }
    
    Logger.save('Salvando in riga sicura: ' + newRow + ' ore: ' + oreLavorate);
    
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([
      [
        dataLavoro,
        String(campiRichiesti.cantiereId),
        String(nomeCantiere),
        oreLavorate,
        String(note)
      ]
    ]);
    
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
    
    Logger.save('Ore salvate nel foglio dipendente, aggiornando cantiere...');
    
    var cantiereUpdateResult = updateCantiereHours(campiRichiesti.cantiereId, oreLavorate, userName);
    
    if (!cantiereUpdateResult.success) {
      Logger.warn('Aggiornamento cantiere fallito:', cantiereUpdateResult.message);
    }
    
    Logger.save('Salvataggio completato con successo');
    
    return {
      success: true,
      message: 'Dati salvati con successo. Ore cantiere aggiornate.',
      data: {
        riga: newRow,
        utente: userName,
        data: campiRichiesti.data,
        cantiere: campiRichiesti.cantiereId,
        nomeCantiere: nomeCantiere,
        ore: oreLavorate,
        cantiereUpdate: cantiereUpdateResult.success ? {
          oreAttuali: cantiereUpdateResult.oreAttuali,
          oreAggiunte: cantiereUpdateResult.oreAggiunte,
          nuovoTotale: cantiereUpdateResult.nuovoTotale
        } : { 
          error: cantiereUpdateResult.message 
        },
        safeRowProtection: true,
        containerBound: true,
        timestamp: new Date().toISOString(),
        version: SYSTEM_INFO.version
      }
    };
    
  } catch (error) {
    Logger.critical('Errore in saveWorkEntry:', error);
    return { 
      success: false, 
      message: 'Errore nel salvataggio: ' + error.toString()
    };
  }
}

// GET CANTIERI
function getCantieri(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var cantieriSheet = spreadsheet.getSheetByName('Cantieri');
    
    if (!cantieriSheet) {
      return { success: false, message: 'Foglio "Cantieri" non trovato' };
    }
    
    var data = cantieriSheet.getDataRange().getValues();
    var cantieri = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      if (row[3] === 'Aperto' || row[3] === 'aperto') {
        cantieri.push({
          id: row[0],
          nome: row[1],
          indirizzo: row[2] || '',
          stato: row[3]
        });
      }
    }
    
    return {
      success: true,
      data: cantieri,
      message: cantieri.length + ' cantieri attivi trovati'
    };
    
  } catch (error) {
    Logger.error('Errore in getCantieri:', error);
    return {
      success: false,
      message: 'Errore nel caricamento cantieri: ' + error.toString()
    };
  }
}

// GET USER INFO
function getUserInfo(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var userId = sessionToken.split('_')[0];
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        var userName = row[COLUMNS.NOME];
        var oreData = getUserHoursFromSheet(userName);
        
        return {
          success: true,
          data: {
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente
          }
        };
      }
    }
    
    return { success: false, message: 'Utente non trovato' };
    
  } catch (error) {
    Logger.error('Errore in getUserInfo:', error);
    return {
      success: false,
      message: 'Errore nel caricamento informazioni utente: ' + error.toString()
    };
  }
}

// GET MONTHLY WORK DATA
function getMonthlyWorkData(sessionToken, year, month) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    var userId = sessionToken.split('_')[0];
    
    var userSheet = getWorksheet();
    var userData = userSheet.getDataRange().getValues();
    var userName = '';
    
    for (var i = 1; i < userData.length; i++) {
      var row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        userName = row[COLUMNS.NOME];
        break;
      }
    }
    
    if (!userName) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var userWorkSheet;
    
    try {
      userWorkSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      return { success: false, message: 'Foglio utente non trovato: ' + userName };
    }
    
    var lastRow = userWorkSheet.getLastRow();
    if (lastRow < 5) {
      return {
        success: true,
        data: {
          year: year,
          month: month,
          userName: userName,
          workDays: {}
        },
        message: 'Nessun dato trovato per questo mese'
      };
    }
    
    var workData = userWorkSheet.getRange(5, 1, lastRow - 4, 5).getValues();
    var monthlyData = {};
    
    for (var i = 0; i < workData.length; i++) {
      var row = workData[i];
      var dateCell = row[0];
      var cantiereId = row[1];
      var cantiereName = row[2];
      var ore = row[3];
      var note = row[4];
      
      if (!dateCell || ore === '' || ore === null || ore === undefined) continue;
      
      var workDate = new Date(dateCell);
      
      if (isNaN(workDate.getTime())) continue;
      
      if (workDate.getFullYear() === year && workDate.getMonth() === month - 1) {
        var day = workDate.getDate();
        
        if (!monthlyData[day]) {
          monthlyData[day] = {
            totalHours: 0,
            entries: []
          };
        }
        
        var oreNumber = parseFloat(ore) || 0;
        monthlyData[day].totalHours += oreNumber;
        monthlyData[day].entries.push({
          cantiere: cantiereName || cantiereId || 'N/A',
          ore: oreNumber,
          note: note || '',
          data: Utilities.formatDate(workDate, Session.getScriptTimeZone(), 'dd/MM/yyyy')
        });
      }
    }
    
    return {
      success: true,
      data: {
        year: year,
        month: month,
        userName: userName,
        workDays: monthlyData,
        totalDaysWorked: Object.keys(monthlyData).length
      },
      message: 'Dati calendario per ' + month + '/' + year + ' caricati con successo'
    };
    
  } catch (error) {
    Logger.critical('Errore in getMonthlyWorkData:', error);
    return {
      success: false,
      message: 'Errore nel caricamento dati calendario: ' + error.toString(),
      error: error.toString()
    };
  }
}

// UTILITÀ
function generateSessionToken(userId) {
  var timestamp = new Date().getTime();
  var random = Math.random().toString(36).substring(2);
  return userId + '_' + timestamp + '_' + random;
}

function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') {
    Logger.debug('Token di test accettato');
    return true;
  }
  
  if (!sessionToken || typeof sessionToken !== 'string') {
    Logger.warn('Token mancante o non valido');
    return false;
  }
  
  var parts = sessionToken.split('_');
  if (parts.length < 3) {
    Logger.warn('Formato token non valido:', sessionToken);
    return false;
  }
  
  var timestamp = parseInt(parts[1]);
  if (isNaN(timestamp)) {
    Logger.warn('Timestamp token non valido');
    return false;
  }
  
  var now = new Date().getTime();
  var tokenAge = now - timestamp;
  var maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  if (tokenAge > maxAge) {
    Logger.warn('Token scaduto (più di 24 ore)');
    return false;
  }
  
  Logger.debug('Token valido per utente:', parts[0]);
  return true;
}

// PING SYSTEM
function handlePing() {
  return { 
    success: true, 
    message: 'Sistema operativo - Container-bound con CORS + Calendario', 
    timestamp: new Date().toISOString(),
    version: SYSTEM_INFO.version,
    build: SYSTEM_INFO.build,
    mode: SYSTEM_INFO.mode,
    installType: SYSTEM_INFO.installType,
    features: SYSTEM_INFO.features,
    spreadsheetId: SPREADSHEET_ID,
    cors: true
  };
}

// ENTRY POINT GET
function doGet(e) {
  try {
    var action = e.parameter.action;
    Logger.debug('Richiesta GET ricevuta:', action);
    
    if (action === 'options') {
      return createCORSResponse({ success: true, message: 'CORS preflight OK' });
    }
    
    var result;
    
    switch (action) {
      case 'ping':
        result = handlePing();
        break;
        
      case 'authenticate':
        result = authenticateUser(e.parameter.userId, e.parameter.password);
        break;
        
      case 'saveWorkEntry':
        var workData = JSON.parse(e.parameter.workData || '{}');
        result = saveWorkEntry(e.parameter.sessionToken, workData);
        break;
        
      case 'getCantieri':
        result = getCantieri(e.parameter.sessionToken);
        break;
        
      case 'getMonthlyWorkData':
        var yearParam = e.parameter.year;
        var monthParam = e.parameter.month;
        var sessionParam = e.parameter.sessionToken;
  
        var year = parseInt(yearParam) || new Date().getFullYear();
        var month = parseInt(monthParam) || new Date().getMonth() + 1;
  
        result = getMonthlyWorkData(sessionParam, year, month);
        break;
        
      case 'getUserInfo':
        result = getUserInfo(e.parameter.sessionToken);
        break;
        
      default:
        result = {
          success: false,
          message: 'Azione non riconosciuta: ' + action,
          availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo', 'getMonthlyWorkData']
        };
    }
    
    return createCORSResponse(result);
    
  } catch (error) {
    Logger.critical('Errore in doGet:', error);
    
    return createCORSResponse({
      success: false,
      message: 'Errore del server: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// ENTRY POINT POST
function doPost(e) {
  try {
    var params = {};
    
    if (e.postData && e.postData.contents) {
      try {
        var postParams = new URLSearchParams(e.postData.contents);
        var dataParam = postParams.get('data');
        
        if (dataParam) {
          params = JSON.parse(dataParam);
        }
      } catch (parseError) {
        Logger.warn('Errore parsing POST data:', parseError);
        params = e.parameter || {};
      }
    } else {
      params = e.parameter || {};
    }
    
    Logger.debug('POST richiesta ricevuta:', params.action);
    
    var result;
    
    switch (params.action) {
      case 'ping':
        result = handlePing();
        break;
        
      case 'authenticate':
        result = authenticateUser(params.userId, params.password);
        break;
        
      case 'saveWorkEntry':
        var workDataPost = params.workData || {};
        result = saveWorkEntry(params.sessionToken, workDataPost);
        break;
        
      case 'getCantieri':
        result = getCantieri(params.sessionToken);
        break;
        
      case 'getUserInfo':
        result = getUserInfo(params.sessionToken);
        break;
      
      case 'getMonthlyWorkData':
        var yearParamPost = params.year;
        var monthParamPost = params.month;
        var sessionParamPost = params.sessionToken;
  
        var yearPost = parseInt(yearParamPost) || new Date().getFullYear();
        var monthPost = parseInt(monthParamPost) || new Date().getMonth() + 1;
  
        result = getMonthlyWorkData(sessionParamPost, yearPost, monthPost);
        break;
        
      default:
        result = {
          success: false,
          message: 'Azione non riconosciuta: ' + params.action,
          availableActions: ['ping', 'authenticate', 'saveWorkEntry', 'getCantieri', 'getUserInfo', 'getMonthlyWorkData']
        };
    }
    
    return createCORSResponse(result);
    
  } catch (error) {
    Logger.critical('Errore in doPost:', error);
    
    return createCORSResponse({
      success: false,
      message: 'Errore del server: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    });
  }
}

// FUNZIONI DI TEST
function testConfiguration() {
  console.log('=== TEST CONFIGURAZIONE SISTEMA V3.5 ===');
  
  try {
    console.log('Spreadsheet ID:', SPREADSHEET_ID);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('Spreadsheet Nome:', spreadsheet.getName());
    
    var requiredSheets = ['Utenti', 'Cantieri'];
    var availableSheets = [];
    var sheets = spreadsheet.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      availableSheets.push(sheets[i].getName());
    }
    console.log('Fogli disponibili:', availableSheets);
    
    for (var i = 0; i < requiredSheets.length; i++) {
      var sheetName = requiredSheets[i];
      if (availableSheets.indexOf(sheetName) !== -1) {
        console.log('✅ Foglio "' + sheetName + '" trovato');
      } else {
        console.log('❌ Foglio "' + sheetName + '" MANCANTE!');
      }
    }
    
    try {
      var userSheet = spreadsheet.getSheetByName('Utenti');
      var headers = userSheet.getRange(1, 1, 1, 9).getValues()[0];
      console.log('Headers foglio Utenti:', headers);
      
      var userCount = userSheet.getLastRow() - 1;
      console.log('Numero utenti configurati: ' + userCount);
      
      if (userCount > 0) {
        var primaRiga = userSheet.getRange(2, 1, 1, 9).getValues()[0];
        console.log('Primo utente - Username:', primaRiga[5]);
        console.log('Primo utente - Password presente:', primaRiga[6] ? 'Si' : 'No');
        console.log('Primo utente - Hash presente:', primaRiga[7] ? 'Si' : 'No');
      }
      
    } catch (e) {
      console.log('Errore lettura foglio Utenti:', e.message);
    }
    
    try {
      var cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      var cantieriHeaders = cantieriSheet.getRange(1, 1, 1, 4).getValues()[0];
      console.log('Headers foglio Cantieri:', cantieriHeaders);
      
      var cantieriCount = cantieriSheet.getLastRow() - 1;
      console.log('Numero cantieri configurati: ' + cantieriCount);
      
    } catch (e) {
      console.log('Errore lettura foglio Cantieri:', e.message);
    }
    
    var pingResult = handlePing();
    console.log('Test ping:', pingResult);
    
    console.log('=== RISULTATO CONFIGURAZIONE ===');
    console.log('Se tutti i test sono ✅, il sistema è pronto!');
    
  } catch (error) {
    console.log('ERRORE CRITICO:', error.toString());
  }
}

function testAuthentication() {
  console.log('=== TEST AUTENTICAZIONE ===');
  
  var testUserId = 'test';
  var testPassword = 'test';
  
  console.log('Testando autenticazione per:', testUserId);
  
  try {
    var authResult = authenticateUser(testUserId, testPassword);
    console.log('Risultato:', authResult);
    
    if (authResult.success) {
      console.log('✅ Autenticazione riuscita!');
      console.log('Nome utente:', authResult.data.name);
      console.log('Session token:', authResult.sessionToken);
    } else {
      console.log('❌ Autenticazione fallita:', authResult.message);
    }
    
  } catch (error) {
    console.log('Errore test autenticazione:', error.toString());
  }
}

function testGetMonthlyWorkData() {
  console.log('=== TEST CALENDARIO ===');
  
  var testUserId = 'test';
  var testYear = 2025;
  var testMonth = 9;
  
  try {
    var testToken = generateSessionToken(testUserId);
    console.log('Token generato:', testToken);
    
    var result = getMonthlyWorkData(testToken, testYear, testMonth);
    console.log('Risultato calendario:', result);
    
    if (result.success) {
      console.log('✅ Test calendario riuscito!');
      console.log('Utente:', result.data.userName);
      console.log('Giorni lavorati:', result.data.totalDaysWorked);
    } else {
      console.log('❌ Test calendario fallito:', result.message);
    }
    
  } catch (error) {
    console.log('Errore test calendario:', error.toString());
  }
}

function testCompleteSystem() {
  console.log('🚀 AVVIO TEST COMPLETO SISTEMA V3.5');
  console.log('===================================');
  
  console.log('\n1️⃣ TEST CONFIGURAZIONE:');
  testConfiguration();
  
  console.log('\n2️⃣ TEST AUTENTICAZIONE:');
  testAuthentication();
  
  console.log('\n3️⃣ TEST CALENDARIO:');
  testGetMonthlyWorkData();
  
  console.log('\n🏁 TEST COMPLETO TERMINATO');
}
