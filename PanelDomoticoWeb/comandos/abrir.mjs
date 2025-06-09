import { sendSerial } from '../util/sendSerial.mjs';

export default async function (serial) {
    const respuesta = await sendSerial(serial, 'abrir');
    return respuesta || 'Puerta abierta';
}
