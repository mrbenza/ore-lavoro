// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM_DIAGNOSTIC.GS — DIAGNOSTICA SISTEMA
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK VELOCE — usato da onOpen() per menu dinamico
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health check veloce per il menu dinamico (< 2 secondi).
 * Controlla: database, moduli critici, fogli obbligatori, accesso Drive.
 *
 * @returns {{ needsAttention: boolean, status: string, issues: Array,
 *             lastCheck: string, criticalErrors: number, warnings: number }}
 */
function checkSystemHealth() {
  const healthCheck = {
    needsAttention: false,
    status: 'healthy', // healthy | warning | critical
    issues: [],
    lastCheck: new Date().toLocaleString('it-IT'),
    criticalErrors: 0,
    warnings: 0
  };

  try {
    // 1. CONNESSIONE DATABASE
    try {
      const name = SpreadsheetApp.getActiveSpreadsheet().getName();
      if (name.toLowerCase().includes('untitled') || name.toLowerCase().includes('senza titolo')) {
        healthCheck.issues.push({
          type: 'warning', module: 'Database',
          message: 'Spreadsheet senza nome configurato', severity: 'medium'
        });
        healthCheck.warnings++;
      }
    } catch (e) {
      healthCheck.issues.push({
        type: 'error', module: 'Database',
        message: 'Impossibile accedere al database principale',
        severity: 'critical', details: e.message
      });
      healthCheck.criticalErrors++;
    }

    // 2. MODULI SCRIPT CRITICI
    const criticalFunctions = [
      'getMainSpreadsheet', 'getActiveEmployeeNames',
      'getUsersList', 'generatePasswordHash'
    ];
    const missing = criticalFunctions.filter(fn => {
      try { return typeof eval(fn) !== 'function'; } catch (_) { return true; }
    });
    if (missing.length > 0) {
      healthCheck.issues.push({
        type: 'error', module: 'Moduli Script',
        message: 'Funzioni critiche mancanti: ' + missing.join(', '),
        severity: 'critical',
        solution: 'Verifica che tutti i file .gs siano presenti e salvati'
      });
      healthCheck.criticalErrors++;
    }

    // 3. FOGLI CRITICI
    try {
      const ss = getMainSpreadsheet();
      const names = ss.getSheets().map(s => s.getName());

      const missingSheets = ['Utenti'].filter(n => !names.includes(n));
      if (missingSheets.length > 0) {
        healthCheck.issues.push({
          type: 'error', module: 'Fogli Sistema',
          message: 'Fogli critici mancanti: ' + missingSheets.join(', '),
          severity: 'critical',
          solution: 'Crea i fogli mancanti con le intestazioni corrette'
        });
        healthCheck.criticalErrors++;
      }

      const employees = ss.getSheets().filter(s => !isSystemSheet(s.getName()));
      if (employees.length === 0) {
        healthCheck.issues.push({
          type: 'warning', module: 'Dipendenti',
          message: 'Nessun foglio dipendente trovato', severity: 'medium',
          solution: 'Aggiungi almeno un foglio dipendente per testare il sistema'
        });
        healthCheck.warnings++;
      }
    } catch (e) {
      healthCheck.issues.push({
        type: 'error', module: 'Fogli Sistema',
        message: 'Errore lettura struttura fogli',
        severity: 'critical', details: e.message
      });
      healthCheck.criticalErrors++;
    }

    // 4. ACCESSO DRIVE
    try {
      DriveApp.getRootFolder().getName();
    } catch (e) {
      healthCheck.issues.push({
        type: 'error', module: 'Google Drive',
        message: 'Impossibile accedere a Google Drive',
        severity: 'critical', details: 'Verifica permessi script',
        solution: 'Autorizza nuovamente lo script ad accedere a Drive'
      });
      healthCheck.criticalErrors++;
    }

    // 5. STATO FINALE
    if (healthCheck.criticalErrors > 0) {
      healthCheck.status = 'critical';
      healthCheck.needsAttention = true;
    } else if (healthCheck.warnings > 0) {
      healthCheck.status = 'warning';
      healthCheck.needsAttention = true;
    }

    console.log('Health check:', healthCheck.status,
      '— errori:', healthCheck.criticalErrors, '— avvisi:', healthCheck.warnings);
    return healthCheck;

  } catch (e) {
    console.error('Errore critico nel health check:', e);
    return {
      needsAttention: true, status: 'critical',
      issues: [{ type: 'error', module: 'Sistema',
                 message: 'Errore grave nel sistema di diagnostica',
                 severity: 'critical', details: e.message }],
      lastCheck: new Date().toLocaleString('it-IT'),
      criticalErrors: 1, warnings: 0
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICA COMPLETA — voce di menu "Diagnostica sistema"
// ─────────────────────────────────────────────────────────────────────────────

/** Esegue la diagnostica completa e mostra il risultato in una dialog. */
function runSystemDiagnostics() {
  try {
    showDiagnosticsDialogSimple(performSystemDiagnostics());
  } catch (e) {
    console.error('Errore diagnostica completa:', e);
    SpreadsheetApp.getUi().alert(
      'Errore Diagnostica',
      'Impossibile eseguire diagnostica completa:\n\n' + e.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Diagnostica completa del sistema — raccoglie metriche su database, utenti,
 * permessi, cartelle Drive, funzioni critiche e configurazione.
 *
 * @returns {{ timestamp: string, healthScore: number, spreadsheet: Object,
 *             sheets: Object, users: Object, folders: Object,
 *             configuration: Object, permissions: Object,
 *             functions: Object, errors: string[] }}
 */
function performSystemDiagnostics() {
  const results = {
    timestamp: new Date().toLocaleString('it-IT'),
    healthScore: 0,
    spreadsheet: { status: 'unknown', details: '' },
    sheets: { count: 0, employees: 0, system: 0 },
    users: { total: 0, active: 0, withPassword: 0 },
    folders: { archive: false, reports: false },
    configuration: { valid: false, issues: [] },
    permissions: { drive: false, properties: false, sheets: false },
    functions: { critical: 0, working: 0, broken: 0, tests: [] },
    errors: []
  };

  let totalChecks = 0;
  let passedChecks = 0;

  try {
    // 1. DATABASE PRINCIPALE
    totalChecks++;
    try {
      const ss = getMainSpreadsheet();
      results.spreadsheet.status = 'ok';
      results.spreadsheet.details = ss.getName();
      passedChecks++;

      const sheets = ss.getSheets();
      results.sheets.count = sheets.length;
      sheets.forEach(s => {
        if (isSystemSheet(s.getName())) results.sheets.system++;
        else results.sheets.employees++;
      });
    } catch (e) {
      results.spreadsheet.status = 'error';
      results.spreadsheet.details = e.message;
      results.errors.push('Errore connessione database: ' + e.message);
    }

    // 2. GESTIONE UTENTI
    totalChecks++;
    try {
      const users = getUsersList();
      results.users.total = users.length;
      results.users.active = users.filter(u => u.attivo === 'Si').length;
      results.users.withPassword = users.filter(u => u.hasPassword).length;
      passedChecks++;
    } catch (e) {
      results.errors.push('Impossibile leggere foglio Utenti: ' + e.message);
    }

    // 3. PERMESSI
    totalChecks += 3;
    try {
      DriveApp.getRootFolder().getName();
      results.permissions.drive = true;
      passedChecks++;
    } catch (e) { results.errors.push('Errore accesso Drive: ' + e.message); }

    try {
      PropertiesService.getScriptProperties().getProperty('test') || '';
      results.permissions.properties = true;
      passedChecks++;
    } catch (e) { results.errors.push('Errore accesso Properties: ' + e.message); }

    try {
      SpreadsheetApp.getActiveSpreadsheet().getName();
      results.permissions.sheets = true;
      passedChecks++;
    } catch (e) { results.errors.push('Errore accesso Sheets: ' + e.message); }

    // 4. CARTELLE DRIVE
    totalChecks += 2;
    try {
      results.folders.archive = DriveApp.getFoldersByName(CONFIG.FOLDERS.ARCHIVE).hasNext();
      if (results.folders.archive) passedChecks++;

      results.folders.reports = DriveApp.getFoldersByName(CONFIG.FOLDERS.REPORTS).hasNext();
      if (results.folders.reports) passedChecks++;
    } catch (e) { results.errors.push('Errore controllo cartelle: ' + e.message); }

    // 5. FUNZIONI CRITICHE
    const criticalFunctions = [
      'getMainSpreadsheet', 'getActiveEmployeeNames',
      'getUsersList', 'generatePasswordHash', 'formatDateItalian'
    ];
    results.functions.critical = criticalFunctions.length;
    totalChecks += criticalFunctions.length;

    criticalFunctions.forEach(fn => {
      try {
        if (typeof eval(fn) === 'function') {
          results.functions.working++;
          results.functions.tests.push({ name: fn, status: 'ok' });
          passedChecks++;
        } else {
          results.functions.broken++;
          results.functions.tests.push({ name: fn, status: 'error', error: 'Funzione non trovata' });
        }
      } catch (e) {
        results.functions.broken++;
        results.functions.tests.push({ name: fn, status: 'error', error: e.message });
      }
    });

    // 6. CONFIGURAZIONE
    totalChecks++;
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID && CONFIG.FOLDERS) {
        results.configuration.valid = true;
        passedChecks++;
      } else {
        results.configuration.issues.push('Oggetto CONFIG mancante o incompleto');
      }
    } catch (e) {
      results.configuration.issues.push('Errore lettura configurazione: ' + e.message);
    }

    // 7. HEALTH SCORE
    results.healthScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    console.log('Diagnostica completa — score:', results.healthScore,
      '— checks:', passedChecks + '/' + totalChecks,
      '— errori:', results.errors.length);

  } catch (e) {
    console.error('Errore nella diagnostica completa:', e);
    results.errors.push('Errore grave nel sistema di diagnostica: ' + e.message);
    results.healthScore = 0;
  }

  return results;
}

/**
 * Mostra il risultato della diagnostica completa in una dialog alert.
 *
 * @param {Object} diagnostics - Oggetto restituito da performSystemDiagnostics().
 */
function showDiagnosticsDialogSimple(diagnostics) {
  const healthIcon   = diagnostics.healthScore >= 80 ? '✅' : diagnostics.healthScore >= 50 ? '⚠️' : '🚨';
  const healthStatus = diagnostics.healthScore >= 80 ? 'ECCELLENTE' : diagnostics.healthScore >= 50 ? 'ATTENZIONE' : 'CRITICO';

  let msg = 'DIAGNOSTICA SISTEMA COMPLETATA\n\n';
  msg += healthIcon + ' Health Score: ' + diagnostics.healthScore + '/100 - ' + healthStatus + '\n';
  msg += 'Timestamp: ' + diagnostics.timestamp + '\n\n';

  msg += 'RIEPILOGO GENERALE:\n';
  msg += 'Database: ' + (diagnostics.spreadsheet.status === 'ok' ? '✅' : '❌') + ' ' + diagnostics.spreadsheet.status + '\n';
  msg += 'Fogli totali: ' + diagnostics.sheets.count + '\n';
  msg += 'Dipendenti: ' + diagnostics.sheets.employees + '\n';
  msg += 'Utenti sistema: ' + diagnostics.users.total + '\n';
  msg += 'Funzioni critiche: ' + diagnostics.functions.working + '/' + diagnostics.functions.critical + '\n';
  msg += 'Errori rilevati: ' + diagnostics.errors.length + '\n\n';

  msg += 'DETTAGLI CONTROLLI:\n';
  msg += 'Permessi Drive: '       + (diagnostics.permissions.drive      ? '✅' : '❌') + '\n';
  msg += 'Permessi Properties: '  + (diagnostics.permissions.properties ? '✅' : '❌') + '\n';
  msg += 'Cartella archivi: '     + (diagnostics.folders.archive        ? '✅' : '❌') + '\n';
  msg += 'Cartella report: '      + (diagnostics.folders.reports        ? '✅' : '❌') + '\n';
  msg += 'Configurazione: '       + (diagnostics.configuration.valid    ? '✅' : '❌') + '\n\n';

  if (diagnostics.errors.length > 0) {
    msg += 'ERRORI RILEVATI:\n';
    diagnostics.errors.slice(0, 5).forEach((err, i) => { msg += (i + 1) + '. ' + err + '\n'; });
    if (diagnostics.errors.length > 5) msg += '... e altri ' + (diagnostics.errors.length - 5) + ' errori\n';
    msg += '\n';
  }

  msg += 'RACCOMANDAZIONI:\n';
  if (diagnostics.healthScore >= 90) {
    msg += '• Sistema in perfetta salute — continua l\'uso normale\n';
    msg += '• Esegui diagnostica mensile per monitoraggio preventivo\n';
  } else if (diagnostics.healthScore >= 75) {
    msg += '• Sistema generalmente stabile con piccoli problemi risolvibili\n';
    msg += '• Risolvi gli errori minori elencati sopra quando possibile\n';
  } else if (diagnostics.healthScore >= 50) {
    msg += '• Risolvi IMMEDIATAMENTE gli errori critici evidenziati\n';
    msg += '• Evita operazioni massive fino alla risoluzione dei problemi\n';
  } else {
    msg += '• STOP — Non usare il sistema fino alla risoluzione completa\n';
    msg += '• Risolvi TUTTI gli errori prima di procedere con qualsiasi operazione\n';
  }

  const title = healthIcon + ' Diagnostica Sistema — Health Score: ' + diagnostics.healthScore + '/100';
  SpreadsheetApp.getUi().alert(title, msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
