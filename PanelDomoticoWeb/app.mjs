import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getDb, initDb } from './db.js';

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

// ———————— RUTA PROTEGIDA /comando/:accion ————————
app.get('/comando/:accion', authenticateToken, async (req, res) => {
    const accion = req.params.accion;
    const fn = accionesMap[accion];
    if (!fn) {
        return res.status(404).json({ error: `Acción '${accion}' no encontrada` });
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
        console.error(`Error ejecutando comando '${accion}':`, err);
        return res.status(500).json({ error: 'Error interno al ejecutar comando.' });
    }
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
        if (password) {
            const hashPw = await bcrypt.hash(password, 10);
            await db.run(`UPDATE usuarios SET password = ? WHERE id = ?`, [hashPw, id]);
        }
        if (typeof activo !== 'undefined') {
            await db.run(`UPDATE usuarios SET activo = ? WHERE id = ?`, [activo ? 1 : 0, id]);
        }
        if (role) {
            await db.run(`UPDATE usuarios SET role = ? WHERE id = ?`, [role, id]);
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
