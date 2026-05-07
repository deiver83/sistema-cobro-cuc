async function cargarDashboard() {
    // Obtenemos el ID del usuario desde el localStorage
    const usuarioData = JSON.parse(localStorage.getItem('usuario'));
    const usuarioId = usuarioData.id;
    const API_BASE = "https://tu-proyecto-backend.onrender.com/api";
    try {
        // 1. Llamamos a la ruta de estadísticas (esta es la clave)
        // Esta ruta debe devolver la suma real de la tabla historial_pagos
        const resStats = await fetch(`${API_BASE}/cuotas/estadisticas/resumen?usuarioId=${usuarioId}`);
        const stats = await resStats.json();

        // 2. Llamamos a la lista de préstamos solo para llenar la tabla inferior
        const resP = await fetch(`${API_BASE}/prestamos?usuarioId=${usuarioId}`);
        const prestamos = await resP.json();

        // --- ACTUALIZAR CUADROS SUPERIORES ---
        // Usamos los IDs que tienes en tu HTML para que la actualización sea directa
        document.getElementById('capPrestado').innerText = fM(stats.total_capital);
        document.getElementById('intGanar').innerText = fM(stats.total_intereses);
        document.getElementById('totalRecuperar').innerText = fM(stats.total_recuperar);
        
        // ¡Aquí es donde aparecerán los abonos del historial!
        document.getElementById('totalCobrado').innerText = fM(stats.total_cobrado);
        
        document.getElementById('faltaCobrar').innerText = fM(stats.falta_cobrar);
        document.getElementById('prestamosActivos').innerText = stats.prestamos_activos;

        // --- LLENAR TABLA DE PRÉSTAMOS ---
        const tabla = document.getElementById('tablaPrestamos');
        if (tabla) {
            tabla.innerHTML = '';
            prestamos.forEach(p => {
                tabla.innerHTML += `
                    <tr>
                        <td style="text-transform:capitalize;">${p.cliente_nombre || p.cliente}</td>
                        <td>$ ${fM(p.monto)}</td>
                        <td>${p.tasa_interes}%</td>
                        <td><span class="status-${p.estado}">${p.estado.toUpperCase()}</span></td>
                        <td><button class="btn-blue" onclick="location.href='cuotas.html?id=${p.id}'">Ver Detalles</button></td>
                    </tr>`;
            });
        }

    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}