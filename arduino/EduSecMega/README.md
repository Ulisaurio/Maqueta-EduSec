# EduSecMega

This sketch merges the features of the original A1 and A2 prototypes so that a
single Arduino Mega can handle all commands from the Node.js panel.

## Pin Mapping

| Function           | Pin |
|--------------------|-----|
| DS18B20            | 22  |
| Relay              | 4   |
| PIR sensor         | 2   |
| Ultrasonic TRIG    | 8   |
| Ultrasonic ECHO    | 9   |
| RFID SS            | 10  |
| RFID RST           | 11  |
| Buzzer             | 7   |
| RGB LED R/G/B      | 3/5/6 |
| Fingerprint (Serial1) TX/RX | 18/19 |
| Voltage sense      | A0  |

### RFID wiring

The MFRC522 module uses the Mega's hardware SPI bus. Besides `SS` and `RST`,
connect the remaining pins as follows:

- MOSI → 51
- MISO → 50
- SCK  → 52
- 3.3 V → 3.3 V pin
- GND  → GND

Adjust the wiring if necessary. The serial port runs at 9600 bps and expects
newline terminated commands (e.g. `abrir`, `enrolar 5`, `pir`). The sketch
responds with a single line suitable for the `sendSerial` helper in the Node.js
backend.
