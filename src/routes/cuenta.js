// Pantallas 7, 10 y 13: "Mi cuenta" (misma pantalla para Cliente, Mecánico y Administrador).
// Cada usuario solo ve y modifica SU propio registro (el id sale de la sesión, nunca de la URL).
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { t, esEmail, esTel, ah } = require('../helpers');

async function cargar(id) {
  const [r] = await db.query('SELECT id_usuario, nombre, apellidos, usuario, email, telefono, id_rol, especialidad FROM usuarios WHERE id_usuario = ?', [id]);
  return r[0];
}

router.get('/', ah(async (req, res) => {
  res.render('cuenta', { titulo: 'Mi cuenta', cuenta: await cargar(req.session.user.id), errores: [], erroresPass: [] });
}));

router.post('/', ah(async (req, res) => {
  const id = req.session.user.id;
  const actual = await cargar(id);
  const f = { nombre: t(req.body.nombre), apellidos: t(req.body.apellidos), email: t(req.body.email).toLowerCase(), telefono: t(req.body.telefono) };
  const errores = [];
  if (!f.nombre || f.nombre.length > 60) errores.push('El nombre es obligatorio.');
  if (!f.apellidos || f.apellidos.length > 80) errores.push('Los apellidos son obligatorios.');
  if (!esEmail(f.email)) errores.push('Escribe un correo válido.');
  if (!esTel(f.telefono)) errores.push('El teléfono debe tener 10 dígitos.');
  if (!errores.length) {
    const [dup] = await db.query('SELECT 1 FROM usuarios WHERE email = ? AND id_usuario <> ?', [f.email, id]);
    if (dup.length) errores.push('Ese correo ya lo usa otra cuenta.');
  }
  if (errores.length) return res.render('cuenta', { titulo: 'Mi cuenta', cuenta: { ...actual, ...f }, errores, erroresPass: [] });

  await db.query('UPDATE usuarios SET nombre = ?, apellidos = ?, email = ?, telefono = ? WHERE id_usuario = ?', [f.nombre, f.apellidos, f.email, f.telefono, id]);
  req.session.user.nombre = f.nombre;
  req.session.flash = { tipo: 'success', msg: 'Datos actualizados.' };
  res.redirect('/cuenta');
}));

router.post('/password', ah(async (req, res) => {
  const id = req.session.user.id;
  const { actual: pActual = '', nueva = '', confirmar = '' } = req.body;
  const [r] = await db.query('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [id]);
  const errores = [];
  if (!(await bcrypt.compare(pActual, r[0].password_hash))) errores.push('La contraseña actual no es correcta.');
  if (nueva.length < 8) errores.push('La nueva contraseña debe tener al menos 8 caracteres.');
  if (nueva === pActual) errores.push('La nueva contraseña debe ser distinta de la actual.');
  if (nueva !== confirmar) errores.push('La confirmación no coincide.');
  if (errores.length) return res.render('cuenta', { titulo: 'Mi cuenta', cuenta: await cargar(id), errores: [], erroresPass: errores });

  await db.query('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?', [await bcrypt.hash(nueva, 10), id]);
  req.session.flash = { tipo: 'success', msg: 'Contraseña actualizada.' };
  res.redirect('/cuenta');
}));

module.exports = router;
