/**
 * output.js — Orquestador visual de la respuesta de IA.
 *
 * Responsabilidades:
 *   1. Manejar la animación de estados mientras espera la API.
 *   2. Poblar las filas de estado visual (Engine.buildStatusRows).
 *   3. Llamar a API.send() para obtener la respuesta real.
 *   4. Revelar la respuesta con el mismo diseño premium existente.
 *   5. Gestionar errores y mostrarlos con el mismo lenguaje visual.
 *
 * NO interpreta ni modifica el contenido de la respuesta.
 * Lo que llega de la IA es lo que se muestra.
 */

const Output = {

    _getTimestamp() {
        const n = new Date();
        return [n.getHours(), n.getMinutes(), n.getSeconds()]
            .map(v => String(v).padStart(2, '0'))
            .join(':');
    },

    /**
     * Typewriter con varianza orgánica por carácter.
     * Para el cuerpo de respuesta usa velocidad más alta
     * ya que la respuesta puede ser larga.
     */
    _typewrite(el, text, speed = 12) {
        return new Promise(resolve => {
            el.textContent = '';
            let i = 0;
            const tick = () => {
                if (i < text.length) {
                    el.textContent += text[i++];
                    const ch = text[i - 1];
                    // Pausa breve en puntuación — mantiene la sensación deliberada
                    const pause = /[.!?\n]/.test(ch)
                        ? speed * 5
                        : /[,;:]/.test(ch)
                            ? speed * 2
                            : speed + Math.random() * 6;
                    setTimeout(tick, pause);
                } else {
                    resolve();
                }
            };
            tick();
        });
    },

    _animateFill(targetW, durationMs) {
        const fill = System.elements.fill;
        fill.style.transition = `width ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        fill.style.width = targetW + '%';
    },

    _resetFill() {
        const fill = System.elements.fill;
        fill.style.transition = 'none';
        fill.style.width = '0%';
    },

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

    /**
     * Secuencia principal. Llamada desde interactions.js al presionar Enter.
     * @param {string} query — Lo que escribió el usuario.
     */
    async reveal(query) {
        const { processing, anatomy, promptOut, portal } = System.elements;
        const rowsContainer = document.getElementById('anatomy-rows');
        const synthSep = document.getElementById('synthesis-sep');
        const promptText = document.getElementById('prompt-text');
        const promptTs = document.getElementById('prompt-timestamp');

        // ── 1. SUBMITTING ─────────────────────────────────────────────────
        System.setState('SUBMITTING');
        portal.classList.add('compressed');
        await this._sleep(300);

        // ── 2. Iniciar scan + mostrar filas de estado ──────────────────────
        processing.classList.add('visible');
        this._resetFill();
        await this._sleep(40);
        this._animateFill(25, 500);

        System.setState('ANALYZING');
        anatomy.classList.add('visible');
        rowsContainer.innerHTML = '';
        await this._sleep(200);

        // Construir filas con datos reales del contexto de la request
        const statusRows = Engine.buildStatusRows(query);
        const rowEls = [];

        for (let i = 0; i < statusRows.length; i++) {
            const { label, value } = statusRows[i];
            const row = this._buildRow(label, value);
            rowsContainer.appendChild(row);
            await this._sleep(50);
            row.classList.add('row-visible');

            // Typewrite el valor de las primeras 3 filas (la 4ª se actualiza live)
            const contentEl = row.querySelector('.thought-content');
            if (i < 3) {
                await this._typewrite(contentEl, value, 14);
            }

            if (i < statusRows.length - 1) {
                const sep = row.querySelector('.row-separator');
                if (sep) { await this._sleep(60); sep.classList.add('sep-visible'); }
            }

            rowEls.push({ row, contentEl, key: statusRows[i].key });
            await this._sleep(80);
        }

        // Fila de ESTADO: actualizar a "En espera" mientras avanza el fill
        const statusEl = rowEls.find(r => r.key === 'status')?.contentEl;
        if (statusEl) statusEl.textContent = 'En espera de respuesta';
        this._animateFill(55, 800);

        // ── 3. Llamar a la API real ──────────────────────────────────────────
        let aiResponse;
        const t0 = Date.now();

        try {
            // El fill avanza lentamente hasta 90% mientras espera
            this._animateFill(90, 25000);
            if (statusEl) statusEl.textContent = 'Procesando';

            aiResponse = await API.send(query);

            // [Fase 4/5: Cache Exacto e Inteligente] Guardar en cache si es válido
            if (Cache.isValid(aiResponse)) {
                Cache.set(query, aiResponse, API.config);
            }

        } catch (err) {
            // [Fase 6B: Fallback Offline Mínimo]
            const currentMode = API.config.responseMode || 'normal';
            let fallback = Cache.get(query, currentMode);
            if (!fallback) fallback = Cache.getSimilar(query, currentMode);

            // Detectar si es modo demostración (backend intencionalmente ausente)
            const isDemoMode = err.message && err.message.startsWith('[offline]');

            if (fallback) {
                // Recuperación exitosa desde cache offline
                const aiResponse = fallback.response;
                
                this._animateFill(100, 200);
                await this._sleep(300);
                processing.classList.remove('visible');

                if (statusEl) statusEl.textContent = isDemoMode ? 'Modo Demo (Cache)' : 'Modo Offline (Cache)';

                System.setState('CRYSTALLIZING');
                await this._sleep(200);

                synthSep.classList.add('sep-visible');
                await this._sleep(450);

                promptOut.classList.remove('error-state');
                promptOut.classList.add('visible');
                promptTs.textContent = this._getTimestamp();
                await this._sleep(80);

                promptText.innerHTML = Markdown.parse(aiResponse);

                await this._sleep(350);
                System.setState('COMPLETE');

                // No se añade al API._history: las respuestas offline/cache
                // no deben contaminar el contexto que se envía a Gemini.

                this.addToHistory(query, aiResponse, false);
                this.reset();
                return;
            }

            // Sin cache disponible — mostrar estado elegante según contexto
            this._animateFill(100, 200);
            await this._sleep(250);
            processing.classList.remove('visible');
            if (statusEl) statusEl.textContent = isDemoMode ? 'Modo Demostración' : 'Núcleo inaccesible';

            await this._sleep(300);
            System.setState('CRYSTALLIZING');
            synthSep.classList.add('sep-visible');
            await this._sleep(400);

            promptOut.classList.add('visible');
            promptOut.classList.remove('error-state'); // Mensaje elegante, no error crudo
            promptTs.textContent = this._getTimestamp();

            const offlineMsg = isDemoMode
                ? "VIREON está funcionando en **modo demostración**. La interfaz está completamente operativa, pero el núcleo de IA no está conectado. Para activar respuestas inteligentes, conecta el backend con `node server.js`."
                : "Conexión con el núcleo externo no disponible. No tengo memoria local suficiente para responder eso con precisión.";

            promptText.innerHTML = Markdown.parse(offlineMsg);

            await this._sleep(1000);
            // Mostrar en historial como respuesta normal elegante
            this.addToHistory(query, offlineMsg, false);
            System.setState('COMPLETE');
            this.reset();
            return;
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1) + 's';

        // ── 4. CRYSTALLIZING: revelar respuesta real ──────────────────────────
        this._animateFill(100, 200);
        await this._sleep(300);
        processing.classList.remove('visible');

        if (statusEl) statusEl.textContent = `Recibido · ${elapsed}`;

        System.setState('CRYSTALLIZING');
        await this._sleep(200);

        synthSep.classList.add('sep-visible');
        await this._sleep(450);

        // Revelar bloque de respuesta
        promptOut.classList.remove('error-state');
        promptOut.classList.add('visible');
        promptTs.textContent = this._getTimestamp();
        await this._sleep(80);

        // Renderizar la respuesta con Markdown
        promptText.innerHTML = Markdown.parse(aiResponse);
        // El fade-in viene del transition de .prompt-output.visible (ya activo en este punto)

        // ── 5. COMPLETE ───────────────────────────────────────────────────────
        await this._sleep(350);
        System.setState('COMPLETE');

        // Commit a la historia y limpiar la vista activa
        await this._sleep(800);
        this.addToHistory(query, aiResponse, false);
        this.reset();
    },

    addToHistory(query, response, isError = false) {
        const container = document.getElementById('history-container');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'history-entry';

        // Markdown o raw (para errores raw en json, pero usamos nuestro parser)
        let parsedResponse = '';
        if (isError) {
            parsedResponse = Markdown.parse(`**Error de procesamiento**\n\n\`\`\`json\n${response}\n\`\`\``);
        } else {
            parsedResponse = Markdown.parse(response);
        }

        entry.innerHTML = `
            <div class="history-user">
                <div class="history-label">USER //</div>
                <div class="history-text">${Markdown._esc(query)}</div>
            </div>
            <div class="history-ai prompt-text">
                <div class="history-label">VIREON CORE //</div>
                ${parsedResponse}
            </div>
        `;

        container.appendChild(entry);
        this._scrollToBottom();
    },

    _scrollToBottom() {
        const sysContainer = document.querySelector('.system-container');
        if (sysContainer) {
            // Scroll suave hacia abajo para mantener el input a la vista
            sysContainer.scrollTo({
                top: sysContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    },

    _buildRow(label, value) {
        const row = document.createElement('div');
        row.className = 'thought-row';
        row.innerHTML = `
            <span class="thought-label">${label}</span>
            <span class="thought-arrow">—</span>
            <span class="thought-content"></span>
            <div class="row-separator"></div>
        `;
        return row;
    },

    _bindCopy(text) {
        const block = document.getElementById('prompt-output');
        const hint = document.getElementById('copy-hint');

        // Remover listeners previos clonando el nodo
        const fresh = block.cloneNode(true);
        block.parentNode.replaceChild(fresh, block);

        fresh.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                const h = document.getElementById('copy-hint');
                h.textContent = 'COPIADO';
                h.classList.add('copied');
                setTimeout(() => {
                    h.textContent = 'COPIAR';
                    h.classList.remove('copied');
                }, 1800);
            } catch { /* Clipboard puede requerir gesto de usuario */ }
        });
    },

    /**
     * Reset completo para la siguiente consulta.
     */
    reset() {
        const { processing, anatomy, portal } = System.elements;
        const promptOut = document.getElementById('prompt-output');
        const synthSep = document.getElementById('synthesis-sep');
        const hint = document.getElementById('copy-hint');
        const rows = document.getElementById('anatomy-rows');
        const promptText = document.getElementById('prompt-text');
        const promptTs = document.getElementById('prompt-timestamp');

        API.abort();

        portal.classList.remove('compressed');
        anatomy.classList.remove('visible');
        if (promptOut) { promptOut.classList.remove('visible', 'error-state'); }
        if (processing) { processing.classList.remove('visible', 'done'); }
        if (synthSep) { synthSep.classList.remove('sep-visible'); }
        if (rows) { rows.innerHTML = ''; }
        if (hint) { hint.textContent = 'COPIAR'; hint.classList.remove('copied'); }
        if (promptText) { promptText.innerHTML = ''; }
        if (promptTs) { promptTs.textContent = ''; }

        this._resetFill();
    },

};
