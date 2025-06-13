// app.mjs
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import os from 'os';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { exec, spawn } from 'child_process';
import {
    getDb,
    initDb,
    closeDb,
    setDbInstance,
    openDb,
    addHuella,
    deleteHuella,
    addRfidCard,
    getRfidCards,
    deleteRfidCard,
    getSetting,
    setSetting,
    DB_PATH
} from './db.js';
import sendSerial, { isArduinoAvailable, checkArduino, sendSerialStream, serialEmitter } from './util/sendSerial.mjs';
import { readConfig, writeConfig } from './util/config.mjs';
import enrolarCmd from './comandos/enrolar.mjs';
import borrarCmd from './comandos/borrar.mjs';
import rgbRedCmd from './comandos/rgb_red.mjs';
import rgbGreenCmd from './comandos/rgb_green.mjs';

// ———————— CONFIGURACIONES BÁSICAS ————————
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'cambio_esta_clave_por_una_aleatoria_y_segura';

// ———————— MIDDLEWARES ————————
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
const upload = multer({ dest: os.tmpdir() });

// ———————— INICIALIZAR BASE DE DATOS ————————
let db;
await initDb();      // Crea tablas y usuario admin si es necesario
db = await getDb();  // Obtener instancia “promisificada” de la BD
const cfg = await readConfig();
let systemArmed = !!cfg.systemArmed;
try {
    if (systemArmed) {
        await rgbRedCmd();
    } else {
        await rgbGreenCmd();
    }
} catch (err) {
    console.error('Error inicializando LED RGB:', err);
}

serialEmitter.on('message', async msg => {
    const m = /^UID:\s*([A-F0-9:]+)/i.exec(msg);
    if (!m) return;
    const uid = m[1].toUpperCase();
    try {
        const row = await db.get('SELECT usuario_id FROM rfid_cards WHERE uid = ?', [uid]);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [row ? row.usuario_id : null, 'rfid', uid]
        );
        if (row) {
            if (systemArmed) {
                systemArmed = false;
                await writeConfig({ systemArmed });
                try { await rgbGreenCmd(); } catch (e) { console.error('LED RGB:', e); }
                await db.run(
                    `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
                    [row.usuario_id, 'system_state', 'disarmed by rfid']
                );
                sendSerial('abrir').catch(() => {});
            } else {
                systemArmed = true;
                await writeConfig({ systemArmed });
                try { await rgbRedCmd(); } catch (e) { console.error('LED RGB:', e); }
                await db.run(
                    `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
                    [row.usuario_id, 'system_state', 'armed by rfid']
                );
            }
        }
    } catch (err) {
        console.error('Error manejando UID:', err);
    }
});

serialEmitter.on('message', async msg => {
    const m = /Huella\s+valida\s*ID:\s*(\d+)/i.exec(msg);
    if (!m) return;
    const fid = parseInt(m[1], 10);
    try {
        const row = await db.get('SELECT usuario_id FROM huellas WHERE huella_id = ?', [fid]);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [row ? row.usuario_id : null, 'huella', `id:${fid}`]
        );
        if (row && systemArmed) {
            systemArmed = false;
            await writeConfig({ systemArmed });
            try { await rgbGreenCmd(); } catch (e) { console.error('LED RGB:', e); }
            await db.run(
                `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
                [row.usuario_id, 'system_state', 'disarmed by fingerprint']
            );
        }
    } catch (err) {
        console.error('Error manejando huella:', err);
    }
});

// ———————— AUTENTICACIÓN JWT ————————
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ msg: 'Token requerido' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ msg: 'Token inválido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ msg: 'Token expirado o inválido' });
        req.user = user;
        next();
    });
}

// ———————— RUTA /login ————————
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ msg: 'Faltan campos' });
    }
    try {
        const row = await db.get(
            `SELECT id, username, password, role, activo 
         FROM usuarios 
        WHERE username = ?`,
            [username]
        );
        if (!row) {
            return res.status(401).json({ msg: 'Usuario no encontrado' });
        }
        if (row.activo === 0) {
            return res.status(403).json({ msg: 'Usuario inactivo' });
        }
        const match = await bcrypt.compare(password, row.password);
        if (!match) {
            return res.status(401).json({ msg: 'Credenciales incorrectas' });
        }
        await db.run(
            `UPDATE usuarios 
          SET ultimo_login = CURRENT_TIMESTAMP 
        WHERE id = ?`,
            [row.id]
        );
        const payload = { id: row.id, username: row.username, role: row.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token, username: row.username, role: row.role });
    } catch (err) {
        console.error('Error en /login:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// ———————— CARGAR MÓDULOS DE COMANDOS DINÁMICAMENTE ————————
const accionesMap = {};
const comandosDir = path.join(__dirname, 'comandos');

async function cargarComandos() {
    try {
        const archivos = await fs.readdir(comandosDir);
        for (const archivo of archivos) {
            if (!archivo.endsWith('.mjs')) continue;
            const nombre = path.basename(archivo, '.mjs');
            const moduloPath = path.join(comandosDir, archivo);
            // Convierte a file:// URL para que Windows lo acepte:
            const fileUrl = pathToFileURL(moduloPath).href;
            const comandoModule = await import(fileUrl);
            accionesMap[nombre] = comandoModule.default;
        }
        console.log('✅ Módulos cargados:', Object.keys(accionesMap));
    } catch (err) {
        console.error('⛔ Error cargando módulos de comandos:', err);
    }
}
await cargarComandos();

// ———————— RUTA PARA DESCARGAR LOGS EN CSV ————————
app.get('/logs/:date/csv', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ msg: 'Fecha inválida' });
    }
    try {
        const rows = await db.all(
            `SELECT logs.timestamp, usuarios.username, logs.accion, logs.detalle
               FROM logs
               LEFT JOIN usuarios ON logs.usuario_id = usuarios.id
              WHERE date(logs.timestamp) = ?
           ORDER BY logs.timestamp ASC`,
            [date]
        );
        const header = 'timestamp,username,accion,detalle\n';
        const csv = header + rows.map(r => {
            const ts = new Date(r.timestamp).toISOString();
            const u = r.username || '';
            const a = r.accion || '';
            const d = (r.detalle || '').replace(/"/g, '""');
            return `"${ts}","${u}","${a}","${d}"`;
        }).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="logs_${date}.csv"`);
        return res.send(csv);
    } catch (err) {
        console.error('Error en GET /logs/:date/csv:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// ———————— RUTA PARA OBTENER LOGS POR FECHA ————————
app.get('/logs/:date', authenticateToken, async (req, res) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ msg: 'Fecha inválida' });
    }
    try {
        const rows = await db.all(
            `SELECT logs.timestamp, logs.accion, logs.detalle, usuarios.username
               FROM logs
               LEFT JOIN usuarios ON logs.usuario_id = usuarios.id
              WHERE date(logs.timestamp) = ?
           ORDER BY logs.timestamp ASC`,
            [date]
        );
        return res.json(rows);
    } catch (err) {
        console.error('Error en GET /logs/:date:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// ———————— RUTA PROTEGIDA /comando/:accion ————————
app.get('/comando/:accion', authenticateToken, async (req, res) => {
    const accion = req.params.accion;
    const fn = accionesMap[accion];
    if (!fn) {
        return res.status(404).json({ msg: `Acción '${accion}' no encontrada` });
    }
    try {
        const id = req.query.id ? parseInt(req.query.id, 10) : undefined;
        const resultado = await fn(id);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle)
         VALUES (?, ?, ?)`,
            [req.user.id, accion, resultado.mensaje || JSON.stringify(resultado)]
        );
        if (accion === 'enrolar' && typeof id !== 'undefined') {
            await addHuella({ usuario_id: req.user.id, huella_id: id });
        } else if (accion === 'borrar' && typeof id !== 'undefined') {
            await deleteHuella(id);
        }
        return res.json({ accion, resultado });
    } catch (err) {
        const mensaje = err && err.message ? err.message : 'Sin respuesta del Arduino';
        console.error(`Error ejecutando comando '${accion}':`, mensaje);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle)
         VALUES (?, ?, ?)`,
            [req.user.id, accion, mensaje]
        );
        return res.json({ accion, resultado: mensaje });
    }
});

// ———————— GESTIÓN DE HUELLAS ————————
app.get('/huellas', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all(
            `SELECT h.huella_id, h.usuario_id, h.nombre, h.apellido_pat, h.apellido_mat, u.username
               FROM huellas h
               JOIN usuarios u ON h.usuario_id = u.id
           ORDER BY h.huella_id`
        );
        res.json(rows);
    } catch (err) {
        console.error('Error en GET /huellas:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.post('/huellas', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { usuario_id, nombre, apellido_pat, apellido_mat } = req.body;
    if (!usuario_id || !nombre || !apellido_pat || !apellido_mat) {
        return res.status(400).json({ msg: 'usuario_id, nombre, apellido_pat y apellido_mat requeridos' });
    }
    const fn = accionesMap['enrolar'];
    if (!fn) return res.status(500).json({ msg: 'Comando no soportado' });
    try {
        const row = await db.get(
            'SELECT MAX(CAST(huella_id AS INTEGER)) AS max FROM huellas'
        );
        const maxId = row && row.max ? Number(row.max) : 0;
        const nextId = maxId + 1;
        const resp = await sendSerialStream(`enrolar ${nextId}`);
        const ok = /enrolada/i.test(resp);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [req.user.id, ok ? 'enrolar' : 'enrolar_error', resp]
        );
        if (!ok) {
            return res.status(500).json({ msg: resp });
        }
        await db.run(
            'INSERT INTO huellas (usuario_id, huella_id, nombre, apellido_pat, apellido_mat) VALUES (?, CAST(? AS INTEGER), ?, ?, ?)',
            [usuario_id, nextId, nombre, apellido_pat, apellido_mat]
        );
        res.json({ huella_id: nextId, usuario_id, nombre, apellido_pat, apellido_mat });
    } catch (err) {
        console.error('Error en POST /huellas:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});
// --------- Administrar huellas ---------

app.delete('/huellas/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const resp = await sendSerial(`borrar ${id}`);
        const ok = /Huella borrada/i.test(resp);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [req.user.id, ok ? 'borrar' : 'borrar_error', `huella:${id} => ${resp}`]
        );
        if (ok) {
            await db.run(`DELETE FROM huellas WHERE huella_id = ?`, [id]);
            return res.json({ msg: resp });
        } else {
            return res.status(500).json({ msg: resp });
        }
    } catch (err) {
        console.error('Error en DELETE /huellas/:id:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Gestión de tarjetas RFID ---------
app.get('/rfid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    try {
        const rows = await getRfidCards();
        res.json(rows);
    } catch (err) {
        console.error('Error en GET /rfid:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.post('/rfid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { uid, usuario_id } = req.body;
    if (!uid || !usuario_id) {
        return res.status(400).json({ msg: 'uid y usuario_id requeridos' });
    }
    try {
        await addRfidCard({ uid, usuario_id });
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [req.user.id, 'rfid_add', uid]
        );
        res.json({ uid, usuario_id });
    } catch (err) {
        console.error('Error en POST /rfid:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.delete('/rfid/:uid', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { uid } = req.params;
    try {
        await deleteRfidCard(uid);
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [req.user.id, 'rfid_del', uid]
        );
        res.json({ msg: 'Tarjeta eliminada' });
    } catch (err) {
        console.error('Error en DELETE /rfid/:uid:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.get('/rfid/validate/:uid', authenticateToken, async (req, res) => {
    const { uid } = req.params;
    try {
        const row = await db.get('SELECT 1 FROM rfid_cards WHERE uid = ?', [uid]);
        res.json({ valid: !!row });
    } catch (err) {
        console.error('Error en GET /rfid/validate/:uid:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Estado armado del sistema ---------
app.get('/system-state', authenticateToken, (req, res) => {
    res.json({ armed: systemArmed });
});

app.post('/system-state', authenticateToken, async (req, res) => {
    const { armed } = req.body;
    if (typeof armed !== 'boolean') {
        return res.status(400).json({ msg: 'armed requerido' });
    }
    if (armed !== systemArmed) {
        systemArmed = armed;
        await writeConfig({ systemArmed });
        try {
            if (systemArmed) {
                await rgbRedCmd();
            } else {
                await rgbGreenCmd();
            }
        } catch (err) {
            console.error('Error cambiando LED RGB:', err);
        }
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle) VALUES (?, ?, ?)`,
            [req.user.id, 'system_state', systemArmed ? 'armed' : 'disarmed']
        );
    }
    res.json({ armed: systemArmed });
});

// ———————— ESTADO DEL ARDUINO ————————
app.get('/status/arduino', async (req, res) => {
    await checkArduino();
    res.json({ available: isArduinoAvailable() });
});

// ———————— EVENTOS SERIAL (SSE) ————————
app.get('/serial-events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const onMsg = msg => {
        res.write(`data: ${msg}\n\n`);
    };
    serialEmitter.on('message', onMsg);
    req.on('close', () => {
        serialEmitter.off('message', onMsg);
    });
});

// --------- Ajustes del sistema ---------

app.get('/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    try {
        const rows = await db.all('SELECT clave, valor FROM ajustes');
        const obj = {};
        for (const r of rows) obj[r.clave] = r.valor;
        res.json(obj);
    } catch (err) {
        console.error('Error en GET /settings:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.patch('/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const updates = req.body || {};
    if (typeof updates !== 'object') {
        return res.status(400).json({ msg: 'Datos inválidos' });
    }
    try {
        for (const [k, v] of Object.entries(updates)) {
            await setSetting(k, String(v));
        }
        res.json({ msg: 'ok' });
    } catch (err) {
        console.error('Error en PATCH /settings:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

app.get('/settings/serial-port', async (req, res) => {
    const cfg = await readConfig();
    res.json({ serialPort: cfg.serialPort });
});

app.post('/settings/serial-port', async (req, res) => {
    const { serialPort } = req.body;
    if (!serialPort) return res.status(400).json({ msg: 'serialPort requerido' });
    await writeConfig({ serialPort });
    res.json({ msg: 'ok' });
});

// ———————— CRUD DE USUARIOS (/users) ————————
app.get('/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    try {
        const usuarios = await db.all(
            `SELECT id, username, role, activo, creado, ultimo_login 
         FROM usuarios`
        );
        return res.json(usuarios);
    } catch (err) {
        console.error('Error en GET /users:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

app.post('/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ msg: 'Faltan campos' });
    }
    try {
        const hashPw = await bcrypt.hash(password, 10);
        await db.run(
            `INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)`,
            [username, hashPw, role]
        );
        return res.json({ msg: 'Usuario creado' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ msg: 'Usuario ya existe' });
        }
        console.error('Error en POST /users:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

app.patch('/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { id } = req.params;
    const { password, activo, role } = req.body;
    try {
        const current = await db.get(`SELECT role, activo FROM usuarios WHERE id = ?`, [id]);
        if (!current) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        if (current.role === 'root') {
            const { count } = await db.get(`SELECT COUNT(*) AS count FROM usuarios WHERE role = 'root' AND activo = 1`);
            const newRole = role || current.role;
            const newActivo = typeof activo !== 'undefined' ? (activo ? 1 : 0) : current.activo;
            if (count === 1 && (newRole !== 'root' || newActivo === 0)) {
                return res.status(400).json({ msg: 'No se puede desactivar o cambiar el único usuario root activo' });
            }
        }

        const updates = [];
        const params = [];
        if (password) {
            const hashPw = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashPw);
        }
        if (typeof activo !== 'undefined') {
            updates.push('activo = ?');
            params.push(activo ? 1 : 0);
        }
        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (updates.length) {
            params.push(id);
            await db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        return res.json({ msg: 'Usuario actualizado' });
    } catch (err) {
        console.error('Error en PATCH /users/:id:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

app.delete('/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const { id } = req.params;
    try {
        const current = await db.get(`SELECT role FROM usuarios WHERE id = ?`, [id]);
        if (!current) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }
        if (current.role === 'root') {
            const { count } = await db.get(`SELECT COUNT(*) AS count FROM usuarios WHERE role = 'root'`);
            if (count === 1) {
                return res.status(400).json({ msg: 'No se puede eliminar el único usuario root' });
            }
        }
        await db.run(`DELETE FROM usuarios WHERE id = ?`, [id]);
        return res.json({ msg: 'Usuario eliminado' });
    } catch (err) {
        console.error('Error en DELETE /users/:id:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Backup de la base de datos ---------
app.post('/backup', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const tempPath = path.join(os.tmpdir(), `edusec_backup_${ts}.db`);
    try {
        await fs.copyFile(DB_PATH, tempPath);
        res.download(tempPath, `edusec_backup_${ts}.db`, err => {
            fs.unlink(tempPath).catch(() => {});
            if (err) console.error('Error enviando backup:', err);
        });
    } catch (err) {
        console.error('Error en POST /backup:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Restaurar base de datos ---------
app.post('/restore', authenticateToken, upload.single('backup'), async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    if (!req.file) {
        return res.status(400).json({ msg: 'Archivo requerido' });
    }
    try {
        const buf = await fs.readFile(req.file.path);
        if (buf.slice(0, 16).toString() !== 'SQLite format 3\0') {
            await fs.unlink(req.file.path);
            return res.status(400).json({ msg: 'Archivo inválido' });
        }
        await closeDb();
        await fs.copyFile(req.file.path, DB_PATH);
        await fs.unlink(req.file.path);
        const newDb = await openDb();
        setDbInstance(newDb);
        db = newDb;
        res.json({ msg: 'Restaurado' });
    } catch (err) {
        console.error('Error en POST /restore:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Limpiar cache ---------
app.post('/clear-cache', authenticateToken, async (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    try {
        await db.run('DELETE FROM logs');
        await db.run('VACUUM');
        res.json({ msg: 'ok' });
    } catch (err) {
        console.error('Error en POST /clear-cache:', err);
        res.status(500).json({ msg: 'Error interno' });
    }
});

// --------- Actualizar sistema ---------
app.post('/system/update', authenticateToken, (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    exec('git pull', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
        if (err) {
            console.error('Error en POST /system/update:', err);
            return res.status(500).json({ msg: stderr || err.message });
        }
        res.json({ msg: stdout.trim() || 'Actualizado' });
    });
});

// --------- Reiniciar módulos ---------
app.post('/system/restart', authenticateToken, (req, res) => {
    if (req.user.role !== 'root') {
        return res.status(403).json({ msg: 'Acceso denegado: solo root' });
    }
    res.json({ msg: 'Reiniciando...' });
    setTimeout(() => {
        const args = process.argv.slice(1);
        const child = spawn(process.argv[0], args, {
            cwd: process.cwd(),
            detached: true,
            stdio: 'inherit'
        });
        child.unref();
        process.exit(0);
    }, 100);
});

// ———————— RUTA “Catch-all” para SPA ————————
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ———————— ARRANCA EL SERVIDOR ————————
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
