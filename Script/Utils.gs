// ===== REPORT_COMMERCIALISTA.GS - GENERAZIONE REPORT - VERSIONE CORRETTA =====

/**
 * Genera report mensile con dialog di selezione
 */
function executeGenerateMonthlyReport() {
  showMonthlyReportDialog();
}

/**
 * Genera report annuale
 */
function executeGenerateYearlyReport() {
  const year = showInputDialog(
    'Report Annuale',
    'Inserisci anno per il report:',
    CONFIG.DATES.CURRENT_YEAR.toString()
  );
  
  if (!year) return;
  
  const yearValidation = validateYear(year);
  if (!yearValidation.valid) {
    showErrorMessage(yearValidation.error);
    return;
  }
  
  try {
    const result = generateAnnualReport(yearValidation.value);
    if (result.success) {
      showSuccessMessage(`Report annuale generato!\n\nFile salvato: ${result.fileName}\nCartella: ${CONFIG.FOLDERS.REPORTS}`);
    } else {
      showErrorMessage(`Errore generazione report: ${result.error}`);
    }
  } catch (error) {
    showErrorMessage('Errore generazione report annuale', error);
  }
}

/**
 * Test report su singolo dipendente
 */
function executeTestSingleReport() {
  try {
    const employees = getActiveEmployeeNames();
    if (employees.length === 0) {
      showErrorMessage(ERROR_MESSAGES.NO_EMPLOYEES);
      return;
    }
    
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const firstEmployee = employees[0];
    
    const result = generateMonthlyReportComplete(month, year, firstEmployee);
    
    if (result.success) {
      const message = `Test completato!\n\n` +
        `Dipendente: ${firstEmployee}\n` +
        `Periodo: ${getMonthName(month)} ${year}\n` +
        `Ore trovate: ${result.totalHours}\n` +
        `File salvato su Drive`;
      showSuccessMessage(message);
    } else {
      showErrorMessage(`Test fallito: ${result.message}`);
    }
    
  } catch (error) {
    showErrorMessage('Errore test report', error);
  }
}

/**
 * Mostra dialog per generazione report mensile
 */
function showMonthlyReportDialog() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
      <h3 style="color: #2c3e50; margin-bottom: 20px;">Genera Report Mensile Commercialista</h3>
      
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 14px;">
        <strong>Informazioni:</strong><br>
        Il report sarà salvato nella cartella "${CONFIG.FOLDERS.REPORTS}" su Google Drive.<br>
        Saranno creati file Excel formattati per il commercialista.
      </div>
      
      <div style="margin: 20px 0;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Dipendente:</label>
        <select id="employee" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="__ALL__">Tutti i dipendenti</option>
        </select>
      </div>
      
      <div style="margin: 20px 0;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Mese:</label>
        <select id="month" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="1" ${currentMonth === 1 ? 'selected' : ''}>Gennaio</option>
          <option value="2" ${currentMonth === 2 ? 'selected' : ''}>Febbraio</option>
          <option value="3" ${currentMonth === 3 ? 'selected' : ''}>Marzo</option>
          <option value="4" ${currentMonth === 4 ? 'selected' : ''}>Aprile</option>
          <option value="5" ${currentMonth === 5 ? 'selected' : ''}>Maggio</option>
          <option value="6" ${currentMonth === 6 ? 'selected' : ''}>Giugno</option>
          <option value="7" ${currentMonth === 7 ? 'selected' : ''}>Luglio</option>
          <option value="8" ${currentMonth === 8 ? 'selected' : ''}>Agosto</option>
          <option value="9" ${currentMonth === 9 ? 'selected' : ''}>Settembre</option>
          <option value="10" ${currentMonth === 10 ? 'selected' : ''}>Ottobre</option>
          <option value="11" ${currentMonth === 11 ? 'selected' : ''}>Novembre</option>
          <option value="12" ${currentMonth === 12 ? 'selected' : ''}>Dicembre</option>
        </select>
      </div>
      
      <div style="margin: 20px 0;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">Anno:</label>
        <input type="number" id="year" value="${currentYear}" 
               min="${CONFIG.VALIDATION.MIN_YEAR}" max="${CONFIG.VALIDATION.MAX_YEAR}"
               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
        <button onclick="generateReport()" 
                style="background: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 16px;">
          Genera Report
        </button>
        <button onclick="google.script.host.close()" 
                style="margin-left: 15px; background: #6c757d; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
          Annulla
        </button>
      </div>
      
      <div id="status" style="margin-top: 20px; padding: 10px; text-align: center; font-weight: bold; border-radius: 5px;"></div>
      <div id="result" style="margin-top: 15px; padding: 15px; border-radius: 5px; display: none;"></div>
    </div>
    
    <script>
      // Carica lista dipendenti all'avvio
      window.onload = function() {
        google.script.run
          .withSuccessHandler(function(employees) {
            const select = document.getElementById('employee');
            employees.forEach(function(name) {
              const option = document.createElement('option');
              option.value = name;
              option.textContent = name;
              select.appendChild(option);
            });
          })
          .withFailureHandler(function(error) {
            document.getElementById('status').innerHTML = 'Errore caricamento dipendenti';
            document.getElementById('status').style.backgroundColor = '#f8d7da';
            document.getElementById('status').style.color = '#721c24';
          })
          .getActiveEmployeeNames();
      };
      
      function generateReport() {
        const month = parseInt(document.getElementById('month').value);
        const year = parseInt(document.getElementById('year').value);
        const employee = document.getElementById('employee').value;
        
        // Validazione
        if (isNaN(month) || month < 1 || month > 12) {
          alert('Seleziona un mese valido');
          return;
        }
        
        if (isNaN(year) || year < 2020 || year > 2030) {
          alert('Inserisci un anno valido (2020-2030)');
          return;
        }
        
        // UI Loading
        const statusDiv = document.getElementById('status');
        const resultDiv = document.getElementById('result');
        
        statusDiv.innerHTML = 'Generazione in corso... Attendere...';
        statusDiv.style.backgroundColor = '#cce7ff';
        statusDiv.style.color = '#004085';
        resultDiv.style.display = 'none';
        
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Generando...';
        btn.style.backgroundColor = '#6c757d';
        
        // Chiamata backend
        google.script.run
          .withSuccessHandler(function(response) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.backgroundColor = '#28a745';
            
            if (response.success) {
              statusDiv.innerHTML = 'Report generato con successo!';
              statusDiv.style.backgroundColor = '#d4edda';
              statusDiv.style.color = '#155724';
              
              resultDiv.style.display = 'block';
              resultDiv.style.backgroundColor = '#d4edda';
              resultDiv.style.color = '#155724';
              resultDiv.style.border = '1px solid #c3e6cb';
              
              let html = '<strong>Risultati:</strong><br>';
              html += 'Ore totali: ' + response.totalHours + '<br>';
              html += 'Dipendenti: ' + response.employeesCount + '<br>';
              html += 'Periodo: ' + response.monthName + ' ' + response.year + '<br>';
              
              if (response.employees && response.employees.length > 0) {
                html += '<br><strong>Dettagli dipendenti:</strong><br>';
                response.employees.forEach(function(emp) {
                  html += '• ' + emp.name + ': ' + emp.totalHours + ' ore<br>';
                });
              }
              
              html += '<br>File salvati in cartella "' + response.folderName + '"';
              resultDiv.innerHTML = html;
              
            } else {
              statusDiv.innerHTML = (response.message || 'Errore sconosciuto');
              statusDiv.style.backgroundColor = '#f8d7da';
              statusDiv.style.color = '#721c24';
              
              resultDiv.style.display = 'block';
              resultDiv.style.backgroundColor = '#f8d7da';
              resultDiv.style.color = '#721c24';
              resultDiv.style.border = '1px solid #f5c6cb';
              resultDiv.innerHTML = '<strong>Dettagli errore:</strong><br>' + (response.message || 'Errore sconosciuto');
            }
          })
          .withFailureHandler(function(error) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.style.backgroundColor = '#28a745';
            
            statusDiv.innerHTML = 'Errore di connessione: ' + error.message;
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
            
            resultDiv.style.display = 'block';
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.color = '#721c24';
            resultDiv.style.border = '1px solid #f5c6cb';
            resultDiv.innerHTML = '<strong>Errore tecnico:</strong><br>' + error.message;
          })
          .generateMonthlyReportComplete(month, year, employee);
      }
    </script>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(550)
    .setHeight(650);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Genera Report Mensile');
}

/**
 * Genera report mensile completo
 */
function generateMonthlyReportComplete(month, year, selectedEmployee = '__ALL__') {
  try {
    debugLog('Inizio generazione report mensile', { month, year, employee: selectedEmployee });
    
    const monthValidation = validateMonth(month);
    const yearValidation = validateYear(year);
    
    if (!monthValidation.valid) throw new Error(monthValidation.error);
    if (!yearValidation.valid) throw new Error(yearValidation.error);
    
    const reportFolder = createOrFindReportFolder(year);
    const monthName = getMonthName(month);
    
    const allEmployees = getActiveEmployeeNames();
    if (allEmployees.length === 0) throw new Error(ERROR_MESSAGES.NO_EMPLOYEES);
    
    const employeesToProcess = selectedEmployee === '__ALL__' ? allEmployees : [selectedEmployee];
    
    const employeeResults = [];
    let totalHours = 0;
    
    employeesToProcess.forEach(employeeName => {
      const employeeData = extractEmployeeMonthData(employeeName, month, year);
      
      if (employeeData.rows.length > 0) {
        const reportFile = createEmployeeMonthlyReport(employeeData, monthName, year, reportFolder);
        
        employeeResults.push({
          name: employeeName,
          totalHours: employeeData.totalHours,
          daysWorked: employeeData.rows.length,
          fileUrl: reportFile.getUrl(),
          constructionSites: employeeData.constructionSitesSummary
        });
        
        totalHours += employeeData.totalHours;
      }
    });
    
    if (selectedEmployee === '__ALL__' && employeeResults.length > 1) {
      createSummaryReport(employeeResults, reportFolder, monthName, year);
    }
    
    debugLog('Report mensile completato', { 
      employeesProcessed: employeeResults.length, 
      totalHours 
    });
    
    return {
      success: true,
      totalHours: totalHours,
      employeesCount: employeeResults.length,
      monthName: monthName,
      year: year,
      folderName: CONFIG.FOLDERS.REPORTS,
      employees: employeeResults
    };
    
  } catch (error) {
    console.error('Errore generazione report mensile:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Estrae dati mensili di un dipendente
 */
function extractEmployeeMonthData(employeeName, month, year) {
  try {
    const spreadsheet = getMainSpreadsheet();
    const employeeSheet = getSheetSafe(spreadsheet, employeeName);
    
    const dataRange = getDataRange(employeeSheet);
    if (!dataRange) {
      return { 
        employeeName, 
        rows: [], 
        totalHours: 0, 
        constructionSitesSummary: {} 
      };
    }
    
    const allData = dataRange.getValues();
    const filteredRows = [];
    const constructionSites = {};
    let totalHours = 0;
    
    allData.forEach(row => {
      const dateValue = row[CONFIG.DATA_STRUCTURE.COLUMNS.DATA];
      const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
      
      if (dateMatches(dateValue, month, year) && hours > 0) {
        const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID] || 'N/A';
        const siteName = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_NOME] || 'Sconosciuto';
        const notes = row[CONFIG.DATA_STRUCTURE.COLUMNS.NOTE] || '';
        
        filteredRows.push({
          date: dateValue instanceof Date ? dateValue : parseItalianDate(dateValue),
          dateFormatted: dateValue instanceof Date ? formatDateItalian(dateValue) : dateValue,
          siteId: siteId,
          siteName: siteName,
          hours: hours,
          notes: notes
        });
        
        if (!constructionSites[siteId]) {
          constructionSites[siteId] = {
            name: siteName,
            totalHours: 0,
            daysCount: 0
          };
        }
        
        constructionSites[siteId].totalHours += hours;
        constructionSites[siteId].daysCount++;
        totalHours += hours;
      }
    });
    
    filteredRows.sort((a, b) => a.date - b.date);
    
    return {
      employeeName,
      rows: filteredRows,
      totalHours: Math.round(totalHours * 100) / 100,
      constructionSitesSummary: constructionSites
    };
    
  } catch (error) {
    console.error(`Errore estrazione dati ${employeeName}:`, error);
    return { employeeName, rows: [], totalHours: 0, constructionSitesSummary: {} };
  }
}

/**
 * Crea report mensile per singolo dipendente
 */
function createEmployeeMonthlyReport(employeeData, monthName, year, targetFolder) {
  const fileName = `Report_${formatFileName(employeeData.employeeName)}_${monthName}_${year}`;
  const spreadsheet = SpreadsheetApp.create(fileName);
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName(`${employeeData.employeeName}_${monthName}`);
  
  let row = 1;
  
  // Header aziendale
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1).setValue(`REPORT ORE LAVORATE - ${CONFIG.COMPANY.NAME}`);
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  row++;
  
  sheet.getRange(row, 1, 1, 6).merge();
  sheet.getRange(row, 1).setValue(`${CONFIG.COMPANY.ADDRESS} - P.IVA: ${CONFIG.COMPANY.VAT}`);
  sheet.getRange(row, 1).setHorizontalAlignment('center').setFontSize(10);
  row += 2;
  
  // Informazioni report
  sheet.getRange(row, 1).setValue('DIPENDENTE:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(employeeData.employeeName);
  row++;
  
  sheet.getRange(row, 1).setValue('PERIODO:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(`${monthName} ${year}`);
  row++;
  
  sheet.getRange(row, 1).setValue('ORE TOTALI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(employeeData.totalHours).setNumberFormat('#,##0.0');
  row++;
  
  sheet.getRange(row, 1).setValue('GIORNI LAVORATI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(employeeData.rows.length);
  row++;
  
  const avgHours = employeeData.rows.length > 0 ? employeeData.totalHours / employeeData.rows.length : 0;
  sheet.getRange(row, 1).setValue('MEDIA ORE/GIORNO:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(avgHours).setNumberFormat('#,##0.0');
  row += 2;
  
  // Riepilogo cantieri
  if (Object.keys(employeeData.constructionSitesSummary).length > 0) {
    sheet.getRange(row, 1).setValue('RIEPILOGO CANTIERI').setFontWeight('bold').setFontSize(12);
    row++;
    
    const siteHeaders = ['ID Cantiere', 'Nome Cantiere', 'Ore Totali', 'Giorni', 'Media Ore/Giorno'];
    for (let i = 0; i < siteHeaders.length; i++) {
      sheet.getRange(row, i + 1).setValue(siteHeaders[i]).setFontWeight('bold');
    }
    sheet.getRange(row, 1, 1, siteHeaders.length).setBackground('#e6f3ff');
    row++;
    
    Object.keys(employeeData.constructionSitesSummary).forEach(siteId => {
      const site = employeeData.constructionSitesSummary[siteId];
      const avgSiteHours = site.daysCount > 0 ? site.totalHours / site.daysCount : 0;
      
      sheet.getRange(row, 1).setValue(siteId);
      sheet.getRange(row, 2).setValue(site.name);
      sheet.getRange(row, 3).setValue(site.totalHours).setNumberFormat('#,##0.0');
      sheet.getRange(row, 4).setValue(site.daysCount);
      sheet.getRange(row, 5).setValue(avgSiteHours).setNumberFormat('#,##0.0');
      row++;
    });
    
    row += 2;
  }
  
  // Dettaglio giornaliero
  sheet.getRange(row, 1).setValue('DETTAGLIO GIORNALIERO').setFontWeight('bold').setFontSize(12);
  row++;
  
  const detailHeaders = ['Data', 'ID Cantiere', 'Nome Cantiere', 'Ore', 'Note'];
  for (let i = 0; i < detailHeaders.length; i++) {
    sheet.getRange(row, i + 1).setValue(detailHeaders[i]).setFontWeight('bold');
  }
  sheet.getRange(row, 1, 1, detailHeaders.length).setBackground('#fff2cc');
  row++;
  
  employeeData.rows.forEach(dayData => {
    sheet.getRange(row, 1).setValue(dayData.dateFormatted);
    sheet.getRange(row, 2).setValue(dayData.siteId);
    sheet.getRange(row, 3).setValue(dayData.siteName);
    sheet.getRange(row, 4).setValue(dayData.hours).setNumberFormat('#,##0.0');
    sheet.getRange(row, 5).setValue(dayData.notes);
    row++;
  });
  
  // Formattazione finale
  sheet.autoResizeColumns(1, 6);
  
  // Bordi tabelle
  if (Object.keys(employeeData.constructionSitesSummary).length > 0) {
    const siteSummaryStartRow = 9;
    const siteSummaryRows = Object.keys(employeeData.constructionSitesSummary).length + 1;
    sheet.getRange(siteSummaryStartRow, 1, siteSummaryRows, 5).setBorder(true, true, true, true, true, true);
  }
  
  if (employeeData.rows.length > 0) {
    const detailStartRow = row - employeeData.rows.length - 1;
    sheet.getRange(detailStartRow, 1, employeeData.rows.length + 1, 5).setBorder(true, true, true, true, true, true);
  }
  
  // Sposta file in cartella corretta
  const file = DriveApp.getFileById(spreadsheet.getId());
  moveFileToFolder(file, targetFolder);
  
  debugLog(`Report creato per ${employeeData.employeeName}`, { 
    fileName: fileName,
    totalHours: employeeData.totalHours 
  });
  
  return file;
}

/**
 * Crea report riepilogativo generale
 */
function createSummaryReport(employeeResults, targetFolder, monthName, year) {
  const fileName = `RIEPILOGO_GENERALE_${monthName}_${year}`;
  const spreadsheet = SpreadsheetApp.create(fileName);
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName(`Riepilogo_${monthName}_${year}`);
  
  let row = 1;
  
  // Header
  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1).setValue(`RIEPILOGO GENERALE - ${monthName} ${year}`);
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  row += 2;
  
  // Totali generali
  const totalHours = employeeResults.reduce((sum, emp) => sum + emp.totalHours, 0);
  const totalDays = employeeResults.reduce((sum, emp) => sum + emp.daysWorked, 0);
  
  sheet.getRange(row, 1).setValue('ORE TOTALI MENSILI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(totalHours).setNumberFormat('#,##0.0');
  row++;
  
  sheet.getRange(row, 1).setValue('DIPENDENTI ATTIVI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(employeeResults.length);
  row++;
  
  sheet.getRange(row, 1).setValue('GIORNI TOTALI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(totalDays);
  row++;
  
  const avgHoursPerEmployee = employeeResults.length > 0 ? totalHours / employeeResults.length : 0;
  sheet.getRange(row, 1).setValue('MEDIA ORE/DIPENDENTE:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(avgHoursPerEmployee).setNumberFormat('#,##0.0');
  row += 2;
  
  // Tabella dipendenti
  const headers = ['Dipendente', 'Ore Totali', 'Giorni Lavorati', 'Media Ore/Giorno', 'Cantieri'];
  for (let i = 0; i < headers.length; i++) {
    sheet.getRange(row, i + 1).setValue(headers[i]).setFontWeight('bold');
  }
  sheet.getRange(row, 1, 1, headers.length).setBackground('#d4edda');
  row++;
  
  employeeResults.forEach(employee => {
    const avgDaily = employee.daysWorked > 0 ? employee.totalHours / employee.daysWorked : 0;
    const sitesCount = Object.keys(employee.constructionSites || {}).length;
    
    sheet.getRange(row, 1).setValue(employee.name);
    sheet.getRange(row, 2).setValue(employee.totalHours).setNumberFormat('#,##0.0');
    sheet.getRange(row, 3).setValue(employee.daysWorked);
    sheet.getRange(row, 4).setValue(avgDaily).setNumberFormat('#,##0.0');
    sheet.getRange(row, 5).setValue(sitesCount);
    row++;
  });
  
  // Formattazione
  sheet.autoResizeColumns(1, 5);
  const tableRange = sheet.getRange(6, 1, employeeResults.length + 1, 5);
  tableRange.setBorder(true, true, true, true, true, true);
  
  // Sposta in cartella
  const file = DriveApp.getFileById(spreadsheet.getId());
  moveFileToFolder(file, targetFolder);
  
  debugLog('Riepilogo generale creato', { fileName: fileName });
  
  return file;
}

/**
 * Genera report annuale
 */
function generateAnnualReport(year) {
  try {
    debugLog('Inizio generazione report annuale', { year });
    
    const reportFolder = createOrFindReportFolder(year);
    const employees = getActiveEmployeeNames();
    
    if (employees.length === 0) {
      throw new Error(ERROR_MESSAGES.NO_EMPLOYEES);
    }
    
    // Raccolta dati annuali per tutti i dipendenti
    const annualData = employees.map(employeeName => {
      const employeeAnnualData = extractEmployeeYearData(employeeName, year);
      return {
        name: employeeName,
        ...employeeAnnualData
      };
    }).filter(emp => emp.totalHours > 0);
    
    if (annualData.length === 0) {
      throw new Error(`Nessun dato trovato per l'anno ${year}`);
    }
    
    const fileName = `REPORT_ANNUALE_${year}`;
    const reportFile = createAnnualReportFile(annualData, year, reportFolder, fileName);
    
    return {
      success: true,
      fileName: reportFile.getName(),
      totalEmployees: annualData.length,
      totalHours: annualData.reduce((sum, emp) => sum + emp.totalHours, 0)
    };
    
  } catch (error) {
    console.error('Errore report annuale:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Estrae dati annuali di un dipendente
 */
function extractEmployeeYearData(employeeName, year) {
  try {
    const spreadsheet = getMainSpreadsheet();
    const employeeSheet = getSheetSafe(spreadsheet, employeeName);
    
    const dataRange = getDataRange(employeeSheet);
    if (!dataRange) {
      return { totalHours: 0, monthlyData: {}, constructionSites: {} };
    }
    
    const allData = dataRange.getValues();
    const monthlyData = {};
    const constructionSites = {};
    let totalHours = 0;
    
    // Inizializza mesi
    for (let m = 1; m <= 12; m++) {
      monthlyData[m] = { hours: 0, days: 0 };
    }
    
    allData.forEach(row => {
      const dateValue = row[CONFIG.DATA_STRUCTURE.COLUMNS.DATA];
      const yearFromDate = extractYear(dateValue);
      
      if (yearFromDate === year) {
        const hours = parseFloat(row[CONFIG.DATA_STRUCTURE.COLUMNS.ORE]) || 0;
        
        if (hours > 0) {
          let month = null;
          if (dateValue instanceof Date) {
            month = dateValue.getMonth() + 1;
          } else if (typeof dateValue === 'string') {
            const parsed = parseItalianDate(dateValue);
            month = parsed ? parsed.getMonth() + 1 : null;
          }
          
          if (month && month >= 1 && month <= 12) {
            monthlyData[month].hours += hours;
            monthlyData[month].days++;
            
            const siteId = row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_ID] || 'N/A';
            if (!constructionSites[siteId]) {
              constructionSites[siteId] = {
                name: row[CONFIG.DATA_STRUCTURE.COLUMNS.CANTIERE_NOME] || 'Sconosciuto',
                hours: 0
              };
            }
            constructionSites[siteId].hours += hours;
            
            totalHours += hours;
          }
        }
      }
    });
    
    return {
      totalHours: Math.round(totalHours * 100) / 100,
      monthlyData,
      constructionSites
    };
    
  } catch (error) {
    console.error(`Errore estrazione dati annuali ${employeeName}:`, error);
    return { totalHours: 0, monthlyData: {}, constructionSites: {} };
  }
}

/**
 * Crea file report annuale
 */
function createAnnualReportFile(annualData, year, targetFolder, fileName) {
  const spreadsheet = SpreadsheetApp.create(fileName);
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName(`Annuale_${year}`);
  
  let row = 1;
  
  // Header
  sheet.getRange(row, 1, 1, 14).merge();
  sheet.getRange(row, 1).setValue(`REPORT ANNUALE ${year} - ${CONFIG.COMPANY.NAME}`);
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  row += 2;
  
  // Totali generali
  const totalHours = annualData.reduce((sum, emp) => sum + emp.totalHours, 0);
  sheet.getRange(row, 1).setValue('ORE TOTALI ANNO:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(totalHours).setNumberFormat('#,##0.0');
  row++;
  
  sheet.getRange(row, 1).setValue('DIPENDENTI ATTIVI:').setFontWeight('bold');
  sheet.getRange(row, 2).setValue(annualData.length);
  row += 2;
  
  // Tabella mensile per dipendente
  const monthHeaders = ['Dipendente', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic', 'TOTALE'];
  for (let i = 0; i < monthHeaders.length; i++) {
    sheet.getRange(row, i + 1).setValue(monthHeaders[i]).setFontWeight('bold');
  }
  sheet.getRange(row, 1, 1, monthHeaders.length).setBackground('#e3f2fd');
  row++;
  
  annualData.forEach(employee => {
    sheet.getRange(row, 1).setValue(employee.name);
    
    for (let month = 1; month <= 12; month++) {
      const monthHours = employee.monthlyData[month] ? employee.monthlyData[month].hours : 0;
      sheet.getRange(row, month + 1).setValue(monthHours).setNumberFormat('#,##0.0');
    }
    
    sheet.getRange(row, 14).setValue(employee.totalHours).setNumberFormat('#,##0.0').setFontWeight('bold');
    row++;
  });
  
  // Formattazione
  sheet.autoResizeColumns(1, 14);
  const tableRange = sheet.getRange(5, 1, annualData.length + 1, 14);
  tableRange.setBorder(true, true, true, true, true, true);
  
  // Sposta in cartella
  const file = DriveApp.getFileById(spreadsheet.getId());
  moveFileToFolder(file, targetFolder);
  
  return file;
}

/**
 * Crea o trova cartella report per anno
 */
function createOrFindReportFolder(year) {
  const baseFolder = findOrCreateFolder(CONFIG.FOLDERS.REPORTS);
  return findOrCreateFolder(`Report_${year}`, baseFolder);
}

/**
 * Funzione di test per validazione sistema report
 */
function testReportSystem() {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Test 1: Verifica accesso fogli
    const employees = getActiveEmployeeNames();
    if (employees.length === 0) {
      throw new Error('Nessun dipendente trovato per test');
    }
    
    // Test 2: Verifica cartelle
    const reportFolder = createOrFindReportFolder(currentYear);
    
    // Test 3: Test estrazione dati su primo dipendente
    const testEmployee = employees[0];
    const testData = extractEmployeeMonthData(testEmployee, currentMonth, currentYear);
    
    const message = `TEST SISTEMA REPORT COMPLETATO\n\n` +
      `Dipendenti trovati: ${employees.length}\n` +
      `Dipendente test: ${testEmployee}\n` +
      `Ore trovate (mese corrente): ${testData.totalHours}\n` +
      `Giorni lavorati: ${testData.rows.length}\n` +
      `Cantieri coinvolti: ${Object.keys(testData.constructionSitesSummary).length}\n` +
      `Cartella report: ${reportFolder.getName()}\n\n` +
      `STATO: Sistema report funzionante`;
    
    showSuccessMessage(message);
    
    return {
      success: true,
      employeesCount: employees.length,
      testEmployee: testEmployee,
      testHours: testData.totalHours,
      folderCreated: reportFolder.getName()
    };
    
  } catch (error) {
    const errorMessage = `TEST SISTEMA REPORT FALLITO\n\nErrore: ${error.message}`;
    showErrorMessage(errorMessage);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Genera report di test veloce (senza salvare file)
 */
function generateTestReportPreview() {
  try {
    const employees = getActiveEmployeeNames();
    if (employees.length === 0) {
      showErrorMessage('Nessun dipendente trovato');
      return;
    }
    
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const monthName = getMonthName(currentMonth);
    
    let preview = `ANTEPRIMA REPORT ${monthName.toUpperCase()} ${currentYear}\n\n`;
    let totalHoursAll = 0;
    let totalDaysAll = 0;
    
    employees.forEach((employeeName, index) => {
      const employeeData = extractEmployeeMonthData(employeeName, currentMonth, currentYear);
      
      if (employeeData.rows.length > 0) {
        preview += `${index + 1}. ${employeeName}\n`;
        preview += `   Ore totali: ${employeeData.totalHours}\n`;
        preview += `   Giorni lavorati: ${employeeData.rows.length}\n`;
        preview += `   Cantieri: ${Object.keys(employeeData.constructionSitesSummary).length}\n`;
        
        if (Object.keys(employeeData.constructionSitesSummary).length > 0) {
          preview += `   Dettaglio cantieri:\n`;
          Object.keys(employeeData.constructionSitesSummary).forEach(siteId => {
            const site = employeeData.constructionSitesSummary[siteId];
            preview += `     - ${siteId}: ${site.totalHours}h\n`;
          });
        }
        
        preview += '\n';
        totalHoursAll += employeeData.totalHours;
        totalDaysAll += employeeData.rows.length;
      }
    });
    
    preview += `TOTALI GENERALI:\n`;
    preview += `Ore complessive: ${totalHoursAll}\n`;
    preview += `Giorni complessi: ${totalDaysAll}\n`;
    preview += `Media ore/dipendente: ${employees.length > 0 ? (totalHoursAll / employees.length).toFixed(1) : 0}\n\n`;
    
    if (totalHoursAll === 0) {
      preview += `ATTENZIONE: Nessuna ora registrata per il mese corrente.\n`;
      preview += `Questo è normale se è inizio mese o se i dati sono in mesi precedenti.`;
    } else {
      preview += `I dati sono pronti per la generazione dei report.`;
    }
    
    SpreadsheetApp.getUi().alert('Anteprima Report\n\n' + preview);
    
  } catch (error) {
    showErrorMessage('Errore generazione anteprima', error);
  }
}

/**
 * Ottiene statistiche report per anno
 */
function getReportStatistics(year) {
  try {
    const employees = getActiveEmployeeNames();
    const stats = {
      year: year,
      employees: employees.length,
      totalHours: 0,
      monthlyTotals: {},
      employeeStats: []
    };
    
    // Inizializza mesi
    for (let month = 1; month <= 12; month++) {
      stats.monthlyTotals[month] = 0;
    }
    
    employees.forEach(employeeName => {
      const employeeYearData = extractEmployeeYearData(employeeName, year);
      
      if (employeeYearData.totalHours > 0) {
        stats.totalHours += employeeYearData.totalHours;
        
        // Aggrega per mese
        Object.keys(employeeYearData.monthlyData).forEach(month => {
          const monthNum = parseInt(month);
          stats.monthlyTotals[monthNum] += employeeYearData.monthlyData[month].hours;
        });
        
        stats.employeeStats.push({
          name: employeeName,
          totalHours: employeeYearData.totalHours,
          constructionSites: Object.keys(employeeYearData.constructionSites).length
        });
      }
    });
    
    // Ordina dipendenti per ore decrescenti
    stats.employeeStats.sort((a, b) => b.totalHours - a.totalHours);
    
    return stats;
    
  } catch (error) {
    console.error('Errore statistiche report:', error);
    return null;
  }
}

/**
 * Mostra statistiche anno in formato leggibile
 */
function showYearStatistics() {
  const year = showInputDialog(
    'Statistiche Anno',
    'Inserisci anno per le statistiche:',
    CONFIG.DATES.CURRENT_YEAR.toString()
  );
  
  if (!year) return;
  
  const yearValidation = validateYear(year);
  if (!yearValidation.valid) {
    showErrorMessage(yearValidation.error);
    return;
  }
  
  try {
    const stats = getReportStatistics(yearValidation.value);
    
    if (!stats) {
      showErrorMessage('Impossibile calcolare statistiche');
      return;
    }
    
    let message = `STATISTICHE ANNO ${stats.year}\n\n`;
    message += `Dipendenti attivi: ${stats.employees}\n`;
    message += `Ore totali anno: ${formatNumberItalian(stats.totalHours)}\n`;
    message += `Media ore/dipendente: ${stats.employees > 0 ? formatNumberItalian(stats.totalHours / stats.employees) : '0'}\n\n`;
    
    message += `TOTALI MENSILI:\n`;
    for (let month = 1; month <= 12; month++) {
      const monthName = getMonthName(month).substring(0, 3);
      const monthHours = stats.monthlyTotals[month];
      message += `${monthName}: ${formatNumberItalian(monthHours)}h  `;
      if (month % 4 === 0) message += '\n';
    }
    message += '\n\n';
    
    if (stats.employeeStats.length > 0) {
      message += `TOP DIPENDENTI (ore):\n`;
      stats.employeeStats.slice(0, 5).forEach((emp, index) => {
        message += `${index + 1}. ${emp.name}: ${formatNumberItalian(emp.totalHours)}h\n`;
      });
    }
    
    showSuccessMessage(message);
    
  } catch (error) {
    showErrorMessage('Errore calcolo statistiche', error);
  }
}

/**
 * Funzione di manutenzione: pulisce report vecchi
 */
function cleanupOldReports() {
  try {
    const currentYear = CONFIG.DATES.CURRENT_YEAR;
    const yearsToKeep = 3; // Mantieni ultimi 3 anni
    const cutoffYear = currentYear - yearsToKeep;
    
    const baseFolder = findOrCreateFolder(CONFIG.FOLDERS.REPORTS);
    const foldersToCheck = [];
    const folderIterator = baseFolder.getFolders();
    
    while (folderIterator.hasNext()) {
      const folder = folderIterator.next();
      const folderName = folder.getName();
      
      // Cerca cartelle con pattern "Report_YYYY"
      const yearMatch = folderName.match(/Report_(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year < cutoffYear) {
          foldersToCheck.push({
            folder: folder,
            year: year,
            name: folderName
          });
        }
      }
    }
    
    if (foldersToCheck.length === 0) {
      showSuccessMessage(`Nessun report vecchio da pulire.\nSolo report degli ultimi ${yearsToKeep} anni vengono mantenuti.`);
      return;
    }
    
    const folderList = foldersToCheck.map(f => `- ${f.name} (${f.year})`).join('\n');
    const confirmMessage = `Trovate ${foldersToCheck.length} cartelle report da anni precedenti al ${cutoffYear}:\n\n${folderList}\n\nVuoi spostarle nel cestino?`;
    
    if (showConfirmDialog('Pulizia Report Vecchi', confirmMessage)) {
      let cleaned = 0;
      
      foldersToCheck.forEach(folderInfo => {
        try {
          folderInfo.folder.setTrashed(true);
          cleaned++;
        } catch (error) {
          console.error(`Errore eliminazione ${folderInfo.name}:`, error);
        }
      });
      
      showSuccessMessage(`Pulizia completata!\n\nCartelle spostate nel cestino: ${cleaned}/${foldersToCheck.length}`);
    }
    
  } catch (error) {
    showErrorMessage('Errore pulizia report', error);
  }
}
