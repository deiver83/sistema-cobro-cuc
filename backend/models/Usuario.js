const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    nombre_completo: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    telefono: { type: String },
    rol: { type: String, default: 'cobrador' }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);