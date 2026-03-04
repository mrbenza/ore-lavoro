/**
 * GestioneUtenti.gs — Creazione Nuovi Utenti da Menu Sheets e API
 *
 * Gestisce il flusso completo di creazione di un nuovo utente (dipendente o admin)
 * sia tramite il menu interattivo di Google Sheets (executeCreateUser) sia tramite
 * l'endpoint HTTP (creaUtenteAPI). Il cuore della logica è creaUtenteCore(), che:
 *   - Verifica l'unicità dello username nel foglio Utenti
 *   - Auto-genera il prossimo ID utente (U001, U002, ...)
 *   - Genera l'hash SHA-256 della password
 *   - Scrive la nuova riga nel foglio Utenti con mapping colonne dinamico
 *   - Protegge la riga header del foglio Utenti (warning only)
 *   - Crea il foglio personale del dipendente da template o da zero
 *
 * DIPENDE DA:
 *   - GestionePassword.gs  → getColumnMapping()
 *   - Utils.gs             → generatePasswordHash()
 *   - Config.gs            → getMainSpreadsheet(), SHEET_NAMES
 *   - UtilsMenu.gs         → getSheetSafe()
 *
 * USATO DA: Main.gs → onOpen() (menu "👥 Gestione Utenti"), ApiRouter.gs (action='creaUtente')
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE LOGIC — creazione utente (condivisa da menu e API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuovo utente nel foglio Utenti e genera il suo foglio personale.
 *
 * Utilizza getColumnMapping() (GestionePassword.gs) per trovare le posizioni
 * delle colonne in modo dinamico, senza dipendere da indici fissi. Esegue:
 * verifica unicità username, auto-generazione ID sequenziale (U001…), hash
 * password, scrittura riga, protezione header, e creazione foglio dipendente
 * (da template 'Foglio utente Base' / 'Foglio Utenti Base' se presente,
 * altrimenti nuovo foglio con headers e formule SUMIFS).
 *
 * FLUSSO INTERNO:
 *   1. Apre spreadsheet principale e foglio Utenti
 *   2. getColumnMapping() → colMap
 *   3. Verifica unicità username su tutte le righe dati
 *   4. Auto-genera newId: legge colonna 'ID Utente', trova max U-number, incrementa
 *   5. generatePasswordHash(dati.password) → hash
 *   6. Costruisce newRow di lunghezza uguale alle colonne header, popola campi
 *   7. _creaFoglioDipendente(ss, dati.nomeCompleto) — PRIMA dell'appendRow:
 *      se la creazione del foglio lancia eccezione, appendRow non viene eseguito
 *      e lo stato del foglio Utenti rimane coerente (nessun utente orfano)
 *   8. appendRow(newRow)
 *   9. Protegge riga 1 con setWarningOnly(true)
 *  10. Restituisce { success: true, userId, message }
 *
 * CHIAMATA DA: executeCreateUser(), creaUtenteAPI()
 * CHIAMA:      getMainSpreadsheet() (Config.gs), getSheetSafe() (UtilsMenu.gs),
 *              getColumnMapping() (GestionePassword.gs),
 *              generatePasswordHash() (Utils.gs)
 *
 * @param {{
 *   nomeCompleto: string,
 *   email: string,
 *   telefono: string,
 *   dataAssunzione: Date|string,
 *   ruolo: string,
 *   username: string,
 *   password: string,
 *   attivo: string
 * }} dati - Dati del nuovo utente.
 * @returns {{ success: boolean, userId?: string, message: string }} Esito operazione.
 *
 * @example
 * creaUtenteCore({ nomeCompleto: 'Mario Rossi', email: 'mario@example.com',
 *   telefono: '', dataAssunzione: new Date(), ruolo: 'Dipendente',
 *   username: 'mario.rossi', password: 'pass1234', attivo: 'Si' });
 * // → { success: true, userId: 'U003', message: 'Utente creato con successo' }
 */
function creaUtenteCore(dati) {
  try {
    // 1. Apri spreadsheet e foglio Utenti
    const ss = getMainSpreadsheet();
    const usersSheet = getSheetSafe(ss, SHEET_NAMES.UTENTI);

    // 2. Mapping dinamico colonne
    const colMap = getColumnMapping(usersSheet);

    // Verifica colonne obbligatorie
    const requiredColumns = [
      'ID Utente', 'Nome Completo', 'Email', 'Telefono',
      'Data Assunzione', 'Ruolo', 'Username', 'Password', 'Password Hash', 'Attivo'
    ];
    for (const col of requiredColumns) {
      if (colMap[col] === undefined) {
        return {
          success: false,
          message: 'Colonna "' + col + '" non trovata nel foglio Utenti. Verificare la struttura del foglio.'
        };
      }
    }

    // 3. Verifica unicità username
    const allData = usersSheet.getDataRange().getValues();
    const usernameCol = colMap['Username'];
    for (let i = 1; i < allData.length; i++) {
      const existingUsername = (allData[i][usernameCol] || '').toString().trim();
      if (existingUsername.toLowerCase() === dati.username.toLowerCase()) {
        return { success: false, message: 'Username già in uso: ' + dati.username };
      }
    }

    // 4. Auto-genera prossimo ID utente (U001, U002, ...)
    const idCol = colMap['ID Utente'];
    let maxNum = 0;
    for (let i = 1; i < allData.length; i++) {
      const cellId = (allData[i][idCol] || '').toString().trim();
      if (/^U\d+$/i.test(cellId)) {
        const num = parseInt(cellId.substring(1), 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const newId = 'U' + String(maxNum + 1).padStart(3, '0');

    // 5. Genera hash password
    const hash = generatePasswordHash(dati.password);

    // 6. Costruisce la nuova riga (lunghezza = numero di colonne header)
    const numCols = Object.keys(colMap).length;
    const newRow = new Array(numCols).fill('');

    newRow[colMap['ID Utente']]       = newId;
    newRow[colMap['Nome Completo']]   = dati.nomeCompleto;
    newRow[colMap['Email']]           = dati.email || '';
    newRow[colMap['Telefono']]        = dati.telefono || '';
    newRow[colMap['Data Assunzione']] = dati.dataAssunzione || new Date();
    newRow[colMap['Ruolo']]           = dati.ruolo || 'Dipendente';
    newRow[colMap['Username']]        = dati.username;
    newRow[colMap['Password']]        = dati.password;
    newRow[colMap['Password Hash']]   = hash;
    newRow[colMap['Attivo']]          = dati.attivo || 'Si';

    // 7. Crea foglio personale dipendente PRIMA di appendRow:
    //    se la creazione lancia eccezione, la riga Utenti non viene scritta
    //    e lo stato resta coerente (nessun utente registrato senza foglio).
    _creaFoglioDipendente(ss, dati.nomeCompleto);

    // 8. Aggiungi riga al foglio Utenti
    usersSheet.appendRow(newRow);

    // 9. Proteggi riga header (warning only)
    try {
      const protection = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).protect();
      protection.setWarningOnly(true);
      protection.setDescription('Riga header protetta - non modificare');
    } catch (protErr) {
      // Non critico: logga ma non interrompe
      console.warn('creaUtenteCore: impossibile proteggere header Utenti:', protErr.message);
    }

    // 10. Risultato
    return {
      success: true,
      userId: newId,
      message: 'Utente creato con successo (ID: ' + newId + ')'
    };

  } catch (error) {
    console.error('creaUtenteCore - errore:', error.message);
    return { success: false, message: 'Errore durante la creazione utente: ' + error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER PRIVATO — creazione foglio personale dipendente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea il foglio personale del dipendente da template o da zero.
 *
 * Prima di qualsiasi operazione verifica se esiste già un foglio con lo stesso
 * nome: in caso affermativo registra un warning e termina senza errore (skip
 * idempotente). Questo evita eccezioni non gestite in caso di chiamate duplicate.
 *
 * Cerca i template 'Foglio utente Base' e 'Foglio Utenti Base' (entrambe le
 * varianti di nome). Se trovato, copia il template, rinomina il nuovo foglio
 * con il nome del dipendente e rimuove le protezioni ereditate dal template
 * (protezioni di tipo RANGE e SHEET) per garantire che GAS possa scrivere
 * senza restrizioni. Se non trovato, crea un foglio vuoto con headers in riga 1
 * (Data, Cantiere ID, Nome Cantiere, Ore, Note), congela la riga 1 e imposta
 * le tre formule SUMIFS (ore mese corrente in F2, mese precedente in G2,
 * anno corrente in H2).
 *
 * CHIAMATA DA: creaUtenteCore() — invocata PRIMA di appendRow() sul foglio Utenti
 * CHIAMA:      Spreadsheet.getSheetByName(), Sheet.copyTo(), Sheet.setName(),
 *              Sheet.getProtections(), Protection.remove(),
 *              Sheet.insertSheet(), Sheet.getRange(), Sheet.setValues(),
 *              Sheet.setFrozenRows()
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss             - Spreadsheet principale.
 * @param {string}                                    nomeDipendente - Nome completo del dipendente (usato come nome foglio).
 * @returns {void}
 */
function _creaFoglioDipendente(ss, nomeDipendente) {
  // FIX 2 — Controlla se il foglio esiste già: se sì, skip idempotente.
  // Evita eccezioni da setName() o insertSheet() in caso di chiamate duplicate.
  if (ss.getSheetByName(nomeDipendente)) {
    console.warn('_creaFoglioDipendente: foglio "' + nomeDipendente + '" esiste già — skip');
    return;
  }

  // Cerca template (supporta entrambe le varianti di nome)
  const template = ss.getSheetByName('Foglio utente Base') || ss.getSheetByName('Foglio Utenti Base');

  if (template) {
    // Copia template e rinomina
    const nuovoFoglio = template.copyTo(ss);
    nuovoFoglio.setName(nomeDipendente);

    // FIX 3 — Rimuovi protezioni ereditate dal template.
    // copyTo() copia anche le protezioni del foglio sorgente: se non vengono
    // rimosse possono bloccare la scrittura da GAS nelle operazioni successive.
    nuovoFoglio.getProtections(SpreadsheetApp.ProtectionType.RANGE)
      .forEach(function(p) { p.remove(); });
    nuovoFoglio.getProtections(SpreadsheetApp.ProtectionType.SHEET)
      .forEach(function(p) { p.remove(); });

    // Posiziona il nuovo foglio prima del template/foglio base
    var sheetNames = ['Foglio utente Base', 'Foglio Utenti Base', 'Foglio Cantieri Base'];
    var targetIndex = ss.getSheets().length + 1; // default: ultima posizione
    for (var i = 0; i < sheetNames.length; i++) {
      var baseSheet = ss.getSheetByName(sheetNames[i]);
      if (baseSheet) {
        targetIndex = baseSheet.getIndex(); // 1-based
        break;
      }
    }
    if (targetIndex <= ss.getSheets().length) {
      ss.setActiveSheet(nuovoFoglio);
      ss.moveActiveSheet(targetIndex);
    }

    console.log('_creaFoglioDipendente: foglio creato da template → ' + nomeDipendente);
  } else {
    // Crea foglio da zero
    const nuovoFoglio = ss.insertSheet(nomeDipendente);

    // Header in riga 1
    nuovoFoglio.getRange(1, 1, 1, 5).setValues([
      ['Data', 'Cantiere ID', 'Nome Cantiere', 'Ore', 'Note']
    ]);

    // FIX 4 — Congela riga 1 (header) nel path fallback.
    // Il path template eredita il freeze dal foglio sorgente; il path da zero
    // deve impostarlo esplicitamente per coerenza visiva e usabilità.
    nuovoFoglio.setFrozenRows(1);

    // Formule SUMIFS in F2, G2, H2 (locale italiana: punto e virgola come separatore)
    nuovoFoglio.getRange('F2').setFormula(
      '=SUMIFS(D:D;A:A;">="&DATE(YEAR(TODAY());MONTH(TODAY());1);A:A;"<"&DATE(YEAR(TODAY());MONTH(TODAY())+1;1))'
    );
    nuovoFoglio.getRange('G2').setFormula(
      '=SUMIFS(D:D;A:A;">="&DATE(YEAR(TODAY());MONTH(TODAY())-1;1);A:A;"<"&DATE(YEAR(TODAY());MONTH(TODAY());1))'
    );
    nuovoFoglio.getRange('H2').setFormula(
      '=SUMIFS(D:D;A:A;">="&DATE(YEAR(TODAY());1;1);A:A;"<"&DATE(YEAR(TODAY())+1;1;1))'
    );

    // Posiziona il foglio prima di Foglio Cantieri Base (gli unici template che
    // possono esistere nel path fallback — i fogli utente base non esistono per definizione)
    var baseSheet = ss.getSheetByName('Foglio Cantieri Base');
    if (baseSheet) {
      ss.setActiveSheet(nuovoFoglio);
      ss.moveActiveSheet(baseSheet.getIndex());
    }

    console.log('_creaFoglioDipendente: foglio creato da zero → ' + nomeDipendente);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT MENU — wizard interattivo creazione utente da Google Sheets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wizard interattivo per la creazione di un nuovo utente — entry point dal menu Sheets.
 *
 * Guida l'amministratore step-by-step tramite ui.prompt() e ui.alert():
 *   1. Nome Completo (obbligatorio)
 *   2. Username (obbligatorio)
 *   3. Password (min 4 caratteri)
 *   4. Email (opzionale)
 *   5. Ruolo (1=Dipendente, 2=Admin)
 *   6. Conferma YES/NO finale
 *   7. Chiamata a creaUtenteCore() e alert con risultato
 *
 * In qualsiasi punto del flusso l'admin può premere CANCEL per abortire.
 *
 * CHIAMATA DA: Main.gs → createNewUser() → onOpen() (menu "👥 Gestione Utenti")
 * CHIAMA:      creaUtenteCore(), SpreadsheetApp.getUi()
 *
 * @returns {void}
 */
function executeCreateUser() {
  const ui = SpreadsheetApp.getUi();

  // Step 1: Nome Completo
  const rispostaNome = ui.prompt(
    'Crea Nuovo Utente (1/5)',
    'Inserisci il nome completo del dipendente:',
    ui.ButtonSet.OK_CANCEL
  );
  if (rispostaNome.getSelectedButton() !== ui.Button.OK) return;
  const nomeCompleto = rispostaNome.getResponseText().trim();
  if (!nomeCompleto) {
    ui.alert('Errore\n\nIl nome completo è obbligatorio.');
    return;
  }

  // Step 2: Username
  const rispostaUsername = ui.prompt(
    'Crea Nuovo Utente (2/5)',
    'Inserisci lo username (es. mario.rossi):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rispostaUsername.getSelectedButton() !== ui.Button.OK) return;
  const username = rispostaUsername.getResponseText().trim();
  if (!username) {
    ui.alert('Errore\n\nLo username è obbligatorio.');
    return;
  }

  // Step 3: Password (min 4 caratteri)
  const rispostaPassword = ui.prompt(
    'Crea Nuovo Utente (3/5)',
    'Inserisci la password (minimo 4 caratteri):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rispostaPassword.getSelectedButton() !== ui.Button.OK) return;
  const password = rispostaPassword.getResponseText().trim();
  if (password.length < 4) {
    ui.alert('Errore\n\nLa password deve avere almeno 4 caratteri!');
    return;
  }

  // Step 4: Email (opzionale)
  const rispostaEmail = ui.prompt(
    'Crea Nuovo Utente (4/5)',
    'Inserisci l\'email (opzionale, premi OK per lasciare vuoto):',
    ui.ButtonSet.OK_CANCEL
  );
  if (rispostaEmail.getSelectedButton() !== ui.Button.OK) return;
  const email = rispostaEmail.getResponseText().trim();

  // Step 5: Ruolo
  const rispostaRuolo = ui.prompt(
    'Crea Nuovo Utente (5/5)',
    'Scegli il ruolo:\n\n1. Dipendente\n2. Admin\n\nInserisci 1 o 2:',
    ui.ButtonSet.OK_CANCEL
  );
  if (rispostaRuolo.getSelectedButton() !== ui.Button.OK) return;
  const sceltaRuolo = rispostaRuolo.getResponseText().trim();
  let ruolo;
  if (sceltaRuolo === '1') {
    ruolo = 'Dipendente';
  } else if (sceltaRuolo === '2') {
    ruolo = 'Admin';
  } else {
    ui.alert('Errore\n\nScelta non valida. Inserire 1 (Dipendente) o 2 (Admin).');
    return;
  }

  // Conferma finale
  const conferma = ui.alert(
    'Conferma Creazione Utente',
    'Stai per creare il seguente utente:\n\n' +
    'Nome: ' + nomeCompleto + '\n' +
    'Username: ' + username + '\n' +
    'Email: ' + (email || '(nessuna)') + '\n' +
    'Ruolo: ' + ruolo + '\n\n' +
    'Confermi la creazione?',
    ui.ButtonSet.YES_NO
  );
  if (conferma !== ui.Button.YES) return;

  // Crea utente
  const risultato = creaUtenteCore({
    nomeCompleto: nomeCompleto,
    email: email || '',
    telefono: '',
    dataAssunzione: new Date(),
    ruolo: ruolo,
    username: username,
    password: password,
    attivo: 'Si'
  });

  if (risultato.success) {
    ui.alert(
      'Utente Creato\n\n' +
      risultato.message + '\n\n' +
      'Nome: ' + nomeCompleto + '\n' +
      'Username: ' + username + '\n' +
      'Ruolo: ' + ruolo + '\n\n' +
      'Il foglio personale del dipendente è stato creato automaticamente.'
    );
  } else {
    ui.alert('Errore Creazione Utente\n\n' + risultato.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API WRAPPER — creazione utente via HTTP (solo admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un nuovo utente via HTTP — riservato agli amministratori.
 *
 * Wrapper API per creaUtenteCore(). Valida il sessionToken e verifica che il
 * richiedente abbia ruolo admin (stesso pattern di cambiaPasswordDipendente in
 * AdminAPI.gs: split('_')[0] → cerca username nel foglio Utenti → controlla Ruolo).
 * Deserializza datiJSON (stringa JSON), valida i campi obbligatori (nomeCompleto,
 * username, password ≥ 4 caratteri), poi delega a creaUtenteCore().
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='creaUtente')
 * CHIAMA:      validateSessionToken() (Authentication.gs), getWorksheet() (SheetsDAO.gs),
 *              buildColumnMap() (Utils.gs), creaUtenteCore(),
 *              Logger.debug/critical (Utils.gs)
 *
 * @param {string} sessionToken - Token di sessione dell'amministratore.
 * @param {string} datiJSON     - JSON string con i dati del nuovo utente:
 *   { nomeCompleto, email?, telefono?, dataAssunzione?, ruolo?, username, password, attivo? }
 * @returns {{ success: boolean, userId?: string, message: string }} Esito operazione.
 *
 * @example
 * creaUtenteAPI('admin_1709123456_abc',
 *   '{"nomeCompleto":"Mario Rossi","username":"mario.rossi","password":"pass1234","ruolo":"Dipendente"}');
 * // → { success: true, userId: 'U004', message: 'Utente creato con successo (ID: U004)' }
 */
function creaUtenteAPI(sessionToken, datiJSON) {
  try {
    // Valida token sessione
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }

    // Verifica ruolo admin (usa getMainSpreadsheet per compatibilità web app)
    var requestingUserId = sessionToken.split('_')[0];
    var userSheet = getSheetSafe(getMainSpreadsheet(), SHEET_NAMES.UTENTI);
    var userData = userSheet.getDataRange().getValues();
    var headerRow = userData[0];
    var colMapAdmin = buildColumnMap(headerRow);
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') { ruoloColumnIndex = j; break; }
    }
    var isAdmin = false;
    for (var u = 1; u < userData.length; u++) {
      if (String(userData[u][colMapAdmin['Username']]).trim() === requestingUserId) {
        isAdmin = (ruoloColumnIndex !== -1 &&
          ADMIN_VALIDATION.isAdminRole(userData[u][ruoloColumnIndex].toString()));
        break;
      }
    }
    if (!isAdmin) {
      return { success: false, message: 'Accesso non autorizzato: ruolo admin richiesto' };
    }

    // Deserializza datiJSON
    var dati;
    try {
      dati = (typeof datiJSON === 'string') ? JSON.parse(datiJSON) : datiJSON;
    } catch (parseErr) {
      return { success: false, message: 'Formato dati non valido: ' + parseErr.message };
    }

    // Valida campi obbligatori
    if (!dati.nomeCompleto || !dati.nomeCompleto.trim()) {
      return { success: false, message: 'Campo obbligatorio mancante: nomeCompleto' };
    }
    if (!dati.username || !dati.username.trim()) {
      return { success: false, message: 'Campo obbligatorio mancante: username' };
    }
    if (!dati.password || String(dati.password).trim().length < 4) {
      return { success: false, message: 'Password obbligatoria e di almeno 4 caratteri' };
    }

    // Normalizza campi opzionali
    const payload = {
      nomeCompleto:   dati.nomeCompleto.trim(),
      email:          (dati.email || '').trim(),
      telefono:       (dati.telefono || '').trim(),
      dataAssunzione: dati.dataAssunzione ? new Date(dati.dataAssunzione) : new Date(),
      ruolo:          (dati.ruolo || 'Dipendente').trim(),
      username:       dati.username.trim(),
      password:       String(dati.password).trim(),
      attivo:         (dati.attivo || 'Si').trim()
    };

    Logger.debug('creaUtenteAPI: richiesta da', requestingUserId, '→ username target:', payload.username);

    const risultato = creaUtenteCore(payload);

    if (risultato.success) {
      Logger.debug('creaUtenteAPI: utente creato', risultato.userId);
    } else {
      Logger.critical('creaUtenteAPI: creazione fallita:', risultato.message);
    }

    return risultato;

  } catch (error) {
    Logger.critical('Errore creaUtenteAPI:', error);
    return { success: false, message: 'Errore: ' + error.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API WRAPPER — aggiornamento stato attivo/disattivo utente (solo admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggiorna il campo "Attivo" (Si/No) di un utente nel foglio Utenti.
 *
 * Valida il sessionToken, verifica che il richiedente abbia ruolo admin
 * (pattern identico a creaUtenteAPI: split('_')[0] + ADMIN_VALIDATION.isAdminRole),
 * controlla che nuovoStato sia esattamente 'Si' o 'No', poi scrive il valore
 * nella colonna 'Attivo' della riga corrispondente a targetUserId.
 *
 * Utilizza getColumnMapping() (GestionePassword.gs) per trovare le posizioni
 * delle colonne in modo dinamico, senza dipendere da indici fissi.
 *
 * CHIAMATA DA: ApiRouter.gs → doGet/doPost (action='aggiornaStatoUtente')
 * CHIAMA:      validateSessionToken() (Utils.gs), getMainSpreadsheet() (Config.gs),
 *              getSheetSafe() (UtilsMenu.gs), getColumnMapping() (GestionePassword.gs),
 *              ADMIN_VALIDATION.isAdminRole() (Config.gs), SHEET_NAMES.UTENTI (Config.gs)
 *
 * @param {string} sessionToken  - Token di sessione dell'amministratore.
 * @param {string} targetUserId  - Username dell'utente da modificare (colonna 'Username').
 * @param {string} nuovoStato    - Nuovo valore per la colonna 'Attivo': 'Si' oppure 'No'.
 * @returns {{ success: boolean, message: string }} Esito operazione.
 *
 * @example
 * aggiornaStatoUtenteAPI('admin_1709123456_abc', 'mario.rossi', 'No');
 * // → { success: true, message: 'Stato aggiornato: mario.rossi → No' }
 */
function aggiornaStatoUtenteAPI(sessionToken, targetUserId, nuovoStato) {
  try {
    // 1. Valida sessione (validateSessionToken restituisce boolean)
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida o scaduta.' };
    }

    // 2. Apri spreadsheet e foglio Utenti
    var ss = getMainSpreadsheet();
    var usersSheet = getSheetSafe(ss, SHEET_NAMES.UTENTI);
    var colMap = getColumnMapping(usersSheet);
    var data = usersSheet.getDataRange().getValues();

    // 3. Verifica ruolo admin (pattern identico a creaUtenteAPI)
    var requestingUserId = sessionToken.split('_')[0];
    var headerRow = data[0];
    var colMapAdmin = buildColumnMap(headerRow);
    var ruoloColumnIndex = -1;
    for (var j = 0; j < headerRow.length; j++) {
      if (headerRow[j] === 'Ruolo') { ruoloColumnIndex = j; break; }
    }
    var isAdmin = false;
    for (var u = 1; u < data.length; u++) {
      if (String(data[u][colMapAdmin['Username']]).trim() === requestingUserId) {
        isAdmin = (ruoloColumnIndex !== -1 &&
          ADMIN_VALIDATION.isAdminRole(data[u][ruoloColumnIndex].toString()));
        break;
      }
    }
    if (!isAdmin) {
      return { success: false, message: 'Accesso non autorizzato: ruolo admin richiesto.' };
    }

    // 4. Valida nuovoStato — ammessi solo i valori canonici del foglio Utenti
    if (nuovoStato !== 'Si' && nuovoStato !== 'No') {
      return { success: false, message: 'Stato non valido. Valori accettati: "Si" o "No".' };
    }

    // 5. Verifica che le colonne necessarie esistano nel foglio
    var attivoCol = colMap['Attivo'];
    var usernameCol = colMap['Username'];
    if (attivoCol === undefined || usernameCol === undefined) {
      return { success: false, message: 'Colonne "Attivo" o "Username" non trovate nel foglio Utenti.' };
    }

    // 6. Trova la riga dell'utente target e aggiorna la colonna Attivo
    for (var i = 1; i < data.length; i++) {
      var rowUsername = (data[i][usernameCol] || '').toString().trim();
      if (rowUsername === targetUserId) {
        // colMap restituisce indici 0-based; getRange vuole indici 1-based
        usersSheet.getRange(i + 1, attivoCol + 1).setValue(nuovoStato);
        Logger.debug('aggiornaStatoUtenteAPI:', targetUserId, '→', nuovoStato);
        return { success: true, message: 'Stato aggiornato: ' + targetUserId + ' → ' + nuovoStato };
      }
    }

    return { success: false, message: 'Utente "' + targetUserId + '" non trovato.' };

  } catch (error) {
    Logger.critical('Errore aggiornaStatoUtenteAPI:', error);
    return { success: false, message: 'Errore interno: ' + error.message };
  }
}
