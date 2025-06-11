import sendSerial from '../util/sendSerial.mjs';

export default async function enrolar(id) {
    return await sendSerial(`enrolar ${id}`);
}
