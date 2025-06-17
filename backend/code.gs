// ===== CONFIGURAZIONE AGGIORNATA =====
const SPREADSHEET_ID = '19WrI1o9U_1GzBoL-GZTgNvvijdr5O3MXvNMjQX3oK9A';
const USER_SHEET_NAME = 'Utenti'; // Nome specifico del foglio utenti

// ✅ INDICI DELLE COLONNE CORRETTI (basati sulla struttura reale del foglio)
const COLUMNS = {
  ID_UTENTE: 0,      // A - ID Utente (U001, U002, etc.)
  NOME: 1,           // B - Nome Completo
  TELEFONO: 2,       // C - Telefono (EMAIL MANCANTE nel foglio!)
  RUOLO: 3,          // D - Ruolo  
  DATA_ASSUNZIONE: 4, // E - Data Assunzione
  STIPENDIO: 5,      // F - Stipendio Orario €
  USER_ID: 6,        // G - UserID (per login)
  PASSWORD: 7,       // H - Password Iniziale
  PASSWORD_HASH: 8,  // I - Password Hash
  ATTIVO: 9,         // J - Attivo (Si/No)
  ORE_MESE: 10,      // K - Ore Totali Mese
  GUADAGNO_MESE: 11  // L - Guadagno Mese €
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
        
        // Controlla se questo foglio contiene le colonne utenti corrette
        if (firstRow.includes('UserID') || 
            firstRow.includes('ID Utente') || 
            firstRow.includes('Nome Completo')) {
          console.log('✓ Foglio utenti trovato per contenuto:', sheet.getName());
          return sheet;
        }
      } catch (e) {
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
  return handleCORS(() => {
    let requestData;
    
    if (e.postData) {
      if (e.postData.type === 'application/json') {
        requestData = JSON.parse(e.postData.contents);
      } else {
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
        response = saveWorkEntry(requestData.sessionToken, requestData.workData);
        break;
        
      case 'ping':
        response = { success: true, message: 'Connessione OK', timestamp: new Date().toISOString() };
        break;
        
      default:
        response = { success: false, message: 'Azione non riconosciuta' };
    }
    
    return response;
  });
}

function doGet(e) {
  return handleCORS(() => {
    const params = e.parameter;
    
    console.log('=== doGet chiamato ===');
    console.log('Parametri ricevuti:', params);
    
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
          
          let workDataParsed;
          if (params.workData) {
            try {
              if (typeof params.workData === 'string') {
                workDataParsed = JSON.parse(params.workData);
                console.log('✅ WorkData JSON parsato:', workDataParsed);
                
                console.log('🔍 Analisi proprietà workData:');
                for (const [key, value] of Object.entries(workDataParsed)) {
                  console.log(`- ${key}: "${value}" (tipo: ${typeof value})`);
                }
                
              } else {
                workDataParsed = params.workData;
                console.log('✅ WorkData già oggetto:', workDataParsed);
              }
            } catch (e) {
              console.error('❌ Errore parsing workData JSON:', e);
              return { success: false, message: 'Errore parsing workData: ' + e.message };
            }
          } else {
            workDataParsed = {
              data: params.data,
              cantiereId: params.cantiereId, 
              lavori: params.lavori,
              ore: params.ore,
              note: params.note
            };
            console.log('⚠️ Fallback: workData costruito da parametri:', workDataParsed);
          }
          
          return saveWorkEntry(params.sessionToken, workDataParsed);
          
        case 'ping':
          return { success: true, message: 'Connessione OK - GET', timestamp: new Date().toISOString() };
          
        default:
          console.log('❌ Azione non riconosciuta:', params.action);
          return { success: false, message: 'Azione non riconosciuta: ' + params.action };
      }
    }
    
    return { 
      success: true, 
      message: 'Sistema Gestione Ore API - GET endpoint attivo',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };
  });
}

function handleCORS(callback) {
  try {
    const result = callback();
    
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(result));
    
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

// ===== FUNZIONI DI AUTENTICAZIONE AGGIORNATE =====
function authenticateUser(userId, password) {
  try {
    console.log('=== AUTHENTICATING USER V2.0 ===');
    console.log('UserID richiesto:', userId);
    console.log('Password ricevuta:', password);
    
    const sheet = getWorksheet();
    console.log('✓ Foglio ottenuto:', sheet.getName());
    
    const data = sheet.getDataRange().getValues();
    console.log('✓ Dati letti:', data.length, 'righe');
    
    if (data.length < 2) {
      return {
        success: false,
        message: 'Nessun dato utente trovato nel foglio'
      };
    }
    
    console.log('📋 Headers effettivi:', data[0]);
    
    // Cerca utente con i nuovi indici corretti
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`🔍 Riga ${i}:`, row.slice(0, 12));
      
      const userIdInSheet = row[COLUMNS.USER_ID]; // Colonna G (index 6)
      const passwordInSheet = row[COLUMNS.PASSWORD]; // Colonna H (index 7)
      const isActive = row[COLUMNS.ATTIVO]; // Colonna J (index 9)
      
      console.log(`📝 Confronto utente ${i}:`);
      console.log(`- UserID foglio: "${userIdInSheet}" vs richiesto: "${userId}"`);
      console.log(`- Password foglio: "${passwordInSheet}" vs ricevuta: "${password}"`);
      console.log(`- Stato attivo: "${isActive}"`);
      
      if (userIdInSheet === userId && 
          isActive === 'Si' && 
          userIdInSheet !== '') {
        
        console.log('✅ Utente trovato e attivo');
        
        if (passwordInSheet === password) {
          console.log('✅ Password corretta');
          
          const sessionToken = generateSessionToken(userId);
          
          const userData = {
            idUtente: row[COLUMNS.ID_UTENTE],
            userId: row[COLUMNS.USER_ID],
            name: row[COLUMNS.NOME],
            telefono: row[COLUMNS.TELEFONO], // ⚠️ EMAIL non disponibile nel foglio
            role: row[COLUMNS.RUOLO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            stipendioOrario: row[COLUMNS.STIPENDIO],
            oreMese: row[COLUMNS.ORE_MESE] || 0,
            guadagnoMese: row[COLUMNS.GUADAGNO_MESE] || 0,
            rowIndex: i + 1
          };
          
          console.log('✅ Autenticazione completata per:', userData.name);
          
          return {
            success: true,
            message: 'Autenticazione riuscita',
            data: userData,
            sessionToken: sessionToken
          };
        } else {
          console.log('❌ Password errata');
        }
      }
    }
    
    console.log('❌ Utente non trovato o inattivo');
    return {
      success: false,
      message: 'Credenziali non valide o utente inattivo'
    };
    
  } catch (error) {
    console.error('❌ Errore in authenticateUser:', error);
    return {
      success: false,
      message: 'Errore durante l\'autenticazione: ' + error.toString(),
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

function normalizeDecimal(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  return value.replace(',', '.');
}

function validateSessionToken(sessionToken) {
  if (sessionToken === 'test' || sessionToken === 'test_token') {
    console.log('✅ Token di test accettato per debug');
    return true;
  }
  
  if (!sessionToken || typeof sessionToken !== 'string') {
    console.log('❌ Token mancante o non valido');
    return false;
  }
  
  const parts = sessionToken.split('_');
  if (parts.length < 3) {
    console.log('❌ Formato token non valido:', sessionToken);
    return false;
  }
  
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

// ===== FUNZIONI BUSINESS LOGIC AGGIORNATE =====
function getUserInfo(sessionToken) {
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
        return {
          success: true,
          data: {
            idUtente: row[COLUMNS.ID_UTENTE],
            name: row[COLUMNS.NOME],
            telefono: row[COLUMNS.TELEFONO], // Email non disponibile nel foglio
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
        
        // Aggiorna il foglio con indici corretti
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
  try {
    console.log('=== GET CANTIERI V2.0 ===');
    console.log('Session token received:', sessionToken);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let cantieriSheet;
    try {
      cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      console.log('✓ Foglio Cantieri trovato');
    } catch (e) {
      console.log('❌ Foglio Cantieri non trovato');
      return {
        success: false,
        message: 'Foglio Cantieri non esistente. Crealo manualmente con colonne: ID Cantiere, Nome Cantiere, Indirizzo, Stato',
        error: 'Sheet not found'
      };
    }
    
    const data = cantieriSheet.getDataRange().getValues();
    console.log('📋 Dati letti dal foglio:', data.length, 'righe');
    
    if (data.length > 0) {
      console.log('📋 Headers:', data[0]);
    }
    
    const cantieri = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`📋 Riga ${i}:`, row);
      
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
    console.log('=== SAVE WORK ENTRY V2.0 ===');
    console.log('SessionToken:', sessionToken);
    console.log('WorkData ricevuto:', JSON.stringify(workData, null, 2));
    
    if (!workData || typeof workData !== 'object') {
      return { success: false, message: 'Dati lavoro mancanti o non validi' };
    }
    
    console.log('🔍 Analisi dettagliata workData:');
    for (const [key, value] of Object.entries(workData)) {
      console.log(`- ${key}: "${value}" (tipo: ${typeof value})`);
    }
    
    // Estrazione ore più robusta
    let oreValue = null;
    const orePossibili = ['ore', 'hours', 'oreLavorate', 'orelavorate', 'oredilavoro'];
    
    for (const prop of orePossibili) {
      const val = workData[prop];
      console.log(`🔍 Controllo proprietà '${prop}': valore="${val}", tipo=${typeof val}`);
      
      if (workData.hasOwnProperty(prop) && val !== null && val !== undefined) {
        oreValue = val;
        console.log(`✅ Ore trovate in proprietà '${prop}': "${oreValue}"`);
        break;
      }
    }
    
    if (oreValue === null) {
      console.log('⚠️ Nessuna proprietà ore trovata, analizzando tutti i valori...');
      for (const [key, value] of Object.entries(workData)) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0 && numValue <= 24) {
          console.log(`🔍 Possibile valore ore trovato in '${key}':`, numValue);
          oreValue = numValue;
          break;
        }
      }
    }
    
    let oreLavorate;
    console.log(`🔢 Valore ore estratto: "${oreValue}" (tipo: ${typeof oreValue})`);
    
    if (oreValue === null || oreValue === undefined || oreValue === '') {
      console.log('❌ Valore ore è null, undefined o stringa vuota');
      return { 
        success: false, 
        message: `Valore ore mancante. Proprietà disponibili: ${Object.keys(workData).join(', ')}`
      };
    }
    
    const oreString = String(oreValue).trim();
    oreLavorate = parseFloat(oreString);
    
    console.log('🔢 Conversione ore:');
    console.log('- Valore originale:', oreValue, typeof oreValue);
    console.log('- Come stringa:', oreString);
    console.log('- Come numero:', oreLavorate, typeof oreLavorate);
    
    if (isNaN(oreLavorate) || oreLavorate < 0 || oreLavorate > 24) {
      return { 
        success: false, 
        message: `Valore ore non valido: "${oreValue}" → ${oreLavorate} (deve essere 0-24)` 
      };
    }
    
    // Validazione altri campi richiesti
    const campiRichiesti = {
      data: workData.data || workData.workDate || workData.date,
      cantiereId: workData.cantiereId || workData.cantiere,
      lavori: workData.lavori || workData.lavoriEseguiti || workData.descrizione
    };
    
    console.log('📋 Campi estratti:', campiRichiesti);
    
    for (const [campo, valore] of Object.entries(campiRichiesti)) {
      if (!valore || String(valore).trim() === '') {
        return { 
          success: false, 
          message: `Campo richiesto mancante: ${campo}` 
        };
      }
    }
    
    const userId = sessionToken.split('_')[0];
    
    // Ottieni informazioni utente con indici corretti
    const userSheet = getWorksheet();
    const userData = userSheet.getDataRange().getValues();
    let userName = '';
    
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        userName = row[COLUMNS.NOME]; // Colonna B (index 1)
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
        ['Data', 'Cantiere ID', 'Nome Cantiere', 'Ore Lavorate', 'Note']
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
    
    // Preparazione dati per il salvataggio
    const dataLavoro = new Date(campiRichiesti.data);
    const note = workData.note || workData.notes || '';
    
    // Ottieni nome cantiere dal foglio Cantieri
    let nomeCantiere = 'Lavoro registrato via dashboard';
    try {
      const cantieriSheet = spreadsheet.getSheetByName('Cantieri');
      const cantieriData = cantieriSheet.getDataRange().getValues();
      
      for (let i = 1; i < cantieriData.length; i++) {
        const row = cantieriData[i];
        if (row[0] === campiRichiesti.cantiereId) {
          nomeCantiere = row[1] || nomeCantiere;
          break;
        }
      }
    } catch (e) {
      console.log('⚠️ Impossibile ottenere nome cantiere:', e.message);
    }
    
    console.log('💾 Salvando dati finali:');
    console.log('- Data:', dataLavoro);
    console.log('- Cantiere ID:', campiRichiesti.cantiereId);
    console.log('- Nome Cantiere:', nomeCantiere);
    console.log('- Ore:', oreLavorate);
    console.log('- Note:', note);
    console.log('- Riga:', newRow);
    
    // Salva i dati
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([
      [
        dataLavoro,
        String(campiRichiesti.cantiereId),
        String(nomeCantiere),
        oreLavorate,
        String(note)
      ]
    ]);
    
    // Formatta celle
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
    
    // Aggiorna ore totali nel foglio principale
    updateUserTotalHours(userId, userName);
    
    console.log('✅ Salvataggio completato con successo');
    
    return {
      success: true,
      message: 'Dati salvati con successo',
      data: {
        riga: newRow,
        utente: userName,
        data: campiRichiesti.data,
        cantiere: campiRichiesti.cantiereId,
        nomeCantiere: nomeCantiere,
        ore: oreLavorate,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Errore in saveWorkEntry:', error);
    return { 
      success: false, 
      message: 'Errore nel salvataggio: ' + error.toString(),
      error: error.toString()
    };
  }
}

function updateUserTotalHours(userId, userName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userWorkSheet = spreadsheet.getSheetByName(userName);
    const userMainSheet = getWorksheet();
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const workData = userWorkSheet.getDataRange().getValues();
    let totalHours = 0;
    
    console.log('🔢 Calcolando ore totali per', userName);
    
    for (let i = 1; i < workData.length; i++) {
      const row = workData[i];
      const dataLavoro = new Date(row[0]);
      const ore = parseFloat(row[3]) || 0;
      
      if (!isNaN(dataLavoro.getTime()) && 
          dataLavoro.getMonth() + 1 === currentMonth && 
          dataLavoro.getFullYear() === currentYear) {
        totalHours += ore;
      }
    }
    
    console.log(`📊 Ore totali calcolate: ${totalHours}`);
    
    // Aggiorna nel foglio principale con indici corretti
    const mainData = userMainSheet.getDataRange().getValues();
    for (let i = 1; i < mainData.length; i++) {
      const row = mainData[i];
      if (row[COLUMNS.USER_ID] === userId) {
        // Aggiorna ore totali
        userMainSheet.getRange(i + 1, COLUMNS.ORE_MESE + 1).setValue(totalHours);
        
        // Ricalcola guadagno
        const stipendio = parseFloat(row[COLUMNS.STIPENDIO]) || 0;
        const guadagno = totalHours * stipendio;
        
        userMainSheet.getRange(i + 1, COLUMNS.GUADAGNO_MESE + 1).setValue(guadagno);
        
        // Formatta le celle
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

// ===== FUNZIONI DI DEBUG E TEST =====
function getSheetInfo() {
  try {
    console.log('=== DEBUG INFO V2.0 ===');
    console.log('SPREADSHEET_ID:', SPREADSHEET_ID);
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('Spreadsheet trovato:', spreadsheet.getName());
    
    const sheets = spreadsheet.getSheets();
    console.log('Fogli disponibili:');
    
    sheets.forEach((sheet, index) => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      console.log(`${index}: "${name}" (${lastRow} righe, ${lastCol} colonne)`);
      
      if (lastRow > 0 && lastCol > 0) {
        try {
          const headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 10)).getValues()[0];
          console.log(`   Headers: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);
        } catch (e) {
          console.log('   Headers: Errore lettura');
        }
      }
    });
    
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
    console.log('=== TEST CONNESSIONE V2.0 ===');
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✓ Accesso al spreadsheet OK');
    
    const sheets = spreadsheet.getSheets();
    console.log('✓ Fogli trovati:', sheets.length);
    
    const firstSheet = sheets[0];
    const data = firstSheet.getDataRange().getValues();
    console.log('✓ Dati letti:', data.length, 'righe');
    
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

function testAuthUpdated() {
  console.log('=== TEST AUTENTICAZIONE V2.0 ===');
  
  const testCases = [
    ['mario.rossi', 'nuovapassword123'],
    ['giuseppe.verdi', 'giuseppe789'], 
    ['luigi.bianchi', 'luigi456'],
    ['anna.neri', 'anna321']
  ];
  
  testCases.forEach(([userId, password]) => {
    console.log(`\n🔐 Test login: ${userId} / ${password}`);
    const result = authenticateUser(userId, password);
    console.log('Risultato:', result.success ? '✅ SUCCESSO' : '❌ FALLITO');
    if (!result.success) {
      console.log('Errore:', result.message);
    } else {
      console.log('Utente autenticato:', result.data.name);
      console.log('Token generato:', result.sessionToken);
    }
  });
}

function debugSheetStructure() {
  try {
    console.log('=== DEBUG STRUTTURA FOGLIO V2.0 ===');
    
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    console.log('📋 Headers:', data[0]);
    console.log('📋 Numero colonne:', data[0].length);
    
    console.log('\n📋 Mappatura colonne corretta:');
    data[0].forEach((header, index) => {
      const columnLetter = String.fromCharCode(65 + index);
      console.log(`${index} (${columnLetter}): ${header}`);
    });
    
    console.log('\n📋 Confronto con indici COLUMNS:');
    console.log('COLUMNS.USER_ID (6) dovrebbe essere:', data[0][6]);
    console.log('COLUMNS.PASSWORD (7) dovrebbe essere:', data[0][7]);
    console.log('COLUMNS.ATTIVO (9) dovrebbe essere:', data[0][9]);
    
    if (data.length > 1) {
      console.log('\n📋 Esempio utente (riga 2):');
      data[1].forEach((value, index) => {
        if (index < 12) { // Mostra solo le prime 12 colonne
          console.log(`${index} (${data[0][index]}): "${value}"`);
        }
      });
    }
    
    return { 
      success: true, 
      headers: data[0], 
      sampleUser: data[1],
      columnMapping: {
        userIdIndex: 6,
        passwordIndex: 7,
        activeIndex: 9
      }
    };
    
  } catch (error) {
    console.error('❌ Errore debug:', error);
    return { success: false, error: error.toString() };
  }
}

function testSaveWorkEntryUpdated() {
  console.log('=== TEST SAVE WORK ENTRY V2.0 ===');
  
  const authResult = authenticateUser('mario.rossi', 'nuovapassword123');
  console.log('1. Autenticazione:', authResult.success ? 'OK' : 'FALLITA');
  
  if (!authResult.success) {
    console.error('Autenticazione fallita:', authResult.message);
    return authResult;
  }
  
  const testWorkData = {
    data: '2025-06-16',
    cantiereId: 'C001',
    lavori: 'Test aggiornato da Google Apps Script V2.0',
    ore: 7.5,
    note: 'Test con struttura foglio corretta'
  };
  
  console.log('2. Dati di test preparati:', testWorkData);
  
  const saveResult = saveWorkEntry(authResult.sessionToken, testWorkData);
  console.log('3. Risultato salvataggio:', saveResult);
  
  return saveResult;
}

function testGetCantieriUpdated() {
  console.log('=== TEST GET CANTIERI V2.0 ===');
  try {
    const result = getCantieri('test_token');
    console.log('✅ Risultato getCantieri:', result);
    return result;
  } catch (error) {
    console.error('❌ Errore test getCantieri:', error);
    return { success: false, error: error.toString() };
  }
}
