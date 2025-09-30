// Configurazione Sistema Gestione Ore V2.2 - PRODUCTION MODE - CORS FIXED
const CONFIG = {
    // PROXY VERCEL - URL RELATIVO (CORS gestito)
    APPS_SCRIPT_URL: '/api/proxy',
 
    // MODALITÀ PRODUZIONE
    PRODUCTION_MODE: true,
    
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
        SHOW_AUTH_METHOD: false,
        SHOW_DEBUG_INFO: false,
        SHOW_SECURITY_STATUS: false,
        SHOW_DERIVED_STATS: false
    },
    
    // Validazione
    VALIDATION: {
        MAX_HOURS_PER_DAY: 24,
        MIN_HOURS: 0,
        MAX_WORK_DESCRIPTION: 500,
        MAX_NOTES: 200,
        MIN_PASSWORD_LENGTH: 4
    },
    
    // Debug e sicurezza
    DEBUG: false,
    SECURITY: {
        HASH_ENABLED: true,
        AUTO_MIGRATION: true,
        SESSION_TIMEOUT: true,
        LOG_AUTH_ATTEMPTS: false
    },
    
    // CONFIGURAZIONE LOGGING FRONTEND V2.2
    LOGGING: {
        CONSOLE_LOGS: false,
        ERROR_LOGS: true,
        AUTH_LOGS: false,
        API_LOGS: false,
        PERFORMANCE_LOGS: false
    }
};

// ===== SISTEMA LOGGING =====
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
    
    debug: function(...args) {
        if (CONFIG.DEBUG && !CONFIG.PRODUCTION_MODE) {
            console.log('[DEBUG]', ...args);
        }
    }
};

// ===== FUNZIONI DI UTILITÀ =====
const Utils = {
    // Gestione chiamate API
    async callAPI(params) {
        ProductionLogger.api('API Call:', params.action);
        
        let targetUrl;
        if (CONFIG.APPS_SCRIPT_URL.startsWith('http')) {
            targetUrl = new URL(CONFIG.APPS_SCRIPT_URL);
        } else {
            targetUrl = new URL(CONFIG.APPS_SCRIPT_URL, window.location.origin);
        }
        
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
    
    // Gestione sessione
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
    
    // Notifiche ottimizzate
    showNotification(message, type = 'success', duration = null) {
        let notification = document.getElementById('notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
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
        
        if (type === 'error') {
            ProductionLogger.error('Notification:', message);
        }
    },
    
    // Mostra messaggio fullscreen per eventi importanti
    showFullscreenMessage(message, type = 'info', duration = 3000) {
        const existing = document.querySelector('.fullscreen-message');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.className = `fullscreen-message ${type}`;
        overlay.innerHTML = `
            <div class="fullscreen-message-content">
                <div class="fullscreen-message-icon">
                    ${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'admin' ? '👑' : 'ℹ'}
                </div>
                <div class="fullscreen-message-text">${message}</div>
                <div class="fullscreen-message-spinner"></div>
            </div>
        `;
        
        if (!document.getElementById('fullscreen-message-styles')) {
            const style = document.createElement('style');
            style.id = 'fullscreen-message-styles';
            style.textContent = `
                .fullscreen-message {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    animation: fadeIn 0.3s ease-in;
                }
                .fullscreen-message-content {
                    background: white;
                    padding: 40px 60px;
                    border-radius: 20px;
                    text-align: center;
                    max-width: 500px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                .fullscreen-message-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .fullscreen-message.admin .fullscreen-message-icon {
                    animation: pulse 1.5s ease-in-out infinite;
                }
                .fullscreen-message-text {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1f2937;
                    line-height: 1.5;
                    margin-bottom: 25px;
                }
                .fullscreen-message-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f4f6;
                    border-top-color: #4f46e5;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(overlay);
        
        if (duration > 0) {
            setTimeout(() => overlay.remove(), duration);
        }
        
        return overlay;
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
    
    // Validatori
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
    
    // Auto-logout
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
    
    // Sicurezza
    showSecurityStatus(authMethod, hashSupport) {
        if (!CONFIG.UI.SHOW_SECURITY_STATUS) return;
        if (CONFIG.PRODUCTION_MODE) return;
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
    
    // Performance monitoring
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
    
    // Error reporting
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
        
        if (CONFIG.PRODUCTION_MODE) {
            // Qui potresti inviare a un servizio di monitoring
        }
        
        return errorInfo;
    },

    // ===== FUNZIONI ADMIN =====
    
    // Valida se l'utente corrente ha accesso admin
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
    
    // Controlla accesso admin e reindirizza se necessario (per admin.html)
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
    
    // Controlla se l'utente è admin e reindirizza dalla dashboard normale
    checkAdminRedirect: async function() {
        try {
            const isAdmin = await this.validateAdmin();
            
            if (isAdmin) {
                console.log('Admin rilevato, reindirizzamento...');
                
                // Mostra messaggio fullscreen
                this.showFullscreenMessage(
                    'Accesso Amministratore rilevato!<br>Verrai reindirizzato al pannello di controllo...',
                    'admin',
                    0 // Non auto-chiude
                );
                
                // Redirect dopo 2 secondi
                setTimeout(() => {
                    window.location.href = CONFIG.PAGES.ADMIN || 'admin.html';
                }, 2000);
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Errore controllo admin redirect:', error);
            return false;
        }
    },

    // Carica overview cantieri per admin
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

    // Carica lista dipendenti per admin
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

    // Carica le informazioni ore di un altro utente (solo admin)
    loadOtherUserInfo: async function(targetUserId) {
        try {
            const sessionData = this.getSession();
            const result = await this.callAPI({
                action: 'getOtherUserInfo',
                sessionToken: sessionData.token,
                targetUserId: targetUserId
            });
            
            if (result && result.success) {
                return result.data || {};
            } else {
                throw new Error(result?.message || 'Errore caricamento info utente');
            }
            
        } catch (error) {
            this.showNotification('Errore caricamento info utente: ' + error.message, 'error');
            throw error;
        }
    },

    // Carica i dati calendario mensile di un altro utente (solo admin)
    loadOtherUserMonthlyData: async function(targetUserId, year, month) {
        try {
            const sessionData = this.getSession();
            
            ProductionLogger.debug('loadOtherUserMonthlyData:', {
                targetUserId: targetUserId,
                year: year,
                month: month
            });
            
            const result = await this.callAPI({
                action: 'getOtherUserMonthlyData',
                sessionToken: sessionData.token,
                targetUserId: targetUserId,
                year: String(year),
                month: String(month)
            });
            
            if (result && result.success) {
                return result.data || {};
            } else {
                throw new Error(result?.message || 'Errore caricamento dati calendario');
            }
            
        } catch (error) {
            this.showNotification('Errore caricamento calendario: ' + error.message, 'error');
            throw error;
        }
    },

    // Carica timeline dipendente per admin (deprecata - usare loadOtherUserMonthlyData)
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

    // Invalida cache admin
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

// ===== PROTEZIONE ACCESSO PAGINE =====
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

// ===== CONFIGURAZIONE ADMIN =====
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
    
    AUTO_REFRESH_INTERVAL: 1800000, // 30 minuti
    MOBILE_BREAKPOINT: 768,
    CHART_HEIGHT_MOBILE: 250,
    CHART_HEIGHT_DESKTOP: 300
};

// ===== INIZIALIZZAZIONE SISTEMA =====
function initializeSystem() {
    if (CONFIG.PRODUCTION_MODE) {
        ProductionLogger.log('Sistema Gestione Ore V2.2 - Modalità Produzione (UI Semplificata)');
        removeDebugElements();
        setupGlobalErrorHandling();
    } else {
        ProductionLogger.log('Sistema Gestione Ore inizializzato V2.2 - Modalità Sviluppo');
        ProductionLogger.log('Configurazione:', CONFIG);
        ProductionLogger.log('UI: Layout Semplificato');
        ProductionLogger.log('Hash Support:', CONFIG.SECURITY.HASH_ENABLED);
        ProductionLogger.log('Sessione attiva:', Utils.isLoggedIn());
    }
}

function removeDebugElements() {
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
    window.addEventListener('error', (event) => {
        Utils.reportError(event.error, 'Global JavaScript Error');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        Utils.reportError(new Error(event.reason), 'Unhandled Promise Rejection');
    });
}

// ===== COMPATIBILITÀ API =====
const Logger = ProductionLogger;

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
