/**
 * api.js — Capa de comunicación con el backend (Proxy de Claude).
 *
 * Único punto de contacto entre la UI y la IA real.
 * No genera texto simulado; envía la request y espera la respuesta.
 *
 * ─────────────────────────────────────────────────────────────────
 * CONFIGURACIÓN DEL BACKEND
 * ─────────────────────────────────────────────────────────────────
 *
 * MODO ESTÁTICO: Si el backend no está disponible (ej. abrir index.html
 * como archivo o publicar como web estática), la API detecta la ausencia
 * automáticamente y lanza un error controlado que output.js maneja con
 * un fallback visual elegante. El frontend nunca se rompe.
 * ─────────────────────────────────────────────────────────────────
 */
const API = {
    config: {
        // ENDPOINT URL: Ruta de la Vercel Function
        endpoint: '/api/chat',

        // HEADERS: Solo necesitamos JSON
        headers: {
            'Content-Type': 'application/json',
        },

        // Tiempo de espera antes de abortar (ms)
        timeoutMs: 30000,

        // Número máximo de turnos (user+model) que se envían como contexto.
        // Ajusta este valor para ampliar o reducir la memoria de sesión.
        maxTurns: 8,

        // Modo de respuesta (normal, brief, detailed)
        responseMode: 'normal',
    },

    // Historial de sesión en memoria. Se pierde al recargar la página.
    _history: [],
    _controller: null,

    /**
     * Estado de conectividad con el backend.
     * null = no verificado, true = disponible, false = no disponible
     */
    backendAvailable: null,

    /**
     * Verifica si el backend está disponible.
     * Usa un HEAD ligero al endpoint. Si falla (file://, 404, CORS, etc.)
     * marca backendAvailable = false sin romper nada.
     * @returns {Promise<boolean>}
     */
    async checkBackend() {
        // Entorno file:// no puede hacer fetch a rutas relativas de servidor
        if (window.location.protocol === 'file:') {
            this.backendAvailable = false;
            console.log('[API] Protocolo file:// detectado — modo estático activado.');
            return false;
        }

        try {
            const resp = await fetch(this.config.endpoint, {
                method: 'OPTIONS',
                signal: AbortSignal.timeout(3000),
            });
            // Cualquier respuesta (incluso 405) indica que hay un servidor escuchando
            this.backendAvailable = true;
            console.log('[API] Backend disponible.');
            return true;
        } catch {
            this.backendAvailable = false;
            console.log('[API] Backend no detectado — modo estático activado.');
            return false;
        }
    },

    /**
     * Envía la consulta al backend y devuelve la respuesta de la IA.
     * @param {string} query — El texto ingresado por el usuario.
     * @returns {Promise<string>} — El texto de respuesta.
     */
    async send(query) {
        // Si ya sabemos que el backend no está disponible, abortar rápido
        if (this.backendAvailable === false) {
            throw new Error('[offline] Backend no disponible. Modo demostración activo.');
        }

        this.abort();
        this._controller = new AbortController();
        const timeout = setTimeout(() => this.abort(), this.config.timeoutMs);

        try {
            // Poda el historial a los últimos N turnos (cada turno = 2 entradas: user + model)
            const maxEntries = this.config.maxTurns * 2;
            const history = this._history.slice(-maxEntries);

            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: this.config.headers,
                signal: this._controller.signal,
                body: JSON.stringify({
                    message: query,
                    history: history,
                    responseMode: this.config.responseMode,
                }),
            });

            clearTimeout(timeout);

            let data;
            try {
                data = await response.json();
            } catch (e) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
            }

            if (!response.ok) {
                throw new Error(data.error || `Error del servidor: ${response.status}`);
            }

            if (data.model) {
                this.config.model = data.model;
            }

            // Backend respondió correctamente — confirmar disponibilidad
            this.backendAvailable = true;

            const reply = this._parseResponse(data);

            // Guardar el turno en el historial de sesión
            this._history.push({ role: 'user',  text: query });
            this._history.push({ role: 'model', text: reply });

            return reply;

        } catch (err) {
            clearTimeout(timeout);

            // Detectar errores de red (backend caído, file://, CORS, etc.)
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                this.backendAvailable = false;
                throw new Error('[offline] No se pudo conectar con el backend.');
            }

            if (err.name === 'AbortError') throw new Error('Solicitud cancelada por timeout.');
            throw err;
        } finally {
            this._controller = null;
        }
    },

    /**
     * Borra el historial de sesión sin recargar la página.
     * Útil para empezar una nueva conversación limpia.
     */
    clearHistory() {
        this._history = [];
        console.log('[API] Historial de sesión borrado.');
    },

    abort() {
        if (this._controller) {
            this._controller.abort();
            this._controller = null;
        }
    },

    /**
     * Extrae el texto de la respuesta basándose en el contrato del backend.
     */
    _parseResponse(data) {
        // CONTRATO: La UI espera { "reply": "texto generado por la IA" }
        if (data && typeof data.reply !== 'undefined') {
            return String(data.reply).trim();
        }

        // Fallbacks por seguridad (por si el backend cambia o devuelve directo de la API)
        if (data?.content?.[0]?.text) return data.content[0].text.trim(); // Claude directo
        if (data?.text) return String(data.text).trim();
        if (data?.message) return String(data.message).trim();
        if (typeof data === 'string') return data.trim();

        console.warn('[API] Formato inesperado. Se esperaba { reply: "..." }. Recibido:', data);
        return JSON.stringify(data, null, 2);
    },
};

