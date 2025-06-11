// app.mjs
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getDb, initDb } from './db.js';
import { isArduinoAvailable } from './util/sendSerial.mjs';

// ———————— CONFIGURACIONES BÁSICAS ————————
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'cambio_esta_clave_por_una_aleatoria_y_segura';

// ———————— MIDDLEWARES ————————
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ———————— INICIALIZAR BASE DE DATOS ————————
let db;
await initDb();      // Crea tablas y usuario admin si es necesario
db = await getDb();  // Obtener instancia “promisificada” de la BD

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
        const resultado = await fn();
        await db.run(
            `INSERT INTO logs (usuario_id, accion, detalle)
         VALUES (?, ?, ?)`,
            [req.user.id, accion, resultado.mensaje || JSON.stringify(resultado)]
        );
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

// ———————— LISTAR HUELLAS ————————
app.get('/huellas', authenticateToken, async (req, res) => {
    const fn = accionesMap['listar_huellas'];
    if (!fn) {
        return res.status(500).json({ msg: 'Comando no soportado' });
    }
    try {
        const resp = await fn();
        const list = resp ? resp.split(',').filter(Boolean).map(n => parseInt(n)) : [];
        return res.json(list);
    } catch (err) {
        console.error('Error en /huellas:', err);
        return res.status(500).json({ msg: 'Error interno' });
    }
});

// ———————— ESTADO DEL ARDUINO ————————
app.get('/status/arduino', (req, res) => {
    res.json({ available: isArduinoAvailable() });
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

// ———————— RUTA “Catch-all” para SPA ————————
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ———————— ARRANCA EL SERVIDOR ————————
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
