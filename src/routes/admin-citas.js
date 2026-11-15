// Pantalla 15 (administrador): Citas y vehículos. Aquí se asigna el mecánico a cada cita
// (el mecánico solo ve las citas que se le asignan), se confirma/cancela y se corrigen datos de vehículos.
const router = require('express').Router();
const db = require('../db');
const { t, entero, ah } = require('../helpers');

const idSeguro = (v) => { const n = entero(v); return Number.isNaN(n) ? 0 : n; };
const flash = (req, tipo, msg) => { req.session.flash = { tipo, msg }; };

router.get('/', ah(async (req, res) => {
  const tab = req.query.tab === 'vehiculos' ? 'vehiculos' : 'citas';
  const q = t(req.query.q);
  const estatus = ['1', '2', '3'].includes(req.query.estatus) ? Number(req.query.estatus) : 0;
  const like = `%${q}%`;

  const [mecanicos] = await db.query("SELECT id_usuario, nombre, apellidos FROM usuarios WHERE id_rol = 2 AND activo = 1 ORDER BY nombre");
  const [catEstatus] = await db.query('SELECT * FROM estatus_cita ORDER BY id_estatus_cita');
  const datos = { titulo: 'Citas y vehículos', tab, q, estatus, mecanicos, catEstatus, citas: [], vehiculos: [], editar: null, errores: [] };

  if (tab === 'citas') {
    [datos.citas] = await db.query(
      `SELECT c.id_cita, c.fecha_hora, c.id_mecanico, c.llamada_solicitada, v.marca, v.modelo, v.placas,
              CONCAT(u.nombre, ' ', u.apellidos) AS cliente, ec.id_estatus_cita, ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo,
              (SELECT GROUP_CONCAT(s.nombre SEPARATOR ', ') FROM cita_servicios cs JOIN servicios s ON s.id_servicio = cs.id_servicio WHERE cs.id_cita = c.id_cita) AS servicios,
              (SELECT COALESCE(SUM(precio_aplicado), 0) FROM cita_servicios WHERE id_cita = c.id_cita)
              + (SELECT COALESCE(SUM(costo * cantidad), 0) FROM refacciones WHERE id_cita = c.id_cita AND aprobada = 1) AS total
       FROM citas c
       JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
       JOIN usuarios u ON u.id_usuario = c.id_cliente
       JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
       LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
       WHERE (? = 0 OR c.id_estatus_cita = ?)
         AND (CONCAT(u.nombre, ' ', u.apellidos) LIKE ? OR v.placas LIKE ? OR CONCAT(v.marca, ' ', v.modelo) LIKE ?)
       ORDER BY c.fecha_hora DESC`, [estatus, estatus, like, like, like]);
  } else {
    [datos.vehiculos] = await db.query(
      `SELECT v.*, CONCAT(u.nombre, ' ', u.apellidos) AS dueno FROM vehiculos v JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE CONCAT(v.marca, ' ', v.modelo) LIKE ? OR v.placas LIKE ? OR CONCAT(u.nombre, ' ', u.apellidos) LIKE ?
       ORDER BY v.id_vehiculo`, [like, like, like]);
    const ed = idSeguro(req.query.editar);
    datos.editar = datos.vehiculos.find((v) => v.id_vehiculo === ed) || null;
  }
  res.render('admin/citas', datos);
}));

// Asignar (o quitar) mecánico
router.post('/:id/mecanico', ah(async (req, res) => {
  const idc = idSeguro(req.params.id);
  const idm = idSeguro(req.body.id_mecanico);
  const [cita] = await db.query('SELECT id_estatus_cita, id_estatus_vehiculo FROM citas WHERE id_cita = ?', [idc]);
  if (!cita.length) flash(req, 'danger', 'Esa cita no existe.');
  else if (cita[0].id_estatus_cita === 3) flash(req, 'warning', 'La cita está cancelada.');
  else if (cita[0].id_estatus_vehiculo === 6) flash(req, 'warning', 'La cita ya fue entregada.');
  else if (!t(req.body.id_mecanico)) {
    await db.query('UPDATE citas SET id_mecanico = NULL WHERE id_cita = ?', [idc]);
    flash(req, 'success', 'Mecánico desasignado.');
  } else {
    const [m] = await db.query('SELECT 1 FROM usuarios WHERE id_usuario = ? AND id_rol = 2 AND activo = 1', [idm]);
    if (!m.length) flash(req, 'danger', 'Elige un mecánico activo.');
    else {
      await db.query('UPDATE citas SET id_mecanico = ? WHERE id_cita = ?', [idm, idc]);
      flash(req, 'success', 'Mecánico asignado.');
    }
  }
  res.redirect('/admin/citas?tab=citas');
}));

// Confirmar (solo Pendiente) o cancelar (nunca una cita ya entregada)
router.post('/:id/estatus', ah(async (req, res) => {
  const idc = idSeguro(req.params.id);
  const [cita] = await db.query('SELECT id_estatus_cita, id_estatus_vehiculo FROM citas WHERE id_cita = ?', [idc]);
  if (!cita.length) flash(req, 'danger', 'Esa cita no existe.');
  else if (req.body.accion === 'confirmar') {
    if (cita[0].id_estatus_cita !== 1) flash(req, 'warning', 'Solo se pueden confirmar citas Pendientes.');
    else { await db.query('UPDATE citas SET id_estatus_cita = 2 WHERE id_cita = ?', [idc]); flash(req, 'success', 'Cita confirmada.'); }
  } else if (req.body.accion === 'cancelar') {
    if (cita[0].id_estatus_cita === 3) flash(req, 'warning', 'La cita ya estaba cancelada.');
    else if (cita[0].id_estatus_vehiculo === 6) flash(req, 'warning', 'No se puede cancelar una cita ya entregada.');
    else { await db.query('UPDATE citas SET id_estatus_cita = 3 WHERE id_cita = ?', [idc]); flash(req, 'success', 'Cita cancelada.'); }
  } else flash(req, 'danger', 'Acción no válida.');
  res.redirect('/admin/citas?tab=citas');
}));

// Editar datos de un vehículo
router.post('/vehiculos/guardar', ah(async (req, res) => {
  const f = { id: idSeguro(req.body.id_vehiculo), marca: t(req.body.marca), modelo: t(req.body.modelo), anio: t(req.body.anio), placas: t(req.body.placas).toUpperCase(), color: t(req.body.color) };
  const errores = [];
  const [existe] = await db.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ?', [f.id]);
  if (!existe.length) errores.push('Ese vehículo no existe.');
  if (!f.marca || f.marca.length > 40) errores.push('La marca es obligatoria (máx. 40 caracteres).');
  if (!f.modelo || f.modelo.length > 40) errores.push('El modelo es obligatorio (máx. 40 caracteres).');
  const anio = entero(f.anio);
  if (Number.isNaN(anio) || anio < 1950 || anio > new Date().getFullYear() + 1) errores.push('El año no es válido.');
  if (!/^[A-Z0-9-]{5,15}$/.test(f.placas)) errores.push('Las placas deben tener de 5 a 15 letras, números o guiones.');
  if (f.color.length > 30) errores.push('El color es muy largo (máx. 30).');
  if (!errores.length) {
    const [dup] = await db.query('SELECT 1 FROM vehiculos WHERE placas = ? AND id_vehiculo <> ?', [f.placas, f.id]);
    if (dup.length) errores.push('Esas placas ya están registradas.');
  }
  if (errores.length) { flash(req, 'danger', errores.join(' ')); return res.redirect(`/admin/citas?tab=vehiculos&editar=${f.id}`); }
  await db.query('UPDATE vehiculos SET marca = ?, modelo = ?, anio = ?, placas = ?, color = ? WHERE id_vehiculo = ?', [f.marca, f.modelo, anio, f.placas, f.color || null, f.id]);
  flash(req, 'success', 'Vehículo actualizado.');
  res.redirect('/admin/citas?tab=vehiculos');
}));

// Baja / reactivación de vehículo (baja lógica)
router.post('/vehiculos/:id/estado', ah(async (req, res) => {
  const idv = idSeguro(req.params.id);
  const [v] = await db.query('SELECT activo FROM vehiculos WHERE id_vehiculo = ?', [idv]);
  if (!v.length) flash(req, 'danger', 'Ese vehículo no existe.');
  else if (v[0].activo) {
    const [curso] = await db.query('SELECT 1 FROM citas WHERE id_vehiculo = ? AND id_estatus_cita <> 3 AND (id_estatus_vehiculo IS NULL OR id_estatus_vehiculo <> 6)', [idv]);
    if (curso.length) flash(req, 'warning', 'El vehículo tiene una cita en curso; cancélala o espera a que se entregue.');
    else { await db.query('UPDATE vehiculos SET activo = 0 WHERE id_vehiculo = ?', [idv]); flash(req, 'success', 'Vehículo dado de baja.'); }
  } else { await db.query('UPDATE vehiculos SET activo = 1 WHERE id_vehiculo = ?', [idv]); flash(req, 'success', 'Vehículo reactivado.'); }
  res.redirect('/admin/citas?tab=vehiculos');
}));

module.exports = router;
