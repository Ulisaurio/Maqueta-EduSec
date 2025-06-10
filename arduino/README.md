# EduSec Arduino Firmware

This folder contains the firmware used by the EduSec project. Each
subdirectory holds an Arduino sketch. The `original` directory stores the
sketches that were tested individually on separate boards, while the
`EduSecMega` sketch combines all features for a single Arduino Mega.

To build and upload a sketch using the Arduino IDE:

1. Open the `.ino` file located in the desired directory.
2. Select **Arduino Mega 2560** as the board (or the board you are using).
3. Install the required libraries via the Library Manager:
   - OneWire
   - DallasTemperature
   - Adafruit Fingerprint Sensor Library
   - MFRC522
4. Connect the board and upload.

The Node.js backend communicates with the board over a serial port at 9600
baud. Commands must be terminated with a newline character and the firmware
responds with a single line of text.
