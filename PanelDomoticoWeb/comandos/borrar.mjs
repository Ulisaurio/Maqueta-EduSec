import sendSerial from '../util/sendSerial.mjs';

export default async function borrar(id) {
    return await sendSerial(`borrar ${id}`);
}
