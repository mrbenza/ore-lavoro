// ===== CALCOLO CANTIERI - VERSIONE MINIMALISTA =====

/**
 * Ricalcola tutti i totali cantieri - AVVIO IMMEDIATO
 */
function executeRecalculateConstructionSites() {
  // NESSUN DIALOG INIZIALE - Parte subito senza loading!
  
  try {
    // Esegue il ricalcolo direttamente
    const result = performConstructionSitesRecalculation();
    
    if (result.success) {
      showSimpleRecalculationResults(result);
    } else {
      SpreadsheetApp.getUi().alert('❌ Errore\n\nImpossibile completare il ricalcolo. Contatta l\'amministratore.');
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nQualcosa è andato storto. Contatta l\'amministratore.');
  }
}

/**
 * Mostra risultati ricalcolo - versione semplificata con dettagli cantieri
 */
function showSimpleRecalculationResults(result) {
  let message;
  let title;
  
  if (result.corrections.length === 0) {
    // TUTTO OK - Focus positivo
    title = '✅ Ricalcolo Completato';
    message = `🎉 Tutto perfetto!\n\n` +
             `Cantieri controllati: ${result.constructionSitesUpdated}\n` +
             `Dipendenti processati: ${result.employeesProcessed}\n\n` +
             `Tutti i totali erano già corretti.`;
  } else {
    // CORREZIONI EFFETTUATE - Con dettagli cantieri
    title = '🔧 Ricalcolo Completato';
    message = `✅ Operazione completata!\n\n` +
             `🔧 Correzioni effettuate: ${result.corrections.length}\n` +
             `📊 Cantieri controllati: ${result.constructionSitesUpdated}\n` +
             `👥 Dipendenti processati: ${result.employeesProcessed}\n\n` +
             `CANTIERI CORRETTI:\n`;
    
    // Mostra tutti i cantieri corretti (solo nome, senza ID)
    result.corrections.forEach((corr, index) => {
      const sign = corr.difference >= 0 ? '+' : '';
      message += `${index + 1}. ${corr.name}\n`;
      message += `   ${corr.oldTotal}h → ${corr.newTotal}h (${sign}${corr.difference.toFixed(1)}h)\n\n`;
    });
    
    // Limita se sono troppi (max 10)
    if (result.corrections.length > 10) {
      const first10 = result.corrections.slice(0, 10);
      message = `✅ Operazione completata!\n\n` +
               `🔧 Correzioni effettuate: ${result.corrections.length}\n` +
               `📊 Cantieri controllati: ${result.constructionSitesUpdated}\n` +
               `👥 Dipendenti processati: ${result.employeesProcessed}\n\n` +
               `CANTIERI CORRETTI (primi 10):\n`;
      
      first10.forEach((corr, index) => {
        const sign = corr.difference >= 0 ? '+' : '';
        message += `${index + 1}. ${corr.name}\n`;
        message += `   ${corr.oldTotal}h → ${corr.newTotal}h (${sign}${corr.difference.toFixed(1)}h)\n\n`;
      });
      
      message += `... e altri ${result.corrections.length - 10} cantieri corretti`;
    }
  }
  
  SpreadsheetApp.getUi().alert(title + '\n\n' + message);
}

/**
 * Verifica allineamento dati - con emoji e dettagli
 */
function executeVerifyDataAlignment() {
  try {
    // Avvio immediato anche qui
    const verification = performDataAlignmentVerification();
    showDetailedAlignmentResults(verification);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nImpossibile verificare l\'allineamento. Contatta l\'amministratore.');
  }
}

/**
 * Mostra risultati verifica con emoji e focus su stato generale
 */
function showDetailedAlignmentResults(result) {
  if (!result.success) {
    SpreadsheetApp.getUi().alert('❌ Errore\n\nVerifica fallita. Contatta l\'amministratore.');
    return;
  }
  
  const totalProblems = result.inconsistencies.length + result.missingConstructionSites.length + result.orphanedHours.length;
  
  let title, message;
  
  if (totalProblems === 0) {
    // TUTTO PERFETTO - Focus positivo
    title = '🎉 Verifica Completata - Tutto Perfetto!';
    message = `✅ I dati sono perfettamente allineati!\n\n` +
             `📊 Dipendenti analizzati: ${result.employeesAnalyzed}\n` +
             `🏗️ Cantieri nel sistema: ${result.constructionSitesAnalyzed}\n` +
             `💰 Ore totali: ${formatNumberItalian(result.totalHoursEmployee)}\n\n` +
             `🎯 Nessun problema rilevato.`;
  } else {
    // PROBLEMI TROVATI - Ma focus costruttivo
    title = `⚠️ Verifica Completata - ${totalProblems} Problemi`;
    message = `📋 ANALISI COMPLETATA\n\n` +
             `👥 Dipendenti: ${result.employeesAnalyzed}\n` +
             `🏗️ Cantieri: ${result.constructionSitesAnalyzed}\n` +
             `💰 Ore totali: ${formatNumberItalian(result.totalHoursEmployee)}\n\n` +
             `🔍 PROBLEMI RILEVATI:\n`;
    
    if (result.inconsistencies.length > 0) {
      message += `🔧 Totali da correggere: ${result.inconsistencies.length}\n`;
      result.inconsistencies.slice(0, 3).forEach((inc) => {
        message += `  • ${inc.name}: ${inc.declared}h → ${inc.actual}h\n`;
      });
      if (result.inconsistencies.length > 3) {
        message += `  • ... e altri ${result.inconsistencies.length - 3}\n`;
      }
      message += '\n';
    }
    
    if (result.missingConstructionSites.length > 0) {
      message += `❓ Cantieri mancanti: ${result.missingConstructionSites.length}\n`;
      result.missingConstructionSites.slice(0, 2).forEach((site) => {
        // Cerca il nome del cantiere dall'ID se possibile
        const displayName = site.siteName || site.siteId;
        message += `  • ${displayName} (${formatNumberItalian(site.totalHours)}h)\n`;
      });
      message += '\n';
    }
    
    if (result.orphanedHours.length > 0) {
      message += `🚨 Ore su cantieri inesistenti: ${result.orphanedHours.length}\n\n`;
    }
    
    message += `💡 SOLUZIONE:\n`;
    if (result.inconsistencies.length > 0) {
      message += `• Usa "Ricalcola Totali" per correggere\n`;
    }
    if (result.missingConstructionSites.length > 0) {
      message += `• Aggiungi cantieri mancanti\n`;
    }
    if (result.orphanedHours.length > 0) {
      message += `• Correggi riferimenti cantieri inesistenti`;
    }
  }
  
  SpreadsheetApp.getUi().alert(title + '\n\n' + message);
}

/**
 * Istruzioni amministratori - versione semplificata
 */
function displayConstructionSiteInstructions() {
  const instructions = 
    `📖 COME USARE IL SISTEMA CANTIERI\n\n` +
    
    `🔧 PROBLEMA COMUNE:\n` +
    `Quando cambi il cantiere di un dipendente, i totali non si aggiornano automaticamente.\n\n` +
    
    `✅ SOLUZIONE SEMPLICE:\n` +
    `1️⃣ Modifica il cantiere nel foglio dipendente\n` +
    `2️⃣ Vai su "🏗️ Gestione Cantieri"\n` +
    `3️⃣ Clicca "🔄 Ricalcola totali ore cantieri"\n` +
    `4️⃣ Aspetta qualche secondo\n` +
    `5️⃣ Controlla il risultato\n\n` +
    
    `🧪 COME TESTARE:\n` +
    `• Prendi nota del totale di un cantiere\n` +
    `• Cambia un cantiere di un dipendente\n` +
    `• Usa "Ricalcola totali"\n` +
    `• Verifica che i totali siano corretti\n\n` +
    
    `🔍 CONTROLLI PERIODICI:\n` +
    `• Usa "Verifica allineamento" ogni settimana\n` +
    `• Ricalcola dopo modifiche importanti\n` +
    `• Tieni sempre un backup\n\n` +
    
    `⏱️ TEMPI:\n` +
    `• Ricalcolo: 2-10 secondi\n` +
    `• Verifica: 5-15 secondi\n` +
    `• Funziona con qualsiasi numero di dipendenti`;
  
  SpreadsheetApp.getUi().alert('📖 Guida Sistema Cantieri\n\n' + instructions);
}

/**
 * Esegue il ricalcolo completo (funzione tecnica invariata)
 */
function performConstructionSitesRecalculation() {
  const startTime = new Date();
  const result = {
    success: false,
    executionTime: 0,
    employeesProcessed: 0,
    constructionSitesUpdated: 0,
    corrections: [],
    error: null
  };
  
  try {
    debugLog('Inizio ricalcolo totali cantieri');
    
    const spreadsheet = getMainSpreadsheet();
    const constructionSitesSheet = getSheetSafe(spreadsheet, SHEET_NAMES.CANTIERI);
    const employeeNames = getActiveEmployeeNames();
    
    if (employeeNames.length === 0) {
      throw new Error('Nessun dipendente attivo trovato');
    }
    
    const allEmployeeData = loadAllEmployeeData(employeeNames, spreadsheet);
    result.employeesProcessed = Object.keys(allEmployeeData).length;
    
    const constructionSitesData = constructionSitesSheet.getDataRange().getValues();
    
    for (let i = 1; i < constructionSitesData.length; i++) {
      const row = constructionSitesData[i];
      const siteId = row[0];
      const siteName = row[1] || siteId;
      const currentTotal = parseFloat(row[6]) || 0;
      
      if (!siteId) continue;
      
      const newTotal = calculateSiteTotalFromData(siteId, allEmployeeData);
      
      if (Math.abs(currentTotal - newTotal) > 0.01) {
        constructionSitesSheet.getRange(i + 1, 7).setValue(newTotal);
        
        result.corrections.push({
          id: siteId,
          name: siteName,
          oldTotal: currentTotal,
          newTotal: newTotal,
          difference: newTotal - currentTotal
        });
      }
      
      result.constructionSitesUpdated++;
    }
    
    const endTime = new Date();
    result.executionTime = ((endTime - startTime) / 1000).toFixed(1);
    result.success = true;
    
    debugLog('Ricalcolo completato', {
      executionTime: result.executionTime,
      corrections: result.corrections.length,
      employeesProcessed: result.employeesProcessed
    });
    
  } catch (error) {
    console.error('Errore nel ricalcolo cantieri:', error);
    result.error = error.message;
  }
  
  return result;
}

/**
 * Carica tutti i dati dei dipendenti in memoria per ottimizzare le performance
 */
function loadAllEmployeeData(employeeNames, spreadsheet) {
  const allData = {};
  
  employeeNames.forEach(employeeName => {
    try {
      const employeeSheet = spreadsheet.getSheetByName(employeeName);
      if (!employeeSheet) return;
      
      const dataRange = getDataRange(employeeSheet);
      if (!dataRange) return;
      
      allData[employeeName] = dataRange.getValues();
      
    } catch (error) {
      console.warn(`Impossibile caricare dati per ${employeeName}:`, error);
    }
  });
  
  debugLog(`Caricati dati per ${Object.keys(allData).length} dipendenti`);
  return allData;
}

/**
 * Calcola il totale ore per un cantiere dai dati in memoria
 */
function calculateSiteTotalFromData(siteId, allEmployeeData) {
  let totalHours = 0;
  
  Object.keys(allEmployeeData).forEach(employeeName => {
    const employeeData = allEmployeeData[employeeName];
    
    employeeData.forEach(row => {
      const rowSiteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID];
      const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
      
      if (rowSiteId === siteId && hours > 0) {
        totalHours += hours;
      }
    });
  });
  
  return Math.round(totalHours * 10) / 10;
}

/**
 * Esegue verifica completa dell'allineamento dati (funzione tecnica invariata)
 */
function performDataAlignmentVerification() {
  const result = {
    success: false,
    employeesAnalyzed: 0,
    constructionSitesAnalyzed: 0,
    inconsistencies: [],
    orphanedHours: [],
    missingConstructionSites: [],
    totalHoursEmployee: 0,
    totalHoursConstructionSites: 0,
    error: null
  };
  
  try {
    debugLog('Inizio verifica allineamento dati');
    
    const spreadsheet = getMainSpreadsheet();
    const constructionSitesSheet = getSheetSafe(spreadsheet, SHEET_NAMES.CANTIERI);

    const constructionSitesData = constructionSitesSheet.getDataRange().getValues();
    const existingSites = new Map();
    
    for (let i = 1; i < constructionSitesData.length; i++) {
      const siteId = constructionSitesData[i][0];
      const siteName = constructionSitesData[i][1] || siteId;
      const currentTotal = parseFloat(constructionSitesData[i][6]) || 0;
      
      if (siteId) {
        existingSites.set(siteId, {
          name: siteName,
          declaredTotal: currentTotal,
          actualTotal: 0
        });
      }
    }
    
    result.constructionSitesAnalyzed = existingSites.size;
    
    const employeeNames = getActiveEmployeeNames();
    const referencedSites = new Map();
    
    employeeNames.forEach(employeeName => {
      try {
        const employeeSheet = spreadsheet.getSheetByName(employeeName);
        if (!employeeSheet) return;
        
        const dataRange = getDataRange(employeeSheet);
        if (!dataRange) return;
        
        const employeeData = dataRange.getValues();
        let employeeHours = 0;
        
        employeeData.forEach((row, rowIndex) => {
          const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID];
          const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
          
          if (siteId && hours > 0) {
            employeeHours += hours;
            
            if (!referencedSites.has(siteId)) {
              referencedSites.set(siteId, { totalHours: 0, employees: [] });
            }
            
            referencedSites.get(siteId).totalHours += hours;
            if (!referencedSites.get(siteId).employees.includes(employeeName)) {
              referencedSites.get(siteId).employees.push(employeeName);
            }
            
            if (existingSites.has(siteId)) {
              existingSites.get(siteId).actualTotal += hours;
            } else {
              result.orphanedHours.push({
                siteId: siteId,
                employee: employeeName,
                hours: hours,
                rowIndex: rowIndex + CONFIG.DATA_STRUCTURE.HEADER_ROWS + 1
              });
            }
          }
        });
        
        result.totalHoursEmployee += employeeHours;
        result.employeesAnalyzed++;
        
      } catch (error) {
        console.warn(`Errore analisi ${employeeName}:`, error);
      }
    });
    
    existingSites.forEach((siteData, siteId) => {
      const difference = Math.abs(siteData.declaredTotal - siteData.actualTotal);
      
      if (difference > 0.01) {
        result.inconsistencies.push({
          siteId: siteId,
          name: siteData.name,
          declared: siteData.declaredTotal,
          actual: siteData.actualTotal,
          difference: difference
        });
      }
      
      result.totalHoursConstructionSites += siteData.declaredTotal;
    });
    
    referencedSites.forEach((siteData, siteId) => {
      if (!existingSites.has(siteId)) {
        result.missingConstructionSites.push({
          siteId: siteId,
          totalHours: siteData.totalHours,
          employees: siteData.employees
        });
      }
    });
    
    result.success = true;
    debugLog('Verifica allineamento completata', result);
    
  } catch (error) {
    console.error('Errore verifica allineamento:', error);
    result.error = error.message;
  }
  
  return result;
}
