const socket = io('https://tu-app-en-render.onrender.com');

// Función para mostrar con puntos: 175000 -> 175.000
const fM = (v) => parseFloat(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

// Función para LIMPIAR puntos antes de enviar al servidor: "175.000" -> 175000
const limpiarNumero = (str) => {
    if (typeof str === 'number') return str;
    // Elimina todos los puntos y devuelve el número puro
    return parseFloat(str.replace(/\./g, '').replace(/,/g, '')) || 0;
};

async function cargarDatosCuotas() {
    const params = new URLSearchParams(window.location.search);
    const prestamoId = params.get('id');
    if (!prestamoId) return;

    try {
        const res = await fetch(`${API_URL}/cuotas/${prestamoId}`);
        const cuotas = await res.json();
        
        const tabla = document.getElementById('listaCuotas');
        const select = document.getElementById('selectCuota');
        
        tabla.innerHTML = '';
        select.innerHTML = '<option value="">Seleccione una cuota</option>';

        const hoy = new Date();
        hoy.setHours(0,0,0,0);

        cuotas.forEach(c => {
            const fechaVenc = new Date(c.fecha_vencimiento);
            
            // Lógica de colores según fecha y estado
            let clase = 'status-pendiente';
            if (c.estado === 'pagado') {
                clase = 'status-pagado';
            } else if (fechaVenc < hoy) {
                clase = 'status-vencido'; // Rojo si ya pasó la fecha
            }

            if (c.estado !== 'pagado') {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `Cuota ${c.numero_cuota} - Pendiente: $${fM(c.saldo_pendiente)}`;
                select.appendChild(opt);
            }

            tabla.innerHTML += `
                <tr>
                    <td>${c.id}</td>
                    <td>${c.numero_cuota}</td>
                    <td>${fechaVenc.toLocaleDateString()}</td>
                    <td>$${fM(c.valor_cuota)}</td>
                    <td>$${fM(c.valor_pagado)}</td>
                    <td>$${fM(c.saldo_pendiente)}</td>
                    <td><span class="${clase}">${c.estado.toUpperCase()}</span></td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}

// PROCESAR EL PAGO
document.getElementById('formAbono').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // CAPTURAMOS EL MONTO Y LE QUITAMOS LOS PUNTOS
    const montoEscrito = document.getElementById('montoAbono').value;
    const montoLimpio = limpiarNumero(montoEscrito);

    if (montoLimpio <= 0) {
        alert("Por favor ingrese un monto válido");
        return;
    }

    const datos = { 
        cuota_id: document.getElementById('selectCuota').value, 
        monto_abono: montoLimpio // Enviamos el número real (ej: 175000)
    };

    const res = await fetch(`${API_URL}/cuotas/abonar`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(datos)
    });

    if (res.ok) { 
        alert("✅ Pago de $" + fM(montoLimpio) + " realizado con éxito"); 
        location.reload(); 
    } else {
        alert("❌ Error al procesar el pago");
    }
});

document.addEventListener('DOMContentLoaded', cargarDatosCuotas);