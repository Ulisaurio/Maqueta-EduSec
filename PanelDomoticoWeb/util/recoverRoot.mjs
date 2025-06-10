// util/recoverRoot.mjs
import { getDb } from '../db.js';

const db = await getDb();

const rootUser = await db.get(`SELECT id FROM usuarios WHERE role = 'root' LIMIT 1`);
if (!rootUser) {
    console.log('No existe un usuario root en la base de datos');
    process.exit(1);
}
await db.run(`UPDATE usuarios SET activo = 1 WHERE id = ?`, [rootUser.id]);
console.log(`Cuenta root con ID ${rootUser.id} reactivada.`);

