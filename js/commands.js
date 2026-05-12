/**
 * commands.js — Lógica interna de acciones del sistema (VIREON Core Panel)
 *
 * La experiencia de "slash commands" ha sido eliminada.
 * Este módulo provee utilidades de alto nivel que son invocadas directamente
 * por los widgets visuales de la barra lateral (sidebar.js).
 */

const CoreActions = {

    /**
     * Limpia la conversación completa.
     * Llamado por el botón "Restablecer Memoria" en la sidebar.
     */
    resetSession() {
        if (typeof API !== 'undefined') API.clearHistory();

        const historyContainer = document.getElementById('history-container');
        if (historyContainer) historyContainer.innerHTML = '';

        if (typeof Output !== 'undefined') Output.reset();
        if (typeof System !== 'undefined') System.setState('IDLE');
        
        // Clear input as well
        const input = document.getElementById('system-input');
        if (input) input.value = '';
    },

    /**
     * Cambia el modo de respuesta de la IA.
     * @param {string} mode - 'normal', 'brief', o 'detailed'
     */
    setResponseMode(mode) {
        if (typeof API !== 'undefined') {
            API.config.responseMode = mode;
        }
    },

    /**
     * Devuelve el contenido del Manual del Sistema (para el panel interno).
     */
    getSystemManual() {
        return `
## Manual del Sistema VIREON

VIREON OS es un entorno conversacional inmersivo diseñado para alta eficiencia y claridad.

### Controles del Panel (Core Panel)
El panel lateral funciona como el núcleo operativo del sistema:
- **Status Widget:** Muestra en tiempo real si el sistema está procesando información, el modelo de IA activo y el uso de memoria caché.
- **Mode Switcher:** Permite ajustar la longitud y profundidad de las respuestas de la IA (Normal, Breve, Detallado).
- **Restablecer Memoria:** Borra el contexto conversacional activo y limpia la pantalla, permitiendo iniciar una nueva línea de pensamiento desde cero.

### Interfaz de Conversación
- El área principal está reservada exclusivamente para tu diálogo con la IA.
- El sistema cuenta con memoria caché integrada: si realizas una pregunta similar o idéntica, VIREON recuperará la respuesta al instante para ahorrar recursos computacionales.
`;
    }
};

// Exponer como Commands por compatibilidad temporal si algún otro script lo busca,
// aunque la nueva UI usará preferentemente CoreActions.
const Commands = CoreActions;
