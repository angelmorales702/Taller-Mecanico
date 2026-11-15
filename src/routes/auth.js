// Pantallas 5 (Registro) y 6 (Iniciar sesión) + cierre de sesión.
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { t, esEmail, esTel, esUsuario, ah } = require('../helpers');

const guest = (req, res, next) => (req.session.user ? res.redirect(destino(req.session.user)) : next());
const destino = (u) => (u.rol === 3 ? '/admin/usuarios' : u.rol === 1 ? '/cliente/vehiculos' : u.rol === 2 ? '/mecanico/citas' : '/cuenta');

router.get('/registro', guest, (req, res) => res.render('registro', { titulo: 'Crear cuenta', form: {}, errores: [] }));

router.post('/registro', guest, ah(async (req, res) => {
  const f = { nombre: t(req.body.nombre), apellidos: t(req.body.apellidos), email: t(req.body.email).toLowerCase(),
    telefono: t(req.body.telefono), usuario: t(req.body.usuario) };
  const pass = req.body.password || '';
  const errores = [];
  if (!f.nombre || f.nombre.length > 60) errores.push('El nombre es obligatorio (máx. 60 caracteres).');
  if (!f.apellidos || f.apellidos.length > 80) errores.push('Los apellidos son obligatorios (máx. 80 caracteres).');
  if (!esEmail(f.email)) errores.push('Escribe un correo válido.');
  if (!esTel(f.telefono)) errores.push('El teléfono debe tener 10 dígitos.');
  if (!esUsuario(f.usuario)) errores.push('El usuario debe tener 3 a 30 caracteres (letras, números, punto, guion o guion bajo).');
  if (pass.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
  if (pass !== req.body.password2) errores.push('Las contraseñas no coinciden.');
  if (!errores.length) {
    const [dup] = await db.query('SELECT usuario, email FROM usuarios WHERE usuario = ? OR email = ?', [f.usuario, f.email]);
    if (dup.some((d) => d.email === f.email)) errores.push('Ese correo ya está registrado.');
    if (dup.some((d) => d.usuario === f.usuario)) errores.push('Ese nombre de usuario ya existe.');
  }
  if (errores.length) return res.render('registro', { titulo: 'Crear cuenta', form: f, errores });

  // Las cuentas creadas desde el registro público siempre son Cliente (id_rol = 1)
  await db.query(
    `INSERT INTO usuarios (nombre, apellidos, usuario, email, password_hash, telefono, id_rol) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [f.nombre, f.apellidos, f.usuario, f.email, await bcrypt.hash(pass, 10), f.telefono]);
  req.session.flash = { tipo: 'success', msg: 'Cuenta creada correctamente. Ya puedes iniciar sesión.' };
  res.redirect('/login');
}));

router.get('/login', guest, (req, res) => res.render('login', { titulo: 'Iniciar sesión', identificador: '', error: null }));

router.post('/login', guest, ah(async (req, res) => {
  const identificador = t(req.body.identificador);
  const pass = req.body.password || '';
  const fallo = (msg) => res.render('login', { titulo: 'Iniciar sesión', identificador, error: msg });
  if (!identificador || !pass) return fallo('Escribe tu usuario o correo y tu contraseña.');

  const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ? OR email = ? LIMIT 1', [identificador, identificador.toLowerCase()]);
  const u = rows[0];
  // Mensaje genérico: no se revela si falló el usuario o la contraseña
  if (!u || !u.activo || !(await bcrypt.compare(pass, u.password_hash))) return fallo('Usuario o contraseña incorrectos.');

  // Se regenera la sesión al iniciar (evita fijación de sesión)
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = { id: u.id_usuario, nombre: u.nombre, rol: u.id_rol };
    req.session.flash = { tipo: 'success', msg: `Bienvenido, ${u.nombre}.` };
    res.redirect(destino(req.session.user));
  });
}));

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

module.exports = router;
