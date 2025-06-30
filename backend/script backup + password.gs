// ===== SCRIPT COMBINATO: ARCHIVIO ORE + GESTIONE PASSWORD =====
// Versione unificata per Google Apps Script

// ===== CONFIGURAZIONE GENERALE =====
const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId(),
  SYSTEM_SHEETS: ['Amministrazione', 'Utenti', 'Cantieri', 'Foglio Cantieri Base', 'Foglio utente Base', 'Foglio Utenti Base', 'Tracking Archivi'],
  ARCHIVE_FOLDER_NAME: 'Archivi Ore Lavorate',
  HEADER_ROWS: 4,
  CURRENT_YEAR: new Date().getFullYear(),
  DEFAULT_ARCHIVE_YEAR: new Date().getFullYear() - 1
};

// ===== MENU PRINCIPALE COMBINATO =====
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Menu Archivio Ore
  ui.createMenu('📁 Archivio Ore')
    .addItem('📅 Archivia anno precedente (tutti)', 'archiviaAnnoPrecedenteTutti')
    .addItem('👤 Archivia singolo dipendente', 'archiviaSingoloDipendente')
    .addItem('📊 Archivia tutti (scegli anno)', 'archiviaTuttiConAnno')
    .addSeparator()
    .addItem('⚙️ Inizializza sistema', 'initSystem')
    .addToUi();
    
  // Menu Gestione Password
  ui.createMenu('🔐 Gestione Password')
    .addItem('👤 Cambia Password Dipendente', 'cambiaPasswordDipendente')
    .addSeparator()
    .addItem('📋 Lista Utenti', 'mostraListaUtenti')
    .addItem('🔍 Debug Hash Password', 'debugHashPassword')
    .addToUi();
}

// ========== SEZIONE 1: FUNZIONI ARCHIVIO ORE ==========

function initSystem() {
  PropertiesService.getScriptProperties().setProperty('MAIN_SHEET_ID', CONFIG.SPREADSHEET_ID);
  SpreadsheetApp.getUi().alert('✅ Sistema inizializzato\n\nID Spreadsheet salvato correttamente.');
}

// Opzione 1: Archivia tutti i dipendenti per l'anno precedente (1 click)
function archiviaAnnoPrecedenteTutti() {
  const ui = SpreadsheetApp.getUi();
  const anno = CONFIG.DEFAULT_ARCHIVE_YEAR;
  
  const result = ui.alert(
    '📅 Conferma Archiviazione ' + anno,
    'Vuoi archiviare TUTTI i dipendenti per l\'anno ' + anno + '?\n\nVerranno creati file Excel e PDF per ogni dipendente.',
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    eseguiArchiviazioneMultipla(anno);
  }
}

// Opzione 2: Archivia singolo dipendente con selezione facilitata
function archiviaSingoloDipendente() {
  const ui = SpreadsheetApp.getUi();
  const dipendenti = rilevaDipendenti();
  
  if (dipendenti.length === 0) {
    ui.alert('⚠️ Nessun dipendente\n\nNessun foglio dipendente trovato nel sistema.');
    return;
  }
  
  // HTML semplice per selezione dipendente
  const htmlContent = '<div style="font-family: Arial, sans-serif; padding: 10px;">' +
    '<p><strong>Seleziona il dipendente:</strong></p>' +
    '<select id="dipendente" size="10" style="width: 100%; height: 200px; font-size: 14px;">' +
    dipendenti.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('') +
    '</select>' +
    '<br><br>' +
    '<label>' +
    'Anno: <input type="number" id="anno" value="' + CONFIG.DEFAULT_ARCHIVE_YEAR + '" style="width: 80px; font-size: 14px;">' +
    '</label>' +
    '<br><br>' +
    '<button onclick="processSelection()" style="background: #4CAF50; color: white; padding: 8px 16px; border: none; cursor: pointer; font-size: 14px;">' +
    '✅ Archivia' +
    '</button>' +
    '<button onclick="google.script.host.close()" style="background: #f44336; color: white; padding: 8px 16px; border: none; cursor: pointer; font-size: 14px; margin-left: 10px;">' +
    '❌ Annulla' +
    '</button>' +
    '</div>' +
    
    '<script>' +
    'function processSelection() {' +
    '  const dipendente = document.getElementById("dipendente").value;' +
    '  const anno = parseInt(document.getElementById("anno").value);' +
    '  ' +
    '  if (!dipendente) {' +
    '    alert("Seleziona un dipendente");' +
    '    return;' +
    '  }' +
    '  ' +
    '  if (isNaN(anno) || anno < 2020 || anno > ' + CONFIG.CURRENT_YEAR + ') {' +
    '    alert("Anno non valido");' +
    '    return;' +
    '  }' +
    '  ' +
    '  google.script.run' +
    '    .withSuccessHandler(() => google.script.host.close())' +
    '    .withFailureHandler(err => alert("Errore: " + err.message))' +
    '    .eseguiArchiviazioneConFeedback(dipendente, anno);' +
    '}' +
    '' +
    'document.getElementById("dipendente").ondblclick = processSelection;' +
    '</script>';
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(400);
    
  ui.showModalDialog(htmlOutput, '📁 Archivia Singolo Dipendente');
}

// Opzione 3: Archivia tutti con anno personalizzato
function archiviaTuttiConAnno() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.prompt(
    '📅 Seleziona Anno',
    'Inserisci l\'anno da archiviare (default: ' + CONFIG.DEFAULT_ARCHIVE_YEAR + '):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const anno = parseInt(response.getResponseText()) || CONFIG.DEFAULT_ARCHIVE_YEAR;
    
    if (anno < 2020 || anno > CONFIG.CURRENT_YEAR) {
      ui.alert('⚠️ Anno non valido\n\nL\'anno deve essere compreso tra 2020 e ' + CONFIG.CURRENT_YEAR + '.');
      return;
    }
    
    const confirm = ui.alert(
      '📅 Conferma Archiviazione ' + anno,
      'Vuoi archiviare TUTTI i dipendenti per l\'anno ' + anno + '?',
      ui.ButtonSet.YES_NO
    );
    
    if (confirm === ui.Button.YES) {
      eseguiArchiviazioneMultipla(anno);
    }
  }
}

function rilevaDipendenti() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tuttiIFogli = spreadsheet.getSheets().map(function(foglio) { return foglio.getName(); });
    
    return tuttiIFogli.filter(function(nome) {
      return !CONFIG.SYSTEM_SHEETS.includes(nome) && 
             !nome.includes('Base') && 
             !nome.includes('_20');
    }).sort();
    
  } catch (error) {
    console.error('Errore rilevamento dipendenti:', error);
    throw new Error('Impossibile accedere al foglio principale');
  }
}

function eseguiArchiviazioneConFeedback(nomeDipendente, anno) {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const result = eseguiArchiviazione(nomeDipendente, anno);
    
    if (result.success) {
      ui.alert('✅ Archiviazione Completata\n\n' +
        'Dipendente: ' + nomeDipendente + '\n' +
        'Anno: ' + anno + '\n' +
        'Righe archiviate: ' + result.righeFinali + '\n' +
        'Ore totali: ' + result.oreTotali + '\n\n' +
        '📁 File creati nella cartella "' + CONFIG.ARCHIVE_FOLDER_NAME + '/' + anno + '"'
      );
    } else {
      throw new Error(result.error || 'Errore sconosciuto');
    }
  } catch (error) {
    ui.alert('❌ Errore\n\n' + error.message);
    throw error;
  }
}

function eseguiArchiviazioneMultipla(anno) {
  const ui = SpreadsheetApp.getUi();
  const dipendenti = rilevaDipendenti();
  
  if (dipendenti.length === 0) {
    ui.alert('⚠️ Nessun dipendente\n\nNessun foglio dipendente trovato.');
    return;
  }
  
  const risultati = [];
  let successi = 0;
  let errori = 0;
  
  dipendenti.forEach(function(dipendente, index) {
    try {
      const result = eseguiArchiviazione(dipendente, anno);
      if (result.success) {
        successi++;
        risultati.push('✅ ' + dipendente + ' - ' + result.righeFinali + ' righe, ' + result.oreTotali + ' ore');
      } else {
        errori++;
        risultati.push('❌ ' + dipendente + ' - ' + (result.error || 'Errore'));
      }
    } catch (error) {
      errori++;
      risultati.push('❌ ' + dipendente + ' - ' + error.message);
    }
  });
  
  const riepilogo = 'RIEPILOGO ARCHIVIAZIONE ' + anno + '\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '✅ Successi: ' + successi + '\n' +
    '❌ Errori: ' + errori + '\n' +
    '📁 Totale: ' + dipendenti.length + '\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'DETTAGLI:\n' +
    risultati.join('\n') + '\n\n' +
    'I file sono stati salvati in:\n' +
    '📂 ' + CONFIG.ARCHIVE_FOLDER_NAME + '/' + anno + '/';
  
  ui.alert('📊 Archiviazione Completata\n\n' + riepilogo);
}

function eseguiArchiviazione(nomeDipendente, anno) {
  const startTime = new Date();
  const result = {
    success: false,
    dipendente: nomeDipendente,
    anno: anno,
    righeFinali: 0,
    oreTotali: 0
  };
  
  try {
    // 1. Ottieni foglio originale
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const foglioOriginale = spreadsheet.getSheetByName(nomeDipendente);
    
    if (!foglioOriginale) {
      throw new Error('Foglio "' + nomeDipendente + '" non trovato');
    }
    
    // 2. Crea struttura cartelle
    const struttura = creaStrutturaArchivio(anno, nomeDipendente);
    const cartellaAnno = struttura.cartellaAnno;
    const nomeFileArchivio = struttura.nomeFileArchivio;
    
    // 3. Crea copia del foglio
    const spreadsheetArchivio = SpreadsheetApp.create(nomeFileArchivio);
    const fileArchivio = DriveApp.getFileById(spreadsheetArchivio.getId());
    
    // Sposta nella cartella corretta
    cartellaAnno.addFile(fileArchivio);
    DriveApp.getRootFolder().removeFile(fileArchivio);
    
    // 4. Copia dati con formattazione
    const foglioArchivio = copiaFoglioCompleto(foglioOriginale, spreadsheetArchivio, nomeDipendente);
    
    // 5. Filtra dati per anno
    const stats = filtraDatiPerAnno(foglioArchivio, anno, 'mantieni');
    result.righeFinali = stats.righeFinali;
    result.oreTotali = stats.oreTotali;
    
    // 6. Se ci sono dati, rimuovi dall'originale e crea export
    if (stats.righeFinali > 0) {
      // Rimuovi dati dall'originale
      filtraDatiPerAnno(foglioOriginale, anno, 'rimuovi');
      
      // Crea export Excel e PDF
      creaExportFiles(spreadsheetArchivio, cartellaAnno, nomeFileArchivio);
      
      // 7. Elimina il Google Sheet temporaneo DOPO aver creato i file
      Utilities.sleep(2000); // Attendi che i file siano creati
      fileArchivio.setTrashed(true);
    } else {
      // Se non ci sono dati, elimina il file vuoto
      fileArchivio.setTrashed(true);
      result.error = 'Nessun dato trovato per l\'anno specificato';
      return result;
    }
    
    result.success = true;
    result.executionTime = ((new Date() - startTime) / 1000).toFixed(1);
    
    console.log('✅ Archiviazione completata: ' + nomeDipendente + ' (' + result.executionTime + 's)');
    
  } catch (error) {
    console.error('❌ Errore archiviazione ' + nomeDipendente + ':', error);
    result.error = error.message;
  }
  
  return result;
}

function creaStrutturaArchivio(anno, nomeDipendente) {
  // Trova o crea cartella base
  const iteratorBase = DriveApp.getFoldersByName(CONFIG.ARCHIVE_FOLDER_NAME);
  const cartellaBase = iteratorBase.hasNext() 
    ? iteratorBase.next() 
    : DriveApp.createFolder(CONFIG.ARCHIVE_FOLDER_NAME);
  
  // Trova o crea cartella anno
  const iteratorAnno = cartellaBase.getFoldersByName(anno.toString());
  const cartellaAnno = iteratorAnno.hasNext()
    ? iteratorAnno.next()
    : cartellaBase.createFolder(anno.toString());
  
  // Crea nome file archivio
  const nomeFileArchivio = anno + '_' + nomeDipendente.replace(/\s+/g, '_');
  
  return { cartellaAnno: cartellaAnno, nomeFileArchivio: nomeFileArchivio };
}

function copiaFoglioCompleto(sourceSheet, targetSpreadsheet, newName) {
  // Ottieni dimensioni e dati
  const sourceRange = sourceSheet.getDataRange();
  const numRows = sourceRange.getNumRows();
  const numCols = sourceRange.getNumColumns();
  
  // Ottieni il primo foglio o creane uno nuovo
  let targetSheet = targetSpreadsheet.getSheets()[0];
  targetSheet.setName(newName);
  
  // Assicurati che il foglio target abbia abbastanza righe e colonne
  if (targetSheet.getMaxRows() < numRows) {
    targetSheet.insertRowsAfter(targetSheet.getMaxRows(), numRows - targetSheet.getMaxRows());
  }
  if (targetSheet.getMaxColumns() < numCols) {
    targetSheet.insertColumnsAfter(targetSheet.getMaxColumns(), numCols - targetSheet.getMaxColumns());
  }
  
  // Copia valori e formattazione
  const targetRange = targetSheet.getRange(1, 1, numRows, numCols);
  
  targetRange.setValues(sourceRange.getValues());
  targetRange.setBackgrounds(sourceRange.getBackgrounds());
  targetRange.setFontFamilies(sourceRange.getFontFamilies());
  targetRange.setFontColors(sourceRange.getFontColors());
  targetRange.setFontSizes(sourceRange.getFontSizes());
  targetRange.setFontWeights(sourceRange.getFontWeights());
  targetRange.setHorizontalAlignments(sourceRange.getHorizontalAlignments());
  targetRange.setVerticalAlignments(sourceRange.getVerticalAlignments());
  
  // Copia larghezza colonne
  for (let i = 1; i <= numCols; i++) {
    targetSheet.setColumnWidth(i, sourceSheet.getColumnWidth(i));
  }
  
  // Copia formati numerici
  try {
    targetRange.setNumberFormats(sourceRange.getNumberFormats());
  } catch (e) {
    console.log('Impossibile copiare formati numerici:', e.message);
  }
  
  // Copia formule se presenti
  try {
    const formulas = sourceRange.getFormulas();
    for (let i = 0; i < formulas.length; i++) {
      for (let j = 0; j < formulas[i].length; j++) {
        if (formulas[i][j]) {
          targetSheet.getRange(i + 1, j + 1).setFormula(formulas[i][j]);
        }
      }
    }
  } catch (e) {
    console.log('Impossibile copiare formule:', e.message);
  }
  
  return targetSheet;
}

function filtraDatiPerAnno(sheet, anno, modalita) {
  const dataRange = sheet.getDataRange();
  const allData = dataRange.getValues();
  const allFormats = dataRange.getBackgrounds();
  const numCols = dataRange.getNumColumns();
  
  // Preserva header
  const headerData = allData.slice(0, CONFIG.HEADER_ROWS);
  const headerFormats = allFormats.slice(0, CONFIG.HEADER_ROWS);
  
  // Filtra dati
  const filteredData = [];
  const filteredFormats = [];
  let oreTotali = 0;
  
  for (let i = CONFIG.HEADER_ROWS; i < allData.length; i++) {
    const row = allData[i];
    const dateValue = row[0]; // Assumo che la data sia nella prima colonna
    const ore = parseFloat(row[3]) || 0; // Assumo che le ore siano nella colonna D
    
    let rowYear = null;
    
    // Gestione date
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      rowYear = dateValue.getFullYear();
    } else if (typeof dateValue === 'string' && dateValue.match(/\d{2}\/\d{2}\/\d{4}/)) {
      // Formato italiano GG/MM/AAAA
      const parts = dateValue.split('/');
      rowYear = parseInt(parts[2]);
    }
    
    const shouldKeep = (modalita === 'mantieni') ? (rowYear === anno) : (rowYear !== anno);
    
    if (shouldKeep && rowYear !== null) {
      filteredData.push(row);
      filteredFormats.push(allFormats[i]);
      if (modalita === 'mantieni') {
        oreTotali += ore;
      }
    }
  }
  
  // Ricostruisci foglio
  sheet.clear();
  
  const finalData = headerData.concat(filteredData);
  const finalFormats = headerFormats.concat(filteredFormats);
  
  if (finalData.length > 0) {
    sheet.getRange(1, 1, finalData.length, numCols)
      .setValues(finalData)
      .setBackgrounds(finalFormats);
  }
  
  // Rimuovi righe in eccesso
  const totalRows = sheet.getMaxRows();
  if (totalRows > finalData.length) {
    sheet.deleteRows(finalData.length + 1, totalRows - finalData.length);
  }
  
  return {
    righeFinali: Math.max(0, filteredData.length),
    oreTotali: Math.round(oreTotali * 100) / 100 // Arrotonda a 2 decimali
  };
}

function creaExportFiles(spreadsheet, cartellaDestinazione, nomeBase) {
  const spreadsheetId = spreadsheet.getId();
  const token = ScriptApp.getOAuthToken();
  let filesCreated = [];
  
  // Export Excel
  try {
    const urlExcel = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
    const responseExcel = UrlFetchApp.fetch(urlExcel, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (responseExcel.getResponseCode() === 200) {
      const blobExcel = responseExcel.getBlob().setName(nomeBase + '.xlsx');
      const fileExcel = cartellaDestinazione.createFile(blobExcel);
      filesCreated.push('Excel: ' + fileExcel.getName());
      console.log('Excel creato: ' + fileExcel.getName());
    } else {
      console.error('Errore export Excel:', responseExcel.getContentText());
    }
  } catch (error) {
    console.error('Errore export Excel:', error.message);
  }
  
  // Export PDF - con parametri corretti
  try {
    // Ottieni l'ID del primo foglio
    const sheet = spreadsheet.getSheets()[0];
    const sheetId = sheet.getSheetId();
    
    const urlPdf = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?' +
      'format=pdf&' +
      'size=A4&' +
      'portrait=true&' +
      'fitw=true&' +
      'sheetnames=false&' +
      'printtitle=false&' +
      'pagenumbers=false&' +
      'gridlines=false&' +
      'fzr=false&' +
      'gid=' + sheetId;
    
    const responsePdf = UrlFetchApp.fetch(urlPdf, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (responsePdf.getResponseCode() === 200) {
      const blobPdf = responsePdf.getBlob().setName(nomeBase + '.pdf');
      const filePdf = cartellaDestinazione.createFile(blobPdf);
      filesCreated.push('PDF: ' + filePdf.getName());
      console.log('PDF creato: ' + filePdf.getName());
    } else {
      console.error('Errore export PDF:', responsePdf.getContentText());
    }
  } catch (error) {
    console.error('Errore export PDF:', error.message);
  }
  
  console.log('File creati:', filesCreated.join(', '));
  return filesCreated;
}

// ========== SEZIONE 2: FUNZIONI GESTIONE PASSWORD ==========

// 🔐 Funzione principale - chiamabile dal menu
function cambiaPasswordDipendente() {
  try {
    console.log('=== AVVIO CAMBIO PASSWORD ===');
    
    // 1. Leggi lista utenti dal foglio
    const utenti = getListaUtenti();
    
    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('❌ Errore\n\nNessun utente trovato nel foglio!');
      return;
    }
    
    // 2. Mostra dialog per selezione utente
    const utenteSelezionato = mostraDialogSelezioneUtente(utenti);
    
    if (!utenteSelezionato) {
      console.log('❌ Operazione annullata dall\'utente');
      return;
    }
    
    // 3. Mostra dialog per nuova password
    const nuovaPassword = mostraDialogNuovaPassword(utenteSelezionato);
    
    if (!nuovaPassword) {
      console.log('❌ Password non inserita');
      return;
    }
    
    // 4. Aggiorna password nel foglio
    const risultato = aggiornaPasswordNelFoglio(utenteSelezionato, nuovaPassword);
    
    if (risultato.success) {
      SpreadsheetApp.getUi().alert(
        '✅ Successo\n\n' + 
        'Password aggiornata per ' + utenteSelezionato.nome + '!\n\n' +
        '👤 Username: ' + utenteSelezionato.userId + '\n' +
        '🔐 Nuova password: ' + nuovaPassword + '\n\n' +
        'Hash generato automaticamente nella colonna H.'
      );
      
      console.log('✅ Password aggiornata con successo');
    } else {
      SpreadsheetApp.getUi().alert('❌ Errore\n\n' + risultato.message);
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
    SpreadsheetApp.getUi().alert('❌ Errore\n\nErrore imprevisto: ' + error.toString());
  }
}

// 📋 Leggi lista utenti dal foglio "Utenti"
function getListaUtenti() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const foglio = spreadsheet.getSheetByName('Utenti');
    
    if (!foglio) {
      throw new Error('Foglio "Utenti" non trovato');
    }
    
    const dati = foglio.getDataRange().getValues();
    const utenti = [];
    
    // Salta header (riga 1), leggi dati utenti
    for (let i = 1; i < dati.length; i++) {
      const riga = dati[i];
      
      // Controlla che ci siano dati utente validi
      if (riga[5] && riga[5] !== '' && riga[1] && riga[1] !== '') { // Username (F) e Nome (B)
        utenti.push({
          riga: i + 1,           // Riga nel foglio (1-based)
          userId: riga[5],       // Colonna F - Username  
          nome: riga[1],         // Colonna B - Nome Completo
          email: riga[2] || '',  // Colonna C - Email
          attivo: riga[8] || '', // Colonna I - Attivo
          hasPassword: !!(riga[6] && riga[6] !== ''), // Colonna G - Password attuale
          hasHash: !!(riga[7] && riga[7] !== '')      // Colonna H - Hash attuale
        });
      }
    }
    
    console.log('📋 Trovati ' + utenti.length + ' utenti validi');
    return utenti;
    
  } catch (error) {
    console.error('❌ Errore lettura utenti:', error);
    throw error;
  }
}

// 👤 Dialog per selezione utente  
function mostraDialogSelezioneUtente(utenti) {
  const ui = SpreadsheetApp.getUi();
  
  // Crea lista opzioni per dialog
  let opzioni = 'Seleziona utente:\n\n';
  utenti.forEach(function(utente, index) {
    const stato = utente.attivo === 'Si' ? '✅' : '❌';
    const sicurezza = utente.hasHash ? '🔐' : (utente.hasPassword ? '⚠️' : '❓');
    opzioni += (index + 1) + '. ' + stato + ' ' + sicurezza + ' ' + utente.nome + ' (' + utente.userId + ')\n';
  });
  
  opzioni += '\n🔐 = Hash presente | ⚠️ = Solo password | ❓ = Problema';
  opzioni += '\n✅ = Attivo | ❌ = Disattivato';
  
  const risposta = ui.prompt(
    '👤 Selezione Utente',
    opzioni + '\n\nInserisci il numero (1-' + utenti.length + '):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (risposta.getSelectedButton() === ui.Button.OK) {
    const numeroSelezionato = parseInt(risposta.getResponseText().trim());
    
    if (numeroSelezionato >= 1 && numeroSelezionato <= utenti.length) {
      const utenteSelezionato = utenti[numeroSelezionato - 1];
      console.log('👤 Utente selezionato:', utenteSelezionato.nome);
      return utenteSelezionato;
    } else {
      ui.alert('❌ Errore\n\nNumero non valido. Riprova.');
      return null;
    }
  }
  
  return null; // Operazione annullata
}

// 🔐 Dialog per inserimento nuova password
function mostraDialogNuovaPassword(utente) {
  const ui = SpreadsheetApp.getUi();
  
  const messaggio = '🔐 Nuova Password per: ' + utente.nome + '\n\n' +
                   '👤 Username: ' + utente.userId + '\n' +
                   '📧 Email: ' + utente.email + '\n' +
                   '📊 Stato: ' + (utente.attivo === 'Si' ? 'Attivo ✅' : 'Disattivato ❌') + '\n\n' +
                   'Inserisci la nuova password (minimo 4 caratteri):';
  
  const risposta = ui.prompt(
    '🔐 Nuova Password',
    messaggio,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (risposta.getSelectedButton() === ui.Button.OK) {
    const password = risposta.getResponseText().trim();
    
    if (password.length < 4) {
      ui.alert('❌ Errore\n\nLa password deve essere almeno 4 caratteri!');
      return null;
    }
    
    // Conferma password
    const conferma = ui.alert(
      '🔐 Conferma',
      'Cambiare password per ' + utente.nome + '?\n\nNuova password: "' + password + '"\n\n⚠️ Operazione irreversibile!',
      ui.ButtonSet.YES_NO
    );
    
    if (conferma === ui.Button.YES) {
      console.log('🔐 Password confermata per:', utente.nome);
      return password;
    }
  }
  
  return null; // Operazione annullata
}

// 💾 Aggiorna password nel foglio Google Sheets
function aggiornaPasswordNelFoglio(utente, nuovaPassword) {
  try {
    console.log('💾 Aggiornando password per ' + utente.nome + ' (riga ' + utente.riga + ')');
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const foglio = spreadsheet.getSheetByName('Utenti');
    
    if (!foglio) {
      throw new Error('Foglio "Utenti" non trovato');
    }
    
    // Genera hash della nuova password
    const hashPassword = generatePasswordHash(nuovaPassword);
    
    // Aggiorna colonna G (Password) e H (Hash)
    foglio.getRange(utente.riga, 7).setValue(nuovaPassword);  // Colonna G - Password
    foglio.getRange(utente.riga, 8).setValue(hashPassword);   // Colonna H - Hash
    
    console.log('✅ Password e hash aggiornati nel foglio');
    console.log('🔐 Hash generato:', hashPassword.substring(0, 16) + '...');
    
    return {
      success: true,
      message: 'Password aggiornata con successo'
    };
    
  } catch (error) {
    console.error('❌ Errore aggiornamento foglio:', error);
    return {
      success: false,
      message: 'Errore aggiornamento: ' + error.toString()
    };
  }
}

// 🔐 Genera hash password (stesso algoritmo del sistema principale)
function generatePasswordHash(password) {
  const salt = "OreLavoro2025_Salt_";
  const dataToHash = salt + password + salt;
  
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    dataToHash,
    Utilities.Charset.UTF_8
  );
  
  return hash.map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0');
  }).join('');
}

// 📋 Funzione supporto: mostra lista utenti (per debug)
function mostraListaUtenti() {
  try {
    const utenti = getListaUtenti();
    
    let lista = '📋 LISTA UTENTI (' + utenti.length + ' trovati)\n\n';
    
    utenti.forEach(function(utente, index) {
      const stato = utente.attivo === 'Si' ? '✅ Attivo' : '❌ Disattivo';
      const sicurezza = utente.hasHash ? '🔐 Hash OK' : (utente.hasPassword ? '⚠️ Solo Plain' : '❓ Nessuna Password');
      
      lista += (index + 1) + '. ' + utente.nome + '\n';
      lista += '   👤 Username: ' + utente.userId + '\n';
      lista += '   📧 Email: ' + utente.email + '\n';
      lista += '   📊 Stato: ' + stato + '\n';
      lista += '   🔐 Sicurezza: ' + sicurezza + '\n';
      lista += '   📍 Riga: ' + utente.riga + '\n\n';
    });
    
    SpreadsheetApp.getUi().alert('📋 Lista Utenti\n\n' + lista);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nErrore lettura utenti: ' + error.toString());
  }
}

// 🔍 Debug: stato hash password
function debugHashPassword() {
  try {
    const utenti = getListaUtenti();
    
    let debug = '🔍 DEBUG HASH PASSWORD\n\n';
    
    let problemi = 0;
    let sicuri = 0;
    
    utenti.forEach(function(utente) {
      if (utente.hasHash) {
        debug += '✅ ' + utente.nome + ' - Hash presente\n';
        sicuri++;
      } else if (utente.hasPassword) {
        debug += '⚠️ ' + utente.nome + ' - Solo password plain text\n';
        problemi++;
      } else {
        debug += '❌ ' + utente.nome + ' - Nessuna password!\n';
        problemi++;
      }
    });
    
    debug += '\n📊 RIASSUNTO:\n';
    debug += '🔐 Sicuri (con hash): ' + sicuri + '\n';
    debug += '⚠️ Da migrare: ' + problemi + '\n';
    debug += '📈 Totale utenti: ' + utenti.length + '\n';
    
    if (problemi > 0) {
      debug += '\n💡 Usa "Cambia Password Dipendente" per aggiornare hash.';
    }
    
    SpreadsheetApp.getUi().alert('🔍 Debug Hash\n\n' + debug);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nErrore debug: ' + error.toString());
  }
}

// ========== FUNZIONI UTILITY PER TEST ==========

function testSingoloArchivio() {
  // Funzione di test per debug archivio
  const result = eseguiArchiviazione('NomeDipendente', 2024);
  console.log('Risultato test:', result);
}

// ========== FINE SCRIPT COMBINATO ==========
