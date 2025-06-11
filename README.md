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

## Design Overview

The UI includes:

- A login form with basic validation
- A responsive dashboard with a sidebar menu
- Theme toggle (light/dark)
- Module verification with loading feedback
- Temperature chart with hover tooltips


All components aim to be mobile friendly and accessible.

## Arduino Firmware

The `arduino/` directory contains the sketches that run on the microcontroller.
`arduino/original` stores the standalone prototypes, while
`arduino/EduSecMega` is the unified sketch for an Arduino Mega. Consult the
respective `README.md` files for pin mapping and library requirements.

### Assets Notice
The logo file `logo_edusec.png` is not included in this repository.
After cloning the project, manually copy it into:
`PanelDomoticoWeb/public/img/`
- The SQLite database now stores timestamps in local time.

