// ===== CONFIGURAZIONE =====
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
  try {
    // Abilita CORS
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    // Parse del JSON dalla richiesta
    const requestData = JSON.parse(e.postData.contents);
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
        
      case 'getMonthlyReport':
        response = getMonthlyReport(requestData.sessionToken);
        break;
        
      case 'ping':
        response = { success: true, message: 'Connessione OK', timestamp: new Date().toISOString() };
        break;
        
      default:
        response = { success: false, message: 'Azione non riconosciuta' };
    }
    
    output.setContent(JSON.stringify(response));
    return output;
    
  } catch (error) {
    console.error('Errore in doPost:', error);
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
  // Implementa validazione del token
  // Per ora accettiamo tutti i token non vuoti
  return sessionToken && sessionToken.length > 0;
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

function getMonthlyReport(sessionToken) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    let report = {
      totaleDipendenti: 0,
      dipendentiAttivi: 0,
      totalOre: 0,
      totalGuadagni: 0,
      dipendenti: []
    };
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COLUMNS.USER_ID] && row[COLUMNS.USER_ID] !== '') {
        report.totaleDipendenti++;
        
        if (row[COLUMNS.ATTIVO] === 'Si') {
          report.dipendentiAttivi++;
          const ore = row[COLUMNS.ORE_MESE] || 0;
          const guadagno = row[COLUMNS.GUADAGNO_MESE] || 0;
          
          report.totalOre += ore;
          report.totalGuadagni += guadagno;
          
          report.dipendenti.push({
            nome: row[COLUMNS.NOME],
            ruolo: row[COLUMNS.RUOLO],
            ore: ore,
            guadagno: guadagno
          });
        }
      }
    }
    
    return {
      success: true,
      data: report
    };
    
  } catch (error) {
    console.error('Errore in getMonthlyReport:', error);
    return { success: false, message: 'Errore nel generare il report' };
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

// ===== FUNZIONI DI TEST =====
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
