const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ya configurado con mysql2/promise y SSL

// --- 1. OBTENER CLIENTES (Filtrados por Usuario) ---
router.get('/', async (req, res) => {
    const usuarioId = parseInt(req.query.usuarioId);
    
    if (!usuarioId) {
        return res.status(400).json({ error: "Falta el ID del usuario para listar clientes." });
    }

    try {
        // Al usar mysql2/promise, db.query devuelve un array donde el primer elemento son las filas
        const [rows] = await db.query(
            'SELECT * FROM clientes WHERE usuario_id = ? ORDER BY id DESC', 
            [usuarioId]
        );
        res.json(rows);
    } catch (err) {
        console.error("Error al obtener clientes:", err.message);
        res.status(500).json({ error: "Error en el servidor al obtener clientes" });
    }
});

// --- 2. CREAR CLIENTE (Amarrado al Usuario) ---
router.post('/', async (req, res) => {
    const { documento_identidad, nombre_completo, telefono, direccion, usuario_id } = req.body;

    if (!usuario_id) {
        return res.status(400).json({ error: "No se puede guardar un cliente sin un usuario dueño." });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO clientes (documento_identidad, nombre_completo, telefono, direccion, usuario_id) VALUES (?,?,?,?,?)', 
            [documento_identidad, nombre_completo, telefono, direccion, usuario_id]
        );
        
        // Devolvemos el ID generado por MySQL
        res.status(201).json({ 
            message: 'Cliente guardado con éxito', 
            clienteId: result.insertId 
        });
    } catch (err) {
        console.error("Error al crear cliente:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. EDITAR CLIENTE ---
router.put('/:id', async (req, res) => {
    const { nombre_completo, telefono, direccion } = req.body;
    const { id } = req.params;

    try {
        await db.query(
            'UPDATE clientes SET nombre_completo = ?, telefono = ?, direccion = ? WHERE id = ?', 
            [nombre_completo, telefono, direccion, id]
        );
        res.json({ message: 'Cliente editado correctamente' });
    } catch (err) {
        console.error("Error al editar cliente:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- 4. ELIMINAR CLIENTE ---
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM clientes WHERE id = ?', [id]);
        res.json({ message: 'Cliente eliminado con éxito' });
    } catch (err) {
        // Manejo específico para la integridad referencial (Foreign Keys)
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: "No se puede eliminar el cliente porque tiene préstamos asociados. Elimina primero sus préstamos." 
            });
        }
        res.status(500).json({ error: "Error al intentar eliminar el cliente." });
    }
});

module.exports = router;