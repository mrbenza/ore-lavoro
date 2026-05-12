// Configurazione Sistema Gestione Ore V2.2 - PRODUCTION MODE - CORS FIXED

/* ═══════════════════════════════════════════
   OGGETTO CONFIG — Costanti globali dell'applicazione:
   URL proxy Vercel, flag produzione, versioning,
   pagine, parametri UI, validazione, sicurezza e logging.
   Esportato su window.CONFIG per uso globale.
   ═══════════════════════════════════════════ */
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
        SHOW_AUTH_METHOD: false,        // Se true, mostra metodo autenticazione nella UI
        SHOW_DEBUG_INFO: false,         // Se true, mostra pannello debug
        SHOW_SECURITY_STATUS: false,    // Se true, mostra stato sicurezza hash
        SHOW_DERIVED_STATS: false       // Se true, mostra statistiche derivate
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
        CONSOLE_LOGS: false,        // Log generici: disabilitati in produzione
        ERROR_LOGS: true,           // Log errori: sempre attivi
        AUTH_LOGS: false,           // Log autenticazione: disabilitati in produzione
        API_LOGS: false,            // Log chiamate API: disabilitati in produzione
        PERFORMANCE_LOGS: false     // Log performance: disabilitati in produzione
    }
};

/* ═══════════════════════════════════════════
   OGGETTO ProductionLogger — Sistema di logging centralizzato.
   Wrapper su console che rispetta i flag CONFIG.LOGGING e
   CONFIG.PRODUCTION_MODE. Ogni metodo è no-op in produzione
   eccetto error() e warn() che usano ERROR_LOGS.
   Esportato su window.Logger per retrocompatibilità.
   ═══════════════════════════════════════════ */
const ProductionLogger = {
    /**
     * Log generico — Stampa solo se CONSOLE_LOGS=true e non in produzione.
     *
     * CHIAMATA DA:  Varie funzioni interne di config.js e pagine HTML
     * CHIAMA:       console.log
     *
     * @param {...*} args - Valori da loggare
     * @returns {void}
     */
    log: function(...args) {
        if (CONFIG.LOGGING.CONSOLE_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[APP]', ...args);
        }
    },

    /**
     * Log errori — Stampa sempre se ERROR_LOGS=true (inclusa produzione).
     *
     * CHIAMATA DA:  Utils.callAPI, Utils.reportError, Utils.showNotification
     * CHIAMA:       console.error
     *
     * @param {...*} args - Valori da loggare come errore
     * @returns {void}
     */
    error: function(...args) {
        if (CONFIG.LOGGING.ERROR_LOGS) {
            console.error('[ERROR]', ...args);
        }
    },

    /**
     * Log warning — Stampa se ERROR_LOGS=true.
     *
     * CHIAMATA DA:  Varie funzioni in caso di situazioni anomale non bloccanti
     * CHIAMA:       console.warn
     *
     * @param {...*} args - Valori da loggare come warning
     * @returns {void}
     */
    warn: function(...args) {
        if (CONFIG.LOGGING.ERROR_LOGS) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log autenticazione — Solo se AUTH_LOGS=true e non in produzione.
     *
     * CHIAMATA DA:  Utils.setSession, Utils.clearSession, Utils.showSecurityStatus
     * CHIAMA:       console.log
     *
     * @param {...*} args - Valori da loggare nel contesto auth
     * @returns {void}
     */
    auth: function(...args) {
        if (CONFIG.LOGGING.AUTH_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[AUTH]', ...args);
        }
    },

    /**
     * Log chiamate API — Solo se API_CALLS=true e non in produzione.
     *
     * NOTA: Il flag letto è CONFIG.LOGGING.API_CALLS (non API_LOGS).
     * CONFIG.LOGGING.API_LOGS esiste ma non è letto qui — potenziale bug.
     *
     * CHIAMATA DA:  Utils.callAPI
     * CHIAMA:       console.log
     *
     * @param {...*} args - Valori da loggare nel contesto API
     * @returns {void}
     */
    api: function(...args) {
        if (CONFIG.LOGGING.API_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[API]', ...args);
        }
    },

    /**
     * Log performance — Solo se PERFORMANCE_LOGS=true e non in produzione.
     *
     * CHIAMATA DA:  Utils.measurePerformance
     * CHIAMA:       console.log
     *
     * @param {...*} args - Valori da loggare nel contesto performance
     * @returns {void}
     */
    performance: function(...args) {
        if (CONFIG.LOGGING.PERFORMANCE_LOGS && !CONFIG.PRODUCTION_MODE) {
            console.log('[PERF]', ...args);
        }
    },

    /**
     * Log debug — Solo se CONFIG.DEBUG=true e non in produzione.
     *
     * CHIAMATA DA:  Utils.callAPI (debug URL e parametri)
     * CHIAMA:       console.log
     *
     * @param {...*} args - Valori da loggare in modalità debug
     * @returns {void}
     */
    debug: function(...args) {
        if (CONFIG.DEBUG && !CONFIG.PRODUCTION_MODE) {
            console.log('[DEBUG]', ...args);
        }
    }
};

/* ═══════════════════════════════════════════
   OGGETTO Utils — Libreria di utilità condivisa tra tutte le pagine.
   Contiene: gestione API (callAPI), sessione (getSession/setSession),
   notifiche, formatters, validatori, auto-logout, funzioni admin.
   Esportato su window.Utils.
   ═══════════════════════════════════════════ */
const Utils = {
    /**
     * Esegue una chiamata API verso il backend (Google Apps Script via proxy Vercel).
     *
     * DESCRIZIONE ESTESA: Costruisce l'URL target aggiungendo tutti i parametri
     * come query string (gli oggetti vengono serializzati in JSON). Esegue la
     * richiesta GET, rimuove il prefisso anti-XSSI ")]}'," dal testo risposta,
     * parsa il JSON e ritorna il risultato. In caso di errore HTTP o di parse,
     * rilancia l'eccezione al chiamante.
     *
     * FLUSSO INTERNO:
     *   1. Determina targetUrl (relativo o assoluto) da CONFIG.APPS_SCRIPT_URL
     *   2. Appende tutti i parametri come query string (oggetti serializzati in JSON)
     *   3. Esegue fetch GET
     *   4. Lancia errore se response.ok è false
     *   5. Rimuove prefisso anti-XSSI ")]}',"
     *   6. Parsa JSON e ritorna il risultato
     *
     * CHIAMATA DA:  authenticateUser (index.html), loadCantieri (dashboard.html),
     *               refreshUserStats (dashboard.html), saveWorkEntry (dashboard.html),
     *               loadCalendarData (dashboard.html), Utils.validateAdmin,
     *               Utils.loadCantieriOverview, Utils.loadDipendentiList,
     *               Utils.loadOtherUserInfo, Utils.loadOtherUserMonthlyData,
     *               Utils.loadDipendenteTimeline, Utils.invalidateAdminCache,
     *               confirmDelete (admin.html), saveWorkEdit (admin.html),
     *               loadAllCantieriForEdit (admin.html)
     * CHIAMA:       ProductionLogger.api, ProductionLogger.debug,
     *               ProductionLogger.error, fetch
     * LEGGE:        CONFIG.APPS_SCRIPT_URL, CONFIG.PRODUCTION_MODE,
     *               CONFIG.LOGGING.API_CALLS (⚠️ ma il flag nel JSON si chiama API_LOGS)
     *
     * @param {Object} params - Oggetto con i parametri della richiesta; params.action è obbligatorio
     * @returns {Promise<Object>} Oggetto JSON risposta dal backend
     */
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

    /**
     * Legge i dati di sessione dal sessionStorage.
     *
     * DESCRIZIONE ESTESA: Recupera currentUser (JSON) e sessionToken (stringa)
     * da sessionStorage. Ritorna null per entrambi se non presenti.
     *
     * CHIAMATA DA:  Utils.isLoggedIn, Utils.validateAdmin, Utils.checkAdminAccess,
     *               Utils.checkAdminRedirect, Utils.loadCantieriOverview,
     *               Utils.loadDipendentiList, Utils.loadOtherUserInfo,
     *               Utils.loadOtherUserMonthlyData, Utils.loadDipendenteTimeline,
     *               Utils.invalidateAdminCache, initializeApp (dashboard.html),
     *               loadCantieri (dashboard.html), refreshUserStats (dashboard.html),
     *               saveWorkEntry (dashboard.html), loadCalendarData (dashboard.html),
     *               initUI (admin.html), confirmDelete (admin.html),
     *               saveWorkEdit (admin.html), loadAllCantieriForEdit (admin.html)
     * CHIAMA:       sessionStorage.getItem, JSON.parse
     *
     * @returns {{ user: Object|null, token: string|null }}
     */
    getSession() {
        return {
            user: JSON.parse(sessionStorage.getItem('currentUser') || 'null'),
            token: sessionStorage.getItem('sessionToken')
        };
    },

    /**
     * Salva i dati di sessione nel sessionStorage.
     *
     * CHIAMATA DA:  form submit (index.html) dopo login riuscito
     * CHIAMA:       sessionStorage.setItem, JSON.stringify, ProductionLogger.auth
     * MODIFICA:     sessionStorage keys "currentUser" e "sessionToken"
     *
     * @param {Object} user  - Oggetto utente con almeno { name, role }
     * @param {string} token - Token sessione formato "userId_timestamp_hash"
     * @returns {void}
     */
    setSession(user, token) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        sessionStorage.setItem('sessionToken', token);
        ProductionLogger.auth('Sessione salvata per utente:', user.name);
    },

    /**
     * Cancella la sessione dal sessionStorage (logout).
     *
     * CHIAMATA DA:  logout() in dashboard.html e admin.html,
     *               Utils.setupAutoLogout (timeout inattività)
     * CHIAMA:       sessionStorage.removeItem, ProductionLogger.auth
     * MODIFICA:     sessionStorage keys "currentUser" e "sessionToken"
     *
     * @returns {void}
     */
    clearSession() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('sessionToken');
        ProductionLogger.auth('Sessione cancellata');
    },

    /**
     * Verifica se l'utente è attualmente autenticato.
     *
     * CHIAMATA DA:  PageGuard.requireLogin, PageGuard.redirectIfLoggedIn,
     *               startAutoRefresh (dashboard.html)
     * CHIAMA:       Utils.getSession
     *
     * @returns {boolean} true se user e token sono entrambi presenti in sessione
     */
    isLoggedIn() {
        const session = this.getSession();
        return session.user && session.token;
    },

    /**
     * Reindirizza alla pagina di login.
     *
     * CHIAMATA DA:  PageGuard.requireLogin, Utils.setupAutoLogout,
     *               initializeApp (dashboard.html) se sessione mancante
     * CHIAMA:       window.location.href
     * LEGGE:        CONFIG.PAGES.LOGIN
     *
     * @returns {void}
     */
    redirectToLogin() {
        window.location.href = CONFIG.PAGES.LOGIN;
    },

    /**
     * Reindirizza alla dashboard utente.
     *
     * CHIAMATA DA:  PageGuard.redirectIfLoggedIn (da index.html),
     *               Utils.checkAdminAccess (quando non admin)
     * CHIAMA:       window.location.href
     * LEGGE:        CONFIG.PAGES.DASHBOARD
     *
     * @returns {void}
     */
    redirectToDashboard() {
        window.location.href = CONFIG.PAGES.DASHBOARD;
    },

    /**
     * Verifica se un ruolo salvato in sessione corrisponde a un amministratore.
     *
     * @param {string} role - Valore colonna Ruolo del foglio Utenti.
     * @returns {boolean} true se il ruolo e' admin.
     */
    isAdminRole(role) {
        const normalizedRole = (role || '').toString().trim().toLowerCase();
        return normalizedRole === 'admin' || normalizedRole === 'amministratore';
    },

    /**
     * Mostra una notifica toast nell'angolo in alto a destra della pagina.
     *
     * DESCRIZIONE ESTESA: Cerca il div#notification nel DOM; se non esiste lo
     * crea dinamicamente e lo appende al body. Imposta il testo con icona emoji
     * corrispondente al tipo, aggiunge la classe CSS "show", e la rimuove dopo
     * il timeout configurato.
     *
     * FLUSSO INTERNO:
     *   1. Cerca o crea div#notification
     *   2. Imposta innerHTML con icona + messaggio
     *   3. Aggiunge classe .show (fa scorrere la notifica dentro)
     *   4. setTimeout per rimuovere .show dopo la durata
     *
     * CHIAMATA DA:  Tutte le pagine HTML, Utils.checkAdminAccess,
     *               Utils.checkAdminRedirect, Utils.loadCantieriOverview,
     *               Utils.loadDipendentiList, Utils.loadOtherUserInfo,
     *               Utils.loadDipendenteTimeline, Utils.setupAutoLogout,
     *               Utils.showSecurityStatus, PageGuard.requireLogin,
     *               showNotification (wrapper in dashboard.html),
     *               showNotification (wrapper in index.html)
     * CHIAMA:       ProductionLogger.error (se type='error')
     * LEGGE:        CONFIG.UI.NOTIFICATION_DURATION
     *
     * @param {string} message   - Testo della notifica
     * @param {string} [type='success'] - Tipo: 'success'|'error'|'warning'|'info'|'security'
     * @param {number|null} [duration=null] - Durata in ms; se null usa CONFIG.UI.NOTIFICATION_DURATION
     * @returns {void}
     */
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

    /**
     * Mostra un overlay fullscreen semitrasparente con messaggio e spinner.
     *
     * DESCRIZIONE ESTESA: Rimuove eventuali overlay preesistenti, crea un div
     * fullscreen con sfondo scuro, icona, testo e spinner animato. Inietta
     * gli stili CSS necessari la prima volta (tramite id='fullscreen-message-styles').
     * Ritorna il riferimento al DOM dell'overlay affinché il chiamante possa
     * rimuoverlo manualmente (loadingMsg.remove()).
     *
     * CHIAMATA DA:  confirmDelete (admin.html), saveWorkEdit (admin.html)
     * CHIAMA:       document.querySelector, document.createElement,
     *               document.head.appendChild, document.body.appendChild
     *
     * @param {string} message      - Testo da mostrare nell'overlay
     * @param {string} [type='info'] - Tipo: 'success'|'error'|'info'|'admin'
     * @param {number} [duration=3000] - Durata in ms; 0 = non auto-chiude
     * @returns {HTMLElement} Riferimento all'elemento overlay inserito nel DOM
     */
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

    /* ═══════════════════════════════════════════
       FORMATTERS — Funzioni di formattazione dati
       ═══════════════════════════════════════════ */

    /**
     * Formatta un importo numerico in stringa con prefisso EUR.
     *
     * CHIAMATA DA:  Non risulta chiamata in modo diretto dalle pagine HTML analizzate // ⚠️ DEAD CODE: non risulta chiamata
     * @param {number} amount - Importo da formattare
     * @returns {string} Es. "€12.50"
     */
    formatCurrency(amount) {
        return '€' + parseFloat(amount || 0).toFixed(2);
    },

    /**
     * Formatta un valore numerico di ore con 1 decimale.
     *
     * CHIAMATA DA:  refreshUserStats (dashboard.html) per monthlyHours e previousMonthHours
     * @param {number} hours - Ore da formattare
     * @returns {string} Es. "8.5"
     */
    formatHours(hours) {
        return parseFloat(hours || 0).toFixed(1);
    },

    /**
     * Formatta una data ISO in formato locale italiano.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML analizzate // ⚠️ DEAD CODE: non risulta chiamata
     * @param {string|Date} date - Data da formattare
     * @returns {string} Es. "07/09/2025"
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('it-IT');
    },

    /* ═══════════════════════════════════════════
       VALIDATORI — Funzioni di validazione input
       ═══════════════════════════════════════════ */

    /**
     * Valida che le ore siano un numero nell'intervallo [MIN_HOURS, MAX_HOURS_PER_DAY].
     *
     * CHIAMATA DA:  Non risulta chiamata direttamente (la dashboard usa validateHoursField locale) // ⚠️ DEAD CODE: non risulta chiamata
     * LEGGE:        CONFIG.VALIDATION.MIN_HOURS, CONFIG.VALIDATION.MAX_HOURS_PER_DAY
     *
     * @param {string|number} hours - Valore ore da validare
     * @returns {boolean}
     */
    validateHours(hours) {
        const h = parseFloat(hours);
        return !isNaN(h) && h >= CONFIG.VALIDATION.MIN_HOURS && h <= CONFIG.VALIDATION.MAX_HOURS_PER_DAY;
    },

    /**
     * Valida che un campo stringa non sia vuoto o solo spazi.
     *
     * CHIAMATA DA:  Non risulta chiamata direttamente dalle pagine HTML analizzate // ⚠️ DEAD CODE: non risulta chiamata
     *
     * @param {string} value - Valore da validare
     * @returns {boolean}
     */
    validateRequired(value) {
        return value && value.trim().length > 0;
    },

    /**
     * Valida la lunghezza minima della password.
     *
     * CHIAMATA DA:  form submit (index.html) prima di chiamare authenticateUser
     * LEGGE:        CONFIG.VALIDATION.MIN_PASSWORD_LENGTH
     *
     * @param {string} password - Password da validare
     * @returns {boolean}
     */
    validatePassword(password) {
        return password && password.length >= CONFIG.VALIDATION.MIN_PASSWORD_LENGTH;
    },

    /**
     * Configura il timeout automatico di sessione per inattività.
     *
     * DESCRIZIONE ESTESA: Registra listener su 5 eventi DOM (mousedown, mousemove,
     * keypress, scroll, touchstart) che resettano un timer di CONFIG.UI.AUTO_LOGOUT_TIME.
     * Alla scadenza, cancella la sessione, mostra notifica e reindirizza al login.
     *
     * FLUSSO INTERNO:
     *   1. Controlla CONFIG.SECURITY.SESSION_TIMEOUT (se false, no-op)
     *   2. Definisce resetTimeout che azzera e riavvia il timer
     *   3. Registra resetTimeout su 5 eventi DOM con capture=true
     *   4. Avvia il primo timer
     *
     * CHIAMATA DA:  DOMContentLoaded in dashboard.html
     * CHIAMA:       Utils.clearSession, Utils.showNotification, Utils.redirectToLogin,
     *               ProductionLogger.log
     * LEGGE:        CONFIG.SECURITY.SESSION_TIMEOUT, CONFIG.UI.AUTO_LOGOUT_TIME
     *
     * @returns {void}
     */
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

    /**
     * Mostra lo stato di sicurezza dell'autenticazione nella UI.
     *
     * DESCRIZIONE ESTESA: Funzione quasi sempre no-op in produzione perché
     * CONFIG.UI.SHOW_SECURITY_STATUS, CONFIG.PRODUCTION_MODE e
     * CONFIG.UI.SHOW_AUTH_METHOD bloccano l'esecuzione. In sviluppo, può
     * mostrare notifiche per migrazioni automatiche di password.
     *
     * CHIAMATA DA:  Non risulta chiamata dall'attuale flusso (index.html
     *               cancella authMethod dal result prima di usarlo) // ⚠️ DEAD CODE: non risulta chiamata nell'attuale flusso V2.2
     * CHIAMA:       ProductionLogger.auth, Utils.showNotification
     * LEGGE:        CONFIG.UI.SHOW_SECURITY_STATUS, CONFIG.PRODUCTION_MODE,
     *               CONFIG.UI.SHOW_AUTH_METHOD
     *
     * @param {string} authMethod   - Metodo usato: 'hash'|'plain_migrated'|'plain_fallback'
     * @param {boolean} hashSupport - Indica se il backend supporta hash
     * @returns {void}
     */
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

    /**
     * Misura le performance di un'operazione sincrona e la logga.
     *
     * DESCRIZIONE ESTESA: Esegue il callback e misura il tempo. In produzione
     * (o con PERFORMANCE_LOGS=false) esegue il callback direttamente senza misura.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML analizzate // ⚠️ DEAD CODE: non risulta chiamata
     * CHIAMA:       ProductionLogger.performance, performance.now
     *
     * @param {string}   operation - Nome dell'operazione (per il log)
     * @param {Function} callback  - Funzione sincrona da eseguire e misurare
     * @returns {*} Il valore di ritorno del callback
     */
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

    /**
     * Raccoglie le informazioni di un errore JS in un oggetto strutturato e lo logga.
     *
     * DESCRIZIONE ESTESA: Crea un oggetto errorInfo con message, stack, contesto,
     * timestamp, userAgent, url e versione frontend. In produzione, il blocco
     * per inviare a un servizio di monitoring è un placeholder vuoto.
     *
     * CHIAMATA DA:  setupGlobalErrorHandling (window.onerror e unhandledrejection)
     * CHIAMA:       ProductionLogger.error
     * LEGGE:        CONFIG.PRODUCTION_MODE, CONFIG.VERSION.frontend
     *
     * @param {Error}  error           - Oggetto errore JS
     * @param {string} [context='']    - Stringa contestuale (es. "Global JavaScript Error")
     * @returns {Object} errorInfo con dettagli dell'errore
     */
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

    /* ═══════════════════════════════════════════
       FUNZIONI ADMIN — API e utilità per admin.html
       ═══════════════════════════════════════════ */

    /**
     * Valida se l'utente corrente ha privilegi di amministratore.
     *
     * DESCRIZIONE ESTESA: Legge la sessione corrente e chiama l'API 'validateAdmin'
     * passando sessionToken e userId. Ritorna true se il backend conferma i privilegi.
     *
     * FLUSSO INTERNO:
     *   1. Legge sessionData da Utils.getSession
     *   2. Valida che token e user siano presenti
     *   3. Chiama Utils.callAPI({ action: 'validateAdmin', ... })
     *   4. Ritorna result.success
     *
     * CHIAMATA DA:  Utils.checkAdminAccess, Utils.checkAdminRedirect
     * CHIAMA:       Utils.getSession, Utils.callAPI
     *
     * @returns {Promise<boolean>} true se l'utente è admin
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
     * Controlla l'accesso admin e reindirizza alla dashboard se non autorizzato.
     *
     * DESCRIZIONE ESTESA: Chiama validateAdmin; se false, mostra notifica di errore
     * e dopo 2 secondi reindirizza alla dashboard normale.
     *
     * CHIAMATA DA:  DOMContentLoaded in admin.html
     * CHIAMA:       Utils.validateAdmin, Utils.showNotification, window.location.href
     * LEGGE:        CONFIG.PAGES.DASHBOARD
     *
     * @returns {Promise<boolean>} true se l'utente ha accesso admin
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
     * Controlla se l'utente è admin e se sì lo reindirizza al pannello admin.
     *
     * DESCRIZIONE ESTESA: Usata da dashboard.html per fare redirect automatico
     * degli admin verso admin.html. Mostra un overlay fullscreen "Accesso
     * Amministratore rilevato!" prima del redirect di 2 secondi.
     *
     * CHIAMATA DA:  DOMContentLoaded in dashboard.html (dopo login verificato)
     * CHIAMA:       Utils.validateAdmin, Utils.showFullscreenMessage, window.location.href
     * LEGGE:        CONFIG.PAGES.ADMIN
     *
     * @returns {Promise<boolean>} true se è admin (e si è avviato il redirect)
     */
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

    /**
     * Carica il riepilogo ore dei cantieri per la vista admin.
     *
     * DESCRIZIONE ESTESA: Chiama l'API 'getCantieriOverview' con la modalità
     * specificata ('totali' o 'mese'). Gestisce gli errori mostrando notifica.
     *
     * CHIAMATA DA:  loadCantieri() in admin.html
     * CHIAMA:       Utils.getSession, Utils.callAPI, Utils.showNotification
     *
     * @param {string} [modalita='totali'] - 'totali' per totale storico, 'mese' per mese corrente
     * @returns {Promise<Array>} Array di oggetti cantiere con { id, nome, oreTotali, stato, ultimoAggiornamento }
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
     * Carica la lista dei dipendenti per il dropdown admin.
     *
     * CHIAMATA DA:  loadDipendenti() in admin.html
     * CHIAMA:       Utils.getSession, Utils.callAPI, Utils.showNotification
     *
     * @returns {Promise<Array>} Array di { userId, nome, ruolo }
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
     * Carica le informazioni ore aggregate di un altro utente (solo admin).
     *
     * CHIAMATA DA:  loadTotaliOre() in admin.html
     * CHIAMA:       Utils.getSession, Utils.callAPI, Utils.showNotification
     *
     * @param {string} targetUserId - userId del dipendente da visualizzare
     * @returns {Promise<Object>} { oreMese, oreMesePrecedente, oreAnno }
     */
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

    /**
     * Carica i dati di calendario mensile di un altro utente (solo admin).
     *
     * DESCRIZIONE ESTESA: A differenza delle altre funzioni Utils admin, questa
     * NON mostra notifica in caso di errore: rilancia direttamente per permettere
     * all'UI admin di gestire il messaggio (es. "foglio mancante").
     *
     * FLUSSO INTERNO:
     *   1. Legge sessione
     *   2. Chiama API 'getOtherUserMonthlyData' con year e month come stringhe
     *   3. In caso di successo ritorna result.data
     *   4. In caso di errore rilancia l'eccezione (NON mostra notifica)
     *
     * CHIAMATA DA:  loadCalendarData() in admin.html
     * CHIAMA:       Utils.getSession, Utils.callAPI, ProductionLogger.debug
     *
     * @param {string} targetUserId - userId del dipendente
     * @param {number} year         - Anno (es. 2025)
     * @param {number} month        - Mese 1-12
     * @returns {Promise<Object>} Dati calendario con { workDays: {...} }
     */
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
                // Passa il messaggio originale del backend senza modificarlo
                const errorMessage = result?.message || 'Errore caricamento dati calendario';
                throw new Error(errorMessage);
            }

        } catch (error) {
            // Non mostrare notifica qui - lascia gestire all'interfaccia admin
            // In questo modo il messaggio specifico (foglio mancante) arriva all'UI
            throw error;
        }
    },

    /**
     * Carica la timeline di un dipendente per un timeframe specifico.
     *
     * NOTA: Funzione deprecata — preferire loadOtherUserMonthlyData.
     * Mantiene retrocompatibilità con eventuale codice legacy.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: deprecata, non risulta chiamata
     * CHIAMA:       Utils.getSession, Utils.callAPI, Utils.showNotification
     *
     * @param {string} userId              - userId del dipendente
     * @param {string} [timeframe='30days'] - '30days'|'lastMonth'|'year'
     * @returns {Promise<Object>} Dati timeline
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
     * Invalida la cache admin sul backend.
     *
     * CHIAMATA DA:  refreshCantieri() in admin.html
     * CHIAMA:       Utils.getSession, Utils.callAPI
     *
     * @param {string} [cacheType='all'] - Tipo cache da invalidare ('all'|'cantieri'|...)
     * @returns {Promise<boolean>} true se l'invalidazione è avvenuta con successo
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

    /* ═══════════════════════════════════════════
       FORMATTERS ADMIN — Formattazione dati per admin.html
       ═══════════════════════════════════════════ */

    /**
     * Formatta un numero di ore come stringa con suffisso "h".
     *
     * CHIAMATA DA:  renderCantieri, loadTotaliOre in admin.html
     * @param {number} ore - Ore da formattare
     * @returns {string} Es. "8.5h" o "0h"
     */
    formatOre: function(ore) {
        if (!ore || ore === 0) return '0h';
        return ore.toFixed(1) + 'h';
    },

    /**
     * Formatta una data in formato italiano (gg/mm/aaaa).
     *
     * CHIAMATA DA:  renderCantieri in admin.html (campo ultimoAggiornamento)
     * @param {string|Date|null} data - Data da formattare
     * @returns {string} Es. "07/09/2025" o "N/A"
     */
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

    /**
     * Tronca un testo aggiungendo "..." se supera maxLength caratteri.
     *
     * CHIAMATA DA:  renderCantieri in admin.html (nome cantiere)
     * @param {string} testo      - Testo da troncare
     * @param {number} [maxLength=25] - Lunghezza massima
     * @returns {string} Testo troncato o originale
     */
    truncateText: function(testo, maxLength = 25) {
        if (!testo) return '';
        if (testo.length <= maxLength) return testo;
        return testo.substring(0, maxLength - 3) + '...';
    },

    /**
     * Restituisce la classe CSS badge per lo stato di un cantiere.
     *
     * NOTA: Questa funzione in Utils non risulta chiamata direttamente da admin.html
     * che usa invece la funzione locale getStatoBadgeClass(). // ⚠️ DEAD CODE: duplicata da funzione locale in admin.html; non risulta chiamata
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML analizzate
     *
     * @param {string} stato - 'aperto'|'chiuso'|'sospeso'|altro
     * @returns {string} Classe CSS: 'badge-success'|'badge-secondary'|'badge-warning'|'badge-info'
     */
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

    /* ═══════════════════════════════════════════
       GESTIONE GRAFICI — Preparazione dati per Chart.js
       ═══════════════════════════════════════════ */

    /**
     * Prepara i dati nel formato richiesto da Chart.js da un oggetto timelineData.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali (nessun canvas Chart.js presente) // ⚠️ DEAD CODE: non risulta chiamata (nessun grafico Chart.js nelle pagine attuali)
     *
     * @param {Object} timelineData - Oggetto con proprietà timeline: [{ periodo, ore }]
     * @param {string} timeframe    - Timeframe (per label, non usato nel corpo)
     * @returns {Object} Oggetto dataset Chart.js con labels e datasets
     */
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

    /**
     * Genera l'oggetto options per Chart.js responsive con assi e tooltip configurati.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali (nessun grafico presente) // ⚠️ DEAD CODE: non risulta chiamata (nessun grafico Chart.js nelle pagine attuali)
     *
     * @param {boolean} [isMobile=false] - Adatta font size e rotazione per mobile
     * @returns {Object} Oggetto options Chart.js
     */
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

    /* ═══════════════════════════════════════════
       UTILITY MOBILE — Helper per responsive e refresh
       ═══════════════════════════════════════════ */

    /**
     * Verifica se la viewport è mobile (larghezza < 768px).
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: non risulta chiamata
     * @returns {boolean}
     */
    isMobile: function() {
        return window.innerWidth < 768;
    },

    /**
     * Registra un listener resize con debounce di 250ms che esegue un callback.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: non risulta chiamata
     * @param {Function} callback - Riceve isMobile (boolean) come parametro
     * @returns {void}
     */
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

    /**
     * Avvia un auto-refresh automatico a intervalli regolari.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali (admin.html usa setupAutoRefresh locale) // ⚠️ DEAD CODE: non risulta chiamata
     * @param {Function} refreshCallback - Funzione async da eseguire periodicamente
     * @param {number} [interval=300000] - Intervallo in ms (default 5 minuti)
     * @returns {number|null} ID dell'interval, o null se callback non valido
     */
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

    /**
     * Ferma un interval di auto-refresh precedentemente avviato.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: non risulta chiamata
     * @param {number} intervalId - ID dell'interval da fermare
     * @returns {void}
     */
    stopAutoRefresh: function(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
        }
    },

    /**
     * Mostra un placeholder "nessun dato" all'interno di un container DOM.
     *
     * CHIAMATA DA:  Non risulta chiamata esplicitamente (admin.html usa innerHTML diretto) // ⚠️ DEAD CODE: non risulta chiamata
     * @param {HTMLElement} container - Elemento DOM in cui inserire il placeholder
     * @param {string} [message='Nessun dato disponibile'] - Messaggio da mostrare
     * @returns {void}
     */
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

    /**
     * Log admin UI — Stampa solo in modalità sviluppo.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: non risulta chiamata
     * LEGGE:        CONFIG.PRODUCTION_MODE
     *
     * @param {string} message - Messaggio da loggare
     * @param {*} [data=null]  - Dati aggiuntivi opzionali
     * @returns {void}
     */
    adminLog: function(message, data = null) {
        if (CONFIG.PRODUCTION_MODE === false) {
            console.log(`[ADMIN UI] ${message}`, data || '');
        }
    },

    /**
     * Misura la performance di un'operazione admin e la logga.
     *
     * CHIAMATA DA:  Non risulta chiamata dalle pagine HTML attuali // ⚠️ DEAD CODE: non risulta chiamata
     * LEGGE:        CONFIG.PRODUCTION_MODE
     *
     * @param {string} operation - Nome operazione
     * @param {number} startTime - Timestamp di inizio (Date.now())
     * @returns {void}
     */
    logAdminPerformance: function(operation, startTime) {
        if (CONFIG.PRODUCTION_MODE === false) {
            const duration = Date.now() - startTime;
            console.log(`[ADMIN UI PERF] ${operation}: ${duration}ms`);
        }
    }
};

/* ═══════════════════════════════════════════
   OGGETTO PageGuard — Protezione accesso pagine.
   Fornisce requireLogin (per pagine protette) e
   redirectIfLoggedIn (per index.html).
   Esportato su window.PageGuard.
   ═══════════════════════════════════════════ */
const PageGuard = {
    /**
     * Verifica che l'utente sia loggato; se non lo è, reindirizza al login.
     *
     * DESCRIZIONE ESTESA: Controlla Utils.isLoggedIn(). Se false, mostra notifica
     * "Accesso richiesto" e dopo 1.5 secondi reindirizza a index.html.
     * Usato da dashboard.html e implicitamente da admin.html tramite checkAdminAccess.
     *
     * CHIAMATA DA:  DOMContentLoaded in dashboard.html
     * CHIAMA:       Utils.isLoggedIn, Utils.showNotification, Utils.redirectToLogin
     *
     * @returns {boolean} true se l'utente è loggato, false se sta per essere reindirizzato
     */
    requireLogin() {
        if (!Utils.isLoggedIn()) {
            Utils.showNotification('Accesso richiesto', 'error');
            setTimeout(() => Utils.redirectToLogin(), 1500);
            return false;
        }
        return true;
    },

    /**
     * Se l'utente è già loggato, lo reindirizza alla dashboard (evita ri-login).
     *
     * DESCRIZIONE ESTESA: Controlla Utils.isLoggedIn(). Se true, chiama
     * redirectToDashboard e ritorna true per interrompere l'esecuzione in index.html.
     *
     * CHIAMATA DA:  DOMContentLoaded in index.html
     * CHIAMA:       Utils.isLoggedIn, Utils.redirectToDashboard
     *
     * @returns {boolean} true se è stato avviato il redirect, false se l'utente non era loggato
     */
    redirectIfLoggedIn() {
        if (Utils.isLoggedIn()) {
            const session = Utils.getSession();
            if (Utils.isAdminRole(session?.user?.ruolo)) {
                window.location.href = CONFIG.PAGES.ADMIN || 'admin.html';
            } else {
                Utils.redirectToDashboard();
            }
            return true;
        }
        return false;
    }
};

/* ═══════════════════════════════════════════
   OGGETTO ADMIN_CONFIG — Costanti di configurazione
   specifiche per admin.html: timeframe, modalità cantieri,
   intervalli refresh, breakpoint responsive.
   Esportato su window.ADMIN_CONFIG.
   ═══════════════════════════════════════════ */
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

    AUTO_REFRESH_INTERVAL: 1800000, // 30 minuti in ms
    MOBILE_BREAKPOINT: 768,
    CHART_HEIGHT_MOBILE: 250,
    CHART_HEIGHT_DESKTOP: 300
};

/* ═══════════════════════════════════════════
   INIZIALIZZAZIONE SISTEMA — Funzioni eseguite al caricamento
   ═══════════════════════════════════════════ */

/**
 * Inizializza il sistema in base alla modalità (produzione o sviluppo).
 *
 * DESCRIZIONE ESTESA: In produzione rimuove elementi debug e configura
 * la gestione globale degli errori. In sviluppo logga la configurazione completa.
 *
 * FLUSSO INTERNO:
 *   1. Controlla CONFIG.PRODUCTION_MODE
 *   2. In produzione: chiama removeDebugElements() e setupGlobalErrorHandling()
 *   3. In sviluppo: logga CONFIG, stato sessione, hash support
 *
 * CHIAMATA DA:  DOMContentLoaded (o immediatamente se DOM già caricato)
 * CHIAMA:       removeDebugElements, setupGlobalErrorHandling, ProductionLogger.log
 * LEGGE:        CONFIG.PRODUCTION_MODE, CONFIG.SECURITY.HASH_ENABLED
 *
 * @returns {void}
 */
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

/**
 * Nasconde gli elementi DOM con classi di debug in modalità produzione.
 *
 * DESCRIZIONE ESTESA: Cerca elementi con selettori '.version-badge', '.debug-info',
 * '[data-debug]', '.development-only' e imposta display:none se in produzione.
 *
 * CHIAMATA DA:  initializeSystem() (solo se PRODUCTION_MODE=true)
 * CHIAMA:       document.querySelectorAll
 * LEGGE:        CONFIG.PRODUCTION_MODE
 *
 * @returns {void}
 */
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

/**
 * Registra handler globali per errori JS non catturati.
 *
 * DESCRIZIONE ESTESA: Ascolta window 'error' (errori sincroni) e
 * 'unhandledrejection' (promise non gestite) e li passa a Utils.reportError.
 *
 * CHIAMATA DA:  initializeSystem() (solo se PRODUCTION_MODE=true)
 * CHIAMA:       Utils.reportError, window.addEventListener
 *
 * @returns {void}
 */
function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        Utils.reportError(event.error, 'Global JavaScript Error');
    });

    window.addEventListener('unhandledrejection', (event) => {
        Utils.reportError(new Error(event.reason), 'Unhandled Promise Rejection');
    });
}

/* ═══════════════════════════════════════════
   RETROCOMPATIBILITÀ — Alias e export globali
   ═══════════════════════════════════════════ */

// Alias Logger → ProductionLogger (retrocompatibilità con codice che usa Logger.xxx)
const Logger = ProductionLogger;

// Export globali — espone tutti gli oggetti su window per accesso cross-script
window.CONFIG = CONFIG;
window.Utils = Utils;
window.PageGuard = PageGuard;
window.Logger = ProductionLogger;
window.ADMIN_CONFIG = ADMIN_CONFIG;

// Auto-inizializzazione: esegue initializeSystem al caricamento del DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}
