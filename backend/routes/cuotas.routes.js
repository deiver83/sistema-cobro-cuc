const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ============================================================
// 1. RUTA: RESUMEN COMPLETO 
// ============================================================
router.get('/resumen/completo', async (req, res) => {
    const { usuarioId } = req.query;
    try {
        const [rows] = await db.query(`
            SELECT 
                p.id,
                p.fecha_inicio, 
                c.nombre_completo as cliente, 
                p.monto as importe_credito, 
                p.modalidad, 
                p.tasa_interes, 
                p.total_pagar,
                (SELECT IFNULL(SUM(valor_pagado), 0) FROM cuotas WHERE prestamo_id = p.id) as total_abonado,
                (SELECT COUNT(*) FROM cuotas WHERE prestamo_id = p.id AND estado != 'pagado') as cuotas_restantes
            FROM prestamos p
            JOIN clientes c ON p.cliente_id = c.id
            WHERE p.usuario_id = ?
            ORDER BY p.fecha_inicio DESC
        `, [usuarioId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 2. HISTORIAL GENERAL
// ============================================================
router.get('/historial/general', async (req, res) => {
    const usuarioId = req.query.usuarioId;
    try {
        const [rows] = await db.query(
            'SELECT * FROM historial_pagos WHERE usuario_id = ? ORDER BY fecha_pago DESC', 
            [usuarioId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 3. ESTADÍSTICAS PARA EL DASHBOARD (FILTRADO SOLO POR ACTIVOS)
// ============================================================
router.get('/estadisticas/resumen', async (req, res) => {
    const usuarioId = parseInt(req.query.usuarioId);
    if (!usuarioId || isNaN(usuarioId)) return res.status(400).json({ error: "ID inválido" });

    try {
        // 1. Sumamos Capital, Intereses y Total solo de préstamos EN CURSO (Activos)
        const [pStats] = await db.query(`
            SELECT 
                IFNULL(SUM(monto), 0) as total_capital,
                IFNULL(SUM(total_pagar - monto), 0) as total_intereses,
                COUNT(*) as prestamos_activos,
                IFNULL(SUM(total_pagar), 0) as total_recuperar
            FROM prestamos 
            WHERE usuario_id = ? 
              AND estado = 'activo' 
              AND estado_visibilidad = 'activo'
        `, [usuarioId]);

        // 2. TOTAL COBRADO: Sumamos solo los abonos de esos mismos préstamos activos
        // Al poner p.estado = 'activo', el dinero de Yineth (finalizado) desaparece del Dashboard
        const [cStats] = await db.query(`
            SELECT IFNULL(SUM(c.valor_pagado), 0) as total_cobrado
            FROM cuotas c
            INNER JOIN prestamos p ON c.prestamo_id = p.id
            WHERE p.usuario_id = ? 
              AND p.estado = 'activo' 
              AND p.estado_visibilidad = 'activo'
        `, [usuarioId]);

        const totalRecuperar = parseFloat(pStats[0].total_recuperar);
        const totalCobrado = parseFloat(cStats[0].total_cobrado);
        const faltaCobrar = Math.max(0, totalRecuperar - totalCobrado);

        res.json({
            total_capital: pStats[0].total_capital,
            total_intereses: pStats[0].total_intereses,
            total_recuperar: totalRecuperar,
            prestamos_activos: pStats[0].prestamos_activos,
            total_cobrado: totalCobrado, // Solo mostrará abonos de préstamos vigentes
            falta_cobrar: faltaCobrar
        });

    } catch (err) {
        console.error("Error en estadísticas de activos:", err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 4. OBTENER CUOTAS DE UN PRÉSTAMO (CON FECHA DE PAGO REAL)
// ============================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params; 
    try {
        const query = `
            SELECT c.*, 
            (SELECT h.fecha_pago 
             FROM historial_pagos h 
             WHERE h.cuota_id = c.id 
             ORDER BY h.fecha_pago DESC LIMIT 1) as fecha_pago_real
            FROM cuotas c
            WHERE c.prestamo_id = ?
            ORDER BY c.numero_cuota ASC
        `;
        const [rows] = await db.query(query, [id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 5. REALIZAR PAGO Y GENERAR HISTORIAL AUTOMÁTICO
// ============================================================
router.post('/pagar', async (req, res) => {
    let { cuotaId, monto } = req.body;
    if (typeof monto === 'string') monto = monto.replace(/\./g, '');
    const montoNum = parseFloat(monto);

    try {
        const [info] = await db.query(`
            SELECT c.*, p.usuario_id, cli.nombre_completo as cliente 
            FROM cuotas c 
            JOIN prestamos p ON c.prestamo_id = p.id 
            JOIN clientes cli ON p.cliente_id = cli.id 
            WHERE c.id = ?`, [cuotaId]);

        if (info.length === 0) return res.status(404).json({ error: "Cuota no encontrada" });

        const cuota = info[0];
        const nuevoPagado = parseFloat(cuota.valor_pagado) + montoNum;
        const nuevoSaldo = Math.max(0, parseFloat(cuota.valor_cuota) - nuevoPagado);
        const nuevoEstadoCuota = nuevoSaldo <= 0 ? 'pagado' : 'pendiente';

        await db.query(
            'UPDATE cuotas SET valor_pagado = ?, saldo_pendiente = ?, estado = ? WHERE id = ?',
            [nuevoPagado, nuevoSaldo, nuevoEstadoCuota, cuotaId]
        );

        await db.query(
            'INSERT INTO historial_pagos (cuota_id, usuario_id, cliente_nombre, monto_pagado) VALUES (?, ?, ?, ?)',
            [cuotaId, cuota.usuario_id, cuota.cliente, montoNum]
        );

        const [pendientes] = await db.query(
            'SELECT COUNT(*) as restantes FROM cuotas WHERE prestamo_id = ? AND estado != "pagado"',
            [cuota.prestamo_id]
        );

        if (pendientes[0].restantes === 0) {
            await db.query('UPDATE prestamos SET estado = "finalizado" WHERE id = ?', [cuota.prestamo_id]);
        }

        if (req.io) req.io.emit('actualizarDashboard');
        res.json({ message: 'Pago procesado', nuevoSaldo });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 6. REVERTIR PAGO
// ============================================================
router.put('/revertir/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [cuotas] = await db.query('SELECT * FROM cuotas WHERE id = ?', [id]);
        if (cuotas.length === 0) return res.status(404).json({ error: "No existe la cuota" });

        const cuota = cuotas[0];
        await db.query(
            'UPDATE cuotas SET valor_pagado = 0, saldo_pendiente = ?, estado = "pendiente" WHERE id = ?',
            [cuota.valor_cuota, id]
        );
        await db.query('UPDATE prestamos SET estado = "activo" WHERE id = ?', [cuota.prestamo_id]);

        if (req.io) req.io.emit('actualizarDashboard');
        res.json({ message: 'Pago revertido' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;