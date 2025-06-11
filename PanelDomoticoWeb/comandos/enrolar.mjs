import sendSerial from '../util/sendSerial.mjs';

export default async function (id) {
    return await sendSerial(`enrolar ${id}`);
}
