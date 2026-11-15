// Pantallas 11 (Mis citas asignadas) y 12 (Orden de trabajo + consumo de refacciones) del Mecánico.
// El id del mecánico sale SIEMPRE de la sesión y todas las consultas filtran por c.id_mecanico:
// un mecánico solo ve y modifica las citas que el administrador le asignó.
const router = require('express').Router();
const db = require('../db');
const { t, entero, decimal, ah } = require('../helpers');

const idSeguro = (v) => { const n = entero(v); return Number.isNaN(n) ? 0 : n; };
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => fmt(new Date());
function semana() { // lunes a domingo de la semana actual
  const d = new Date();
  const lun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() || 7) - 1));
  const dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6);
  return [fmt(lun), fmt(dom)];
}

const SERVICIOS_DE_CITA = `(SELECT GROUP_CONCAT(s.nombre SEPARATOR ', ') FROM cita_servicios cs
  JOIN servicios s ON s.id_servicio = cs.id_servicio WHERE cs.id_cita = c.id_cita)`;

// ---------------------------------------------------------------------------
// Pantalla 11: citas asignadas
// ---------------------------------------------------------------------------
router.get('/', (req, res) => res.redirect('/mecanico/citas'));

router.get('/citas', ah(async (req, res) => {
  const idm = req.session.user.id;
  const rango = ['hoy', 'semana', 'todas'].includes(req.query.rango) ? req.query.rango : 'semana';
  let filtro = '';
  const params = [idm];
  if (rango === 'hoy') { filtro = 'AND DATE(c.fecha_hora) = ?'; params.push(hoy()); }
  if (rango === 'semana') { filtro = 'AND DATE(c.fecha_hora) BETWEEN ? AND ?'; params.push(...semana()); }

  const [citas] = await db.query(
    `SELECT c.id_cita, c.fecha_hora, c.observaciones, c.id_vehiculo, v.marca, v.modelo, v.placas,
            CONCAT(u.nombre, ' ', u.apellidos) AS cliente, u.telefono,
            ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo, ${SERVICIOS_DE_CITA} AS servicios
     FROM citas c
     JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     JOIN usuarios u ON u.id_usuario = c.id_cliente
     JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
     LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
     WHERE c.id_mecanico = ? AND c.id_estatus_cita <> 3 ${filtro}
     ORDER BY c.fecha_hora`, params);

  // Historial del auto: solo de vehículos de citas asignadas a este mecánico
  let historial = null, histVeh = null;
  const idv = idSeguro(req.query.historial);
  if (idv) {
    const [ok] = await db.query('SELECT v.marca, v.modelo, v.placas FROM vehiculos v WHERE v.id_vehiculo = ? AND EXISTS (SELECT 1 FROM citas c WHERE c.id_vehiculo = v.id_vehiculo AND c.id_mecanico = ?)', [idv, idm]);
    if (ok.length) {
      histVeh = ok[0];
      [historial] = await db.query(
        `SELECT c.id_cita, c.fecha_hora, ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo, ${SERVICIOS_DE_CITA} AS servicios
         FROM citas c JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
         LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
         WHERE c.id_vehiculo = ? ORDER BY c.fecha_hora DESC`, [idv]);
    }
  }
  res.render('mecanico/citas', { titulo: 'Mis citas asignadas', citas, rango, historial, histVeh });
}));

// ---------------------------------------------------------------------------
// Pantalla 12: orden de trabajo y consumo de refacciones
// ---------------------------------------------------------------------------
async function miOrden(id, idm) {
  const [r] = await db.query(
    `SELECT c.*, v.marca, v.modelo, v.anio, v.placas, v.color, CONCAT(u.nombre, ' ', u.apellidos) AS cliente, u.telefono,
            ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo
     FROM citas c
     JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     JOIN usuarios u ON u.id_usuario = c.id_cliente
     JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
     LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
     WHERE c.id_cita = ? AND c.id_mecanico = ?`, [id, idm]);
  return r[0] || null;
}
const cerrada = (c) => c.id_estatus_cita === 3 || c.id_estatus_vehiculo === 6;
const volver = (res, id, ancla = '') => res.redirect(`/mecanico/orden?cita=${id}${ancla}`);
const flash = (req, tipo, msg) => { req.session.flash = { tipo, msg }; };

router.get('/orden', ah(async (req, res) => {
  const idm = req.session.user.id;
  const [lista] = await db.query(
    `SELECT c.id_cita, c.fecha_hora, c.id_estatus_vehiculo, v.marca, v.modelo, v.placas
     FROM citas c JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     WHERE c.id_mecanico = ? AND c.id_estatus_cita <> 3
     ORDER BY (c.id_estatus_vehiculo = 6), c.fecha_hora`, [idm]);
  const pedida = idSeguro(req.query.cita);
  const elegida = lista.find((c) => c.id_cita === pedida) || lista[0];
  if (!elegida) return res.render('mecanico/orden', { titulo: 'Orden de trabajo', lista, cita: null });

  const cita = await miOrden(elegida.id_cita, idm);
  const q = t(req.query.q);
  const [estatus] = await db.query('SELECT * FROM estatus_vehiculo ORDER BY id_estatus_vehiculo');
  const [servicios] = await db.query(
    `SELECT s.nombre, cs.precio_aplicado FROM cita_servicios cs JOIN servicios s ON s.id_servicio = cs.id_servicio WHERE cs.id_cita = ?`, [cita.id_cita]);
  const [bitacora] = await db.query(
    `SELECT s.fecha_hora, s.comentario, ev.nombre AS estatus, CONCAT(u.nombre, ' ', u.apellidos) AS autor
     FROM seguimiento_vehiculo s
     JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = s.id_estatus_vehiculo
     JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.id_cita = ? ORDER BY s.fecha_hora DESC, s.id_seguimiento DESC`, [cita.id_cita]);
  const [refacciones] = await db.query('SELECT * FROM refacciones WHERE id_cita = ? ORDER BY id_refaccion', [cita.id_cita]);
  const [productos] = await db.query(
    'SELECT id_producto, nombre, cantidad, stock_minimo, costo FROM inventario WHERE activo = 1 AND nombre LIKE ? ORDER BY nombre LIMIT 30', [`%${q}%`]);

  res.render('mecanico/orden', { titulo: 'Orden de trabajo', lista, cita, estatus, servicios, bitacora, refacciones, productos, q, cerrada: cerrada(cita) });
}));

// Guardar nuevo estatus en la línea de tiempo (usa sp_actualizar_estatus_vehiculo)
router.post('/orden/:id/estatus', ah(async (req, res) => {
  const idm = req.session.user.id;
  const cita = await miOrden(idSeguro(req.params.id), idm);
  if (!cita) { flash(req, 'danger', 'Esa cita no está asignada a ti.'); return res.redirect('/mecanico/citas'); }
  const est = idSeguro(req.body.estatus);
  const comentario = t(req.body.comentario);
  const [ok] = await db.query('SELECT 1 FROM estatus_vehiculo WHERE id_estatus_vehiculo = ?', [est]);

  if (cita.id_estatus_cita === 3) flash(req, 'warning', 'La cita está cancelada.');
  else if (!ok.length) flash(req, 'danger', 'Elige un estatus.');
  else if (!comentario) flash(req, 'danger', 'Escribe el diagnóstico o comentario técnico (el cliente lo verá).');
  else if (comentario.length > 255) flash(req, 'danger', 'El comentario no puede pasar de 255 caracteres.');
  else if (cita.id_estatus_vehiculo === 6 && est < 6) flash(req, 'warning', 'Un vehículo Entregado no puede regresar a un estado anterior.');
  else {
    await db.query('CALL sp_actualizar_estatus_vehiculo(?, ?, ?, ?)', [cita.id_cita, est, idm, comentario]);
    flash(req, 'success', 'Estatus guardado. El cliente ya lo ve en su seguimiento.');
  }
  volver(res, cita.id_cita);
}));

// Usar refacción del almacén: descuenta stock y la carga a la orden (ya aprobada, porque sale del taller)
router.post('/orden/:id/refaccion/almacen', ah(async (req, res) => {
  const idm = req.session.user.id;
  const cita = await miOrden(idSeguro(req.params.id), idm);
  if (!cita) { flash(req, 'danger', 'Esa cita no está asignada a ti.'); return res.redirect('/mecanico/citas'); }
  if (cerrada(cita)) { flash(req, 'warning', 'La orden ya está cerrada (Entregada o Cancelada).'); return volver(res, cita.id_cita, '#refacciones'); }

  const idp = idSeguro(req.body.id_producto);
  const cant = entero(req.body.cantidad);
  if (Number.isNaN(cant) || cant < 1) { flash(req, 'danger', 'La cantidad debe ser mayor a 0.'); return volver(res, cita.id_cita, '#refacciones'); }

  const cx = await db.getConnection();
  let msg;
  try {
    await cx.beginTransaction();
    const [p] = await cx.query('SELECT * FROM inventario WHERE id_producto = ? AND activo = 1 FOR UPDATE', [idp]);
    if (!p.length) msg = { tipo: 'danger', msg: 'Esa refacción no existe en el almacén.' };
    else if (cant > p[0].cantidad) msg = { tipo: 'danger', msg: `Stock insuficiente: solo hay ${p[0].cantidad} de "${p[0].nombre}".` };
    else {
      await cx.query('UPDATE inventario SET cantidad = cantidad - ? WHERE id_producto = ?', [cant, idp]);
      await cx.query('INSERT INTO refacciones (id_cita, id_producto, descripcion, cantidad, costo, aprobada) VALUES (?, ?, ?, ?, ?, 1)',
        [cita.id_cita, idp, p[0].nombre, cant, p[0].costo]);
      const quedan = p[0].cantidad - cant;
      msg = quedan <= p[0].stock_minimo
        ? { tipo: 'warning', msg: `Refacción cargada a la orden. Aviso: solo quedan ${quedan} de "${p[0].nombre}" (mínimo ${p[0].stock_minimo}).` }
        : { tipo: 'success', msg: 'Refacción descontada del inventario y cargada a la orden.' };
    }
    if (msg.tipo === 'danger') await cx.rollback(); else await cx.commit();
  } catch (e) { await cx.rollback(); throw e; } finally { cx.release(); }
  req.session.flash = msg;
  volver(res, cita.id_cita, '#refacciones');
}));

// Cargo extra (pieza externa sobre pedido): queda pendiente hasta que el cliente lo apruebe
router.post('/orden/:id/refaccion/externa', ah(async (req, res) => {
  const idm = req.session.user.id;
  const cita = await miOrden(idSeguro(req.params.id), idm);
  if (!cita) { flash(req, 'danger', 'Esa cita no está asignada a ti.'); return res.redirect('/mecanico/citas'); }
  if (cerrada(cita)) { flash(req, 'warning', 'La orden ya está cerrada (Entregada o Cancelada).'); return volver(res, cita.id_cita, '#refacciones'); }

  const desc = t(req.body.descripcion);
  const cant = entero(req.body.cantidad);
  const costo = decimal(req.body.costo);
  if (!desc || desc.length > 150) flash(req, 'danger', 'Describe la pieza (máx. 150 caracteres).');
  else if (Number.isNaN(cant) || cant < 1 || cant > 999) flash(req, 'danger', 'La cantidad debe ser mayor a 0.');
  else if (Number.isNaN(costo) || costo <= 0 || costo > 99999999) flash(req, 'danger', 'El costo debe ser mayor a 0.');
  else {
    await db.query('INSERT INTO refacciones (id_cita, id_producto, descripcion, cantidad, costo, aprobada) VALUES (?, NULL, ?, ?, ?, NULL)', [cita.id_cita, desc, cant, costo]);
    flash(req, 'info', 'Cargo extra guardado. Queda pendiente de aprobación del cliente (avísale por teléfono o correo).');
  }
  volver(res, cita.id_cita, '#refacciones');
}));

// Quitar un cargo capturado por error (regresa el stock si salió del almacén)
router.post('/orden/:id/refaccion/:rid/quitar', ah(async (req, res) => {
  const idm = req.session.user.id;
  const cita = await miOrden(idSeguro(req.params.id), idm);
  if (!cita) { flash(req, 'danger', 'Esa cita no está asignada a ti.'); return res.redirect('/mecanico/citas'); }
  if (cerrada(cita)) { flash(req, 'warning', 'La orden ya está cerrada (Entregada o Cancelada).'); return volver(res, cita.id_cita, '#refacciones'); }

  const cx = await db.getConnection();
  let msg;
  try {
    await cx.beginTransaction();
    const [r] = await cx.query('SELECT * FROM refacciones WHERE id_refaccion = ? AND id_cita = ? FOR UPDATE', [idSeguro(req.params.rid), cita.id_cita]);
    if (!r.length) msg = { tipo: 'danger', msg: 'Ese cargo no existe en esta orden.' };
    else if (r[0].id_producto === null && r[0].aprobada === 1) msg = { tipo: 'warning', msg: 'El cliente ya aprobó este cargo extra; no se puede quitar.' };
    else {
      if (r[0].id_producto !== null && r[0].aprobada === 1) { // el stock ya se había descontado
        await cx.query('UPDATE inventario SET cantidad = cantidad + ? WHERE id_producto = ?', [r[0].cantidad, r[0].id_producto]);
      }
      await cx.query('DELETE FROM refacciones WHERE id_refaccion = ?', [r[0].id_refaccion]);
      msg = { tipo: 'success', msg: 'Cargo quitado de la orden.' };
    }
    if (msg.tipo === 'success') await cx.commit(); else await cx.rollback();
  } catch (e) { await cx.rollback(); throw e; } finally { cx.release(); }
  req.session.flash = msg;
  volver(res, cita.id_cita, '#refacciones');
}));

module.exports = router;
