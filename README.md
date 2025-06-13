# EduSec Front End

This repository contains a simple Node.js backend and a web-based front end for the EduSec demo panel. The interface is built with plain HTML enhanced by [Tailwind CSS](https://tailwindcss.com/) and uses [Feather Icons](https://feathericons.com/) and [Chart.js](https://www.chartjs.org/) for basic charts.

## Running

```bash
npm install

# Unix/macOS
SERIAL_PORT=/dev/ttyUSB0 npm start

# Windows (cmd)
set SERIAL_PORT=COM5 && npm start
```
The `SERIAL_PORT` variable should point to the Arduino's serial device. If
omitted the app defaults to `COM5`. The application serves the contents of
`PanelDomoticoWeb/public`. Open `http://localhost:3000` after starting the
server.

You can also change the port from the web interface. Visit the "Configuración"
section and update the **Puerto Serie** field. The chosen value is stored in
`PanelDomoticoWeb/config.json` so it persists across restarts.

## Design Overview

The UI includes:

- A login form with basic validation
- A responsive dashboard with a sidebar menu
- Theme toggle (light/dark)
- Module verification with loading feedback
- Silent buzzer status checks (the buzzer only sounds on alarms or when
  using the "Probar" testing button)
- Temperature chart with hover tooltips


All components aim to be mobile friendly and accessible.

## Arduino Firmware

The `arduino/` directory contains the sketches that run on the microcontroller.
`arduino/original` stores the standalone prototypes, while
`arduino/EduSecMega` is the unified sketch for an Arduino Mega. Consult the
respective `README.md` files for pin mapping and library requirements.
Currently `arduino/EduSecMega/EduSecMega_R2.ino` is the recommended firmware and the version deployed on the demo panel. The previous `EduSecMega.ino` file is kept for reference. Both revisions now poll the RFID reader and fingerprint sensor in the background, printing `UID:` or `Huella valida ID:` messages whenever a card or fingerprint is detected.
When a stored fingerprint is recognized the door relay opens for about five seconds and then closes again. Each successful match is reported over serial so the backend can log the event.

## Access System

The RGB LED acts as the system status indicator:

- **Green** – system disarmed
- **Red** – system armed

When armed, any motion detected by the PIR sensor or a door opening via the distance sensor triggers the alarm. During the alarm the LED flashes red, then returns to solid red once the buzzer stops.

The system can be armed or disarmed either from the dashboard or by presenting a valid RFID card. Swiping a card while disarmed arms the system (LED turns red). Swiping again disarms it without opening the door.

### Fingerprint Access

The `huella` command triggers a fingerprint check on the Arduino. If a valid finger is detected the relay opens for about five seconds and a message is printed to the serial port so the backend can log the event. Manual commands from the dashboard still work normally and keep the door open or closed until changed or a fingerprint is read.

### Sensor Demo Mode

Enable **Modo Demo Sensores** from the configuration screen to bypass stored credentials. When active, any RFID card read or fingerprint detected is treated as valid, allowing quick demonstrations even if enrollment fails.

### Door Sensor Calibration

Root users can calibrate the ultrasonic door sensor from the settings panel. The wizard measures the distance with the door closed, open and closed again, averages the readings to the nearest centimeter and stores them as the open and closed thresholds. These values replace the fixed 10 cm limit used by the UI.

### Assets Notice
The logo file `logo_edusec.png` is not included in this repository.
After cloning the project, manually copy it into:
`PanelDomoticoWeb/public/img/`
- The SQLite database now stores timestamps in local time.


## Credential Enrollment

### Enroll a fingerprint
1. Log in as a **root** user and open **Acceso principal**.
2. Click **Administrar Huellas** then **Agregar Nueva Huella**.
3. Select the account and fill in the name fields.
4. Follow the on-screen prompts. The Arduino typically prints:
   ```
   Coloca el dedo...
   Retira el dedo
   Coloca el mismo dedo de nuevo...
   Huella enrolada
   ```
   If the sensor is missing you will see `Sensor de huella no disponible`.

### Register an RFID card
1. In the **Monitoreo** section choose **Administrar Tarjetas** and press **Agregar Nueva Tarjeta**.
2. Present the card when prompted. The firmware responds with `UID: XX:YY:ZZ` or `RFID no disponible`.
3. Pick the user and save. Duplicate cards cause a "Tarjeta ya registrada" error.

### Troubleshooting
- Ensure the fingerprint sensor and RFID reader are wired and powered correctly. Missing modules trigger the messages above.
- Remove unwanted or duplicate entries from the SQLite database at `PanelDomoticoWeb/edusec.db`.
- Place your custom logo at `PanelDomoticoWeb/public/img/logo_edusec.png` so the login screen displays it.

The application uses a SQLite database stored in `PanelDomoticoWeb/edusec.db`.
