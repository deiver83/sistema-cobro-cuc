const express = require('express');
const cors = require('cors');
const http = require('http');
const mysql = require('mysql2/promise');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configuración de Socket.io preparada para producción
const io = new Server(server, { 
    cors: { 
        origin: "*", // En producción puedes cambiar "*" por la URL de tu frontend
        methods: ["GET", "POST"]
    } 
});

// Middlewares
app.use(cors());
app.use(express.json());

// Pasar Socket.io a las rutas
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- CONEXIÓN A MYSQL (POOL CON PROMESAS) ---
// Configurado para Railway con reconexión automática
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true, // Mantiene la conexión viva para evitar cierres inesperados
    keepAliveInitialDelay: 10000
});

// Probar conexión inicial y exponer db
(async () => {
    try {
        const connection = await db.getConnection();
        console.log("✅ ¡ÉXITO! Conectado a MySQL en Railway (Nube)");
        connection.release();
    } catch (err) {
        console.error("❌ Error crítico al conectar a MySQL:", err.message);
    }
})();

// Compartir la base de datos con todas las rutas
app.set('db', db);

// --- RUTAS DEL SISTEMA ---
app.use('/api/clientes', require('./routes/clientes.routes'));
app.use('/api/prestamos', require('./routes/prestamos.routes'));
app.use('/api/cuotas', require('./routes/cuotas.routes')); 
app.use('/api/auth', require('./routes/auth.routes'));

// Ruta de salud para que Render sepa que el servicio está vivo
app.get('/', (req, res) => res.send("🚀 Servidor de Cobros Activo y listo para trabajar"));

// --- MANEJO DE ERRORES GLOBAL ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// --- PUERTO DINÁMICO (CRUCIAL PARA RENDER) ---
const PORT = process.env.PORT || 3000; 

server.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    console.log(`🌍 URL base: http://localhost:${PORT}`);
});