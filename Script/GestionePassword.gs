/**
 * GestionePassword.gs — Gestione Password Dipendenti da Menu Sheets
 *
 * Espone un flusso interattivo per consentire all'amministratore di modificare
 * la password di qualsiasi dipendente direttamente dal menu Google Sheets,
 * senza accedere alla dashboard web. Legge e scrive le colonne 'Password' e
 * 'Password Hash' nel foglio Utenti, generando l'hash SHA-256 tramite
 * generatePasswordHash() (Utils.gs).
 *
 * La versione "dinamica" (auto-adattiva) legge le posizioni delle colonne
 * dagli header del foglio Utenti tramite getColumnMapping(), eliminando la
 * dipendenza dagli indici fissi di COLUMNS (Config.gs).
 *
 * USATO DA: Main.gs → onOpen() (menu "Gestione Password")
 * DIPENDE DA: Utils.gs (generatePasswordHash),
 *             UtilsMenu.gs (getSheetSafe),
 *             Config.gs (getMainSpreadsheet, SHEET_NAMES)
 */

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING COLONNE DINAMICO — lettura posizioni colonne dagli header
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Costruisce una mappa {nomeColonna: indice0based} leggendo gli header del foglio.
 *
 * A differenza di buildColumnMap() in Utils.gs (che usa varianti e fuzzy
 * matching), questa funzione effettua un matching esatto sul testo dell'header
 * trimmed. Usata esclusivamente in GestionePassword.gs per accedere alle
 * colonne 'Username', 'Nome Completo', 'Attivo', 'Password', 'Password Hash'.
 *
 * CHIAMATA DA: getUsersList(), updateUserPassword()
 * CHIAMA:      Sheet.getRange()
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Foglio Utenti.
 * @returns {Object.<string, number>} Mappa {nomeHeader: indice0based}.
 *
 * @example
 * const colMap = getColumnMapping(usersSheet);
 * // colMap['Password Hash'] → 8  (se colonna I è l'indice 8)
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

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT MENU — flusso principale cambio password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flusso principale cambio password dipendente — entry point dal menu Sheets.
 *
 * Coordina in sequenza: lettura lista utenti, selezione utente via dialog,
 * inserimento nuova password via dialog con conferma, e aggiornamento nel
 * foglio Utenti. Mostra il risultato tramite alert UI con username e
 * nuova password in chiaro (solo per l'amministratore che esegue l'azione).
 *
 * FLUSSO INTERNO:
 *   1. getUsersList() → array utenti
 *   2. Se vuoto → alert errore, return
 *   3. showUserSelectionDialog(utenti) → utente selezionato (o null se cancel)
 *   4. showNewPasswordDialog(utente) → password (o null se cancel)
 *   5. updateUserPassword(utente, password) → risultato
 *   6. Alert di successo con username e password, o alert errore
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Password")
 * CHIAMA:      getUsersList(), showUserSelectionDialog(), showNewPasswordDialog(),
 *              updateUserPassword(), SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function executeChangeEmployeePassword() {
  try {
    // 1. Leggi lista utenti
    const utenti = getUsersList();

    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('Errore\n\nNessun dipendente trovato!');
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
        'Completato\n\n' +
        'Password cambiata per ' + utenteSelezionato.nome + '\n\n' +
        'Username: ' + utenteSelezionato.userId + '\n' +
        'Nuova password: ' + nuovaPassword
      );
    } else {
      SpreadsheetApp.getUi().alert('Errore\n\n' + risultato.message);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('Errore\n\nQualcosa e\' andato storto: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LETTURA DATI — lista utenti dal foglio Utenti
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legge la lista di tutti gli utenti dal foglio Utenti con mapping dinamico.
 *
 * Legge la mappa colonne tramite getColumnMapping() e verifica che le colonne
 * obbligatorie ('Username', 'Nome Completo', 'Attivo', 'Password',
 * 'Password Hash') siano presenti. Restituisce un array di oggetti utente
 * arricchiti con rowIndex (1-based), colMap e flag hasPassword.
 *
 * FLUSSO INTERNO:
 *   1. getMainSpreadsheet() → spreadsheet principale
 *   2. getSheetSafe() → foglio Utenti
 *   3. getColumnMapping() → mappa indici colonne
 *   4. Verifica colonne obbligatorie (lancia eccezione se mancanti)
 *   5. Itera righe dalla 2 (salta header), include solo utenti con username+nome
 *   6. Restituisce array di { rowIndex, userId, nome, attivo, hasPassword, colMap }
 *
 * CHIAMATA DA: executeChangeEmployeePassword(), displayUsersList(),
 *              executeDebugPasswordHash()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getColumnMapping(), SHEET_NAMES.UTENTI
 *
 * @returns {Array<{
 *   rowIndex: number,
 *   userId: string,
 *   nome: string,
 *   attivo: string,
 *   hasPassword: boolean,
 *   colMap: Object.<string, number>
 * }>} Lista utenti.
 * @throws {Error} Se una colonna obbligatoria non è presente nel foglio Utenti.
 */
function getUsersList() {
  const spreadsheet = getMainSpreadsheet();
  const usersSheet = getSheetSafe(spreadsheet, SHEET_NAMES.UTENTI);

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

// ─────────────────────────────────────────────────────────────────────────────
// DIALOG INTERATTIVI — selezione utente e inserimento password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra un dialog testuale per selezionare il dipendente da modificare.
 *
 * Costruisce una lista numerata degli utenti (con indicatore stato attivo/non
 * attivo) e chiede all'admin di inserire il numero del dipendente desiderato.
 * Restituisce l'oggetto utente corrispondente, o null se l'utente ha cancellato
 * o inserito un numero non valido.
 *
 * CHIAMATA DA: executeChangeEmployeePassword()
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {Array<{ userId: string, nome: string, attivo: string }>} utenti - Lista utenti.
 * @returns {{ userId: string, nome: string, rowIndex: number, colMap: Object }|null}
 *   Utente selezionato, o null se annullato/input non valido.
 */
function showUserSelectionDialog(utenti) {
  const ui = SpreadsheetApp.getUi();

  let opzioni = 'Scegli il dipendente:\n\n';

  utenti.forEach((utente, index) => {
    const stato = utente.attivo.toLowerCase() === 'si' ? 'ATTIVO' : 'NON ATTIVO';
    opzioni += `${index + 1}. [${stato}] ${utente.nome}\n`;
  });

  opzioni += `\nScrivi il numero (1-${utenti.length}):`;

  const response = ui.prompt('Selezione Dipendente', opzioni, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() === ui.Button.OK) {
    const numero = parseInt(response.getResponseText().trim());

    if (numero >= 1 && numero <= utenti.length) {
      return utenti[numero - 1];
    } else {
      ui.alert('Errore\n\nNumero non valido.');
      return null;
    }
  }

  return null;
}

/**
 * Mostra un dialog per inserire la nuova password con conferma YES/NO finale.
 *
 * Chiede la nuova password tramite ui.prompt(), valida che abbia almeno
 * 4 caratteri, poi mostra una conferma finale con alert YES/NO prima di
 * procedere. Restituisce la password trimmed in caso di conferma, null
 * se l'utente annulla in qualsiasi punto del flusso.
 *
 * FLUSSO INTERNO:
 *   1. ui.prompt() → risposta testuale
 *   2. Se CANCEL → return null
 *   3. Se password.length < 4 → alert errore, return null
 *   4. ui.alert YES/NO per conferma
 *   5. Se YES → return password, altrimenti null
 *
 * CHIAMATA DA: executeChangeEmployeePassword()
 * CHIAMA:      SpreadsheetApp.getUi()
 *
 * @param {{ nome: string, userId: string }} utente - Dati utente per personalizzare il messaggio.
 * @returns {string|null} Nuova password in chiaro, o null se annullato.
 */
function showNewPasswordDialog(utente) {
  const ui = SpreadsheetApp.getUi();

  const messaggio = `Nuova password per:\n\n` +
                   `${utente.nome}\n` +
                   `Username: ${utente.userId}\n\n` +
                   `Scrivi la nuova password:`;

  const response = ui.prompt('Nuova Password', messaggio, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() === ui.Button.OK) {
    const password = response.getResponseText().trim();

    if (password.length < 4) {
      ui.alert('Errore\n\nLa password deve avere almeno 4 caratteri!');
      return null;
    }

    // Conferma finale
    const conferma = ui.alert(
      'Conferma',
      `Cambiare la password di ${utente.nome}?\n\n` +
      `Nuova password: "${password}"\n\n` +
      `Attenzione: Non potrai annullare questa operazione!`,
      ui.ButtonSet.YES_NO
    );

    return conferma === ui.Button.YES ? password : null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRITTURA — aggiornamento password e hash nel foglio Utenti
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna le colonne Password e Password Hash nel foglio Utenti per un utente.
 *
 * Utilizza il colMap salvato nell'oggetto utente (da getUsersList()) per
 * determinare le posizioni esatte delle colonne, rende così il codice
 * robusto a variazioni nell'ordine delle colonne del foglio. Scrive la
 * password in chiaro nella colonna Password e l'hash SHA-256 nella colonna
 * Password Hash.
 *
 * ATTENZIONE: La password in chiaro viene scritta nel foglio come fallback
 * per compatibilità con eventuali sistemi legacy. In produzione si consiglia
 * di verificare che le autorizzazioni del foglio limitino l'accesso a questa
 * colonna.
 *
 * FLUSSO INTERNO:
 *   1. getMainSpreadsheet() → spreadsheet principale
 *   2. getSheetSafe() → foglio Utenti
 *   3. getColumnMapping() per ri-leggere la mappa (sicurezza)
 *   4. generatePasswordHash(nuovaPassword) → hash SHA-256
 *   5. setRange(rowIndex, passwordCol).setValue(nuovaPassword)
 *   6. setRange(rowIndex, hashCol).setValue(hashedPassword)
 *
 * CHIAMATA DA: executeChangeEmployeePassword()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getColumnMapping(), generatePasswordHash() (Utils.gs),
 *              SHEET_NAMES.UTENTI
 *
 * @param {{ rowIndex: number, colMap: Object.<string, number> }} utente - Dati utente con mappa colonne.
 * @param {string} nuovaPassword - Nuova password in chiaro.
 * @returns {{ success: boolean, message?: string }} Esito dell'operazione.
 *
 * @example
 * const res = updateUserPassword({ rowIndex: 3, colMap: {...} }, 'nuovaPass');
 * // res → { success: true }
 */
function updateUserPassword(utente, nuovaPassword) {
  try {
    const spreadsheet = getMainSpreadsheet();
    const usersSheet = getSheetSafe(spreadsheet, SHEET_NAMES.UTENTI);

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

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICA — visualizzazione lista e stato password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mostra la lista completa dei dipendenti con stato attivo e presenza password.
 *
 * Legge la lista utenti e mostra un riepilogo testuale tramite alert UI:
 * per ogni utente indica stato attivo/non attivo e se ha una password
 * configurata. Usata dall'admin per avere un colpo d'occhio sullo stato
 * del sistema utenti senza accedere al foglio Utenti direttamente.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Password")
 * CHIAMA:      getUsersList(), SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function displayUsersList() {
  try {
    const utenti = getUsersList();

    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('Errore\n\nNessun dipendente trovato!');
      return;
    }

    let lista = `DIPENDENTI (${utenti.length})\n\n`;

    let attivi = 0;

    utenti.forEach((utente, index) => {
      const stato = utente.attivo.toLowerCase() === 'si' ? 'Attivo' : 'Non attivo';
      const sicurezza = utente.hasPassword ? '[con password]' : '[senza password]';

      if (utente.attivo.toLowerCase() === 'si') attivi++;

      lista += `${index + 1}. [${stato}] ${sicurezza} ${utente.nome}\n`;
    });

    lista += `\nAttivi: ${attivi}/${utenti.length}`;
    lista += '\n[con password] = password configurata | [senza password] = da configurare';

    SpreadsheetApp.getUi().alert('Lista Dipendenti\n\n' + lista);

  } catch (error) {
    SpreadsheetApp.getUi().alert('Errore\n\nImpossibile leggere la lista dipendenti: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SELF-SERVICE — cambio password da parte dell'utente autenticato
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cambio password self-service — consente all'utente autenticato di cambiare
 * la propria password verificando prima quella attuale.
 *
 * A differenza di cambiaPasswordDipendente() (riservata agli admin), questa
 * funzione non richiede privilegi di amministratore: chiunque con un session
 * token valido può cambiare la propria password purché conosca quella corrente.
 *
 * FLUSSO INTERNO:
 *   1. validateSessionToken(sessionToken) → se falso, errore sessione non valida
 *   2. Estrae userId = sessionToken.split('_')[0]
 *   3. getMainSpreadsheet() + getSheetSafe() → foglio Utenti
 *   4. getColumnMapping() → mappa dinamica colonne
 *   5. Scansiona righe per trovare la riga con Username = userId
 *   6. Se non trovato → errore 'Utente non trovato'
 *   7. Legge hash attuale dalla colonna 'Password Hash'
 *   8. generatePasswordHash(vecchiaPassword) e confronta
 *   9. Se non corrisponde → errore 'Password attuale non corretta'
 *  10. Valida nuovaPassword (minimo 4 caratteri)
 *  11. Scrive generatePasswordHash(nuovaPassword) e nuovaPassword nelle
 *      rispettive colonne (stesso comportamento di updateUserPassword)
 *  12. Ritorna { success: true, message: 'Password aggiornata con successo' }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='cambiaPasswordUtente')
 * CHIAMA:      validateSessionToken() (Authentication.gs),
 *              getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getColumnMapping(), generatePasswordHash() (Utils.gs),
 *              handleError() (Utils.gs), SHEET_NAMES.UTENTI
 *
 * @param {string} sessionToken - Token di sessione dell'utente corrente.
 * @param {string} vecchiaPassword - Password attuale in chiaro (per verifica).
 * @param {string} nuovaPassword - Nuova password in chiaro (minimo 4 caratteri).
 * @returns {{ success: boolean, message: string }} Esito dell'operazione.
 *
 * @example
 * var res = cambiaPasswordUtente('mario_abc123', 'vecchia', 'nuova1234');
 * // res → { success: true, message: 'Password aggiornata con successo' }
 */
function cambiaPasswordUtente(sessionToken, vecchiaPassword, nuovaPassword) {
  try {
    // 1. Valida sessione
    if (!validateSessionToken(sessionToken)) {
      Logger.warn('cambiaPasswordUtente: sessione non valida');
      return { success: false, message: 'Sessione non valida' };
    }

    // 2. Estrai userId dal token
    var userId = sessionToken.split('_')[0];
    Logger.info('cambiaPasswordUtente: richiesta cambio password per userId=' + userId);

    // 3. Accedi al foglio Utenti
    var spreadsheet = getMainSpreadsheet();
    var usersSheet = getSheetSafe(spreadsheet, SHEET_NAMES.UTENTI);

    // 4. Lettura dinamica colonne
    var colMap = getColumnMapping(usersSheet);

    // Verifica presenza colonne obbligatorie
    var required = ['Username', 'Password', 'Password Hash'];
    for (var i = 0; i < required.length; i++) {
      if (colMap[required[i]] === undefined) {
        return { success: false, message: 'Configurazione foglio non valida: colonna "' + required[i] + '" mancante' };
      }
    }

    // 5. Trova la riga dell'utente
    var data = usersSheet.getDataRange().getValues();
    var userRowIndex = -1;
    var userRowData = null;

    for (var r = 1; r < data.length; r++) {  // parte da 1, salta header
      var rowUsername = (data[r][colMap['Username']] || '').toString().trim();
      if (rowUsername === userId) {
        userRowIndex = r + 1;  // converti in 1-based per getRange
        userRowData = data[r];
        break;
      }
    }

    // 6. Utente non trovato
    if (userRowIndex === -1) {
      Logger.warn('cambiaPasswordUtente: utente non trovato - userId=' + userId);
      return { success: false, message: 'Utente non trovato' };
    }

    // 7. Leggi hash attuale dalla colonna 'Password Hash'
    var hashAttuale = (userRowData[colMap['Password Hash']] || '').toString().trim();

    // 8. Verifica vecchia password
    var hashVecchia = generatePasswordHash(vecchiaPassword);
    if (hashVecchia !== hashAttuale) {
      Logger.warn('cambiaPasswordUtente: password attuale non corretta per userId=' + userId);
      return { success: false, message: 'Password attuale non corretta' };
    }

    // 9. Valida nuova password
    if (!nuovaPassword || nuovaPassword.length < 4) {
      return { success: false, message: 'La nuova password deve avere almeno 4 caratteri' };
    }

    // 10. Aggiorna Password e Password Hash (stesso pattern di updateUserPassword)
    var passwordCol = colMap['Password'] + 1;      // +1: getRange è 1-based
    var hashCol = colMap['Password Hash'] + 1;
    var nuovoHash = generatePasswordHash(nuovaPassword);

    usersSheet.getRange(userRowIndex, passwordCol).setValue(nuovaPassword);
    usersSheet.getRange(userRowIndex, hashCol).setValue(nuovoHash);

    Logger.info('cambiaPasswordUtente: password aggiornata con successo per userId=' + userId);

    // 11. Risposta di successo
    return { success: true, message: 'Password aggiornata con successo' };

  } catch (error) {
    return handleError('cambiaPasswordUtente', error);
  }
}

/**
 * Mostra il riepilogo dello stato password per tutti i dipendenti.
 *
 * Conta quanti dipendenti hanno una password configurata (hasPassword = true)
 * e quanti ne sono privi. Mostra il risultato tramite alert UI con un
 * messaggio di stato generale. Utile come check rapido prima di un deploy
 * o per identificare utenti da configurare.
 *
 * CHIAMATA DA: Main.gs → onOpen() (menu Sheets "Gestione Password")
 * CHIAMA:      getUsersList(), SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function executeDebugPasswordHash() {
  try {
    const utenti = getUsersList();

    if (utenti.length === 0) {
      SpreadsheetApp.getUi().alert('Errore\n\nNessun dipendente trovato!');
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

    let stato = `STATO PASSWORD\n\n`;
    stato += `Con password: ${sicuri}\n`;
    stato += `Senza password: ${daSistemmare}\n`;
    stato += `Totale: ${utenti.length}\n\n`;

    if (daSistemmare > 0) {
      stato += `Ci sono ${daSistemmare} dipendenti senza password.\n`;
      stato += `Usa "Cambia Password" per sistemarli.`;
    } else {
      stato += `Tutti i dipendenti hanno la password!`;
    }

    SpreadsheetApp.getUi().alert('Controllo Password\n\n' + stato);

  } catch (error) {
    SpreadsheetApp.getUi().alert('Errore\n\nImpossibile controllare le password: ' + error.message);
  }
}
