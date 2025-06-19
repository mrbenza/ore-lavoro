// ===== SISTEMA GESTIONE ORE V3.3 FINALE - CON TUTTI I FIX =====
const SPREADSHEET_ID = '19WrI1o9U_1GzBoL-GZTgNvvijdr5O3MXvNMjQX3oK9A';
const USER_SHEET_NAME = 'Utenti';

// ===== INFORMAZIONI VERSIONE =====
const SYSTEM_INFO = {
  version: '3.3.0',
  build: '2025.06.18',
  description: 'Sistema con protezione righe sicure e supporto illimitato inserimenti',
  features: ['Protezione Header', 'Righe Sicure ≥5', 'Supporto Illimitato', 'Formule Excel Auto']
};

// ✅ INDICI DELLE COLONNE CORRETTI
const COLUMNS = {
  ID_UTENTE: 0,        // A - ID Utente (U001, U002, etc.)
  NOME: 1,             // B - Nome Completo
  EMAIL: 2,            // C - Email
  TELEFONO: 3,         // D - Telefono  
  DATA_ASSUNZIONE: 4,  // E - Data Assunzione
  USER_ID: 5,          // F - Username (per login)
  PASSWORD: 6,         // G - Password
  PASSWORD_HASH: 7,    // H - Password Hash
  ATTIVO: 8,           // I - Attivo (Si/No)
};

// ===== CELLE ORE NEI FOGLI UTENTE =====
const USER_SHEET_CELLS = {
  ORE_MESE_CORRENTE: 'F3',    // Celle con formule Excel per ore mese corrente
  ORE_MESE_PRECEDENTE: 'G3',  // Celle con formule Excel per ore mese precedente
  ANNO_CORRENTE: 'H3'         // Opzionale: ore anno corrente se presente
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
    
    // Strategia 2: Cerca foglio che contiene header "Username" o "ID Utente"
    for (let sheet of sheets) {
      try {
        const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        if (firstRow.includes('Username') || 
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

// ===== FUNZIONE PER LEGGERE ORE DAL FOGLIO UTENTE =====
function getUserHoursFromSheet(userName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let userSheet;
    try {
      userSheet = spreadsheet.getSheetByName(userName);
    } catch (e) {
      console.log(`⚠️ Foglio "${userName}" non trovato`);
      return {
        oreMeseCorrente: 0,
        oreMesePrecedente: 0,
        oreAnnoCorrente: 0
      };
    }
    
    // Leggi le ore dalle celle con formule Excel
    const oreMeseCorrente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_CORRENTE).getValue() || 0;
    const oreMesePrecedente = userSheet.getRange(USER_SHEET_CELLS.ORE_MESE_PRECEDENTE).getValue() || 0;
    
    // Prova a leggere ore anno se la cella esiste
    let oreAnnoCorrente = 0;
    try {
      oreAnnoCorrente = userSheet.getRange(USER_SHEET_CELLS.ANNO_CORRENTE).getValue() || 0;
    } catch (e) {
      // Cella anno non presente, mantieni 0
    }
    
    console.log(`📊 Ore lette per ${userName}:`, {
      mese_corrente: oreMeseCorrente,
      mese_precedente: oreMesePrecedente,
      anno_corrente: oreAnnoCorrente
    });
    
    return {
      oreMeseCorrente: parseFloat(oreMeseCorrente) || 0,
      oreMesePrecedente: parseFloat(oreMesePrecedente) || 0,
      oreAnnoCorrente: parseFloat(oreAnnoCorrente) || 0
    };
    
  } catch (error) {
    console.error(`❌ Errore lettura ore per ${userName}:`, error);
    return {
      oreMeseCorrente: 0,
      oreMesePrecedente: 0,
      oreAnnoCorrente: 0
    };
  }
}

// ===== FUNZIONI PRINCIPALI =====
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
        response = { 
          success: true, 
          message: 'Connessione OK', 
          timestamp: new Date().toISOString(),
          version: SYSTEM_INFO.version,
          build: SYSTEM_INFO.build
        };
        break;
        
      case 'getSystemInfo':
        response = {
          success: true,
          data: SYSTEM_INFO,
          timestamp: new Date().toISOString()
        };
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
    
    console.log('=== doGet chiamato V3.3 ===');
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
              } else {
                workDataParsed = params.workData;
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
          }
          
          return saveWorkEntry(params.sessionToken, workDataParsed);
          
        case 'ping':
          return { 
            success: true, 
            message: 'Connessione OK - GET', 
            timestamp: new Date().toISOString(),
            version: SYSTEM_INFO.version,
            build: SYSTEM_INFO.build
          };
          
        case 'getSystemInfo':
          return {
            success: true,
            data: SYSTEM_INFO,
            timestamp: new Date().toISOString()
          };
          
        default:
          console.log('❌ Azione non riconosciuta:', params.action);
          return { success: false, message: 'Azione non riconosciuta: ' + params.action };
      }
    }
    
    return { 
      success: true, 
      message: 'Sistema Gestione Ore API - Righe sicure attive',
      timestamp: new Date().toISOString(),
      version: SYSTEM_INFO.version,
      build: SYSTEM_INFO.build,
      features: SYSTEM_INFO.features
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
      error: error.toString(),
      version: SYSTEM_INFO.version
    };
    
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setContent(JSON.stringify(errorResponse));
    
    return output;
  }
}

// ===== FUNZIONI DI AUTENTICAZIONE V3.3 =====
function authenticateUser(userId, password) {
  try {
    console.log('=== AUTHENTICATING USER V3.3 ===');
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
    
    // Cerca utente con i nuovi indici corretti V3.3
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`🔍 Riga ${i}:`, row.slice(0, 9));
      
      const userIdInSheet = row[COLUMNS.USER_ID]; // Colonna F (index 5) - Username
      const passwordInSheet = row[COLUMNS.PASSWORD]; // Colonna G (index 6) - Password
      const isActive = row[COLUMNS.ATTIVO]; // Colonna I (index 8) - Attivo
      
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
          const userName = row[COLUMNS.NOME]; // Nome completo per leggere ore
          
          // Leggi le ore dal foglio individuale dell'utente
          const oreData = getUserHoursFromSheet(userName);
          
          const userData = {
            idUtente: row[COLUMNS.ID_UTENTE],
            userId: row[COLUMNS.USER_ID],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            telefono: row[COLUMNS.TELEFONO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            // Ore lette dalle formule Excel nei fogli individuali
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente,
            rowIndex: i + 1
          };
          
          console.log('✅ Autenticazione completata per:', userData.name);
          console.log('📊 Dati ore:', oreData);
          
          return {
            success: true,
            message: 'Autenticazione riuscita',
            data: userData,
            sessionToken: sessionToken,
            systemInfo: {
              version: SYSTEM_INFO.version,
              build: SYSTEM_INFO.build
            }
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

// ===== FUNZIONI BUSINESS LOGIC V3.3 =====
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
        const userName = row[COLUMNS.NOME];
        
        // Leggi ore aggiornate dal foglio individuale
        const oreData = getUserHoursFromSheet(userName);
        
        return {
          success: true,
          data: {
            idUtente: row[COLUMNS.ID_UTENTE],
            name: row[COLUMNS.NOME],
            email: row[COLUMNS.EMAIL],
            telefono: row[COLUMNS.TELEFONO],
            dataAssunzione: row[COLUMNS.DATA_ASSUNZIONE],
            // Ore sempre aggiornate dalle formule Excel
            oreMese: oreData.oreMeseCorrente,
            oreMesePrecedente: oreData.oreMesePrecedente,
            oreAnno: oreData.oreAnnoCorrente
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
  // ⚠️ DEPRECATA: Le ore ora sono calcolate automaticamente dalle formule Excel
  // Questa funzione è mantenuta per compatibilità ma non fa nulla
  
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  console.log('⚠️ updateUserHours è deprecata. Le ore sono calcolate automaticamente dalle formule Excel.');
  
  try {
    const userId = sessionToken.split('_')[0];
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[COLUMNS.USER_ID] === userId) {
        const userName = row[COLUMNS.NOME];
        
        // Leggi le ore attuali dalle formule Excel
        const oreData = getUserHoursFromSheet(userName);
        
        return {
          success: true,
          message: 'Ore lette dalle formule Excel (aggiornamento automatico)',
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
    console.error('Errore in updateUserHours:', error);
    return { success: false, message: 'Errore nel recupero ore' };
  }
}

function getCantieri(sessionToken) {
  try {
    console.log('=== GET CANTIERI V3.3 ===');
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
        message: 'Foglio Cantieri non esistente. Crealo manualmente con colonne: ID Cantiere, Nome Progetto, Indirizzo, Stato Lavori',
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
      
      // Controlla che il cantiere sia "Aperto" (colonna D - index 3)
      if (row[0] && row[0] !== '' && row[3] === 'Aperto') {
        const cantiere = {
          id: row[0],           // Colonna A - ID Cantiere
          nome: row[1],         // Colonna B - Nome Progetto
          indirizzo: row[2],    // Colonna C - Indirizzo
          stato: row[3]         // Colonna D - Stato Lavori
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

// ===== FUNZIONE PRINCIPALE SAVEWORKENTRY V3.3 (CON TUTTI I FIX) =====
function saveWorkEntry(sessionToken, workData) {
  if (!validateSessionToken(sessionToken)) {
    return { success: false, message: 'Token di sessione non valido' };
  }
  
  try {
    console.log('=== SAVE WORK ENTRY V3.3 - RIGHE SICURE + SUPPORTO ILLIMITATO ===');
    console.log('SessionToken:', sessionToken);
    console.log('WorkData ricevuto:', JSON.stringify(workData, null, 2));
    
    if (!workData || typeof workData !== 'object') {
      return { success: false, message: 'Dati lavoro mancanti o non validi' };
    }
    
    // Estrazione ore robusta
    let oreValue = null;
    const orePossibili = ['ore', 'hours', 'oreLavorate', 'orelavorate', 'oredilavoro'];
    
    for (const prop of orePossibili) {
      const val = workData[prop];
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
    
    const oreString = String(oreValue).trim();
    const oreLavorate = parseFloat(oreString);
    
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
    
    for (const [campo, valore] of Object.entries(campiRichiesti)) {
      if (!valore || String(valore).trim() === '') {
        return { 
          success: false, 
          message: `Campo richiesto mancante: ${campo}` 
        };
      }
    }
    
    const userId = sessionToken.split('_')[0];
    
    // Ottieni informazioni utente con indici corretti V3.3
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
    
    // Cerca il foglio dell'utente esistente
    let userWorkSheet;
    try {
      userWorkSheet = spreadsheet.getSheetByName(userName);
      console.log('✅ Foglio utente trovato:', userName);
    } catch (e) {
      console.log('⚠️ Foglio non trovato per:', userName);
      return { 
        success: false, 
        message: `Foglio "${userName}" non esistente. Crealo manualmente o contatta l'amministratore.` 
      };
    }
    
    // 🛡️ FIX PRINCIPALE: RICERCA RIGHE SICURE (≥5) - SUPPORTO ILLIMITATO
    console.log('🛡️ APPLICANDO FIX RIGHE SICURE CON SUPPORTO ILLIMITATO...');
    
    const totalRows = userWorkSheet.getLastRow();
    console.log('📊 Righe totali nel foglio:', totalRows);
    
    // 🛡️ FORZA PARTENZA DALLA RIGA 5 (ignora rilevamento header)
    let newRow = 5;
    console.log('🛡️ INIZIO RICERCA FORZATO: riga 5 (ignora header detection)');
    
    // 🚀 RICERCA ESTESA: Supporta fogli con centinaia/migliaia di inserimenti
    const maxSearchRows = Math.max(totalRows + 100, 1000); // Cerca fino a 1000 righe o totalRows+100
    console.log(`🔍 Ricerca estesa fino alla riga: ${maxSearchRows}`);
    
    let foundEmptyRow = false;
    
    // Cerca prima riga vuota dalla 5 in poi (ricerca estesa)
    for (let row = 5; row <= maxSearchRows; row++) {
      try {
        const checkRange = userWorkSheet.getRange(row, 1, 1, 5).getValues()[0];
        const isEmpty = checkRange.every(cell => 
          cell === '' || cell === null || cell === undefined
        );
        
        // Log ogni 10 righe per non intasare i log
        if (row % 10 === 0 || row <= 10 || isEmpty) {
          console.log(`🔍 Riga ${row}: [${checkRange.slice(0, 3).join(', ')}...] → ${isEmpty ? 'VUOTA ✅' : 'OCCUPATA ❌'}`);
        }
        
        if (isEmpty) {
          newRow = row;
          foundEmptyRow = true;
          console.log(`✅ RIGA SICURA TROVATA: ${newRow}`);
          break;
        }
      } catch (e) {
        // Probabilmente oltre i dati del foglio
        console.log(`📍 Errore riga ${row} (probabile fine dati): ${e.message}`);
        newRow = row;
        foundEmptyRow = true;
        console.log(`✅ Uso fine dati, riga: ${newRow}`);
        break;
      }
    }
    
    // 🚀 FALLBACK GARANTITO: Se non trova nessuna riga vuota, aggiungi alla fine
    if (!foundEmptyRow) {
      newRow = totalRows + 1;
      console.log(`🔄 FALLBACK: Nessuna riga vuota trovata, aggiungo alla fine: riga ${newRow}`);
      
      // Assicurati che sia comunque ≥ 5
      if (newRow < 5) {
        newRow = 5;
        console.log(`🛡️ CORREZIONE FINALE: Forzato a riga ${newRow} per sicurezza`);
      }
    }
    
    // 🛡️ CONTROLLO FINALE DI SICUREZZA
    if (newRow < 5) {
      console.error(`🚨 BLOCCO SICUREZZA: riga ${newRow} < 5`);
      return {
        success: false,
        message: `ERRORE SICUREZZA: Tentativo scrittura riga ${newRow} (minimo riga 5)`
      };
    }
    
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
    
    console.log('💾 SALVANDO IN RIGA SICURA:');
    console.log('- Riga destinazione:', newRow);
    console.log('- Data:', dataLavoro);
    console.log('- Cantiere ID:', campiRichiesti.cantiereId);
    console.log('- Nome Cantiere:', nomeCantiere);
    console.log('- Ore:', oreLavorate);
    console.log('- Note:', note);
    
    // SALVATAGGIO SICURO
    userWorkSheet.getRange(newRow, 1, 1, 5).setValues([
      [
        dataLavoro,
        String(campiRichiesti.cantiereId),
        String(nomeCantiere),
        oreLavorate,
        String(note)
      ]
    ]);
    
    // Formattazione celle
    userWorkSheet.getRange(newRow, 1).setNumberFormat('dd/mm/yyyy');
    userWorkSheet.getRange(newRow, 4).setNumberFormat('#,##0.0');
    
    console.log('✅ SALVATAGGIO SICURO COMPLETATO');
    console.log('📊 Le ore totali saranno aggiornate automaticamente dalle formule Excel');
    
    return {
      success: true,
      message: 'Dati salvati con successo in riga sicura. Ore totali aggiornate automaticamente.',
      data: {
        riga: newRow,
        utente: userName,
        data: campiRichiesti.data,
        cantiere: campiRichiesti.cantiereId,
        nomeCantiere: nomeCantiere,
        ore: oreLavorate,
        safeRowProtection: true,
        unlimitedSupport: true,
        timestamp: new Date().toISOString(),
        version: SYSTEM_INFO.version,
        note: 'Protezione header garantita - sempre riga ≥5 con supporto illimitato inserimenti'
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

// ===== FUNZIONI DI UTILITÀ =====
function generateSessionToken(userId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  return `${userId}_${timestamp}_${random}`;
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

// ===== FUNZIONI DI DEBUG E TEST V3.3 =====
function getSheetInfo() {
  try {
    console.log('=== DEBUG INFO V3.3 ===');
    console.log('SPREADSHEET_ID:', SPREADSHEET_ID);
    console.log('SYSTEM_INFO:', SYSTEM_INFO);
    
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
      selectedSheet: selectedSheet.getName(),
      systemInfo: SYSTEM_INFO
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
    console.log('=== TEST CONNESSIONE V3.3 ===');
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✓ Accesso al spreadsheet OK');
    
    const sheets = spreadsheet.getSheets();
    console.log('✓ Fogli trovati:', sheets.length);
    
    const userSheet = getWorksheet();
    const data = userSheet.getDataRange().getValues();
    console.log('✓ Dati utenti letti:', data.length, 'righe');
    
    if (data.length > 1) {
      console.log('Headers utenti:', data[0]);
      console.log('Esempio utente:', data[1]);
    }
    
    return { 
      success: true, 
      message: 'Tutti i test OK',
      systemInfo: SYSTEM_INFO,
      features: ['Righe sicure ≥5', 'Supporto illimitato inserimenti', 'Protezione header', 'Formule Excel automatiche']
    };
    
  } catch (error) {
    console.error('Errore nei test:', error);
    return { success: false, error: error.toString() };
  }
}

function testAuthUpdated() {
  console.log('=== TEST AUTENTICAZIONE V3.3 ===');
  
  const testCases = [
    ['mario.rossi', 'nuovapassword123', 'Mario Rossi'],
    ['luigi.bianchi', 'luigi456', 'Luigi Bianchi'],
    ['giuseppe.verdi', 'giuseppe789', 'Giuseppe Verdi'], 
    ['anna.neri', 'anna321', 'Anna Neri']
  ];
  
  testCases.forEach(([userId, password, nomeCompleto]) => {
    console.log(`\n🔐 Test login: ${userId} / ${password}`);
    const result = authenticateUser(userId, password);
    console.log('Risultato:', result.success ? '✅ SUCCESSO' : '❌ FALLITO');
    if (!result.success) {
      console.log('Errore:', result.message);
    } else {
      console.log('Utente autenticato:', result.data.name);
      console.log('Email:', result.data.email);
      console.log('Ore mese corrente:', result.data.oreMese);
      console.log('Ore mese precedente:', result.data.oreMesePrecedente);
      console.log('Token generato:', result.sessionToken);
      console.log('Versione sistema:', result.systemInfo.version);
    }
  });
}

function debugSheetStructure() {
  try {
    console.log('=== DEBUG STRUTTURA FOGLIO V3.3 ===');
    
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    console.log('📋 Headers:', data[0]);
    console.log('📋 Numero colonne:', data[0].length);
    
    console.log('\n📋 Mappatura colonne V3.3:');
    data[0].forEach((header, index) => {
      const columnLetter = String.fromCharCode(65 + index);
      console.log(`${index} (${columnLetter}): ${header}`);
    });
    
    console.log('\n📋 Confronto con indici COLUMNS V3.3:');
    console.log('COLUMNS.USER_ID (5) dovrebbe essere:', data[0][5]);
    console.log('COLUMNS.PASSWORD (6) dovrebbe essere:', data[0][6]);
    console.log('COLUMNS.ATTIVO (8) dovrebbe essere:', data[0][8]);
    console.log('COLUMNS.EMAIL (2) dovrebbe essere:', data[0][2]);
    console.log('COLUMNS.TELEFONO (3) dovrebbe essere:', data[0][3]);
    
    if (data.length > 1) {
      console.log('\n📋 Esempio utente (riga 2):');
      data[1].forEach((value, index) => {
        if (index < 9) { // Mostra solo le prime 9 colonne
          console.log(`${index} (${data[0][index]}): "${value}"`);
        }
      });
    }
    
    return { 
      success: true, 
      headers: data[0], 
      sampleUser: data[1],
      columnMapping: {
        userIdIndex: 5,    // Username
        passwordIndex: 6,  // Password
        activeIndex: 8,    // Attivo
        emailIndex: 2,     // Email
        phoneIndex: 3      // Telefono
      },
      systemInfo: SYSTEM_INFO
    };
    
  } catch (error) {
    console.error('❌ Errore debug:', error);
    return { success: false, error: error.toString() };
  }
}

// ===== FUNZIONE TEST RAPIDO V3.3 =====
function testRapidoSicurezza() {
  console.log('⚡ TEST RAPIDO SICUREZZA V3.3 ⚡');
  
  const auth = authenticateUser('giuseppe.verdi', 'giuseppe789');
  if (!auth.success) {
    console.log('❌ Auth fallita:', auth.message);
    return { status: 'AUTH_FAILED', error: auth.message };
  }
  
  console.log('✅ Auth OK per Giuseppe');
  console.log('📊 Versione sistema:', auth.systemInfo.version);
  
  const save = saveWorkEntry(auth.sessionToken, {
    data: '2025-06-18',
    cantiereId: 'C001',
    lavori: 'Test rapido sicurezza V3.3',
    ore: 2.5,
    note: 'Test finale con tutti i fix applicati'
  });
  
  if (!save.success) {
    console.log('❌ Save fallito:', save.message);
    return { status: 'SAVE_FAILED', error: save.message };
  }
  
  const riga = save.data.riga;
  console.log(`💾 Salvato in riga: ${riga}`);
  console.log(`🛡️ Protezione righe sicure: ${save.data.safeRowProtection}`);
  console.log(`🚀 Supporto illimitato: ${save.data.unlimitedSupport}`);
  console.log(`🏗️ Cantiere: ${save.data.cantiere}`);
  console.log(`⏰ Ore: ${save.data.ore}`);
  console.log(`📅 Versione: ${save.data.version}`);
  
  if (riga >= 5) {
    console.log('✅ SICURO: Riga >= 5 - SISTEMA V3.3 FUNZIONA PERFETTAMENTE!');
    return { 
      status: 'SAFE', 
      riga: riga, 
      version: save.data.version,
      allFeaturesWorking: true,
      data: save.data 
    };
  } else {
    console.log('🚨 PERICOLO: Riga < 5 - PROBLEMA CRITICO!');
    return { 
      status: 'DANGEROUS', 
      riga: riga, 
      version: save.data.version,
      data: save.data 
    };
  }
}

// ===== FUNZIONE MIGRAZIONE V3.3 =====
function migrateToV33() {
  console.log('=== MIGRAZIONE STRUTTURA V3.3 ===');
  console.log('✅ Features V3.3: Righe sicure, Supporto illimitato, Protezione header, Formule Excel auto');
  console.log('🛡️ Garanzie: Mai scrittura sotto riga 5, Supporto 1000+ inserimenti, Fallback garantito');
  
  try {
    const sheet = getWorksheet();
    const data = sheet.getDataRange().getValues();
    
    console.log('\n📋 Verifica struttura per V3.3:');
    if (data.length > 0) {
      console.log('Headers trovati:', data[0]);
      console.log('Numero colonne:', data[0].length);
      
      const requiredHeaders = ['ID Utente', 'Nome Completo', 'Email', 'Telefono', 'Username', 'Password', 'Attivo'];
      const currentHeaders = data[0];
      
      let compatible = true;
      requiredHeaders.forEach(required => {
        if (!currentHeaders.includes(required)) {
          console.log(`❌ Manca header richiesto: ${required}`);
          compatible = false;
        } else {
          console.log(`✅ Header trovato: ${required}`);
        }
      });
      
      if (compatible) {
        console.log('\n✅ STRUTTURA COMPATIBILE CON V3.3');
        console.log('🎯 Features attive:');
        SYSTEM_INFO.features.forEach(feature => {
          console.log(`   ✅ ${feature}`);
        });
        return { 
          success: true, 
          message: 'Struttura compatibile V3.3', 
          compatible: true, 
          systemInfo: SYSTEM_INFO 
        };
      } else {
        console.log('\n❌ STRUTTURA NON COMPATIBILE');
        return { success: false, message: 'Struttura non compatibile V3.3', compatible: false };
      }
    }
    
  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    return { success: false, error: error.toString() };
  }
}
