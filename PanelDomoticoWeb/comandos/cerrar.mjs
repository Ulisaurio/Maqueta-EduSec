import sendSerial from '../util/sendSerial.mjs';

export default async function () {
    const respuesta = await sendSerial('cerrar');
    return respuesta || 'Puerta cerrada';
}
