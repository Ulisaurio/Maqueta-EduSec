import sendSerial from '../util/sendSerial.mjs';

export default async function (serial) {
    const respuesta = await sendSerial(serial, 'cerrar');
    return respuesta || 'Puerta cerrada';
}
