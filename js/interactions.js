document.addEventListener('DOMContentLoaded', () => {
    const mainInput   = document.getElementById('system-input');
    const inputPortal = document.getElementById('input-container');

    // Block interactions during all active processing states
    const isBusy = () => [
        'SUBMITTING', 'ANALYZING', 'CRYSTALLIZING'
    ].includes(System.state);

    // ── Focus ─────────────────────────────────────────────────────────────
    mainInput.addEventListener('focus', () => {
        if (!isBusy()) System.setState('ACTIVE');
    });

    // ── Blur ──────────────────────────────────────────────────────────────
    mainInput.addEventListener('blur', () => {
        if (!isBusy() && mainInput.value.trim() === '' && System.state !== 'COMPLETE') {
            System.setState('IDLE');
        }
    });

    // ── Typing ────────────────────────────────────────────────────────────
    mainInput.addEventListener('input', (e) => {
        if (isBusy()) return;

        // New query after a complete session — reset the anatomy
        if (System.state === 'COMPLETE') {
            Output.reset();
        }

        if (e.target.value.length > 0) {
            System.setState('LISTENING');
            triggerPulse();
        } else {
            System.setState('ACTIVE');
        }
    });

    // ── Submit (Enter) ────────────────────────────────────────────────────
    mainInput.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const query = mainInput.value.trim();
        if (!query || isBusy()) return;

        // The system no longer intercepts '/' commands.
        // All typed input is treated as conversational queries.

        // [Fase 5: Cache Exacto e Inteligente]
        const currentMode = API.config.responseMode || 'normal';
        
        // 1. Intentar match exacto
        let cached = Cache.get(query, currentMode);
        
        // 2. Si no hay exacto, intentar match similar
        if (!cached) {
            cached = Cache.getSimilar(query, currentMode);
        }

        if (cached) {
            // Responder instantáneamente desde cache
            mainInput.blur();
            mainInput.value = '';
            
            // Añadir al historial directamente (mismo método visual)
            Output.addToHistory(query, cached.response, false);
            
            // Sincronizar memoria interna evitando duplicados consecutivos
            const lastIdx = API._history.length;
            if (lastIdx < 2 || 
                API._history[lastIdx - 2].text !== query || 
                API._history[lastIdx - 1].text !== cached.response) {
                API._history.push({ role: 'user',  text: query });
                API._history.push({ role: 'model', text: cached.response });
            }
            
            // Ir directo a estado final sin animaciones extra
            Output.reset();
            System.setState('IDLE');
            
            mainInput.placeholder = 'Nueva secuencia...';
            return;
        }

        // Capture query, clear and lock input
        mainInput.blur();
        mainInput.disabled = true;
        mainInput.value = '';
        mainInput.placeholder = query; // echo query in placeholder while compressed

        // Run the full Thought Anatomy arc
        await Output.reveal(query);

        // Re-enable
        mainInput.disabled = false;
        mainInput.placeholder = 'Nueva secuencia...';
        mainInput.focus();
    });

    // ── Escape — collapse anatomy, restart ────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (System.state === 'COMPLETE' || isBusy()) {
                if (!isBusy()) {
                    Output.reset();
                    mainInput.value = '';
                    mainInput.placeholder = 'Inicia la secuencia...';
                    System.setState('IDLE');
                }
            }
            mainInput.blur();
            return;
        }

        // Any printable key focuses the input (when idle/active/complete)
        if (!isBusy() &&
            document.activeElement !== mainInput &&
            e.key.length === 1 &&
            !e.metaKey && !e.ctrlKey) {
            mainInput.focus();
        }
    });

    // ── Typing Pulse ──────────────────────────────────────────────────────
    function triggerPulse() {
        inputPortal.classList.remove('typing-pulse');
        void inputPortal.offsetWidth; // force reflow
        inputPortal.classList.add('typing-pulse');
    }

});


