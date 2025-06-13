# EduSec Arduino Firmware

This folder contains the firmware used by the EduSec project. Each
subdirectory holds an Arduino sketch. The `original` directory stores the
sketches that were tested individually on separate boards, while the
`EduSecMega` sketch combines all features for a single Arduino Mega.
`EduSecMega` provides the `EduSecMega_R2.ino` sketch for an Arduino Mega. Upload this file as it is the latest revision.

To build and upload a sketch using the Arduino IDE:

1. Open the `.ino` file located in the desired directory.
2. Select **Arduino Mega 2560** as the board (or the board you are using).
3. Install the required libraries via the Library Manager:
   - OneWire
   - DallasTemperature
   - Adafruit Fingerprint Sensor Library
   - MFRC522
4. Connect the board and upload.

Revision R2 changes the MFRC522 wiring:
`SDA` is now connected to pin **30** and `RST` to pin **31**.
The firmware continuously scans for RFID cards and prints `UID:` messages
on detection. The `rfid` command is still available for manual tests.

The Node.js backend communicates with the board over a serial port at 9600
baud. Commands must be terminated with a newline character and the firmware
responds with a single line of text.
