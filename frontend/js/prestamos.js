// Configuración de la URL (Asegúrate de que API_URL esté definida en api.js)
const fM = (v) => parseFloat(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// 1. CARGAR SELECT DE CLIENTES
async function cargarSelectClientes() {
    try {
        const res = await fetch(`${API_URL}/clientes`);
        const clientes = await res.json();
        const select = document.getElementById('clienteSeleccionado');
        
        if (!select) return;

        select.innerHTML = '<option value="">Seleccione un cliente</option>';
        clientes.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nombre_completo}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar clientes:", error);
    }
}

// 2. CARGAR TABLA DE PRÉSTAMOS (CON FILTRO DE VISIBILIDAD)
async function cargarPrestamos() {
    const usuarioData = JSON.parse(localStorage.getItem('usuario'));
    if (!usuarioData || !usuarioData.id) return;

    try {
        const res = await fetch(`${API_URL}/prestamos?usuarioId=${usuarioData.id}`);
        const prestamos = await res.json();
        const tabla = document.getElementById('listaPrestamos');
        
        if (!tabla) return;

        tabla.innerHTML = '';

        // --- MODIFICACIÓN: Filtramos solo los que están ACTIVO en visibilidad ---
        const prestamosVisibles = prestamos.filter(p => p.estado_visibilidad !== 'inactivo');

        if (prestamosVisibles.length === 0) {
            tabla.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay préstamos activos</td></tr>';
            return;
        }

        prestamosVisibles.forEach(p => {
            const pagadas = p.cuotas_pagadas || 0;
            const totales = p.cuotas_totales || 0;
            
            tabla.innerHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.cliente_nombre || '---'}</td>
                    <td>$${fM(p.monto)}</td>
                    <td>${p.tasa_interes}%</td>
                    <td>${p.modalidad}</td>
                    <td style="font-weight: bold; color: #007bff;">${pagadas} / ${totales}</td>
                    <td>$${fM(p.total_pagar)}</td>
                    <td><span class="badge ${p.estado}">${p.estado}</span></td>
                    <td>
                        <button class="btn-blue" onclick="location.href='cuotas.html?id=${p.id}'">Cuotas</button>
                        <button class="btn-red" style="background-color: ${p.estado === 'activo' ? '#dc3545' : '#28a745'}" 
                                onclick="cambiarEstado(${p.id}, '${p.estado}')">
                            ${p.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button class="btn-red" onclick="moverAlHistorial(${p.id})">Eliminar</button>
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error("Error al cargar préstamos:", error);
    }
}

// 3. GUARDAR PRÉSTAMO
async function guardarPrestamo(e) {
    e.preventDefault();
    const usuarioData = JSON.parse(localStorage.getItem('usuario'));

    const data = {
        cliente_id: document.getElementById('clienteSeleccionado').value,
        monto: document.getElementById('monto').value,
        tasa_interes: document.getElementById('interes').value,
        modalidad: document.getElementById('modalidad').value,
        cuotas: document.getElementById('numCuotas').value,
        fecha_inicio: document.getElementById('fechaInicio').value,
        usuario_id: usuarioData ? usuarioData.id : null,
        estado_visibilidad: 'activo' // Aseguramos que nazca visible
    };

    if (!data.cliente_id || !data.usuario_id) {
        alert("Debes seleccionar un cliente y estar logueado.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/prestamos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("✅ Préstamo Guardado");
            document.getElementById('formPrestamo').reset(); 
            cargarPrestamos(); 
        } else {
            const errorData = await res.json();
            alert("❌ Error: " + (errorData.error || "No se pudo guardar"));
        }
    } catch (error) {
        console.error("Error en el envío:", error);
        alert("❌ Error de conexión");
    }
}

// 4. CAMBIAR ESTADO
async function cambiarEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'activo' ? 'desactivado' : 'activo';
    try {
        const res = await fetch(`${API_URL}/prestamos/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        if (res.ok) cargarPrestamos(); 
    } catch (error) {
        console.error("Error al cambiar estado:", error);
    }
}

// 5. MOVER AL HISTORIAL (OCULTAR SIN BORRAR DE LA DB)
async function moverAlHistorial(id) {
    if (confirm("¿Seguro que deseas quitar este préstamo del panel? No se borrará el historial de pagos.")) {
        try {
            // Enviamos el PUT al backend para que cambie la visibilidad a 'inactivo'
            const res = await fetch(`${API_URL}/prestamos/borrar-logico/${id}`, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado_visibilidad: 'inactivo' })
            });

            if (res.ok) {
                alert("📂 Movido al historial correctamente");
                cargarPrestamos(); 
            }
        } catch (error) {
            console.error("Error al mover al historial:", error);
            alert("Error al procesar la solicitud");
        }
    }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    cargarSelectClientes();
    cargarPrestamos();
    const form = document.getElementById('formPrestamo');
    if (form) form.addEventListener('submit', guardarPrestamo);
});