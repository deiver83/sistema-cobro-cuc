async function cargarClientes() {
    try {
        const res = await fetch(`${API_URL}/clientes`);
        const clientes = await res.json();
        const tabla = document.getElementById('listaClientes');
        tabla.innerHTML = '';

        clientes.forEach(c => {
            tabla.innerHTML += `
                <tr>
                    <td>${c.documento_identidad}</td>
                    <td>${c.nombre_completo}</td>
                    <td>${c.telefono}</td>
                    <td>${c.direccion}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-blue" style="background: #ffc107; color: black;" 
                                onclick="editarCliente(${c.id}, '${c.nombre_completo}', '${c.telefono}', '${c.direccion}')">Editar</button>
                            <button class="btn-red" onclick="eliminarCliente(${c.id})">Eliminar</button>
                        </div>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error("Error cargando clientes:", e); }
}

// Crear Cliente
document.getElementById('formCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        documento_identidad: document.getElementById('documento').value,
        nombre_completo: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value,
        direccion: document.getElementById('direccion').value
    };

    const res = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        alert("✅ Cliente guardado");
        location.reload();
    }
});

// Eliminar Cliente
async function eliminarCliente(id) {
    if (confirm("¿Estás seguro de eliminar este cliente?")) {
        const res = await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
        if (res.ok) cargarClientes();
    }
}

// Editar Cliente
async function editarCliente(id, nombreAct, telAct, dirAct) {
    const nuevoNombre = prompt("Nuevo nombre:", nombreAct);
    const nuevoTel = prompt("Nuevo teléfono:", telAct);
    const nuevaDir = prompt("Nueva dirección:", dirAct);

    if (nuevoNombre && nuevoTel && nuevaDir) {
        const res = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: nuevoNombre,
                telefono: nuevoTel,
                direccion: nuevaDir
            })
        });
        if (res.ok) {
            alert("Cliente actualizado");
            cargarClientes();
        }
    }
}

document.addEventListener('DOMContentLoaded', cargarClientes);