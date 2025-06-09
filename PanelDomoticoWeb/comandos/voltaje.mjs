import { sendSerial } from '../util/sendSerial.mjs';

export default async function (serial) {
    return await sendSerial(serial, 'voltaje');
}
