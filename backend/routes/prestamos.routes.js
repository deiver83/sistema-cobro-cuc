const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// 1. RUTA DASHBOARD - ESTADÍSTICAS (SINCRONIZADAS)
// ==========================================
router.get('/estadisticas/resumen', async (req, res) => {
    const usuarioId = parseInt(req.query.usuarioId);
    if (!usuarioId) return res.status(400).json({ error: "No se proporcionó el ID de usuario" });

    try {
        // Obtenemos capital y totales de préstamos que el usuario ve como 'activos'
        const [pStats] = await db.query(`
            SELECT 
                IFNULL(SUM(monto), 0) as total_capital,
                IFNULL(SUM(total_pagar - monto), 0) as total_intereses,
                IFNULL(SUM(total_pagar), 0) as total_recuperar,
                COUNT(*) as prestamos_activos
            FROM prestamos 
            WHERE usuario_id = ? AND estado_visibilidad = 'activo'
        `, [usuarioId]);

        // SUMA REAL: Todo lo cobrado según el historial de pagos para este usuario
        const [hStats] = await db.query(`
            SELECT IFNULL(SUM(monto_pagado), 0) as total_cobrado 
            FROM historial_pagos 
            WHERE usuario_id = ?
        `, [usuarioId]);

        const totalRecuperar = parseFloat(pStats[0].total_recuperar);
        const totalCobrado = parseFloat(hStats[0].total_cobrado);
        const faltaCobrar = Math.max(0, totalRecuperar - totalCobrado);

        res.json({
            total_capital: pStats[0].total_capital,
            total_intereses: pStats[0].total_intereses,
            total_recuperar: totalRecuperar,
            prestamos_activos: pStats[0].prestamos_activos,
            total_cobrado: totalCobrado,
            falta_cobrar: faltaCobrar
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. LISTAR PRÉSTAMOS
// ==========================================
router.get('/', async (req, res) => {
    const usuarioId = req.query.usuarioId;
    const verHistorial = req.query.historial === 'true'; 
    
    try {
        let sql = `
            SELECT p.*, c.nombre_completo as cliente_nombre,
            (SELECT COUNT(*) FROM cuotas WHERE prestamo_id = p.id AND estado = 'pagado') as cuotas_pagadas,
            (SELECT COUNT(*) FROM cuotas WHERE prestamo_id = p.id) as cuotas_totales,
            (SELECT IFNULL(SUM(valor_pagado), 0) FROM cuotas WHERE prestamo_id = p.id) as total_abonado
            FROM prestamos p 
            INNER JOIN clientes c ON p.cliente_id = c.id 
            WHERE p.usuario_id = ?
        `;

        if (!verHistorial) {
            sql += " AND p.estado_visibilidad = 'activo'";
        }

        sql += " ORDER BY p.id DESC";

        const [rows] = await db.query(sql, [usuarioId]);
        res.json(rows);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// 3. GUARDAR PRÉSTAMO
// ==========================================
router.post('/', async (req, res) => {
    let { cliente_id, monto, tasa_interes, cuotas, fecha_inicio, modalidad, usuario_id } = req.body;
    
    if (typeof monto === 'string') monto = monto.replace(/\./g, '');
    
    const montoNum = parseFloat(monto);
    const tasaNum = parseFloat(tasa_interes);
    const total_pagar = montoNum + (montoNum * (tasaNum / 100));
    const valor_cuota = total_pagar / cuotas;

    try {
        const [result] = await db.query(
            'INSERT INTO prestamos (cliente_id, monto, tasa_interes, total_pagar, cantidad_cuotas, modalidad, usuario_id, fecha_inicio, estado, estado_visibilidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "activo", "activo")',
            [cliente_id, montoNum, tasaNum, total_pagar, cuotas, modalidad, usuario_id, fecha_inicio]
        );

        const prestamoId = result.insertId;

        for (let i = 1; i <= cuotas; i++) {
            let fechaVenc = new Date(fecha_inicio);
            if (modalidad.toLowerCase() === 'diario') fechaVenc.setDate(fechaVenc.getDate() + i);
            else if (modalidad.toLowerCase() === 'semanal') fechaVenc.setDate(fechaVenc.getDate() + (i * 7));
            else if (modalidad.toLowerCase() === 'quincenal') fechaVenc.setDate(fechaVenc.getDate() + (i * 15));
            else if (modalidad.toLowerCase() === 'mensual') fechaVenc.setMonth(fechaVenc.getMonth() + i);

            await db.query(
                'INSERT INTO cuotas (prestamo_id, numero_cuota, valor_cuota, valor_pagado, saldo_pendiente, fecha_vencimiento, estado) VALUES (?, ?, ?, 0, ?, ?, "pendiente")',
                [prestamoId, i, valor_cuota, valor_cuota, fechaVenc]
            );
        }

        res.json({ message: 'OK', prestamoId });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// 4. MOVER AL HISTORIAL (BORRADO LÓGICO)
// ==========================================
router.put('/borrar-logico/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE prestamos SET estado_visibilidad = "historial" WHERE id = ?', [id]);
        res.json({ success: true, message: "Movido al historial correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. BORRADO DEFINITIVO DEL HISTORIAL (CON REVERSIÓN DE SALDOS)
// ==========================================
router.post('/borrar-definitivo', async (req, res) => {
    const { ids } = req.body;

    try {
        for (let id of ids) {
            // 1. Obtener datos del pago antes de borrarlo
            const [pago] = await db.query('SELECT cuota_id, monto_pagado FROM historial_pagos WHERE id = ?', [id]);
            
            if (pago.length > 0) {
                const { cuota_id, monto_pagado } = pago[0];

                // 2. Revertir saldo en la cuota
                await db.query(`
                    UPDATE cuotas 
                    SET valor_pagado = valor_pagado - ?, 
                        saldo_pendiente = saldo_pendiente + ?,
                        estado = 'pendiente'
                    WHERE id = ?`, 
                [monto_pagado, monto_pagado, cuota_id]);
            }
        }

        // 3. Eliminar físicamente del historial (limpia la fecha en el frontend)
        await db.query('DELETE FROM historial_pagos WHERE id IN (?)', [ids]);

        res.json({ message: "Historial limpiado y cuotas actualizadas correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. OBTENER CUOTAS CON FECHA REAL (CORREGIDA)
// ==========================================
router.get('/cuotas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT c.*, 
            (SELECT h.fecha_pago 
             FROM historial_pagos h 
             WHERE h.cuota_id = c.id 
               AND h.monto_pagado > 0  -- Solo si hubo dinero real
             ORDER BY h.fecha_pago DESC LIMIT 1) as fecha_pago_real
            FROM cuotas c
            WHERE c.prestamo_id = ?
            ORDER BY c.numero_cuota ASC
        `;
        const [rows] = await db.query(query, [id]);
        
        // --- LA SOLUCIÓN ATÓMICA ---
        // Si el valor pagado es 0, obligamos a que la fecha sea NULL antes de enviarla
        const rowsCorregidas = rows.map(cuota => {
            if (parseFloat(cuota.valor_pagado) <= 0) {
                return { ...cuota, fecha_pago_real: null };
            }
            return cuota;
        });

        res.json(rowsCorregidas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;