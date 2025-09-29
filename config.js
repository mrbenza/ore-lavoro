// Configurazione Sistema Gestione Ore V2.2 - PRODUCTION MODE - CORS FIXED
const CONFIG = {
    // 🔧 PROXY VERCEL - URL RELATIVO (CORS gestito)
    APPS_SCRIPT_URL: '/api/proxy',
 
    // 🔧 MODALITÀ PRODUZIONE
    PRODUCTION_MODE: true,  // 🚀 CAMBIA A TRUE PER PRODUZIONE
    
    // Versioning V2.2
    VERSION: {
        frontend: '2.2.0',
        buildDate: '2025-09-07',
        description: 'Dashboard semplificata - UI pulita e focalizzata'
    },
    
    // Pagine del sistema
    PAGES: {
        LOGIN: 'index.html',
        DASHBOARD: 'dashboard.html',
        ADMIN: 'admin.html'
    },
    
    // Impostazioni UI V2.2 - Layout Semplificato
    UI: {
        NOTIFICATION_DURATION: 4000,
        LOADING_MIN_TIME: 1000,
        AUTO_LOGOUT_TIME: 30 * 60 * 1000, // 30 minuti
        SHOW_AUTH_METHOD: false, // 🔧 NASCOSTO IN PRODUZIONE
        SHOW_DEBUG_INFO: false,   // 🔧 NASCOSTO IN PRODUZIONE
        SHOW_SECURITY_STATUS: false, // 🆕 V2.2 - Box sicurezza rimosso
        SHOW_DERIVED_STATS: false   // 🆕 V2.2 - Statistiche derivate rimosse
    },
    
    // Validazione
    VALIDATION: {
        MAX_HOURS_PER_DAY: 24,
        MIN_HOURS: 0,
        MAX_WORK_DESCRIPTION: 500,
        MAX_NOTES: 200,
        MIN_PASSWORD_LENGTH: 4
    },
    
    // Debug e sicurezza - OTTIMIZZATO PER PRODUZIONE
    DEBUG: false,              // 🔧 FALSE IN PRODUZIONE
    SECURITY: {
        HASH_ENABLED: true,
        AUTO_MIGRATION: true,
        SESSION_TIMEOUT: true,
        LOG_AUTH_ATTEMPTS: false  // 🔧 PRIVACY IN PRODUZIONE
    },
    
    // 🆕 CONFIGURAZIONE LOGGING FRONTEND V2.2
    LOGGING: {
        CONSOLE_LOGS: false,      // 🔧 DISABILITA CONSOLE.LOG IN PRODUZIONE
        ERROR_LOGS: true,         // Mantieni log errori per troubleshooting
        AUTH_LOGS: false,         // 🔧 DISABILITA LOG AUTH PER PRIVACY
        API_LOGS: false,          // 🔧 DISABILITA LOG API CALLS
        PERFORMANCE_LOGS: false   // 🔧 DISABILITA LOG PERFORMANCE
    }
};

// ===== SISTEMA LOGGING OTTIMIZZATO PER PRODUZIONE =====
const ProductionLogger = {
    log: function(...args) {
        if (CONFIG.LOGGING.CONSOLE_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[APP]', ...args);
        }
    },
    
    error: function(...args) {
        if (CONFIG.LOGGING.ERROR_LOGS) {
            console.error('[ERROR]', ...args);
        }
    },
    
    warn: function(...args) {
        if (CONFIG.LOGGING.ERROR_LOGS) {
            console.warn('[WARN]', ...args);
        }
    },
    
    auth: function(...args) {
        if (CONFIG.LOGGING.AUTH_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[AUTH]', ...args);
        }
    },
    
    api: function(...args) {
        if (CONFIG.LOGGING.API_CALLS && !CONFIG.PRODUCTION_MODE) {
            console.log('[API]', ...args);
        }
    },
    
    performance: function(...args) {
        if (CONFIG.LOGGING.PERFORMANCE_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[PERF]', ...args);
        }
    },
    
    // Solo per debug interno - mai in produzione
    debug: function(...args) {
        if (CONFIG.DEBUG && !CONFIG.PRODUCTION_MODE) {
            console.log('[DEBUG]', ...args);
        }
    }
};

// Funzioni di utilità comuni V2.2 - PRODUCTION OPTIMIZED + CORS FIXED + ADMIN
const Utils = {
    // ✅ Gestione chiamate API FIXED per URL relativi
    async callAPI(params) {
        ProductionLogger.api('API Call:', params.action);
        
        // 🔧 FIX: Gestione corretta URL relativi
        let targetUrl;
        if (CONFIG.APPS_SCRIPT_URL.startsWith('http')) {
            // URL assoluto (sviluppo)
            targetUrl = new URL(CONFIG.APPS_SCRIPT_URL);
        } else {
            // URL relativo (produzione con proxy)
            targetUrl = new URL(CONFIG.APPS_SCRIPT_URL, window.location.origin);
        }
        
        // Gestione parametri con serializzazione JSON per oggetti complessi
        Object.keys(params).forEach(key => {
            const value = params[key];
            
            if (typeof value === 'object' && value !== null) {
                ProductionLogger.debug(`Serializzando oggetto ${key}:`, value);
                targetUrl.searchParams.append(key, JSON.stringify(value));
            } else {
                targetUrl.searchParams.append(key, String(value));
            }
        });
        
        ProductionLogger.debug('URL finale:', targetUrl.toString());
        
        try {
            const response = await fetch(targetUrl.toString(), { method: 'GET' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const cleanText = text.replace(/^\)\]\}',?\s*/, '');
            const result = JSON.parse(cleanText);
            
            ProductionLogger.api('API Response per:', params.action, result.success ? 'SUCCESS' : 'FAILED');
            
            // Log informazioni sicurezza solo se non in produzione
            if (!CONFIG.PRODUCTION_MODE && result.systemInfo) {
                ProductionLogger.auth('Auth Method:', result.systemInfo.authMethod);
                ProductionLogger.auth('Hash Support:', result.systemInfo.hashSupport);
                ProductionLogger.auth('Backend Version:', result.systemInfo.version);
            }
            
            return result;
            
        } catch (error) {
            ProductionLogger.error('API Call failed per:', params.action, error.message);
            throw error;
        }
    },
    
    // Gestione sessione V2.2 - Production
    getSession() {
        return {
            user: JSON.parse(sessionStorage.getItem('currentUser') || 'null'),
            token: sessionStorage.getItem('sessionToken')
        };
    },
    
    setSession(user, token) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        sessionStorage.setItem('sessionToken', token);
        
        ProductionLogger.auth('Sessione salvata per utente:', user.name);
    },
    
    clearSession() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
        ProductionLogger.auth('Sessione cancellata');
    },
    
    isLoggedIn() {
        const session = this.getSession();
        return session.user && session.token;
    },
    
    // Reindirizzamenti
    redirectToLogin() {
        window.location.href = CONFIG.PAGES.LOGIN;
    },
    
    redirectToDashboard() {
        window.location.href = CONFIG.PAGES.DASHBOARD;
    },
    
    // Notifiche V2.2 ottimizzate
    showNotification(message, type = 'success', duration = null) {
        let notification = document.getElementById('notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        // Icone per tipo di notifica
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            security: '🔒'
        };
        
        const icon = icons[type] || icons.info;
        notification.innerHTML = `${icon} ${message}`;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        const notificationDuration = duration || CONFIG.UI.NOTIFICATION_DURATION;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, notificationDuration);
        
        // Log solo errori in produzione
        if (type === 'error') {
            ProductionLogger.error('Notification:', message);
        }
    },
    
    // Formatters
    formatCurrency(amount) {
        return '€' + parseFloat(amount || 0).toFixed(2);
    },
    
    formatHours(hours) {
        return parseFloat(hours || 0).toFixed(1);
    },
    
    formatDate(date) {
        return new Date(date).toLocaleDateString('it-IT');
    },
    
    // Validatori V2.2
    validateHours(hours) {
        const h = parseFloat(hours);
        return !isNaN(h) && h >= CONFIG.VALIDATION.MIN_HOURS && h <= CONFIG.VALIDATION.MAX_HOURS_PER_DAY;
    },
    
    validateRequired(value) {
        return value && value.trim().length > 0;
    },
    
    validatePassword(password) {
        return password && password.length >= CONFIG.VALIDATION.MIN_PASSWORD_LENGTH;
    },
    
    // Auto-logout per sicurezza V2.2
    setupAutoLogout() {
        if (!CONFIG.SECURITY.SESSION_TIMEOUT) return;
        
        let timeout;
        
        const resetTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.clearSession();
                this.showNotification('Sessione scaduta per inattività', 'warning');
                setTimeout(() => this.redirectToLogin(), 2000);
            }, CONFIG.UI.AUTO_LOGOUT_TIME);
        };
        
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimeout, true);
        });
        
        resetTimeout();
        ProductionLogger.log('Auto-logout configurato per', CONFIG.UI.AUTO_LOGOUT_TIME / 60000, 'minuti');
    },
    
    // ✅ Funzione sicurezza ottimizzata per produzione V2.2
    showSecurityStatus(authMethod, hashSupport) {
        // V2.2: Security status box rimosso completamente
        if (!CONFIG.UI.SHOW_SECURITY_STATUS) {
            return;
        }
        
        // In produzione non mostra nessun messaggio di sicurezza
        if (CONFIG.PRODUCTION_MODE) {
            return;
        }
        
        // Modalità sviluppo - mostra info dettagliate
        if (!CONFIG.UI.SHOW_AUTH_METHOD) return;
        
        const securityLevel = authMethod === 'hash' ? 'SICURO' : 'COMPATIBILITÀ';
        const securityIcon = authMethod === 'hash' ? '🔒' : '⚠️';
        
        ProductionLogger.auth(`${securityIcon} Sicurezza: ${securityLevel} (Metodo: ${authMethod})`);
        
        if (authMethod === 'plain_migrated') {
            this.showNotification('Password migrata automaticamente in hash sicuro!', 'security', 6000);
        } else if (authMethod === 'plain_fallback') {
            this.showNotification('Login in modalità compatibilità. Contatta admin per migrazione.', 'warning', 6000);
        }
    },
    
    // ✅ Performance monitoring (solo in sviluppo)
    measurePerformance(operation, callback) {
        if (!CONFIG.LOGGING.PERFORMANCE_LOGS || CONFIG.PRODUCTION_MODE) {
            return callback();
        }
        
        const start = performance.now();
        const result = callback();
        const end = performance.now();
        
        ProductionLogger.performance(`${operation} completato in ${(end - start).toFixed(2)}ms`);
        return result;
    },
    
    // ✅ Error reporting per produzione
    reportError(error, context = '') {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            version: CONFIG.VERSION.frontend
        };
        
        ProductionLogger.error('Errore applicazione:', errorInfo);
        
        // In produzione potresti inviare questo a un servizio di monitoring
        if (CONFIG.PRODUCTION_MODE) {
            // Esempio: invio a servizio esterno di monitoring
            // this.sendToMonitoring(errorInfo);
        }
        
        return errorInfo;
    },

    // ===== FUNZIONI ADMIN =====
    
    /**
     * Valida se l'utente corrente ha accesso admin
     */
    validateAdmin: async function() {
        try {
            const sessionData = this.getSession();
            
            if (!sessionData || !sessionData.token || !sessionData.user) {
                console.error('Session data mancante');
                return false;
            }
            
            const result = await this.callAPI({
                action: 'validateAdmin',
                sessionToken: sessionData.token,
                userId: sessionData.user.userId
            });
            
            console.log('API validateAdmin response:', result);
            return result && result.success;
            
        } catch (error) {
            console.error('Errore validazione admin:', error);
            return false;
        }
    },
    /**
     * Controlla accesso admin e reindirizza se necessario
     */
    checkAdminAccess: async function() {
        const isAdmin = await this.validateAdmin();
        
        if (!isAdmin) {
            this.showNotification('Accesso negato. Solo gli amministratori possono accedere a questa pagina.', 'error');
            
            setTimeout(() => {
                window.location.href = CONFIG.PAGES.DASHBOARD;
            }, 2000);
            
            return false;
        }
        
        return true;
    },

    /**
     * Carica overview cantieri per admin
     */
    loadCantieriOverview: async function(modalita = 'totali') {
        try {
            const sessionData = this.getSession();
            const result = await this.callAPI({
                action: 'getCantieriOverview',
                sessionToken: sessionData.token,
                modalita: modalita
            });
            
            if (result && result.success) {
                return result.data || [];
            } else {
                throw new Error(result?.message || 'Errore caricamento cantieri');
            }
            
        } catch (error) {
            this.showNotification('Errore caricamento cantieri: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Carica lista dipendenti per admin
     */
    loadDipendentiList: async function() {
        try {
            const sessionData = this.getSession();
            const result = await this.callAPI({
                action: 'getDipendentiList',
                sessionToken: sessionData.token
            });
            
            if (result && result.success) {
                return result.data || [];
            } else {
                throw new Error(result?.message || 'Errore caricamento dipendenti');
            }
            
        } catch (error) {
            this.showNotification('Errore caricamento dipendenti: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Carica timeline dipendente per admin
     */
    loadDipendenteTimeline: async function(userId, timeframe = '30days') {
        try {
            const sessionData = this.getSession();
            const result = await this.callAPI({
                action: 'getDipendenteTimeline',
                sessionToken: sessionData.token,
                userId: userId,
                timeframe: timeframe
            });
            
            if (result && result.success) {
                return result.data || {};
            } else {
                throw new Error(result?.message || 'Errore caricamento timeline');
            }
            
        } catch (error) {
            this.showNotification('Errore caricamento timeline: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Invalida cache admin
     */
    invalidateAdminCache: async function(cacheType = 'all') {
        try {
            const sessionData = this.getSession();
            const result = await this.callAPI({
                action: 'invalidateCache',
                sessionToken: sessionData.token,
                cacheType: cacheType
            });
            
            return result && result.success;
            
        } catch (error) {
            console.error('Errore invalidazione cache:', error);
            return false;
        }
    },

    // ===== FORMATTERS ADMIN =====
    
    formatOre: function(ore) {
        if (!ore || ore === 0) return '0h';
        return ore.toFixed(1) + 'h';
    },

    formatDataAdmin: function(data) {
        if (!data) return 'N/A';
        
        const date = new Date(data);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    truncateText: function(testo, maxLength = 25) {
        if (!testo) return '';
        if (testo.length <= maxLength) return testo;
        return testo.substring(0, maxLength - 3) + '...';
    },

    getStatoBadgeClass: function(stato) {
        switch (stato?.toLowerCase()) {
            case 'aperto':
                return 'badge-success';
            case 'chiuso':
                return 'badge-secondary';
            case 'sospeso':
                return 'badge-warning';
            default:
                return 'badge-info';
        }
    },

    // ===== GESTIONE GRAFICI =====
    
    prepareChartData: function(timelineData, timeframe) {
        try {
            if (!timelineData || !timelineData.timeline) {
                return {
                    labels: [],
                    datasets: [{
                        label: 'Ore Lavorate',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                    }]
                };
            }
            
            const labels = timelineData.timeline.map(item => item.periodo);
            const data = timelineData.timeline.map(item => item.ore || 0);
            
            return {
                labels: labels,
                datasets: [{
                    label: 'Ore Lavorate',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            };
            
        } catch (error) {
            console.error('Errore preparazione dati grafico:', error);
            return { labels: [], datasets: [] };
        }
    },

    getChartOptions: function(isMobile = false) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: isMobile ? 10 : 15,
                        font: { size: isMobile ? 10 : 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `Ore: ${context.parsed.y.toFixed(1)}h`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(0, 0, 0, 0.1)' 
                    },
                    ticks: { 
                        font: { size: isMobile ? 9 : 10 },
                        callback: function(value) {
                            return value.toFixed(1) + 'h';
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        font: { size: isMobile ? 9 : 10 },
                        maxRotation: isMobile ? 45 : 0
                    }
                }
            }
        };
    },

    // ===== UTILITY MOBILE =====
    
    isMobile: function() {
        return window.innerWidth < 768;
    },

    handleResponsiveResize: function(callback) {
        let resizeTimer;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (callback && typeof callback === 'function') {
                    callback(this.isMobile());
                }
            }, 250);
        });
    },

    setupAutoRefresh: function(refreshCallback, interval = 300000) {
        if (!refreshCallback || typeof refreshCallback !== 'function') {
            console.error('Callback refresh non valido');
            return null;
        }
        
        return setInterval(async () => {
            try {
                console.log('Auto-refresh dati admin...');
                await refreshCallback();
            } catch (error) {
                console.error('Errore auto-refresh:', error);
            }
        }, interval);
    },

    stopAutoRefresh: function(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
        }
    },

    showNoDataState: function(container, message = 'Nessun dato disponibile') {
        if (!container) return;
        
        container.innerHTML = `
            <div class="no-data-state">
                <div class="no-data-icon">📊</div>
                <h3>Nessun Dato</h3>
                <p>${message}</p>
            </div>
        `;
    },

    adminLog: function(message, data = null) {
        if (CONFIG.PRODUCTION_MODE === false) {
            console.log(`[ADMIN UI] ${message}`, data || '');
        }
    },

    logAdminPerformance: function(operation, startTime) {
        if (CONFIG.PRODUCTION_MODE === false) {
            const duration = Date.now() - startTime;
            console.log(`[ADMIN UI PERF] ${operation}: ${duration}ms`);
        }
    }
};

// Protezione accesso pagine V2.2 - Production
const PageGuard = {
    requireLogin() {
        if (!Utils.isLoggedIn()) {
            Utils.showNotification('Accesso richiesto', 'error');
            setTimeout(() => Utils.redirectToLogin(), 1500);
            return false;
        }
        return true;
    },
    
    redirectIfLoggedIn() {
        if (Utils.isLoggedIn()) {
            Utils.redirectToDashboard();
            return true;
        }
        return false;
    }
};

// ============================ CONFIGURAZIONE ADMIN ============================
const ADMIN_CONFIG = {
    ADMIN_PAGE: 'admin.html',
    
    TIMEFRAMES: {
        THIRTY_DAYS: '30days',
        LAST_MONTH: 'lastMonth',
        CURRENT_YEAR: 'year'
    },
    
    CANTIERI_MODES: {
        MESE_CORRENTE: 'mese',
        TOTALI_ASSOLUTI: 'totali'
    },
    
    AUTO_REFRESH_INTERVAL: 300000,
    MOBILE_BREAKPOINT: 768,
    CHART_HEIGHT_MOBILE: 250,
    CHART_HEIGHT_DESKTOP: 300
};

// ===== INIZIALIZZAZIONE SISTEMA PRODUCTION V2.2 =====
function initializeSystem() {
    if (CONFIG.PRODUCTION_MODE) {
        // Produzione: Log minimo
        ProductionLogger.log('Sistema Gestione Ore V2.2 - Modalità Produzione (UI Semplificata)');
        
        // Rimuovi informazioni debug dal DOM
        removeDebugElements();
        
        // Setup error handling globale
        setupGlobalErrorHandling();
        
    } else {
        // Sviluppo: Log completo
        ProductionLogger.log('🚀 Sistema Gestione Ore inizializzato V2.2 - Modalità Sviluppo');
        ProductionLogger.log('📋 Configurazione:', CONFIG);
        ProductionLogger.log('🎨 UI: Layout Semplificato');
        ProductionLogger.log('🔐 Hash Support:', CONFIG.SECURITY.HASH_ENABLED);
        ProductionLogger.log('🔑 Sessione attiva:', Utils.isLoggedIn());
    }
}

function removeDebugElements() {
    // Rimuovi elementi debug dal DOM in produzione
    const debugSelectors = [
        '.version-badge',
        '.debug-info', 
        '[data-debug]',
        '.development-only'
    ];
    
    debugSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (CONFIG.PRODUCTION_MODE) {
                el.style.display = 'none';
            }
        });
    });
}

function setupGlobalErrorHandling() {
    // Cattura errori JavaScript globali
    window.addEventListener('error', (event) => {
        Utils.reportError(event.error, 'Global JavaScript Error');
    });
    
    // Cattura promise rejections non gestite
    window.addEventListener('unhandledrejection', (event) => {
        Utils.reportError(new Error(event.reason), 'Unhandled Promise Rejection');
    });
}

// ===== COMPATIBILITÀ API =====
// Mantieni le funzioni originali per compatibilità 
const Logger = ProductionLogger; // Alias per compatibilità 

// Export per uso globale
window.CONFIG = CONFIG;
window.Utils = Utils;
window.PageGuard = PageGuard;
window.Logger = ProductionLogger;
window.ADMIN_CONFIG = ADMIN_CONFIG;

// Auto-inizializzazione
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}
