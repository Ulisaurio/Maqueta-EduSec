import sendSerial from '../util/sendSerial.mjs';

export default async function () {
    return await sendSerial('listar_huellas');
}
