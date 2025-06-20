// Configurazione Sistema Gestione Ore V3.4 - PRODUCTION MODE
const CONFIG = {
    // Google Apps Script URL - AGGIORNA CON IL TUO URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyLupeOGJFsuGIwOxcrk5Xbgqm8hXGeMiTht-ITxdxvM0xkcHzXA75FU1eh3fGrPdxf/exec',
    
    // 🔧 MODALITÀ PRODUZIONE
    PRODUCTION_MODE: true,  // 🚀 CAMBIA A TRUE PER PRODUZIONE
    
    // Versioning
    VERSION: {
        frontend: '3.4.0',
        buildDate: '2025-06-19',
        description: 'Frontend production-ready con logging ottimizzato'
    },
    
    // Pagine del sistema
    PAGES: {
        LOGIN: 'index.html',
        DASHBOARD: 'dashboard.html',
        ADMIN: 'admin.html'
    },
    
    // Impostazioni UI
    UI: {
        NOTIFICATION_DURATION: 4000,
        LOADING_MIN_TIME: 1000,
        AUTO_LOGOUT_TIME: 30 * 60 * 1000, // 30 minuti
        SHOW_AUTH_METHOD: false, // 🔧 NASCOSTO IN PRODUZIONE
        SHOW_DEBUG_INFO: false   // 🔧 NASCOSTO IN PRODUZIONE
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
    
    // 🆕 CONFIGURAZIONE LOGGING FRONTEND
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
        if (CONFIG.LOGGING.API_LOGS && !CONFIG.PRODUCTION_MODE) {
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

// Funzioni di utilità comuni V3.4 - PRODUCTION OPTIMIZED
const Utils = {
    // ✅ Gestione chiamate API ottimizzata per produzione
    async callAPI(params) {
        ProductionLogger.api('API Call:', params.action);
        
        const url = new URL(CONFIG.APPS_SCRIPT_URL);
        
        // Gestione parametri con serializzazione JSON per oggetti complessi
        Object.keys(params).forEach(key => {
            const value = params[key];
            
            if (typeof value === 'object' && value !== null) {
                ProductionLogger.debug(`Serializzando oggetto ${key}:`, value);
                url.searchParams.append(key, JSON.stringify(value));
            } else {
                url.searchParams.append(key, String(value));
            }
        });
        
        ProductionLogger.debug('URL finale:', url.toString());
        
        try {
            const response = await fetch(url.toString(), { method: 'GET' });
            
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
    
    // Gestione sessione V3.4 - Production
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
    
    // Notifiche V3.4 ottimizzate
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
            security: '🔐'
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
    
    // Validatori V3.4
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
    
    // Auto-logout per sicurezza V3.4
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
    
    // ✅ Funzione sicurezza ottimizzata per produzione
    showSecurityStatus(authMethod, hashSupport) {
        // In produzione mostra solo notifiche essenziali
        if (CONFIG.PRODUCTION_MODE) {
            if (authMethod === 'plain_migrated') {
                this.showNotification('Password aggiornata con successo', 'success', 3000);
            }
            return;
        }
        
        // Modalità sviluppo - mostra info dettagliate
        if (!CONFIG.UI.SHOW_AUTH_METHOD) return;
        
        const securityLevel = authMethod === 'hash' ? 'SICURO' : 'COMPATIBILITÀ';
        const securityIcon = authMethod === 'hash' ? '🔐' : '⚠️';
        
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
    }
};

// Protezione accesso pagine V3.4 - Production
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

// ===== INIZIALIZZAZIONE SISTEMA PRODUCTION =====
function initializeSystem() {
    if (CONFIG.PRODUCTION_MODE) {
        // Produzione: Log minimo
        ProductionLogger.log('Sistema Gestione Ore V3.4 - Modalità Produzione');
        
        // Rimuovi informazioni debug dal DOM
        removeDebugElements();
        
        // Setup error handling globale
        setupGlobalErrorHandling();
        
    } else {
        // Sviluppo: Log completo
        ProductionLogger.log('🚀 Sistema Gestione Ore inizializzato V3.4 - Modalità Sviluppo');
        ProductionLogger.log('📋 Configurazione:', CONFIG);
        ProductionLogger.log('🔐 Hash Support:', CONFIG.SECURITY.HASH_ENABLED);
        ProductionLogger.log('🔐 Sessione attiva:', Utils.isLoggedIn());
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

// Auto-inizializzazione
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}
