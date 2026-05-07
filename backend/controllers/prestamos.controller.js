// Ejemplo de lo que debería hacer tu controlador
export const finalizarPrestamo = async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    try {
        // 1. Obtenemos los datos del préstamo antes de borrarlo/finalizarlo
        const [prestamo] = await db.query("SELECT * FROM prestamos WHERE id = ?", [id]);

        if (prestamo.length > 0) {
            const p = prestamo[0];

            // 2. INSERTAMOS en el historial de pagos como un registro final
            await db.query(
                "INSERT INTO historial_pagos (cuota_id, usuario_id, cliente_nombre, monto_pagado) VALUES (?, ?, ?, ?)",
                [null, usuario_id, p.cliente_id, p.total_pagar] 
                // Ajusta los nombres de columnas según lo que vimos anoche en tu terminal
            );

            // 3. ACTUALIZAMOS el estado para que desaparezca del dashboard activo
            await db.query("UPDATE prestamos SET estado = 'finalizado', estado_visibilidad = 'inactivo' WHERE id = ?", [id]);

            res.json({ message: "Préstamo movido al historial correctamente" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al mover al historial" });
    }
};