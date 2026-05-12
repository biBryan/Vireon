const System = {
    // IDLE → ACTIVE → LISTENING → SUBMITTING → ANALYZING → CRYSTALLIZING → COMPLETE
    state: 'IDLE',
    history: [],

    elements: {
        get body()       { return document.getElementById('system-body'); },
        get status()     { return document.getElementById('system-status'); },
        get dot()        { return document.getElementById('status-dot'); },
        get surface()    { return document.getElementById('ui-surface'); },
        get input()      { return document.getElementById('system-input'); },
        get portal()     { return document.getElementById('input-container'); },
        get processing() { return document.getElementById('processing-stage'); },
        get fill()       { return document.getElementById('processing-fill'); },
        get anatomy()    { return document.getElementById('thought-anatomy'); },
        get promptOut()  { return document.getElementById('prompt-output'); },
    },

    _allStateClasses: [
        'system-active', 'system-submitting', 'system-processing',
        'system-analyzing', 'system-crystallizing', 'system-responding',
        'system-complete'
    ],

    setState(newState) {
        const prev = this.state;
        this.state = newState;
        this.history.push({ from: prev, to: newState, t: Date.now() });
        this._applyState();
    },

    _applyState() {
        const { body, status, dot } = this.elements;

        body.classList.remove(...this._allStateClasses);

        const dotDefault = () => {
            dot.style.background = 'var(--silver)';
            dot.style.boxShadow  = '0 0 10px var(--silver)';
        };
        const dotDim = () => {
            dot.style.background = 'var(--smoke)';
            dot.style.boxShadow  = 'none';
        };
        const dotPulse = () => {
            dot.style.background = 'rgba(200,200,200,0.9)';
            dot.style.boxShadow  = '0 0 14px rgba(220,220,220,0.5)';
        };
        // Indicador ámbar sutil para modo demo
        const dotDemo = () => {
            dot.style.background = 'rgba(200,170,100,0.7)';
            dot.style.boxShadow  = '0 0 10px rgba(200,170,100,0.3)';
        };

        // Detectar modo demostración
        const isDemo = (typeof API !== 'undefined' && API.backendAvailable === false);

        switch (this.state) {
            case 'IDLE':
                if (isDemo) {
                    dotDemo();
                    status.textContent = 'Modo demostración';
                } else {
                    dotDim();
                    status.textContent = 'Sistema en reposo';
                }
                break;
            case 'ACTIVE':
                body.classList.add('system-active');
                if (isDemo) { dotDemo(); } else { dotDefault(); }
                status.textContent = isDemo ? 'Demo · Activo' : 'Sistema despierto';
                break;
            case 'LISTENING':
                body.classList.add('system-active');
                if (isDemo) { dotDemo(); } else { dotDefault(); }
                status.textContent = 'Escuchando';
                break;
            case 'SUBMITTING':
                body.classList.add('system-active', 'system-submitting');
                dotPulse();
                status.textContent = 'Señal recibida';
                break;
            case 'ANALYZING':
                body.classList.add('system-active', 'system-analyzing');
                dotPulse();
                status.textContent = 'Analizando';
                break;
            case 'CRYSTALLIZING':
                body.classList.add('system-active', 'system-crystallizing');
                dotPulse();
                status.textContent = 'Sintetizando';
                break;
            case 'COMPLETE':
                body.classList.add('system-active', 'system-complete');
                if (isDemo) { dotDemo(); } else { dotDefault(); }
                status.textContent = 'Respuesta completada';
                break;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('%c[ SYSTEM ] Phase 3 — Thought Anatomy', 'color:#888;font-family:monospace;font-size:11px');
    System.setState('IDLE');

    // Verificar backend disponible (no bloquea la UI)
    if (typeof API !== 'undefined' && typeof API.checkBackend === 'function') {
        API.checkBackend().then(() => {
            // Re-aplicar estado para reflejar resultado del check
            System._applyState();
        });
    }
});

