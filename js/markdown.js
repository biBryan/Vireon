/**
 * markdown.js — Parser Markdown liviano para VIREON.
 *
 * Soporta:
 *   # ## ### → h1 h2 h3
 *   **bold** → <strong>
 *   *italic* → <em>
 *   `inline code` → <code>
 *   ```code block``` → <pre><code>
 *   - item / * item → <ul><li>
 *   1. item → <ol><li>
 *   blank lines → separación de párrafos
 *
 * Sin dependencias externas. XSS-safe: escapa HTML antes de insertar.
 */

const Markdown = {

    /**
     * Convierte texto Markdown a HTML seguro.
     * @param {string} raw — Texto con Markdown.
     * @returns {string} — HTML listo para innerHTML.
     */
    parse(raw) {
        if (!raw) return '';

        let text = raw;

        // ── 1. Extraer bloques de código fenced para protegerlos ──────────────
        const codeBlocks = [];
        text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push({ lang: (lang || '').trim(), code: code.trimEnd() });
            return `\x00CODE_BLOCK_${idx}\x00`;
        });

        // ── 2. Procesar línea por línea (bloques) ─────────────────────────────
        const lines  = text.split('\n');
        const output = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Placeholder de bloque de código — procesado después
            if (/\x00CODE_BLOCK_\d+\x00/.test(line)) {
                output.push(line);
                i++;
                continue;
            }

            // Encabezados
            const h3 = line.match(/^### (.+)/);
            const h2 = line.match(/^## (.+)/);
            const h1 = line.match(/^# (.+)/);
            if (h1) { output.push(`<h1 class="md-h1">${this._inline(h1[1])}</h1>`); i++; continue; }
            if (h2) { output.push(`<h2 class="md-h2">${this._inline(h2[1])}</h2>`); i++; continue; }
            if (h3) { output.push(`<h3 class="md-h3">${this._inline(h3[1])}</h3>`); i++; continue; }

            // Lista no ordenada
            if (/^[-*] /.test(line)) {
                const items = [];
                while (i < lines.length && /^[-*] /.test(lines[i])) {
                    items.push(`<li>${this._inline(lines[i].replace(/^[-*]\s/, ''))}</li>`);
                    i++;
                }
                output.push(`<ul class="md-ul">${items.join('')}</ul>`);
                continue;
            }

            // Lista ordenada
            if (/^\d+\.\s/.test(line)) {
                const items = [];
                while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                    items.push(`<li>${this._inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
                    i++;
                }
                output.push(`<ol class="md-ol">${items.join('')}</ol>`);
                continue;
            }

            // Línea vacía → separador de párrafo
            if (line.trim() === '') {
                // Evitar separadores dobles consecutivos
                if (output.length > 0 && output[output.length - 1] !== '<div class="md-sep"></div>') {
                    output.push('<div class="md-sep"></div>');
                }
                i++;
                continue;
            }

            // Párrafo normal
            output.push(`<p class="md-p">${this._inline(line)}</p>`);
            i++;
        }

        let html = output.join('');

        // ── 3. Restaurar bloques de código ────────────────────────────────────
        html = html.replace(/\x00CODE_BLOCK_(\d+)\x00/g, (_, idx) => {
            const { lang, code } = codeBlocks[Number(idx)];
            const escaped    = this._esc(code);
            const escapedLang = this._esc(lang); // defensa en profundidad, \w* ya filtra
            const langAttr   = escapedLang ? ` data-lang="${escapedLang}"` : '';
            return `<pre class="md-pre"${langAttr}><code class="md-code">${escaped}</code></pre>`;
        });

        return html;
    },

    /** Procesa Markdown inline: código, negritas, cursivas. XSS-safe. */
    _inline(text) {
        // 1. Extraer código inline para proteger su contenido
        const codes = [];
        text = text.replace(/`([^`]+)`/g, (_, c) => {
            const idx = codes.length;
            codes.push(this._esc(c));
            return `\x00IC_${idx}\x00`;
        });

        // 2. ESCAPAR todo el HTML crudo antes de aplicar cualquier regex.
        //    Los placeholders \x00IC_N\x00 sobreviven intactos porque solo
        //    contienen \x00, letras, _ y dígitos — ninguno es &, <, > o ".
        //    SIN este paso, <script>, <img onerror=...>, etc. se inyectan en el DOM.
        text = this._esc(text);

        // 3. Aplicar Markdown inline (solo sobre texto ya escapado)
        //    Ahora **bold** = \*\*bold\*\* en texto escapado — los * no se tocan.
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g,          '<em>$1</em>');

        // 4. Restaurar código inline (contenido ya escapado en paso 1)
        text = text.replace(/\x00IC_(\d+)\x00/g, (_, idx) => {
            return `<code class="md-ic">${codes[Number(idx)]}</code>`;
        });

        return text;
    },

    /** Escapa caracteres HTML para evitar XSS. */
    _esc(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
};
