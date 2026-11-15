require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db');
const helpers = require('./helpers');
const { requireLogin, requireRole } = require('./middleware/auth');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.h = helpers; // helpers disponibles en todas las vistas: h.hora12(), h.dinero(), ...

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto-solo-para-desarrollo',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 }, // 4 horas
}));

// Datos disponibles en todas las vistas: usuario en sesión, mensaje flash y datos de contacto (pie de página)
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.path = req.path;
  try {
    const [c] = await db.query('SELECT * FROM contacto_taller LIMIT 1');
    res.locals.contacto = c[0] || null;
  } catch (e) { res.locals.contacto = null; }
  next();
});

app.use('/', require('./routes/publico'));
app.use('/', require('./routes/auth'));
app.use('/cuenta', requireLogin, require('./routes/cuenta'));
app.use('/cliente', requireRole(1), require('./routes/cliente'));
app.use('/mecanico', requireRole(2), require('./routes/mecanico'));
app.use('/admin/citas', requireRole(3), require('./routes/admin-citas'));
app.use('/admin', requireRole(3), require('./routes/admin'));

app.use((req, res) => res.status(404).render('error', { titulo: 'No encontrada', codigo: 404, mensaje: 'La página que buscas no existe.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('error', { titulo: 'Error', codigo: 500, mensaje: 'Ocurrió un error en el servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Taller mecánico en http://localhost:${PORT}`));
