import sendSerial from '../util/sendSerial.mjs';

export default async function (id) {
    if (!id && id !== 0) throw new Error('ID de huella requerido');
    return await sendSerial(`enrolar ${id}`);
}
