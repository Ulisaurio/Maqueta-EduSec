# EduSec Front End

This repository contains a simple Node.js backend and a web-based front end for the EduSec demo panel. The interface is built with plain HTML enhanced by [Tailwind CSS](https://tailwindcss.com/) and uses [Feather Icons](https://feathericons.com/) and [Chart.js](https://www.chartjs.org/) for basic charts.

## Running

```bash
npm install
node PanelDomoticoWeb/app.mjs
```

The application serves the contents of `PanelDomoticoWeb/public`. Open `http://localhost:3000` after starting the server.

## Design Overview

The UI includes:

- A login form with basic validation
- A responsive dashboard with a sidebar menu
- Theme toggle (light/dark)
- Module verification with loading feedback
- Temperature chart with hover tooltips

All components aim to be mobile friendly and accessible.
