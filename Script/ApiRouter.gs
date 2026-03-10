/**
 * ApiRouter.gs — Entry Point HTTP e Routing delle Richieste
 *
 * Unico punto di ingresso per tutte le chiamate HTTP al backend GAS.
 * Riceve richieste GET e POST dal proxy Vercel (api/proxy.js), determina
 * l'azione richiesta tramite il parametro 'action', e delega l'esecuzione
 * al modulo competente (Authentication, UserAPI, AdminAPI, SheetsDAO).
 *
 * Tutte le risposte sono avvolte in createCORSResponse() per garantire
 * gli header CORS corretti verso il frontend su Vercel.
 *
 * MODULI GESTITI:
 *   - Authentication.gs  → authenticate, validateAdmin
 *   - UserAPI.gs         → saveWorkEntry, getMonthlyWorkData
 *   - AdminAPI.gs        → getCantieriOverview, getDipendentiList,
 *                          getDipendenteTimeline, getOtherUserMonthlyData,
 *                          updateWorkEntry, deleteWorkEntry, invalidateCache
 *   - SheetsDAO.gs       → getCantieri, getUserInfo, getOtherUserInfo,
 *                          getAllCantieriForAdmin
 *
 * USATO DA: api/proxy.js (Vercel) → HTTP GET/POST
 */

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK — verifica disponibilità sistema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restituisce lo stato operativo del sistema (health check).
 *
 * Risponde con metadati versione, build, modalità e ID spreadsheet.
 * Usato dal frontend per verificare che il backend GAS sia raggiungibile
 * prima di procedere con operazioni critiche. Non richiede autenticazione.
 *
 * FLUSSO INTERNO:
 *   1. Legge SYSTEM_INFO e CONFIG (Config.gs)
 *   2. Costruisce l'oggetto risposta con tutti i metadati di sistema
 *   3. Restituisce l'oggetto (wrappato in CORS dal chiamante)
 *
 * CHIAMATA DA: doGet() e doPost() (action='ping')
 * CHIAMA:      (nessuna funzione esterna)
 *
 * @returns {{ success: boolean, message: string, timestamp: string,
 *             version: string, build: string, mode: string,
 *             installType: string, features: string[],
 *             spreadsheetId: string, cors: boolean,
 *             architecture: string }} Stato sistema.
 * @example
 * var stato = handlePing();
 * // { success: true, message: 'Sistema operativo...', version: '2.3', ... }
 */
function handlePing() {
  return {
    success: true,
    message: 'Sistema operativo - Container-bound Modulare',
    timestamp: new Date().toISOString(),
    version: SYSTEM_INFO.version,
    build: SYSTEM_INFO.build,
    mode: SYSTEM_INFO.mode,
    installType: SYSTEM_INFO.installType,
    features: SYSTEM_INFO.features,
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    cors: true,
    architecture: 'MODULAR'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT GET — routing richieste HTTP GET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point HTTP GET — riceve richieste GET e le smista al modulo corretto.
 *
 * Legge il parametro 'action' da e.parameter e invoca la funzione
 * corrispondente. I parametri aggiuntivi (sessionToken, userId, year, mese,
 * ecc.) vengono estratti da e.parameter individualmente. In caso di azione
 * sconosciuta restituisce la lista delle azioni disponibili.
 * In caso di eccezione non gestita chiama handleError() e restituisce
 * una risposta di errore strutturata.
 *
 * FLOW 1 — Login:
 *   doGet (action='authenticate') → authenticateUser(userId, password)
 *   → risposta con sessionToken e dati utente
 *
 * FLOW 2 — Salvataggio ore:
 *   doGet (action='saveWorkEntry') → saveWorkEntry(sessionToken, workData)
 *   → updateCantiereHours() internamente → risposta
 *   // ⚠️ ANOMALIA: saveWorkEntry via GET trasmette workData come query
 *   // string JSON — preferire POST per payload strutturati (sicurezza/lunghezza URL)
 *
 * FLOW 3 — Overview cantieri admin:
 *   doGet (action='getCantieriOverview') → getCantieriAdminOverview(sessionToken, modalita)
 *   // ⚠️ ANOMALIA: la specifica di flusso indicava getCantieriOverview →
 *   // getAllCantieriForAdmin(), ma getCantieriAdminOverview() NON chiama
 *   // getAllCantieriForAdmin(). Quest'ultima è un endpoint separato
 *   // (action='getAllCantieriForAdmin'). I due endpoint servono scopi diversi:
 *   // getCantieriAdminOverview = ore aggregate per cantiere (con cache);
 *   // getAllCantieriForAdmin = lista completa cantieri senza aggregazione.
 *
 * FLOW 4 — Calendario dipendente (admin):
 *   doGet (action='getDipendenteTimeline') → getDipendenteTimelineAdmin(sessionToken, userId, timeframe)
 *   // ⚠️ ANOMALIA: la specifica indicava getUserTimeline() come nome funzione,
 *   // ma la funzione reale si chiama getDipendenteTimelineAdmin() in AdminAPI.gs.
 *   // Non esiste alcuna funzione getUserTimeline() nel codebase.
 *
 * FLUSSO INTERNO:
 *   1. Estrae action da e.parameter (null se assente)
 *   2. Gestisce CORS preflight (action='options')
 *   3. Smista su catena if/else per action
 *   4. Chiama createCORSResponse(result) e ritorna
 *   5. In caso di errore → createCORSResponse(handleError('doGet', error))
 *
 * CHIAMATA DA: GAS HTTP runtime (richiesta GET esterna)
 * CHIAMA:      handlePing(), authenticateUser(), saveWorkEntry(),
 *              getCantieri(), getUserInfo(), getMonthlyWorkData(),
 *              validateAdmin(), getCantieriAdminOverview(),
 *              getDipendentiListAdmin(), getDipendenteTimelineAdmin(),
 *              getOtherUserInfo(), getOtherUserMonthlyData(),
 *              getAllCantieriForAdmin(), updateWorkEntry(),
 *              deleteWorkEntry(), invalidateAdminCache(),
 *              createCORSResponse(), handleError(), Logger.debug
 *
 * @param {GoogleAppsScript.Events.DoGet} e - Evento GAS con e.parameter.
 * @returns {GoogleAppsScript.Content.TextOutput} Risposta JSON con header CORS.
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;
    Logger.debug('Richiesta GET ricevuta:', action);

    if (action === 'options') {
      return createCORSResponse({ success: true, message: 'CORS preflight OK' });
    }

    var result;

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC ENDPOINTS (no autenticazione richiesta)
    // ─────────────────────────────────────────────────────────────────────────

    if (action === 'ping') {
      result = handlePing();
    }
    else if (action === 'authenticate') {
      // → Authentication.gs
      result = authenticateUser(e.parameter.userId, e.parameter.password);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER ENDPOINTS (richiedono sessionToken valido)
    // ─────────────────────────────────────────────────────────────────────────

    else if (action === 'saveWorkEntry') {
      // → UserAPI.gs
      var workData = {};
      try {
        workData = JSON.parse(e.parameter.workData || '{}');
      } catch (_) {
        workData = {};
      }
      result = saveWorkEntry(e.parameter.sessionToken, workData);
    }
    else if (action === 'getCantieri') {
      // → SheetsDAO.gs
      result = getCantieri(e.parameter.sessionToken);
    }
    else if (action === 'getUserInfo') {
      // → SheetsDAO.gs
      result = getUserInfo(e.parameter.sessionToken);
    }
    else if (action === 'getMonthlyWorkData') {
      // → UserAPI.gs
      var year = parseInt(e.parameter.year, 10) || new Date().getFullYear();
      var month = parseInt(e.parameter.month, 10) || new Date().getMonth() + 1;
      result = getMonthlyWorkData(e.parameter.sessionToken, year, month);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN ENDPOINTS (richiedono sessionToken di un utente con ruolo admin)
    // ─────────────────────────────────────────────────────────────────────────

    else if (action === 'validateAdmin') {
      // → Authentication.gs
      result = validateAdmin(e.parameter.sessionToken, e.parameter.userId);
    }
    else if (action === 'getCantieriOverview') {
      // → AdminAPI.gs
      result = getCantieriAdminOverview(e.parameter.sessionToken, e.parameter.modalita);
    }
    else if (action === 'getDipendentiList') {
      // → AdminAPI.gs
      result = getDipendentiListAdmin(e.parameter.sessionToken, e.parameter.includeInactive);
    }
    else if (action === 'getDipendenteTimeline') {
      // → AdminAPI.gs
      result = getDipendenteTimelineAdmin(
        e.parameter.sessionToken,
        e.parameter.userId,
        e.parameter.timeframe
      );
    }
    else if (action === 'getOtherUserInfo') {
      // → SheetsDAO.gs
      result = getOtherUserInfo(e.parameter.sessionToken, e.parameter.targetUserId);
    }
    else if (action === 'getOtherUserMonthlyData') {
      // → AdminAPI.gs
      result = getOtherUserMonthlyData(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.year,
        e.parameter.month
      );
    }
    else if (action === 'getAllCantieriForAdmin') {
      // → SheetsDAO.gs
      result = getAllCantieriForAdmin(e.parameter.sessionToken);
    }
    else if (action === 'updateWorkEntry') {
      // → AdminAPI.gs
      var updateData = {};
      try {
        updateData = JSON.parse(e.parameter.updateData || '{}');
      } catch (_) {}
      result = updateWorkEntry(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.dateStr,
        updateData
      );
    }
    else if (action === 'deleteWorkEntry') {
      // → AdminAPI.gs
      result = deleteWorkEntry(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.dateStr,
        parseInt(e.parameter.entryIndex, 10)
      );
    }
    else if (action === 'invalidateCache') {
      // → AdminAPI.gs
      result = invalidateAdminCache(e.parameter.sessionToken, e.parameter.cacheType);
    }
    else if (action === 'updateCantiereStato') {
      // → AdminAPI.gs
      result = updateCantiereStato(
        e.parameter.sessionToken,
        e.parameter.cantiereId,
        e.parameter.nuovoStato
      );
    }
    else if (action === 'ricalcolaCantieri') {
      // → AdminAPI.gs (wrapper CalcoloCantieri.gs)
      result = ricalcolaCantieriAPI(e.parameter.sessionToken);
    }
    else if (action === 'verificaAllineamento') {
      // → AdminAPI.gs (wrapper CalcoloCantieri.gs)
      result = verificaAllineamentoAPI(e.parameter.sessionToken);
    }
    else if (action === 'cambiaPassword') {
      // → AdminAPI.gs (wrapper GestionePassword.gs)
      result = cambiaPasswordDipendente(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.nuovaPassword
      );
    }
    else if (action === 'cambiaPasswordUtente') {
      // → GestionePassword.gs (self-service, nessun privilegio admin richiesto)
      result = cambiaPasswordUtente(
        e.parameter.sessionToken,
        e.parameter.vecchiaPassword,
        e.parameter.nuovaPassword
      );
    }
    else if (action === 'creaUtente') {
      // → GestioneUtenti.gs
      result = creaUtenteAPI(e.parameter.sessionToken, e.parameter.datiJSON);
    }
    else if (action === 'aggiornaStatoUtente') {
      // → GestioneUtenti.gs
      result = aggiornaStatoUtenteAPI(
        e.parameter.sessionToken,
        e.parameter.targetUserId,
        e.parameter.nuovoStato
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATISTICHE ENDPOINTS (richiedono sessionToken di un utente con ruolo admin)
    // ─────────────────────────────────────────────────────────────────────────

    else if (action === 'getStatistiche') {
      // → Statistiche.gs
      result = getStatisticheAdmin(e.parameter.sessionToken, e.parameter.anno);
    }
    else if (action === 'forzaAggregazione') {
      // → Statistiche.gs
      result = forzaAggregazioneAPI(e.parameter.sessionToken);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AZIONE SCONOSCIUTA
    // ─────────────────────────────────────────────────────────────────────────

    else {
      result = {
        success: false,
        message: 'Azione non riconosciuta: ' + action,
        availableActions: [
          'ping', 'authenticate', 'saveWorkEntry', 'getCantieri',
          'getUserInfo', 'getMonthlyWorkData', 'validateAdmin',
          'getCantieriOverview', 'getDipendentiList', 'getDipendenteTimeline',
          'getOtherUserInfo', 'getOtherUserMonthlyData', 'getAllCantieriForAdmin',
          'updateWorkEntry', 'deleteWorkEntry', 'invalidateCache',
          'updateCantiereStato', 'ricalcolaCantieri', 'verificaAllineamento',
          'cambiaPassword', 'cambiaPasswordUtente', 'creaUtente', 'aggiornaStatoUtente',
          'getStatistiche', 'forzaAggregazione'
        ]
      };
    }

    return createCORSResponse(result);

  } catch (error) {
    return createCORSResponse(handleError('doGet', error));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT POST — routing richieste HTTP POST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point HTTP POST — riceve richieste POST e le smista al modulo corretto.
 *
 * Tenta prima di leggere i parametri dal body POST come application/x-www-form-urlencoded
 * con chiave 'data' contenente un JSON. Se il parsing fallisce, cade back su
 * e.parameter. Supporta le stesse action di doGet con il vantaggio di poter
 * trasmettere payload JSON strutturati nel body (no limitazione URL).
 *
 * FLOW 1 — Login via POST:
 *   doPost (action='authenticate') → authenticateUser(params.userId, params.password)
 *   → risposta con { success, sessionToken, data: { name, role, ... } }
 *
 * FLOW 2 — Salvataggio ore via POST:
 *   doPost (action='saveWorkEntry') → saveWorkEntry(params.sessionToken, params.workData)
 *   → updateCantiereHours() internamente → { success, message }
 *
 * FLOW 3 — Overview cantieri admin via POST:
 *   doPost (action='getCantieriOverview') → getCantieriAdminOverview(sessionToken, modalita)
 *   // ⚠️ ANOMALIA: vedere nota in doGet — getCantieriAdminOverview NON chiama
 *   // getAllCantieriForAdmin(). Sono endpoint indipendenti.
 *
 * FLOW 4 — Calendario dipendente admin via POST:
 *   doPost (action='getDipendenteTimeline') → getDipendenteTimelineAdmin(sessionToken, userId, timeframe)
 *   // ⚠️ ANOMALIA: la funzione si chiama getDipendenteTimelineAdmin(), non getUserTimeline().
 *
 * FLUSSO INTERNO:
 *   1. Legge e.postData.contents, estrae params da URLSearchParams('data')
 *   2. Fallback su e.parameter se parsing fallisce
 *   3. Smista su catena if/else per params.action
 *   4. Chiama createCORSResponse(result) e ritorna
 *   5. In caso di errore → createCORSResponse(handleError('doPost', error))
 *
 * CHIAMATA DA: GAS HTTP runtime (richiesta POST esterna)
 * CHIAMA:      handlePing(), authenticateUser(), saveWorkEntry(),
 *              getCantieri(), getUserInfo(), getMonthlyWorkData(),
 *              validateAdmin(), getCantieriAdminOverview(),
 *              getDipendentiListAdmin(), getDipendenteTimelineAdmin(),
 *              getOtherUserInfo(), getOtherUserMonthlyData(),
 *              getAllCantieriForAdmin(), updateWorkEntry(),
 *              deleteWorkEntry(), invalidateAdminCache(),
 *              createCORSResponse(), handleError(), Logger.debug/warn
 *
 * @param {GoogleAppsScript.Events.DoPost} e - Evento GAS con e.postData e e.parameter.
 * @returns {GoogleAppsScript.Content.TextOutput} Risposta JSON con header CORS.
 */
function doPost(e) {
  try {
    var params = {};

    if (e && e.postData && e.postData.contents) {
      try {
        var postParams = new URLSearchParams(e.postData.contents);
        var dataParam = postParams.get('data');
        if (dataParam) params = JSON.parse(dataParam);
      } catch (parseError) {
        Logger.warn('Errore parsing POST data:', parseError);
        params = e.parameter || {};
      }
    } else {
      params = e && e.parameter ? e.parameter : {};
    }

    Logger.debug('POST richiesta ricevuta:', params.action);

    var result;

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC ENDPOINTS (no autenticazione richiesta)
    // ─────────────────────────────────────────────────────────────────────────

    if (params.action === 'ping') {
      result = handlePing();
    }
    else if (params.action === 'authenticate') {
      // → Authentication.gs
      result = authenticateUser(params.userId, params.password);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER ENDPOINTS (richiedono sessionToken valido)
    // ─────────────────────────────────────────────────────────────────────────

    else if (params.action === 'saveWorkEntry') {
      // → UserAPI.gs
      var workDataPost = params.workData || {};
      result = saveWorkEntry(params.sessionToken, workDataPost);
    }
    else if (params.action === 'getCantieri') {
      // → SheetsDAO.gs
      result = getCantieri(params.sessionToken);
    }
    else if (params.action === 'getUserInfo') {
      // → SheetsDAO.gs
      result = getUserInfo(params.sessionToken);
    }
    else if (params.action === 'getMonthlyWorkData') {
      // → UserAPI.gs
      var yearPost = parseInt(params.year, 10) || new Date().getFullYear();
      var monthPost = parseInt(params.month, 10) || new Date().getMonth() + 1;
      result = getMonthlyWorkData(params.sessionToken, yearPost, monthPost);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN ENDPOINTS (richiedono sessionToken di un utente con ruolo admin)
    // ─────────────────────────────────────────────────────────────────────────

    else if (params.action === 'validateAdmin') {
      // → Authentication.gs
      Logger.debug('doPost validateAdmin chiamato con params:', params);
      result = validateAdmin(params.sessionToken, params.userId);
      Logger.debug('doPost validateAdmin risultato:', result);
    }
    else if (params.action === 'getCantieriOverview') {
      // → AdminAPI.gs
      result = getCantieriAdminOverview(params.sessionToken, params.modalita);
    }
    else if (params.action === 'getDipendentiList') {
      // → AdminAPI.gs
      result = getDipendentiListAdmin(params.sessionToken, params.includeInactive);
    }
    else if (params.action === 'getDipendenteTimeline') {
      // → AdminAPI.gs
      result = getDipendenteTimelineAdmin(
        params.sessionToken,
        params.userId,
        params.timeframe
      );
    }
    else if (params.action === 'getOtherUserInfo') {
      // → SheetsDAO.gs
      result = getOtherUserInfo(params.sessionToken, params.targetUserId);
    }
    else if (params.action === 'getOtherUserMonthlyData') {
      // → AdminAPI.gs
      result = getOtherUserMonthlyData(
        params.sessionToken,
        params.targetUserId,
        params.year,
        params.month
      );
    }
    else if (params.action === 'getAllCantieriForAdmin') {
      // → SheetsDAO.gs
      result = getAllCantieriForAdmin(params.sessionToken);
    }
    else if (params.action === 'updateWorkEntry') {
      // → AdminAPI.gs
      var updateDataPost = {};
      try {
        updateDataPost = JSON.parse(params.updateData || '{}');
      } catch (_) {}
      result = updateWorkEntry(
        params.sessionToken,
        params.targetUserId,
        params.dateStr,
        updateDataPost
      );
    }
    else if (params.action === 'deleteWorkEntry') {
      // → AdminAPI.gs
      result = deleteWorkEntry(
        params.sessionToken,
        params.targetUserId,
        params.dateStr,
        parseInt(params.entryIndex, 10)
      );
    }
    else if (params.action === 'invalidateCache') {
      // → AdminAPI.gs
      result = invalidateAdminCache(params.sessionToken, params.cacheType);
    }
    else if (params.action === 'updateCantiereStato') {
      // → AdminAPI.gs
      result = updateCantiereStato(
        params.sessionToken,
        params.cantiereId,
        params.nuovoStato
      );
    }
    else if (params.action === 'ricalcolaCantieri') {
      // → AdminAPI.gs (wrapper CalcoloCantieri.gs)
      result = ricalcolaCantieriAPI(params.sessionToken);
    }
    else if (params.action === 'verificaAllineamento') {
      // → AdminAPI.gs (wrapper CalcoloCantieri.gs)
      result = verificaAllineamentoAPI(params.sessionToken);
    }
    else if (params.action === 'cambiaPassword') {
      // → AdminAPI.gs (wrapper GestionePassword.gs)
      result = cambiaPasswordDipendente(
        params.sessionToken,
        params.targetUserId,
        params.nuovaPassword
      );
    }
    else if (params.action === 'cambiaPasswordUtente') {
      // → GestionePassword.gs (self-service, nessun privilegio admin richiesto)
      result = cambiaPasswordUtente(
        params.sessionToken,
        params.vecchiaPassword,
        params.nuovaPassword
      );
    }
    else if (params.action === 'creaUtente') {
      // → GestioneUtenti.gs
      result = creaUtenteAPI(params.sessionToken, params.datiJSON);
    }
    else if (params.action === 'aggiornaStatoUtente') {
      // → GestioneUtenti.gs
      result = aggiornaStatoUtenteAPI(
        params.sessionToken,
        params.targetUserId,
        params.nuovoStato
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATISTICHE ENDPOINTS (richiedono sessionToken di un utente con ruolo admin)
    // ─────────────────────────────────────────────────────────────────────────

    else if (params.action === 'getStatistiche') {
      // → Statistiche.gs
      result = getStatisticheAdmin(params.sessionToken, params.anno);
    }
    else if (params.action === 'forzaAggregazione') {
      // → Statistiche.gs
      result = forzaAggregazioneAPI(params.sessionToken);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AZIONE SCONOSCIUTA
    // ─────────────────────────────────────────────────────────────────────────

    else {
      result = {
        success: false,
        message: 'Azione non riconosciuta: ' + params.action,
        availableActions: [
          'ping', 'authenticate', 'saveWorkEntry', 'getCantieri',
          'getUserInfo', 'getMonthlyWorkData', 'validateAdmin',
          'getCantieriOverview', 'getDipendentiList', 'getDipendenteTimeline',
          'getOtherUserInfo', 'getOtherUserMonthlyData', 'getAllCantieriForAdmin',
          'updateWorkEntry', 'deleteWorkEntry', 'invalidateCache',
          'updateCantiereStato', 'ricalcolaCantieri', 'verificaAllineamento',
          'cambiaPassword', 'cambiaPasswordUtente', 'creaUtente', 'aggiornaStatoUtente',
          'getStatistiche', 'forzaAggregazione'
        ]
      };
    }

    return createCORSResponse(result);

  } catch (error) {
    return createCORSResponse(handleError('doPost', error));
  }
}

