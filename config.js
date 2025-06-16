// Configurazione Sistema Gestione Ore
const CONFIG = {
    // Google Apps Script URL - AGGIORNA CON IL TUO NUOVO DEPLOYMENT
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyXWYqvl3Q7ww4Kahj-zhAB-akTO5ER6hvjWhveOlw2xdIMAKuo3wgyQV1mgyq9Ee9L/exec',
    
    // Versioning - UNICA DEFINIZIONE
    VERSION: {
        frontend: '2.1.1',
        buildDate: '2025-01-15',
        description: 'Fix versioning conflicts e SYSTEM_VERSION'
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
        AUTO_LOGOUT_TIME: 30 * 60 * 1000 // 30 minuti
    },
    
    // Validazione
    VALIDATION: {
        MAX_HOURS_PER_DAY: 24,
        MIN_HOURS: 0,
        MAX_WORK_DESCRIPTION: 500,
        MAX_NOTES: 200
    },
    
    // Debug - RIMOSSO IL DUPLICATO VERSION
    DEBUG: true
};

// Funzioni di utilità comuni
const Utils = {
    // Gestione chiamate API - CON MIGLIORE ERROR HANDLING
    async callAPI(params) {
        if (CONFIG.DEBUG) {
            console.log('🔄 API Call:', params);
        }
        
        try {
            const url = new URL(CONFIG.APPS_SCRIPT_URL);
            Object.keys(params).forEach(key => {
                url.searchParams.append(key, String(params[key]));
            });
            
            console.log('📡 Calling URL:', url.toString());
            
            const response = await fetch(url.toString(), { 
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log('📥 Raw response:', text.substring(0, 200) + '...');
            
            // Pulizia Google Apps Script security prefix
            const cleanText = text.replace(/^\)\]\}',?\s*/, '');
            
            let result;
            try {
                result = JSON.parse(cleanText);
            } catch (jsonError) {
                console.error('❌ JSON Parse Error:', jsonError);
                console.error('❌ Clean text:', cleanText);
                throw new Error('Risposta del server non valida');
            }
            
            if (CONFIG.DEBUG) {
                console.log('📥 API Response:', result);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ API Call failed:', error);
            
            // Ritorna errore strutturato
            return {
                success: false,
                error: error.message,
                message: 'Errore di connessione al server'
            };
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
    },
    
    clearSession() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
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
    
    // Notifiche
    showNotification(message, type = 'success') {
        let notification = document.getElementById('notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, CONFIG.UI.NOTIFICATION_DURATION);
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
    
    // Setup auto-logout per sicurezza
    setupAutoLogout() {
        let timeout;
        
        const resetTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.clearSession();
                this.showNotification('Sessione scaduta per inattività', 'error');
                setTimeout(() => this.redirectToLogin(), 2000);
            }, CONFIG.UI.AUTO_LOGOUT_TIME);
        };
        
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimeout, true);
        });
        
        resetTimeout();
    },
    
    // Verifica versione backend
    async checkBackendVersion() {
        try {
            const result = await this.callAPI({ action: 'getVersion' });
            if (result.success && result.version) {
                const backendVersion = result.version.version;
                const frontendVersion = CONFIG.VERSION.frontend;
                
                console.log(`🔧 Backend v${backendVersion} | Frontend v${frontendVersion}`);
                
                if (backendVersion !== frontendVersion) {
                    console.warn('⚠️ Versioni diverse! Backend:', backendVersion, 'Frontend:', frontendVersion);
                }
                
                window.BACKEND_VERSION = result.version;
                return result.version;
            }
        } catch (error) {
            console.error('❌ Errore verifica versione backend:', error);
        }
        return null;
    }
};

// Protezione accesso pagine
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

// Log di sistema
if (CONFIG.DEBUG) {
    console.log('🚀 Sistema Gestione Ore inizializzato v' + CONFIG.VERSION.frontend);
    console.log('📋 Configurazione:', CONFIG);
    console.log('🔐 Sessione attiva:', Utils.isLoggedIn());
}

// Export per uso globale
window.CONFIG = CONFIG;
window.Utils = Utils;
window.PageGuard = PageGuard;// Configurazione Sistema Gestione Ore
const CONFIG = {
    // Google Apps Script URL - NUOVO DEPLOYMENT
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxHZtWt5CSafFEez3KfHeFNaiX9P9NGaJoUvIrWahyFajhcctmGMRriOlCkaZhsFq9w/exec',
    
    // Versioning
    VERSION: {
        frontend: '2.1.0',
        buildDate: '2025-01-15',
        description: 'Dashboard con versioning e debug migliorato'
    },
    
    // Pagine del sistema
    PAGES: {
        LOGIN: 'index.html',
        DASHBOARD: 'dashboard.html',
        ADMIN: 'admin.html' // Per future implementazioni
    },
    
    // Impostazioni UI
    UI: {
        NOTIFICATION_DURATION: 4000,
        LOADING_MIN_TIME: 1000,
        AUTO_LOGOUT_TIME: 30 * 60 * 1000 // 30 minuti
    },
    
    // Validazione
    VALIDATION: {
        MAX_HOURS_PER_DAY: 24,
        MIN_HOURS: 0,
        MAX_WORK_DESCRIPTION: 500,
        MAX_NOTES: 200
    },
    
    // Debug
    DEBUG: true,
    VERSION: '1.0.0'
};

// Funzioni di utilità comuni
const Utils = {
    // Gestione chiamate API
    async callAPI(params) {
        if (CONFIG.DEBUG) {
            console.log('🔄 API Call:', params);
        }
        
        const url = new URL(CONFIG.APPS_SCRIPT_URL);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, String(params[key]));
        });
        
        const response = await fetch(url.toString(), { method: 'GET' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        const cleanText = text.replace(/^\)\]\}',?\s*/, '');
        const result = JSON.parse(cleanText);
        
        if (CONFIG.DEBUG) {
            console.log('📥 API Response:', result);
        }
        
        return result;
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
    },
    
    clearSession() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
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
    
    // Notifiche
    showNotification(message, type = 'success') {
        let notification = document.getElementById('notification');
        
        if (!notification) {
            // Crea elemento notifica se non esiste
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, CONFIG.UI.NOTIFICATION_DURATION);
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
    
    // Setup auto-logout per sicurezza
    setupAutoLogout() {
        let timeout;
        
        const resetTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.clearSession();
                this.showNotification('Sessione scaduta per inattività', 'error');
                setTimeout(() => this.redirectToLogin(), 2000);
            }, CONFIG.UI.AUTO_LOGOUT_TIME);
        };
        
        // Reset timeout su attività utente
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimeout, true);
        });
        
        resetTimeout(); // Avvia il timer
    },
    
    // Verifica versione backend
    async checkBackendVersion() {
        try {
            const result = await this.callAPI({ action: 'getVersion' });
            if (result.success && result.version) {
                const backendVersion = result.version.version;
                const frontendVersion = CONFIG.VERSION.frontend;
                
                console.log(`🔧 Backend v${backendVersion} | Frontend v${frontendVersion}`);
                
                if (backendVersion !== frontendVersion) {
                    console.warn('⚠️ Versioni diverse! Backend:', backendVersion, 'Frontend:', frontendVersion);
                }
                
                // Salva info versione per display
                window.BACKEND_VERSION = result.version;
                
                return result.version;
            }
        } catch (error) {
            console.error('❌ Errore verifica versione backend:', error);
        }
        return null;
    }
};

// Protezione accesso pagine
const PageGuard = {
    // Da chiamare nelle pagine che richiedono login
    requireLogin() {
        if (!Utils.isLoggedIn()) {
            Utils.showNotification('Accesso richiesto', 'error');
            setTimeout(() => Utils.redirectToLogin(), 1500);
            return false;
        }
        return true;
    },
    
    // Da chiamare nella pagina di login se già loggato
    redirectIfLoggedIn() {
        if (Utils.isLoggedIn()) {
            Utils.redirectToDashboard();
            return true;
        }
        return false;
    }
};

// Log di sistema
if (CONFIG.DEBUG) {
    console.log('🚀 Sistema Gestione Ore inizializzato');
    console.log('📋 Configurazione:', CONFIG);
    console.log('🔐 Sessione attiva:', Utils.isLoggedIn());
}

// Export per uso globale
window.CONFIG = CONFIG;
window.Utils = Utils;
window.PageGuard = PageGuard;
