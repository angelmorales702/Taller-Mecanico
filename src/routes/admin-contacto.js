// Pantalla 17 (administrador): Contacto y reseñas.
// Contacto: datos públicos que se muestran en "Contacto" y en el pie de página.
// Reseñas: las escriben los clientes; aquí solo se modera su visibilidad (no se edita texto ni calificación).
const router = require('express').Router();
const db = require('../db');
const { t, esEmail, esTel, entero, ah } = require('../helpers');

const POR_PAGINA = 8;
const esUrl = (s) => { try { return ['http:', 'https:'].includes(new URL(s).protocol); } catch (e) { return false; } };

async function pagina(req, res, extra = {}) {
  const [c] = await db.query('SELECT * FROM contacto_taller ORDER BY id_contacto LIMIT 1');
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM resenas');
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const n = entero(req.query.pagina);
  const actual = Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), paginas);
  const [resenas] = await db.query(
    `SELECT r.id_resena, r.calificacion, r.comentario, r.visible, r.fecha,
            CONCAT(u.nombre, ' ', u.apellidos) AS cliente, CONCAT(v.marca, ' ', v.modelo) AS vehiculo,
            CONCAT(m.nombre, ' ', m.apellidos) AS mecanico
     FROM resenas r
     JOIN citas c ON c.id_cita = r.id_cita
     JOIN usuarios u ON u.id_usuario = c.id_cliente
     JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     LEFT JOIN usuarios m ON m.id_usuario = c.id_mecanico
     ORDER BY r.fecha DESC, r.id_resena DESC LIMIT ? OFFSET ?`, [POR_PAGINA, (actual - 1) * POR_PAGINA]);
  res.render('admin/contacto', {
    titulo: 'Contacto y reseñas', form: extra.form || c[0] || {}, errores: extra.errores || [],
    resenas, total, paginas, actual,
  });
}

router.get('/', ah((req, res) => pagina(req, res)));

router.post('/guardar', ah(async (req, res) => {
  const f = { telefono: t(req.body.telefono), correo: t(req.body.correo).toLowerCase(), direccion: t(req.body.direccion),
    facebook_url: t(req.body.facebook_url), maps_url: t(req.body.maps_url) };
  const errores = [];
  if (!esTel(f.telefono)) errores.push('El teléfono debe tener 10 dígitos.');
  if (!esEmail(f.correo)) errores.push('Escribe un correo válido.');
  if (!f.direccion || f.direccion.length > 200) errores.push('La dirección es obligatoria (máx. 200 caracteres).');
  if (f.facebook_url && (f.facebook_url.length > 255 || !esUrl(f.facebook_url))) errores.push('La URL de Facebook no es válida (debe empezar con http:// o https://).');
  if (f.maps_url && (f.maps_url.length > 500 || !esUrl(f.maps_url))) errores.push('La URL de Google Maps no es válida (debe empezar con http:// o https://).');
  if (errores.length) return pagina(req, res, { errores, form: f });

  const [c] = await db.query('SELECT id_contacto FROM contacto_taller ORDER BY id_contacto LIMIT 1');
  const vals = [f.telefono, f.correo, f.direccion, f.facebook_url || null, f.maps_url || null];
  if (c.length) await db.query('UPDATE contacto_taller SET telefono = ?, correo = ?, direccion = ?, facebook_url = ?, maps_url = ? WHERE id_contacto = ?', [...vals, c[0].id_contacto]);
  else await db.query('INSERT INTO contacto_taller (telefono, correo, direccion, facebook_url, maps_url) VALUES (?, ?, ?, ?, ?)', vals);
  req.session.flash = { tipo: 'success', msg: 'Información de contacto actualizada. Ya se refleja en Contacto y en el pie de página.' };
  res.redirect('/admin/contacto');
}));

// Mostrar u ocultar una reseña en la pantalla de Inicio
router.post('/resenas/:id/visible', ah(async (req, res) => {
  const id = entero(req.params.id);
  const visible = req.body.visible === '1' ? 1 : 0;
  const pag = entero(req.body.pagina);
  const [r] = await db.query('UPDATE resenas SET visible = ? WHERE id_resena = ?', [visible, Number.isNaN(id) ? 0 : id]);
  req.session.flash = r.affectedRows
    ? { tipo: 'success', msg: visible ? 'La reseña ahora se muestra en Inicio.' : 'La reseña quedó oculta en Inicio.' }
    : { tipo: 'danger', msg: 'Esa reseña no existe.' };
  res.redirect(`/admin/contacto${Number.isNaN(pag) ? '' : `?pagina=${pag}`}`);
}));

module.exports = router;
