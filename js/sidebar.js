/**
 * sidebar.js — Phase 7B: Hybrid Sidebar for VIREON
 *
 * Renders the sidebar DOM, wires toggle and command buttons.
 *
 * Design decisions:
 *   - Sidebar DOM is built in JS (not HTML) to keep index.html minimal
 *     and avoid merge conflicts with future phases.
 *   - All command actions delegate to the Commands object (commands.js)
 *     so there is zero logic duplication.
 *   - Commands that return Markdown text are rendered into the history
 *     via Output.addToHistory(), same as typing them in the input.
 *   - /clear is special: it calls Commands.clear() directly (no text).
 *   - Placeholder items (search, library, recents) are visually present
 *     but non-functional — ready for future phases.
 *
 * Load order: after commands.js, before or after interactions.js
 * ─────────────────────────────────────────────────────────────────
 */

const Sidebar = (() => {

    // ── Configuration ─────────────────────────────────────────────
    const COMMANDS = [
        { icon: '＋',  label: 'Nueva conversación', action: 'clear',    tooltip: 'Nueva' },
        { icon: '？',  label: 'Ayuda',              action: 'help',     tooltip: 'Ayuda' },
        { icon: '◉',  label: 'Estado del sistema',  action: 'status',   tooltip: 'Estado' },
        { icon: '◈',  label: 'Modelo activo',       action: 'model',    tooltip: 'Modelo' },
    ];

    const RECENT_PLACEHOLDERS = [
        'Conversación anterior…',
        'Diseño de interfaz…',
        'Consulta de sistema…',
    ];

    let sidebarEl = null;
    let coreDisplayEl = null;
    let isExpanded = false;

    // ── Build DOM ─────────────────────────────────────────────────
    function _buildSidebar() {
        const sidebar = document.createElement('aside');
        sidebar.className = 'vireon-sidebar';
        sidebar.id = 'vireon-sidebar';
        sidebar.setAttribute('role', 'navigation');
        sidebar.setAttribute('aria-label', 'Panel operativo de VIREON');

        // Toggle button
        const toggle = document.createElement('button');
        toggle.className = 'sidebar-toggle';
        toggle.id = 'sidebar-toggle';
        toggle.innerHTML = `
            <span class="toggle-icon">
                <span></span>
                <span></span>
                <span></span>
            </span>
        `;
        sidebar.appendChild(toggle);

        // Content wrapper
        const content = document.createElement('div');
        content.className = 'sidebar-content';

        // ── Header Branding
        const headerBranding = document.createElement('div');
        headerBranding.className = 'sidebar-branding';
        headerBranding.innerHTML = `
            <svg class="vireon-mini-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 25,25 L 50,75 L 75,25" fill="none" stroke="url(#vireon-silver)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="vireon-sidebar-wordmark" viewBox="0 0 540 100" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" stroke="url(#vireon-silver)" stroke-width="10" stroke-linecap="butt" stroke-linejoin="miter">
                    <path d="M 30,20 L 56,75" />
                    <path d="M 90,20 L 64,75" />
                    <path d="M 130,20 L 130.01,45" />
                    <path d="M 130,55 L 130.01,80" />
                    <path d="M 170,20 L 170.01,80" />
                    <path d="M 185,20 L 205,20 A 15,15 0 0,1 220,35 A 15,15 0 0,1 205,50 L 185,50" />
                    <path d="M 200,60 L 220,80" />
                    <path d="M 260,20 L 260.01,40" />
                    <path d="M 260,60 L 260.01,80" />
                    <path d="M 260,20 L 310,20.01" />
                    <path d="M 275,50 L 300,50.01" />
                    <path d="M 260,80 L 310,80.01" />
                    <circle cx="380" cy="50" r="30" stroke-dasharray="173.5 15" stroke-dashoffset="-15" />
                    <path d="M 450,35 L 450.01,80" />
                    <path d="M 450,20 L 510,80" />
                    <path d="M 510,20 L 510.01,65" />
                </g>
            </svg>
        `;
        content.appendChild(headerBranding);

        // Divider
        content.appendChild(_divider());

        // ── Acciones del Sistema
        content.appendChild(_sectionLabel('Sistema'));

        COMMANDS.forEach(cmd => {
            const btn = _createItem(cmd.icon, cmd.label, cmd.tooltip);
            btn.addEventListener('click', () => {
                if (typeof CoreActions !== 'undefined') {
                    if (cmd.action === 'clear') {
                        CoreActions.resetSession();
                        if (coreDisplayEl) coreDisplayEl.classList.remove('active');
                    } else {
                        const response = CoreActions.executeCommand(cmd.action);
                        if (response && response.type === 'display' && coreDisplayEl) {
                            const contentEl = coreDisplayEl.querySelector('.core-display-content');
                            contentEl.innerHTML = (typeof Markdown !== 'undefined') ? Markdown.parse(response.content) : response.content;
                            coreDisplayEl.classList.add('active');
                            if (!isExpanded) _toggle();
                        }
                    }
                }
            });
            content.appendChild(btn);
        });

        // ── Core Display Panel
        coreDisplayEl = document.createElement('div');
        coreDisplayEl.className = 'sidebar-core-display';
        coreDisplayEl.innerHTML = `
            <div class="core-display-header">
                <span class="core-display-title">CORE DISPLAY</span>
                <button class="core-display-close">✕</button>
            </div>
            <div class="core-display-content prompt-text"></div>
        `;
        coreDisplayEl.querySelector('.core-display-close').addEventListener('click', () => {
            coreDisplayEl.classList.remove('active');
        });
        content.appendChild(coreDisplayEl);

        // Divider
        content.appendChild(_divider());

        // ── Herramientas (Placeholders)
        content.appendChild(_sectionLabel('Herramientas'));
        const searchBtn = _createItem('⌕', 'Buscar', 'Próx.');
        searchBtn.style.cursor = 'default';
        searchBtn.innerHTML += '<span class="sidebar-badge-placeholder">Próx.</span>';
        content.appendChild(searchBtn);

        const libBtn = _createItem('◫', 'Biblioteca', 'Próx.');
        libBtn.style.cursor = 'default';
        libBtn.innerHTML += '<span class="sidebar-badge-placeholder">Próx.</span>';
        content.appendChild(libBtn);

        // Divider
        content.appendChild(_divider());

        // ── Recent chats placeholder
        content.appendChild(_sectionLabel('Recientes'));

        const recentList = document.createElement('div');
        recentList.className = 'sidebar-recent-placeholder';

        RECENT_PLACEHOLDERS.forEach(text => {
            const item = document.createElement('div');
            item.className = 'sidebar-recent-item sidebar-item';
            item.innerHTML = `
                <span class="sidebar-item-icon">○</span>
                <span class="sidebar-item-label">${text}</span>
            `;
            recentList.appendChild(item);
        });

        content.appendChild(recentList);

        sidebar.appendChild(content);

        // ── Footer (Config)
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        const configBtn = _createItem('⚙', 'Configuración', 'Próx.');
        configBtn.style.cursor = 'default';
        configBtn.innerHTML += '<span class="sidebar-badge-placeholder">Próx.</span>';
        footer.appendChild(configBtn);
        sidebar.appendChild(footer);

        return sidebar;
    }

    function _createItem(icon, label, tooltip) {
        const btn = document.createElement('button');
        btn.className = 'sidebar-item operational-unit';
        btn.setAttribute('data-tooltip', tooltip);
        btn.innerHTML = `
            <span class="sidebar-item-icon">${icon}</span>
            <span class="sidebar-item-label">${label}</span>
        `;
        return btn;
    }

    function _sectionLabel(text) {
        const el = document.createElement('div');
        el.className = 'sidebar-section-label';
        el.textContent = text;
        return el;
    }

    function _divider() {
        const el = document.createElement('div');
        el.className = 'sidebar-divider';
        return el;
    }

    // ── Toggle logic ──────────────────────────────────────────────
    function _toggle() {
        isExpanded = !isExpanded;

        if (isExpanded) {
            sidebarEl.classList.add('expanded');
            document.body.classList.add('sidebar-expanded');
        } else {
            sidebarEl.classList.remove('expanded');
            document.body.classList.remove('sidebar-expanded');
        }
    }

    // ── Init ──────────────────────────────────────────────────────
    function init() {
        sidebarEl = _buildSidebar();

        const body = document.getElementById('system-body');
        body.insertBefore(sidebarEl, body.querySelector('.system-container'));

        const toggleBtn = document.getElementById('sidebar-toggle');
        toggleBtn.addEventListener('click', _toggle);

        console.log('%c[ SIDEBAR ] Cleaned Structural Core', 'color:#666;font-family:monospace;font-size:11px');
    }

    // ── Public API ────────────────────────────────────────────────
    return {
        init,
        toggle: _toggle,
        get isExpanded() { return isExpanded; }
    };

})();

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    Sidebar.init();
});
