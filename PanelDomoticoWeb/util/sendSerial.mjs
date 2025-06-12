// util/sendSerial.mjs
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { EventEmitter } from 'events';
import { readConfig } from './config.mjs';

export const serialEmitter = new EventEmitter();

let port;
let parser;
let parserHooked = false;
let arduinoAvailable = false;

/**
 * Detect if the configured serial port exists.
 */
export async function checkArduino() {
    const cfg = await readConfig();
    const portPath = cfg.serialPort || 'COM5';
    try {
        const ports = await SerialPort.list();
        arduinoAvailable = ports.some(p => p.path === portPath);
    } catch (err) {
        arduinoAvailable = false;
        console.error('Error listando puertos serial:', err.message);
    }
}

export function isArduinoAvailable() {
    return arduinoAvailable;
}

await checkArduino();

function createPort(portPath) {
    port = new SerialPort({ path: portPath, baudRate: 9600, autoOpen: false });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    port.on('error', err => {
        console.error('Error en el puerto serial:', err.message);
    });
    if (!parserHooked) {
        parser.on('data', d => serialEmitter.emit('message', d));
        parserHooked = true;
    }
}

/**
 * Inicializa el puerto serie (si no está inicializado) y retorna una promesa
 * que resuelve con la respuesta del Arduino.
 * Si el puerto no está disponible, devuelve un mensaje de advertencia.
 * @param {string} comando Texto que se envía (por ejemplo: "abrir")
 * @returns {Promise<string>} Respuesta del Arduino como string
 */
export default async function sendSerial(comando) {
    const cfg = await readConfig();
    const portPath = cfg.serialPort || 'COM5';
    if (port && port.path !== portPath) {
        await new Promise(res => {
            if (port.isOpen) {
                port.close(() => res());
            } else {
                res();
            }
        });
        createPort(portPath);
        await checkArduino();
    }
    if (!arduinoAvailable) {
        await checkArduino();
        if (!arduinoAvailable) {
            return `Arduino no disponible (${portPath})`;
        }
    }
    return new Promise((resolve) => {
        // Inicializar puerto y parser si es necesario
        if (!port) {
            createPort(portPath);
        }

        const writeCmd = () => {
            port.write(comando + '\n', err => {
                if (err) {
                    arduinoAvailable = false;
                    return resolve(`Error enviando comando: ${err.message}`);
                }
            });
        };

        if (!port.isOpen) {
            port.open(err => {
                if (err) {
                    arduinoAvailable = false;
                    return resolve(`Error abriendo puerto: ${err.message}`);
                }
                writeCmd();
            });
        } else {
            writeCmd();
        }

        const onData = data => {
            resolve(data);
            parser.removeListener('data', onData);
        };

        const timeoutId = setTimeout(() => {
            parser.removeListener('data', onData);
            resolve('Timeout: sin respuesta del Arduino.');
        }, 2000);

        parser.once('data', data => {
            clearTimeout(timeoutId);
            onData(data);
        });
    });
}

export async function sendSerialStream(comando, endRegex = /(enrolada|error)/i, timeout = 30000) {
    const cfg = await readConfig();
    const portPath = cfg.serialPort || 'COM5';
    if (port && port.path !== portPath) {
        await new Promise(res => {
            if (port.isOpen) {
                port.close(() => res());
            } else {
                res();
            }
        });
        createPort(portPath);
        await checkArduino();
    }
    if (!arduinoAvailable) {
        await checkArduino();
        if (!arduinoAvailable) {
            return `Arduino no disponible (${portPath})`;
        }
    }
    return new Promise(resolve => {
        if (!port) {
            createPort(portPath);
        }
        const writeCmd = () => {
            port.write(comando + '\n', err => {
                if (err) {
                    arduinoAvailable = false;
                    cleanup();
                    return resolve(`Error enviando comando: ${err.message}`);
                }
            });
        };
        const cleanup = () => {
            clearTimeout(timer);
            parser.removeListener('data', onData);
        };
        const onData = data => {
            lastLine = data;
            if (endRegex.test(data)) {
                cleanup();
                resolve(data);
            }
        };
        if (!port.isOpen) {
            port.open(err => {
                if (err) {
                    arduinoAvailable = false;
                    return resolve(`Error abriendo puerto: ${err.message}`);
                }
                writeCmd();
            });
        } else {
            writeCmd();
        }
        let lastLine = '';
        parser.on('data', onData);
        const timer = setTimeout(() => {
            cleanup();
            resolve(lastLine || 'Timeout: sin respuesta del Arduino.');
        }, timeout);
    });
}
