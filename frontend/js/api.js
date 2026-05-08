// Configuración de la URL de la API con el nuevo Backend de Render
const API_BASE = "https://sistema-cobro-backend-gqse.onrender.com/api";

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

// Exportamos la constante para que otros archivos (.js) puedan usarla
export default API_BASE;