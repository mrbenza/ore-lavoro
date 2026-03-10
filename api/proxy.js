// Vercel Serverless Function - Proxy CORRETTO per Google Apps Script
// File: api/proxy.js

export default async function handler(req, res) {
  // Abilita CORS per tutti i domini
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestione preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 🔧 AGGIORNA CON IL TUO URL GOOGLE APPS SCRIPT
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_V1D0gphXNlXMsjT1Yp88zDXLkISole8K-KcXJtV9GVdfILSLKRWHDq4ytS4f-5ylKA/exec';

  try {
    let requestData;

    // Estrai i dati dalla richiesta
    if (req.method === 'POST') {
      requestData = req.body;
    } else if (req.method === 'GET') {
      requestData = req.query;
    } else {
      return res.status(405).json({ success: false, message: 'Metodo non supportato' });
    }

    console.log('Proxy request ricevuta:', requestData);

    // Operazioni di scrittura: inoltrate come POST a GAS (dati nel body, non in URL)
    // Operazioni di lettura: inoltrate come GET a GAS (query string, più affidabile)
    const WRITE_ACTIONS = new Set([
      'saveWorkEntry', 'updateWorkEntry', 'deleteWorkEntry',
      'cambiaPassword', 'cambiaPasswordUtente', 'creaUtente',
      'aggiornaStatoUtente', 'updateCantiereStato',
      'ricalcolaCantieri', 'invalidateCache', 'forzaAggregazione'
    ]);

    const isWrite = WRITE_ACTIONS.has(requestData.action);

    let response;

    if (isWrite) {
      // POST a GAS: body in formato application/x-www-form-urlencoded con chiave 'data'
      // (formato atteso da doPost in ApiRouter.gs righe 386-389)
      const body = 'data=' + encodeURIComponent(JSON.stringify(requestData));
      console.log('Inoltro come POST (azione di scrittura):', requestData.action);
      response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Vercel-Proxy/1.0',
        },
        body: body
      });
    } else {
      // GET a GAS: parametri in query string
      const url = new URL(APPS_SCRIPT_URL);
      Object.keys(requestData).forEach(key => {
        const value = requestData[key];
        url.searchParams.append(key, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
      });
      console.log('Inoltro come GET (azione di lettura):', requestData.action);
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'User-Agent': 'Vercel-Proxy/1.0' }
      });
    }

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status} ${response.statusText}`);
    }

    // Ottieni la risposta
    let result = await response.text();
    
    // Pulisci la risposta da eventuali prefissi di sicurezza di Google
    result = result.replace(/^\)\]\}',?\s*/, '');

    // Parse JSON
    let jsonResult;
    try {
      jsonResult = JSON.parse(result);
    } catch (parseError) {
      console.error('Errore parsing JSON:', parseError);
      console.error('Raw response:', result);
      throw new Error('Risposta non JSON valida da Google Apps Script');
    }

    console.log('Proxy response:', jsonResult);

    // Ritorna la risposta con headers CORS
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Errore del proxy server',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
