// Vercel Serverless Function - Proxy per Google Apps Script
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

  // URL del tuo Google Apps Script
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWenT-EwL6B3YsKcveDnuSC8UMdj-d8AMRNO4xYJ2FtC-ENEP7b9LqVbHRt_CCoQknGw/exec';

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

    console.log('Proxy request:', requestData);

    // Prepara i dati per Google Apps Script
    const formData = new URLSearchParams();
    formData.append('data', JSON.stringify(requestData));

    // Chiama Google Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status}`);
    }

    // Ottieni la risposta
    let result = await response.text();
    
    // Pulisci la risposta da eventuali prefissi di sicurezza di Google
    result = result.replace(/^\)\]\}',?\s*/, '');

    // Parse JSON
    const jsonResult = JSON.parse(result);

    // Ritorna la risposta con headers CORS
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Errore del proxy server',
      error: error.message
    });
  }
}
