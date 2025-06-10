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
    const themeBtn = document.getElementById("themeBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const toggleSidebar = document.getElementById("toggleSidebar");
    const content = document.getElementById("content");
    const clockNow = document.getElementById("clockNow");

        // Generadores de tarjetas
        function card(icon, title, value, cls = "") {
            return `
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-2 ${cls}">
              <div class="flex items-center gap-2"><i data-feather="${icon}"></i><h4 class="font-bold">${title}</h4></div>
              <p class="text-sm">${value}</p>
            </div>`;
        }

        function moduleCard(name, status) {
            const cls = status.startsWith('NO') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
            return `
            <div class="relative">
              ${card('cpu', name, status, cls)}
              <button onclick="verifyModule('${name}', this)" class="absolute bottom-2 right-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-2 py-1 rounded">Verificar</button>
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
            return `<canvas id="sparklineChart" class="sparkline"></canvas>`;
        }

        function renderSparkline() {
            const ctx = document.getElementById('sparklineChart').getContext('2d');
            if (ctx._chart) { ctx._chart.destroy(); }
            const temps = [23, 24, 24, 25, 24, 23, 22, 23, 24, 25, 24, 23];
            const now = new Date();
            const labels = temps.map((_, i) => {
                const d = new Date(now.getTime() - (temps.length - 1 - i) * 3600 * 1000);
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            ctx._chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        data: temps,
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        fill: false,
                        tension: 0.3
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
                    }
                }
            });
            updateTemp(temps[temps.length - 1]);
        }

        // Tabla de accesos diarios
        function accessTableHTML(dateStr) {
            const events = {
                '2025-06-05': ['08:01: Puerta Abierta', '08:03: Puerta Cerrada', '12:15: Puerta Abierta', '12:20: Puerta Cerrada'],
                '2025-06-04': ['09:10: Puerta Abierta', '09:12: Puerta Cerrada']
            };
            const todays = events[dateStr] || [];
            return `
            <div class="max-h-60 overflow-y-auto">
              <table class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead class="bg-slate-100 dark:bg-slate-700">
                  <tr><th class="px-3 py-2 text-left">Hora</th><th class="px-3 py-2 text-left">Evento</th></tr>
                </thead>
                <tbody>
                  ${todays.map(e => {
                const [h, ...rest] = e.split(': ');
                return `<tr><td class="px-3 py-1">${h}</td><td class="px-3 py-1">${rest.join(': ')}</td></tr>`;
            }).join('')}
                </tbody>
              </table>
            </div>`;
        }

        // Tabla de huellas
        function fingerTable() {
            return `
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">
                <thead class="bg-slate-100 dark:bg-slate-700">
                  <tr><th class="px-3 py-2 text-left">ID Usuario</th><th class="px-3 py-2 text-left">Huella ID</th><th class="px-3 py-2 text-left">Acciones</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                  <tr><td class="px-3 py-1">1</td><td class="px-3 py-1">H-001</td><td class="px-3 py-1"><button class="text-red-500 hover:underline">Eliminar</button></td></tr>
                </tbody>
              </table>
            </div>`;
        }

        // Formulario y tabla de cuentas
        function accountManager() {
            return `
            <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
              <form id="addUserForm" class="flex flex-col sm:flex-row gap-4">
                <input id="newUser" placeholder="Usuario" class="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-indigo-500" />
                <input id="newPass" type="password" placeholder="Contraseña" class="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-indigo-500" />
                <select id="newRole" class="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-transparent focus:ring-2 focus:ring-indigo-500"><option value="admin">admin</option><option value="root">root</option></select>
                <button class="btn" type="submit">Crear</button>
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
            home: `
            <section class="space-y-8">
              <div class="relative overflow-hidden rounded-lg">
                <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30"></div>
                <div class="p-10 relative z-10 text-center">
                  <h2 class="text-3xl sm:text-4xl font-bold mb-2">Bienvenido a EduSec</h2>
                  <p class="text-sm sm:text-base text-slate-700 dark:text-slate-200">Tu centro de control unificado para la seguridad física inteligente</p>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                ${card('shield', 'Seguridad del Sistema', '<span class="font-medium">Todos los módulos OK</span>', 'bg-green-100 text-green-700')}
                ${card('lock', 'Puerta', `<span id="homeDoorState">🔒 Cerrada</span>`, 'bg-gray-100 dark:bg-gray-700')}
                ${sensorCard('thermometer', 'Temperatura', '<span id="tempValue">24°C</span>', 'bg-blue-100 text-blue-700')}
                ${sensorCard('droplet', 'Humedad', '<span id="humValue">45%</span>', 'bg-cyan-100 text-cyan-700')}
              </div>
              <div class="mt-6">
                <h4 class="text-lg font-semibold mb-2">Histórico de Temperatura (últimas 12 horas)</h4>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-4 h-20">
                  ${sparklineHTML()}
                </div>
              </div>
            </section>`,

            acceso: `
            <section class="space-y-6">
              <h3 class="text-2xl font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">🔐 Control de Acceso</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${card('lock', 'Estado Puerta', `<span id="doorState">🔒 Cerrada</span>`, 'bg-gray-100 dark:bg-gray-700')}
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <div class="flex justify-between items-center">
                    <h4 class="font-bold">Accesos del Día</h4>
                    <div class="flex items-center gap-2">
                      <input type="date" id="filterDate" class="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent text-sm"
                             value="${new Date().toISOString().substring(0, 10)}" onchange="updateAccessTable(this.value)">
                      <button onclick="exportAccessCSV()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm">Exportar CSV</button>
                    </div>
                  </div>
                  <div id="accessContainer">
                    ${accessTableHTML(new Date().toISOString().substring(0, 10))}
                  </div>
                </div>
              </div>
              <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                <div class="flex justify-between items-center">
                  <h4 class="font-bold">Huella Digital</h4>
                  <button id="btnMoreAccion" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><i data-feather="more-horizontal"></i></button>
                </div>
                <p class="text-sm" id="fingerSensorState">Sensor huella: <span class="font-medium">OK</span></p>
                <button onclick="toggleFingerAdmin()" class="btn w-full">Administrar Huellas</button>
                <div id="fingerAdmin" class="hidden space-y-4">
                  ${fingerTable()}
                  <button class="btn w-full">Agregar Nueva Huella</button>
                </div>
                <!-- Menú oculto de acciones: Abrir / Cerrar -->
                <div id="menuAcciones" class="hidden absolute bg-white dark:bg-slate-800 shadow rounded mt-2 right-6 w-40 divide-y divide-slate-200 dark:divide-slate-700">
                  <button onclick="cmd('abrir')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">Abrir Puerta</button>
                  <button onclick="cmd('cerrar')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">Cerrar Puerta</button>
                </div>
              </div>
            </section>`,

            monitoreo: `
            <section class="space-y-6">
              <h3 class="text-2xl font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">📡 Monitoreo</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                ${moduleCard('PIR Sensor', 'OK')}
                ${moduleCard('RFID Reader', 'OK')}
                ${moduleCard('Ultrasonido', 'OK')}
                ${moduleCard('Flama/Agua Sensor', 'NO')}
                ${moduleCard('Buzzer', 'OK')}
                ${moduleCard('Display LCD', 'NO')}
              </div>
            </section>`,

            energia: `
            <section class="space-y-6">
              <h3 class="text-2xl font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">⚡ Alimentación</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <div class="flex items-center gap-2"><i data-feather="zap" class="text-xl"></i><h4 class="font-bold">Fuente de Alimentación</h4></div>
                  <p class="text-sm"><span class="font-medium">AC 120V</span></p>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <div class="flex items-center gap-2"><i data-feather="activity" class="text-xl"></i><h4 class="font-bold">Voltaje Actual</h4></div>
                  <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                    <div id="voltageBar" class="bg-indigo-500 h-4 rounded-full" style="width: 65%"></div>
                  </div>
                  <p class="text-sm"><span id="voltageLevel" class="font-medium">65V</span></p>
                </div>
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                  <div class="flex items-center gap-2"><i data-feather="cpu" class="text-xl"></i><h4 class="font-bold">Consumo</h4></div>
                  <p class="text-sm"><span id="powerConsumption" class="font-medium">1.5A</span></p>
                </div>
              </div>
            </section>`,

            cuentas: `
            <section class="space-y-6">
              <h3 class="text-2xl font-semibold border-b border-slate-200 dark;border-slate-700 pb-2">👥 Gestión de Cuentas</h3>
              ${accountManager()}
            </section>`,

            acerca: `
            <section class="space-y-6">
              <h3 class="text-2xl font-semibold border-b border-slate-200 dark;border-slate-700 pb-2">ℹ️ Acerca de</h3>
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
            ["acceso", "lock", "Acceso"],
            ["monitoreo", "activity", "Monitoreo"],
            ["energia", "zap", "Alimentación"],
            ["cuentas", "users", "Cuentas"],
            ["acerca", "info", "Acerca"]
        ];

        function initMenu() {
            const m = document.getElementById('menu');
            m.innerHTML = '';
            menuDef.forEach(([id, ic, label]) => {
                if (id === 'cuentas' && currentUser.role !== 'root') return;
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
            document.querySelectorAll('#menu button').forEach(el => el.classList.remove('bg-indigo-600', 'text-white', 'border-l-4', 'border-indigo-600'));
            btn.classList.add('bg-indigo-600', 'text-white', 'border-l-4', 'border-indigo-600');
            content.innerHTML = sections[id];
            feather.replace();

            applyBtnStyle();
            content.classList.add('fade-in');
            setTimeout(() => content.classList.remove('fade-in'), 400);
            if (id === 'home') renderSparkline();
            if (id === 'cuentas') loadUsers();
        }


        const applyBtnStyle = () => {
            document.querySelectorAll('.btn').forEach(b => {
                b.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'text-white', 'px-4', 'py-2', 'rounded');
            });
        };

        const toast = msg => {
            const t = document.createElement('div');
            t.className = 'bg-slate-800 text-white px-4 py-2 rounded shadow';
            t.textContent = msg;
            toastContainer.appendChild(t);
            setTimeout(() => t.remove(), 3000);
        };

        function clockTick() {
            clockNow.textContent = new Date().toLocaleTimeString();
        }
        setInterval(clockTick, 1000);

        function cmd(a) {
            toast(`Comando ${a}`);
            if (a === 'abrir') updateDoor('🔓 Abierta');
            if (a === 'cerrar') updateDoor('🔒 Cerrada');
        }
        function updateDoor(s) {
            document.querySelectorAll('#doorState, #homeDoorState').forEach(el => {
                if (el) el.textContent = s;
            });
        }
        function updateTemp(v) {
            const t1 = document.getElementById('tempValue');
            const t2 = document.getElementById('tempHeader');
            if (t1) t1.textContent = `${v}°C`;
            if (t2) t2.textContent = `${v}°C`;
        }
        function toggleFingerAdmin() {
            const d = document.getElementById('fingerAdmin');
            if (d) d.classList.toggle('hidden');
        }
        function updateAccessTable(dateStr) {
            document.getElementById('accessContainer').innerHTML = accessTableHTML(dateStr);
        }
        function exportAccessCSV() {
            toast('Exportando CSV... (simulado)');
        }
        function verifyModule(mod, btn) {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Verificando…';
            }
            setTimeout(() => {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Verificar';
                }
                toast(`Resultado de ${mod}: OK`);
            }, 1000);
        }

        // Variables globales
        let currentUser = null;
        let jwtToken = '';

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

        function renderUsers(list) {
            const tbody = document.querySelector('#usersTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            list.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td class="px-3 py-1">${u.username}</td>
                  <td class="px-3 py-1">${u.role}</td>
                  <td class="px-3 py-1">${u.activo ? '✅' : '❌'}</td>
                  <td class="px-3 py-1 space-x-2">
                    <button class="toggleUser btn btn-small" data-id="${u.id}" data-activo="${u.activo}">${u.activo ? 'Desactivar' : 'Activar'}</button>
                    <button class="delUser btn btn-small btn-danger" data-id="${u.id}">Eliminar</button>
                  </td>`;
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

        document.addEventListener('click', async e => {
            if (e.target.classList.contains('toggleUser')) {
                const id = e.target.dataset.id;
                const act = e.target.dataset.activo === '1' || e.target.dataset.activo === 'true';
                try {
                    await api(`/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: act ? 0 : 1 }) });
                    loadUsers();
                } catch (err) { toast(err.message); }
            }
            if (e.target.classList.contains('delUser')) {
                const id = e.target.dataset.id;
                if (!confirm('¿Eliminar usuario?')) return;
                try {
                    await api(`/users/${id}`, { method: 'DELETE' });
                    loadUsers();
                } catch (err) { toast(err.message); }
            }
        });

        // Otros botones
        themeBtn.onclick = () => {
            document.documentElement.classList.toggle('dark');
            feather.replace();
        };
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

        // Inicializar Feather Icons
        feather.replace();
});
