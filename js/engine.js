/**
 * engine.js — Estado visual durante la espera de la IA.
 *
 * YA NO analiza ni interpreta el texto del usuario.
 * Solo genera los datos para las 4 filas de estado visual
 * que se muestran mientras la interfaz espera la respuesta real.
 *
 * Los valores son contextuales y honestos:
 *   - CONSULTA  → los primeros caracteres de lo que escribió el usuario
 *   - MODELO    → el modelo configurado en API.config
 *   - CANAL     → el endpoint (host) al que se envía la request
 *   - ESTADO    → "Transmitiendo" (se actualiza live desde output.js)
 */

const Engine = {

    /**
     * Genera las filas de estado visual para la anatomy.
     * @param {string} query — La consulta del usuario (texto original).
     * @returns {Array<{label: string, value: string, key: string}>}
     */
    buildStatusRows(query) {
        const preview  = query.length > 42
            ? query.slice(0, 42).trimEnd() + '…'
            : query;

        const model    = (typeof API !== 'undefined' && API.config.model) ? API.config.model : 'Gemini';
        const endpoint = (typeof API !== 'undefined' && API.config.endpoint) ? API.config.endpoint : '—';
        const host     = 'VIREON Core';

        return [
            { key: 'query',   label: 'CONSULTA', value: preview },
            { key: 'model',   label: 'MODELO',   value: model   },
            { key: 'channel', label: 'CANAL',     value: host    },
            { key: 'status',  label: 'ESTADO',   value: 'Transmitiendo' },
        ];
    },

    _parseHost(url) {
        try {
            return new URL(url).host || url;
        } catch {
            return url;
        }
    },

};
