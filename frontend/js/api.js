// Configuración de la URL de la API en Render
const API_BASE = "https://sistema-cobro-cuc.onrender.com/api";

// Función para obtener datos (Ejemplo: Clientes)
export async function obtenerClientes() {
    try {
        const respuesta = await fetch(`${API_BASE}/clientes`);
        if (!respuesta.ok) throw new Error("Error al obtener clientes");
        return await respuesta.json();
    } catch (error) {
        console.error("Error en la API:", error);
        return [];
    }
}

// Puedes exportar la constante para usarla en otros archivos si es necesario
export default API_BASE;