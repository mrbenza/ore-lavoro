// ===== CONFIGURAZIONE SISTEMA GESTIONE ORE =====
// Versione: 2.1.1 - Fix conflitti dichiarazioni

(function() {
    'use strict';
    
    // Evita caricamenti multipli
    if (window.SISTEMA_ORE_LOADED) {
        console.warn('⚠️ Sistema già caricato, saltando inizializzazione');
        return;
    }
    
    console.log('🔧 Inizializzando sistema gestione ore...');
    
    // ===== CONFIGURAZIONE =====
    window.CONFIG = {
        // Google Apps Script URL - AGGIORNA CON IL TUO DEPLOYMENT
        APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyXWYqvl3Q7ww4Kahj-zhAB-akTO5ER6hvjWhveOlw2xdIMAKuo3wgyQV1mgyq9Ee9L/exec',
        
        // Versioning
        VERSION: {
            frontend: '2.1.1',
            buildDate: '2025-01-15',
            description: 'Fix conflitti CONFIG e Utils undefined'
        },
        
        // Pagine
        PAGES: {
            LOGIN: 'index.html',
            DASHBOARD: 'dashboard.html'
        },
        
        // UI Settings
        UI: {
            NOTIFICATION_DURATION: 4000,
            AUTO_LOGOUT_TIME: 30 * 60 * 1000
        },
        
        // Validazione
        VALIDATION: {
            MAX_HOURS_PER_DAY: 24,
            MIN_HOURS: 0
        },
        
        // Debug
        DEBUG: true
    };

    // ===== UTILITIES =====
    window.Utils = {
        // API Calls
        async callAPI(params) {
            if (window.CONFIG.DEBUG) {
                console.log('🔄 API Call:', params);
            }
            
            try {
                const url = new URL(window.CONFIG.APPS_SCRIPT_URL);
                
                // Aggiungi parametri
                Object.keys(params).forEach(key => {
                    url.searchParams.append(key, String(params[key]));
                });
                
                console.log('📡 URL chiamata:', url.toString());
                
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const text = await response.text();
                console.log('📥 Risposta raw:', text.substring(0, 200) + '...');
                
                // Pulisci prefisso sicurezza Google
                const cleanText = text.replace(/^\)\]\}',?\s*/, '');
                
                let result;
                try {
                    result = JSON.parse(cleanText);
                } catch (jsonError) {
                    console.error('❌ Errore JSON:', jsonError);
                    throw new Error('Risposta server non valida');
                }
                
                if (window.CONFIG.DEBUG) {
                    console.log('📥 Risultato:', result);
                }
                
                return result;
                
            } catch (error) {
                console.error('❌ Errore API:', error);
                return {
                    success: false,
                    error: error.message,
                    message: 'Errore di connessione'
                };
            }
        },
        
        // Gestione Sessione
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
        
        // Navigazione
        redirectToLogin() {
            window.location.href = window.CONFIG.PAGES.LOGIN;
        },
        
        redirectToDashboard() {
            window.location.href = window.CONFIG.PAGES.DASHBOARD;
        },
        
        // Notifiche
        showNotification(message, type = 'success') {
            console.log(`📢 Notifica ${type}:`, message);
            
            let notification = document.getElementById('notification');
            
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'notification';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 25px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    z-index: 10000;
                    transform: translateX(400px);
                    transition: transform 0.3s ease;
                    max-width: 300px;
                `;
                document.body.appendChild(notification);
            }
            
            // Stili per tipo
            if (type === 'success') {
                notification.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            } else if (type === 'error') {
                notification.style.background = 'linear-gradient(135deg, #dc3545, #fd7e14)';
            } else {
                notification.style.background = 'linear-gradient(135deg, #007bff, #6610f2)';
            }
            
            notification.textContent = message;
            notification.style.transform = 'translateX(0)';
            
            // Auto-hide
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
            }, window.CONFIG.UI.NOTIFICATION_DURATION);
        },
        
        // Validazioni
        validateRequired(value) {
            return value && value.trim().length > 0;
        },
        
        validateHours(hours) {
            const h = parseFloat(hours);
            return !isNaN(h) && h >= window.CONFIG.VALIDATION.MIN_HOURS && h <= window.CONFIG.VALIDATION.MAX_HOURS_PER_DAY;
        },
        
        // Versioning
        async checkBackendVersion() {
            try {
                const result = await this.callAPI({ action: 'getVersion' });
                if (result.success && result.version) {
                    window.BACKEND_VERSION = result.version;
                    return result.version;
                }
            } catch (error) {
                console.error('❌ Errore verifica versione:', error);
            }
            return null;
        }
    };

    // ===== PAGE GUARD =====
    window.PageGuard = {
        requireLogin() {
            if (!window.Utils.isLoggedIn()) {
                window.Utils.showNotification('Accesso richiesto', 'error');
                setTimeout(() => window.Utils.redirectToLogin(), 1500);
                return false;
            }
            return true;
        },
        
        redirectIfLoggedIn() {
            if (window.Utils.isLoggedIn()) {
                window.Utils.redirectToDashboard();
                return true;
            }
            return false;
        }
    };
    
    // ===== INIZIALIZZAZIONE COMPLETATA =====
    window.SISTEMA_ORE_LOADED = true;
    
    console.log('✅ Sistema caricato - Frontend v' + window.CONFIG.VERSION.frontend);
    console.log('📋 CONFIG disponibile:', !!window.CONFIG);
    console.log('🔧 Utils disponibile:', !!window.Utils);
    console.log('🛡️ PageGuard disponibile:', !!window.PageGuard);
    
    // Debug info
    if (window.CONFIG.DEBUG) {
        window.DEBUG_INFO = {
            config: window.CONFIG,
            utils: Object.keys(window.Utils),
            pageGuard: Object.keys(window.PageGuard),
            loaded: new Date().toISOString()
        };
        console.log('🐛 Debug info disponibile in window.DEBUG_INFO');
    }
})();
