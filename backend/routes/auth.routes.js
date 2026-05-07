const express = require('express');
const router = express.Router();
const db = require('../config/db');
const nodemailer = require('nodemailer'); 

// --- CONFIGURACIÓN DE ENVÍO DE CORREO ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, 
    auth: {
        user: 'pdeiver75@gmail.com', 
        pass: 'oftu vqzu lact okdl'  
    },
    tls: {
        rejectUnauthorized: false 
    }
});

// --- 1. REGISTRO DE NUEVO USUARIO ---
router.post('/register', async (req, res) => {
    const { nombre, email, password, telefono } = req.body;
    try {
        const cleanEmail = email ? email.trim() : null;
        const cleanTel = telefono ? telefono.trim() : null;

        // Verificamos si ya existe por Correo O por Teléfono
        const [usuarios] = await db.query(
            'SELECT id FROM usuarios WHERE (email = ? AND email IS NOT NULL) OR (telefono = ? AND telefono IS NOT NULL)', 
            [cleanEmail, cleanTel]
        );

        if (usuarios.length > 0) {
            return res.status(400).json({ error: "El correo o el teléfono ya están registrados." });
        }

        // Insertamos el nuevo usuario
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre_completo, email, password, telefono, rol) VALUES (?, ?, ?, ?, "cobrador")', 
            [nombre, cleanEmail, password, cleanTel]
        );
        
        res.json({ 
            success: true,
            user: { id: result.insertId, nombre_completo: nombre, email: cleanEmail, telefono: cleanTel } 
        });
    } catch (err) {
        console.error("Error en registro:", err);
        res.status(500).json({ error: "Error interno del servidor al registrar" });
    }
});

// --- 2. LOGIN DE USUARIO (Email o Teléfono) ---
router.post('/login', async (req, res) => {
    const { identifier, password } = req.body; 
    
    if (!identifier || !password) {
        return res.status(400).json({ error: "Faltan datos por ingresar" });
    }

    try {
        const cleanId = identifier.trim(); 

        // Buscamos coincidencia en ambas columnas
        const sql = `
            SELECT id, nombre_completo, email, telefono 
            FROM usuarios 
            WHERE (TRIM(email) = ? OR TRIM(telefono) = ?) 
            AND password = ?
        `;

        const [rows] = await db.query(sql, [cleanId, cleanId, password]);

        if (rows.length > 0) {
            console.log("✅ Login exitoso para:", cleanId);
            res.json({ success: true, user: rows[0] });
        } else {
            console.log("❌ Intento de login fallido para:", cleanId);
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
    } catch (err) {
        console.error("Error en servidor de BD:", err);
        res.status(500).json({ error: "Error en el servidor de base de datos" });
    }
});

// --- 3. RECOBRAR CONTRASEÑA ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const cleanEmail = email.trim();
        const [user] = await db.query('SELECT * FROM usuarios WHERE email = ?', [cleanEmail]);
        
        if (user.length === 0) {
            return res.status(404).json({ error: "El correo electrónico no existe." });
        }

        const nombreUsuario = user[0].nombre_completo;
        const passwordActual = user[0].password; 

        const mailOptions = {
            from: '"Sistema de Gestión de Cobros 💰" <pdeiver75@gmail.com>',
            to: cleanEmail,
            subject: 'Recuperación de Contraseña',
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; border: 1px solid #eee; padding: 30px; border-radius: 15px; max-width: 500px; margin: auto;">
                    <h2 style="color: #3b82f6; text-align: center;">Acceso al Sistema</h2>
                    <p>Hola <strong>${nombreUsuario}</strong>,</p>
                    <p>Has solicitado recordar tus credenciales de acceso.</p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #64748b; font-size: 0.8rem; text-transform: uppercase;">Tu contraseña es:</p>
                        <h1 style="margin: 10px 0; color: #1e293b; letter-spacing: 3px;">${passwordActual}</h1>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Correo enviado correctamente." });

    } catch (err) {
        res.status(500).json({ error: "No se pudo enviar el correo." });
    }
});

// --- 4. VERIFICAR EXISTENCIA ---
router.get('/check-user', async (req, res) => {
    const { email, telefono } = req.query;
    try {
        const qEmail = email ? email.trim() : '---';
        const qTel = telefono ? telefono.trim() : '---';

        const [rows] = await db.query(
            'SELECT id, nombre_completo, email, telefono FROM usuarios WHERE email = ? OR telefono = ?', 
            [qEmail, qTel]
        );
        
        if (rows.length > 0) {
            res.json({ exists: true, user: rows[0] });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: "Error al verificar usuario" });
    }
});

module.exports = router;