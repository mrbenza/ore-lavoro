// ===== BACKUP.GS - VERSIONE FINALE PULITA =====

const SPREADSHEET_ID = '19WrI1o9U_1GzBoL-GZTgNvvijdr5O3MXvNMjQX3oK9A';

function rilevaDipendenti() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tuttiIFogli = spreadsheet.getSheets().map(foglio => foglio.getName());
  
  const fogliSistema = [
    'Amministrazione', 'Utenti', 'Cantieri', 
    'Foglio Cantieri Base', 'Foglio utente Base', 'Foglio Utenti Base',
    'Tracking Archivi'
  ];
  
  const dipendenti = tuttiIFogli.filter(nome => 
    !fogliSistema.includes(nome) && 
    !nome.includes('Base') && 
    !nome.includes('_202')
  );
  
  console.log('Dipendenti rilevati: ' + dipendenti.join(', '));
  return dipendenti;
}

function scegliDipendente() {
  const dipendenti = rilevaDipendenti();
  
  if (dipendenti.length === 0) {
    SpreadsheetApp.getUi().alert('Nessun foglio dipendente trovato!');
    return null;
  }
  
  if (dipendenti.length === 1) {
    return dipendenti[0];
  }
  
  const ui = SpreadsheetApp.getUi();
  let messaggio = 'Scegli il dipendente da archiviare:\n\n';
  dipendenti.forEach((dipendente, index) => {
    messaggio += (index + 1) + '. ' + dipendente + '\n';
  });
  messaggio += '\nInserisci il numero:';
  
  const response = ui.prompt('Selezione Dipendente', messaggio, ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const numero = parseInt(response.getResponseText());
    if (numero >= 1 && numero <= dipendenti.length) {
      return dipendenti[numero - 1];
    } else {
      ui.alert('Numero non valido!');
      return null;
    }
  }
  
  return null;
}

function simulaArchiviazione() {
  console.log('=== SIMULAZIONE ARCHIVIAZIONE ===');
  
  try {
    const dipendenti = rilevaDipendenti();
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    console.log('📊 SIMULAZIONE PER TUTTI I DIPENDENTI:\n');
    
    let totaleRighe2024 = 0;
    let totaleOre2024 = 0;
    let totaleRighe2025 = 0;
    let totaleOre2025 = 0;
    
    dipendenti.forEach(nomeDipendente => {
      const foglio = spreadsheet.getSheetByName(nomeDipendente);
      
      if (!foglio) {
        console.log('❌ ' + nomeDipendente + ': Foglio non trovato');
        return;
      }
      
      const dati = foglio.getDataRange().getValues();
      let dati2024 = 0;
      let dati2025 = 0;
      let ore2024 = 0;
      let ore2025 = 0;
      
      for (let i = 4; i < dati.length; i++) {
        const riga = dati[i];
        const data = riga[0];
        const ore = riga[3];
        
        if (data && data instanceof Date && ore && typeof ore === 'number') {
          if (data.getFullYear() === 2024) {
            dati2024++;
            ore2024 += ore;
          } else if (data.getFullYear() === 2025) {
            dati2025++;
            ore2025 += ore;
          }
        }
      }
      
      console.log('👤 ' + nomeDipendente + ':');
      console.log('   📦 Archivio 2024: ' + dati2024 + ' righe, ' + ore2024 + ' ore');
      console.log('   📄 Rimane 2025+: ' + dati2025 + ' righe, ' + ore2025 + ' ore');
      
      totaleRighe2024 += dati2024;
      totaleOre2024 += ore2024;
      totaleRighe2025 += dati2025;
      totaleOre2025 += ore2025;
    });
    
    console.log('\n📊 TOTALI GENERALI:');
    console.log('📦 Da archiviare: ' + totaleRighe2024 + ' righe, ' + totaleOre2024 + ' ore');
    console.log('📄 Rimangono: ' + totaleRighe2025 + ' righe, ' + totaleOre2025 + ' ore');
    console.log('\n✅ Nessun dato modificato (solo simulazione)');
    
  } catch (error) {
    console.error('Errore simulazione: ' + error);
  }
}

function creaArchivioSingolo() {
  console.log('=== ARCHIVIAZIONE DIPENDENTE SINGOLO ===');
  
  const nomeDipendente = scegliDipendente();
  if (!nomeDipendente) {
    console.log('❌ Nessun dipendente selezionato');
    return { success: false };
  }
  
  console.log('👤 Archiviando: ' + nomeDipendente);
  return eseguiArchiviazione(nomeDipendente, 2024);
}

function eseguiArchiviazione(nomeDipendente, annoArchivio) {
  try {
    const spreadsheetOriginale = SpreadsheetApp.openById(SPREADSHEET_ID);
    const foglioOriginale = spreadsheetOriginale.getSheetByName(nomeDipendente);
    
    if (!foglioOriginale) {
      console.log('❌ Foglio ' + nomeDipendente + ' non trovato');
      return { success: false };
    }
    
    console.log('🔍 Analizzando foglio originale...');
    const datiOriginali = foglioOriginale.getDataRange().getValues();
    console.log('📊 Righe totali nel foglio originale: ' + datiOriginali.length);
    
    // Crea cartelle
    const cartellaBase = ottieniCreaCartella('Archivi Ore Lavorate');
    const cartellaAnno = ottieniCreaCartella(annoArchivio.toString(), cartellaBase);
    console.log('📁 Cartelle preparate');
    
    // Crea nuovo file archivio
    const nomeArchivio = annoArchivio + '_' + nomeDipendente.replace(/\s+/g, '_') + '_Archivio';
    const spreadsheetArchivio = SpreadsheetApp.create(nomeArchivio);
    console.log('📊 File archivio creato: ' + nomeArchivio);
    
    // Sposta in cartella
    const fileArchivio = DriveApp.getFileById(spreadsheetArchivio.getId());
    cartellaAnno.addFile(fileArchivio);
    DriveApp.getRootFolder().removeFile(fileArchivio);
    
    // Prepara foglio archivio
    const fogli = spreadsheetArchivio.getSheets();
    let foglioArchivio;
    
    if (fogli.length === 1 && fogli[0].getName() === 'Foglio1') {
      foglioArchivio = fogli[0];
      foglioArchivio.setName(nomeDipendente);
    } else {
      foglioArchivio = spreadsheetArchivio.insertSheet(nomeDipendente);
    }
    
    // COPIA MANUALE COMPLETA (più affidabile del copyTo)
    console.log('📋 Copiando dati manualmente...');
    
    // Copia tutti i valori
    const rangeOriginale = foglioOriginale.getDataRange();
    const valoriOriginali = rangeOriginale.getValues();
    
    if (valoriOriginali.length > 0) {
      // Assicurati che ci siano almeno 8 colonne
      const valoriPadded = valoriOriginali.map(function(riga) {
        const nuova = riga.slice();
        while (nuova.length < 8) {
          nuova.push('');
        }
        return nuova;
      });
      
      foglioArchivio.getRange(1, 1, valoriPadded.length, 8).setValues(valoriPadded);
      console.log('✅ Valori copiati: ' + valoriPadded.length + ' righe');
      
      // Prova a copiare la formattazione (se possibile)
      try {
        const headerRange = foglioOriginale.getRange('A1:H4');
        const headerTargetRange = foglioArchivio.getRange('A1:H4');
        
        // Copia formattazione header
        const backgrounds = headerRange.getBackgrounds();
        const fontWeights = headerRange.getFontWeights();
        const fontColors = headerRange.getFontColors();
        
        headerTargetRange.setBackgrounds(backgrounds);
        headerTargetRange.setFontWeights(fontWeights);
        headerTargetRange.setFontColors(fontColors);
        
        // Celle unite per dashboard
        if (foglioOriginale.getRange('F1:H1').isPartOfMerge()) {
          foglioArchivio.getRange('F1:H1').merge();
        }
        
        console.log('✅ Formattazione header copiata');
        
      } catch (formatError) {
        console.log('⚠️ Formattazione non copiata: ' + formatError);
      }
    } else {
      console.log('❌ Nessun dato trovato nel foglio originale');
      return { success: false, messaggio: 'Foglio vuoto' };
    }
    
    // Verifica che l'archivio non sia vuoto
    const datiArchivio = foglioArchivio.getDataRange().getValues();
    console.log('📊 Righe copiate nell\'archivio: ' + datiArchivio.length);
    
    if (datiArchivio.length < 5) {
      console.log('❌ Archivio sembra vuoto dopo la copia');
      return { success: false, messaggio: 'Errore nella copia' };
    }
    
    // Snellisci archivio (mantieni solo anno specificato)
    console.log('✂️ Snellendo archivio (mantieni solo ' + annoArchivio + ')...');
    const statsArchivio = snellisciFoglioMigliorato(foglioArchivio, annoArchivio, 'mantieni');
    
    console.log('📊 Dopo snellimento archivio: ' + statsArchivio.righeFinali + ' righe dati, ' + statsArchivio.oreTotali + ' ore');
    
    // Snellisci originale (rimuovi anno archiviato) - SOLO SE archivio ha dati
    if (statsArchivio.righeFinali > 0) {
      console.log('✂️ Snellendo originale (rimuovi ' + annoArchivio + ')...');
      const statsOriginale = snellisciFoglioMigliorato(foglioOriginale, annoArchivio, 'rimuovi');
      console.log('📊 Dopo snellimento originale: ' + statsOriginale.righeFinali + ' righe dati rimaste');
    } else {
      console.log('⚠️ Nessun dato ' + annoArchivio + ' trovato, originale non modificato');
    }
    
    // Aggiungi riepilogo e crea PDF solo se ci sono dati
    if (statsArchivio.righeFinali > 0) {
      aggiungiRiepilogo(foglioArchivio, annoArchivio, nomeDipendente, statsArchivio);
      console.log('📋 Riepilogo aggiunto');
      
      // Crea PDF
      try {
        console.log('📄 Creando PDF...');
        Utilities.sleep(3000); // Aspetta di più per sincronizzazione
        
        const pdfBlob = spreadsheetArchivio.getAs('application/pdf');
        const nomePdf = annoArchivio + '_' + nomeDipendente.replace(/\s+/g, '_') + '_Riepilogo.pdf';
        const pdfFile = cartellaAnno.createFile(pdfBlob.setName(nomePdf));
        
        console.log('✅ PDF creato: ' + nomePdf);
        
        return {
          success: true,
          excelUrl: fileArchivio.getUrl(),
          pdfUrl: pdfFile.getUrl(),
          datiArchiviati: statsArchivio.righeFinali,
          oreTotali: statsArchivio.oreTotali,
          pdfCreato: true
        };
        
      } catch (pdfError) {
        console.log('⚠️ Errore PDF: ' + pdfError);
        
        return {
          success: true,
          excelUrl: fileArchivio.getUrl(),
          datiArchiviati: statsArchivio.righeFinali,
          oreTotali: statsArchivio.oreTotali,
          pdfCreato: false,
          pdfError: pdfError.toString()
        };
      }
    } else {
      return {
        success: true,
        excelUrl: fileArchivio.getUrl(),
        datiArchiviati: 0,
        messaggio: 'Archivio creato ma nessun dato ' + annoArchivio + ' trovato'
      };
    }
    
  } catch (error) {
    console.error('❌ Errore generale: ' + error);
    return { success: false, error: error.toString() };
  }
}

function snellisciFoglioMigliorato(foglio, anno, azione) {
  console.log('🔍 Iniziando snellimento: ' + azione + ' anno ' + anno);
  
  const datiCompleti = foglio.getDataRange().getValues();
  console.log('📊 Righe totali prima dello snellimento: ' + datiCompleti.length);
  
  const righeFinali = [];
  let righeProcessate = 0;
  let oreTotali = 0;
  let righeRimosse = 0;
  
  for (let i = 0; i < datiCompleti.length; i++) {
    const riga = datiCompleti[i];
    
    // MANTIENI SEMPRE header (righe 1-4)
    if (i < 4) {
      righeFinali.push(riga);
      console.log('📋 Header riga ' + (i + 1) + ': mantenuta');
      continue;
    }
    
    const data = riga[0];
    const ore = riga[3];
    let mantieni = false;
    
    if (data && data instanceof Date) {
      const annoRiga = data.getFullYear();
      console.log('📅 Riga ' + (i + 1) + ': ' + data.toLocaleDateString('it-IT') + ' (anno ' + annoRiga + ')');
      
      if (azione === 'mantieni') {
        mantieni = (annoRiga === anno);
        if (mantieni) {
          console.log('   ✅ MANTIENI (anno target)');
        } else {
          console.log('   ❌ RIMUOVI (anno diverso)');
          righeRimosse++;
        }
      } else { // 'rimuovi'
        mantieni = (annoRiga !== anno);
        if (mantieni) {
          console.log('   ✅ MANTIENI (anno diverso da target)');
        } else {
          console.log('   🗑️ RIMUOVI (anno target)');
          righeRimosse++;
        }
      }
      
      if (mantieni) {
        righeFinali.push(riga);
        righeProcessate++;
        
        if (ore && typeof ore === 'number') {
          oreTotali += ore;
        }
      }
    } else if (data && data.toString().trim() !== '') {
      // Mantieni righe con dati non vuoti ma non date
      righeFinali.push(riga);
      console.log('📝 Riga ' + (i + 1) + ': dato non-data mantenuto');
    } else {
      console.log('📝 Riga ' + (i + 1) + ': vuota, saltata');
    }
  }
  
  console.log('📊 Risultato snellimento:');
  console.log('   Righe finali totali: ' + righeFinali.length);
  console.log('   Righe dati processate: ' + righeProcessate);
  console.log('   Righe rimosse: ' + righeRimosse);
  console.log('   Ore totali: ' + oreTotali);
  
  // Aggiorna foglio preservando formattazione
  if (righeFinali.length !== datiCompleti.length) {
    console.log('💾 Aggiornando foglio...');
    
    const maxCols = 8; // Forza 8 colonne
    
    const righeConPadding = righeFinali.map(function(riga) {
      const nuova = riga.slice();
      while (nuova.length < maxCols) {
        nuova.push('');
      }
      return nuova;
    });
    
    // Prima: sovrascrivi con i dati corretti
    if (righeConPadding.length > 0) {
      console.log('📝 Scrivendo ' + righeConPadding.length + ' righe...');
      foglio.getRange(1, 1, righeConPadding.length, maxCols).setValues(righeConPadding);
    }
    
    // Poi: elimina righe in eccesso SE necessario
    const righeTotaliAttuali = foglio.getLastRow();
    if (righeTotaliAttuali > righeConPadding.length) {
      const daEliminare = righeTotaliAttuali - righeConPadding.length;
      console.log('🗑️ Eliminando ' + daEliminare + ' righe in eccesso...');
      foglio.deleteRows(righeConPadding.length + 1, daEliminare);
    }
    
    console.log('✅ Foglio aggiornato con successo');
  } else {
    console.log('ℹ️ Nessuna modifica necessaria al foglio');
  }
  
  return {
    righeFinali: righeProcessate,
    oreTotali: oreTotali,
    righeRimosse: righeRimosse
  };
}

function aggiungiRiepilogo(foglio, anno, dipendente, statistiche) {
  try {
    const ultimaRiga = foglio.getLastRow() + 2;
    
    foglio.getRange(ultimaRiga, 1, 1, 4).merge();
    foglio.getRange(ultimaRiga, 1).setValue('📊 ARCHIVIO ' + anno + ' - ' + dipendente.toUpperCase());
    foglio.getRange(ultimaRiga, 1).setFontSize(16);
    foglio.getRange(ultimaRiga, 1).setFontWeight('bold');
    foglio.getRange(ultimaRiga, 1).setHorizontalAlignment('center');
    foglio.getRange(ultimaRiga, 1).setBackground('#1f4e79');
    foglio.getRange(ultimaRiga, 1).setFontColor('#ffffff');
    
    foglio.getRange(ultimaRiga + 2, 1).setValue('👤 Dipendente:');
    foglio.getRange(ultimaRiga + 2, 2).setValue(dipendente);
    foglio.getRange(ultimaRiga + 3, 1).setValue('📅 Anno:');
    foglio.getRange(ultimaRiga + 3, 2).setValue(anno);
    foglio.getRange(ultimaRiga + 4, 1).setValue('📝 Inserimenti:');
    foglio.getRange(ultimaRiga + 4, 2).setValue(statistiche.righeFinali);
    foglio.getRange(ultimaRiga + 5, 1).setValue('⏰ Ore totali:');
    foglio.getRange(ultimaRiga + 5, 2).setValue(statistiche.oreTotali + ' ore');
    foglio.getRange(ultimaRiga + 6, 1).setValue('📁 Data:');
    foglio.getRange(ultimaRiga + 6, 2).setValue(new Date().toLocaleDateString('it-IT'));
    
    const rangeEtichette = foglio.getRange(ultimaRiga + 2, 1, 5, 1);
    rangeEtichette.setFontWeight('bold');
    rangeEtichette.setFontColor('#1f4e79');
    
  } catch (error) {
    console.log('Errore riepilogo: ' + error);
  }
}

function archiviaPerTutti() {
  console.log('=== ARCHIVIAZIONE MULTIPLA ===');
  
  const dipendenti = rilevaDipendenti();
  console.log('🔄 Archiviando ' + dipendenti.length + ' dipendenti');
  
  const risultati = [];
  
  dipendenti.forEach(nomeDipendente => {
    console.log('\n👤 Archiviando: ' + nomeDipendente);
    
    try {
      const risultato = eseguiArchiviazione(nomeDipendente, 2024);
      risultati.push({
        dipendente: nomeDipendente,
        success: risultato.success,
        datiArchiviati: risultato.datiArchiviati || 0,
        oreTotali: risultato.oreTotali || 0
      });
      
    } catch (error) {
      console.error('❌ Errore ' + nomeDipendente + ': ' + error);
      risultati.push({
        dipendente: nomeDipendente,
        success: false,
        errore: error.toString()
      });
    }
  });
  
  // Riepilogo
  let messaggio = '📊 RIEPILOGO ARCHIVIAZIONE:\n\n';
  let totaleArchiviati = 0;
  let totaleOre = 0;
  
  risultati.forEach(r => {
    if (r.success) {
      messaggio += '✅ ' + r.dipendente + ': ' + r.datiArchiviati + ' righe, ' + r.oreTotali + ' ore\n';
      totaleArchiviati += r.datiArchiviati;
      totaleOre += r.oreTotali;
    } else {
      messaggio += '❌ ' + r.dipendente + ': Errore\n';
    }
  });
  
  messaggio += '\n📊 TOTALI: ' + totaleArchiviati + ' righe, ' + totaleOre + ' ore archiviate';
  
  console.log(messaggio);
  SpreadsheetApp.getUi().alert(messaggio);
  
  return risultati;
}

function ottieniCreaCartella(nomeCartella, cartellaPadre) {
  const cartelle = cartellaPadre ? 
    cartellaPadre.getFoldersByName(nomeCartella) : 
    DriveApp.getFoldersByName(nomeCartella);
  
  if (cartelle.hasNext()) {
    return cartelle.next();
  } else {
    return cartellaPadre ? 
      cartellaPadre.createFolder(nomeCartella) : 
      DriveApp.createFolder(nomeCartella);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📄 Archivio Dipendenti')
    .addItem('🔍 Simulazione Completa', 'simulaArchiviazione')
    .addSeparator()
    .addItem('👤 Scegli Dipendente', 'creaArchivioSingolo')
    .addItem('🔄 Tutti i Dipendenti', 'archiviaPerTutti')
    .addToUi();
}
