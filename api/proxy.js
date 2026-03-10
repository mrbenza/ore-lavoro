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

  const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

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

    // GAS non gestisce correttamente POST con redirect (body perso) — sempre GET
    const url = new URL(APPS_SCRIPT_URL);
    Object.keys(requestData).forEach(key => {
      const value = requestData[key];
      url.searchParams.append(key, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
    });

    console.log('URL finale chiamata:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'Vercel-Proxy/1.0' }
    });

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
