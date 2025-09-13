// ===== MAIN.GS - MENU PRINCIPALE CON ISTRUZIONI AGGIORNATE =====

/**
 * Funzione principale chiamata all'apertura del foglio
 * Crea il menu unificato del sistema con istruzioni
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Controlla stato inizializzazione per menu dinamico
    const initStatus = checkSystemInitializationStatus();
    
    const menu = ui.createMenu('🏢 Sistema Gestionale')
      
      // Sottomenu Archivio
      .addSubMenu(ui.createMenu('📁 Archivio')
        .addItem('📅 Archivia anno precedente (tutti)', 'archiveAllPreviousYear')
        .addItem('👤 Archivia singolo dipendente', 'archiveSingleEmployee')
        .addItem('📊 Archivia con selezione anno', 'archiveWithCustomYear')
        .addSeparator()
        .addItem('📋 Stato archivi', 'showArchiveStatus')
        .addSeparator()
        .addItem('📖 Come archiviare', 'showArchiveInstructions'))
      
      // Sottomenu Password
      .addSubMenu(ui.createMenu('🔐 Gestione Password')
        .addItem('👤 Cambia password dipendente', 'changeEmployeePassword')
        .addItem('📋 Lista utenti', 'showUsersList')
        .addSeparator()
        .addItem('🔍 Debug hash password', 'debugPasswordHash')
        .addSeparator()
        .addItem('📖 Come gestire password', 'showPasswordInstructions'))
      
      // Sottomenu Report
      .addSubMenu(ui.createMenu('📊 Report Commercialista')
        .addItem('📅 Genera report mensile', 'generateMonthlyReport')
        .addItem('📋 Report riepilogativo annuale', 'generateYearlyReport')
        .addSeparator()
        .addItem('🧪 Test report (dipendente singolo)', 'testSingleReport')
        .addSeparator()
        .addItem('📖 Come generare report', 'showReportInstructions'))
      
      // Sottomenu Cantieri
      .addSubMenu(ui.createMenu('🗏️ Gestione Cantieri')
        .addItem('🔄 Ricalcola totali ore cantieri', 'recalculateConstructionSites')
        .addItem('🔍 Verifica allineamento dati', 'verifyDataAlignment')
        .addSeparator()
        .addItem('📖 Come gestire cantieri', 'showConstructionSiteInstructions'))
      
      .addSeparator();
    
    // MENU DINAMICO BASATO SULLO STATO DEL SISTEMA
    if (initStatus.systemHealth === 'healthy') {
      // Sistema OK - Nessuna inizializzazione, solo diagnostica e info
      menu.addItem('🔧 Diagnostica sistema', 'runSystemDiagnostics')
          .addItem('ℹ️ Informazioni Sistema', 'showSystemInformation');
      
      console.log('Menu caricato - Sistema operativo (inizializzazione nascosta)');
      
    } else if (initStatus.systemHealth === 'needs_setup') {
      // Primo setup necessario
      menu.addItem('🚀 Inizializza sistema', 'initializeSystemSetup')
          .addItem('🔧 Diagnostica sistema', 'runSystemDiagnostics')
          .addItem('ℹ️ Informazioni Sistema', 'showSystemInformation');
      
      console.log('Menu caricato - Primo setup necessario');
      
    } else if (initStatus.systemHealth === 'conflict') {
      // Conflitto di configurazione
      menu.addItem('⚠️ Riconfigura sistema', 'initializeSystemSetup')
          .addItem('🔧 Diagnostica sistema', 'runSystemDiagnostics')
          .addItem('ℹ️ Informazioni Sistema', 'showSystemInformation');
      
      console.log('Menu caricato - Conflitto rilevato');
      
    } else {
      // Errore - Mostra tutto per debug
      menu.addItem('❌ Inizializza sistema (Errore)', 'initializeSystemSetup')
          .addItem('🔧 Diagnostica sistema', 'runSystemDiagnostics')
          .addItem('ℹ️ Informazioni Sistema', 'showSystemInformation');
      
      console.log('Menu caricato - Errore sistema');
    }
    
    menu.addToUi();
    
    console.log('Menu sistema caricato correttamente con stato:', initStatus.systemHealth);
    
  } catch (error) {
    console.error('Errore creazione menu:', error);
    // Fallback: crea menu semplificato
    ui.createMenu('🏢 Sistema')
      .addItem('⚙️ Inizializza', 'initializeSystemSetup')
      .addItem('🔧 Diagnostica', 'runSystemDiagnostics')
      .addItem('ℹ️ Info', 'showSystemInformation')
      .addToUi();
  }
}

// ===== INFORMAZIONI SISTEMA GENERALE =====

/**
 * Mostra informazioni generali del sistema - DIALOG HTML
 */
function showSystemInformation() {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">ℹ️ Sistema Gestionale</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Ore Lavorate Dipendenti - Informazioni Complete</p>
      </div>
      
      <div style="background: #f8f9fa; border-left: 5px solid #6c757d; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: #495057;">🎯 Cosa fa questo sistema</h3>
        <p style="margin: 0; text-align: justify;">
          Sistema completo per gestire le ore lavorate dei dipendenti, dalla registrazione quotidiana 
          fino alla generazione di report professionali per il commercialista, con funzioni di 
          archiviazione, sicurezza e controllo qualità dati integrati.
        </p>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #6c757d; padding-bottom: 8px; margin: 25px 0 15px 0;">📂 Moduli del Sistema</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #667eea; display: flex; align-items: center;">
            <span style="background: #667eea; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📁</span>
            MODULO ARCHIVIO
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Scopo:</strong> Archivia ore degli anni precedenti liberando spazio</li>
            <li><strong>Output:</strong> File Excel e PDF automatici per ogni dipendente</li>
            <li><strong>Vantaggi:</strong> Backup sicuri + performance migliorata</li>
            <li><strong>Quando usare:</strong> Fine anno o quando dipendente lascia azienda</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #ff6b6b; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #ff6b6b; display: flex; align-items: center;">
            <span style="background: #ff6b6b; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🔐</span>
            MODULO PASSWORD
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Scopo:</strong> Gestisce accessi sicuri di tutti i dipendenti</li>
            <li><strong>Sicurezza:</strong> Hash SHA-256 con salt personalizzato</li>
            <li><strong>Funzioni:</strong> Cambio password, lista utenti, debug sicurezza</li>
            <li><strong>Quando usare:</strong> Nuovi dipendenti, reset password, controlli periodici</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #007bff; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #007bff; display: flex; align-items: center;">
            <span style="background: #007bff; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📊</span>
            MODULO REPORT COMMERCIALISTA
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Scopo:</strong> Genera file Excel professionali per commercialista</li>
            <li><strong>Tipologie:</strong> Report mensili dettagliati e riepiloghi annuali</li>
            <li><strong>Contenuto:</strong> Ore giornaliere, totali cantieri, statistiche</li>
            <li><strong>Quando usare:</strong> Fine mese per invio commercialista</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #ff9800; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #ff9800; display: flex; align-items: center;">
            <span style="background: #ff9800; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🗏️</span>
            MODULO GESTIONE CANTIERI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Scopo:</strong> Mantiene allineati i totali ore per cantiere</li>
            <li><strong>Funzioni:</strong> Ricalcolo automatico e verifica inconsistenze</li>
            <li><strong>Performance:</strong> Ottimizzato per grandi quantità di dati</li>
            <li><strong>Quando usare:</strong> Dopo modifiche manuali ai cantieri dipendenti</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #2e7d32;">💡 Come Iniziare</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
          <h4 style="margin: 0 0 8px 0; color: #2e7d32;">🚀 PRIMI PASSI</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>Esegui diagnostica:</strong> Clicca "🔧 Diagnostica sistema" per verificare tutto</li>
            <li><strong>Controlla utenti:</strong> Vai in "🔐 Password" → "📋 Lista utenti"</li>
            <li><strong>Testa un report:</strong> Usa "📊 Report" → "🧪 Test report"</li>
            <li><strong>Leggi le guide:</strong> Ogni modulo ha il bottone "📖 Come..."</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #856404;">🛠️ Funzioni di Sistema</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #b8860b;">⚙️ INIZIALIZZAZIONE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Configura ID spreadsheet</li>
              <li>Prepara il sistema</li>
              <li>Da usare solo al primo avvio</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #b8860b;">🔧 DIAGNOSTICA</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Controlla fogli e cartelle</li>
              <li>Verifica utenti e password</li>
              <li>Rileva problemi automaticamente</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background: #d1ecf1; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #0c5460;">🏗️ Architettura del Sistema</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8;">
          <div style="font-family: 'Courier New', monospace; font-size: 14px; color: #424242; line-height: 1.8;">
            <strong>📁 Struttura Google Apps Script:</strong><br>
            ├── 📄 Main.gs (Menu e coordinamento)<br>
            ├── 📄 Config.gs (Configurazioni centrali)<br>
            ├── 📄 ArchivioOre.gs (Funzioni archiviazione)<br>
            ├── 📄 GestionePassword.gs (Sicurezza utenti)<br>
            ├── 📄 ReportCommercialista.gs (Generazione report)<br>
            ├── 📄 CalcoloCantieri.gs (Gestione cantieri)<br>
            └── 📄 Utils.gs (Funzioni utility comuni)
          </div>
        </div>
      </div>
      
      <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #721c24;">🆘 Supporto e Risoluzione Problemi</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #dc3545;">❌ SE QUALCOSA NON FUNZIONA</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>Prima cosa:</strong> Esegui "🔧 Diagnostica sistema"</li>
            <li><strong>Leggi il report:</strong> Identifica errori specifici</li>
            <li><strong>Usa le guide:</strong> Ogni modulo ha istruzioni dettagliate</li>
            <li><strong>Controlla permessi:</strong> Verifica accesso Drive e fogli</li>
          </ol>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #28a745;">✅ MESSAGGI DI SISTEMA</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>✅ Verde:</strong> Operazione completata con successo</li>
            <li><strong>⚠️ Giallo:</strong> Attenzione, controllare risultati</li>
            <li><strong>❌ Rosso:</strong> Errore, operazione fallita</li>
            <li><strong>🔍 Blu:</strong> Informazioni e dettagli tecnici</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #e2e3e5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #383d41;">📈 Vantaggi del Sistema</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #495057;">🎯 EFFICIENZA</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Automatizzazione completa</li>
              <li>Zero errori manuali</li>
              <li>Tempo di elaborazione ridotto</li>
              <li>Interfaccia user-friendly</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #495057;">🛡️ SICUREZZA</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Hash crittografici sicuri</li>
              <li>Backup automatici</li>
              <li>Controlli di integrità</li>
              <li>Log degli errori</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background: #d4edda; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">🎓 Suggerimenti per l'Uso</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>📅 Routine mensile:</strong> Genera report primi giorni del mese</li>
            <li><strong>🔍 Controllo settimanale:</strong> Verifica allineamento cantieri</li>
            <li><strong>🔐 Security check:</strong> Debug password mensile</li>
            <li><strong>📁 Archiviazione:</strong> Fine anno per performance ottimali</li>
            <li><strong>🧪 Test regolari:</strong> Usa funzioni test prima di operazioni massive</li>
            <li><strong>💾 Backup:</strong> Mantieni copie di sicurezza dei file importanti</li>
          </ul>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          ℹ️ Tutto chiaro
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'ℹ️ Informazioni Sistema');
}

// ===== ISTRUZIONI DETTAGLIATE PER MODULI =====

/**
 * Istruzioni dettagliate per il modulo Archivio - DIALOG HTML
 */
function showArchiveInstructions() {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">📖 Come Usare L'Archivio</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Guida completa per archiviare le ore lavorate</p>
      </div>
      
      <div style="background: #e8f4fd; border-left: 5px solid #2196F3; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: #1976D2;">🎯 Scopo</h3>
        <p style="margin: 0; text-align: justify;">
          L'archivio serve a spostare le ore lavorate degli anni precedenti in file separati, 
          liberando spazio nei fogli attuali e creando backup sicuri.
        </p>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; margin: 25px 0 15px 0;">📄 Operazioni Disponibili</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid #4CAF50; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #4CAF50; display: flex; align-items: center;">
            <span style="background: #4CAF50; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📅</span>
            ARCHIVIA ANNO PRECEDENTE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cosa fa:</strong> Archivia TUTTI i dipendenti per l'anno scorso</li>
            <li><strong>Quando usare:</strong> Fine anno, quando inizi il nuovo anno</li>
            <li><strong>Risultato:</strong> File Excel + PDF per ogni dipendente</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #FF9800; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #FF9800; display: flex; align-items: center;">
            <span style="background: #FF9800; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">👤</span>
            ARCHIVIA SINGOLO DIPENDENTE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cosa fa:</strong> Archivia solo un dipendente per un anno specifico</li>
            <li><strong>Quando usare:</strong> Dipendente che lascia l'azienda</li>
            <li><strong>Come:</strong> Scegli dipendente + anno da archiviare</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #2196F3; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #2196F3; display: flex; align-items: center;">
            <span style="background: #2196F3; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📊</span>
            ARCHIVIA CON SELEZIONE ANNO
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cosa fa:</strong> Archivia tutti per un anno che scegli tu</li>
            <li><strong>Quando usare:</strong> Archiviazione di anni diversi dal precedente</li>
            <li><strong>Flessibile:</strong> Puoi scegliere qualsiasi anno</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #9C27B0; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #9C27B0; display: flex; align-items: center;">
            <span style="background: #9C27B0; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📋</span>
            STATO ARCHIVI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cosa fa:</strong> Mostra cosa hai già archiviato</li>
            <li><strong>Info:</strong> Quanti file per ogni anno</li>
            <li><strong>Utile per:</strong> Controllo rapido degli archivi esistenti</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #d32f2f;">⚠️ IMPORTANTE</h3>
        <ul style="margin: 0; padding-left: 20px; color: #c62828;">
          <li><strong>L'archiviazione è IRREVERSIBILE</strong></li>
          <li><strong>I dati vengono RIMOSSI</strong> dal foglio principale</li>
          <li><strong>Vengono creati file di backup</strong> automaticamente</li>
          <li><strong>I file vanno nella cartella</strong> "Archivi Ore Lavorate" su Drive</li>
        </ul>
      </div>
      
      <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #2e7d32;">📝 Procedura Consigliata</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li><strong>Controlla</strong> "📋 Stato archivi" per vedere cosa c'è già</li>
          <li><strong>A fine anno,</strong> usa "📅 Archivia anno precedente"</li>
          <li><strong>Verifica</strong> che i file siano stati creati su Drive</li>
          <li><strong>Solo dopo aver verificato,</strong> considera l'operazione completata</li>
        </ol>
      </div>
      
      <div style="background: #f3e5f5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #7b1fa2;">🗂️ Dove Trovare i File</h3>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #9c27b0;">
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            Google Drive > Archivi Ore Lavorate > [Anno] > File Excel e PDF
          </code>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          ✅ Ho capito
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📖 Istruzioni Archivio');
}

/**
 * Istruzioni dettagliate per il modulo Password - DIALOG HTML
 */
function showPasswordInstructions() {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">🔐 Come Gestire le Password</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Guida completa per la sicurezza degli accessi</p>
      </div>
      
      <div style="background: #fff3e0; border-left: 5px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: #e65100;">🎯 Scopo</h3>
        <p style="margin: 0; text-align: justify;">
          Il sistema password gestisce l'accesso sicuro di tutti i dipendenti, permettendo di 
          cambiare credenziali, controllare la sicurezza degli account e mantenere hash crittografici.
        </p>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 8px; margin: 25px 0 15px 0;">🔧 Operazioni Disponibili</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid #e74c3c; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #e74c3c; display: flex; align-items: center;">
            <span style="background: #e74c3c; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">👤</span>
            CAMBIA PASSWORD DIPENDENTE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Funzione principale:</strong> Aggiorna password di qualsiasi dipendente</li>
            <li><strong>Processo guidato:</strong> Selezione utente → Nuova password → Conferma</li>
            <li><strong>Sicurezza:</strong> Genera automaticamente hash SHA-256</li>
            <li><strong>Risultato:</strong> Password salvata in chiaro + hash sicuro</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #2196F3; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #2196F3; display: flex; align-items: center;">
            <span style="background: #2196F3; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📋</span>
            LISTA UTENTI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Panoramica completa:</strong> Tutti i dipendenti registrati</li>
            <li><strong>Stato account:</strong> Attivo/Disattivato per ogni utente</li>
            <li><strong>Sicurezza:</strong> Chi ha password sicure vs non sicure</li>
            <li><strong>Statistiche:</strong> Contatori e riepiloghi automatici</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #9C27B0; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #9C27B0; display: flex; align-items: center;">
            <span style="background: #9C27B0; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🔍</span>
            DEBUG HASH PASSWORD
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Controllo tecnico:</strong> Verifica integrità hash crittografici</li>
            <li><strong>Diagnosi problemi:</strong> Trova password deboli o mancanti</li>
            <li><strong>Report dettagliato:</strong> Analisi sicurezza per ogni utente</li>
            <li><strong>Raccomandazioni:</strong> Azioni correttive automatiche</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #f3e5f5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #7b1fa2;">📝 Scenari di Utilizzo</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4caf50;">
          <h4 style="margin: 0 0 8px 0; color: #388e3c;">🆕 NUOVO DIPENDENTE</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Aggiungi il dipendente nel foglio <strong>"Utenti"</strong></li>
            <li>Usa <strong>"👤 Cambia password"</strong> per impostare credenziali iniziali</li>
            <li>Comunica username e password al dipendente</li>
            <li>Verifica con <strong>"📋 Lista utenti"</strong> che sia tutto OK</li>
          </ol>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ff9800;">
          <h4 style="margin: 0 0 8px 0; color: #f57c00;">🔄 CAMBIO PASSWORD</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Dipendente richiede nuovo accesso</li>
            <li>Seleziona <strong>"👤 Cambia password dipendente"</strong></li>
            <li>Scegli utente dalla lista completa</li>
            <li>Inserisci nuova password (min. 4 caratteri)</li>
            <li>Conferma e comunica le nuove credenziali</li>
          </ol>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #9c27b0;">
          <h4 style="margin: 0 0 8px 0; color: #7b1fa2;">🔍 CONTROLLO SICUREZZA</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Esegui <strong>"🔍 Debug hash password"</strong> periodicamente</li>
            <li>Controlla il report per problemi di sicurezza</li>
            <li>Aggiorna password deboli o mancanti</li>
            <li>Verifica che tutti gli utenti attivi abbiano accesso</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #2e7d32;">🔐 Livelli di Sicurezza</h3>
        
        <div style="display: flex; justify-content: space-between; margin: 15px 0;">
          <div style="flex: 1; margin-right: 10px; padding: 10px; background: #ffcdd2; border-radius: 5px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 5px;">🚨</div>
            <strong style="color: #c62828;">CRITICO</strong><br>
            <small>Nessuna Password</small>
          </div>
          <div style="flex: 1; margin: 0 5px; padding: 10px; background: #fff3e0; border-radius: 5px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 5px;">⚠️</div>
            <strong style="color: #ef6c00;">DEBOLE</strong><br>
            <small>Solo Password Plain</small>
          </div>
          <div style="flex: 1; margin-left: 10px; padding: 10px; background: #c8e6c9; border-radius: 5px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 5px;">✅</div>
            <strong style="color: #2e7d32;">SICURO</strong><br>
            <small>Hash SHA-256</small>
          </div>
        </div>
      </div>
      
      <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #d32f2f;">⚠️ AVVERTENZE IMPORTANTI</h3>
        <ul style="margin: 0; padding-left: 20px; color: #c62828;">
          <li><strong>Cambiare password è IRREVERSIBILE</strong> - non c'è undo</li>
          <li><strong>Comunica sempre</strong> le nuove credenziali al dipendente</li>
          <li><strong>Password minima:</strong> 4 caratteri (raccomandati 8+)</li>
          <li><strong>Il sistema salva</strong> sia password chiara che hash sicuro</li>
          <li><strong>Controlli periodici</strong> sono essenziali per la sicurezza</li>
        </ul>
      </div>
      
      <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1976d2;">🛡️ Tecnologia di Sicurezza</h3>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 14px; color: #424242;">
            <strong>Algoritmo:</strong> SHA-256 con salt personalizzato<br>
            <strong>Lunghezza hash:</strong> 64 caratteri esadecimali<br>
            <strong>Salt pattern:</strong> "OreLavoro2025_Salt_" + password + salt<br>
            <strong>Charset:</strong> UTF-8 per compatibilità internazionale
          </p>
        </div>
      </div>
      
      <div style="background: #f1f8e9; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #388e3c;">💡 Best Practices</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #2e7d32;">✅ DA FARE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Controllo sicurezza mensile</li>
              <li>Password uniche per utente</li>
              <li>Cambio per nuovi dipendenti</li>
              <li>Backup lista utenti</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #d32f2f;">❌ EVITARE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Password troppo semplici</li>
              <li>Stesso accesso per tutti</li>
              <li>Dimenticare di comunicare</li>
              <li>Ignorare alert sicurezza</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          🔐 Ho capito
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🔐 Istruzioni Password');
}

/**
 * Istruzioni dettagliate per il modulo Report - DIALOG HTML
 */
function showReportInstructions() {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">📊 Come Generare Report</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Guida completa per report commercialista</p>
      </div>
      
      <div style="background: #e3f2fd; border-left: 5px solid #2196F3; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: #1976D2;">🎯 Scopo</h3>
        <p style="margin: 0; text-align: justify;">
          Il sistema report genera file Excel professionali pronti per il commercialista, 
          con calcoli automatici delle ore, statistiche dettagliate e formattazione aziendale.
        </p>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 8px; margin: 25px 0 15px 0;">📄 Operazioni Disponibili</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid #28a745; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #28a745; display: flex; align-items: center;">
            <span style="background: #28a745; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📅</span>
            GENERA REPORT MENSILE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Flessibilità totale:</strong> Singolo dipendente o tutti insieme</li>
            <li><strong>Selezione libera:</strong> Qualsiasi mese e anno</li>
            <li><strong>Output completo:</strong> Excel con dettagli giornalieri + riepilogo cantieri</li>
            <li><strong>Formattazione professionale:</strong> Header azienda e dati fiscali</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #6f42c1; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #6f42c1; display: flex; align-items: center;">
            <span style="background: #6f42c1; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📋</span>
            REPORT RIEPILOGATIVO ANNUALE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Visione d'insieme:</strong> Riassunto completo di tutto l'anno</li>
            <li><strong>Tabella mensile:</strong> Breakdown per dipendente e mese</li>
            <li><strong>Totali annuali:</strong> Statistiche e confronti</li>
            <li><strong>Ideale per:</strong> Bilanci di fine anno e controllo generale</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #fd7e14; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #fd7e14; display: flex; align-items: center;">
            <span style="background: #fd7e14; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🧪</span>
            TEST REPORT (DIPENDENTE SINGOLO)
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Test veloce:</strong> Verifica rapida su un dipendente</li>
            <li><strong>Mese corrente:</strong> Usa automaticamente i dati più recenti</li>
            <li><strong>Debug system:</strong> Perfetto per controllare che tutto funzioni</li>
            <li><strong>Anteprima:</strong> Vedi il risultato prima di generazioni massive</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #2e7d32;">📝 Procedura Step-by-Step</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #28a745;">
          <h4 style="margin: 0 0 8px 0; color: #1e7e34;">📅 REPORT MENSILE</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Clicca <strong>"📅 Genera report mensile"</strong></li>
            <li>Scegli dipendente specifico o <strong>"Tutti i dipendenti"</strong></li>
            <li>Seleziona <strong>mese e anno</strong> desiderati</li>
            <li>Clicca <strong>"Genera Report"</strong> e attendi (5-30 secondi)</li>
            <li>Controlla i file nella cartella Drive indicata</li>
            <li>Scarica e invia al commercialista</li>
          </ol>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #6f42c1;">
          <h4 style="margin: 0 0 8px 0; color: #5a2d91;">📋 REPORT ANNUALE</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Seleziona <strong>"📋 Report riepilogativo annuale"</strong></li>
            <li>Inserisci l'anno di interesse</li>
            <li>Conferma la generazione</li>
            <li>Attendi l'elaborazione (può richiedere più tempo)</li>
            <li>Verifica il file Excel con tabelle mensili complete</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #856404;">📊 Cosa Contengono i Report</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #b8860b;">📄 FILE SINGOLO DIPENDENTE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Header azienda con P.IVA</li>
              <li>Info dipendente e periodo</li>
              <li>Riepilogo cantieri</li>
              <li>Dettaglio giornaliero</li>
              <li>Totali e medie automatiche</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #b8860b;">📊 FILE RIEPILOGO GENERALE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Totali di tutti i dipendenti</li>
              <li>Statistiche comparative</li>
              <li>Medie e percentuali</li>
              <li>Controllo generale coerenza</li>
              <li>Dashboard esecutivo</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #721c24;">⚠️ Informazioni Importanti</h3>
        <ul style="margin: 0; padding-left: 20px; color: #721c24;">
          <li><strong>Tempo di generazione:</strong> Dipende dal numero di dipendenti (5-60 secondi)</li>
          <li><strong>Formato output:</strong> Solo file Excel (.xlsx) per compatibilità</li>
          <li><strong>Dati inclusi:</strong> Solo ore con cantieri validi (no dati incompleti)</li>
          <li><strong>Calcoli automatici:</strong> Totali, medie e statistiche pre-calcolate</li>
          <li><strong>Periodo di riferimento:</strong> Solo mesi/anni con dati effettivi</li>
        </ul>
      </div>
      
      <div style="background: #d1ecf1; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #0c5460;">🗂️ Dove Trovare i File</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8;">
          <div style="font-family: 'Courier New', monospace; font-size: 14px; color: #424242; line-height: 1.8;">
            <strong>📁 Struttura cartelle:</strong><br>
            Google Drive/<br>
            └── 📂 Report Commercialista/<br>
            &nbsp;&nbsp;&nbsp;&nbsp;└── 📂 Report_2025/<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📄 Report_NomeDipendente_Gennaio_2025.xlsx<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📄 RIEPILOGO_GENERALE_Gennaio_2025.xlsx<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 REPORT_ANNUALE_2025.xlsx
          </div>
        </div>
      </div>
      
      <div style="background: #e2e3e5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #383d41;">🔧 Risoluzione Problemi</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #dc3545;">❌ NESSUN DATO TROVATO</h4>
          <p style="margin: 0; font-size: 14px;"><strong>Causa:</strong> Nessuna ora registrata per il periodo selezionato</p>
          <p style="margin: 0; font-size: 14px;"><strong>Soluzione:</strong> Verifica mese/anno o usa "Test report" per controllo</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #dc3545;">❌ ERRORE GENERAZIONE</h4>
          <p style="margin: 0; font-size: 14px;"><strong>Causa:</strong> Problema di accesso Drive o fogli danneggiati</p>
          <p style="margin: 0; font-size: 14px;"><strong>Soluzione:</strong> Usa "🔧 Diagnostica sistema" e riprova</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #28a745;">✅ OPERAZIONE LENTA</h4>
          <p style="margin: 0; font-size: 14px;"><strong>Normale:</strong> Molti dipendenti richiedono più tempo</p>
          <p style="margin: 0; font-size: 14px;"><strong>Pazienza:</strong> Non chiudere la finestra durante la generazione</p>
        </div>
      </div>
      
      <div style="background: #d4edda; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">💡 Suggerimenti Pro</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #155724;">✅ MIGLIORI PRATICHE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Genera report a fine mese</li>
              <li>Testa sempre con un dipendente prima</li>
              <li>Controlla totali prima dell'invio</li>
              <li>Mantieni naming convention files</li>
              <li>Backup periodico delle cartelle</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #155724;">⏰ TIMING OTTIMALE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Report mensili: primi 5 giorni del mese</li>
              <li>Report annuali: entro 15 gennaio</li>
              <li>Test preliminari: metà mese</li>
              <li>Backup cartelle: fine trimestre</li>
              <li>Verifica coerenza: settimanale</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          📊 Ho capito
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📊 Istruzioni Report Commercialista');
}

// ===== WRAPPER FUNCTIONS PER MODULI =====

// Archivio Ore
function archiveAllPreviousYear() {
  try {
    executeArchiveAllPreviousYear();
  } catch (error) {
    handleGlobalError('archiveAllPreviousYear', error);
  }
}

function archiveSingleEmployee() {
  try {
    executeArchiveSingleEmployee();
  } catch (error) {
    handleGlobalError('archiveSingleEmployee', error);
  }
}

function archiveWithCustomYear() {
  try {
    executeArchiveWithCustomYear();
  } catch (error) {
    handleGlobalError('archiveWithCustomYear', error);
  }
}

function showArchiveStatus() {
  try {
    displayArchiveStatus();
  } catch (error) {
    handleGlobalError('showArchiveStatus', error);
  }
}

// Gestione Password
function changeEmployeePassword() {
  try {
    executeChangeEmployeePassword();
  } catch (error) {
    handleGlobalError('changeEmployeePassword', error);
  }
}

function showUsersList() {
  try {
    displayUsersList();
  } catch (error) {
    handleGlobalError('showUsersList', error);
  }
}

function debugPasswordHash() {
  try {
    executeDebugPasswordHash();
  } catch (error) {
    handleGlobalError('debugPasswordHash', error);
  }
}

// Report Commercialista
function generateMonthlyReport() {
  try {
    executeGenerateMonthlyReport();
  } catch (error) {
    handleGlobalError('generateMonthlyReport', error);
  }
}

function generateYearlyReport() {
  try {
    executeGenerateYearlyReport();
  } catch (error) {
    handleGlobalError('generateYearlyReport', error);
  }
}

function testSingleReport() {
  try {
    executeTestSingleReport();
  } catch (error) {
    handleGlobalError('testSingleReport', error);
  }
}

// Gestione Cantieri
function recalculateConstructionSites() {
  try {
    executeRecalculateConstructionSites();
  } catch (error) {
    handleGlobalError('recalculateConstructionSites', error);
  }
}

function verifyDataAlignment() {
  try {
    executeVerifyDataAlignment();
  } catch (error) {
    handleGlobalError('verifyDataAlignment', error);
  }
}

function showConstructionSiteInstructions() {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">🗏️ Come Gestire i Cantieri</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Guida per mantenere allineati i totali ore</p>
      </div>
      
      <div style="background: #fff3e0; border-left: 5px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: #e65100;">🎯 Scopo</h3>
        <p style="margin: 0; text-align: justify;">
          Il sistema cantieri mantiene sincronizzati i totali delle ore lavorate per ogni cantiere, 
          rilevando automaticamente inconsistenze e permettendo correzioni massive dei dati.
        </p>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #ff9800; padding-bottom: 8px; margin: 25px 0 15px 0;">🔧 Operazioni Disponibili</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid #4CAF50; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #4CAF50; display: flex; align-items: center;">
            <span style="background: #4CAF50; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🔄</span>
            RICALCOLA TOTALI ORE CANTIERI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Funzione principale:</strong> Corregge tutti i totali automaticamente</li>
            <li><strong>Quando usare:</strong> Dopo modifiche manuali ai cantieri dipendenti</li>
            <li><strong>Performance:</strong> Ottimizzato per grandi quantità di dati</li>
            <li><strong>Risultato:</strong> Report dettagliato delle correzioni effettuate</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #2196F3; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #2196F3; display: flex; align-items: center;">
            <span style="background: #2196F3; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🔍</span>
            VERIFICA ALLINEAMENTO DATI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Diagnosi completa:</strong> Analizza inconsistenze senza modificare</li>
            <li><strong>Report dettagliato:</strong> Ore orfane, cantieri mancanti, errori</li>
            <li><strong>Controllo integrità:</strong> Verifica coerenza globale del sistema</li>
            <li><strong>Raccomandazioni:</strong> Suggerisce azioni correttive specifiche</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #f3e5f5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #7b1fa2;">📝 Problema Comune</h3>
        
        <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #f44336;">
          <h4 style="margin: 0 0 8px 0; color: #c62828;">🚨 SCENARIO TIPICO</h4>
          <p style="margin: 0; font-size: 14px;">
            <strong>Problema:</strong> Modifichi manualmente il cantiere di un dipendente 
            (es: da "C001" a "C002"), ma i totali nel foglio Cantieri non si aggiornano automaticamente.
          </p>
        </div>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4caf50;">
          <h4 style="margin: 0 0 8px 0; color: #2e7d32;">✅ SOLUZIONE RAPIDA</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Dopo aver modificato i cantieri nei fogli dipendenti</li>
            <li>Vai al menu <strong>"🗏️ Gestione Cantieri"</strong></li>
            <li>Clicca <strong>"🔄 Ricalcola totali ore cantieri"</strong></li>
            <li>Attendi il completamento (pochi secondi)</li>
            <li>Controlla il report per vedere le correzioni applicate</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1976d2;">🧪 Come Testare il Sistema</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>Nota</strong> il totale ore di un cantiere (es: C001 = 47.5h)</li>
            <li><strong>Modifica manualmente</strong> un cantiere nel foglio di un dipendente</li>
            <li><strong>Cambia</strong> da C001 a C002 per alcune ore</li>
            <li><strong>Esegui</strong> "🔄 Ricalcola totali ore cantieri"</li>
            <li><strong>Verifica</strong> che C001 e C002 abbiano i nuovi totali corretti</li>
            <li><strong>Controlla</strong> il report per vedere le modifiche applicate</li>
          </ol>
        </div>
      </div>
      
      <div style="background: #fff8e1; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #f57c00;">⚡ Performance e Ottimizzazioni</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #ef6c00;">🚀 VELOCITÀ</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Legge tutti i fogli in memoria</li>
              <li>Processo ottimizzato per grandi dataset</li>
              <li>Tempo tipico: 2-10 secondi</li>
              <li>Gestisce centinaia di dipendenti</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #ef6c00;">🔍 PRECISIONE</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Arrotondamento a 1 decimale</li>
              <li>Controllo coerenza globale</li>
              <li>Rilevamento ore orfane</li>
              <li>Validazione cantieri mancanti</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #2e7d32;">📊 Cosa Mostrano i Report</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #388e3c;">🔄 REPORT RICALCOLO</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>Tempo esecuzione:</strong> Durata dell'operazione</li>
            <li><strong>Dipendenti processati:</strong> Quanti fogli controllati</li>
            <li><strong>Cantieri corretti:</strong> Lista dettagliata delle modifiche</li>
            <li><strong>Differenze trovate:</strong> Vecchi vs nuovi totali</li>
          </ul>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <h4 style="margin: 0 0 8px 0; color: #388e3c;">🔍 REPORT VERIFICA</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
            <li><strong>Inconsistenze:</strong> Totali che non corrispondono</li>
            <li><strong>Ore orfane:</strong> Ore su cantieri inesistenti</li>
            <li><strong>Cantieri mancanti:</strong> Referenziati ma non nel database</li>
            <li><strong>Totali globali:</strong> Confronto dipendenti vs cantieri</li>
          </ul>
        </div>
      </div>
      
      <div style="background: #ffebee; border: 2px solid #f44336; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #d32f2f;">💡 Best Practices</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #2e7d32;">✅ RACCOMANDAZIONI</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Ricalcolo dopo modifiche massive</li>
              <li>Verifica allineamento settimanale</li>
              <li>Backup prima di modifiche importanti</li>
              <li>Test su piccoli dataset prima</li>
            </ul>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; color: #d32f2f;">⚠️ ATTENZIONI</h4>
            <ul style="margin: 0; padding-left: 15px; font-size: 14px;">
              <li>Non interrompere durante l'esecuzione</li>
              <li>Verifica risultati prima di procedere</li>
              <li>Controlla cantieri mancanti</li>
              <li>Comunica modifiche al team</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div style="background: #f1f8e9; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #388e3c;">🛠️ Funzioni Avanzate</h3>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
          <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 14px; color: #424242;">
            <strong>Funzione Excel:</strong> =TOTALE_ORE_CANTIERE("C001")<br>
            <strong>Cache automatica:</strong> 5 minuti per performance<br>
            <strong>Pulizia cache:</strong> Funzione di manutenzione disponibile<br>
            <strong>Test performance:</strong> Benchmark integrato per debug
          </p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          🗏️ Ho capito
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🗏️ Istruzioni Cantieri');
}

// ===== FUNZIONI SISTEMA =====

function initializeSystemSetup() {
  try {
    // Prima controlla lo stato attuale del sistema
    const currentStatus = checkSystemInitializationStatus();
    showSystemInitializationDialog(currentStatus);
  } catch (error) {
    handleGlobalError('initializeSystemSetup', error);
  }
}

/**
 * Controlla lo stato di inizializzazione del sistema
 */
function checkSystemInitializationStatus() {
  const status = {
    isInitialized: false,
    currentSpreadsheetId: null,
    storedSpreadsheetId: null,
    activeSpreadsheetId: null,
    needsInitialization: false,
    hasConflict: false,
    systemHealth: 'unknown'
  };
  
  try {
    // ID dello spreadsheet attivo
    status.activeSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // ID salvato nelle properties
    status.storedSpreadsheetId = PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID');
    
    // Debug logging
    console.log('Active spreadsheet ID:', status.activeSpreadsheetId);
    console.log('Stored spreadsheet ID:', status.storedSpreadsheetId);
    
    // Determina stato con logica più rigorosa
    if (!status.storedSpreadsheetId || status.storedSpreadsheetId === '' || status.storedSpreadsheetId === 'null') {
      // Nessuna configurazione salvata
      status.needsInitialization = true;
      status.systemHealth = 'needs_setup';
      console.log('Sistema non inizializzato - primo setup necessario');
    } else if (status.storedSpreadsheetId === status.activeSpreadsheetId) {
      // Perfetta corrispondenza - sistema operativo
      status.isInitialized = true;
      status.currentSpreadsheetId = status.storedSpreadsheetId;
      status.systemHealth = 'healthy';
      status.needsInitialization = false; // IMPORTANTE: sistema OK, non serve inizializzazione
      console.log('Sistema già inizializzato correttamente');
    } else {
      // IDs diversi - conflitto
      status.hasConflict = true;
      status.currentSpreadsheetId = status.storedSpreadsheetId;
      status.systemHealth = 'conflict';
      status.needsInitialization = true;
      console.log('Conflitto rilevato - re-configurazione necessaria');
    }
    
  } catch (error) {
    status.systemHealth = 'error';
    status.error = error.message;
    console.error('Errore controllo stato sistema:', error);
  }
  
  return status;
}

/**
 * Mostra dialog intelligente per inizializzazione sistema
 */
function showSystemInitializationDialog(status) {
  const getStatusInfo = () => {
    switch (status.systemHealth) {
      case 'healthy':
        return {
          color: '#28a745',
          gradient: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
          icon: '✅',
          title: 'Sistema Già Inizializzato',
          message: 'Il sistema è già configurato correttamente'
        };
      case 'needs_setup':
        return {
          color: '#007bff',
          gradient: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
          icon: '🚀',
          title: 'Sistema da Inizializzare',
          message: 'Primo setup necessario per iniziare'
        };
      case 'conflict':
        return {
          color: '#ffc107',
          gradient: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
          icon: '⚠️',
          title: 'Conflitto Configurazione',
          message: 'Sistema configurato per altro spreadsheet'
        };
      default:
        return {
          color: '#dc3545',
          gradient: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
          icon: '❌',
          title: 'Errore Sistema',
          message: 'Impossibile determinare stato sistema'
        };
    }
  };
  
  const statusInfo = getStatusInfo();
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: ${statusInfo.gradient}; color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">${statusInfo.icon} Inizializzazione Sistema</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${statusInfo.title}</p>
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 5px;">
          <strong>${statusInfo.message}</strong>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-left: 5px solid ${statusInfo.color}; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: ${statusInfo.color};">📊 Stato Attuale Sistema</h3>
        <div style="margin-top: 15px;">
          <strong>Spreadsheet attivo:</strong><br>
          <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
            ${status.activeSpreadsheetId || 'Non rilevato'}
          </code><br><br>
          
          <strong>Configurazione salvata:</strong><br>
          <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
            ${status.storedSpreadsheetId || 'Nessuna configurazione'}
          </code><br><br>
          
          <strong>Stato sistema:</strong> 
          <span style="color: ${statusInfo.color}; font-weight: bold;">
            ${status.systemHealth === 'healthy' ? 'Operativo' : 
              status.systemHealth === 'needs_setup' ? 'Da configurare' :
              status.systemHealth === 'conflict' ? 'Conflitto rilevato' : 'Errore'}
          </span>
        </div>
      </div>
      
      ${status.systemHealth === 'healthy' ? `
        <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #155724;">✅ Sistema Già Operativo</h3>
          <p style="margin: 0; color: #155724;">
            Il sistema è già inizializzato correttamente per questo spreadsheet. 
            <strong>Non è necessaria nessuna azione.</strong>
          </p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
            <h4 style="margin: 0 0 8px 0; color: #155724;">💡 Cosa puoi fare ora:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Usare normalmente tutte le funzioni del sistema</li>
              <li>Eseguire "🔧 Diagnostica sistema" per controlli di salute</li>
              <li>Consultare "ℹ️ Informazioni Sistema" per maggiori dettagli</li>
            </ul>
          </div>
        </div>
      ` : status.systemHealth === 'needs_setup' ? `
        <div style="background: #cce7ff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #004085;">🚀 Setup Iniziale Richiesto</h3>
          <p style="margin: 0; color: #004085;">
            Questo è il primo avvio del sistema. È necessario salvare la configurazione 
            per collegare il sistema a questo spreadsheet.
          </p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #007bff;">
            <h4 style="margin: 0 0 8px 0; color: #004085;">📋 Cosa farà l'inizializzazione:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Salverà l'ID di questo spreadsheet come database principale</li>
              <li>Configurerà il sistema per operare correttamente</li>
              <li>Abiliterà tutte le funzioni (archivio, report, cantieri, password)</li>
              <li>Preparerà il sistema per l'uso quotidiano</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <button onclick="performInitialization()" 
                    style="background: #007bff; color: white; border: none; padding: 12px 25px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">
              🚀 Inizializza Sistema
            </button>
          </div>
        </div>
      ` : status.systemHealth === 'conflict' ? `
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #856404;">⚠️ Conflitto di Configurazione</h3>
          <p style="margin: 0; color: #856404;">
            Il sistema è configurato per un altro spreadsheet. Questo può succedere se hai 
            copiato il sistema o se stai lavorando su una copia del database.
          </p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <h4 style="margin: 0 0 8px 0; color: #856404;">🔄 Opzioni disponibili:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li><strong>Ri-configura:</strong> Aggiorna la configurazione per questo spreadsheet</li>
              <li><strong>Mantieni:</strong> Continua a usare la configurazione esistente (sconsigliato)</li>
              <li><strong>Backup:</strong> Salva la configurazione attuale prima di modificare</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <button onclick="performReconfiguration()" 
                    style="background: #ffc107; color: #856404; border: none; padding: 12px 25px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; margin-right: 10px;">
              🔄 Ri-configura Sistema
            </button>
          </div>
        </div>
      ` : `
        <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #721c24;">❌ Errore di Sistema</h3>
          <p style="margin: 0; color: #721c24;">
            Si è verificato un errore durante il controllo dello stato del sistema:
            <br><strong>${status.error || 'Errore sconosciuto'}</strong>
          </p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <h4 style="margin: 0 0 8px 0; color: #721c24;">🛠️ Possibili soluzioni:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Verifica i permessi di accesso al spreadsheet</li>
              <li>Controlla che il sistema sia attivato correttamente</li>
              <li>Prova a ricaricare la pagina e ripetere l'operazione</li>
              <li>Consulta l'amministratore se il problema persiste</li>
            </ul>
          </div>
        </div>
      `}
      
      <div style="background: #e2e3e5; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #383d41;">ℹ️ Informazioni Tecniche</h3>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #6c757d;">
          <p style="margin: 0; font-size: 14px; color: #495057;">
            <strong>Scopo:</strong> L'inizializzazione salva l'ID di questo spreadsheet nelle 
            PropertiesService di Google Apps Script, permettendo al sistema di identificare 
            univocamente il database principale anche quando eseguito da altri contesti.
            <br><br>
            <strong>Sicurezza:</strong> Questa operazione è completamente sicura e reversibile. 
            Non modifica i dati nel spreadsheet, solo la configurazione del sistema.
          </p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: #6c757d; color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          Chiudi
        </button>
      </div>
      
      <div id="status" style="margin-top: 15px; padding: 10px; text-align: center; font-weight: bold; border-radius: 5px; display: none;"></div>
      
    </div>
    
    <script>
      function performInitialization() {
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Inizializzazione...';
        
        const statusDiv = document.getElementById('status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = 'Configurazione sistema in corso...';
        statusDiv.style.backgroundColor = '#cce7ff';
        statusDiv.style.color = '#004085';
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              statusDiv.innerHTML = '✅ Sistema inizializzato con successo!<br>ID Spreadsheet salvato: ' + result.spreadsheetId;
              statusDiv.style.backgroundColor = '#d4edda';
              statusDiv.style.color = '#155724';
              
              btn.innerHTML = '✅ Completato';
              btn.style.backgroundColor = '#28a745';
              
              setTimeout(() => {
                google.script.host.close();
              }, 3000);
            } else {
              statusDiv.innerHTML = '❌ Errore: ' + result.message;
              statusDiv.style.backgroundColor = '#f8d7da';
              statusDiv.style.color = '#721c24';
              
              btn.disabled = false;
              btn.innerHTML = originalText;
            }
          })
          .withFailureHandler(function(error) {
            statusDiv.innerHTML = '❌ Errore tecnico: ' + error.message;
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
            
            btn.disabled = false;
            btn.innerHTML = originalText;
          })
          .executeSystemInitialization();
      }
      
      function performReconfiguration() {
        const btn = event.target;
        const originalText = btn.innerHTML;
        
        if (!confirm('Sei sicuro di voler ri-configurare il sistema per questo spreadsheet?\\n\\nQuesta operazione aggiornerà la configurazione esistente.')) {
          return;
        }
        
        btn.disabled = true;
        btn.innerHTML = '⏳ Ri-configurazione...';
        
        const statusDiv = document.getElementById('status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = 'Aggiornamento configurazione...';
        statusDiv.style.backgroundColor = '#fff3cd';
        statusDiv.style.color = '#856404';
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              statusDiv.innerHTML = '✅ Sistema ri-configurato con successo!<br>Configurazione precedente: ' + result.previousId + '<br>Nuova configurazione: ' + result.newId;
              statusDiv.style.backgroundColor = '#d4edda';
              statusDiv.style.color = '#155724';
              
              btn.innerHTML = '✅ Completato';
              btn.style.backgroundColor = '#28a745';
              
              setTimeout(() => {
                google.script.host.close();
              }, 4000);
            } else {
              statusDiv.innerHTML = '❌ Errore: ' + result.message;
              statusDiv.style.backgroundColor = '#f8d7da';
              statusDiv.style.color = '#721c24';
              
              btn.disabled = false;
              btn.innerHTML = originalText;
            }
          })
          .withFailureHandler(function(error) {
            statusDiv.innerHTML = '❌ Errore tecnico: ' + error.message;
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
            
            btn.disabled = false;
            btn.innerHTML = originalText;
          })
          .executeSystemReconfiguration();
      }
    </script>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  const title = status.systemHealth === 'healthy' ? 
    '✅ Sistema Inizializzato' : 
    status.systemHealth === 'needs_setup' ? 
    '🚀 Setup Sistema' :
    status.systemHealth === 'conflict' ?
    '⚠️ Conflitto Configurazione' :
    '❌ Errore Sistema';
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, title);
}

/**
 * Esegue l'inizializzazione vera e propria
 */
function executeSystemInitialization() {
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // Salva la configurazione
    PropertiesService.getScriptProperties().setProperty('MAIN_SHEET_ID', spreadsheetId);
    
    // Log per debug
    console.log('Sistema inizializzato con ID:', spreadsheetId);
    
    return { 
      success: true, 
      message: 'Sistema inizializzato correttamente',
      spreadsheetId: spreadsheetId
    };
  } catch (error) {
    console.error('Errore inizializzazione:', error);
    return { 
      success: false, 
      message: error.toString() 
    };
  }
}

/**
 * Esegue la ri-configurazione del sistema
 */
function executeSystemReconfiguration() {
  try {
    const currentSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const previousId = PropertiesService.getScriptProperties().getProperty('MAIN_SHEET_ID');
    
    // Aggiorna la configurazione
    PropertiesService.getScriptProperties().setProperty('MAIN_SHEET_ID', currentSpreadsheetId);
    
    // Log per debug
    console.log('Sistema ri-configurato da', previousId, 'a', currentSpreadsheetId);
    
    return { 
      success: true, 
      message: 'Sistema ri-configurato correttamente',
      previousId: previousId,
      newId: currentSpreadsheetId
    };
  } catch (error) {
    console.error('Errore ri-configurazione:', error);
    return { 
      success: false, 
      message: error.toString() 
    };
  }
}

function runSystemDiagnostics() {
  try {
    const diagnostics = performSystemDiagnostics();
    showDiagnosticsDialog(diagnostics);
  } catch (error) {
    handleGlobalError('runSystemDiagnostics', error);
  }
}

function performSystemDiagnostics() {
  const results = {
    timestamp: new Date().toLocaleString('it-IT'),
    spreadsheet: { status: 'unknown', details: '' },
    sheets: { count: 0, employees: 0, system: 0 },
    users: { total: 0, active: 0, withPassword: 0 },
    folders: { archive: false, reports: false },
    errors: []
  };
  
  try {
    const spreadsheet = getMainSpreadsheet();
    results.spreadsheet.status = 'ok';
    results.spreadsheet.details = spreadsheet.getName();
    
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
    
    try {
      const users = getUsersList();
      results.users.total = users.length;
      results.users.active = users.filter(u => u.attivo === 'Si').length;
      results.users.withPassword = users.filter(u => u.hasPassword).length;
    } catch (error) {
      results.errors.push('Impossibile leggere foglio Utenti: ' + error.message);
    }
    
    try {
      results.folders.archive = DriveApp.getFoldersByName(CONFIG.FOLDERS.ARCHIVE).hasNext();
      results.folders.reports = DriveApp.getFoldersByName(CONFIG.FOLDERS.REPORTS).hasNext();
    } catch (error) {
      results.errors.push('Errore accesso Drive: ' + error.message);
    }
    
  } catch (error) {
    results.spreadsheet.status = 'error';
    results.spreadsheet.details = error.message;
    results.errors.push('Errore connessione database: ' + error.message);
  }
  
  return results;
}

function showDiagnosticsDialog(diagnostics) {
  const statusIcon = diagnostics.errors.length === 0 ? '✅' : '⚠️';
  const overallStatus = diagnostics.errors.length === 0 ? 'ECCELLENTE' : 'PROBLEMI RILEVATI';
  const statusColor = diagnostics.errors.length === 0 ? '#28a745' : '#dc3545';
  const gradientColor = diagnostics.errors.length === 0 ? 
    'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
    'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 25px; line-height: 1.6; color: #333; max-width: 600px;">
      
      <div style="text-align: center; margin-bottom: 25px; padding: 20px; background: ${gradientColor}; color: white; border-radius: 10px;">
        <h2 style="margin: 0; font-size: 24px;">${statusIcon} Diagnostica Sistema</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${diagnostics.timestamp}</p>
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 5px;">
          <strong style="font-size: 18px;">STATO: ${overallStatus}</strong>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-left: 5px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0; color: ${statusColor};">📊 Riepilogo Generale</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <strong>Database:</strong> ${diagnostics.spreadsheet.status === 'ok' ? '✅' : '❌'} ${diagnostics.spreadsheet.status}<br>
            <strong>Fogli totali:</strong> ${diagnostics.sheets.count}<br>
            <strong>Dipendenti:</strong> ${diagnostics.sheets.employees}
          </div>
          <div>
            <strong>Utenti sistema:</strong> ${diagnostics.users.total}<br>
            <strong>Utenti attivi:</strong> ${diagnostics.users.active}<br>
            <strong>Errori rilevati:</strong> <span style="color: ${diagnostics.errors.length === 0 ? '#28a745' : '#dc3545'}; font-weight: bold;">${diagnostics.errors.length}</span>
          </div>
        </div>
      </div>
      
      <h3 style="color: #2c3e50; border-bottom: 2px solid #6c757d; padding-bottom: 8px; margin: 25px 0 15px 0;">🔍 Dettagli Diagnostica</h3>
      
      <div style="margin: 20px 0;">
        <div style="background: #fff; border: 2px solid ${diagnostics.spreadsheet.status === 'ok' ? '#28a745' : '#dc3545'}; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: ${diagnostics.spreadsheet.status === 'ok' ? '#28a745' : '#dc3545'}; display: flex; align-items: center;">
            <span style="background: ${diagnostics.spreadsheet.status === 'ok' ? '#28a745' : '#dc3545'}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">💾</span>
            DATABASE PRINCIPALE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Stato connessione:</strong> ${diagnostics.spreadsheet.status === 'ok' ? '✅ Connesso' : '❌ Errore'}</li>
            <li><strong>Nome database:</strong> ${diagnostics.spreadsheet.details}</li>
            <li><strong>Accessibilità:</strong> ${diagnostics.spreadsheet.status === 'ok' ? 'Pieno accesso' : 'Problemi di accesso'}</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid #007bff; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #007bff; display: flex; align-items: center;">
            <span style="background: #007bff; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">📄</span>
            STRUTTURA FOGLI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Fogli totali:</strong> ${diagnostics.sheets.count}</li>
            <li><strong>Fogli dipendenti:</strong> ${diagnostics.sheets.employees} (dati operativi)</li>
            <li><strong>Fogli di sistema:</strong> ${diagnostics.sheets.system} (configurazione)</li>
            <li><strong>Rapporto:</strong> ${diagnostics.sheets.employees > 0 ? '✅ Struttura corretta' : '⚠️ Pochi dipendenti'}</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid ${diagnostics.users.total > 0 ? '#28a745' : '#ffc107'}; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: ${diagnostics.users.total > 0 ? '#28a745' : '#ffc107'}; display: flex; align-items: center;">
            <span style="background: ${diagnostics.users.total > 0 ? '#28a745' : '#ffc107'}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">👥</span>
            GESTIONE UTENTI
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Utenti totali:</strong> ${diagnostics.users.total}</li>
            <li><strong>Utenti attivi:</strong> ${diagnostics.users.active} ${diagnostics.users.active > 0 ? '✅' : '⚠️'}</li>
            <li><strong>Con password:</strong> ${diagnostics.users.withPassword} ${diagnostics.users.withPassword > 0 ? '✅' : '❌'}</li>
            <li><strong>Sicurezza:</strong> ${diagnostics.users.withPassword === diagnostics.users.total ? '✅ Tutti protetti' : '⚠️ Alcuni senza password'}</li>
          </ul>
        </div>
        
        <div style="background: #fff; border: 2px solid ${(diagnostics.folders.archive && diagnostics.folders.reports) ? '#28a745' : '#ffc107'}; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: ${(diagnostics.folders.archive && diagnostics.folders.reports) ? '#28a745' : '#ffc107'}; display: flex; align-items: center;">
            <span style="background: ${(diagnostics.folders.archive && diagnostics.folders.reports) ? '#28a745' : '#ffc107'}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 12px;">🗂️</span>
            CARTELLE GOOGLE DRIVE
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Cartella archivi:</strong> ${diagnostics.folders.archive ? '✅ Trovata' : '❌ Mancante'}</li>
            <li><strong>Cartella report:</strong> ${diagnostics.folders.reports ? '✅ Trovata' : '❌ Mancante'}</li>
            <li><strong>Stato generale:</strong> ${(diagnostics.folders.archive && diagnostics.folders.reports) ? '✅ Configurazione completa' : '⚠️ Alcune cartelle mancanti'}</li>
          </ul>
        </div>
      </div>
      
      ${diagnostics.errors.length > 0 ? `
      <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #721c24;">❌ Errori Rilevati</h3>
        <div style="background: white; padding: 15px; border-radius: 5px;">
          ${diagnostics.errors.map((error, i) => `
            <div style="margin: 10px 0; padding: 10px; background: #fff5f5; border-left: 4px solid #dc3545; border-radius: 3px;">
              <strong>${i + 1}.</strong> ${error}
            </div>
          `).join('')}
        </div>
      </div>
      ` : `
      <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">✅ Sistema in Perfetta Salute</h3>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
          <p style="margin: 0; color: #155724;">
            <strong>Congratulazioni!</strong> Tutti i controlli sono stati superati con successo. 
            Il sistema è configurato correttamente e pronto per l'uso.
          </p>
        </div>
      </div>
      `}
      
      <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1976d2;">💡 Raccomandazioni</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
          ${diagnostics.errors.length === 0 ? `
            <h4 style="margin: 0 0 8px 0; color: #1976d2;">🚀 SISTEMA OTTIMALE</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Esegui diagnostica settimanalmente per monitoraggio</li>
              <li>Controlla periodicamente che nuovi dipendenti abbiano password</li>
              <li>Usa le funzioni di test prima di operazioni massive</li>
              <li>Mantieni backup regolari delle configurazioni</li>
            </ul>
          ` : `
            <h4 style="margin: 0 0 8px 0; color: #dc3545;">🔧 AZIONI CORRETTIVE</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              ${diagnostics.users.withPassword < diagnostics.users.total ? '<li>Imposta password per utenti senza credenziali</li>' : ''}
              ${!diagnostics.folders.archive ? '<li>La cartella "Archivi Ore Lavorate" verrà creata automaticamente al primo uso</li>' : ''}
              ${!diagnostics.folders.reports ? '<li>La cartella "Report Commercialista" verrà creata automaticamente al primo uso</li>' : ''}
              ${diagnostics.sheets.employees === 0 ? '<li>Verifica che esistano fogli dipendenti nel database</li>' : ''}
              <li>Risolvi gli errori elencati sopra prima di procedere</li>
              <li>Riesegui la diagnostica dopo le correzioni</li>
            </ul>
          `}
        </div>
      </div>
      
      <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <h3 style="margin: 0 0 15px 0; color: #856404;">🔄 Prossimi Passi</h3>
        
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
          <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
            ${diagnostics.errors.length === 0 ? `
              <li>Sistema pronto! Puoi iniziare a usare tutte le funzioni</li>
              <li>Prova "🧪 Test report" per verificare la generazione report</li>
              <li>Controlla "📋 Lista utenti" per gestione password</li>
              <li>Leggi le guide "📖 Come..." per ogni modulo</li>
            ` : `
              <li>Risolvi gli errori evidenziati in rosso</li>
              <li>Se mancano cartelle, prova a eseguire una funzione che le crea</li>
              <li>Per problemi utenti, vai in "🔐 Password" → "📋 Lista utenti"</li>
              <li>Riesegui questa diagnostica dopo le correzioni</li>
            `}
          </ol>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="google.script.host.close()" 
                style="background: ${gradientColor}; color: white; border: none; padding: 12px 30px; border-radius: 25px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          ${statusIcon} Chiudi Diagnostica
        </button>
      </div>
      
    </div>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(650)
    .setHeight(700);
    
  const title = diagnostics.errors.length === 0 ? 
    '✅ Diagnostica Sistema - Tutto OK' : 
    '⚠️ Diagnostica Sistema - Problemi Rilevati';
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, title);
}

// ===== GESTIONE ERRORI GLOBALE =====

function handleGlobalError(functionName, error) {
  const timestamp = new Date().toLocaleString('it-IT');
  const errorMessage = `[${timestamp}] Errore in ${functionName}: ${error.toString()}`;
  
  console.error(errorMessage);
  
  try {
    const errorLog = PropertiesService.getScriptProperties().getProperty('ERROR_LOG') || '';
    const newLog = errorLog + '\n' + errorMessage;
    PropertiesService.getScriptProperties().setProperty('ERROR_LOG', newLog.slice(-5000));
  } catch (logError) {
    console.error('Impossibile salvare log errori:', logError);
  }
  
  const userMessage = `❌ Si è verificato un errore:\n\n${error.message}\n\nFunzione: ${functionName}\nData: ${timestamp}\n\nContatta l'amministratore se il problema persiste.`;
  SpreadsheetApp.getUi().alert('Errore Sistema', userMessage);
}
