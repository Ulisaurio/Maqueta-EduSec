// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolver __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para abrir la conexión
export async function openDb() {
    return open({
        filename: path.join(__dirname, 'edusec.db'),
        driver: sqlite3.Database
    });
}

let dbInstance;

// Devuelve una instancia singleton de la base de datos
export async function getDb() {
    if (!dbInstance) {
        dbInstance = await openDb();
    }
    return dbInstance;
}

// Al inicializar la app, creamos tablas si no existen
export async function initDb() {
    const db = await openDb();

    // Tabla de usuarios
    await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      activo INTEGER NOT NULL DEFAULT 1,
      creado DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
      ultimo_login DATETIME
    )
  `);

    // Tabla de logs (para guardar cada comando ejecutado)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      accion TEXT NOT NULL,
      detalle TEXT,
      timestamp DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    )
  `);

    // Tabla de huellas (si en el futuro quieres mapear id huella ⇔ usuario)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS huellas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      huella_id TEXT NOT NULL,
      nombre TEXT,
      apellido_pat TEXT,
      apellido_mat TEXT,
      creado DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    )
  `);

    // Tabla de tarjetas RFID
    await db.exec(`
    CREATE TABLE IF NOT EXISTS rfid_cards (
      uid TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      creado DATETIME NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    )
  `);

    // Revisar si existe al menos un usuario root por defecto; si no, lo creamos
    const row = await db.get(`SELECT COUNT(*) AS count FROM usuarios`);
    if (row.count === 0) {
        // Password por defecto: "admin" (hash a continuación)
        import('bcrypt').then(async ({ hash }) => {
            const pwHash = await hash('admin', 10);
            await db.run(
                `INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)`,
                ['admin', pwHash, 'root']
            );
            console.log('👤 Usuario por defecto creado: admin / admin');
        });
    }

    // Si no hay ningún usuario root activo, reactivamos el primero que exista
    const activeRoot = await db.get(`SELECT COUNT(*) AS count FROM usuarios WHERE role = 'root' AND activo = 1`);
    if (activeRoot.count === 0) {
        const anyRoot = await db.get(`SELECT id FROM usuarios WHERE role = 'root' LIMIT 1`);
        if (anyRoot) {
            await db.run(`UPDATE usuarios SET activo = 1 WHERE id = ?`, [anyRoot.id]);
            console.log(`⚠️  Usuario root ID ${anyRoot.id} reactivado automáticamente`);
        }
    }

    return db;
}

// ----- CRUD helpers for huellas -----

export async function addHuella({ usuario_id, huella_id, nombre, apellido_pat, apellido_mat }) {
    const db = await getDb();
    return db.run(
        `INSERT INTO huellas (usuario_id, huella_id, nombre, apellido_pat, apellido_mat) VALUES (?, ?, ?, ?, ?)`,
        [usuario_id, huella_id, nombre, apellido_pat, apellido_mat]
    );
}

export async function getHuellas() {
    const db = await getDb();
    return db.all(`
        SELECT h.id, h.usuario_id, h.huella_id, h.nombre, h.apellido_pat, h.apellido_mat, h.creado, u.username
          FROM huellas h
          JOIN usuarios u ON h.usuario_id = u.id
      ORDER BY h.huella_id
    `);
}

export async function getHuellaById(id) {
    const db = await getDb();
    return db.get(`SELECT * FROM huellas WHERE id = ?`, [id]);
}

export async function updateHuella(id, { usuario_id, huella_id }) {
    const updates = [];
    const params = [];
    if (typeof usuario_id !== 'undefined') {
        updates.push('usuario_id = ?');
        params.push(usuario_id);
    }
    if (typeof huella_id !== 'undefined') {
        updates.push('huella_id = ?');
        params.push(huella_id);
    }
    if (!updates.length) return;
    params.push(id);
    const db = await getDb();
    return db.run(`UPDATE huellas SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteHuella(huellaId) {
    const db = await getDb();
    return db.run('DELETE FROM huellas WHERE huella_id = ?', [huellaId]);
}

// ----- CRUD helpers for RFID cards -----

export async function addRfidCard({ uid, usuario_id }) {
    const db = await getDb();
    return db.run(
        `INSERT INTO rfid_cards (uid, usuario_id) VALUES (?, ?)`,
        [uid, usuario_id]
    );
}

export async function getRfidCards() {
    const db = await getDb();
    return db.all(`SELECT * FROM rfid_cards`);
}

export async function deleteRfidCard(uid) {
    const db = await getDb();
    return db.run('DELETE FROM rfid_cards WHERE uid = ?', [uid]);
}
