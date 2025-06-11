import sendSerial from '../util/sendSerial.mjs';

export default async function () {
    const respuesta = await sendSerial('abrir');
    return respuesta || 'Acceso principal abierto';
}
