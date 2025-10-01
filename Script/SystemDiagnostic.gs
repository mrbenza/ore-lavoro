// ===== SYSTEM_DIAGNOSTICS.GS - DIAGNOSTICA SISTEMA - VERSIONE SINTASSI CORRETTA =====

/**
 * Check veloce dello stato sistema per menu dinamico
 * Esegue solo controlli essenziali (< 2 secondi)
 */
function checkSystemHealth() {
  const healthCheck = {
    needsAttention: false,
    status: 'healthy', // healthy|warning|critical
    issues: [],
    lastCheck: new Date().toLocaleString('it-IT'),
    criticalErrors: 0,
    warnings: 0
  };

  try {
    // 1. TEST CONNESSIONE DATABASE
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const spreadsheetName = spreadsheet.getName();
      
      // Verifica che non sia un foglio vuoto/demo
      if (spreadsheetName.toLowerCase().includes('untitled') || 
          spreadsheetName.toLowerCase().includes('senza titolo')) {
        healthCheck.issues.push({
          type: 'warning',
          module: 'Database',
          message: 'Spreadsheet senza nome configurato',
          severity: 'medium'
        });
        healthCheck.warnings++;
      }
      
    } catch (error) {
      healthCheck.issues.push({
        type: 'error',
        module: 'Database',
        message: 'Impossibile accedere al database principale',
        severity: 'critical',
        details: error.message
      });
      healthCheck.criticalErrors++;
    }

    // 2. TEST CONFIGURAZIONE PROPERTIES
    try {
      const storedSheetId = PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID');
      const activeSheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
      
      if (!storedSheetId || storedSheetId === '' || storedSheetId === 'null') {
        healthCheck.issues.push({
          type: 'error',
          module: 'Configurazione',
          message: 'Sistema non inizializzato - ID spreadsheet mancante',
          severity: 'critical',
          solution: 'Esegui "Inizializza sistema" dal menu'
        });
        healthCheck.criticalErrors++;
      } else if (storedSheetId !== activeSheetId) {
        healthCheck.issues.push({
          type: 'warning',
          module: 'Configurazione',
          message: 'Conflitto configurazione - Sistema configurato per altro spreadsheet',
          severity: 'high',
          solution: 'Ri-configura sistema per questo spreadsheet'
        });
        healthCheck.warnings++;
      }
      
    } catch (error) {
      healthCheck.issues.push({
        type: 'error',
        module: 'Configurazione',
        message: 'Errore lettura configurazione sistema',
        severity: 'critical',
        details: error.message
      });
      healthCheck.criticalErrors++;
    }

    // 3. TEST MODULI SCRIPT CRITICI
    const criticalFunctions = [
      'getMainSpreadsheet',
      'getActiveEmployeeNames', 
      'getUsersList',
      'generatePasswordHash'
    ];
    
    let missingFunctions = [];
    criticalFunctions.forEach(funcName => {
      try {
        if (typeof eval(funcName) !== 'function') {
          missingFunctions.push(funcName);
        }
      } catch (error) {
        missingFunctions.push(funcName);
      }
    });
    
    if (missingFunctions.length > 0) {
      healthCheck.issues.push({
        type: 'error',
        module: 'Moduli Script',
        message: 'Funzioni critiche mancanti: ' + missingFunctions.join(', '),
        severity: 'critical',
        solution: 'Verifica che tutti i file .gs siano presenti e salvati'
      });
      healthCheck.criticalErrors++;
    }

    // 4. TEST FOGLI CRITICI
    try {
      const spreadsheet = getMainSpreadsheet();
      const sheets = spreadsheet.getSheets();
      const sheetNames = sheets.map(sheet => sheet.getName());
      
      // Verifica fogli di sistema essenziali
      const criticalSheets = ['Utenti'];
      const missingCriticalSheets = criticalSheets.filter(name => !sheetNames.includes(name));
      
      if (missingCriticalSheets.length > 0) {
        healthCheck.issues.push({
          type: 'error',
          module: 'Fogli Sistema',
          message: 'Fogli critici mancanti: ' + missingCriticalSheets.join(', '),
          severity: 'critical',
          solution: 'Crea i fogli mancanti con le intestazioni corrette'
        });
        healthCheck.criticalErrors++;
      }
      
      // Verifica fogli dipendenti (warning se mancanti)
      const employeeSheets = sheets.filter(sheet => !isSystemSheet(sheet.getName()));
      if (employeeSheets.length === 0) {
        healthCheck.issues.push({
          type: 'warning',
          module: 'Dipendenti',
          message: 'Nessun foglio dipendente trovato',
          severity: 'medium',
          solution: 'Aggiungi almeno un foglio dipendente per testare il sistema'
        });
        healthCheck.warnings++;
      }
      
    } catch (error) {
      healthCheck.issues.push({
        type: 'error',
        module: 'Fogli Sistema',
        message: 'Errore lettura struttura fogli',
        severity: 'critical',
        details: error.message
      });
      healthCheck.criticalErrors++;
    }

    // 5. TEST ACCESSO DRIVE (controllo base)
    try {
      // Test semplice: prova ad accedere a Drive
      DriveApp.getRootFolder().getName();
    } catch (error) {
      healthCheck.issues.push({
        type: 'error',
        module: 'Google Drive',
        message: 'Impossibile accedere a Google Drive',
        severity: 'critical',
        details: 'Verifica permessi script',
        solution: 'Autorizza nuovamente lo script ad accedere a Drive'
      });
      healthCheck.criticalErrors++;
    }

    // 6. DETERMINA STATO FINALE
    if (healthCheck.criticalErrors > 0) {
      healthCheck.status = 'critical';
      healthCheck.needsAttention = true;
    } else if (healthCheck.warnings > 0) {
      healthCheck.status = 'warning';
      healthCheck.needsAttention = true;
    } else {
      healthCheck.status = 'healthy';
      healthCheck.needsAttention = false;
    }

    // Log per debug
    console.log('System Health Check completato:', {
      status: healthCheck.status,
      issues: healthCheck.issues.length,
      errors: healthCheck.criticalErrors,
      warnings: healthCheck.warnings
    });

    return healthCheck;

  } catch (error) {
    // Fallback in caso di errore nel check stesso
    console.error('Errore critico nel system health check:', error);
    
    return {
      needsAttention: true,
      status: 'critical',
      issues: [{
        type: 'error',
        module: 'Sistema',
        message: 'Errore grave nel sistema di diagnostica',
        severity: 'critical',
        details: error.message
      }],
      lastCheck: new Date().toLocaleString('it-IT'),
      criticalErrors: 1,
      warnings: 0
    };
  }
}

/**
 * Mostra dialog con warning e problemi rilevati (versione semplificata)
 */
function showSystemWarnings() {
  try {
    const healthCheck = checkSystemHealth();
    showHealthStatusDialogSimple(healthCheck);
  } catch (error) {
    console.error('Errore visualizzazione warning:', error);
    SpreadsheetApp.getUi().alert(
      'Errore Sistema',
      'Impossibile visualizzare stato sistema:\n\n' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Dialog semplificato per stato sistema (evita problemi sintassi HTML)
 */
function showHealthStatusDialogSimple(healthCheck) {
  let message = 'STATO SISTEMA\n\n';
  
  // Determina icona e status
  let statusIcon = '';
  let statusText = '';
  
  switch (healthCheck.status) {
    case 'healthy':
      statusIcon = 'âœ…';
      statusText = 'Sistema in Salute - Tutti i controlli superati';
      break;
    case 'warning':
      statusIcon = 'âš ï¸';
      statusText = 'Attenzione Richiesta - ' + healthCheck.warnings + ' problema/i rilevato/i';
      break;
    case 'critical':
      statusIcon = 'ðŸš¨';
      statusText = 'Errori Critici - ' + healthCheck.criticalErrors + ' errore/i critico/i';
      break;
  }
  
  message += statusIcon + ' ' + statusText + '\n';
  message += 'Ultimo controllo: ' + healthCheck.lastCheck + '\n\n';
  
  // Aggiungi dettagli problemi se presenti
  if (healthCheck.issues.length > 0) {
    message += 'PROBLEMI RILEVATI:\n\n';
    
    healthCheck.issues.forEach((issue, index) => {
      const problemIcon = issue.type === 'error' ? 'âŒ' : 'âš ï¸';
      message += (index + 1) + '. ' + problemIcon + ' ' + issue.module.toUpperCase() + '\n';
      message += '   ' + issue.message + '\n';
      
      if (issue.details) {
        message += '   Dettagli: ' + issue.details + '\n';
      }
      
      if (issue.solution) {
        message += '   Soluzione: ' + issue.solution + '\n';
      }
      
      message += '\n';
    });
  }
  
  // Aggiungi raccomandazioni
  if (healthCheck.status === 'critical') {
    message += 'AZIONE IMMEDIATA RICHIESTA:\n';
    message += 'Il sistema presenta errori critici che potrebbero impedire il corretto funzionamento.\n';
    message += 'Risolvere tutti i problemi evidenziati prima di procedere.\n\n';
  } else if (healthCheck.status === 'warning') {
    message += 'ATTENZIONE:\n';
    message += 'Il sistema Ã¨ funzionante ma presenta alcuni problemi minori.\n';
    message += 'La risoluzione di questi avvisi migliorerÃ  l\'affidabilitÃ  del sistema.\n\n';
  }
  
  message += 'Riepilogo: ' + healthCheck.criticalErrors + ' errori critici, ' + healthCheck.warnings + ' avvisi';
  
  const title = statusIcon + ' Stato Sistema - ' + statusText.split(' - ')[0];
  
  SpreadsheetApp.getUi().alert(title, message);
}

/**
 * Esegue diagnostica completa del sistema
 */
function runSystemDiagnostics() {
  try {
    const diagnostics = performSystemDiagnostics();
    showDiagnosticsDialogSimple(diagnostics);
  } catch (error) {
    console.error('Errore diagnostica completa:', error);
    SpreadsheetApp.getUi().alert(
      'Errore Diagnostica',
      'Impossibile eseguire diagnostica completa:\n\n' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Diagnostica completa del sistema (versione ottimizzata)
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
    // 1. TEST DATABASE PRINCIPALE
    totalChecks++;
    try {
      const spreadsheet = getMainSpreadsheet();
      results.spreadsheet.status = 'ok';
      results.spreadsheet.details = spreadsheet.getName();
      passedChecks++;
      
      const sheets = spreadsheet.getSheets();
      results.sheets.count = sheets.length;
      
      sheets.forEach(sheet => {
        const name = sheet.getName();
        if (isSystemSheet(name)) {
          results.sheets.system++;
        } else {
          results.sheets.employees++;
        }
      });
      
    } catch (error) {
      results.spreadsheet.status = 'error';
      results.spreadsheet.details = error.message;
      results.errors.push('Errore connessione database: ' + error.message);
    }

    // 2. TEST GESTIONE UTENTI
    totalChecks++;
    try {
      const users = getUsersList();
      results.users.total = users.length;
      results.users.active = users.filter(u => u.attivo === 'Si').length;
      results.users.withPassword = users.filter(u => u.hasPassword).length;
      passedChecks++;
    } catch (error) {
      results.errors.push('Impossibile leggere foglio Utenti: ' + error.message);
    }

    // 3. TEST PERMESSI
    totalChecks += 3;
    
    // Drive
    try {
      DriveApp.getRootFolder().getName();
      results.permissions.drive = true;
      passedChecks++;
    } catch (error) {
      results.errors.push('Errore accesso Drive: ' + error.message);
    }
    
    // Properties
    try {
      PropertiesService.getScriptProperties().getProperty('test') || '';
      results.permissions.properties = true;
      passedChecks++;
    } catch (error) {
      results.errors.push('Errore accesso Properties: ' + error.message);
    }
    
    // Sheets
    try {
      SpreadsheetApp.getActiveSpreadsheet().getName();
      results.permissions.sheets = true;
      passedChecks++;
    } catch (error) {
      results.errors.push('Errore accesso Sheets: ' + error.message);
    }

    // 4. TEST CARTELLE
    totalChecks += 2;
    try {
      results.folders.archive = DriveApp.getFoldersByName(CONFIG.FOLDERS.ARCHIVE).hasNext();
      if (results.folders.archive) passedChecks++;
      
      results.folders.reports = DriveApp.getFoldersByName(CONFIG.FOLDERS.REPORTS).hasNext();
      if (results.folders.reports) passedChecks++;
    } catch (error) {
      results.errors.push('Errore controllo cartelle: ' + error.message);
    }

    // 5. TEST FUNZIONI CRITICHE
    const criticalFunctions = [
      'getMainSpreadsheet',
      'getActiveEmployeeNames',
      'getUsersList',
      'generatePasswordHash',
      'formatDateItalian'
    ];
    
    results.functions.critical = criticalFunctions.length;
    totalChecks += criticalFunctions.length;
    
    criticalFunctions.forEach(funcName => {
      try {
        if (typeof eval(funcName) === 'function') {
          results.functions.working++;
          results.functions.tests.push({ name: funcName, status: 'ok' });
          passedChecks++;
        } else {
          results.functions.broken++;
          results.functions.tests.push({ name: funcName, status: 'error', error: 'Funzione non trovata' });
        }
      } catch (error) {
        results.functions.broken++;
        results.functions.tests.push({ name: funcName, status: 'error', error: error.message });
      }
    });

    // 6. TEST CONFIGURAZIONE
    totalChecks++;
    try {
      // Verifica struttura CONFIG
      if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID && CONFIG.FOLDERS) {
        results.configuration.valid = true;
        passedChecks++;
      } else {
        results.configuration.issues.push('Oggetto CONFIG mancante o incompleto');
      }
    } catch (error) {
      results.configuration.issues.push('Errore lettura configurazione: ' + error.message);
    }

    // 7. CALCOLA HEALTH SCORE
    results.healthScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    console.log('Diagnostica completa:', {
      healthScore: results.healthScore,
      totalChecks: totalChecks,
      passedChecks: passedChecks,
      errors: results.errors.length
    });

  } catch (error) {
    console.error('Errore nella diagnostica completa:', error);
    results.errors.push('Errore grave nel sistema di diagnostica: ' + error.message);
    results.healthScore = 0;
  }

  return results;
}

/**
 * Dialog semplificato per diagnostica completa
 */
function showDiagnosticsDialogSimple(diagnostics) {
  let message = 'DIAGNOSTICA SISTEMA COMPLETATA\n\n';
  
  // Header con health score
  const healthIcon = diagnostics.healthScore >= 80 ? 'âœ…' : 
                    diagnostics.healthScore >= 50 ? 'âš ï¸' : 'ðŸš¨';
  const healthStatus = diagnostics.healthScore >= 80 ? 'ECCELLENTE' : 
                      diagnostics.healthScore >= 50 ? 'ATTENZIONE' : 'CRITICO';
  
  message += healthIcon + ' Health Score: ' + diagnostics.healthScore + '/100 - ' + healthStatus + '\n';
  message += 'Timestamp: ' + diagnostics.timestamp + '\n\n';
  
  // Riepilogo generale
  message += 'RIEPILOGO GENERALE:\n';
  message += 'Database: ' + (diagnostics.spreadsheet.status === 'ok' ? 'âœ…' : 'âŒ') + ' ' + diagnostics.spreadsheet.status + '\n';
  message += 'Fogli totali: ' + diagnostics.sheets.count + '\n';
  message += 'Dipendenti: ' + diagnostics.sheets.employees + '\n';
  message += 'Utenti sistema: ' + diagnostics.users.total + '\n';
  message += 'Funzioni critiche: ' + diagnostics.functions.working + '/' + diagnostics.functions.critical + '\n';
  message += 'Errori rilevati: ' + diagnostics.errors.length + '\n\n';
  
  // Dettagli controlli
  message += 'DETTAGLI CONTROLLI:\n';
  message += 'Permessi Drive: ' + (diagnostics.permissions.drive ? 'âœ…' : 'âŒ') + '\n';
  message += 'Permessi Properties: ' + (diagnostics.permissions.properties ? 'âœ…' : 'âŒ') + '\n';
  message += 'Cartella archivi: ' + (diagnostics.folders.archive ? 'âœ…' : 'âŒ') + '\n';
  message += 'Cartella report: ' + (diagnostics.folders.reports ? 'âœ…' : 'âŒ') + '\n';
  message += 'Configurazione: ' + (diagnostics.configuration.valid ? 'âœ…' : 'âŒ') + '\n\n';
  
  // Errori se presenti
  if (diagnostics.errors.length > 0) {
    message += 'ERRORI RILEVATI:\n';
    diagnostics.errors.slice(0, 5).forEach((error, index) => {
      message += (index + 1) + '. ' + error + '\n';
    });
    
    if (diagnostics.errors.length > 5) {
      message += '... e altri ' + (diagnostics.errors.length - 5) + ' errori\n';
    }
    message += '\n';
  }
  
  // Raccomandazioni
  message += 'RACCOMANDAZIONI:\n';
  if (diagnostics.healthScore >= 90) {
    message += 'â€¢ Sistema in perfetta salute - continua l\'uso normale\n';
    message += 'â€¢ Esegui diagnostica mensile per monitoraggio preventivo\n';
  } else if (diagnostics.healthScore >= 75) {
    message += 'â€¢ Sistema generalmente stabile con piccoli problemi risolvibili\n';
    message += 'â€¢ Risolvi gli errori minori elencati sopra quando possibile\n';
  } else if (diagnostics.healthScore >= 50) {
    message += 'â€¢ Risolvi IMMEDIATAMENTE gli errori critici evidenziati\n';
    message += 'â€¢ Evita operazioni massive fino alla risoluzione dei problemi\n';
  } else {
    message += 'â€¢ STOP - Non usare il sistema fino alla risoluzione completa\n';
    message += 'â€¢ Risolvi TUTTI gli errori prima di procedere con qualsiasi operazione\n';
  }
  
  const title = healthIcon + ' Diagnostica Sistema - Health Score: ' + diagnostics.healthScore + '/100';
  
  SpreadsheetApp.getUi().alert(title, message);
}

/**
 * Test veloce funzioni base (per debug)
 */
function quickSystemTest() {
  const results = [];
  
  // Test connessione
  try {
    getMainSpreadsheet();
    results.push('âœ… Database: OK');
  } catch (error) {
    results.push('âŒ Database: ' + error.message);
  }
  
  // Test dipendenti
  try {
    const employees = getActiveEmployeeNames();
    results.push('âœ… Dipendenti: ' + employees.length + ' trovati');
  } catch (error) {
    results.push('âŒ Dipendenti: ' + error.message);
  }
  
  // Test utenti
  try {
    const users = getUsersList();
    results.push('âœ… Utenti: ' + users.length + ' nel sistema');
  } catch (error) {
    results.push('âŒ Utenti: ' + error.message);
  }
  
  const message = 'QUICK SYSTEM TEST\n\n' + results.join('\n') + '\n\nTimestamp: ' + new Date().toLocaleString('it-IT');
  SpreadsheetApp.getUi().alert('ðŸ§ª Test Rapido Sistema', message);
}

/**
 * Utility: Verifica se una funzione esiste ed Ã¨ accessibile
 */
function functionExists(functionName) {
  try {
    return typeof eval(functionName) === 'function';
  } catch (error) {
    return false;
  }
}
