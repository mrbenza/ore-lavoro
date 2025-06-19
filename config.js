// Configurazione Sistema Gestione Ore V3.4 - Hash Password Support
const CONFIG = {
    // Google Apps Script URL - AGGIORNA CON IL TUO URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzXSwnwt_MghEINZHV2lLWyBbNDxNfeoiDdF4K_bGJ2vSAClTzS-fzX8hyFZ8_4G881/exec',
    
    // Versioning
    VERSION: {
        frontend: '3.4.0',
        buildDate: '2025-06-19',
        description: 'Frontend compatibile con hash password sicuri'
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
        SHOW_AUTH_METHOD: true // Mostra metodo autenticazione (hash/plain)
    },
    
    // Validazione
    VALIDATION: {
        MAX_HOURS_PER_DAY: 24,
        MIN_HOURS: 0,
        MAX_WORK_DESCRIPTION: 500,
        MAX_NOTES: 200,
        MIN_PASSWORD_LENGTH: 4 // Password minima 4 caratteri
    },
    
    // Debug e sicurezza
    DEBUG: true,
    SECURITY: {
        HASH_ENABLED: true,
        AUTO_MIGRATION: true,
        SESSION_TIMEOUT: true
    }
};

// Funzioni di utilità comuni V3.4
const Utils = {
    // ✅ Gestione chiamate API ottimizzata per V3.4
    async callAPI(params) {
        if (CONFIG.DEBUG) {
            console.log('🔄 API Call V3.4:', params);
        }
        
        const url = new URL(CONFIG.APPS_SCRIPT_URL);
        
        // Gestione parametri con serializzazione JSON per oggetti complessi
        Object.keys(params).forEach(key => {
            const value = params[key];
            
            if (typeof value === 'object' && value !== null) {
                console.log(`🔧 Serializzando oggetto ${key}:`, value);
                url.searchParams.append(key, JSON.stringify(value));
            } else {
                url.searchParams.append(key, String(value));
            }
        });
        
        if (CONFIG.DEBUG) {
            console.log('🌐 URL finale:', url.toString());
        }
        
        const response = await fetch(url.toString(), { method: 'GET' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        const cleanText = text.replace(/^\)\]\}',?\s*/, '');
        const result = JSON.parse(cleanText);
        
        if (CONFIG.DEBUG) {
            console.log('📥 API Response V3.4:', result);
            
            // Log informazioni sicurezza se disponibili
            if (result.systemInfo) {
                console.log('🔐 Auth Method:', result.systemInfo.authMethod);
                console.log('🔐 Hash Support:', result.systemInfo.hashSupport);
                console.log('📊 Backend Version:', result.systemInfo.version);
            }
        }
        
        return result;
    },
    
    // Gestione sessione V3.4
    getSession() {
        return {
            user: JSON.parse(sessionStorage.getItem('currentUser') || 'null'),
            token: sessionStorage.getItem('sessionToken')
        };
    },
    
    setSession(user, token) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        sessionStorage.setItem('sessionToken', token);
        
        if (CONFIG.DEBUG && user.authMethod) {
            console.log('🔐 Sessione salvata con metodo auth:', user.authMethod);
        }
    },
    
    clearSession() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
        if (CONFIG.DEBUG) {
            console.log('🗑️ Sessione cancellata');
        }
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
    
    // Notifiche V3.4 migliorate
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
    },
    
    // ✅ Nuova funzione: mostra informazioni sicurezza
    showSecurityStatus(authMethod, hashSupport) {
        if (!CONFIG.UI.SHOW_AUTH_METHOD || !CONFIG.DEBUG) return;
        
        const securityLevel = authMethod === 'hash' ? 'SICURO' : 'COMPATIBILITÀ';
        const securityIcon = authMethod === 'hash' ? '🔐' : '⚠️';
        
        console.log(`${securityIcon} Sicurezza: ${securityLevel} (Metodo: ${authMethod})`);
        
        if (authMethod === 'plain_migrated') {
            this.showNotification('Password migrata automaticamente in hash sicuro!', 'security', 6000);
        } else if (authMethod === 'plain_fallback') {
            this.showNotification('Login in modalità compatibilità. Contatta admin per migrazione.', 'warning', 6000);
        }
    }
};

// Protezione accesso pagine V3.4
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

// Log di sistema V3.4
if (CONFIG.DEBUG) {
    console.log('🚀 Sistema Gestione Ore inizializzato V3.4');
    console.log('📋 Configurazione:', CONFIG);
    console.log('🔐 Hash Support:', CONFIG.SECURITY.HASH_ENABLED);
    console.log('🔐 Sessione attiva:', Utils.isLoggedIn());
}

// Export per uso globale
window.CONFIG = CONFIG;
window.Utils = Utils;
window.PageGuard = PageGuard;
