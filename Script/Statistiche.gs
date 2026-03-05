/**
 * Statistiche.gs — Aggregazione Statistiche Ore per Cantiere e Dipendente
 *
 * Implementa il sistema di aggregazione periodica delle ore lavorate,
 * salvando i risultati nel foglio "Amministrazione" in tre tabelle affiancate:
 *   - Tabella A (col A:F)  — ore per cantiere, per mese/anno
 *   - Tabella B (col H:M)  — ore per dipendente, per mese/anno
 *   - Tabella C (col O:AE) — riepilogo annuale con breakdown mensile
 *
 * TRIGGER TEMPORALI:
 *   - aggregaDatiGiornalieri → ogni giorno alle 4:00 (aggiorna mese corrente)
 *   - aggregaDatiMensile     → 1° del mese alle 4:00 (snapshot mese concluso)
 *
 * USATO DA: ApiRouter.gs (action='getStatistiche', action='forzaAggregazione')
 *           Main.gs (sottomenu "Statistiche")
 */

// ─────────────────────────────────────────────────────────────────────────────
// SETUP FOGLIO AMMINISTRAZIONE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepara il foglio "Amministrazione" con header e formattazione per le tre tabelle.
 *
 * Da eseguire una sola volta (da menu). Crea le tre tabelle affiancate nel foglio
 * "Amministrazione", congela la riga 1 e formatta gli header con sfondo scuro.
 * Se il foglio non esiste lancia un errore; usare Sheet Agent per crearlo prima.
 *
 * FLUSSO INTERNO:
 *   1. Recupera il foglio Amministrazione tramite getSheetSafe()
 *   2. Scrive gli header delle tre tabelle nelle rispettive range
 *   3. Congela la riga 1
 *   4. Formatta gli header (sfondo #1a237e, testo bianco, bold)
 *   5. Mostra alert di conferma
 *
 * CHIAMATA DA: onOpen() → sottomenu "Statistiche" → "Setup foglio Amministrazione"
 * CHIAMA:      getMainSpreadsheet(), getSheetSafe()
 *
 * @returns {void}
 */
function setupAmministrazioneSheet() {
  try {
    const ss = getMainSpreadsheet();

    // 1. Se il foglio esiste già, eliminalo per ripartire da zero
    const esistente = ss.getSheetByName(SHEET_STATS.SHEET_NAME);
    if (esistente) {
      ss.deleteSheet(esistente);
      Logger.info('[Statistiche] Foglio Amministrazione esistente eliminato per reset');
    }

    // 2. Crea il foglio nuovo ed espandi alle colonne necessarie (default = 26, serve 34)
    const sheetAmm = ss.insertSheet(SHEET_STATS.SHEET_NAME);
    var colsNeeded = 34; // fino alla colonna AH (guida)
    var colsExisting = sheetAmm.getMaxColumns();
    if (colsExisting < colsNeeded) {
      sheetAmm.insertColumnsAfter(colsExisting, colsNeeded - colsExisting);
    }

    // 3. Larghezze colonne — Tabella A (A:F)
    sheetAmm.setColumnWidth(1, 55);   // Anno
    sheetAmm.setColumnWidth(2, 55);   // Mese
    sheetAmm.setColumnWidth(3, 90);   // Cantiere ID
    sheetAmm.setColumnWidth(4, 200);  // Nome Cantiere
    sheetAmm.setColumnWidth(5, 80);   // Ore Totali
    sheetAmm.setColumnWidth(6, 100);  // Aggiornato
    // Separatore G
    sheetAmm.setColumnWidth(7, 18);
    // Tabella B (H:M)
    sheetAmm.setColumnWidth(8, 55);   // Anno
    sheetAmm.setColumnWidth(9, 55);   // Mese
    sheetAmm.setColumnWidth(10, 110); // User ID
    sheetAmm.setColumnWidth(11, 160); // Nome Dipendente
    sheetAmm.setColumnWidth(12, 80);  // Ore Totali
    sheetAmm.setColumnWidth(13, 100); // Aggiornato
    // Separatore N
    sheetAmm.setColumnWidth(14, 18);
    // Tabella C (O:AE) — Anno, Tipo, EntityID, Nome + 12 mesi + Totale
    sheetAmm.setColumnWidth(15, 55);  // Anno
    sheetAmm.setColumnWidth(16, 80);  // Tipo
    sheetAmm.setColumnWidth(17, 100); // Entity ID
    sheetAmm.setColumnWidth(18, 160); // Nome
    for (var m = 19; m <= 30; m++) sheetAmm.setColumnWidth(m, 48); // Gen–Dic
    sheetAmm.setColumnWidth(31, 90);  // Totale Anno

    // 4. Header Tabella A — Cantieri (A1:F1)
    sheetAmm.getRange(1, 1, 1, 6).setValues([[
      'Anno', 'Mese', 'Cantiere ID', 'Nome Cantiere', 'Ore Totali', 'Aggiornato'
    ]]);

    // 5. Header Tabella B — Dipendenti (H1:M1)
    sheetAmm.getRange(1, 8, 1, 6).setValues([[
      'Anno', 'Mese', 'User ID', 'Nome Dipendente', 'Ore Totali', 'Aggiornato'
    ]]);

    // 6. Header Tabella C — Riepilogo annuale (O1:AE1, 17 colonne)
    sheetAmm.getRange(1, 15, 1, 17).setValues([[
      'Anno', 'Tipo', 'Entity ID', 'Nome',
      'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
      'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
      'Totale Anno'
    ]]);

    // 7. Congela riga 1 e imposta altezza generosa (40px)
    sheetAmm.setFrozenRows(1);
    sheetAmm.setRowHeight(1, 40);

    // 8. Colori header distinti per tabella + stile bold/centrato
    const boldWhite = SpreadsheetApp.newTextStyle().setBold(true).setForegroundColor('#ffffff').setFontSize(11).build();
    const boldDark  = SpreadsheetApp.newTextStyle().setBold(true).setForegroundColor('#ffffff').setFontSize(11).build();

    // Tabella A: blu scuro
    var rA = sheetAmm.getRange(1, 1, 1, 6);
    rA.setBackground('#1a237e'); rA.setTextStyle(boldWhite);
    rA.setHorizontalAlignment('center'); rA.setVerticalAlignment('middle');
    rA.setBorder(true, true, true, true, true, false, '#3949ab', SpreadsheetApp.BorderStyle.SOLID);

    // Tabella B: verde scuro
    var rB = sheetAmm.getRange(1, 8, 1, 6);
    rB.setBackground('#1b5e20'); rB.setTextStyle(boldDark);
    rB.setHorizontalAlignment('center'); rB.setVerticalAlignment('middle');
    rB.setBorder(true, true, true, true, true, false, '#388e3c', SpreadsheetApp.BorderStyle.SOLID);

    // Tabella C: bordeaux/viola
    var rC = sheetAmm.getRange(1, 15, 1, 17);
    rC.setBackground('#4a148c'); rC.setTextStyle(boldDark);
    rC.setHorizontalAlignment('center'); rC.setVerticalAlignment('middle');
    rC.setBorder(true, true, true, true, true, false, '#7b1fa2', SpreadsheetApp.BorderStyle.SOLID);

    // 9. Colonne separatore G e N — grigio scuro sottile
    sheetAmm.getRange('G:G').setBackground('#bdbdbd');
    sheetAmm.getRange('N:N').setBackground('#bdbdbd');
    sheetAmm.getRange(1, 7).setValue('');
    sheetAmm.getRange(1, 14).setValue('');

    // 10. Etichette titolo tabella nella riga 1 celle separatore (rotated note)
    sheetAmm.getRange(1, 7).setNote('SEPARATORE — Tabella A | Tabella B');
    sheetAmm.getRange(1, 14).setNote('SEPARATORE — Tabella B | Tabella C');

    // 11. Guida struttura — area a destra della Tabella C (col AH, indice 34)
    var colGuida = 34; // colonna AH
    sheetAmm.setColumnWidth(colGuida, 380);
    var guida = [
      ['📋  GUIDA AL FOGLIO AMMINISTRAZIONE'],
      [''],
      ['🔵  TABELLA A  (colonne A:F)'],
      ['Ore per cantiere, per mese.'],
      ['Una riga per ogni combinazione Anno+Mese+Cantiere.'],
      ['Popolata ogni giorno alle 4:00 dal trigger giornaliero.'],
      [''],
      ['🟢  TABELLA B  (colonne H:M)'],
      ['Ore per dipendente, per mese.'],
      ['Una riga per ogni combinazione Anno+Mese+Dipendente.'],
      ['Popolata ogni giorno alle 4:00 dal trigger giornaliero.'],
      [''],
      ['🟣  TABELLA C  (colonne O:AE)'],
      ['Riepilogo annuale: 12 mesi + totale per cantiere/dipendente.'],
      ['Una riga per Anno+Tipo+Entità. Tipo = "cantiere" o "dipendente".'],
      ['Aggiornata da "Forza aggregazione completa" e 1° del mese.'],
      [''],
      ['⚙️  AGGIORNAMENTO AUTOMATICO'],
      ['• Ogni giorno alle 4:00 → aggiorna mese corrente (Tab A+B)'],
      ['• 1° del mese alle 4:00 → snapshot mese chiuso + Tab C'],
      ['• Da menu → Statistiche → Forza aggregazione: ricalcola tutto'],
      [''],
      ['🔑  COLONNE SEPARATORE (G, N)'],
      ['Colonne grigie usate solo come separatori visivi.'],
      ['Non contengono dati — non modificare.'],
    ];
    sheetAmm.getRange(1, colGuida, guida.length, 1).setValues(guida);

    // Titolo guida: sfondo giallo, bold, grande
    var titolo = sheetAmm.getRange(1, colGuida);
    titolo.setBackground('#fff9c4');
    titolo.setTextStyle(SpreadsheetApp.newTextStyle().setBold(true).setFontSize(12).build());
    titolo.setHorizontalAlignment('left');
    titolo.setVerticalAlignment('middle');

    // Titoli sezioni guida
    [3, 8, 13, 18, 23].forEach(function(r) {
      var cell = sheetAmm.getRange(r, colGuida);
      cell.setTextStyle(SpreadsheetApp.newTextStyle().setBold(true).setFontSize(10).build());
    });

    // 9. Sposta il foglio in prima posizione
    ss.setActiveSheet(sheetAmm);
    ss.moveActiveSheet(1);

    Logger.info('[Statistiche] Foglio Amministrazione creato e posizionato in prima posizione');

    // 10. Popola subito con i dati disponibili (aggregazione completa anno corrente)
    SpreadsheetApp.flush();
    forzaAggregazioneCompleta();

    SpreadsheetApp.getUi().alert(
      'Foglio "Amministrazione" ricreato, formattato e popolato con i dati attuali!'
    );

  } catch (error) {
    Logger.error('[Statistiche] Errore setup foglio Amministrazione: ' + error.toString());
    SpreadsheetApp.getUi().alert('Errore durante il setup: ' + error.toString());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER TEMPORALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger giornaliero — aggiorna le statistiche del mese e anno correnti.
 *
 * Chiamata ogni giorno alle 4:00 dal trigger time-based installato da
 * setupTriggers(). Aggiorna le righe del mese corrente nelle Tabelle A e B
 * del foglio "Amministrazione".
 *
 * FLUSSO INTERNO:
 *   1. Calcola anno e mese correnti
 *   2. Delega a _aggiornaStatsMese(anno, mese)
 *
 * CHIAMATA DA: trigger time-based GAS (ogni giorno ore 4)
 *              forzaAggregazioneCompleta() (come sub-step)
 * CHIAMA:      _aggiornaStatsMese()
 *
 * @returns {void}
 */
function aggregaDatiGiornalieri() {
  const now = new Date();
  const anno = now.getFullYear();
  const mese = now.getMonth() + 1;
  _aggiornaStatsMese(anno, mese);
}

/**
 * Trigger mensile — salva snapshot del mese appena concluso.
 *
 * Chiamata il 1° di ogni mese alle 4:00. Calcola le statistiche del mese
 * precedente (quello appena concluso) e le salva nel foglio "Amministrazione".
 *
 * FLUSSO INTERNO:
 *   1. Calcola anno e mese del mese precedente
 *   2. Delega a _aggiornaStatsMese(anno, mese)
 *
 * CHIAMATA DA: trigger time-based GAS (1° del mese ore 4)
 * CHIAMA:      _aggiornaStatsMese()
 *
 * @returns {void}
 */
function aggregaDatiMensile() {
  const now = new Date();
  // mese appena concluso
  const dataPassata = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const anno = dataPassata.getFullYear();
  const mese = dataPassata.getMonth() + 1;
  _aggiornaStatsMese(anno, mese);
  Logger.info('[Statistiche] Snapshot mese ' + mese + '/' + anno + ' completato');
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGAZIONE COMPLETA (da menu e da API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ricalcola tutti i mesi dell'anno corrente (gennaio → mese corrente).
 *
 * Chiamabile da menu o via API (wrapper forzaAggregazioneAPI). Aggiorna in
 * sequenza ogni mese dell'anno corrente e poi ricalcola la Tabella C (riepilogo
 * annuale). Usa Utilities.sleep(500) tra un mese e l'altro per evitare throttling.
 *
 * FLUSSO INTERNO:
 *   1. Itera da mese 1 al mese corrente
 *   2. Per ogni mese chiama _aggiornaStatsMese(anno, mese)
 *   3. Al termine chiama _aggiornaRiepilogoAnnuale(anno)
 *
 * CHIAMATA DA: Main.gs → menu "Statistiche" → "Forza aggregazione completa"
 *              forzaAggregazioneAPI() (wrapper per chiamata API)
 * CHIAMA:      _aggiornaStatsMese(), _aggiornaRiepilogoAnnuale(), Utilities.sleep()
 *
 * @returns {void}
 */
function forzaAggregazioneCompleta() {
  const anno = new Date().getFullYear();
  const meseCorrente = new Date().getMonth() + 1;
  for (let mese = 1; mese <= meseCorrente; mese++) {
    _aggiornaStatsMese(anno, mese);
    Utilities.sleep(500);
  }
  _aggiornaRiepilogoAnnuale(anno);
  Logger.info('[Statistiche] Aggregazione completa anno ' + anno);
}

/**
 * Ricalcola le statistiche per un anno storico specifico (tutti i 12 mesi).
 * Da eseguire da menu per recuperare dati di anni passati mai aggregati.
 *
 * CHIAMATA DA: Main.gs → menu "Statistiche" → "Ricalcola anno storico..."
 * CHIAMA:      _aggiornaStatsMese(), _aggiornaRiepilogoAnnuale()
 */
function forzaAggregazioneAnnoStorico() {
  const ui = SpreadsheetApp.getUi();
  const risposta = ui.prompt(
    'Ricalcola anno storico',
    'Inserisci l\'anno da ricalcolare (es. 2025):',
    ui.ButtonSet.OK_CANCEL
  );
  if (risposta.getSelectedButton() !== ui.Button.OK) return;

  const anno = parseInt(risposta.getResponseText().trim());
  if (isNaN(anno) || anno < 2020 || anno > new Date().getFullYear()) {
    ui.alert('Anno non valido. Inserisci un anno tra 2020 e ' + new Date().getFullYear() + '.');
    return;
  }

  const annoCorrente = new Date().getFullYear();
  const meseFine = (anno === annoCorrente) ? new Date().getMonth() + 1 : 12;

  ui.alert('Avvio ricalcolo per il ' + anno + '. Attendere...');
  for (let mese = 1; mese <= meseFine; mese++) {
    _aggiornaStatsMese(anno, mese);
    Utilities.sleep(500);
  }
  _aggiornaRiepilogoAnnuale(anno);
  Logger.info('[Statistiche] Aggregazione storico anno ' + anno + ' completata');
  ui.alert('Ricalcolo ' + anno + ' completato.');
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTALLAZIONE TRIGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Installa i trigger time-driven per l'aggregazione automatica.
 *
 * Da eseguire UNA VOLTA da menu. Rimuove eventuali trigger esistenti per le
 * funzioni aggregaDatiGiornalieri e aggregaDatiMensile prima di creare i nuovi.
 *
 * TRIGGER INSTALLATI:
 *   - aggregaDatiGiornalieri: ogni giorno tra le 4:00 e le 5:00
 *   - aggregaDatiMensile: il 1° di ogni mese tra le 4:00 e le 5:00
 *
 * CHIAMATA DA: Main.gs → menu "Statistiche" → "Installa trigger automatici"
 * CHIAMA:      ScriptApp.getProjectTriggers(), ScriptApp.deleteTrigger(),
 *              ScriptApp.newTrigger()
 *
 * @returns {void}
 */
function setupTriggers() {
  // Rimuovi trigger esistenti per queste funzioni
  ScriptApp.getProjectTriggers()
    .filter(t => ['aggregaDatiGiornalieri', 'aggregaDatiMensile'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger giornaliero: ogni giorno tra le 4:00 e le 5:00
  ScriptApp.newTrigger('aggregaDatiGiornalieri')
    .timeBased().everyDays(1).atHour(4).create();

  // Trigger mensile: il 1° di ogni mese tra le 4:00 e le 5:00
  ScriptApp.newTrigger('aggregaDatiMensile')
    .timeBased().onMonthDay(1).atHour(4).create();

  Logger.info('[Statistiche] Trigger installati: giornaliero + mensile');
  SpreadsheetApp.getUi().alert('Trigger installati correttamente!');
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNZIONI PRIVATE — LOGICA CORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuore del sistema — calcola e persiste ore per cantiere e dipendente per il mese dato.
 *
 * Scansiona tutti i fogli dipendente (escludendo i fogli di sistema), aggrega
 * le ore per cantiere e per dipendente, poi aggiorna le Tabelle A e B nel foglio
 * "Amministrazione" tramite upsert (aggiorna se riga esiste, inserisce se nuova).
 *
 * FLUSSO INTERNO:
 *   1. Apre il foglio Amministrazione; esce silenziosamente se non trovato
 *   2. Legge la lista cantieri dal foglio Cantieri → mappa {id: nome}
 *   3. Itera tutti i fogli non-sistema dello spreadsheet
 *   4. Per ogni foglio legge tutte le righe, filtra per anno+mese, accumula ore
 *   5. Chiama _upsertStatsCantieri() e _upsertStatsDipendenti()
 *
 * CHIAMATA DA: aggregaDatiGiornalieri(), aggregaDatiMensile(), forzaAggregazioneCompleta()
 * CHIAMA:      getMainSpreadsheet(), getSheetSafely(), isSystemSheet(),
 *              _getUserIdByNomeFoglio(), _upsertStatsCantieri(), _upsertStatsDipendenti()
 *
 * @param {number} anno - Anno target (es. 2026).
 * @param {number} mese - Mese target 1-based (1=Gennaio, 12=Dicembre).
 * @returns {void}
 */
function _aggiornaStatsMese(anno, mese) {
  const ss = getMainSpreadsheet();
  const sheetAmm = getSheetSafely(ss, SHEET_STATS.SHEET_NAME);
  if (!sheetAmm) {
    Logger.warn('[Statistiche] Foglio Amministrazione non trovato');
    return;
  }

  const dataAggiornamento = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

  // 1. Ottieni tutti i fogli dipendente (escludi system sheets)
  const fogli = ss.getSheets().filter(s => !isSystemSheet(s.getName()));

  // 2. Ottieni lista cantieri dal foglio Cantieri
  const sheetCantieri = getSheetSafely(ss, SHEET_NAMES.CANTIERI);
  const cantieri = {}; // { cantiereId: nomeCantiere }
  if (sheetCantieri) {
    const righe = sheetCantieri.getDataRange().getValues();
    for (let i = 1; i < righe.length; i++) {
      const id = String(righe[i][0]).trim();
      const nome = String(righe[i][1]).trim();
      if (id) cantieri[id] = nome;
    }
  }

  // 3. Aggrega ore per cantiere e per dipendente per questo mese
  const oreCantieri = {};  // { cantiereId: { nome, ore } }
  const oreDipendenti = {}; // { userId: { nome, ore } }

  for (const foglio of fogli) {
    const nomeFoglio = foglio.getName();
    const lastRow = foglio.getLastRow();
    if (lastRow < 2) continue;

    const dati = foglio.getDataRange().getValues();

    // Cerca userId corrispondente dal foglio Utenti
    const userId = _getUserIdByNomeFoglio(ss, nomeFoglio) || nomeFoglio;

    let oreDip = 0;

    for (let i = CONFIG.DATA_STRUCTURE.HEADER_ROWS; i < dati.length; i++) {
      const riga = dati[i];
      const dataRiga = riga[CONFIG.DATA_STRUCTURE.COLUMNS.DATA]; // col A
      if (!dataRiga) continue;

      // Filtra per anno e mese
      const d = dataRiga instanceof Date ? dataRiga : new Date(dataRiga);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== anno || (d.getMonth() + 1) !== mese) continue;

      const cantiereId = String(riga[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID] || '').trim(); // col B
      const ore = parseFloat(riga[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;                    // col D
      if (ore <= 0) continue;

      // Accumula per cantiere
      if (cantiereId) {
        if (!oreCantieri[cantiereId]) {
          oreCantieri[cantiereId] = { nome: cantieri[cantiereId] || cantiereId, ore: 0 };
        }
        oreCantieri[cantiereId].ore += ore;
      }

      oreDip += ore;
    }

    if (oreDip > 0) {
      oreDipendenti[userId] = { nome: nomeFoglio, ore: oreDip };
    }
  }

  // 4. Scrivi/aggiorna Tabella A (cantieri)
  _upsertStatsCantieri(sheetAmm, anno, mese, oreCantieri, dataAggiornamento);

  // 5. Scrivi/aggiorna Tabella B (dipendenti)
  _upsertStatsDipendenti(sheetAmm, anno, mese, oreDipendenti, dataAggiornamento);
}

/**
 * Cerca nel foglio Utenti il userId corrispondente al nome del foglio dipendente.
 *
 * Usa buildColumnMap() per mapping colonne robusto (case-insensitive, varianti
 * nomi colonna). Cerca per corrispondenza esatta del nome completo.
 *
 * CHIAMATA DA: _aggiornaStatsMese()
 * CHIAMA:      getSheetSafely(), buildColumnMap()
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss         - Spreadsheet principale.
 * @param {string}                                   nomeFoglio - Nome del foglio dipendente.
 * @returns {string|null} userId trovato, o null se non trovato.
 */
function _getUserIdByNomeFoglio(ss, nomeFoglio) {
  const sheetUtenti = getSheetSafely(ss, SHEET_NAMES.UTENTI);
  if (!sheetUtenti) return null;

  const lastRow = sheetUtenti.getLastRow();
  if (lastRow < 2) return null;

  const allData = sheetUtenti.getDataRange().getValues();
  const headers = allData[0];
  const colMap = buildColumnMap(headers);

  // Usa indici dal mapping dinamico con fallback sulle costanti COLUMNS
  const colNome = colMap['Nome Completo'] !== undefined ? colMap['Nome Completo'] : COLUMNS.NOME;
  const colId = colMap['Username'] !== undefined ? colMap['Username'] : COLUMNS.USER_ID;

  const nomeFoglioLower = nomeFoglio.trim().toLowerCase();
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][colNome]).trim().toLowerCase() === nomeFoglioLower) {
      return String(allData[i][colId]).trim();
    }
  }
  Logger.warn('[Statistiche] UserId non trovato per foglio: ' + nomeFoglio + ' — verrà usato il nome foglio come ID');
  return null;
}

/**
 * Aggiorna (upsert) le righe di Tabella A (cantieri) per anno+mese dato.
 *
 * Per ogni cantiere in oreCantieri cerca una riga esistente in Tabella A con
 * stesso anno, mese e cantiereId. Se trovata la aggiorna, altrimenti inserisce
 * una nuova riga nella prima cella vuota della colonna A.
 *
 * STRUTTURA TABELLA A: col A=Anno, B=Mese, C=CantiereID, D=NomeCantiere, E=OreTotali, F=Aggiornato
 * INDICI (0-based): ANNO=0, MESE=1, CANTIERE_ID=2, NOME_CANTIERE=3, ORE_TOTALI=4, DATA_AGG=5
 *
 * CHIAMATA DA: _aggiornaStatsMese()
 * CHIAMA:      sheet.getDataRange(), sheet.getRange(), sheet.getLastRow()
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet            - Foglio Amministrazione.
 * @param {number}                             anno             - Anno target.
 * @param {number}                             mese             - Mese target (1-12).
 * @param {Object}                             oreCantieri      - Mappa {cantiereId: {nome, ore}}.
 * @param {string}                             dataAgg          - Data aggiornamento (dd/MM/yyyy).
 * @returns {void}
 */
function _upsertStatsCantieri(sheet, anno, mese, oreCantieri, dataAgg) {
  const C = SHEET_STATS.CANTIERI;
  const datiEsistenti = sheet.getDataRange().getValues();

  Object.keys(oreCantieri).forEach(id => {
    const { nome, ore } = oreCantieri[id];
    const nuovaRiga = [anno, mese, id, nome, ore, dataAgg];

    // Cerca riga esistente per anno+mese+cantiereId
    let rigaTrovata = -1;
    for (let i = 1; i < datiEsistenti.length; i++) {
      const r = datiEsistenti[i];
      if (r[C.ANNO] == anno && r[C.MESE] == mese && String(r[C.CANTIERE_ID]).trim() === id) {
        rigaTrovata = i + 1; // 1-based per setValues
        break;
      }
    }

    if (rigaTrovata > 0) {
      // Aggiorna riga esistente (col A=1, 6 colonne)
      sheet.getRange(rigaTrovata, C.START_COL + 1, 1, 6).setValues([nuovaRiga]);
    } else {
      // Inserisce in prima riga vuota nella colonna A
      const primaRigaVuota = _primaRigaVuotaColonna(sheet, C.START_COL + 1);
      sheet.getRange(primaRigaVuota, C.START_COL + 1, 1, 6).setValues([nuovaRiga]);
    }
  });
}

/**
 * Aggiorna (upsert) le righe di Tabella B (dipendenti) per anno+mese dato.
 *
 * Stessa logica di _upsertStatsCantieri ma opera sulla Tabella B (col H:M, indici 7-12).
 * Per ogni dipendente in oreDipendenti cerca una riga con stesso anno, mese e userId.
 *
 * STRUTTURA TABELLA B: col H=Anno, I=Mese, J=UserID, K=NomeDipendente, L=OreTotali, M=Aggiornato
 * INDICI (0-based): ANNO=7, MESE=8, USER_ID=9, NOME=10, ORE_TOTALI=11, DATA_AGG=12
 *
 * CHIAMATA DA: _aggiornaStatsMese()
 * CHIAMA:      sheet.getDataRange(), sheet.getRange(), _primaRigaVuotaColonna()
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet            - Foglio Amministrazione.
 * @param {number}                             anno             - Anno target.
 * @param {number}                             mese             - Mese target (1-12).
 * @param {Object}                             oreDipendenti    - Mappa {userId: {nome, ore}}.
 * @param {string}                             dataAgg          - Data aggiornamento (dd/MM/yyyy).
 * @returns {void}
 */
function _upsertStatsDipendenti(sheet, anno, mese, oreDipendenti, dataAgg) {
  const D = SHEET_STATS.DIPENDENTI;
  const datiEsistenti = sheet.getDataRange().getValues();

  Object.keys(oreDipendenti).forEach(userId => {
    const { nome, ore } = oreDipendenti[userId];
    const nuovaRiga = [anno, mese, userId, nome, ore, dataAgg];

    // Cerca riga esistente per anno+mese+userId
    let rigaTrovata = -1;
    for (let i = 1; i < datiEsistenti.length; i++) {
      const r = datiEsistenti[i];
      if (r[D.ANNO] == anno && r[D.MESE] == mese && String(r[D.USER_ID]).trim() === userId) {
        rigaTrovata = i + 1; // 1-based per setValues
        break;
      }
    }

    if (rigaTrovata > 0) {
      // Aggiorna riga esistente (col H=8, 6 colonne)
      sheet.getRange(rigaTrovata, D.START_COL + 1, 1, 6).setValues([nuovaRiga]);
    } else {
      // Inserisce in prima riga vuota nella colonna H
      const primaRigaVuota = _primaRigaVuotaColonna(sheet, D.START_COL + 1);
      sheet.getRange(primaRigaVuota, D.START_COL + 1, 1, 6).setValues([nuovaRiga]);
    }
  });
}

/**
 * Ricalcola la Tabella C (riepilogo annuale) per l'anno dato.
 *
 * Legge le Tabelle A e B già popolate per l'anno, raggruppa i dati per
 * cantiere e dipendente con il breakdown mensile (12 mesi + totale),
 * e li persiste nella Tabella C tramite upsert su anno+tipo+entityId.
 *
 * STRUTTURA TABELLA C: col O=Anno, P=Tipo, Q=EntityID, R=Nome, S-AD=Mesi(1-12), AE=TotaleAnno
 * INDICI (0-based): ANNO=14, TIPO=15, ENTITY_ID=16, NOME=17, MESI_START=18, TOTALE_ANNO=30
 *
 * CHIAMATA DA: forzaAggregazioneCompleta()
 * CHIAMA:      getMainSpreadsheet(), getSheetSafely(), sheet.getDataRange(),
 *              sheet.getRange(), _primaRigaVuotaColonna()
 *
 * @param {number} anno - Anno target per il riepilogo.
 * @returns {void}
 */
function _aggiornaRiepilogoAnnuale(anno) {
  const ss = getMainSpreadsheet();
  const sheetAmm = getSheetSafely(ss, SHEET_STATS.SHEET_NAME);
  if (!sheetAmm) {
    Logger.warn('[Statistiche] Foglio Amministrazione non trovato per riepilogo annuale');
    return;
  }

  const dati = sheetAmm.getDataRange().getValues();
  const C = SHEET_STATS.CANTIERI;
  const D = SHEET_STATS.DIPENDENTI;
  const R = SHEET_STATS.RIEPILOGO;

  // Aggrega dati dalla Tabella A (cantieri) per anno
  const cantiereMesi = {}; // { cantiereId: { nome, mesi:[12] } }
  for (let i = 1; i < dati.length; i++) {
    const riga = dati[i];
    if (riga[C.ANNO] == anno && riga[C.CANTIERE_ID]) {
      const id = String(riga[C.CANTIERE_ID]).trim();
      const meseIdx = parseInt(riga[C.MESE]) - 1; // 0-based
      if (meseIdx < 0 || meseIdx > 11) continue;
      if (!cantiereMesi[id]) {
        cantiereMesi[id] = { nome: String(riga[C.NOME_CANTIERE] || id), mesi: new Array(12).fill(0) };
      }
      cantiereMesi[id].mesi[meseIdx] += parseFloat(riga[C.ORE_TOTALI]) || 0;
    }
  }

  // Aggrega dati dalla Tabella B (dipendenti) per anno
  const dipendenteMesi = {}; // { userId: { nome, mesi:[12] } }
  for (let i = 1; i < dati.length; i++) {
    const riga = dati[i];
    if (riga[D.ANNO] == anno && riga[D.USER_ID]) {
      const id = String(riga[D.USER_ID]).trim();
      const meseIdx = parseInt(riga[D.MESE]) - 1; // 0-based
      if (meseIdx < 0 || meseIdx > 11) continue;
      if (!dipendenteMesi[id]) {
        dipendenteMesi[id] = { nome: String(riga[D.NOME] || id), mesi: new Array(12).fill(0) };
      }
      dipendenteMesi[id].mesi[meseIdx] += parseFloat(riga[D.ORE_TOTALI]) || 0;
    }
  }

  // Cache snapshot Tabella C — aggiornata dopo ogni upsert per evitare getDataRange ripetuti
  let snapshotRiepilogo = sheetAmm.getDataRange().getValues();

  // Funzione interna per upsert di una riga nella Tabella C
  function upsertRiepilogo(tipo, entityId, nome, mesiArr) {
    const totaleAnno = mesiArr.reduce((sum, v) => sum + v, 0);
    const nuovaRiga = [anno, tipo, entityId, nome].concat(mesiArr).concat([totaleAnno]);

    const datiAttuali = snapshotRiepilogo;
    let rigaTrovata = -1;
    for (let i = 1; i < datiAttuali.length; i++) {
      const r = datiAttuali[i];
      if (r[R.ANNO] == anno && String(r[R.TIPO]).trim() === tipo &&
          String(r[R.ENTITY_ID]).trim() === entityId) {
        rigaTrovata = i + 1; // 1-based
        break;
      }
    }

    if (rigaTrovata > 0) {
      sheetAmm.getRange(rigaTrovata, R.START_COL + 1, 1, 17).setValues([nuovaRiga]);
    } else {
      const primaVuota = _primaRigaVuotaColonna(sheetAmm, R.START_COL + 1);
      sheetAmm.getRange(primaVuota, R.START_COL + 1, 1, 17).setValues([nuovaRiga]);
    }
    // Aggiorna snapshot locale per la prossima iterazione
    snapshotRiepilogo = sheetAmm.getDataRange().getValues();
  }

  // Scrivi cantieri nella Tabella C
  Object.keys(cantiereMesi).forEach(id => {
    upsertRiepilogo('cantiere', id, cantiereMesi[id].nome, cantiereMesi[id].mesi);
  });

  // Scrivi dipendenti nella Tabella C
  Object.keys(dipendenteMesi).forEach(id => {
    upsertRiepilogo('dipendente', id, dipendenteMesi[id].nome, dipendenteMesi[id].mesi);
  });

  Logger.info('[Statistiche] Riepilogo annuale ' + anno + ' aggiornato');
}

/**
 * Trova la prima riga vuota di una colonna specifica nel foglio.
 *
 * Scansiona la colonna indicata dalla riga 2 in poi (saltando gli header).
 * Se la colonna è completamente vuota restituisce 2 (prima riga dati).
 *
 * CHIAMATA DA: _upsertStatsCantieri(), _upsertStatsDipendenti(), _aggiornaRiepilogoAnnuale()
 * CHIAMA:      sheet.getLastRow(), sheet.getRange()
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet       - Foglio target.
 * @param {number}                             col1based   - Indice colonna 1-based.
 * @returns {number} Numero riga (1-based) della prima cella vuota dalla riga 2.
 */
function _primaRigaVuotaColonna(sheet, col1based) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;

  const valori = sheet.getRange(2, col1based, lastRow - 1, 1).getValues();
  for (let i = 0; i < valori.length; i++) {
    if (!valori[i][0] && valori[i][0] !== 0) return i + 2; // +2 perché partiamo da riga 2
  }
  return lastRow + 1; // tutte le righe sono piene: aggiungi in fondo
}

// ─────────────────────────────────────────────────────────────────────────────
// API PUBBLICHE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce i dati statistici aggregati per un anno, riservata agli admin.
 *
 * Legge il foglio "Amministrazione" e struttura i dati delle tre tabelle in
 * tre array separati (cantieri, dipendenti, riepilogo), filtrati per anno.
 *
 * FLUSSO INTERNO:
 *   1. Valida sessionToken
 *   2. Verifica ruolo admin: estrae userId dal token, cerca il ruolo nel foglio Utenti
 *   3. Legge tutti i dati del foglio Amministrazione
 *   4. Filtra e struttura i dati per anno → oggetti cantieri, dipendenti, riepilogo
 *   5. Restituisce { success, anno, data: { cantieri, dipendenti, riepilogo } }
 *
 * CHIAMATA DA: ApiRouter.gs → doGet()/doPost() (action='getStatistiche')
 * CHIAMA:      validateSessionToken(), getMainSpreadsheet(), getSheetSafely(),
 *              buildColumnMap(), SHEET_STATS, ADMIN_VALIDATION
 *
 * @param {string} sessionToken - Token di sessione (deve appartenere a un admin).
 * @param {number|string} anno  - Anno richiesto (default: anno corrente).
 * @returns {{
 *   success: boolean,
 *   anno?: number,
 *   data?: {
 *     cantieri: Array<{anno,mese,cantiereId,nome,oreTotali,aggiornato}>,
 *     dipendenti: Array<{anno,mese,userId,nome,oreTotali,aggiornato}>,
 *     riepilogo: Array<{anno,tipo,entityId,nome,mesi:number[],totaleAnno}>
 *   },
 *   message?: string
 * }} Risposta strutturata con i dati statistici.
 *
 * @example
 * getStatisticheAdmin('admin_1740000000_xyz', 2026);
 * // → { success: true, anno: 2026, data: { cantieri: [...], dipendenti: [...], riepilogo: [...] } }
 */
function getStatisticheAdmin(sessionToken, anno) {
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }

    // Verifica ruolo admin: stesso pattern usato in AdminAPI.gs
    const requestingUserId = sessionToken.split('_')[0];
    const ss = getMainSpreadsheet();
    const sheetUtenti = getSheetSafely(ss, SHEET_NAMES.UTENTI);
    if (sheetUtenti) {
      const utentiData = sheetUtenti.getDataRange().getValues();
      const headers = utentiData[0];
      const colMap = buildColumnMap(headers);
      const colId = colMap['Username'] !== undefined ? colMap['Username'] : COLUMNS.USER_ID;
      const colRuolo = colMap['Ruolo'] !== undefined ? colMap['Ruolo'] : COLUMNS.RUOLO;

      let isAdmin = false;
      for (let i = 1; i < utentiData.length; i++) {
        if (String(utentiData[i][colId]).trim() === requestingUserId) {
          const ruolo = String(utentiData[i][colRuolo] || '').trim();
          isAdmin = ADMIN_VALIDATION.isAdminRole(ruolo);
          break;
        }
      }
      if (!isAdmin) {
        return { success: false, message: 'Accesso negato: ruolo admin richiesto' };
      }
    }

    const annoTarget = parseInt(anno) || new Date().getFullYear();
    const sheet = getSheetSafely(ss, SHEET_STATS.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Foglio Amministrazione non trovato' };

    const dati = sheet.getDataRange().getValues();

    // Filtra e struttura i dati per anno
    const cantieriResult = [], dipendentiResult = [], riepilogoResult = [];
    const C = SHEET_STATS.CANTIERI;
    const D = SHEET_STATS.DIPENDENTI;
    const R = SHEET_STATS.RIEPILOGO;

    for (let i = 1; i < dati.length; i++) {
      const riga = dati[i];

      // Tabella A — Cantieri (col A-F, indici 0-5)
      if (riga[C.ANNO] == annoTarget && riga[C.CANTIERE_ID]) {
        cantieriResult.push({
          anno: riga[C.ANNO],
          mese: riga[C.MESE],
          cantiereId: riga[C.CANTIERE_ID],
          nome: riga[C.NOME_CANTIERE],
          oreTotali: riga[C.ORE_TOTALI],
          aggiornato: riga[C.DATA_AGG]
        });
      }

      // Tabella B — Dipendenti (col H-M, indici 7-12)
      if (riga[D.ANNO] == annoTarget && riga[D.USER_ID]) {
        dipendentiResult.push({
          anno: riga[D.ANNO],
          mese: riga[D.MESE],
          userId: riga[D.USER_ID],
          nome: riga[D.NOME],
          oreTotali: riga[D.ORE_TOTALI],
          aggiornato: riga[D.DATA_AGG]
        });
      }

      // Tabella C — Riepilogo (col O-AE, indici 14-30)
      if (riga[R.ANNO] == annoTarget && riga[R.ENTITY_ID]) {
        const mesi = [];
        for (let m = 0; m < 12; m++) mesi.push(riga[R.MESI_START + m] || 0);
        riepilogoResult.push({
          anno: riga[R.ANNO],
          tipo: riga[R.TIPO],
          entityId: riga[R.ENTITY_ID],
          nome: riga[R.NOME],
          mesi: mesi,
          totaleAnno: riga[R.TOTALE_ANNO]
        });
      }
    }

    return {
      success: true,
      anno: annoTarget,
      data: {
        cantieri: cantieriResult,
        dipendenti: dipendentiResult,
        riepilogo: riepilogoResult
      }
    };

  } catch (error) {
    Logger.error('[Statistiche] Errore getStatisticheAdmin: ' + error.toString());
    return handleError('getStatisticheAdmin', error);
  }
}

/**
 * Wrapper API per forzare la riaggregazione completa dell'anno corrente.
 *
 * Verifica che il chiamante sia autenticato (non richiede ruolo admin per
 * semplicità, la verifica admin è delegata al livello di routing se necessario),
 * poi esegue forzaAggregazioneCompleta(). Restituisce sempre un oggetto
 * { success, message } compatibile con il formato atteso dal frontend.
 *
 * CHIAMATA DA: ApiRouter.gs → doGet()/doPost() (action='forzaAggregazione')
 * CHIAMA:      validateSessionToken(), forzaAggregazioneCompleta()
 *
 * @param {string} sessionToken - Token di sessione.
 * @returns {{ success: boolean, message: string }} Esito operazione.
 *
 * @example
 * forzaAggregazioneAPI('admin_1740000000_xyz');
 * // → { success: true, message: 'Aggregazione completata' }
 */
function forzaAggregazioneAPI(sessionToken) {
  try {
    if (!validateSessionToken(sessionToken)) {
      return { success: false, message: 'Sessione non valida' };
    }
    forzaAggregazioneCompleta();
    return { success: true, message: 'Aggregazione completata' };
  } catch (error) {
    Logger.error('[Statistiche] Errore forzaAggregazioneAPI: ' + error.toString());
    return handleError('forzaAggregazioneAPI', error);
  }
}
