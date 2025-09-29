<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Sistema Gestione Ore</title>
    
    <!-- CSS Framework e Icone -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    
    <style>
        /* ===== RESET E BASE ===== */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            font-size: 14px;
            line-height: 1.5;
        }
        
        /* ===== HEADER ADMIN ===== */
        .admin-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 15px 20px;
            box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .admin-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 18px;
            font-weight: 700;
            color: #4f46e5;
        }
        
        .admin-title i {
            font-size: 20px;
        }
        
        .admin-info {
            display: flex;
            align-items: center;
            gap: 15px;
            font-size: 13px;
        }
        
        .user-badge {
            background: #4f46e5;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-weight: 600;
        }
        
        .logout-btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .logout-btn:hover {
            background: #dc2626;
            transform: translateY(-1px);
        }
        
        /* ===== CONTAINER PRINCIPALE ===== */
        .admin-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            display: grid;
            gap: 25px;
        }
        
        /* ===== SEZIONI ===== */
        .admin-section {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .section-title i {
            color: #4f46e5;
        }
        
        /* ===== TOGGLE MODALITÀ CANTIERI ===== */
        .toggle-container {
            display: flex;
            background: #f3f4f6;
            border-radius: 12px;
            padding: 4px;
            position: relative;
        }
        
        .toggle-option {
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            white-space: nowrap;
        }
        
        .toggle-option.active {
            background: #4f46e5;
            color: white;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
        }
        
        /* ===== GRID CANTIERI ===== */
        .cantieri-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .cantiere-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        
        .cantiere-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            border-color: #4f46e5;
        }
        
        .cantiere-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
        }
        
        .cantiere-id {
            font-size: 12px;
            font-weight: 700;
            color: #4f46e5;
            background: rgba(79, 70, 229, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 8px;
        }
        
        .cantiere-nome {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
            line-height: 1.3;
        }
        
        .cantiere-ore {
            font-size: 24px;
            font-weight: 800;
            color: #059669;
            margin: 10px 0;
        }
        
        .cantiere-ore .label {
            font-size: 12px;
            font-weight: 500;
            color: #6b7280;
            display: block;
        }
        
        .cantiere-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #6b7280;
        }
        
        .stato-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-secondary { background: #f3f4f6; color: #374151; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        
        /* ===== SEZIONE DIPENDENTI ===== */
        .dipendenti-controls {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .select-dipendente {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-size: 14px;
            background: white;
            transition: all 0.3s;
            cursor: pointer;
        }
        
        .select-dipendente:focus {
            outline: none;
            border-color: #4f46e5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        
        .timeframe-tabs {
            display: flex;
            background: #f3f4f6;
            border-radius: 12px;
            padding: 4px;
            overflow-x: auto;
        }
        
        .timeframe-tab {
            flex: 1;
            padding: 10px 12px;
            text-align: center;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            white-space: nowrap;
        }
        
        .timeframe-tab.active {
            background: #4f46e5;
            color: white;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
        }
        
        /* ===== GRAFICO E STATS ===== */
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
            background: white;
            border-radius: 12px;
            padding: 15px;
        }
        
        .stats-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 800;
            color: #1f2937;
            display: block;
        }
        
        .stat-label {
            font-size: 11px;
            color: #6b7280;
            font-weight: 500;
            margin-top: 4px;
        }
        
        /* ===== LOADING E STATI ===== */
        .loading-spinner {
            border: 3px solid #f3f4f6;
            border-top: 3px solid #4f46e5;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .admin-loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .admin-loading-content {
            background: white;
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .no-data-state {
            text-align: center;
            padding: 40px 20px;
            color: #6b7280;
        }
        
        .no-data-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        /* ===== RESPONSIVE MOBILE-FIRST ===== */
        @media (max-width: 768px) {
            .admin-header {
                padding: 12px 15px;
            }
            
            .header-content {
                flex-direction: column;
                gap: 10px;
                align-items: flex-start;
            }
            
            .admin-info {
                width: 100%;
                justify-content: space-between;
            }
            
            .admin-container {
                padding: 15px;
                gap: 20px;
            }
            
            .admin-section {
                padding: 20px 15px;
            }
            
            .section-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 15px;
            }
            
            .toggle-container,
            .timeframe-tabs {
                width: 100%;
            }
            
            .cantieri-grid {
                grid-template-columns: 1fr;
            }
            
            .chart-container {
                height: 250px;
                padding: 10px;
            }
            
            .stats-summary {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .dipendenti-controls {
                gap: 12px;
            }
        }
        
        @media (max-width: 480px) {
            .admin-title {
                font-size: 16px;
            }
            
            .section-title {
                font-size: 18px;
            }
            
            .cantiere-card {
                padding: 15px;
            }
            
            .chart-container {
                height: 220px;
            }
        }
        
        /* ===== ANIMAZIONI ===== */
        .fade-in {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .slide-in {
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from { transform: translateX(-20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        /* ===== REFRESH BUTTON ===== */
        .refresh-btn {
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            transition: all 0.2s;
            color: #6b7280;
        }
        
        .refresh-btn:hover {
            background: #e5e7eb;
            transform: rotate(180deg);
        }
        
        .refresh-btn i {
            font-size: 14px;
        }
    </style>
</head>

<body>
    <!-- Header Admin -->
    <header class="admin-header">
        <div class="header-content">
            <div class="admin-title">
                <i class="fas fa-user-shield"></i>
                <span>Dashboard Amministratore</span>
            </div>
            <div class="admin-info">
                <div class="user-badge" id="adminUser">
                    <i class="fas fa-user"></i>
                    <span id="adminName">Caricamento...</span>
                </div>
                <button class="logout-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Esci</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Container Principale -->
    <div class="admin-container">
        
        <!-- Sezione Cantieri -->
        <section class="admin-section fade-in">
            <div class="section-header">
                <h2 class="section-title">
                    <i class="fas fa-building"></i>
                    Panoramica Cantieri
                </h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="refresh-btn" onclick="refreshCantieri()" title="Aggiorna dati">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <div class="toggle-container">
                        <div class="toggle-option active" data-mode="totali">
                            Totali Assoluti
                        </div>
                        <div class="toggle-option" data-mode="mese">
                            Mese Corrente
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="cantieriGrid" class="cantieri-grid">
                <!-- Cards cantieri caricate dinamicamente -->
                <div class="loading-spinner"></div>
            </div>
        </section>

        <!-- Sezione Dipendenti -->
        <section class="admin-section fade-in">
            <div class="section-header">
                <h2 class="section-title">
                    <i class="fas fa-users"></i>
                    Timeline Dipendenti
                </h2>
                <button class="refresh-btn" onclick="refreshDipendenti()" title="Aggiorna dati">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            
            <div class="dipendenti-controls">
                <select class="select-dipendente" id="dipendentiSelect">
                    <option value="">Seleziona un dipendente...</option>
                </select>
                
                <div class="timeframe-tabs">
                    <div class="timeframe-tab active" data-timeframe="30days">
                        Ultimi 30 Giorni
                    </div>
                    <div class="timeframe-tab" data-timeframe="lastMonth">
                        Mese Precedente
                    </div>
                    <div class="timeframe-tab" data-timeframe="year">
                        Anno Corrente
                    </div>
                </div>
            </div>
            
            <div class="chart-container">
                <canvas id="timelineChart"></canvas>
            </div>
            
            <div class="stats-summary" id="statsContainer">
                <!-- Stats caricate dinamicamente -->
            </div>
        </section>
    </div>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="admin-loading-overlay" style="display: none;">
        <div class="admin-loading-content">
            <div class="loading-spinner"></div>
            <p style="margin-top: 15px; color: #6b7280;">Caricamento dati...</p>
        </div>
    </div>

    <!-- Scripts -->
    <script src="config.js"></script>
    <script>
        'use strict';

        // ============================ VARIABILI GLOBALI ============================
        let currentCantieriMode = 'totali';
        let currentTimeframe = '30days';
        let currentUserId = null;
        let timelineChart = null;
        let autoRefreshInterval = null;
        
        // CACHE GLOBALE PER TIMELINE - mantiene i dati completi dell'anno
        let timelineDataCache = {};

        // ============================ INIZIALIZZAZIONE ============================
        document.addEventListener('DOMContentLoaded', async function() {
            Utils.adminLog('Admin panel loading...');
            
            try {
                // Verifica accesso admin
                const hasAccess = await Utils.checkAdminAccess();
                if (!hasAccess) return;
                
                // Inizializza UI
                await initializeAdminPanel();
                
                // Setup event listeners
                setupEventListeners();
                
                // Carica dati iniziali
                await loadInitialData();
                
                // Setup auto-refresh
                setupAutoRefresh();
                
                Utils.adminLog('Admin panel loaded successfully');
                
            } catch (error) {
                console.error('Errore inizializzazione admin panel:', error);
                Utils.showNotification('Errore caricamento dashboard amministratore', 'error');
            }
        });

        // ============================ INIZIALIZZAZIONE UI ============================
        async function initializeAdminPanel() {
            // Mostra info admin nell'header
            const sessionData = Utils.getSession();
            if (sessionData && sessionData.userData) {
                document.getElementById('adminName').textContent = sessionData.userData.name;
            }
            
            // Inizializza layout responsive
            Utils.handleResponsiveResize(handleLayoutChange);
        }

        // ============================ EVENT LISTENERS ============================
        function setupEventListeners() {
            // Toggle modalità cantieri
            document.querySelectorAll('.toggle-option').forEach(option => {
                option.addEventListener('click', async function() {
                    if (this.classList.contains('active')) return;
                    
                    // Update UI
                    document.querySelectorAll('.toggle-option').forEach(opt => opt.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update mode and reload
                    currentCantieriMode = this.dataset.mode;
                    await loadCantieri();
                });
            });
            
            // Selezione dipendente
            document.getElementById('dipendentiSelect').addEventListener('change', async function() {
                const newUserId = this.value;
                
                if (newUserId) {
                    currentUserId = newUserId;
                    await loadDipendenteTimeline(currentUserId, currentTimeframe);
                } else {
                    currentUserId = null;
                    clearTimelineChart();
                }
            });
            
            // Tabs timeframe
            document.querySelectorAll('.timeframe-tab').forEach(tab => {
                tab.addEventListener('click', async function() {
                    if (this.classList.contains('active')) return;
                    
                    // Update UI
                    document.querySelectorAll('.timeframe-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update timeframe and reload
                    currentTimeframe = this.dataset.timeframe;
                    if (currentUserId) {
                        await loadDipendenteTimeline(currentUserId, currentTimeframe);
                    }
                });
            });
        }

        // ============================ CARICAMENTO DATI ============================
        async function loadInitialData() {
            try {
                // Carica cantieri e dipendenti in parallelo
                await Promise.all([
                    loadCantieri(),
                    loadDipendenti()
                ]);
                
            } catch (error) {
                console.error('Errore caricamento dati iniziali:', error);
                Utils.showNotification('Errore caricamento dati', 'error');
            }
        }

        async function loadCantieri() {
            const startTime = Date.now();
            
            try {
                Utils.adminLog('Loading cantieri, mode:', currentCantieriMode);
                
                const cantieri = await Utils.loadCantieriOverview(currentCantieriMode);
                renderCantieriGrid(cantieri);
                
                Utils.logAdminPerformance('loadCantieri', startTime);
                
            } catch (error) {
                console.error('Errore caricamento cantieri:', error);
                showCantieriError();
            }
        }

        async function loadDipendenti() {
            try {
                Utils.adminLog('Loading dipendenti list');
                
                const dipendenti = await Utils.loadDipendentiList();
                renderDipendentiSelect(dipendenti);
                
            } catch (error) {
                console.error('Errore caricamento dipendenti:', error);
                showDipendentiError();
            }
        }

        // ============================ GESTIONE TIMELINE CON CACHE ============================
        async function loadDipendenteTimeline(userId, timeframe) {
            try {
                Utils.adminLog('Loading timeline for user:', userId, 'timeframe:', timeframe);
                
                // Se non abbiamo i dati cached per questo utente, caricali
                if (!timelineDataCache[userId]) {
                    showLoading();
                    
                    // Carica TUTTI i dati dell'anno corrente (timeframe più ampio)
                    const result = await Utils.loadDipendenteTimeline(userId, 'year');
                    
                    // result È GIÀ result.data dal config.js
                    if (!result || !result.timeline) {
                        throw new Error('Dati timeline non disponibili');
                    }
                    
                    // Salva in cache i dati RAW completi
                    timelineDataCache[userId] = {
                        rawTimeline: result.timeline,
                        fullData: result
                    };
                    
                    hideLoading();
                    Utils.adminLog('Timeline data cached for user:', userId);
                }
                
                // Filtra i dati cached in base al timeframe selezionato
                const filteredData = filterTimelineByTimeframe(
                    timelineDataCache[userId].rawTimeline, 
                    timeframe
                );
                
                // Prepara i dati per il grafico e le stats
                const processedData = processFilteredTimeline(filteredData, timeframe);
                
                // Aggiorna UI
                updateTimelineChart(processedData, timeframe);
                updateStats(processedData);
                
                Utils.adminLog('Timeline updated successfully');
                
            } catch (error) {
                console.error('Errore caricamento timeline:', error);
                showTimelineError();
                hideLoading();
            }
        }

        // ============================ FILTRO TIMELINE ============================
        function filterTimelineByTimeframe(timelineData, timeframe) {
            const oggi = new Date();
            let dataInizio, dataFine;
            
            switch (timeframe) {
                case '30days':
                    dataInizio = new Date(oggi);
                    dataInizio.setDate(oggi.getDate() - 30);
                    dataFine = oggi;
                    break;
                    
                case 'lastMonth':
                    // Primo giorno del mese precedente
                    dataInizio = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
                    // Ultimo giorno del mese precedente
                    dataFine = new Date(oggi.getFullYear(), oggi.getMonth(), 0);
                    break;
                    
                case 'year':
                    // Primo giorno dell'anno corrente
                    dataInizio = new Date(oggi.getFullYear(), 0, 1);
                    dataFine = oggi;
                    break;
                    
                default:
                    // Default: ultimi 30 giorni
                    dataInizio = new Date(oggi);
                    dataInizio.setDate(oggi.getDate() - 30);
                    dataFine = oggi;
            }
            
            return filterByDateRange(timelineData, dataInizio, dataFine);
        }

        function filterByDateRange(timelineData, dataInizio, dataFine) {
            if (!Array.isArray(timelineData)) {
                console.error('Timeline data is not an array:', timelineData);
                return [];
            }
            
            return timelineData.filter(entry => {
                if (!entry || !entry.data) return false;
                
                const entryDate = new Date(entry.data);
                return entryDate >= dataInizio && entryDate <= dataFine;
            });
        }

        // ============================ PROCESSING DATI FILTRATI ============================
        function processFilteredTimeline(filteredData, timeframe) {
            // Calcola statistiche sui dati filtrati
            let totaleOre = 0;
            const cantieriSet = new Set();
            const giorniMap = new Map();
            
            filteredData.forEach(entry => {
                if (entry.ore) {
                    totaleOre += parseFloat(entry.ore) || 0;
                }
                if (entry.cantiereId) {
                    cantieriSet.add(entry.cantiereId);
                }
                if (entry.data) {
                    giorniMap.set(entry.data, true);
                }
            });
            
            const giornateLavorate = giorniMap.size;
            const cantieriCoinvolti = Array.from(cantieriSet);
            
            return {
                timeline: filteredData,
                totaleOre: totaleOre,
                giornateLavorate: giornateLavorate,
                cantieriCoinvolti: cantieriCoinvolti,
                mediaGiornaliera: giornateLavorate > 0 ? (totaleOre / giornateLavorate) : 0
            };
        }

        // ============================ RENDERING UI ============================
        function renderCantieriGrid(cantieri) {
            const grid = document.getElementById('cantieriGrid');
            
            if (!cantieri || cantieri.length === 0) {
                grid.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon"><i class="fas fa-building"></i></div>
                        <p>Nessun cantiere trovato</p>
                    </div>
                `;
                return;
            }
            
            grid.innerHTML = cantieri.map(cantiere => `
                <div class="cantiere-card slide-in" onclick="showCantiereDetails('${cantiere.id}')">
                    <div class="cantiere-id">${cantiere.id}</div>
                    <div class="cantiere-nome">${Utils.truncateText(cantiere.nome, 30)}</div>
                    <div class="cantiere-ore">
                        <span class="label">Ore ${currentCantieriMode === 'mese' ? 'Mese' : 'Totali'}</span>
                        ${Utils.formatOre(cantiere.oreTotali)}
                    </div>
                    <div class="cantiere-meta">
