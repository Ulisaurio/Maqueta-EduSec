import sendSerial from '../util/sendSerial.mjs';

export default async function () {
    // Aquí como ejemplo usa ID = 5; en el futuro enviaremos el ID desde el frontend.
    const id = 5;
    return await sendSerial(`borrar ${id}`);
}
