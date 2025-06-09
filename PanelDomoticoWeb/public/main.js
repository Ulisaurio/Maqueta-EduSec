function sendCommand(cmd) {
    fetch('/comando', {                     // <──  aquí el cambio
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: cmd }) // ← debe ser {accion: ...} porque app.js lo espera así
    })
        .then(res => res.json())
        .then(data => {
            document.getElementById('output').textContent = data.mensaje;
        })
        .catch(() => {
            document.getElementById('output').textContent = 'Error de conexión';
        });
}
