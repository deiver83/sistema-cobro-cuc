const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true para puerto 465
    auth: {
        user: 'tu_correo@gmail.com', // Tu correo real
        pass: 'xxxx xxxx xxxx xxxx'  // Tu contraseña de aplicación de Google
    }
});

module.exports = transporter;