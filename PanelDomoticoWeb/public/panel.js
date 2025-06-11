document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginCard = document.getElementById("loginCard");
    const user = document.getElementById("user");
    const pass = document.getElementById("pass");
    const loginError = document.getElementById("loginError");
    const panel = document.getElementById("panel");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const toastContainer = document.getElementById("toastContainer");
    const lblUser = document.getElementById("lblUser");
    const logoutBtn = document.getElementById("logoutBtn");
    const toggleSidebar = document.getElementById("toggleSidebar");
    const content = document.getElementById("content");
    const clockNow = document.getElementById("clockNow");
    const arduinoAlert = document.getElementById("arduinoAlert");
    const arduinoAlertClose = document.getElementById("arduinoAlertClose");

    if (arduinoAlertClose) {
        arduinoAlertClose.onclick = () => arduinoAlert.classList.add('hidden');
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !arduinoAlert.classList.contains('hidden')) {
            arduinoAlert.classList.add('hidden');
        }
    });

    const showArduinoAlert = () => {
        if (arduinoAlert) {
            arduinoAlert.classList.remove('hidden');
            feather.replace();
        }
    };

    const showArduinoReminder = () => {
        toast('Arduino no conectado', null, false, 'warning-toast', 'alert-triangle');
    };

        // Generadores de tarjetas
        function card(icon, title, value, cls = "") {
            return `
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-2 ${cls}">
              <div class="flex items-center gap-2"><i data-feather="${icon}"></i><h4 class="font-bold">${title}</h4></div>
              <p class="text-sm">${value}</p>
            </div>`;
        }

        function moduleCard(name, status, extraCls = '') {
            let cls = '';
            let stateCls = '';
            let label = '--';
            if (status !== undefined && status !== null) {
                const ok = status.toUpperCase() !== 'NO';
                cls = ok ? 'module-ok' : 'module-fail';
                stateCls = ok ? 'operational' : 'faulty';
                label = ok ? 'Operativo' : 'Fallo';
            }
            return `
            <div class="module-card ${cls} shadow ${extraCls}" data-module="${name}">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2">
                  <i data-feather="cpu" class="module-icon"></i>
                  <h4 class="module-title">${name}</h4>
                </div>
                <span class="status ${stateCls}" data-status>${label}</span>
              </div>
              <button onclick="verifyModule('${name}', this)" class="verify-btn btn btn-sm mt-4 self-end">Verificar</button>
            </div>`;
        }

        function sensorCard(icon, title, value, cls = "") {
            return `
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-2 ${cls}">
              <div class="flex items-center gap-2"><i data-feather="${icon}"></i><h4 class="font-bold">${title}</h4></div>
              <p class="text-sm">${value}</p>
            </div>`;
        }

        // Sparklines (ejemplo estático)
        function sparklineHTML() {
            return `
            <div class="relative h-full">
              <canvas id="sparklineChart" class="sparkline hidden"></canvas>
              <div id="noHistoryMsg" class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 bg-slate-50/70 dark:bg-slate-700/30">
                <i data-feather="bar-chart-2" class="w-4 h-4"></i>
                <span class="text-sm">Historial no disponible…</span>
              </div>
            </div>`;
        }

        function updateHistoryDisplay() {
            const canvas = document.getElementById('sparklineChart');
            const msg = document.getElementById('noHistoryMsg');
            if (!canvas || !msg) return;
            if (tempHistory.length === 0) {
                canvas.classList.add('hidden');
                msg.classList.remove('hidden');
            } else {
                canvas.classList.remove('hidden');
                msg.classList.add('hidden');
            }
        }

        function renderSparkline() {
            const ctx = document.getElementById('sparklineChart').getContext('2d');
            if (tempChart) tempChart.destroy();
            const now = new Date();
            const labels = tempHistory.map((_, i) => {
                const d = new Date(now.getTime() - (tempHistory.length - 1 - i) * 3600 * 1000);
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            tempChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        data: tempHistory,
                        borderColor: '#1683d8',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#1683d8',
                        fill: false,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { x: { display: false }, y: { display: false } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: ctx => `${ctx.formattedValue}°C - ${ctx.label}`
                            }
                        }
                    },
                interaction: { mode: 'nearest', intersect: false }
            }
        });
            updateHistoryDisplay();
            refreshTemp();
        }

        const accessActions = ['abrir', 'cerrar', 'rfid', 'huella'];
        const ignorePatterns = /(arduino|timeout|sin respuesta|error|no disponible)/i;

        // Tabla de accesos diarios (solo eventos relevantes)
        async function accessTableHTML(dateStr) {
            try {
                const logs = await api('/logs/' + dateStr);
                const filtered = logs.filter(l => {
                    return accessActions.includes(l.accion) && !ignorePatterns.test(l.detalle || '');
                });
                const rows = filtered.map(l => {
                    const h = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const ev = `${l.accion}: ${l.detalle}`;
                    return `<tr><td class="px-3 py-1">${h}</td><td class="px-3 py-1">${ev}</td></tr>`;
                }).join('');
                return `
                <div class="max-h-60 overflow-y-auto">
                  <table class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                    <thead class="bg-slate-100 dark:bg-slate-700">
                      <tr><th class="px-3 py-2 text-left">Hora</th><th class="px-3 py-2 text-left">Evento</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>`;
            } catch {
                return `<p class="text-sm text-red-500 px-2">Error cargando logs</p>`;
            }
        }

        // Tabla de huellas
        function fingerTable() {
            return `
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead class="bg-slate-100 dark:bg-slate-700">
                  <tr><th class="px-3 py-2 text-left">ID Huella</th></tr>
                </thead>
                <tbody id="fingerTBody" class="divide-y divide-slate-200 dark:divide-slate-700"></tbody>
              </table>
            </div>`;
        }

        // Formulario y tabla de cuentas
        function accountManager() {
            return `
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
              <form id="addUserForm" class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <input id="newUser" placeholder="Usuario" class="col-span-1 sm:col-span-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-[#1683d8]" />
                <input id="newPass" type="password" placeholder="Contraseña" class="col-span-1 sm:col-span-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-[#1683d8]" />
                <select id="newRole" class="col-span-1 sm:col-span-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-[#1683d8]"><option value="admin">admin</option><option value="root">root</option></select>
                <button class="btn col-span-1" type="submit">Crear</button>
              </form>
              <div class="overflow-x-auto">
                <table id="usersTable" class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                  <thead class="bg-slate-100 dark:bg-slate-700">
                    <tr><th class="px-3 py-2 text-left">Usuario</th><th class="px-3 py-2 text-left">Rol</th><th class="px-3 py-2 text-left">Activo</th><th class="px-3 py-2 text-left">Acciones</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-700"></tbody>
                </table>
              </div>
            </div>`;
        }

        // Definición de secciones
        const sections = {
            home: () => `
            <section class="space-y-8">
              <div class="relative overflow-hidden rounded-lg bg-gradient-to-r from-[#1683d8] via-blue-500 to-sky-500 text-white">
                <div class="p-10 text-center bg-black/30">
                  <h2 class="text-3xl sm:text-4xl font-bold mb-2">Bienvenido a EduSec</h2>
                  <p class="text-sm sm:text-base">Tu centro de control unificado para la seguridad física inteligente</p>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                ${card('shield', 'Seguridad del Sistema', '<span class="font-medium">Todos los módulos OK</span>', 'bg-success-soft text-success')}
                ${card('lock', 'Acceso principal', `<span id="homeDoorState">--</span>`, 'bg-gray-100 dark:bg-gray-700')}
                ${sensorCard('thermometer', 'Temperatura', '<span id="tempValue">--</span>', 'bg-blue-100 text-blue-700')}
              </div>
              <div class="mt-6">
                <h4 class="text-lg font-semibold mb-2">Histórico de Temperatura (últimas 12 horas)</h4>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 h-20">
                  ${sparklineHTML()}
                </div>
              </div>
            </section>`,

            acceso: () => {
                const exportBtn = currentUser && currentUser.role === 'root'
                    ? `<button onclick="exportAccessCSV()" class="px-3 py-1 bg-[#1683d8] hover:bg-[#126bb3] text-white rounded text-sm">Exportar CSV</button>`
                    : '';
                return `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="lock"></i>Control del Acceso principal</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${card('lock', 'Estado', `<span id="doorState">--</span>`, 'bg-gray-100 dark:bg-gray-700')}
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <div class="flex justify-between items-center">
                    <h4 class="font-bold">Historial</h4>
                    <div class="flex items-center gap-2">
                      <input type="date" id="filterDate" class="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent text-sm"
                             value="${new Date().toISOString().substring(0, 10)}" onchange="updateAccessTable(this.value)">
                      ${exportBtn}
                    </div>
                  </div>
                  <div id="accessContainer"></div>
                </div>
              </div>
              <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                <div class="flex justify-between items-center">
                  <h4 class="font-bold">Huella Digital</h4>
                  <button id="btnMoreAccion" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><i data-feather="more-horizontal"></i></button>
                </div>
                <p class="text-sm" id="fingerSensorState">Sensor huella: <span class="font-medium">OK</span></p>
                <button onclick="toggleFingerAdmin()" class="btn w-full text-base">Administrar Huellas</button>
                <div id="fingerAdmin" class="hidden space-y-4">
                  ${fingerTable()}
                  <button class="btn w-full">Agregar Nueva Huella</button>
                </div>
                <!-- Menú oculto de acciones: Abrir / Cerrar -->
                <div id="menuAcciones" class="hidden absolute bg-white dark:bg-slate-800 shadow rounded mt-2 right-6 w-40 divide-y divide-slate-200 dark:divide-slate-700">
                  <button onclick="cmd('abrir')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">Abrir Acceso principal</button>
                  <button onclick="cmd('cerrar')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">Cerrar Acceso principal</button>
                </div>
              </div>
            </section>`;
            },

            estatus: () => `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="activity"></i>Estatus</h3>
              <div class="module-grid">
                ${moduleCard('Arduino', undefined, 'module-main')}
                ${moduleCard('PIR Sensor')}
                ${moduleCard('RFID Reader')}
                ${moduleCard('Ultrasonido')}
                ${moduleCard('Buzzer')}
              </div>
            </section>`,

            monitoreo: () => `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="shield"></i>Monitoreo</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <h4 class="font-bold">Estado del Sistema</h4>
                  <div class="flex items-center gap-2">
                    <span id="systemStatusText" class="font-medium text-green-600">ÁREA LIBRE</span>
                    <span id="systemIndicator" class="w-3 h-3 rounded-full bg-green-500"></span>
                  </div>
                  <button id="toggleArmBtn" class="btn w-full flex items-center justify-center gap-2"><i data-feather="lock"></i>Armar Sistema</button>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <h4 class="font-bold">Sensores Activos</h4>
                  <div class="flex items-center justify-between">
                    <span>Sensor de Movimiento (PIR)</span>
                    <span id="pirStatus" class="status inactive">Sin Movimiento</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Sensor de Puerta (Ultrasonido)</span>
                    <span id="doorStatus" class="status inactive">Puerta Cerrada</span>
                  </div>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <h4 class="font-bold">Notificaciones</h4>
                  <div class="flex items-center justify-between">
                    <span class="flex items-center gap-1"><i data-feather="volume-2"></i>Buzzer:</span>
                    <span class="flex items-center gap-2">
                      <span id="buzzerStatus" class="status inactive">Inactivo</span>
                      ${currentUser && currentUser.role === 'root' ? '<button id="testBuzzerBtn" class="btn btn-sm">Probar</button>' : ''}
                    </span>
                  </div>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <h4 class="font-bold">Registro de Eventos de Seguridad</h4>
                  <div id="securityLog"></div>
                </div>
              </div>
            </section>`,


            cuentas: () => `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="users"></i>Gestión de Cuentas</h3>
              ${accountManager()}
            </section>`,

            config: () => `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="settings"></i>Configuración del Sistema</h3>

              <div class="config-card">
                <div class="config-card-header flex items-center gap-2">🛠️ Ajustes Generales</div>
                <div class="config-card-body space-y-2">
                  <label class="flex items-center gap-2"><input type="checkbox" id="chkNotifAcc" class="focus-ring-primary">Habilitar Notificaciones de Acceso</label>
                  <label class="flex items-center gap-2"><input type="checkbox" id="chkNotifSec" class="focus-ring-primary">Habilitar Notificaciones de Seguridad</label>
                  <label class="flex items-center gap-2"><input type="checkbox" id="chkNotifSys" class="focus-ring-primary">Habilitar Notificaciones del Sistema</label>
                  <div class="flex flex-wrap items-center gap-2">
                    <label for="serialPort" class="flex-1">Puerto Serie:</label>
                    <input id="serialPort" type="text" class="input-field w-32">
                    <button id="applySerialPort" class="btn btn-sm">Aplicar</button>
                  </div>
                  <button id="savePrefsBtn" class="btn mt-2 flex items-center gap-1"><i data-feather="save"></i>Guardar Preferencias</button>
                </div>
              </div>

              <div class="config-card${simulatedMode ? '' : ' disabled'}" title="Opciones solo disponibles en modo simulado">
                <div class="config-card-header flex items-center gap-2">📂 Gestión de Datos (Simulado)</div>
                <div class="config-card-body flex flex-wrap gap-2">
                  <button id="backupBtn" class="btn flex-auto sm:flex-none">Copia de Seguridad</button>
                  <button id="restoreBtn" class="btn bg-slate-700 hover:bg-slate-600 text-white flex-auto sm:flex-none">Restaurar Copia</button>
                  <button id="clearCacheBtn" class="btn btn-danger flex-auto sm:flex-none">Limpiar Caché</button>
                </div>
              </div>

              <div class="config-card${simulatedMode ? '' : ' disabled'}" title="Opciones solo disponibles en modo simulado">
                <div class="config-card-header flex items-center gap-2">🧪 Parámetros del Sistema (Simulado)</div>
                <div class="config-card-body space-y-4">
                  <div class="flex flex-wrap items-center gap-2">
                    <label for="sensorInterval" class="flex-1">Intervalo de Sondeo de Sensores (segundos):</label>
                    <input id="sensorInterval" type="number" class="input-field w-24">
                    <button id="applySensorInterval" class="btn btn-sm">Aplicar</button>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <label for="sessionTimeout" class="flex-1">Tiempo de Espera de Sesión Inactiva (minutos):</label>
                    <input id="sessionTimeout" type="number" class="input-field w-24">
                    <button id="applySessionTimeout" class="btn btn-sm">Aplicar</button>
                  </div>
                </div>
              </div>

              <div class="config-card${simulatedMode ? '' : ' disabled'}" title="Opciones solo disponibles en modo simulado">
                <div class="config-card-header flex items-center gap-2">🧰 Mantenimiento del Sistema (Simulado)</div>
                <div class="config-card-body flex flex-wrap gap-2">
                  <button id="updateBtn" class="btn flex-auto sm:flex-none">Buscar Actualizaciones</button>
                  <button id="restartModulesBtn" class="btn bg-slate-700 hover:bg-slate-600 text-white flex-auto sm:flex-none">Reiniciar Módulos</button>
                </div>
              </div>

            </section>`,

            acerca: () => `
            <section class="space-y-6">
              <h3 class="section-title border-b border-slate-200 dark:border-slate-700 pb-2"><i data-feather="info"></i>Acerca de</h3>
              <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4 text-sm">
                <p>Proyecto EduSec v1.0 – Panel Domótico Inteligente.</p>
                <p>Desarrollado por Ulises Roldán &amp; Team, 2025.</p>
                <p>Contacto: soporte@edusec.com</p>
              </div>
            </section>`
        };

        // Definición del menú lateral
        const menuDef = [
            ["home", "home", "Inicio"],
            ["acceso", "lock", "Acceso principal"],
            ["monitoreo", "shield", "Monitoreo"],
            ["estatus", "activity", "Estatus"],
            ["monitoreo", "eye", "Monitoreo"],
            ["config", "settings", "Configuración"],
            ["cuentas", "users", "Cuentas"],
            ["acerca", "info", "Acerca"]
        ];

        function initMenu() {
            const m = document.getElementById('menu');
            m.innerHTML = '';
            const seen = new Set();
            menuDef.forEach(([id, ic, label]) => {
                if (seen.has(id)) return; // evita duplicados
                seen.add(id);
                if ((id === 'cuentas' || id === 'config') && currentUser.role !== 'root') return;
                const b = document.createElement('button');
                b.dataset.sec = id;
                b.className = 'w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700';
                b.innerHTML = `<i data-feather="${ic}"></i><span class="sidebar-text">${label}</span>`;
                b.onclick = () => loadSection(b, id);
                m.appendChild(b);
            });
            feather.replace();
        }

        function loadSection(btn, id) {
            document.querySelectorAll('#menu button').forEach(el => el.classList.remove('sidebar-active'));
            btn.classList.add('sidebar-active');
            content.innerHTML = sections[id]();
            feather.replace();

            applyBtnStyle();
            content.classList.add('fade-in');
            setTimeout(() => content.classList.remove('fade-in'), 400);
            if (id === 'home') renderSparkline();
            if (id === 'cuentas') loadUsers();
            if (id === 'acceso') updateAccessTable(new Date().toISOString().substring(0, 10));
            if (id === 'estatus') startModuleMonitoring();
            if (id === 'monitoreo') startSecurityMonitoring();
            if (id === 'config') loadSerialPort();
        }


const applyBtnStyle = () => {};

        const toast = (msg, duration = 3000, dismissable = true,
                      cls = 'bg-slate-800 text-white', icon = null) => {
            const t = document.createElement('div');
            t.className = `toast ${cls} px-4 py-3 rounded-full shadow-lg flex items-center gap-2`;
            if (icon) {
                const ic = document.createElement('i');
                ic.dataset.feather = icon;
                ic.className = 'w-4 h-4';
                t.appendChild(ic);
            }
            const span = document.createElement('span');
            span.textContent = msg;
            span.className = 'font-medium';
            t.appendChild(span);
            if (dismissable) {
                const btn = document.createElement('button');
                btn.innerHTML = '<i data-feather="x"></i>';
                btn.onclick = () => t.remove();
                t.appendChild(btn);
            }
            toastContainer.appendChild(t);
            feather.replace();
            if (duration !== null) {
                let timer = setTimeout(() => t.remove(), duration);
                t.addEventListener('mouseenter', () => clearTimeout(timer));
                t.addEventListener('mouseleave', () => timer = setTimeout(() => t.remove(), duration));
            }
        };

        function clockTick() {
            clockNow.textContent = new Date().toLocaleTimeString();
        }
        setInterval(clockTick, 1000);

        async function cmd(a) {
            try {
                const data = await api(`/comando/${a}`);
                const msg = data.resultado || `Comando ${a}`;
                toast(msg);
                if (/abierta/i.test(msg)) updateDoor('🔓 Abierta');
                if (/cerrada/i.test(msg)) updateDoor('🔒 Cerrada');
            } catch (err) {
                toast(err.message);
            }
        }
        function updateDoor(s) {
            document.querySelectorAll('#doorState, #homeDoorState').forEach(el => {
                if (el) el.textContent = s;
            });
        }
        function updateTemp(v) {
            const txt = v === null ? '--' : `${v}°C`;
            const t1 = document.getElementById('tempValue');
            const t2 = document.getElementById('tempHeader');
            if (t1) t1.textContent = txt;
            if (t2) t2.textContent = txt;
        }
        function modulesSummary() {
            const cards = document.querySelectorAll('.module-grid .module-card');
            const allOk = Array.from(cards).every(c => c.classList.contains('module-ok'));
            return allOk ? 'Todos los módulos OK' : 'Módulos con fallos';
        }
        function updateModulesSummary() {
            const el = document.getElementById('modulesSummary');
            if (el) el.textContent = modulesSummary();
        }
        function parseNumber(str) {
            if (!str || /(no disponible|error|timeout|sin respuesta)/i.test(str)) {
                return null;
            }
            const m = /([-+]?\d+(?:\.\d+)?)/.exec(str);
            return m ? parseFloat(m[1]) : null;
        }

        async function refreshTemp() {
            try {
                const data = await api('/comando/leertemp');
                const val = parseNumber(data.resultado);
                if (val !== null) {
                    updateTemp(val);
                    tempHistory.push(val);
                    if (tempHistory.length > 12) tempHistory.shift();
                } else {
                    updateTemp(null);
                }
            } catch (err) {
                toast(err.message);
                updateTemp(null);
            }
            updateHistoryDisplay();
        }
        function startPolling() {
            refreshTemp();
            setInterval(refreshTemp, 10000);
        }
        async function refreshTemp() {
            try {
                const data = await api('/comando/leertemp');
                const val = parseNumber(data.resultado);
                if (val !== null) {
                    updateTemp(val);
                    tempHistory.push(val);
                    if (tempHistory.length > 12) tempHistory.shift();
                    if (tempChart) {
                        const now = new Date();
                        const labels = tempHistory.map((_, i) => {
                            const d = new Date(now.getTime() - (tempHistory.length - 1 - i) * 3600 * 1000);
                            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        });
                        tempChart.data.labels = labels;
                        tempChart.data.datasets[0].data = tempHistory;
                        tempChart.update();
                    }
                } else {
                    updateTemp(null);
                }
            } catch (err) {
                toast(err.message);
                updateTemp(null);
            }
            updateHistoryDisplay();
        }
        function startPolling() {
            refreshTemp();
            setInterval(refreshTemp, 10000);
        }
        function toggleFingerAdmin() {
            const d = document.getElementById('fingerAdmin');
            if (!d) return;
            const wasHidden = d.classList.contains('hidden');
            d.classList.toggle('hidden');
            if (wasHidden && !d.classList.contains('hidden')) {
                loadHuellas();
            }
        }
        async function updateAccessTable(dateStr) {
            document.getElementById('accessContainer').innerHTML = await accessTableHTML(dateStr);
        }
        async function exportAccessCSV() {
            const date = document.getElementById('filterDate').value;
            if (!date) return;
            try {
                const logs = await api('/logs/' + date);
                const filtered = logs.filter(l => accessActions.includes(l.accion) && !ignorePatterns.test(l.detalle || ''));
                const header = 'timestamp,username,accion,detalle\n';
                const csv = header + filtered.map(l => {
                    const ts = new Date(l.timestamp).toISOString();
                    const u = l.username || '';
                    const a = l.accion || '';
                    const d = (l.detalle || '').replace(/"/g, '""');
                    return `"${ts}","${u}","${a}","${d}"`;
                }).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const aEl = document.createElement('a');
                aEl.href = url;
                aEl.download = `logs_${date}.csv`;
                document.body.appendChild(aEl);
                aEl.click();
                document.body.removeChild(aEl);
                URL.revokeObjectURL(url);
            } catch (err) {
                toast(err.message);
            }
        }
        const moduleActions = {
            'Arduino': 'arduino_status',
            'PIR Sensor': 'pir',
            'RFID Reader': 'rfid',
            'Ultrasonido': 'distancia',
            'Buzzer': 'alarm'
        };

        let moduleInterval;
        const delay = ms => new Promise(res => setTimeout(res, ms));

        function setCheckingStatuses() {
            document.querySelectorAll('.module-card').forEach(card => {
                const span = card.querySelector('[data-status]');
                card.classList.remove('module-ok', 'module-fail');
                if (span) {
                    span.classList.remove('operational', 'faulty');
                    span.classList.add('checking');
                    span.textContent = 'Verificando...';
                }
            });
        }

        function updateModuleCard(mod, ok) {
            const card = document.querySelector(`.module-card[data-module="${mod}"]`);
            if (!card) return;
            const span = card.querySelector('[data-status]');
            card.classList.toggle('module-ok', ok);
            card.classList.toggle('module-fail', !ok);
            if (span) {
                span.classList.remove('checking');
                span.classList.toggle('operational', ok);
                span.classList.toggle('faulty', !ok);
                span.textContent = ok ? 'Operativo' : 'Fallo';
            }
        }

       async function checkAllModules() {
           for (const mod in moduleActions) {
               await verifyModule(mod, null, false);
           }
       }

      function startModuleMonitoring() {
           clearInterval(moduleInterval);
           checkAllModules();
           moduleInterval = setInterval(checkAllModules, 60000);
       }

        function updateSystemStateUI() {
            const txt = document.getElementById('systemStatusText');
            const ind = document.getElementById('systemIndicator');
            const btn = document.getElementById('toggleArmBtn');
            if (!txt || !ind || !btn) return;
            if (systemArmed) {
                txt.textContent = 'ZONA SEGURA';
                txt.className = 'font-medium text-red-500';
                ind.className = 'w-3 h-3 rounded-full bg-red-500';
                btn.innerHTML = '<i data-feather="unlock"></i>Desarmar Sistema';
            } else {
                txt.textContent = 'ÁREA LIBRE';
                txt.className = 'font-medium text-green-600';
                ind.className = 'w-3 h-3 rounded-full bg-green-500';
                btn.innerHTML = '<i data-feather="lock"></i>Armar Sistema';
            }
            feather.replace();
        }

        function updatePirUI(active) {
            const el = document.getElementById('pirStatus');
            if (!el) return;
            if (active === null) {
                el.textContent = 'Sin respuesta';
                el.className = 'status unavailable';
            } else {
                el.textContent = active ? 'Movimiento Detectado' : 'Sin Movimiento';
                el.className = 'status ' + (active ? 'faulty' : 'inactive');
            }
        }

        function updateDoorUI(open) {
            const el = document.getElementById('doorStatus');
            if (!el) return;
            if (open === null) {
                el.textContent = 'Sin respuesta';
                el.className = 'status unavailable';
            } else {
                el.textContent = open ? 'Puerta Abierta' : 'Puerta Cerrada';
                el.className = 'status ' + (open ? 'faulty' : 'inactive');
            }
        }

        function updateBuzzerUI(active) {
            const el = document.getElementById('buzzerStatus');
            if (!el) return;
            el.textContent = active ? 'Activo' : 'Inactivo';
            el.className = 'status ' + (active ? 'operational' : 'inactive');
        }

        function renderSecurityLog() {
            const logEl = document.getElementById('securityLog');
            if (!logEl) return;
            const rows = securityLogs.map(l => {
                const [h, ev] = l.split(' - ');
                return `<tr><td class="px-3 py-1">${h}</td><td class="px-3 py-1">${ev}</td></tr>`;
            }).join('');
            logEl.innerHTML = `
            <div class="max-h-40 overflow-y-auto">
              <table class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead class="bg-slate-100 dark:bg-slate-700">
                  <tr><th class="px-3 py-2 text-left">Hora</th><th class="px-3 py-2 text-left">Evento</th></tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`;
        }

        function addSecurityLog(msg) {
            const now = new Date().toLocaleTimeString();
            securityLogs.unshift(`${now} - ${msg}`);
            if (securityLogs.length > 20) securityLogs.pop();
            renderSecurityLog();
        }

        function triggerAlarm() {
            if (buzzerTimeout) return;
            updateBuzzerUI(true);
            api('/comando/alarm').catch(() => {});
            addSecurityLog('Buzzer activado');
            buzzerTimeout = setTimeout(() => {
                updateBuzzerUI(false);
                buzzerTimeout = null;
            }, 3000);
        }

        async function checkSensors() {
            try {
                const pirData = await api('/comando/pir');
                const m = /PIR:\s*(\d+)/i.exec(pirData.resultado || '');
                const val = m ? parseInt(m[1]) : 0;
                updatePirUI(val === 1);
                if (lastPir !== null && val !== lastPir) {
                    addSecurityLog(`PIR: ${val ? 'Movimiento Detectado' : 'Sin Movimiento'}`);
                }
                if (systemArmed && val === 1) triggerAlarm();
                lastPir = val;
            } catch (err) {
                updatePirUI(null);
                if (lastPir !== null) addSecurityLog('PIR sin respuesta');
                lastPir = null;
            }

            try {
                const distData = await api('/comando/distancia');
                const n = /([-+]?\d+(?:\.\d+)?)/.exec(distData.resultado || '');
                const cm = n ? parseFloat(n[1]) : null;
                const open = cm !== null ? cm > 10 : false;
                updateDoorUI(open);
                if (lastDoorOpen !== null && open !== lastDoorOpen) {
                    addSecurityLog(`Ultrasonido: ${open ? 'Puerta Abierta' : 'Puerta Cerrada'}`);
                }
                if (systemArmed && open) triggerAlarm();
                lastDoorOpen = open;
            } catch (err) {
                updateDoorUI(null);
                if (lastDoorOpen !== null) addSecurityLog('Ultrasonido sin respuesta');
                lastDoorOpen = null;
            }
        }

        function startSecurityMonitoring() {
            clearInterval(monitorInterval);
            updateSystemStateUI();
            updateBuzzerUI(false);
            renderSecurityLog();
            checkSensors();
            monitorInterval = setInterval(checkSensors, 3000);
        }
        async function verifyModule(mod, btn, showChecking = true) {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span>';
            }
            const accion = moduleActions[mod];
            try {
                if (!accion) throw new Error('No soportado');
                const card = document.querySelector(`.module-card[data-module="${mod}"]`);
                const span = card ? card.querySelector('[data-status]') : null;
                if (span && showChecking) {
                    span.classList.add('checking');
                    span.classList.remove('operational', 'faulty');
                    span.textContent = 'Verificando...';
                }
                if (showChecking) {
                    await delay(2000);
                }
                let ok = false;
                if (accion === 'arduino_status') {
                    const data = await api('/status/arduino');
                    ok = !!data.available;
                    toast(`Arduino: ${ok ? 'Disponible' : 'No disponible'}`);
                } else {
                    const data = await api(`/comando/${accion}`);
                    toast(`Resultado de ${mod}: ${data.resultado}`);
                    ok = /OK/i.test(data.resultado || '');
                }
                updateModuleCard(mod, ok);
            } catch (err) {
                toast(err.message);
                updateModuleCard(mod, false);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Verificar';
                }
                updateModulesSummary();
            }
        }

        // Variables globales
        let currentUser = null;
        let jwtToken = '';
        let tempHistory = [];
        let tempChart = null;
        let systemArmed = false;
        let monitorInterval = null;
        let buzzerTimeout = null;
        let lastPir = null;
        let lastDoorOpen = null;
        const securityLogs = [];
        let simulatedMode = true;

        const api = async (url, opts = {}) => {
            opts.headers = opts.headers || {};
            if (jwtToken) opts.headers['Authorization'] = `Bearer ${jwtToken}`;
            const res = await fetch(url, opts);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.msg || 'Error');
            return data;
        };

        // Manejo de login
        loginForm.onsubmit = async e => {
            e.preventDefault();
            loginError.classList.add('hidden');
            try {
                const data = await api('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.value.trim(), password: pass.value.trim() })
                });
                jwtToken = data.token;
                currentUser = { username: data.username, role: data.role };
                lblUser.textContent = data.username;
                loadingOverlay.classList.remove('hidden');
                setTimeout(() => {
                    loginCard.classList.add('hidden');
                    panel.classList.remove('hidden');
                    loadingOverlay.classList.add('hidden');
                    initMenu();
                    document.querySelector('#menu button').click();
                    startPolling();
                    checkAllModules().then(updateModulesSummary);
                    api('/status/arduino').then(s => {
                        if (!s.available) {
                            showArduinoAlert();
                            showArduinoReminder();
                        }
                    }).catch(() => {});
                }, 600);
            } catch (err) {
                loginError.textContent = err.message;
                loginError.classList.remove('hidden');
            }
        };

        async function loadUsers() {
            try {
                const users = await api('/users');
                renderUsers(users);
            } catch {
                toast('Error cargando usuarios');
            }
        }

        async function loadSerialPort() {
            try {
                const data = await api('/settings/serial-port');
                const inp = document.getElementById('serialPort');
                if (inp) inp.value = data.serialPort || '';
            } catch {
                toast('Error cargando configuración');
            }
        }

        function renderUsers(list) {
            const tbody = document.querySelector('#usersTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            list.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td class="px-3 py-1">${u.username}</td>
                  <td class="px-3 py-1">${u.role}</td>
                  <td class="px-3 py-1">
                    <label class="toggle-switch">
                      <input type="checkbox" class="toggleUser" data-id="${u.id}" ${u.activo ? 'checked' : ''}>
                      <span class="toggle-slider"></span>
                    </label>
                  </td>
                  <td class="px-3 py-1">
                    <button class="delUser btn btn-sm btn-danger" data-id="${u.id}">Eliminar</button>
                  </td>`;
                tbody.appendChild(tr);
            });
        }

        async function loadHuellas() {
            try {
                const ids = await api('/huellas');
                renderHuellas(ids);
            } catch {
                toast('Error cargando huellas');
            }
        }

        function renderHuellas(list) {
            const tbody = document.getElementById('fingerTBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            list.forEach(id => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="px-3 py-1">${id}</td>`;
                tbody.appendChild(tr);
            });
        }

        document.addEventListener('submit', async e => {
            if (e.target.id === 'addUserForm') {
                e.preventDefault();
                const u = newUser.value.trim();
                const p = newPass.value.trim();
                const r = newRole.value;
                if (!u || !p) return;
                try {
                    await api('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, role: r }) });
                    e.target.reset();
                    loadUsers();
                } catch (err) { toast(err.message); }
            }
        });

        document.addEventListener('change', async e => {
            if (e.target.classList.contains('toggleUser')) {
                const id = e.target.dataset.id;
                const activo = e.target.checked ? 1 : 0;
                try {
                    await api(`/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo }) });
                    loadUsers();
                } catch (err) {
                    toast(err.message);
                    // revert visual toggle if update failed
                    e.target.checked = !e.target.checked;
                    loadUsers();
                }
            }
        });

        document.addEventListener('click', async e => {
            if (e.target.classList.contains('delUser')) {
                const id = e.target.dataset.id;
                if (!confirm('¿Eliminar usuario?')) return;
                try {
                    await api(`/users/${id}`, { method: 'DELETE' });
                    loadUsers();
                } catch (err) { toast(err.message); }
            } else if (e.target.closest('#toggleArmBtn')) {
                systemArmed = !systemArmed;
                updateSystemStateUI();
            } else if (e.target.closest('#testBuzzerBtn')) {
                cmd('alarm');
            } else if (e.target.closest('#savePrefsBtn')) {
                toast('Preferencias guardadas');
            } else if (e.target.closest('#backupBtn')) {
                toast('Copia de seguridad creada');
            } else if (e.target.closest('#restoreBtn')) {
                toast('Restaurando copia...');
            } else if (e.target.closest('#clearCacheBtn')) {
                toast('Caché limpiada');
            } else if (e.target.closest('#applySensorInterval')) {
                toast('Intervalo aplicado');
            } else if (e.target.closest('#applySerialPort')) {
                const port = document.getElementById('serialPort').value.trim();
                if (port) {
                    try {
                        await api('/settings/serial-port', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serialPort: port }) });
                        toast('Puerto actualizado');
                        await api('/status/arduino').then(s => { if (!s.available) showArduinoAlert(); });
                    } catch (err) { toast(err.message); }
                }
            } else if (e.target.closest('#applySessionTimeout')) {
                toast('Tiempo de espera actualizado');
            } else if (e.target.closest('#updateBtn')) {
                toast('Buscando actualizaciones...');
            } else if (e.target.closest('#restartModulesBtn')) {
                toast('Reiniciando módulos...');
            }
        });

        // Otros botones
        logoutBtn.onclick = () => location.reload();
        toggleSidebar.onclick = () => {
            document.body.classList.toggle('sidebar-collapsed');
            feather.replace();
        };

        // Cerrar menúAcciones si clic afuera
        document.addEventListener('click', e => {
            if (e.target.closest('#btnMoreAccion')) {
                const menuAcc = document.getElementById('menuAcciones');
                if (menuAcc) menuAcc.classList.toggle('hidden');
                return;
            }
            const menuAccElem = document.getElementById('menuAcciones');
            if (menuAccElem && !e.target.closest('#menuAcciones')) {
                menuAccElem.classList.add('hidden');
            }
        });

        // Exponer funciones usadas por atributos HTML
        window.cmd = cmd;
        window.toggleFingerAdmin = toggleFingerAdmin;
        window.updateAccessTable = updateAccessTable;
        window.exportAccessCSV = exportAccessCSV;
        window.verifyModule = verifyModule;

        // Inicializar Feather Icons
        feather.replace();
});
