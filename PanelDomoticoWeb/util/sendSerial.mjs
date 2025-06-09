// util/sendSerial.mjs
import SerialPort from 'serialport';
import ReadlineParser from '@serialport/parser-readline';

let port;
let parser;

/**
 * Inicializa el puerto serie (si no está inicializado) y retorna una promesa
 * que resuelve con la respuesta del Arduino.
 * @param {string} comando Texto que se envía (por ejemplo: "abrir")
 * @returns {Promise<string>} Respuesta del Arduino como string
 */
export default async function sendSerial(comando) {
    return new Promise((resolve, reject) => {
        // Si aún no se ha abierto el puerto, lo abrimos
        if (!port) {
            // CAMBIA 'COM5' por tu puerto real (ej. '/dev/ttyUSB0' en Linux)
            port = new SerialPort('COM5', {
                baudRate: 9600,
                autoOpen: false
            });

            // Parser para leer líneas separadas por \n
            parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            port.on('error', err => {
                console.error('Error en el puerto serial:', err.message);
            });
        }

        // Si el puerto no está abierto, lo abrimos
        if (!port.isOpen) {
            port.open(err => {
                if (err) {
                    return reject(`Error abriendo puerto: ${err.message}`);
                }
                // Una vez abierto, enviamos el comando
                port.write(comando + '\n', err => {
                    if (err) {
                        return reject(`Error enviando comando: ${err.message}`);
                    }
                });
            });
        } else {
            // Ya está abierto, simplemente enviamos
            port.write(comando + '\n', err => {
                if (err) {
                    return reject(`Error enviando comando: ${err.message}`);
                }
            });
        }

        // Esperamos la primera línea de respuesta del Arduino
        const onData = data => {
            // “data” es la línea completa (sin \r\n)
            resolve(data);
            parser.removeListener('data', onData);
        };

        // En caso de timeout (por si Arduino no responde en 2 segundos)
        const timeoutId = setTimeout(() => {
            parser.removeListener('data', onData);
            reject('Timeout: sin respuesta del Arduino.');
        }, 2000);

        parser.once('data', data => {
            clearTimeout(timeoutId);
            onData(data);
        });
    });
}
