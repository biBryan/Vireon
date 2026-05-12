/**
 * cache.js — Módulo de Cache Inteligente y Persistente
 * 
 * Implementa cache exacto y cache inteligente por similitud.
 */

const Cache = {
    store: {},
    maxSize: 50,
    storageKey: 'vireon_cache_v1',
    similarityThreshold: 0.8,

    // Indica si el modo offline parcial está habilitado
    offlineMode: false,

    // Indicadores de características activas
    exactCacheEnabled: true,
    smartCacheEnabled: true,

    // Stop words para limpiar consultas antes de calcular similitud
    stopWords: new Set([
        "que", "es", "un", "una", "unos", "unas", "el", "la", "los", "las",
        "de", "del", "en", "por", "para", "con", "como", "cual", "cuales",
        "explicame", "explicarme", "definicion", "dime", "hablame", "sobre", "significa",
        "concepto", "explicar", "explicacion", "quien", "cuando", "donde", "porque",
        "y", "o", "u", "a", "al", "se", "su", "sus", "te", "me", "le", "les", "lo",
        "podrias", "puedes", "favor"
    ]),

    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                this.store = JSON.parse(data);
            }
        } catch (e) {
            console.error('[Cache] Error al cargar:', e);
            this.store = {};
        }
    },

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.store));
        } catch (e) {
            console.error('[Cache] Error al guardar:', e);
        }
    },

    normalize(query) {
        if (!query) return '';
        return query.trim().toLowerCase();
    },

    // Tokenización para cache inteligente
    tokenize(query) {
        // Remover acentos
        let normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Remover signos de puntuación
        normalized = normalized.replace(/[^\w\s]/gi, ' ');

        let words = normalized.split(/\s+/).filter(w => w.length > 2 && !this.stopWords.has(w));

        // Stemming ultra-básico (manejo de plurales)
        return words.map(w => {
            if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
            if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);
            return w;
        });
    },

    calculateSimilarity(tokensA, tokensB) {
        const setA = new Set(tokensA);
        const setB = new Set(tokensB);

        let intersection = 0;
        for (const token of setA) {
            if (setB.has(token)) {
                intersection++;
            }
        }

        const union = setA.size + setB.size - intersection;
        if (union === 0) return 0;
        return intersection / union;
    },

    // Obtener match exacto
    get(query, responseMode = 'normal') {
        const key = this.normalize(query);
        const entry = this.store[key];

        if (entry && entry.responseMode === responseMode) {
            entry.hits += 1;
            entry.lastUsedAt = Date.now();
            entry.matchType = 'exact';
            this.save();
            return entry;
        }
        return null;
    },

    // Obtener match similar
    getSimilar(query, responseMode = 'normal') {
        const tokensA = this.tokenize(query);

        // Si la pregunta es demasiado corta/genérica (<= 2 tokens útiles), no usamos inteligencia
        if (tokensA.length <= 2) return null;

        let bestMatch = null;
        let highestScore = 0;

        for (const [key, entry] of Object.entries(this.store)) {
            if (entry.responseMode !== responseMode) continue;

            const tokensB = this.tokenize(entry.originalQuery);
            if (tokensB.length === 0) continue;

            const score = this.calculateSimilarity(tokensA, tokensB);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = entry;
            }
        }

        if (highestScore >= this.similarityThreshold) {
            console.log(`[Cache Inteligente] Match encontrado. Score: ${highestScore.toFixed(2)}`);
            bestMatch.hits += 1;
            bestMatch.lastUsedAt = Date.now();
            // Creamos un clon para cambiar el matchType sin alterar la entrada real
            const result = { ...bestMatch, matchType: 'similar', score: highestScore };
            this.save();
            return result;
        }

        return null;
    },

    isValid(response) {
        if (!response) return false;
        if (typeof response !== 'string') return false;

        const trimmed = response.trim();
        if (trimmed === '') return false;

        const lowerResp = trimmed.toLowerCase();
        if (lowerResp.includes('resource_exhausted')) return false;
        if (lowerResp.includes('error del servidor')) return false;
        if (lowerResp.includes('error de conexión')) return false;
        if (lowerResp.includes('error http')) return false;

        return true;
    },

    set(query, response, config = {}) {
        if (!this.isValid(response)) return;

        const key = this.normalize(query);
        const mode = config.responseMode || 'normal';
        const model = config.model || 'unknown';

        this.store[key] = {
            originalQuery: query,
            normalizedQuery: key,
            response: response,
            responseMode: mode,
            model: model,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            hits: 0,
            source: 'api'
        };

        this._enforceLimit();
        this.save();
    },

    _enforceLimit() {
        const keys = Object.keys(this.store);
        if (keys.length > this.maxSize) {
            keys.sort((a, b) => this.store[a].createdAt - this.store[b].createdAt);
            const toRemoveCount = keys.length - this.maxSize;
            for (let i = 0; i < toRemoveCount; i++) {
                delete this.store[keys[i]];
            }
        }
    },

    /**
     * Devuelve estadísticas limpias del cache para /status.
     * No expone claves, rutas ni datos sensibles.
     * @returns {{ entries: number, exactEnabled: boolean, smartEnabled: boolean, offlineMode: boolean }}
     */
    getStats() {
        return {
            entries:      Object.keys(this.store).length,
            exactEnabled: this.exactCacheEnabled,
            smartEnabled: this.smartCacheEnabled,
            offlineMode:  this.offlineMode,
        };
    },
};

Cache.load();
