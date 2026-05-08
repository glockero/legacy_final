let dAud =[], dAudFiltrada =[], tLogout, tsDB = 0, ultimoDashboard = null, dataUsuarios = [], audPageData = [];
let audPage = 1, audPageSize = 50;
let modalSlotActivo = -1; 
let modalModo = "";
let modalConfirmAction = null;
let modalInputAction = null;
let pendingDbRestoreFile = null;
const liveClockFormatter = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

const rT = () => { clearTimeout(tLogout); tLogout = setTimeout(()=>window.location.href='/logout', 300000); };
window.onload=rT; document.onmousemove=rT; document.onkeypress=rT; document.onscroll=rT; document.ontouchstart=rT;
localStorage.setItem('tema_ag', 'claro');
document.body.classList.remove('dark');

let serverTimeOffset = 0;

function updateLiveClock() {
    const clock = document.getElementById('live-clock');
    if(!clock) return;
    const now = new Date();
    const serverNow = new Date(now.getTime() + serverTimeOffset);
    clock.textContent = liveClockFormatter.format(serverNow);
}

async function updateClima() {
    try {
        const r = await fetch('/api/clima');
        if(r.status !== 200) return;
        const d = await r.json();
        const el = document.getElementById('header-clima');
        if(!el) return;
        let parts = [];
        if(d.temperatura !== null && d.temperatura !== undefined) parts.push(`T: ${d.temperatura}C`);
        if(d.humedad !== null && d.humedad !== undefined) parts.push(`H: ${d.humedad}%`);
        if(d.ip) parts.push(`IP: ${d.ip}`);
        el.textContent = parts.join(' | ');
    } catch(e) {
        // silencioso
    }
}

function ajustarTamanoModal(size = 'compact') {
    const modalBox = document.getElementById('modal-box');
    if(!modalBox) return;
    modalBox.classList.remove('modal-compact', 'modal-medium', 'modal-wide');
    modalBox.classList.add(`modal-${size}`);
}

function initHeaderSidebar() {
    const headerInfo = document.getElementById('header-info');
    if(!headerInfo || headerInfo.querySelector('.side-nav')) return;
    const systemMenu = document.getElementById('system-menu');
    const logoutBtn = headerInfo.querySelector('.btn-logout');
    const perfilBtn = headerInfo.querySelector('.btn-perfil');
    if(systemMenu) {
        systemMenu.classList.add('legacy-hide');
        systemMenu.innerHTML = `
            <option value="">Sistema</option>
            <option value="host">Estado Raspberry</option>
            <option value="logs">Logs de sistema</option>
            <option value="db">Base de datos</option>
            <option value="reboot_host">Reboot Raspberry</option>`;
    }
    if(perfilBtn) perfilBtn.classList.add('legacy-hide');
    if(logoutBtn) logoutBtn.classList.add('legacy-hide');
    const menuSection = document.createElement('div');
    menuSection.className = 'menu-section';
    menuSection.innerHTML = `
        <div class="side-nav" id="primary-side-nav">
            <div class="side-nav-glider" aria-hidden="true"></div>
            <button class="side-nav-btn active" data-tab-target="tab-control" onclick="openTab('tab-control', this); closeMenu();">
                <span class="side-nav-btn-icon">🕹️</span>
                <span class="side-nav-btn-copy"><strong>Control</strong><small>Panel operativo</small></span>
                <span class="side-nav-btn-dot"></span>
            </button>
            <button class="side-nav-btn" data-tab-target="tab-auditoria" onclick="openTab('tab-auditoria', this); closeMenu();">
                <span class="side-nav-btn-icon">📊</span>
                <span class="side-nav-btn-copy"><strong>Auditoría</strong><small>Movimientos y trazas</small></span>
                <span class="side-nav-btn-dot"></span>
            </button>
            <button class="side-nav-btn admin-only" data-tab-target="tab-usuarios" onclick="openTab('tab-usuarios', this); closeMenu();" style="display:none;">
                <span class="side-nav-btn-icon">👥</span>
                <span class="side-nav-btn-copy"><strong>Usuarios</strong><small>Accesos y límites</small></span>
                <span class="side-nav-btn-dot"></span>
            </button>
            <button class="side-nav-btn legacy-hide" data-tab-target="tab-perfil" onclick="openTab('tab-perfil', this); closeMenu();">
                <span class="side-nav-btn-icon">👤</span>
                <span class="side-nav-btn-copy"><strong>Perfil</strong><small>Datos de sesión</small></span>
                <span class="side-nav-btn-dot"></span>
            </button>
            <details class="system-details">
                <summary>⚙️ Sistema</summary>
                <div class="system-actions">
                    <button type="button" class="btn-download" onclick="menuSistema('host')">Estado Raspberry</button>
                    <button type="button" class="btn-download" onclick="menuSistema('logs')">Logs de sistema</button>
                    <button type="button" class="btn-download" onclick="menuSistema('db')">Base de datos</button>
                    <button type="button" class="btn-reboot admin-only" onclick="menuSistema('reboot_host')" style="display:none;">Reboot Raspberry</button>
                </div>
            </details>
            <button class="side-nav-btn btn-logout" onclick="window.location.href='/logout'">
                <span class="side-nav-btn-icon">↩️</span>
                <span class="side-nav-btn-copy"><strong>Salir</strong><small>Cerrar sesión segura</small></span>
                <span class="side-nav-btn-dot"></span>
            </button>
        </div>`;
    headerInfo.insertBefore(menuSection, logoutBtn || null);
    const topTabs = document.querySelectorAll('.tab-btn');
    if(topTabs[0]) topTabs[0].dataset.tabTarget = 'tab-control';
    if(topTabs[1]) topTabs[1].dataset.tabTarget = 'tab-auditoria';
    if(topTabs[2]) topTabs[2].dataset.tabTarget = 'tab-usuarios';
    initSideNavEffects();
    syncSideNavGlider();
}

function syncSideNavGlider(activeId) {
    const nav = document.getElementById('primary-side-nav');
    const glider = nav ? nav.querySelector('.side-nav-glider') : null;
    if(!nav || !glider) return;
    const activeBtn = activeId
        ? nav.querySelector(`.side-nav-btn[data-tab-target="${activeId}"].active`)
        : nav.querySelector('.side-nav-btn.active');
    if(!activeBtn || activeBtn.classList.contains('legacy-hide') || activeBtn.style.display === 'none') {
        glider.style.opacity = '0';
        return;
    }
    glider.style.opacity = '1';
    glider.style.height = `${activeBtn.offsetHeight}px`;
    glider.style.transform = `translateY(${activeBtn.offsetTop}px)`;
}

function initSideNavEffects() {
    const nav = document.getElementById('primary-side-nav');
    if(!nav || nav.dataset.enhanced === 'true') return;
    nav.dataset.enhanced = 'true';
    nav.querySelectorAll('.side-nav-btn').forEach((btn) => {
        btn.addEventListener('pointermove', (ev) => {
            const rect = btn.getBoundingClientRect();
            btn.style.setProperty('--mx', `${ev.clientX - rect.left}px`);
            btn.style.setProperty('--my', `${ev.clientY - rect.top}px`);
        });
        btn.addEventListener('pointerleave', () => {
            btn.style.removeProperty('--mx');
            btn.style.removeProperty('--my');
        });
    });
}

function animateActiveSideNav(btn) {
    if(!btn || !btn.classList.contains('side-nav-btn')) return;
    btn.classList.remove('active-bump');
    void btn.offsetWidth;
    btn.classList.add('active-bump');
    setTimeout(() => btn.classList.remove('active-bump'), 420);
}

function toggleMenu() {
    const menu = document.getElementById('header-info');
    const toggle = document.getElementById('mobile-toggle');
    const isOpen = menu.classList.toggle('active');
    toggle.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('menu-open', isOpen);
}

function closeMenu() {
    const menu = document.getElementById('header-info');
    const toggle = document.getElementById('mobile-toggle');
    if(!menu || !toggle) return;
    menu.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú');
    document.body.classList.remove('menu-open');
}

function abrirModalSimple(titulo, html, size = 'compact') {
    ajustarTamanoModal(size);
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function abrirModalMensaje(titulo, mensaje, tipo = 'info') {
    const color = tipo === 'error' ? '#b91c1c' : tipo === 'success' ? '#16a34a' : '#1d4ed8';
    abrirModalSimple(titulo, `
        <div style="padding:18px; text-align:center;">
            <p style="margin:0 0 16px; color:${color}; font-weight:700; white-space:pre-wrap;">${escapeHtml(mensaje)}</p>
            <button class="btn-info" type="button" onclick="cerrarModal()">Cerrar</button>
        </div>`);
}

function abrirModalConfirmacion(titulo, mensaje, onConfirmLabel = 'Confirmar') {
    abrirModalSimple(titulo, `
        <div style="padding:18px; text-align:center;">
            <p style="margin:0 0 18px; white-space:pre-wrap;">${escapeHtml(mensaje)}</p>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="btn-quitar" type="button" onclick="cancelarModalConfirmacion()">Cancelar</button>
                <button class="btn-info" type="button" onclick="ejecutarModalConfirmacion()">${escapeHtml(onConfirmLabel)}</button>
            </div>
        </div>`);
}

function abrirModalEntrada(titulo, mensaje, valorInicial = '', onConfirmLabel = 'Guardar', placeholder = '') {
    abrirModalSimple(titulo, `
        <div style="padding:18px;">
            <p style="margin:0 0 14px; white-space:pre-wrap;">${escapeHtml(mensaje)}</p>
            <input type="text" id="modal-input-field" value="${escapeHtml(valorInicial)}" placeholder="${escapeHtml(placeholder)}" style="width:100%; margin:0 0 16px;">
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-quitar" type="button" onclick="cancelarModalEntrada()">Cancelar</button>
                <button class="btn-info" type="button" onclick="ejecutarModalEntrada()">${escapeHtml(onConfirmLabel)}</button>
            </div>
        </div>`);
    const input = document.getElementById('modal-input-field');
    if(input) {
        input.focus();
        input.select();
        input.addEventListener('keydown', (ev) => {
            if(ev.key === 'Enter') ejecutarModalEntrada();
        });
    }
}

function cancelarModalConfirmacion() {
    modalConfirmAction = null;
    cerrarModal();
}

function cancelarModalEntrada() {
    modalInputAction = null;
    cerrarModal();
}

async function ejecutarModalConfirmacion() {
    const action = modalConfirmAction;
    modalConfirmAction = null;
    cerrarModal();
    if(action) await action();
}

async function ejecutarModalEntrada() {
    const action = modalInputAction;
    const input = document.getElementById('modal-input-field');
    const valor = input ? input.value : '';
    modalInputAction = null;
    cerrarModal();
    if(action) await action(valor);
}

async function copiarTexto(texto) {
    if(navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
    }
    const temp = document.createElement('textarea');
    temp.value = texto;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    temp.setSelectionRange(0, temp.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(temp);
    return ok;
}

async function copiarClaveTemporal(clave) {
    const feedback = document.getElementById('temp-pass-copy-feedback');
    try {
        const ok = await copiarTexto(clave);
        if(feedback) feedback.textContent = ok ? 'Clave copiada al portapapeles.' : 'No se pudo copiar automáticamente.';
    } catch {
        if(feedback) feedback.textContent = 'No se pudo copiar automáticamente.';
    }
}

async function copiarLoginCreado(login) {
    const feedback = document.getElementById('user-create-copy-feedback');
    try {
        const ok = await copiarTexto(login);
        if(feedback) feedback.textContent = ok ? 'Login copiado al portapapeles.' : 'No se pudo copiar automáticamente.';
    } catch {
        if(feedback) feedback.textContent = 'No se pudo copiar automáticamente.';
    }
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function abrirModalUsuarioCreado(usuario, nombre, rol) {
    const usuarioSeguro = escapeHtml(usuario);
    const nombreSeguro = escapeHtml(nombre);
    const rolSeguro = escapeHtml(rol);
    const usuarioArg = escapeHtml(JSON.stringify(usuario));
    abrirModalSimple('Usuario creado', `
        <div style="padding:18px; text-align:center;">
            <h3 style="margin-top:0; color:#16a34a;">Usuario guardado con éxito</h3>
            <p style="margin:12px 0;"><strong>Login:</strong> ${usuarioSeguro}</p>
            <p style="margin:12px 0;"><strong>Nombre:</strong> ${nombreSeguro}</p>
            <p style="margin:12px 0;"><strong>Rol:</strong> ${rolSeguro}</p>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px;">
                <button class="btn-download" type="button" onclick="copiarLoginCreado(${usuarioArg})">Copiar login</button>
                <button class="btn-info" style="min-width:180px;" onclick="cerrarModal()">Cerrar</button>
            </div>
            <div id="user-create-copy-feedback" style="margin-top:12px; text-align:center; color:#2563eb; font-weight:600;"></div>
        </div>`);
}

function abrirModalClaveTemporal(usuario, clave) {
    const usuarioSeguro = escapeHtml(usuario);
    const claveArg = escapeHtml(JSON.stringify(clave));
    abrirModalSimple('Clave temporal generada', `
        <div style="padding:18px;">
            <p style="margin-top:0;">Se generó una nueva clave temporal para <strong>${usuarioSeguro}</strong>.</p>
            <div style="background:#f3f4f6; border:1px solid #d1d5db; border-radius:10px; padding:14px; margin:16px 0; text-align:center;">
                <div style="font-size:12px; color:#4b5563; margin-bottom:6px;">Clave temporal</div>
                <div style="font-size:24px; font-weight:800; letter-spacing:1px; color:#1f2937; word-break:break-word;">${escapeHtml(clave)}</div>
            </div>
            <p style="margin:0 0 14px; text-align:center; color:#b91c1c; font-weight:700;">Guárdala ahora. No volverá a mostrarse automáticamente.</p>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                <button class="btn-download" type="button" onclick="copiarClaveTemporal(${claveArg})">Copiar clave</button>
                <button class="btn-info" type="button" onclick="cerrarModal()">Cerrar</button>
            </div>
            <div id="temp-pass-copy-feedback" style="margin-top:12px; text-align:center; color:#2563eb; font-weight:600;"></div>
        </div>`);
}

function abrirModalEditarUsuario(u, nAct, rAct, maxOpAct, maxDiaAct) {
    const usuarioArg = escapeHtml(JSON.stringify(u));
    abrirModalSimple(`Editar usuario: ${u}`, `
        <div style="padding:12px; display:grid; gap:12px;">
            <div>
                <label>Nombre real</label><br>
                <input type="text" id="edit_usr_nombre" value="${escapeHtml(nAct)}" style="width:100%; margin-top:5px;">
            </div>
            <div>
                <label>Rol</label><br>
                <select id="edit_usr_rol" style="width:100%; margin-top:5px;">
                    <option value="admin" ${rAct === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="supervisor" ${rAct === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                    <option value="operador" ${rAct === 'operador' ? 'selected' : ''}>Operador</option>
                    <option value="consulta" ${rAct === 'consulta' ? 'selected' : ''}>Consulta</option>
                </select>
            </div>
            <div>
                <label>Límite por operación ($)</label><br>
                <input type="number" id="edit_usr_max_op" value="${escapeHtml(maxOpAct || '0')}" style="width:100%; margin-top:5px;">
            </div>
            <div>
                <label>Límite diario 24hs ($)</label><br>
                <input type="number" id="edit_usr_max_dia" value="${escapeHtml(maxDiaAct || '0')}" style="width:100%; margin-top:5px;">
            </div>
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:6px;">
                <button class="btn-quitar" type="button" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-info" type="button" onclick="guardarUsuarioEditado(${usuarioArg})">Guardar cambios</button>
            </div>
        </div>`);
}

document.addEventListener('click', (ev) => {
    const menu = document.getElementById('header-info');
    const toggle = document.getElementById('mobile-toggle');
    if(window.innerWidth > 768 || !menu || !menu.classList.contains('active')) return;
    if(menu.contains(ev.target) || toggle.contains(ev.target)) return;
    closeMenu();
});
document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') closeMenu(); });
window.addEventListener('resize', () => { if(window.innerWidth > 768) closeMenu(); });
window.addEventListener('resize', () => {
    ajustarVistaMaquinas();
    if(document.getElementById('tab-auditoria').classList.contains('active')) renderAud(dAudFiltrada);
    if(document.getElementById('tab-usuarios').classList.contains('active')) loadUsr();
    syncSideNavGlider();
});

async function menuSistema(valor) {
    if(!valor) return;
    closeMenu();
    if(valor === 'host') return abrirEstadoHost();
    if(valor === 'logs') return abrirLogsSistema();
    if(valor === 'db') return abrirDbManager();
    if(valor === 'reboot_host') return confirmarRebootHost();
}

async function confirmarRebootHost() {
    modalConfirmAction = async () => {
        let r = await fetch('/api/reboot_host', {method:'POST'});
        let msg = await r.text();
        abrirModalMensaje(r.ok ? 'Reinicio programado' : 'Error al reiniciar', msg, r.ok ? 'success' : 'error');
    };
    abrirModalConfirmacion('Reiniciar Raspberry', 'Se programará el reinicio del host del sistema. ¿Continuar?', 'Reiniciar');
}

async function abrirEstadoHost() {
    let r = await fetch('/api/host_status');
    let d = await r.json();
    let rtcDetalle = d.rtc_devices && d.rtc_devices.length
        ? d.rtc_devices.map(x => `${x.id}: ${x.name}`).join(' | ')
        : 'Sin dispositivos RTC detectados';
    let rtcIcon = d.rtc_detected ? `✅ RTC Detectado (${rtcDetalle})` : `❌ RTC No detectado (${rtcDetalle})`;
    let btnTime = d.rol === 'admin' ? `<button class="btn-info" style="margin-top:10px; width:100%;" onclick="cambiarHoraManual('${d.server_time}')">Ajustar Hora Sistema</button>` : '';

    ajustarTamanoModal('medium');
    document.getElementById('modal-title').innerText = "Estado Raspberry / Host";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid">
          <div class="dash-card"><strong>Hora Servidor</strong><span style="color:#2563eb; font-weight:bold;">${d.server_time}</span></div>
          <div class="dash-card"><strong>RTC Hardware</strong><span>${rtcIcon}</span></div>
          <div class="dash-card"><strong>Host</strong><span>${d.host}</span></div>
          <div class="dash-card"><strong>Sistema</strong><span>${d.sistema}</span></div>
          <div class="dash-card"><strong>Uptime</strong><span>${d.uptime}</span></div>
          <div class="dash-card"><strong>Último boot</strong><span>${d.boot}</span></div>
          <div class="dash-card"><strong>Temperatura</strong><span>${d.temperatura}</span></div>
          <div class="dash-card"><strong>Carga CPU</strong><span>${d.load}</span></div>
          <div class="dash-card"><strong>Disco</strong><span>${d.disco_usado_gb} / ${d.disco_total_gb} GB</span></div>
          <div class="dash-card"><strong>DB</strong><span>${d.db_mb} MB</span></div>
          <div class="dash-card"><strong>Throttling</strong><span>${d.throttled}</span></div>
        </div>
        ${btnTime}`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function cambiarHoraManual(horaActual) {
    abrirModalSimple('Ajustar hora del sistema', `
        <div style="padding:18px;">
            <p style="margin-top:0;">Ingresa la nueva fecha y hora en formato <strong>YYYY-MM-DD HH:MM:SS</strong>.</p>
            <input type="text" id="system-time-input" value="" placeholder="2026-05-06 14:30:00" style="width:100%; margin:10px 0 14px;">
            <div style="font-size:13px; color:#4b5563; margin-bottom:16px;">Hora actual informada por el servidor: ${escapeHtml(horaActual || '-')}</div>
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-quitar" type="button" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-info" type="button" onclick="guardarHoraManual()">Actualizar hora</button>
            </div>
        </div>`);
}

async function guardarHoraManual() {
    let nueva = document.getElementById('system-time-input').value.trim();
    if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nueva)) {
        return abrirModalMensaje('Formato inválido', 'Debe ser YYYY-MM-DD HH:MM:SS.', 'error');
    }
    let fd = new FormData();
    fd.append('fecha_hora', nueva);
    let r = await fetch('/api/system_time', {method:'POST', body:fd});
    let msg = await r.text();
    if(r.ok) {
        abrirModalMensaje('Hora actualizada', msg, 'success');
        setTimeout(() => abrirEstadoHost(), 150);
    } else {
        abrirModalMensaje('Error al ajustar hora', msg, 'error');
    }
}

async function abrirLogsSistema() {
    let r = await fetch('/api/system_logs');
    let data = await r.json();
    let h = "";
    data.forEach(x => h += `<tr><td>${x.fecha}</td><td>${x.tipo}</td><td>${x.detalle}</td></tr>`);
    ajustarTamanoModal('wide');
    document.getElementById('modal-title').innerText = "Logs de sistema";
    document.getElementById('modal-content').innerHTML = `
        <div class="filtros-bar" style="justify-content:flex-end;"><button class="btn-download" onclick="window.location.href='/system_log_excel'">Descargar Excel</button></div>
        <div class="table-responsive modal-scroll-table"><table>
          <thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Detalle</th></tr></thead>
          <tbody>${h || '<tr><td colspan="3" style="text-align:center;">Sin registros</td></tr>'}</tbody>
        </table></div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function renderDbManager(d) {
    let tablas = d.tablas.map(t => `<tr><td>${t.nombre}</td><td>${t.registros}</td></tr>`).join('');
    let backups = d.backups.map(b => `<tr><td>${b.archivo}</td><td>${b.fecha}</td><td>${b.mb} MB</td><td><button class="btn-reboot" onclick="restaurarDb(${escapeHtml(JSON.stringify(b.archivo))})">Restaurar</button></td></tr>`).join('');
    ajustarTamanoModal('wide');
    document.getElementById('modal-title').innerText = "Base de datos";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid">
          <div class="dash-card"><strong>Archivo</strong><span>${d.archivo}</span></div>
          <div class="dash-card"><strong>Tamaño</strong><span>${d.mb} MB</span></div>
          <div class="dash-card"><strong>Último backup</strong><span>${d.ultimo_backup}</span></div>
        </div>
        <h3>Tablas</h3>
        <div class="table-responsive modal-scroll-table"><table><thead><tr><th>Tabla</th><th>Registros</th></tr></thead><tbody>${tablas}</tbody></table></div>
        <h3>Backups disponibles</h3>
        <div class="table-responsive modal-scroll-table"><table><thead><tr><th>Archivo</th><th>Fecha</th><th>MB</th><th>Acción</th></tr></thead><tbody>${backups || '<tr><td colspan="4" style="text-align:center;">Sin backups</td></tr>'}</tbody></table></div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function abrirDbManager() {
    abrirModalSimple('Base de datos', `
        <div style="padding:18px;">
            <p style="margin-top:0;">Ingresa la contraseña de administrador para ver el estado de la base.</p>
            <input type="password" id="db-admin-password" placeholder="Contraseña de administrador" style="width:100%; margin:10px 0 16px;">
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-quitar" type="button" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-info" type="button" onclick="cargarDbManager()">Abrir base de datos</button>
            </div>
        </div>`);
}

async function cargarDbManager() {
    let pass = document.getElementById('db-admin-password').value;
    if(!pass) return abrirModalMensaje('Contraseña requerida', 'Ingresa la contraseña de administrador.', 'error');
    let fd = new FormData();
    fd.append('password', pass);
    let r = await fetch('/api/db_info', {method:'POST', body:fd});
    if(!r.ok) return abrirModalMensaje('Error al abrir base', await r.text(), 'error');
    let d = await r.json();
    renderDbManager(d);
}

async function restaurarDb(archivo) {
    pendingDbRestoreFile = archivo;
    abrirModalSimple('Restaurar backup', `
        <div style="padding:18px;">
            <p style="margin-top:0; color:#b91c1c; font-weight:700;">Se restaurará <strong>${escapeHtml(archivo)}</strong> y se generará un backup previo automático.</p>
            <p>Confirma la contraseña de administrador para continuar.</p>
            <input type="password" id="db-restore-password" placeholder="Contraseña de administrador" style="width:100%; margin:10px 0 16px;">
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-quitar" type="button" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-reboot" type="button" onclick="confirmarRestauracionDb()">Restaurar backup</button>
            </div>
        </div>`);
}

async function confirmarRestauracionDb() {
    let pass = document.getElementById('db-restore-password').value;
    if(!pass) return abrirModalMensaje('Contraseña requerida', 'Ingresa la contraseña de administrador.', 'error');
    let fd = new FormData();
    fd.append('password', pass);
    fd.append('archivo', pendingDbRestoreFile || '');
    let r = await fetch('/api/db_restore', {method:'POST', body:fd});
    let msg = await r.text();
    if(r.ok) {
        abrirModalMensaje('Base restaurada', msg, 'success');
        setTimeout(() => location.reload(), 400);
    } else {
        abrirModalMensaje('Error al restaurar backup', msg, 'error');
    }
}

function openTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.tab-btn, .side-nav-btn').forEach(e => e.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(btn) btn.classList.add('active');
  let activeSideBtn = null;
  document.querySelectorAll(`[data-tab-target="${id}"]`).forEach(e => {
      e.classList.add('active');
      if(!activeSideBtn && e.classList.contains('side-nav-btn')) activeSideBtn = e;
  });
  if(!activeSideBtn && btn && btn.classList.contains('side-nav-btn')) activeSideBtn = btn;
  if(activeSideBtn) animateActiveSideNav(activeSideBtn);
  syncSideNavGlider(id);
  if(id === 'tab-control') { loadDashboard(); loadAlertas(); }
  if(id === 'tab-auditoria') loadAud();
  if(id === 'tab-usuarios') { loadUsr(); loadUsrDash(); loadLimitesRol(); }
}

function barRows(items, valueKey, labelKey) {
    if(!items || items.length === 0) return '<div style="color:#777;">Sin datos</div>';
    let max = Math.max(...items.map(x => Number(x[valueKey] || 0)), 1);
    return items.map(x => {
        let val = Number(x[valueKey] || 0);
        let monto = x.monto !== undefined ? `<br><small>$${Number(x.monto || 0).toFixed(2)}</small>` : "";
        let pct = Math.max(2, (val / max) * 100);
        return `<div class="bar-row"><span>${x[labelKey]}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div><strong>${val}${monto}</strong></div>`;
    }).join('');
}

function abrirModalSlots(tipo) {
    if(!ultimoDashboard) return;
    let titulo = tipo === 'conectados' ? 'Slots conectados' : 'Slots con SAS desconectado';
    let datos = tipo === 'conectados' ? ultimoDashboard.slot_detalle.conectados : ultimoDashboard.slot_detalle.sas_desconectado;
    ajustarTamanoModal('wide');
    document.getElementById('modal-title').innerText = titulo;
    let h = "";
    datos.forEach(s => {
        h += `<tr><td>${s.slot}</td><td>${s.nombre}</td><td>${s.id}</td><td>${s.ip}</td><td>${s.sas}</td><td>${s.ultima_conexion}</td><td>${s.tiempo_desconexion}</td><td>${s.uptime}</td><td>${s.firmware}</td><td>${s.ultimo_error}</td><td>${s.evento}</td></tr>`;
    });
    document.getElementById('modal-content').innerHTML = `
        <div class="table-responsive modal-scroll-table">
            <table>
                <thead><tr><th>Slot</th><th>Nombre</th><th>ID</th><th>IP</th><th>SAS</th><th>Última conexión</th><th>Tiempo desconexión</th><th>Uptime</th><th>Firmware</th><th>Último error</th><th>Evento</th></tr></thead>
                <tbody>${h || '<tr><td colspan="11" style="text-align:center;">Sin registros</td></tr>'}</tbody>
            </table>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function loadDashboard() {
    try {
        let r = await fetch('/api/dashboard_principal');
        if(r.status === 401) return;
        let d = await r.json();
        ultimoDashboard = d;
        document.getElementById('dash-principal').innerHTML = `
            <div class="dash-card dash-card-premium dash-card-money">
                <span class="dash-kicker">Ultima hora</span>
                <strong>Monto 1h</strong>
                <span class="dash-value">$${Number(d.montos.hora || 0).toFixed(2)}</span>
            </div>
            <div class="dash-card dash-card-premium dash-card-money">
                <span class="dash-kicker">Ventana diaria</span>
                <strong>Monto 24hs</strong>
                <span class="dash-value">$${Number(d.montos.dia || 0).toFixed(2)}</span>
            </div>
            <div class="dash-card dash-card-premium dash-card-money">
                <span class="dash-kicker">Tendencia mensual</span>
                <strong>Monto ultimo mes</strong>
                <span class="dash-value">$${Number(d.montos.mes || 0).toFixed(2)}</span>
            </div>
            <div class="dash-card dash-card-premium dash-card-status clickable" onclick="abrirModalSlots('conectados')">
                <span class="dash-kicker">Estado de red</span>
                <strong>Slots conectados</strong>
                <span class="dash-value">${d.slots.conectados}</span>
            </div>
            <div class="dash-card dash-card-premium dash-card-alert clickable" onclick="abrirModalSlots('sas_desconectado')">
                <span class="dash-kicker">Revision requerida</span>
                <strong>SAS desconectado</strong>
                <span class="dash-value">${d.slots.sas_desconectado}</span>
            </div>`;
        document.getElementById('chart-global').innerHTML = barRows(d.globales, 'cantidad', 'periodo');
    } catch(e) {}
}

async function loadAlertas() {
    try {
        let r = await fetch('/api/alertas');
        if(r.status === 401) return;
        let d = await r.json();
        document.getElementById('dash-alertas').innerHTML = `
            <div class="alert-card ${d.slots_offline ? 'danger' : ''}"><strong>Slots offline</strong><span class="alert-num">${d.slots_offline}</span></div>
            <div class="alert-card ${d.sas_off ? 'danger' : ''}"><strong>SAS OFF</strong><span class="alert-num">${d.sas_off}</span></div>
            <div class="alert-card ${d.cargas_fallidas_24h ? 'danger' : ''}"><strong>Cargas fallidas 24hs</strong><span class="alert-num">${d.cargas_fallidas_24h}</span></div>
            <div class="alert-card ${d.sin_heartbeat ? 'danger' : ''}"><strong>Sin heartbeat</strong><span class="alert-num">${d.sin_heartbeat}</span></div>
            <div class="alert-card clickable ${d.solicitudes_pendientes > 0 ? 'danger' : ''}" onclick="abrirModalSolicitudes()"><strong>Solicitudes Crédito</strong><span class="alert-num">${d.solicitudes_pendientes}</span></div>`;
    } catch(e) {}
}

async function abrirModalSolicitudes() {
    let r = await fetch('/api/solicitudes');
    let data = await r.json();
    let h = "";
    data.forEach(x => {
        h += `<tr><td>${x.fecha}</td><td>${x.usuario}</td><td>$${x.monto}</td><td><button onclick="aprobarSolicitud(${x.id})">Aprobar (+Límite)</button></td></tr>`;
    });
    ajustarTamanoModal('medium');
    document.getElementById('modal-title').innerText = "Solicitudes de aumento de crédito";
    document.getElementById('modal-content').innerHTML = `
        <div class="table-responsive modal-scroll-table">
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Monto Solicitado</th><th>Acción</th></tr></thead>
            <tbody>${h || '<tr><td colspan="4" style="text-align:center;">No hay solicitudes pendientes</td></tr>'}</tbody>
          </table>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function aprobarSolicitud(id) {
    let fd = new FormData(); fd.append('id', id);
    let r = await fetch('/api/solicitudes/aprobar', {method:'POST', body:fd});
    let msg = await r.text();
    abrirModalMensaje(r.ok ? 'Solicitud procesada' : 'Error al aprobar solicitud', msg, r.ok ? 'success' : 'error');
    loadAlertas();
}

async function loadLimitesRol() {
    let r = await fetch('/api/limites_rol');
    let data = await r.json();
    window.limitesRolCache = data;
    let h = "";
    data.forEach(x => {
        h += `<tr><td>${x.rol.toUpperCase()}</td><td>$${x.max_operacion.toFixed(2)}</td><td>$${x.max_diario.toFixed(2)}</td><td><button class="btn-info" onclick="editarLimiteRol('${x.rol}', ${x.max_operacion}, ${x.max_diario})">Editar</button></td></tr>`;
    });
    document.getElementById('tabla-limites-rol').innerHTML = h;
}

async function editarLimiteRol(rol, opAct, diaAct) {
    ajustarTamanoModal('compact');
    document.getElementById('modal-title').innerText = "Editar límites: " + rol.toUpperCase();
    document.getElementById('modal-content').innerHTML = `
        <div style="padding: 10px;">
            <label style="display:block; margin-bottom:5px; font-weight:bold;">Límite por Operación ($):</label>
            <input type="number" id="edit_rol_op" value="${opAct}" step="0.01" style="width:100%; margin-bottom:15px; font-size:16px;">
            
            <label style="display:block; margin-bottom:5px; font-weight:bold;">Límite Diario 24hs ($):</label>
            <input type="number" id="edit_rol_dia" value="${diaAct}" step="0.01" style="width:100%; margin-bottom:20px; font-size:16px;">
            
            <p style="font-size:12px; color:#666; margin-bottom:20px;">* Use 0 para indicar que no hay límite.</p>
            
            <button class="btn-info" style="width:100%; height:50px; font-size:18px;" onclick="guardarLimitesRol('${rol}')">Guardar Cambios</button>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function guardarLimitesRol(rol) {
    let nOp = document.getElementById('edit_rol_op').value;
    let nDia = document.getElementById('edit_rol_dia').value;
    if(nOp === "" || nDia === "") return abrirModalMensaje('Campos incompletos', 'Por favor complete ambos montos.', 'error');
    let fd = new FormData(); fd.append('rol', rol); fd.append('max_operacion', nOp); fd.append('max_diario', nDia);
    let r = await fetch('/api/limites_rol/edit', {method:'POST', body:fd});
    let msg = await r.text();
    if(r.ok) {
        cerrarModal();
        abrirModalMensaje('Límites actualizados', msg, 'success');
        loadLimitesRol();
    } else {
        abrirModalMensaje('Error al actualizar límites', msg, 'error');
    }
}

async function loadUsrDash() {
    try {
        let rango = document.getElementById('usr_dash_rango').value;
        let r = await fetch('/api/usuarios_dashboard?rango=' + encodeURIComponent(rango));
        let data = await r.json();
        document.getElementById('usuarios-dashboard').innerHTML = barRows(data, 'cantidad', 'usuario');
    } catch(e) {}
}

function normalizarTablaMaquinas() {
    const table = document.querySelector('.slots-table table');
    if(!table) return;
    const headers = table.querySelectorAll('thead th');
    if(headers.length >= 6) {
        headers[2].textContent = 'SLOT';
        headers[1].remove();
    } else if(headers.length >= 5) {
        headers[1].textContent = 'SLOT';
        headers[4].textContent = 'Accion';
    }
    const loadingRow = document.getElementById('cargando');
    if(loadingRow && loadingRow.firstElementChild) loadingRow.firstElementChild.colSpan = 5;
    const emptyRow = document.getElementById('sin-datos');
    if(emptyRow && emptyRow.firstElementChild) emptyRow.firstElementChild.colSpan = 5;
    document.querySelectorAll('#tabla-esclavos tr[id^="fila_"]').forEach(tr => {
        const cells = tr.children;
        if(cells.length >= 6) cells[1].remove();
        if(tr.children[0]) tr.children[0].setAttribute('data-label', '');
        if(tr.children[1]) tr.children[1].setAttribute('data-label', 'SLOT');
        if(tr.children[2]) tr.children[2].setAttribute('data-label', 'Estado');
        if(tr.children[3]) tr.children[3].setAttribute('data-label', 'Evento');
        if(tr.children[4]) tr.children[4].setAttribute('data-label', 'Accion');
    });
}

function prepararAccionesMobile() {
    const mobile = window.innerWidth <= 640;
    document.querySelectorAll('#tabla-esclavos td[id^="a_"]').forEach(td => {
        const slot = td.id.replace('a_', '');
        if(!td.dataset.fullActions && !td.dataset.mobileButton) td.dataset.fullActions = td.innerHTML;
        if(!mobile) {
            if(td.dataset.fullActions && td.dataset.mobileButton === '1') td.innerHTML = td.dataset.fullActions;
            td.dataset.mobileButton = '0';
            td.dataset.fullActions = td.innerHTML;
            return;
        }
        if(td.innerHTML.includes('abrirAccionesDesdeFila')) {
            return;
        }
        td.dataset.fullActions = td.innerHTML;

        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = td.dataset.fullActions;
        let cargarInput = tempDiv.querySelector(`#cmd_${slot}`);
        let cargarBtn = tempDiv.querySelector(`button[onclick*="sendCmd"][onclick*="cmd_${slot}"]`);
        
        let cargarHtml = "";
        if(cargarInput && cargarBtn) {
            let inp = cargarInput.cloneNode(true);
            inp.style.width = "auto";
            inp.style.flex = "2"; 
            inp.style.minWidth = "0"; 
            
            let btn = cargarBtn.cloneNode(true);
            btn.style.flex = "1";
            btn.style.width = "auto";
            btn.style.fontSize = "20px"; 
            
            cargarHtml = `
                <div style="display:flex; gap:8px; margin-bottom:10px; width:100%;">
                    ${inp.outerHTML}
                    ${btn.outerHTML}
                </div>`;
        }

        td.innerHTML = `
            ${cargarHtml}
            <button class="btn-info" style="width:100%; font-weight:bold; background:#2563eb;" onclick="abrirAccionesDesdeFila(${slot})">ACCIONES</button>`;
        td.dataset.mobileButton = '1';
    });
}

function refinarCardsSlotsMobile() {
    document.querySelectorAll('#tabla-esclavos td[id^="n_"]').forEach(td => {
        if(td.querySelector('.slot-name-row')) return;
        const strong = td.querySelector('strong');
        if(!strong) return;
        const editBtn = td.querySelector('.btn-edit');
        const nombre = strong.textContent.trim();

        const row = document.createElement('div');
        row.className = 'slot-name-row';

        const text = document.createElement('span');
        text.className = 'slot-name-text';
        text.title = nombre;
        text.appendChild(strong);
        row.appendChild(text);

        if(editBtn) row.appendChild(editBtn);
        td.appendChild(row);
    });
}

function abrirAccionesDesdeFila(slot) {
    const row = document.getElementById('fila_' + slot);
    const actionsCell = document.getElementById('a_' + slot);
    if(!row || !actionsCell) return;
    const nameCell = document.getElementById('n_' + slot);
    const stateCell = document.getElementById('s_' + slot);
    const eventCell = document.getElementById('e_' + slot);
    
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = actionsCell.dataset.fullActions || actionsCell.innerHTML;
    
    let inp = tempDiv.querySelector(`#cmd_${slot}`);
    if(inp) inp.remove();
    let btn = tempDiv.querySelector(`button[onclick*="sendCmd"][onclick*="cmd_${slot}"]`);
    if(btn) btn.remove();

    let actions = tempDiv.innerHTML;
    actions = actions.replace('display:flex;', 'display:grid; grid-template-columns:1fr 1fr; gap:10px;');
    
    document.getElementById('modal-title').innerText = "Acciones de maquina";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid" style="margin-top:0; margin-bottom:15px;">
            <div class="dash-card"><strong>SLOT</strong><span>${nameCell ? nameCell.textContent.trim() : slot}</span></div>
            <div class="dash-card"><strong>Estado</strong><span>${stateCell ? stateCell.textContent.trim() : '-'}</span></div>
            <div class="dash-card"><strong>Evento</strong><span>${eventCell ? eventCell.textContent.trim() : '-'}</span></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">${actions}</div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function ajustarVistaMaquinas() {
    normalizarTablaMaquinas();
    refinarCardsSlotsMobile();
    prepararAccionesMobile();
}

function abrirDetalleAuditoria(idx) {
    const x = audPageData[idx];
    if(!x) return;
    document.getElementById('modal-title').innerText = "Detalle de carga";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid" style="margin-top:0;">
            <div class="dash-card"><strong>ID</strong><span>#${x.id}</span></div>
            <div class="dash-card"><strong>Fecha</strong><span>${x.fecha}</span></div>
            <div class="dash-card"><strong>Usuario</strong><span>${x.usr}</span></div>
            <div class="dash-card"><strong>Maquina</strong><span>${x.maq}</span></div>
            <div class="dash-card"><strong>IP</strong><span>${x.ip}</span></div>
            <div class="dash-card"><strong>Monto</strong><span>$${x.monto}</span></div>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function ajustarAuditoriaMobile() {
    const mobile = window.innerWidth <= 640;
    const rows = document.querySelectorAll('#tabla-auditoria tr');
    rows.forEach((tr, idx) => {
        const cells = tr.children;
        if(!mobile || cells.length < 6) return;
        const x = audPageData[idx];
        if(!x) return;
        tr.innerHTML = `
            <td data-label="Fecha/Hora" class="audit-mobile-date"><span><strong>${x.fecha}</strong></span></td>
            <td data-label="Usuario"><span><strong>${x.usr}</strong></span></td>
            <td data-label="Maquina"><span>${x.maq}</span></td>
            <td data-label="Monto"><span style="color:green;font-weight:bold;">$${x.monto}</span></td>
            <td data-label="Detalle"><button class="btn-info" onclick="abrirDetalleAuditoria(${idx})">Ver detalle</button></td>`;
    });
}

function abrirDetalleUsuario(user) {
    const u = dataUsuarios.find(x => x.user === user);
    if(!u) return;
    const disponible = Math.max(0, u.max_diario - u.usado_24h);
    const ultimaCarga = u.ultima_carga !== null ? `$${u.ultima_carga} en ${u.ultima_maquina} hace ${u.ultima_carga_min} min` : 'Sin historial';
    const editarArgs = [u.user, u.nombre, u.rol, String(u.max_operacion ?? '0'), String(u.max_diario ?? '0')]
        .map(valor => escapeHtml(JSON.stringify(valor)))
        .join(', ');
    ajustarTamanoModal('medium');
    const accionesHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:15px;">
            <button class="btn-info" onclick="editarUsr(${editarArgs})">Datos</button>
            <button class="btn-info" style="background:#28a745;" onclick="abrirModalEditarLimites('${u.user}', '${u.max_operacion}', '${u.max_diario}')">Limites</button>
            <button class="btn-info" style="background:#6f42c1;" onclick="abrirModalExtraCredit('${u.user}')">Credito</button>
            <button class="btn-reboot" onclick="rstUsr('${u.user}')">Reset Clave</button>
            ${u.user !== 'admin' ? `<button class="btn-quitar" style="grid-column:1 / -1;" onclick="delUsr('${u.user}')">Eliminar</button>` : ''}
        </div>`;
    document.getElementById('modal-title').innerText = "Detalle de usuario";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid" style="margin-top:0;">
            <div class="dash-card"><strong>Usuario</strong><span>${u.user}</span></div>
            <div class="dash-card"><strong>Nombre</strong><span>${u.nombre}</span></div>
            <div class="dash-card"><strong>Rol</strong><span>${u.rol.toUpperCase()}</span></div>
            <div class="dash-card"><strong>Estado</strong><span>${u.online ? 'En linea' : 'Desconectado'}</span></div>
            <div class="dash-card"><strong>Monto</strong><span>${u.ultima_carga !== null ? '$' + u.ultima_carga : '$0.00'}</span></div>
            <div class="dash-card"><strong>Ultima carga</strong><span>${ultimaCarga}</span></div>
            <div class="dash-card"><strong>Operacion</strong><span>$${Number(u.max_operacion || 0).toFixed(2)}</span></div>
            <div class="dash-card"><strong>24hs</strong><span>$${Number(u.max_diario || 0).toFixed(2)}</span></div>
            <div class="dash-card"><strong>Usado</strong><span>$${Number(u.usado_24h || 0).toFixed(2)}</span></div>
            <div class="dash-card"><strong>Disponible</strong><span>$${Number(disponible).toFixed(2)}</span></div>
        </div>
        ${accionesHtml}`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function ajustarUsuariosMobile() {
    const mobile = window.innerWidth <= 640;
    const table = document.querySelector('.users-table table');
    if(table) {
        const theadRow = table.querySelector('thead tr');
        if(theadRow) theadRow.innerHTML = '<th>Usuario</th><th>Nombre</th><th>Rol</th><th>Monto</th><th>Limites</th><th>Estado</th><th>Ultima Carga</th><th>Acciones</th>';
    }
    const rows = document.querySelectorAll('#tabla-usuarios tr');
    rows.forEach(tr => {
        const cells = tr.children;
        if(!mobile || cells.length < 7) return;
        const user = cells[0].textContent.trim();
        const u = dataUsuarios.find(x => x.user === user);
        const monto = u && u.ultima_carga !== null ? `$${u.ultima_carga}` : '$0.00';
        const ultimaCargaHTML = cells[6].innerHTML;
        tr.innerHTML = `
            <td data-label="Última Carga"><span>${ultimaCargaHTML}</span></td>
            <td data-label="Usuario"><span><strong>${user}</strong></span></td>
            <td data-label="Nombre"><span>${cells[1].textContent.trim()}</span></td>
            <td data-label="Monto"><span style="color:green;font-weight:bold;">${monto}</span></td>
            <td data-label="Detalle"><button class="btn-info" onclick="abrirDetalleUsuario('${user}')">Ver detalle</button></td>`;
    });
}

function mostrarInfo(id, ip, mac, online) {
    let est = online ? 'Online' : 'Desconectado';
    ajustarTamanoModal('compact');
    document.getElementById('modal-title').innerText = "Info tecnica";
    document.getElementById('modal-content').innerHTML = `
        <div class="dash-grid" style="margin-top:0;">
            <div class="dash-card"><strong>ID</strong><span>${id}</span></div>
            <div class="dash-card"><strong>Estado red</strong><span>${est}</span></div>
            <div class="dash-card"><strong>IP</strong><span>${ip}</span></div>
            <div class="dash-card"><strong>MAC</strong><span>${mac}</span></div>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function abrirModalCargas(slot, id, nombre) {
    modalSlotActivo = -1;
    modalModo = "cargas";
    ajustarTamanoModal('wide');
    document.getElementById('modal-title').innerText = "Auditoria de cargas: " + nombre;
    document.getElementById('modal-content').innerHTML = '<div style="text-align:center; padding: 20px; font-weight:bold; color:#555;">Cargando auditoria...</div>';
    document.getElementById('modal-overlay').style.display = 'flex';
    await cargarAuditoriaSlot(slot, id);
}

async function cargarAuditoriaSlot(slot, idEsc) {
    let r = await fetch('/api/slot_cargas?slot=' + encodeURIComponent(slot) + '&id_esclavo=' + encodeURIComponent(idEsc || ""));
    let d = await r.json();
    let dash = d.dashboard || {historico:0, mes:0, dia:0, usuario:"-"};
    let cards = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:15px;">
            <div style="background:#e9ecef; padding:12px; border-radius:6px;"><strong>Historico</strong><br><span style="color:green; font-size:18px;">$${Number(dash.historico || 0).toFixed(2)}</span></div>
            <div style="background:#e9ecef; padding:12px; border-radius:6px;"><strong>Ultimo mes</strong><br><span style="color:green; font-size:18px;">$${Number(dash.mes || 0).toFixed(2)}</span></div>
            <div style="background:#e9ecef; padding:12px; border-radius:6px;"><strong>Ultimas 24hs</strong><br><span style="color:green; font-size:18px;">$${Number(dash.dia || 0).toFixed(2)}</span></div>
            <div style="background:#e9ecef; padding:12px; border-radius:6px;"><strong>Usuario</strong><br><span style="font-size:18px;">${dash.usuario || "-"}</span></div>
        </div>`;
    let rows = "";
    (d.cargas ||[]).forEach(x => {
        let color = x.estado === "Exitoso" ? "green" : "#dc3545";
        rows += `<tr><td>${x.fecha}</td><td>${x.usr}</td><td>${x.maq}</td><td>${x.ip}</td><td style="color:green;font-weight:bold;">$${x.monto}</td><td style="color:${color};font-weight:bold;">${x.estado}</td></tr>`;
    });
    document.getElementById('modal-content').innerHTML = cards + `
        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
            <button class="btn-download" onclick="descargarContaduriaSlot(${slot}, '${idEsc || ""}')">Descargar Excel</button>
        </div>
        <div class="table-responsive modal-scroll-table">
            <table>
                <thead><tr><th>Fecha/Hora</th><th>Usuario</th><th>Maquina</th><th>IP</th><th>Monto</th><th>Estado</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">Sin cargas registradas</td></tr>'}</tbody>
            </table>
        </div>`;
}

function abrirModalContadores(id, slot, nombre) {
    modalSlotActivo = slot;
    modalModo = "contadores";
    ajustarTamanoModal('medium');
    document.getElementById('modal-title').innerText = "Auditoría: " + nombre;
    document.getElementById('modal-content').innerHTML = '<div style="text-align:center; padding: 20px; font-weight:bold; color:#555;">⏳ Consultando a la máquina...<br><br><small>Por favor espere.</small></div>';
    document.getElementById('modal-overlay').style.display = 'flex';
    let fd = new FormData(); fd.append('o', id); fd.append('c', 'METERS'); 
    fetch('/api/comando', {method:'POST', body:fd});
}

function cerrarModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    modalSlotActivo = -1;
    modalModo = "";
    modalConfirmAction = null;
}

async function abrirModalLog(slot, id, nombre) {
    modalSlotActivo = -1;
    modalModo = "log";
    ajustarTamanoModal('wide');
    document.getElementById('modal-title').innerText = "Log por slot: " + nombre;
    document.getElementById('modal-content').innerHTML = `
        <div class="filtros-bar">
            <label style="font-weight:bold;">ID Esclavo:</label>
            <input type="text" id="log_id_esclavo" value="${id}" style="min-width:220px;">
            <button class="btn-info" onclick="cargarLogSlot(${slot})">Filtrar</button>
            <button class="btn-download" onclick="descargarLogFiltrado(${slot})">Descargar Excel</button>
        </div>
        <div class="table-responsive modal-scroll-table">
            <table>
                <thead><tr><th>Fecha/Hora</th><th>Slot</th><th>ID Esclavo</th><th>Tipo</th><th>Usuario</th><th>Detalle</th><th>Monto</th></tr></thead>
                <tbody id="tabla-log-slot"><tr><td colspan="7" style="text-align:center;">Cargando...</td></tr></tbody>
            </table>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
    await cargarLogSlot(slot);
}

async function cargarLogSlot(slot) {
    let idEsc = document.getElementById('log_id_esclavo') ? document.getElementById('log_id_esclavo').value.trim() : "";
    let r = await fetch('/api/slot_log?slot=' + encodeURIComponent(slot) + '&id_esclavo=' + encodeURIComponent(idEsc));
    let data = await r.json();
    let h = "";
    data.forEach(x => {
        let monto = x.monto !== null && x.monto !== "" ? "$" + x.monto : "";
        h += `<tr><td>${x.fecha}</td><td>${x.slot}</td><td>${x.id_esclavo}</td><td>${x.tipo}</td><td>${x.usuario}</td><td>${x.detalle}</td><td style="color:green;font-weight:bold;">${monto}</td></tr>`;
    });
    document.getElementById('tabla-log-slot').innerHTML = h || '<tr><td colspan="7" style="text-align:center;">Sin registros para ese ID esclavo</td></tr>';
}

async function tick() {
  try {
    const r = await fetch('/api/estado');
    if(r.status === 401) return window.location.href='/login';
    const d = await r.json();

    // Sincronizar reloj con el servidor
    if (d.server_time) {
        const [fecha, hora] = d.server_time.split(' ');
        const [dia, mes, anio] = fecha.split('/');
        const [h, m, s] = hora.split(':');
        const sTime = new Date(anio, mes - 1, dia, h, m, s).getTime();
        serverTimeOffset = sTime - new Date().getTime();
    }

    document.getElementById('label-rol').innerText = d.rol;

    document.getElementById('label-nombre').innerText = d.nombre_real;
    
    let disp = d.limite_disponible;
    let dispLabel = document.getElementById('header-disponible');
    if(disp === "Sin límite") {
        dispLabel.innerText = disp;
        dispLabel.style.color = "inherit";
    } else {
        dispLabel.innerText = "$" + Number(disp).toFixed(2);
        dispLabel.style.color = disp <= 0 ? "red" : "#28a745";
    }

    document.querySelectorAll('.admin-only').forEach(e => e.style.display = d.rol==='admin'?'inline-block':'none');

    let iN = document.getElementById('perfil_nombre');
    if (iN && document.activeElement !== iN && !iN.dataset.loaded) { iN.value = d.nombre_real; iN.dataset.loaded="1"; }

    if(d.db_timestamp > tsDB) {
        tsDB = d.db_timestamp;
        let ind = document.getElementById('sync-indicator');
        ind.style.opacity = 1; setTimeout(()=>ind.style.opacity = 0, 500);
        if(document.getElementById('tab-control').classList.contains('active')) { loadDashboard(); loadAlertas(); }
        if(document.getElementById('tab-auditoria').classList.contains('active')) loadAud();
        if(document.getElementById('tab-usuarios').classList.contains('active')) { loadUsr(); loadUsrDash(); loadLimitesRol(); }
    }

    if(document.getElementById('tab-usuarios').classList.contains('active')) loadUsr();

    if (modalModo === "contadores" && modalSlotActivo !== -1) {
        let escInfo = d.esclavos.find(e => e.slot === modalSlotActivo);
        if (escInfo) {
            let contentDiv = document.getElementById('modal-content');
            if (contentDiv.innerHTML.includes('⏳')) { 
                if (escInfo.contadores && escInfo.contadores !== "") {
                    let parts = escInfo.contadores.split(" ");
                    let html = '<table class="meter-table"><tbody>';
                    parts.forEach(p => {
                        if (p.includes(':')) {
                            let kv = p.split(':');
                            let rawLabel = kv[0];
                            let rawValue = kv[1];
                            
                            let label = rawLabel;
                            let esMoneda = true; 

                            if(rawLabel === 'In') { label = '🪙 Coin In (Apuestas)'; }
                            else if(rawLabel === 'Out') { label = '🏆 Coin Out (Premios)'; }
                            else if(rawLabel === 'Drop') { label = '💵 Drop (Billetero)'; }
                            else if(rawLabel === 'Canc') { label = '✋ Cancelled (Pagos manuales)'; }
                            else if(rawLabel === 'Cred') { label = '💰 Créditos Disp.'; }
                            else if(rawLabel === 'Jack') { label = '🎰 Jackpots (Acumulados)'; }
                            else if(rawLabel === 'Bill') { label = '💵 Billetes Aceptados'; }
                            else if(rawLabel === 'Juego') { label = '🎮 Partidas Jugadas'; esMoneda = false; }

                            let valorMostrado = rawValue;

                            if (!isNaN(rawValue) && rawValue.trim() !== "") {
                                let numero = parseFloat(rawValue);
                                if (esMoneda) {
                                    valorMostrado = "$" + (numero / 100).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                                } else {
                                    valorMostrado = numero.toLocaleString('es-AR');
                                }
                            }

                            html += `<tr><td><strong>${label}</strong></td><td style="text-align:right; font-family:monospace; font-size:16px;">${valorMostrado}</td></tr>`;
                        }
                    });
                    html += '</tbody></table>';
                    html += `<button class="btn-download" style="width:100%; margin-top:15px;" onclick="descargarContaduriaSlot(${escInfo.slot}, '${escInfo.id}')">Descargar contaduria de cargas enviadas</button>`;
                    contentDiv.innerHTML = html;
                } else if (escInfo.evento.includes("ERROR")) {
                    contentDiv.innerHTML = `<div style="color:#dc3545; padding:20px; font-weight:bold; text-align:center;">❌ ${escInfo.evento}</div>`;
                }
            }
        }
    }

    if(!document.getElementById('tab-control').classList.contains('active')) return;
    let tb = document.getElementById('tabla-esclavos');
    if(document.getElementById('cargando')) document.getElementById('cargando').remove();
    if(d.esclavos.length === 0) {
        if(!document.getElementById('sin-datos')) tb.innerHTML='<tr id="sin-datos"><td colspan="6" style="text-align:center;">Esperando red...</td></tr>';
        ajustarVistaMaquinas();
        return;
    }
    if(document.getElementById('sin-datos')) document.getElementById('sin-datos').remove();

    let activos =[];
    const obtenerClaseFilaMaquina = (online, sas) => {
        if(!online) return 'slot-row-offline';
        if(!sas) return 'slot-row-warning';
        return 'slot-row-online';
    };
    d.esclavos.forEach(e => {
        let idF = 'fila_'+e.slot; activos.push(idF);
        let tr = document.getElementById(idF);
        let nHtml = `<strong>${e.nombre}</strong>` + (d.rol==='admin'?` <button class="btn-edit" onclick="renombrar(${e.slot},'${e.nombre}')">✏️</button>`:'');
        
        let estTxt = `${e.online ? '🟢' : '🔴'} ${e.id} / ${e.online ? (e.sas ? '🟢' : '🔴') : '⚪'} SAS`;
        let sasReady = e.online && e.sas; 

        let disBtn = sasReady ? '' : 'disabled';
        let styleBtn = sasReady ? '' : 'background-color:#6c757d; opacity:0.5; cursor:not-allowed;';
        let disInp = sasReady ? '' : 'disabled';
        let styleInp = `width:70px; margin:0;${sasReady ? '' : ' background-color:#e9ecef; cursor:not-allowed;'}`;
        let estabaSel = document.querySelector(`.slot-check[data-slot="${e.slot}"]`)?.checked ? 'checked' : '';
        let selHtml = `<input type="checkbox" class="slot-check" value="${e.id}" data-slot="${e.slot}" ${estabaSel} ${e.online ? '' : 'disabled'}>`;

        let actHtml = `<div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                 <input type="text" id="cmd_${e.slot}" style="${styleInp}" placeholder="$" ${disInp}> 
                 <button onclick="sendCmd('${e.id}','cmd_${e.slot}')" ${disBtn} style="${styleBtn}">💸</button> 
                 <button onclick="abrirModalCargas(${e.slot}, '${e.id}', '${e.nombre}')" title="Auditoria de cargas" style="border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer; background:#17a2b8; color:white;">Auditoria</button>
                 <button class="btn-download" onclick="abrirModalLog(${e.slot}, '${e.id}', '${e.nombre}')" title="Ver log del slot">Log</button>
                 <button class="btn-info" style="background:#6f42c1;" onclick="abrirModalContadores('${e.id}', ${e.slot}, '${e.nombre}')" title="Ver contadores de la máquina">Contadores</button>
                 <button class="btn-info" onclick="mostrarInfo('${e.id}', '${e.ip}', '${e.mac}', ${e.online})">ℹ️</button>
                 ${d.rol==='admin' && e.online ? `<button class="btn-reboot" onclick="sendCmd('${e.id}','REBOOT')">🔄</button>` : ''}
                 ${d.rol==='admin' && !e.online ? `<button class="btn-quitar" onclick="quitar(${e.slot})">🗑️ Quitar</button>` : ''}
               </div>`;

        if(!tr) {
            tr = document.createElement('tr'); tr.id = idF; 
            tr.setAttribute('data-o', e.online);
            tr.setAttribute('data-sas', e.sas); 
            
            tr.className = obtenerClaseFilaMaquina(e.online, e.sas);
            tr.innerHTML = `<td data-label="" style="text-align: right;" id="sel_${e.slot}">${selHtml}</td><td data-label="Slot">${e.slot}</td><td data-label="Nombre" id="n_${e.slot}">${nHtml}</td><td data-label="Estado" id="s_${e.slot}" class="${e.online?'estado-ok':'estado-error'}">${estTxt}</td><td data-label="Evento" id="e_${e.slot}">${e.evento}</td><td data-label="Acción" id="a_${e.slot}">${actHtml}</td>`;
            tb.appendChild(tr);
        } else {
            document.getElementById('sel_'+e.slot).innerHTML = selHtml;
            document.getElementById('n_'+e.slot).innerHTML = nHtml;
            document.getElementById('s_'+e.slot).innerHTML = estTxt;
            document.getElementById('s_'+e.slot).className = e.online?'estado-ok':'estado-error';
            document.getElementById('e_'+e.slot).innerText = e.evento;
            
            let currentOnline = tr.getAttribute('data-o') === 'true';
            let currentSas = tr.getAttribute('data-sas') === 'true';
            
            if(currentOnline !== e.online || currentSas !== e.sas) {
                document.getElementById('a_'+e.slot).innerHTML = actHtml;
                tr.setAttribute('data-o', e.online);
                tr.setAttribute('data-sas', e.sas);
                tr.className = obtenerClaseFilaMaquina(e.online, e.sas);
            }
        }
    });
    Array.from(tb.children).forEach(r => { if(r.id!=='sin-datos'&&!activos.includes(r.id)) r.remove(); });
    ajustarVistaMaquinas();
  } catch(e){}
}

async function loadAud() {
    const r = await fetch('/api/auditoria'); dAud = await r.json();
    let uA=document.getElementById('filtro_usuario').value, mA=document.getElementById('filtro_maquina').value;
    let usrs = [...new Set(dAud.map(x=>x.usr))].sort(), maqs = [...new Set(dAud.map(x=>x.maq))].sort();
    document.getElementById('filtro_usuario').innerHTML = '<option value="">Todos</option>' + usrs.map(u=>`<option value="${u}" ${u===uA?'selected':''}>${u}</option>`).join('');
    document.getElementById('filtro_maquina').innerHTML = '<option value="">Todas</option>' + maqs.map(m=>`<option value="${m}" ${m===mA?'selected':''}>${m}</option>`).join('');
    filtrar();
}

function renderAud(d) {
    let h = ""; 
    let total = 0; 
    dAudFiltrada = d;
    let totalPaginas = Math.max(1, Math.ceil(d.length / audPageSize));
    if(audPage > totalPaginas) audPage = totalPaginas;
    let inicio = (audPage - 1) * audPageSize;
    let pagina = d.slice(inicio, inicio + audPageSize);
    audPageData = pagina;
    d.forEach(x => { total += parseFloat(x.monto) || 0; });
    pagina.forEach(x => {
        h += `<tr><td>#${x.id}</td><td>${x.fecha}</td><td>${x.usr}</td><td>${x.maq}</td><td>${x.ip}</td><td style="color:green;font-weight:bold;">$${x.monto}</td></tr>`;
    });
    
    document.getElementById('tabla-auditoria').innerHTML = h || '<tr><td colspan="6" style="text-align:center;">Sin registros</td></tr>';
    document.getElementById('total-auditoria').innerText = "Total Filtrado: $" + total.toFixed(2);
    document.getElementById('aud-page-info').innerText = `Página ${audPage} / ${totalPaginas}`;
}

function pagAud(delta) {
    let totalPaginas = Math.max(1, Math.ceil(dAudFiltrada.length / audPageSize));
    audPage = Math.min(totalPaginas, Math.max(1, audPage + delta));
    renderAud(dAudFiltrada);
    ajustarAuditoriaMobile();
}

function filtrar() {
    let fStart = document.getElementById('filtro_fecha_inicio').value;
    let fEnd = document.getElementById('filtro_fecha_fin').value;
    let fU = document.getElementById('filtro_usuario').value;
    let fM = document.getElementById('filtro_maquina').value;
    let fR = document.getElementById('filtro_rango').value;
    
    let dStart = fStart ? new Date(fStart + "T00:00:00") : null;
    let dEnd = fEnd ? new Date(fEnd + "T23:59:59") : null;
    
    let ahora = new Date();
    let r = dAud.filter(x => {
        let fp = x.fecha.split(' ')[0].split('/');
        let hp = (x.fecha.split(' ')[1] || '00:00:00').split(':');
        let fx = new Date(Number(fp[2]), Number(fp[1])-1, Number(fp[0]), Number(hp[0]), Number(hp[1]), Number(hp[2]));
        
        let okFecha = true;
        if (dStart && fx < dStart) okFecha = false;
        if (dEnd && fx > dEnd) okFecha = false;
        
        let okRango = true;
        if(fR === '1h') okRango = (ahora - fx) <= 3600000;
        else if(fR === '24h') okRango = (ahora - fx) <= 86400000;
        else if(fR === 'semana') okRango = (ahora - fx) <= 604800000;
        else if(fR === 'mes') okRango = (ahora - fx) <= 2592000000;
        
        return okFecha && okRango && (!fU || x.usr===fU) && (!fM || x.maq===fM);
    });
    audPage = 1;
    renderAud(r);
    ajustarAuditoriaMobile();
}

function descargarAuditoriaFiltrada() {
    let fStart = document.getElementById('filtro_fecha_inicio').value;
    let fEnd = document.getElementById('filtro_fecha_fin').value;
    let fU = document.getElementById('filtro_usuario').value;
    let fM = document.getElementById('filtro_maquina').value;
    let fR = document.getElementById('filtro_rango').value;
    window.location.href = '/historial_excel?inicio=' + encodeURIComponent(fStart) + '&fin=' + encodeURIComponent(fEnd) + '&usuario=' + encodeURIComponent(fU) + '&maquina=' + encodeURIComponent(fM) + '&rango=' + encodeURIComponent(fR);
}

function limpiarFiltros() { 
    document.getElementById('filtro_fecha_inicio').value=''; 
    document.getElementById('filtro_fecha_fin').value=''; 
    document.getElementById('filtro_rango').value=''; 
    document.getElementById('filtro_usuario').value=''; 
    document.getElementById('filtro_maquina').value=''; 
    renderAud(dAud); 
}

async function backupForzado() {
    modalConfirmAction = async () => {
        let r = await fetch('/api/backup_forzado', {method:'POST'});
        let msg = await r.text();
        abrirModalMensaje(r.ok ? 'Backup creado' : 'Error de backup', msg, r.ok ? 'success' : 'error');
    };
    abrirModalConfirmacion('Crear backup manual', 'Se generará un backup de la base de datos ahora mismo.', 'Crear backup');
}

function initResizableColumns() {
    let table = document.getElementById('tabla-auditoria-table');
    if(!table) return;
    let ths = table.querySelectorAll('th');
    ths.forEach((th, idx) => {
        let saved = localStorage.getItem('aud_col_' + idx);
        if(saved) th.style.width = saved;
        th.addEventListener('mouseup', () => localStorage.setItem('aud_col_' + idx, th.offsetWidth + 'px'));
    });
}

async function cambiarNombre() {
    let fd = new FormData(); fd.append('n', document.getElementById('perfil_nombre').value);
    let r = await fetch('/api/perfil/nombre', {method:'POST', body:fd});
    let msg = r.ok ? 'Nombre actualizado correctamente.' : await r.text();
    abrirModalMensaje(r.ok ? 'Perfil actualizado' : 'Error al actualizar perfil', msg, r.ok ? 'success' : 'error');
}

async function cambiarPass() {
    let fa = document.getElementById('pass_actual').value, fn = document.getElementById('pass_nueva').value;
    if(!fa || !fn) return abrirModalMensaje('Campos incompletos', 'Completa ambos campos.', 'error');
    let fd = new FormData(); fd.append('old', fa); fd.append('new', fn);
    let r = await fetch('/api/perfil/pass', {method:'POST', body:fd});
    let msg = await r.text();
    abrirModalMensaje(r.ok ? 'Contraseña actualizada' : 'Error al cambiar contraseña', msg, r.ok ? 'success' : 'error');
    document.getElementById('pass_actual').value=''; document.getElementById('pass_nueva').value='';
}

async function loadUsr() {
    let r = await fetch('/api/usuarios'); let d = await r.json(); dataUsuarios = d; let h = "";
    d.forEach(u => {
        let statusBadge = u.online ? '<span style="color:green;font-weight:bold;">🟢 En línea</span>' : '<span style="color:#666;">⚪ Desconectado</span>';
        let ultCarga = u.ultima_carga !== null ? `<small>Hace ${u.ultima_carga_min} min<br><strong style="color:green;">$${u.ultima_carga}</strong> en ${u.ultima_maquina}</small>` : '<small style="color:#999;">Sin historial</small>';
        let montoCell = u.ultima_carga !== null ? `<strong style="color:green;">$${u.ultima_carga}</strong>` : '<span style="color:#999;">$0.00</span>';
        let disponible = Math.max(0, u.max_diario - u.usado_24h);
        let limites = `<small>Operación: <strong>$${Number(u.max_operacion || 0).toFixed(2)}</strong><br>24hs: <strong>$${Number(u.max_diario || 0).toFixed(2)}</strong><br>Usado: <strong style="color:${u.usado_24h >= u.max_diario && u.max_diario > 0 ? 'red' : 'inherit'}">$${Number(u.usado_24h || 0).toFixed(2)}</strong><br>Disponible: <strong style="color:#28a745;">$${Number(disponible).toFixed(2)}</strong></small>`;
        let editarArgs = [u.user, u.nombre, u.rol, String(u.max_operacion ?? '0'), String(u.max_diario ?? '0')]
            .map(valor => escapeHtml(JSON.stringify(valor)))
            .join(', ');
        let btns = `<div style="display:flex; gap:5px; flex-wrap:wrap;">
                      <button class="btn-info" onclick="editarUsr(${editarArgs})">✏️ Datos</button> 
                      <button class="btn-info" style="background:#28a745;" onclick="abrirModalEditarLimites('${u.user}', '${u.max_operacion}', '${u.max_diario}')">💰 Límites</button> 
                      <button class="btn-info" style="background:#6f42c1;" onclick="abrirModalExtraCredit('${u.user}')">➕ Crédito</button>
                      <button class="btn-reboot" onclick="rstUsr('${u.user}')">Reset Clave</button>
                      ${u.user !== 'admin' ? `<button class="btn-quitar" onclick="delUsr('${u.user}')">X</button>` : ''}
                    </div>`;
        h += `<tr><td><strong>${u.user}</strong></td><td>${u.nombre}</td><td>${u.rol.toUpperCase()}</td><td>${montoCell}</td><td>${limites}</td><td>${statusBadge}</td><td>${ultCarga}</td><td>${btns}</td></tr>`;
    });
    document.getElementById('tabla-usuarios').innerHTML = h;
    ajustarUsuariosMobile();
}

function abrirModalEditarLimites(u, maxOp, maxDia) {
    ajustarTamanoModal('compact');
    document.getElementById('modal-title').innerText = "Editar Límites: " + u;
    document.getElementById('modal-content').innerHTML = `
        <div style="padding:10px;">
            <label>Límite por Operación ($):</label><br>
            <input type="number" id="edit_m_op" value="${maxOp}" style="width:100%; margin-top:5px; margin-bottom:15px;">
            <label>Límite Diario 24hs ($):</label><br>
            <input type="number" id="edit_m_dia" value="${maxDia}" style="width:100%; margin-top:5px; margin-bottom:15px;">
            <button onclick="guardarLimites('${u}')" style="width:100%; padding:12px;">Guardar Cambios</button>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function guardarLimites(u) {
    let fd = new FormData();
    fd.append('u', u);
    fd.append('max_operacion', document.getElementById('edit_m_op').value);
    fd.append('max_diario', document.getElementById('edit_m_dia').value);
    let r = await fetch('/api/usuarios/edit_limits', {method:'POST', body:fd});
    let msg = await r.text();
    if(r.ok) {
        cerrarModal();
        abrirModalMensaje('Límites actualizados', msg || `Se actualizaron los límites de ${u}.`, 'success');
        loadUsr();
    } else {
        abrirModalMensaje('Error al actualizar límites', msg, 'error');
    }
}

function abrirModalExtraCredit(u) {
    ajustarTamanoModal('compact');
    document.getElementById('modal-title').innerText = "Inyectar Crédito Adicional: " + u;
    document.getElementById('modal-content').innerHTML = `
        <div style="padding:10px;">
            <p>Este monto se sumará al límite diario actual del usuario.</p>
            <label>Monto a adicionar ($):</label><br>
            <input type="number" id="extra_monto" placeholder="Ej: 50000" style="width:100%; margin-top:5px; margin-bottom:15px;">
            <button onclick="inyectarCredito('${u}')" style="width:100%; padding:12px; background:#6f42c1;">Inyectar Crédito</button>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function inyectarCredito(u) {
    let m = document.getElementById('extra_monto').value;
    if(!m || m <= 0) return abrirModalMensaje('Monto inválido', 'Ingresa un monto válido.', 'error');
    let fd = new FormData(); fd.append('u', u); fd.append('monto', m);
    let r = await fetch('/api/usuarios/add_extra_credit', {method:'POST', body:fd});
    let msg = await r.text();
    if(r.ok) {
        cerrarModal();
        abrirModalMensaje('Crédito inyectado', msg || 'Crédito inyectado con éxito.', 'success');
        loadUsr();
    } else {
        abrirModalMensaje('Error al inyectar crédito', msg, 'error');
    }
}

async function editarUsr(u, nAct, rAct, maxOpAct, maxDiaAct) {
    abrirModalEditarUsuario(u, nAct, rAct, maxOpAct, maxDiaAct);
}

async function guardarUsuarioEditado(u) {
    let nNuevo = document.getElementById('edit_usr_nombre').value.trim();
    let rNuevo = document.getElementById('edit_usr_rol').value;
    let maxOp = document.getElementById('edit_usr_max_op').value || '0';
    let maxDia = document.getElementById('edit_usr_max_dia').value || '0';
    if(!nNuevo) return abrirModalMensaje('Dato inválido', 'El nombre es obligatorio.', 'error');
    if(!['admin','supervisor','operador','consulta'].includes(rNuevo)) return abrirModalMensaje('Dato inválido', 'Rol inválido.', 'error');
    let fd = new FormData();
    fd.append('u', u);
    fd.append('n', nNuevo);
    fd.append('r', rNuevo);
    fd.append('max_operacion', maxOp);
    fd.append('max_diario', maxDia);
    let r = await fetch('/api/usuarios/edit', {method:'POST', body:fd});
    let msg = await r.text();
    if(!r.ok) return abrirModalMensaje('Error al editar usuario', msg, 'error');
    cerrarModal();
    abrirModalMensaje('Usuario actualizado', `Se actualizaron los datos de ${u}.`, 'success');
    loadUsr();
}

async function crearUsr() {
    let u = document.getElementById('new_usr').value.trim(), p = document.getElementById('new_pass').value, n = document.getElementById('new_real').value.trim();
    let rol = document.getElementById('new_rol').value;
    let maxOp = document.getElementById('new_max_op').value || "0";
    let maxDia = document.getElementById('new_max_dia').value || "0";
    if(!u || !p || !n) return abrirModalMensaje('Campos incompletos', 'Completa todos los campos obligatorios (Login, Nombre, Clave).', 'error');
    let fd = new FormData(); fd.append('u', u); fd.append('p', p); fd.append('r', rol); fd.append('n', n);
    fd.append('max_operacion', maxOp); fd.append('max_diario', maxDia);
    let r = await fetch('/api/usuarios/add', {method:'POST', body:fd});
    if(!r.ok) return abrirModalMensaje('Error al crear usuario', await r.text(), 'error');
    document.getElementById('new_usr').value=''; document.getElementById('new_real').value=''; document.getElementById('new_pass').value='';
    document.getElementById('new_max_op').value=''; document.getElementById('new_max_dia').value='';
    abrirModalUsuarioCreado(u, n, rol);
    loadUsr();
}

async function rstUsr(u) {
    modalConfirmAction = async () => {
        let fd = new FormData();
        fd.append('u', u);
        let r = await fetch('/api/usuarios/reset', {method:'POST', body:fd});
        let msg = await r.text();
        if(!r.ok) return abrirModalMensaje('Error al resetear clave', msg, 'error');
        const match = msg.match(/^Clave temporal para\s+(.+?):\s+(.+)$/);
        if(match) {
            abrirModalClaveTemporal(match[1], match[2]);
            return;
        }
        abrirModalSimple('Clave temporal generada', `<div style="padding:18px; text-align:center;"><p>${escapeHtml(msg)}</p><button class="btn-info" type="button" onclick="cerrarModal()">Cerrar</button></div>`);
    };
    abrirModalConfirmacion('Resetear clave', `Se generará una nueva clave temporal para ${u}.`, 'Generar clave');
}
async function delUsr(u) {
    modalConfirmAction = async () => {
        let fd = new FormData();
        fd.append('u', u);
        let r = await fetch('/api/usuarios/delete', {method:'POST', body:fd});
        let msg = await r.text();
        if(r.ok) {
            abrirModalMensaje('Usuario eliminado', msg || `Se eliminó ${u}.`, 'success');
            loadUsr();
        } else {
            abrirModalMensaje('Error al eliminar usuario', msg, 'error');
        }
    };
    abrirModalConfirmacion('Eliminar usuario', `Se eliminará el usuario ${u}. Esta acción no se puede deshacer.`, 'Eliminar');
}

async function sendCmd(obj, id) {
    let v;
    if (id === 'REBOOT' || id === 'REBOOT_CONFIRMED') v = 'REBOOT';
    else v = document.getElementById(id).value;
    
    if(!v) return;
    if(v === 'REBOOT') {
        modalConfirmAction = async () => sendCmd(obj, 'REBOOT_CONFIRMED');
        return abrirModalConfirmacion('Reiniciar placa', '¿Reiniciar la placa ESP32 físicamente?', 'Reiniciar');
    }
    let fd = new FormData(); fd.append('o', obj); fd.append('c', v); 
    let r = await fetch('/api/comando', {method:'POST', body:fd});
    if(r.status === 403) {
        let msg = await r.text();
        if(msg.toLowerCase().includes("limite") || msg.toLowerCase().includes("límite")) {
            abrirModalLimite(msg, v);
        } else abrirModalMensaje('Operación rechazada', msg, 'error');
    } else if(!r.ok) abrirModalMensaje('Error al enviar comando', await r.text(), 'error');
    else abrirModalMensaje('Comando enviado', await r.text(), 'success');

    if(id !== 'REBOOT_CONFIRMED' && id !== 'REBOOT') document.getElementById(id).value='';
}

function abrirModalLimite(msg, monto) {
    document.getElementById('modal-title').innerText = "Límite Excedido";
    document.getElementById('modal-content').innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <h3 style="color:#dc3545;">⚠️ No se pudo realizar la carga</h3>
            <p style="font-size:18px;">${msg}</p>
            <p>¿Deseas enviar una solicitud al administrador para aumentar tu crédito disponible?</p>
            <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                <button class="btn-info" onclick="solicitarAumento(${monto})">Enviar Solicitud ($${monto})</button>
                <button class="btn-quitar" onclick="cerrarModal()">Cancelar</button>
            </div>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

async function solicitarAumento(monto) {
    let fd = new FormData(); fd.append('monto', monto);
    let r = await fetch('/api/solicitar_limite', {method:'POST', body:fd});
    abrirModalMensaje(r.ok ? 'Solicitud enviada' : 'Error al solicitar aumento', await r.text(), r.ok ? 'success' : 'error');
}

function slotsSeleccionados() {
    return Array.from(document.querySelectorAll('.slot-check:checked:not(:disabled)')).map(x => x.value);
}

async function sendSelectedCredit() {
    let ids = slotsSeleccionados();
    if(ids.length === 0) return abrirModalMensaje('Selección requerida', 'Selecciona al menos un slot online.', 'error');
    let v = document.getElementById('cmd_multi').value;
    if(!v) return abrirModalMensaje('Monto requerido', 'Ingresa un monto.', 'error');
    let fd = new FormData(); fd.append('o', 'MULTI'); fd.append('targets', ids.join(',')); fd.append('c', v);
    let r = await fetch('/api/comando', {method:'POST', body:fd});
    
    if(r.status === 403) {
        let msg = await r.text();
        if(msg.toLowerCase().includes("limite") || msg.toLowerCase().includes("límite")) {
            abrirModalLimite(msg, v * ids.length);
        } else abrirModalMensaje('Operación rechazada', msg, 'error');
    } else {
        abrirModalMensaje(r.ok ? 'Carga enviada' : 'Error al enviar carga', await r.text(), r.ok ? 'success' : 'error');
        if(r.ok) document.getElementById('cmd_multi').value='';
    }
}

async function sendSelectedReset() {
    let ids = slotsSeleccionados();
    if(ids.length === 0) return abrirModalMensaje('Selección requerida', 'Selecciona al menos un slot online.', 'error');
    modalConfirmAction = async () => {
        let fd = new FormData(); fd.append('o', 'MULTI'); fd.append('targets', ids.join(',')); fd.append('c', 'REBOOT');
        let r = await fetch('/api/comando', {method:'POST', body:fd});
        abrirModalMensaje(r.ok ? 'Reset enviado' : 'Error al enviar reset', await r.text(), r.ok ? 'success' : 'error');
    };
    abrirModalConfirmacion('Reset masivo', '¿Enviar reset a los slots seleccionados?', 'Enviar reset');
}

async function renombrar(s, n) {
    modalInputAction = async (nv) => {
        const nombreNuevo = nv.trim();
        if(!nombreNuevo) return;
        let fd = new FormData();
        fd.append('s', s);
        fd.append('n', nombreNuevo);
        let r = await fetch('/api/renombrar', {method:'POST', body:fd});
        if(!r.ok) return abrirModalMensaje('Error al renombrar', await r.text(), 'error');
        tick();
    };
    abrirModalEntrada('Renombrar slot', 'Ingresa el nuevo nombre del slot.', n, 'Guardar', 'Nombre del slot');
}

async function quitar(s) {
    modalConfirmAction = async () => {
        let fd = new FormData();
        fd.append('s', s);
        let r = await fetch('/api/remove', {method:'POST', body:fd});
        if(!r.ok) return abrirModalMensaje('Error al quitar slot', await r.text(), 'error');
        tick();
    };
    abrirModalConfirmacion('Quitar slot', '¿Quitar visualmente de la lista?', 'Quitar');
}

async function borrarHistorial() {
    modalConfirmAction = async () => {
        let r = await fetch('/api/limpiar_historial', {method:'POST'});
        if(!r.ok) return abrirModalMensaje('Error al vaciar base', await r.text(), 'error');
        abrirModalMensaje('Base vaciada', 'La base de datos se vació correctamente.', 'success');
        loadAud();
    };
    abrirModalConfirmacion('Vaciar base de datos', '¿Vaciar base de datos? Esto no se deshace.', 'Vaciar');
}
function descargarLogFiltrado(s) {
    let idEsc = document.getElementById('log_id_esclavo') ? document.getElementById('log_id_esclavo').value.trim() : "";
    window.location.href = '/slot_log_excel?slot=' + encodeURIComponent(s) + '&id_esclavo=' + encodeURIComponent(idEsc);
}
function descargarContaduriaSlot(s, idEsc) { window.location.href = '/contaduria_slot_excel?slot=' + encodeURIComponent(s) + '&id_esclavo=' + encodeURIComponent(idEsc || ""); }

window.addEventListener('resize', ajustarVistaMaquinas);
initHeaderSidebar();
setInterval(tick, 1000); tick(); updateLiveClock(); setInterval(updateLiveClock, 1000); updateClima(); setInterval(updateClima, 5000); loadDashboard(); loadAlertas(); setTimeout(() => { initResizableColumns(); ajustarVistaMaquinas(); ajustarAuditoriaMobile(); ajustarUsuariosMobile(); }, 500);
