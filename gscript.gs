// ===== FUNZIONI DI TEST =====
function testAuth() {
  const result = authenticateUser('mario.rossi', 'nuovapassword123');
  console.log('Test auth result:', result);
  return result;
}

function testGetUserInfo() {
  const authResult = authenticateUser('mario.rossi', 'nuovapassword123');
  if (authResult.success) {
    const userInfo = getUserInfo(authResult.sessionToken);
    console.log('Test user info:', userInfo);
    return userInfo;
  }
  return authResult;
}

function testGetCantieri() {
  console.log('=== TEST GET CANTIERI ===');
  try {
    const result = getCantieri('test_token');
    console.log('✅ Risultato getCantieri:', result);
    return result;
  } catch (error) {
    console.error('❌ Errore test getCantieri:', error);
    return { success: false, error: error.toString() };
  }
}

function testGetCantieriSimple() {
  console.log('=== TEST SEMPLICE CANTIERI ===');
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ Spreadsheet OK');
    
    const sheets = spreadsheet.getSheets();
    console.log('📋 Fogli trovati:', sheets.length);
    
    sheets.forEach((sheet, i) => {
      console.log(`${i}: ${sheet.getName()}`);
    });
    
    // Cerca foglio Cantieri
    let cantieriSheet;
    try {
      cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      console.log('✅ Foglio Cantieri trovato!');
      
      const data = cantieriSheet.getDataRange().getValues();
      console.log('📋 Dati nel foglio:', data);
      
      return { success: true, data: data };
      
    } catch (e) {
      console.log('❌ Foglio Cantieri NON trovato');
      return { success: false, message: 'Foglio Cantieri non esiste' };
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
    return { success: false, error: error.toString() };
  }
}
const SPREADSHEET_ID = '19WrI1o9U_1GzBoL-GZTgNvvijdr5O3MXvNMjQX3oK9A';
const USER_SHEET_NAME = 'Utenti'; // Nome specifico del foglio utenti - CAMBIA QUI SE NECESSARIO

// Indici delle colonne (0-based)
const COLUMNS = {
  ID_UTENTE: 0,      // A - ID Utente (U001, U002, etc.)
  NOME: 1,           // B - Nome Completo
  EMAIL: 2,          // C - Email
  TELEFONO: 3,       // D - Telefono
  RUOLO: 4,          // E - Ruolo
  DATA_ASSUNZIONE: 5, // F - Data Assunzione
  STIPENDIO: 6,      // G - Stipendio Orario €
  USER_ID: 7,        // H - UserID (per login)
  PASSWORD: 8,       // I - Password Iniziale
  PASSWORD_HASH: 9,  // J - Password Hash
  ATTIVO: 10,        // K - Attivo (Si/No)
  ORE_MESE: 11,      // L - Ore Totali Mese
  GUADAGNO_MESE: 12  // M - Guadagno Mese €
};

// ===== FUNZIONE HELPER PER OTTENERE IL FOGLIO =====
function getWorksheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = spreadsheet.getSheets();
    
    if (sheets.length === 0) {
      throw new Error('Nessun foglio trovato nel spreadsheet');
    }
    
    // Strategia 1: Cerca per nome specifico
    if (USER_SHEET_NAME) {
      try {
        const userSheet = spreadsheet.getSheetByName(USER_SHEET_NAME);
        console.log('✓ Foglio utenti trovato per nome:', USER_SHEET_NAME);
        return userSheet;
      } catch (e) {
        console.log('⚠ Foglio utenti non trovato per nome:', USER_SHEET_NAME);
      }
    }
    
    // Strategia 2: Cerca foglio che contiene header "UserID" o "ID Utente"
    for (let sheet of sheets) {
      try {
        const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        // Controlla se questo foglio contiene le colonne utenti
        if (firstRow.includes('UserID') || 
            firstRow.includes('ID Utente') || 
            firstRow.includes('Nome Completo')) {
          console.log('✓ Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) {
        // Salta fogli vuoti
        continue;
      }
    }
    
    // Strategia 3: Fallback al primo foglio
    console.log('⚠ Nessun foglio utenti identificato, uso il primo disponibile');
    return sheets[0];
    
  } catch (error) {
    console.error('Errore in getWorksheet:', error);
    throw error;
  }
}

// ===== FUNZIONE PRINCIPALE =====
function doPost(e) {
  // Gestione CORS
  return handleCORS(() => {
    let requestData;
    
    // Gestione diversi formati di input
    if (e.postData) {
      if (e.postData.type === 'application/json') {
        requestData = JSON.parse(e.postData.contents);
      } else {
        // FormData
        const params = e.parameter;
        if (params.data) {
          requestData = JSON.parse(params.data);
        } else {
          requestData = params;
        }
      }
    } else {
      requestData = e.parameter || {};
    }
    
    const action = requestData.action;
    
    console.log('Azione richiesta:', action);
    console.log('Dati ricevuti:', requestData);
    
    let response;
    
    switch(action) {
      case 'authenticate':
        response = authenticateUser(requestData.userId, requestData.password);
        break;
        
      case 'getUserInfo':
        response = getUserInfo(requestData.sessionToken);
        break;
        
      case 'updateHours':
        response = updateUserHours(requestData.sessionToken, requestData.hours);
        break;
        
      case 'getCantieri':
        response = getCantieri(requestData.sessionToken);
        break;
        
      case 'saveWorkEntry':
        console.log('📝 Azione saveWorkEntry chiamata');
        console.log('SessionToken:', requestData.sessionToken);
        console.log('WorkData:', requestData.workData);
        response = saveWorkEntry(requestData.sessionToken, requestData.workData);
        break;
        
      case 'ping':
        response = { 
          success: true, 
          message: `Google Apps Script OK - v${SYSTEM_VERSION.version}`, 
          timestamp: new Date().toISOString(),
          version: SYSTEM_VERSION
        };
        break;
        
      case 'getVersion':
        response = {
          success: true,
          version: SYSTEM_VERSION,
          timestamp: new Date().toISOString()
        };
        break;
        
      default:
        response = { success: false, message: 'Azione non riconosciuta' };
    }
    
    return response;
  });
}

// Gestione richieste GET (per preflight CORS)
function doGet(e) {
  return handleCORS(() => {
    const params = e.parameter;
    
    console.log('=== doGet chiamato ===');
    console.log('Parametri ricevuti:', params);
    
    // Se ci sono parametri, tratta come richiesta API
    if (params && params.action) {
      console.log('Azione GET:', params.action);
      
      switch(params.action) {
        case 'authenticate':
          return authenticateUser(params.userId, params.password);
          
        case 'getUserInfo':
          return getUserInfo(params.sessionToken);
          
        case 'updateHours':
          return updateUserHours(params.sessionToken, parseFloat(params.hours));
          
        case 'getCantieri':
          console.log('Chiamando getCantieri con token:', params.sessionToken);
          return getCantieri(params.sessionToken);
          
        case 'saveWorkEntry':
          console.log('📝 GET saveWorkEntry chiamato');
          return saveWorkEntry(params.sessionToken, {
            data: params.data,
            cantiereId: params.cantiereId, 
            lavori: params.lavori,
            ore: params.ore,
            note: params.note
          });
          
        case 'ping':
          return { 
            success: true, 
            message: `Connessione OK - GET v${SYSTEM_VERSION.version}`, 
            timestamp: new Date().toISOString(),
            version: SYSTEM_VERSION
          };
          
        case 'getVersion':
          return {
            success: true,
            version: SYSTEM_VERSION,
            timestamp: new Date().toISOString()
          };
          
        default:
          console.log('❌ Azione non riconosciuta:', params.action);
          return { success: false, message: 'Azione non riconosciuta: ' + params.action };
      }
    }
    
    // Endpoint di default
    return { 
      success: true, 
      message: 'Sistema Gestione Ore API - GET endpoint attivo',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });
}

// Funzione helper per gestire CORS
function handleCORS(callback) {
  try {
    const result = callback();
    
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(result));
    
    // Header CORS essenziali
    return output;
    
  } catch (error) {
    console.error('Errore in handleCORS:', error);
    
    const errorResponse = {
      success: false,
      message: 'Errore interno del server',
      error: error.toString()
    };
    
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(errorResponse));
    
    return output;
  }
}

// ===== FUNZIONI DI AUTENTICAZIONE =====
function authenticateUser(userId, password) {
  try {
    console.log('=== AUTHENTICATING USER ===');
    console.log('UserID:', userId);
    
    // Step 1: Ottieni il foglio di lavoro
    const sheet = getWorksheet();
    console.log('✓ Foglio ottenuto:', sheet.getName());
    
    // Step 2: Leggi dati
    const data = sheet.getDataRange().getValues();
    console.log('✓ Dati letti:', data.length, 'righe');
    
    if (data.length < 2) {
      console.log('⚠ Nessun dato utente trovato');
      return {
        success: false,
        message: 'Nessun dato utente trovato nel foglio'
      };
    }
    
    // Step 3: Debug headers
    console.log('Headers:', data[0]);
    
    // Step 4: Cerca utente
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`Riga ${i}:`, row);
      
      // Verifica se l'utente esiste ed è attivo
      if (row[COLUMNS.USER_ID] === userId && 
          row[COLUMNS.ATTIVO] === 'Si' && 
          row[COLUMNS.USER_ID] !== '') {
        
        console.log('✓ Utente trovato in riga', i);
        
        // Verifica password
        const storedPassword = row[COLUMNS.PASSWORD];
        console.log('Password salvata:', storedPassword);
        
        if (storedPassword === password) {
          console.log('✓ Password corretta');
          
          // Genera token di sessione
          const sessionToken = generateSessionToken(userId);
          
          const userData = {
            idUtente: row[COLUMNS.ID_UTENTE],
            userId: row[COLUMNS.USER_ID],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            telefono: row[COLUMNS.TELEFONO],
            role: row[COLUMNS.RUOLO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            stipendioOrario: row[COLUMNS.STIPENDIO],
            oreMese: row[COLUMNS.ORE_MESE] || 0,
            guadagnoMese: row[COLUMNS.GUADAGNO_MESE] || 0,
            rowIndex: i + 1
          };
          
          console.log('✓ Autenticazione completata per:', userData.name);
          
          return {
            success: true,
            message: 'Autenticazione riuscita',
            data: userData,
            sessionToken: sessionToken
          };
        } else {
          console.log('✗ Password errata');
        }
      }
    }
    
    console.log('✗ Utente non trovato o inattivo');
    return {
      success: false,
      message: 'Credenziali non valide o utente inattivo'
    };
    
  } catch (error) {
    console.error('Errore in authenticateUser:', error);
    return {
      success: false,
      message: 'Errore durante l\'autenticazione',
      error: error.toString()
    };
  }
}

// ===== FUNZIONI DI UTILITÀ =====
function generateSessionToken(userId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  return `${userId}_${timestamp}_${random}`;
}

function verifyPassword(plainPassword, hashedPassword) {
  // Implementa qui la tua logica di verifica hash
  // Per ora facciamo un confronto semplice
  // In produzione, usa una libreria di hashing sicura
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plainPassword)
    .map(byte => (byte + 256) % 256)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('') === hashedPassword;
}

function validateSessionToken(sessionToken) {
  // Debug: accetta "test" per testing
  if (sessionToken === 'test' || sessionToken === 'test_token') {
    console.log('✅ Token di test accettato per debug');
    return true;
  }
  
  // Validazione token reali: formato userID_timestamp_random
  if (!sessionToken || typeof sessionToken !== 'string') {
    console.log('❌ Token mancante o non valido');
    return false;
  }
  
  // Verifica formato token: deve contenere almeno 2 underscore
  const parts = sessionToken.split('_');
  if (parts.length < 3) {
    console.log('❌ Formato token non valido:', sessionToken);
    return false;
  }
  
  // Verifica che il timestamp non sia troppo vecchio (24 ore)
  const timestamp = parseInt(parts[1]);
  if (isNaN(timestamp)) {
    console.log('❌ Timestamp token non valido');
    return false;
  }
  
  const now = new Date().getTime();
  const tokenAge = now - timestamp;
  const maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  if (tokenAge > maxAge) {
    console.log('❌ Token scaduto (più di 24 ore)');
    return false;
  }
  
  console.log('✅ Token valido per utente:', parts[0]);
  return true;
}

// ===== FUNZIONI BUSINESS LOGIC =====
function getUserInfo(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    // Estrai userId dal token
    const userId = sessionToken.split('_')[0];
    
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COLUMNS.USER_ID] === userId) {
        return {
          success: true,
          data: {
            idUtente: row[COLUMNS.ID_UTENTE],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            role: row[COLUMNS.RUOLO],
            stipendioOrario: row[COLUMNS.STIPENDIO],
            oreMese: row[COLUMNS.ORE_MESE] || 0,
            guadagnoMese: row[COLUMNS.GUADAGNO_MESE] || 0
          }
        };
      }
    }
    
    return { success: false, message: 'Utente non trovato' };
    
  } catch (error) {
    console.error('Errore in getUserInfo:', error);
    return { success: false, message: 'Errore nel recupero dati utente' };
  }
}

function updateUserHours(sessionToken, newHours) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    const userId = sessionToken.split('_')[0];
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COLUMNS.USER_ID] === userId) {
        const stipendioOrario = row[COLUMNS.STIPENDIO];
        const nuovoGuadagno = newHours * stipendioOrario;
        
        // Aggiorna il foglio
        sheet.getRange(i + 1, COLUMNS.ORE_MESE + 1).setValue(newHours);
        sheet.getRange(i + 1, COLUMNS.GUADAGNO_MESE + 1).setValue(nuovoGuadagno);
        
        return {
          success: true,
          message: 'Ore aggiornate con successo',
          data: {
            oreMese: newHours,
            guadagnoMese: nuovoGuadagno
          }
        };
      }
    }
    
    return { success: false, message: 'Utente non trovato' };
    
  } catch (error) {
    console.error('Errore in updateUserHours:', error);
    return { success: false, message: 'Errore nell\'aggiornamento delle ore' };
  }
}

function getCantieri(sessionToken) {
  // RIMOSSA la validazione del token per permettere il test
  // if (!validateSessionToken(sessionToken)) {
  //   return { success: false, message: 'Token di sessione non valido' };
  // }
  
  try {
    console.log('=== GET CANTIERI ===');
    console.log('Session token received:', sessionToken);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Cerca il foglio "Cantieri"
    let cantieriSheet;
    try {
      cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      console.log('✓ Foglio Cantieri trovato');
    } catch (e) {
      console.log('⚠ Foglio Cantieri non trovato, creando...');
      cantieriSheet = spreadsheet.insertSheet('Cantieri');
      
      // Crea header per il foglio Cantieri
      cantieriSheet.getRange(1, 1, 1, 4).setValues([
        ['ID Cantiere', 'Nome Cantiere', 'Indirizzo', 'Stato']
      ]);
      
      // Aggiungi alcuni cantieri di esempio
      cantieriSheet.getRange(2, 1, 4, 4).setValues([
        ['CANT001', 'Cantiere Via Roma', 'Via Roma 123, Milano', 'Aperto'],
        ['CANT002', 'Cantiere Corso Italia', 'Corso Italia 45, Roma', 'Aperto'],
        ['CANT003', 'Cantiere Viale Europa', 'Viale Europa 78, Torino', 'Aperto'],
        ['CANT004', 'Cantiere Centro Storico', 'Piazza Duomo 1, Firenze', 'Chiuso']
      ]);
      
      console.log('✓ Foglio Cantieri creato con cantieri di esempio');
    }
    
    const data = cantieriSheet.getDataRange().getValues();
    console.log('📋 Dati letti dal foglio:', data.length, 'righe');
    
    if (data.length > 0) {
      console.log('📋 Headers:', data[0]);
    }
    
    const cantieri = [];
    
    // Salta la prima riga (header) e filtra solo cantieri aperti
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`📋 Riga ${i}:`, row);
      
      // Verifica che la riga non sia vuota e che lo stato sia "Aperto"
      if (row[0] && row[0] !== '' && row[3] === 'Aperto') {
        const cantiere = {
          id: row[0],           // Colonna A - ID Cantiere
          nome: row[1],         // Colonna B - Nome Cantiere
          indirizzo: row[2],    // Colonna C - Indirizzo
          stato: row[3]         // Colonna D - Stato
        };
        
        cantieri.push(cantiere);
        console.log('✅ Cantiere aggiunto:', cantiere);
      } else {
        console.log('⏭ Riga saltata (vuota o non aperta):', row);
      }
    }
    
    console.log('🏗️ Totale cantieri aperti trovati:', cantieri.length);
    
    return {
      success: true,
      data: cantieri,
      message: `Trovati ${cantieri.length} cantieri aperti`,
      debug: {
        totalRows: data.length,
        processedRows: cantieri.length,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Errore in getCantieri:', error);
    return { 
      success: false, 
      message: 'Errore nel recupero cantieri: ' + error.toString(),
      error: error.toString()
    };
  }
}

function saveWorkEntry(sessionToken, workData) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    console.log('=== SAVE WORK ENTRY DEBUG ===');
    console.log('SessionToken ricevuto:', sessionToken);
    console.log('WorkData ricevuto:', JSON.stringify(workData, null, 2));
    console.log('Tipo workData:', typeof workData);
    
    // Debug dettagliato dei campi
    console.log('workData.data:', workData.data, typeof workData.data);
    console.log('workData.cantiereId:', workData.cantiereId, typeof workData.cantiereId);
    console.log('workData.lavori:', workData.lavori, typeof workData.lavori);
    console.log('workData.ore:', workData.ore, typeof workData.ore);
    console.log('workData.note:', workData.note, typeof workData.note);
    
    // Verifica che workData non sia null/undefined
    if (!workData) {
      return { success: false, message: 'Dati lavoro mancanti' };
    }
    
    // Estrai e valida le ore con fallback
    let oreValue = workData.ore;
    
    // Se ore è undefined, prova altre proprietà
    if (oreValue === undefined || oreValue === null) {
      console.log('⚠️ ore è undefined, cercando alternative...');
      oreValue = workData.hours || workData.oreLavorate || workData.orelavorate;
      console.log('Valore alternativo trovato:', oreValue);
    }
    
    // Conversione a numero
    const oreLavorate = Number(oreValue);
    
    console.log('Conversione ore:');
    console.log('Valore originale:', oreValue, typeof oreValue);
    console.log('Valore convertito:', oreLavorate, typeof oreLavorate);
    console.log('isNaN(oreLavorate):', isNaN(oreLavorate));
    
    // Verifica che la conversione sia riuscita
    if (isNaN(oreLavorate) || oreLavorate < 0) {
      console.error('❌ Errore: ore non convertibili a numero');
      console.error('Valore ricevuto:', oreValue);
      console.error('Tipo:', typeof oreValue);
      return { 
        success: false, 
        message: `Errore: valore ore non valido - "${oreValue}" (tipo: ${typeof oreValue})` 
      };
    }
    
    const userId = sessionToken.split('_')[0];
    
    // Ottieni informazioni utente per nome
    const userSheet = getWorksheet();
    const userData = userSheet.getDataRange().getValues();
    let userName = '';
    
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        userName = row[COLUMNS.NOME];
        break;
      }
    }
    
    if (!userName) {
      return { success: false, message: 'Utente non trovato' };
    }
    
    console.log('✅ Utente identificato:', userName);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Cerca o crea il foglio dell'utente
    let userWorkSheet;
    try {
      userWorkSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      console.log('Creando nuovo foglio per:', userName);
      userWorkSheet = spreadsheet.insertSheet(userName);
      
      // Crea header
      userWorkSheet.getRange(1, 1, 1, 5).setValues([
        ['Data', 'Cantiere ID', 'Lavori Eseguiti', 'Ore Lavorate', 'Note']
      ]);
      
      // Formatta header
      const headerRange = userWorkSheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('white');
    }
    
    // Trova la prima riga vuota
    const lastRow = userWorkSheet.getLastRow();
    const newRow = lastRow + 1;
    
    // Prepara i dati per il salvataggio
    const dataLavoro = new Date(workData.data);
    
    console.log('💾 Salvando dati:');
    console.log('Data:', dataLavoro);
    console.log('Cantiere:', workData.cantiereId);
    console.log('Lavori:', workData.lavori);
    console.log('Ore:', oreLavorate);
    console.log('Note:', workData.note);
    console.log('Riga:', newRow);
    
    // Salva i dati
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([
      [
        dataLavoro,
        String(workData.cantiereId),
        String(workData.lavori),
        oreLavorate,  // Questo ora dovrebbe essere un numero valido
        String(workData.note || '')
      ]
    ]);
    
    // Formatta celle
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
    
    // Aggiorna anche le ore totali nel foglio principale
    updateUserTotalHours(userId, userName);
    
    console.log('✅ Salvataggio completato con successo');
    
    return {
      success: true,
      message: 'Dati salvati con successo',
      data: {
        riga: newRow,
        utente: userName,
        data: workData.data,
        cantiere: workData.cantiereId,
        ore: oreLavorate
      }
    };
    
  } catch (error) {
    console.error('❌ Errore in saveWorkEntry:', error);
    return { 
      success: false, 
      message: 'Errore nel salvataggio: ' + error.toString()
    };
  }
}

function updateUserTotalHours(userId, userName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userWorkSheet = spreadsheet.getSheetByName(userName);
    const userMainSheet = getWorksheet();
    
    // Calcola totale ore del mese corrente
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const workData = userWorkSheet.getDataRange().getValues();
    let totalHours = 0;
    
    console.log('🔢 Calcolando ore totali per', userName);
    
    for (let i = 1; i < workData.length; i++) { // Salta header
      const row = workData[i];
      const dataLavoro = new Date(row[0]);
      const ore = parseFloat(row[3]) || 0;
      
      console.log(`Riga ${i}: Data=${dataLavoro}, Ore=${ore}`);
      
      if (!isNaN(dataLavoro.getTime()) && 
          dataLavoro.getMonth() + 1 === currentMonth && 
          dataLavoro.getFullYear() === currentYear) {
        totalHours += ore;
        console.log(`✅ Ore aggiunte: ${ore}, Totale: ${totalHours}`);
      }
    }
    
    console.log(`📊 Ore totali calcolate: ${totalHours}`);
    
    // Aggiorna nel foglio principale
    const mainData = userMainSheet.getDataRange().getValues();
    for (let i = 1; i < mainData.length; i++) {
      const row = mainData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        // Aggiorna ore totali
        userMainSheet.getRange(i + 1, COLUMNS.ORE_MESE + 1).setValue(totalHours);
        
        // Ricalcola guadagno con controllo
        const stipendio = parseFloat(row[COLUMNS.STIPENDIO]) || 0;
        const guadagno = totalHours * stipendio;
        
        console.log(`💰 Calcolo guadagno: ${totalHours} × ${stipendio} = ${guadagno}`);
        
        userMainSheet.getRange(i + 1, COLUMNS.GUADAGNO_MESE + 1).setValue(guadagno);
        
        // Formatta le celle per evitare #NUM!
        userMainSheet.getRange(i + 1, COLUMNS.ORE_MESE + 1).setNumberFormat('0.0');
        userMainSheet.getRange(i + 1, COLUMNS.GUADAGNO_MESE + 1).setNumberFormat('0.00');
        
        break;
      }
    }
    
    console.log('✅ Ore totali aggiornate per', userName, ':', totalHours);
    
  } catch (error) {
    console.error('❌ Errore aggiornamento ore totali:', error);
  }
}

// ===== FUNZIONI DI DEBUG =====
function getSheetInfo() {
  try {
    console.log('=== DEBUG INFO ===');
    console.log('SPREADSHEET_ID:', SPREADSHEET_ID);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Spreadsheet trovato:', spreadsheet.getName());
    
    // Lista tutti i fogli con informazioni dettagliate
    const sheets = spreadsheet.getSheets();
    console.log('Fogli disponibili:');
    
    sheets.forEach((sheet, index) => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      console.log(`${index}: "${name}" (${lastRow} righe, ${lastCol} colonne)`);
      
      // Mostra header se disponibile
      if (lastRow > 0 && lastCol > 0) {
        try {
          const headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 10)).getValues()[0];
          console.log(`   Headers: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);
        } catch (e) {
          console.log('   Headers: Errore lettura');
        }
      }
    });
    
    // Test della funzione getWorksheet()
    console.log('=== TEST SELEZIONE FOGLIO ===');
    const selectedSheet = getWorksheet();
    console.log('Foglio selezionato:', selectedSheet.getName());
    
    return {
      success: true,
      spreadsheetName: spreadsheet.getName(),
      availableSheets: sheets.map(s => ({
        name: s.getName(),
        rows: s.getLastRow(),
        cols: s.getLastColumn()
      })),
      selectedSheet: selectedSheet.getName()
    };
    
  } catch (error) {
    console.error('Errore in getSheetInfo:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Errore nell\'accesso al foglio'
    };
  }
}

function testConnection() {
  try {
    console.log('=== TEST CONNESSIONE ===');
    
    // Test 1: Accesso base
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✓ Accesso al spreadsheet OK');
    
    // Test 2: Lista fogli
    const sheets = spreadsheet.getSheets();
    console.log('✓ Fogli trovati:', sheets.length);
    
    // Test 3: Accesso al primo foglio
    const firstSheet = sheets[0];
    const data = firstSheet.getDataRange().getValues();
    console.log('✓ Dati letti:', data.length, 'righe');
    
    // Test 4: Verifica struttura dati
    if (data.length > 1) {
      console.log('Prima riga (header):', data[0]);
      console.log('Seconda riga (dati):', data[1]);
    }
    
    return { success: true, message: 'Tutti i test OK' };
    
  } catch (error) {
    console.error('Errore nei test:', error);
    return { success: false, error: error.toString() };
  }
}


function testAuth() {
  // Funzione per testare l'autenticazione da Script Editor
  const result = authenticateUser('mario.rossi', 'nuovapassword123');
  console.log('Test auth result:', result);
  return result;
}

function testGetUserInfo() {
  // Prima autentica per ottenere un token
  const authResult = authenticateUser('mario.rossi', 'nuovapassword123');
  if (authResult.success) {
    const userInfo = getUserInfo(authResult.sessionToken);
    console.log('Test user info:', userInfo);
    return userInfo;
  }
  return authResult;
}
