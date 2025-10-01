// ===== GESTIONE PASSWORD - VERSIONE DINAMICA (AUTO-ADATTIVA) =====

/**
 * Mappa delle colonne - letta dinamicamente dagli header
 */
function getColumnMapping(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnMap = {};
  
  headers.forEach((header, index) => {
    if (header) {
      columnMap[header.toString().trim()] = index;
    }
  });
  
  return columnMap;
}

/**
 * Funzione principale - Cambia password dipendente (chiamabile dal menu)
 */
function executeChangeEmployeePassword() {
  try {
    // 1. Leggi lista utenti
    const utenti = getUsersList();
    
    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('❌ Errore\n\nNessun dipendente trovato!');
      return;
    }
    
    // 2. Selezione utente
    const utenteSelezionato = showUserSelectionDialog(utenti);
    if (!utenteSelezionato) return;
    
    // 3. Nuova password
    const nuovaPassword = showNewPasswordDialog(utenteSelezionato);
    if (!nuovaPassword) return;
    
    // 4. Aggiorna password
    const risultato = updateUserPassword(utenteSelezionato, nuovaPassword);
    
    if (risultato.success) {
      SpreadsheetApp.getUi().alert(
        '✅ Completato\n\n' + 
        'Password cambiata per ' + utenteSelezionato.nome + '\n\n' +
        '👤 Username: ' + utenteSelezionato.userId + '\n' +
        '🔐 Nuova password: ' + nuovaPassword
      );
    } else {
      SpreadsheetApp.getUi().alert('❌ Errore\n\n' + risultato.message);
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nQualcosa è andato storto: ' + error.message);
  }
}

/**
 * Legge lista dipendenti dal foglio "Utenti" - VERSIONE DINAMICA
 */
function getUsersList() {
  const spreadsheet = getMainSpreadsheet();
  const usersSheet = getSheetSafe(spreadsheet, 'Utenti');
  
  // Leggi mappa colonne dagli header
  const colMap = getColumnMapping(usersSheet);
  
  // Verifica che esistano le colonne necessarie
  const requiredColumns = ['Username', 'Nome Completo', 'Attivo', 'Password', 'Password Hash'];
  for (const col of requiredColumns) {
    if (colMap[col] === undefined) {
      throw new Error(`Colonna "${col}" non trovata nel foglio Utenti!`);
    }
  }
  
  const data = usersSheet.getDataRange().getValues();
  const utenti = [];
  
  // Leggi dalla riga 2 (salta header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    const username = row[colMap['Username']];
    const nome = row[colMap['Nome Completo']];
    
    // Solo se ha username e nome
    if (username && nome) {
      utenti.push({
        rowIndex: i + 1,
        userId: username.toString().trim(),
        nome: nome.toString().trim(),
        attivo: (row[colMap['Attivo']] || '').toString().trim(),
        hasPassword: !!(row[colMap['Password']] && row[colMap['Password']] !== ''),
        colMap: colMap  // Salviamo la mappa per usarla dopo
      });
    }
  }
  
  return utenti;
}

/**
 * Dialog selezione utente - versione minimalista
 */
function showUserSelectionDialog(utenti) {
  const ui = SpreadsheetApp.getUi();
  
  let opzioni = 'Scegli il dipendente:\n\n';
  
  utenti.forEach((utente, index) => {
    const stato = utente.attivo.toLowerCase() === 'si' ? '✅' : '❌';
    opzioni += `${index + 1}. ${stato} ${utente.nome}\n`;
  });
  
  opzioni += '\n✅ = Attivo | ❌ = Non attivo';
  opzioni += `\n\nScrivi il numero (1-${utenti.length}):`;
  
  const response = ui.prompt('👤 Selezione Dipendente', opzioni, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const numero = parseInt(response.getResponseText().trim());
    
    if (numero >= 1 && numero <= utenti.length) {
      return utenti[numero - 1];
    } else {
      ui.alert('❌ Errore\n\nNumero non valido.');
      return null;
    }
  }
  
  return null;
}

/**
 * Dialog nuova password - versione minimalista
 */
function showNewPasswordDialog(utente) {
  const ui = SpreadsheetApp.getUi();
  
  const messaggio = `Nuova password per:\n\n` +
                   `👤 ${utente.nome}\n` +
                   `🆔 ${utente.userId}\n\n` +
                   `Scrivi la nuova password:`;
  
  const response = ui.prompt('🔐 Nuova Password', messaggio, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const password = response.getResponseText().trim();
    
    if (password.length < 4) {
      ui.alert('❌ Errore\n\nLa password deve avere almeno 4 caratteri!');
      return null;
    }
    
    // UNICA conferma finale
    const conferma = ui.alert(
      '🔐 Conferma',
      `Cambiare la password di ${utente.nome}?\n\n` +
      `Nuova password: "${password}"\n\n` +
      `⚠️ Non potrai annullare questa operazione!`,
      ui.ButtonSet.YES_NO
    );
    
    return conferma === ui.Button.YES ? password : null;
  }
  
  return null;
}

/**
 * Aggiorna password nel foglio - VERSIONE DINAMICA
 */
function updateUserPassword(utente, nuovaPassword) {
  try {
    const spreadsheet = getMainSpreadsheet();
    const usersSheet = getSheetSafe(spreadsheet, 'Utenti');
    
    // Rileggi la mappa colonne (per sicurezza)
    const colMap = getColumnMapping(usersSheet);
    
    // Genera hash sicuro
    const hashedPassword = generatePasswordHash(nuovaPassword);
    
    // Aggiorna colonne Password e Password Hash (posizione dinamica)
    const passwordCol = colMap['Password'] + 1;  // +1 perché getRange parte da 1
    const hashCol = colMap['Password Hash'] + 1;
    
    usersSheet.getRange(utente.rowIndex, passwordCol).setValue(nuovaPassword);
    usersSheet.getRange(utente.rowIndex, hashCol).setValue(hashedPassword);
    
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      message: 'Impossibile salvare la nuova password: ' + error.message
    };
  }
}

/**
 * Lista dipendenti - versione semplificata per supporto
 */
function displayUsersList() {
  try {
    const utenti = getUsersList();
    
    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('❌ Errore\n\nNessun dipendente trovato!');
      return;
    }
    
    let lista = `📋 DIPENDENTI (${utenti.length})\n\n`;
    
    let attivi = 0;
    
    utenti.forEach((utente, index) => {
      const stato = utente.attivo.toLowerCase() === 'si' ? '✅ Attivo' : '❌ Non attivo';
      const sicurezza = utente.hasPassword ? '🔐' : '❓';
      
      if (utente.attivo.toLowerCase() === 'si') attivi++;
      
      lista += `${index + 1}. ${stato} ${sicurezza} ${utente.nome}\n`;
    });
    
    lista += `\n📊 Attivi: ${attivi}/${utenti.length}`;
    lista += '\n🔐 = Ha password | ❓ = Senza password';
    
    SpreadsheetApp.getUi().alert('📋 Lista Dipendenti\n\n' + lista);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nImpossibile leggere la lista dipendenti: ' + error.message);
  }
}

/**
 * Debug semplificato - solo info essenziali
 */
function executeDebugPasswordHash() {
  try {
    const utenti = getUsersList();
    
    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('❌ Errore\n\nNessun dipendente trovato!');
      return;
    }
    
    let sicuri = 0;
    let daSistemmare = 0;
    
    utenti.forEach(utente => {
      if (utente.hasPassword) {
        sicuri++;
      } else {
        daSistemmare++;
      }
    });
    
    let stato = `🔐 STATO PASSWORD\n\n`;
    stato += `✅ Con password: ${sicuri}\n`;
    stato += `❌ Senza password: ${daSistemmare}\n`;
    stato += `📊 Totale: ${utenti.length}\n\n`;
    
    if (daSistemmare > 0) {
      stato += `⚠️ Ci sono ${daSistemmare} dipendenti senza password.\n`;
      stato += `Usa "Cambia Password" per sistemarli.`;
    } else {
      stato += `🎉 Tutti i dipendenti hanno la password!`;
    }
    
    SpreadsheetApp.getUi().alert('🔐 Controllo Password\n\n' + stato);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nImpossibile controllare le password: ' + error.message);
  }
}
