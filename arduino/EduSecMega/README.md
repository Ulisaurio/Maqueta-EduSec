# EduSecMega

This sketch merges the features of the original A1 and A2 prototypes so that a
single Arduino Mega can handle all commands from the Node.js panel.

## Pin Mapping

| Function                            | Pin |
|-------------------------------------|-----|
| DS18B20                             | 22  |
| Relay                               | 4   |
| PIR sensor                          | 2   |
| Ultrasonic TRIG                     | 8   |
| Ultrasonic ECHO                     | 9   |
| RFID SDA                            | 10  |
| RFID RST                            | 11  |
| RFID MOSI                           | 51  |
| RFID MISO                           | 50  |
| RFID SCK                            | 52  |
| RFID 3.3 V                          | 3.3 V pin |
| RFID GND                            | GND |
| Buzzer                              | 7   |
| RGB LED R/G/B                       | 3/5/6 |
| Fingerprint (Serial1) TX/RX         | 18/19 |

The serial port runs at 9600 bps and expects newline-terminated commands
(e.g. `abrir`, `enrolar 5`, `pir`). The sketch responds with a single line
suitable for the `sendSerial` helper in the Node.js backend.

## Module voltage requirements

Most components run from the Mega's 5 V regulator. The exceptions are the
MFRC522 RFID reader, which must be powered from 3.3 V, and its MOSI/MISO/SCK
lines wired to pins 51–52 as shown above.

| Module                  | Supply |
|-------------------------|--------|
| DS18B20                 | 5 V |
| Relay                   | 5 V |
| PIR sensor              | 5 V |
| Ultrasonic sensor       | 5 V |
| MFRC522 RFID            | 3.3 V |
| Buzzer                  | 5 V |
| RGB LED                 | 5 V |
| Fingerprint reader      | 5 V |

## Troubleshooting

If the RFID reader does not detect cards or the fingerprint sensor appears
missing, verify the following:

1. **Power connections** – The MFRC522 module must be powered from 3.3 V. The
   fingerprint sensor uses the 5 V pin.
2. **Signal wiring** – Connect the RC522's MOSI/MISO/SCK lines to pins
   51/50/52 on the Mega and its SDA line to pin 10. The fingerprint sensor's
   TX pin goes to RX1 (pin 19) and its RX pin to TX1 (pin 18).
3. **Serial commands** – Reading either module requires sending the commands
   `rfid` or `huella` (or `enrolar <id>`/`borrar <id>`). You can do this from
   the web interface or a serial terminal. The firmware will report
   "RFID listo"/"Sensor de huella listo" on startup when each peripheral is
   detected.
