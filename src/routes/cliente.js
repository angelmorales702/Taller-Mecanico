// Pantallas 8 (Mis vehículos y citas) y 9 (Seguimiento, presupuesto y reseñas) del Cliente.
// El id del cliente sale SIEMPRE de la sesión; cada consulta filtra por él para que
// un cliente nunca vea ni modifique información de otro.
const router = require('express').Router();
const db = require('../db');
const { t, entero, esFecha, hora12, ah } = require('../helpers');

const pad = (n) => String(n).padStart(2, '0');
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ---------------------------------------------------------------------------
// Bloques de horario disponibles para una fecha (según la tabla horarios y la capacidad)
// ---------------------------------------------------------------------------
async function bloques(fecha) {
  if (!esFecha(fecha)) return { cerrado: true, motivo: 'Elige una fecha válida.', horas: [] };
  if (fecha < hoy()) return { cerrado: true, motivo: 'No se puede agendar en una fecha pasada.', horas: [] };

  const [y, m, d] = fecha.split('-').map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay() || 7; // 1 = lunes ... 7 = domingo
  const [esp] = await db.query('SELECT * FROM horarios WHERE fecha_especial = ?', [fecha]); // festivos tienen prioridad
  let hr = esp[0];
  if (!hr) { const [r] = await db.query('SELECT * FROM horarios WHERE dia_semana = ?', [diaSemana]); hr = r[0]; }
  if (!hr || hr.cerrado || !hr.hora_apertura || !hr.hora_cierre) {
    const por = hr && hr.descripcion ? ` (${hr.descripcion})` : '';
    return { cerrado: true, motivo: `El taller está cerrado ese día${por}.`, horas: [] };
  }

  const [ocup] = await db.query(
    `SELECT TIME_FORMAT(TIME(fecha_hora), '%H:%i') AS hora, COUNT(*) AS n
     FROM citas WHERE DATE(fecha_hora) = ? AND id_estatus_cita <> 3 GROUP BY hora`, [fecha]);
  const usados = Object.fromEntries(ocup.map((o) => [o.hora, o.n]));

  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const horas = [];
  for (let min = minutos(hr.hora_apertura); min + 60 <= minutos(hr.hora_cierre); min += 60) {
    if (fecha === hoy() && min <= minAhora) continue; // bloques que ya pasaron hoy
    const valor = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
    const libres = Math.max(hr.capacidad - (usados[valor] || 0), 0);
    horas.push({ valor, etiqueta: hora12(`${valor}:00`), libres });
  }
  return { cerrado: false, motivo: '', horas };
}

router.get('/horas', ah(async (req, res) => res.json(await bloques(t(req.query.fecha)))));

// ---------------------------------------------------------------------------
// Pantalla 8: vehículos + agendar cita + mis citas
// ---------------------------------------------------------------------------
const SQL_CITAS = `
  SELECT c.id_cita, c.fecha_hora, c.id_vehiculo, v.marca, v.modelo, v.placas,
         ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo,
         (SELECT GROUP_CONCAT(s.nombre SEPARATOR ', ') FROM cita_servicios cs
            JOIN servicios s ON s.id_servicio = cs.id_servicio WHERE cs.id_cita = c.id_cita) AS servicios,
         (SELECT COALESCE(SUM(precio_aplicado), 0) FROM cita_servicios WHERE id_cita = c.id_cita)
         + (SELECT COALESCE(SUM(costo * cantidad), 0) FROM refacciones WHERE id_cita = c.id_cita AND aprobada = 1) AS total
  FROM citas c
  JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
  JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
  LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
  WHERE c.id_cliente = ?`;

async function pagina(req, res, extra = {}) {
  const idc = req.session.user.id;
  const [vehiculos] = await db.query('SELECT * FROM vehiculos WHERE id_usuario = ? AND activo = 1 ORDER BY id_vehiculo', [idc]);
  const [servicios] = await db.query(
    `SELECT s.id_servicio, s.nombre, s.precio, s.duracion_min, c.nombre AS categoria
     FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
     WHERE s.activo = 1 ORDER BY c.nombre, s.nombre`);
  const [citas] = await db.query(`${SQL_CITAS} ORDER BY c.fecha_hora DESC`, [idc]);

  const editarId = entero(req.query.editar);
  const historialId = entero(req.query.historial);
  const editar = vehiculos.find((v) => v.id_vehiculo === editarId) || null;
  const histVeh = vehiculos.find((v) => v.id_vehiculo === historialId) || null;

  res.render('cliente/vehiculos', {
    titulo: 'Mis vehículos y citas', vehiculos, servicios, citas, hoy: hoy(),
    formVeh: extra.formVeh || editar || {}, editando: !!(extra.formVeh ? extra.formVeh.id_vehiculo : editar),
    historial: histVeh ? citas.filter((c) => c.id_vehiculo === histVeh.id_vehiculo) : null, histVeh,
    formCita: extra.formCita || {}, erroresVeh: extra.erroresVeh || [], erroresCita: extra.erroresCita || [],
  });
}

router.get('/', (req, res) => res.redirect('/cliente/vehiculos'));
router.get('/vehiculos', ah((req, res) => pagina(req, res)));

// Alta y edición de vehículo propio
router.post('/vehiculos/guardar', ah(async (req, res) => {
  const idc = req.session.user.id;
  const idv = entero(req.body.id_vehiculo); // NaN si es alta
  const f = {
    id_vehiculo: Number.isNaN(idv) ? null : idv,
    marca: t(req.body.marca), modelo: t(req.body.modelo), anio: t(req.body.anio),
    placas: t(req.body.placas).toUpperCase(), color: t(req.body.color),
  };
  const errores = [];
  if (!f.marca || f.marca.length > 40) errores.push('La marca es obligatoria (máx. 40 caracteres).');
  if (!f.modelo || f.modelo.length > 40) errores.push('El modelo es obligatorio (máx. 40 caracteres).');
  const anio = entero(f.anio);
  if (Number.isNaN(anio) || anio < 1950 || anio > new Date().getFullYear() + 1) errores.push('El año no es válido.');
  if (!/^[A-Z0-9-]{5,15}$/.test(f.placas)) errores.push('Las placas deben tener de 5 a 15 letras, números o guiones.');
  if (f.color.length > 30) errores.push('El color es muy largo (máx. 30).');

  if (f.id_vehiculo) { // editar: el vehículo debe ser del cliente y estar activo
    const [mio] = await db.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ? AND id_usuario = ? AND activo = 1', [f.id_vehiculo, idc]);
    if (!mio.length) { req.session.flash = { tipo: 'danger', msg: 'Ese vehículo no es tuyo o ya no existe.' }; return res.redirect('/cliente/vehiculos'); }
  }
  if (!errores.length) {
    const [dup] = await db.query('SELECT 1 FROM vehiculos WHERE placas = ? AND id_vehiculo <> ?', [f.placas, f.id_vehiculo || 0]);
    if (dup.length) errores.push('Esas placas ya están registradas.');
  }
  if (errores.length) return pagina(req, res, { erroresVeh: errores, formVeh: f });

  if (f.id_vehiculo) {
    await db.query('UPDATE vehiculos SET marca = ?, modelo = ?, anio = ?, placas = ?, color = ? WHERE id_vehiculo = ? AND id_usuario = ?',
      [f.marca, f.modelo, anio, f.placas, f.color || null, f.id_vehiculo, idc]);
    req.session.flash = { tipo: 'success', msg: 'Vehículo actualizado.' };
  } else {
    await db.query('INSERT INTO vehiculos (id_usuario, marca, modelo, anio, placas, color) VALUES (?, ?, ?, ?, ?, ?)',
      [idc, f.marca, f.modelo, anio, f.placas, f.color || null]);
    req.session.flash = { tipo: 'success', msg: 'Vehículo guardado.' };
  }
  res.redirect('/cliente/vehiculos');
}));

// Baja lógica (no se borra el registro para conservar el historial)
router.post('/vehiculos/:id/baja', ah(async (req, res) => {
  const idc = req.session.user.id;
  const idv = entero(req.params.id);
  const [mio] = await db.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ? AND id_usuario = ? AND activo = 1', [idv, idc]);
  if (!mio.length) req.session.flash = { tipo: 'danger', msg: 'Ese vehículo no es tuyo o ya no existe.' };
  else {
    const [curso] = await db.query(
      'SELECT 1 FROM citas WHERE id_vehiculo = ? AND id_estatus_cita <> 3 AND (id_estatus_vehiculo IS NULL OR id_estatus_vehiculo <> 6)', [idv]);
    if (curso.length) req.session.flash = { tipo: 'warning', msg: 'No puedes dar de baja un vehículo con una cita en curso. Cancela la cita o espera a que se entregue.' };
    else {
      await db.query('UPDATE vehiculos SET activo = 0 WHERE id_vehiculo = ? AND id_usuario = ?', [idv, idc]);
      req.session.flash = { tipo: 'success', msg: 'Vehículo dado de baja.' };
    }
  }
  res.redirect('/cliente/vehiculos');
}));

// Agendar cita: vehículo propio + uno o varios servicios + fecha y bloque de horario
router.post('/citas/agendar', ah(async (req, res) => {
  const idc = req.session.user.id;
  const f = {
    id_vehiculo: entero(req.body.id_vehiculo), fecha: t(req.body.fecha), hora: t(req.body.hora),
    observaciones: t(req.body.observaciones), llamada: req.body.llamada ? 1 : 0,
    servicios: [...new Set([].concat(req.body.servicios || []).map(entero))],
  };
  const errores = [];

  const [mio] = await db.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ? AND id_usuario = ? AND activo = 1', [f.id_vehiculo, idc]);
  if (!mio.length) errores.push('Elige uno de tus vehículos.');

  let precios = [];
  if (!f.servicios.length || f.servicios.some(Number.isNaN)) errores.push('Elige al menos un servicio.');
  else {
    [precios] = await db.query('SELECT id_servicio, precio FROM servicios WHERE activo = 1 AND id_servicio IN (?)', [f.servicios]);
    if (precios.length !== f.servicios.length) errores.push('Alguno de los servicios ya no está disponible.');
  }
  if (f.observaciones.length > 255) errores.push('Las observaciones no pueden pasar de 255 caracteres.');

  if (!f.fecha || !f.hora) errores.push('Elige fecha y horario.');
  else {
    const b = await bloques(f.fecha);
    const bloque = b.horas.find((x) => x.valor === f.hora);
    if (b.cerrado) errores.push(b.motivo);
    else if (!bloque) errores.push('Ese horario no es válido para la fecha elegida.');
    else if (!bloque.libres) errores.push('Ese horario ya no tiene lugar. Elige otro bloque.');
  }
  const fechaHora = `${f.fecha} ${f.hora}:00`;
  if (!errores.length) {
    const [empalme] = await db.query('SELECT 1 FROM citas WHERE id_vehiculo = ? AND fecha_hora = ? AND id_estatus_cita <> 3', [f.id_vehiculo, fechaHora]);
    if (empalme.length) errores.push('Ese vehículo ya tiene una cita en esa fecha y hora.');
  }
  if (errores.length) return pagina(req, res, { erroresCita: errores, formCita: f });

  // Cita + servicios + primer registro de seguimiento en una sola transacción
  const cx = await db.getConnection();
  let idCita;
  try {
    await cx.beginTransaction();
    const [r] = await cx.query(
      `INSERT INTO citas (id_cliente, id_vehiculo, id_estatus_cita, id_estatus_vehiculo, fecha_hora, observaciones, llamada_solicitada)
       VALUES (?, ?, 1, 1, ?, ?, ?)`, [idc, f.id_vehiculo, fechaHora, f.observaciones || null, f.llamada]);
    idCita = r.insertId;
    for (const p of precios) {
      await cx.query('INSERT INTO cita_servicios (id_cita, id_servicio, precio_aplicado) VALUES (?, ?, ?)', [idCita, p.id_servicio, p.precio]);
    }
    await cx.query(
      `INSERT INTO seguimiento_vehiculo (id_cita, id_estatus_vehiculo, id_usuario, comentario)
       VALUES (?, 1, ?, 'Cita agendada por el cliente.')`, [idCita, idc]);
    await cx.commit();
  } catch (e) { await cx.rollback(); throw e; } finally { cx.release(); }

  req.session.flash = { tipo: 'success', msg: 'Cita registrada. Puedes ver su avance en Seguimiento y costo.' };
  res.redirect(`/cliente/seguimiento?cita=${idCita}`);
}));

// ---------------------------------------------------------------------------
// Pantalla 9: seguimiento, presupuesto y reseña
// ---------------------------------------------------------------------------
async function miCita(idCita, idc) {
  const [r] = await db.query(
    `SELECT c.*, v.marca, v.modelo, v.placas, ec.nombre AS estatus_cita, ev.nombre AS estatus_vehiculo,
            CONCAT(m.nombre, ' ', m.apellidos) AS mecanico
     FROM citas c
     JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     JOIN estatus_cita ec ON ec.id_estatus_cita = c.id_estatus_cita
     LEFT JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = c.id_estatus_vehiculo
     LEFT JOIN usuarios m ON m.id_usuario = c.id_mecanico
     WHERE c.id_cita = ? AND c.id_cliente = ?`, [idCita, idc]);
  return r[0] || null;
}

router.get('/seguimiento', ah(async (req, res) => {
  const idc = req.session.user.id;
  const [lista] = await db.query(
    `SELECT c.id_cita, c.fecha_hora, v.marca, v.modelo, v.placas
     FROM citas c JOIN vehiculos v ON v.id_vehiculo = c.id_vehiculo
     WHERE c.id_cliente = ? ORDER BY c.fecha_hora DESC`, [idc]);
  const pedida = entero(req.query.cita);
  const elegida = lista.find((c) => c.id_cita === pedida) || lista[0];
  if (!elegida) return res.render('cliente/seguimiento', { titulo: 'Seguimiento y costo', lista, cita: null });

  const cita = await miCita(elegida.id_cita, idc);
  const [estatus] = await db.query('SELECT * FROM estatus_vehiculo ORDER BY id_estatus_vehiculo');
  const [bitacora] = await db.query(
    `SELECT s.fecha_hora, s.comentario, ev.nombre AS estatus, CONCAT(u.nombre, ' ', u.apellidos) AS autor, u.id_rol
     FROM seguimiento_vehiculo s
     JOIN estatus_vehiculo ev ON ev.id_estatus_vehiculo = s.id_estatus_vehiculo
     JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.id_cita = ? ORDER BY s.fecha_hora DESC, s.id_seguimiento DESC`, [cita.id_cita]);
  const [servicios] = await db.query(
    `SELECT s.nombre, cs.precio_aplicado FROM cita_servicios cs
     JOIN servicios s ON s.id_servicio = cs.id_servicio WHERE cs.id_cita = ?`, [cita.id_cita]);
  const [refacciones] = await db.query('SELECT * FROM refacciones WHERE id_cita = ? ORDER BY id_refaccion', [cita.id_cita]);
  const [resena] = await db.query('SELECT * FROM resenas WHERE id_cita = ?', [cita.id_cita]);

  const totServicios = servicios.reduce((a, s) => a + Number(s.precio_aplicado), 0);
  const linea = (r) => Number(r.costo) * r.cantidad;
  const totAprobado = refacciones.filter((r) => r.aprobada === 1).reduce((a, r) => a + linea(r), 0);
  const totPendiente = refacciones.filter((r) => r.aprobada === null).reduce((a, r) => a + linea(r), 0);

  res.render('cliente/seguimiento', {
    titulo: 'Seguimiento y costo', lista, cita, estatus, bitacora, servicios, refacciones, linea,
    resena: resena[0] || null, totServicios, totAprobado, totPendiente,
    total: totServicios + totAprobado, hayPendientes: refacciones.some((r) => r.aprobada === null),
  });
}));

const volver = (res, id) => res.redirect(`/cliente/seguimiento?cita=${id}`);

// Aprobar o rechazar los cargos extras pendientes (usa sp_responder_refaccion, que descuenta el inventario al aprobar)
router.post('/seguimiento/:id/cargos', ah(async (req, res) => {
  const cita = await miCita(entero(req.params.id), req.session.user.id);
  if (!cita) { req.session.flash = { tipo: 'danger', msg: 'Esa cita no existe.' }; return res.redirect('/cliente/seguimiento'); }
  if (cita.id_estatus_cita === 3) req.session.flash = { tipo: 'warning', msg: 'La cita está cancelada.' };
  else {
    const aprobar = req.body.decision === 'aprobar' ? 1 : 0;
    const [pend] = await db.query('SELECT id_refaccion FROM refacciones WHERE id_cita = ? AND aprobada IS NULL', [cita.id_cita]);
    if (!pend.length) req.session.flash = { tipo: 'info', msg: 'No hay cargos extras pendientes.' };
    else {
      let error = null;
      for (const p of pend) {
        try { await db.query('CALL sp_responder_refaccion(?, ?)', [p.id_refaccion, aprobar]); }
        catch (e) { error = e.sqlState === '45000' ? e.sqlMessage : null; if (!error) throw e; break; }
      }
      req.session.flash = error
        ? { tipo: 'danger', msg: error }
        : { tipo: 'success', msg: aprobar ? 'Cargos extras aprobados. El taller continuará con la reparación.' : 'Cargos extras rechazados.' };
    }
  }
  volver(res, cita.id_cita);
}));

// Aviso para que el taller llame al cliente
router.post('/seguimiento/:id/llamada', ah(async (req, res) => {
  const cita = await miCita(entero(req.params.id), req.session.user.id);
  if (!cita) return res.redirect('/cliente/seguimiento');
  await db.query('UPDATE citas SET llamada_solicitada = 1 WHERE id_cita = ? AND id_cliente = ?', [cita.id_cita, req.session.user.id]);
  req.session.flash = { tipo: 'success', msg: 'Listo, el taller te llamará para aclarar tus dudas.' };
  volver(res, cita.id_cita);
}));

// Cancelar: solo mientras la cita esté Pendiente
router.post('/seguimiento/:id/cancelar', ah(async (req, res) => {
  const cita = await miCita(entero(req.params.id), req.session.user.id);
  if (!cita) return res.redirect('/cliente/seguimiento');
  const [r] = await db.query('UPDATE citas SET id_estatus_cita = 3 WHERE id_cita = ? AND id_cliente = ? AND id_estatus_cita = 1', [cita.id_cita, req.session.user.id]);
  req.session.flash = r.affectedRows
    ? { tipo: 'success', msg: 'Cita cancelada.' }
    : { tipo: 'warning', msg: 'Solo se pueden cancelar citas en estatus Pendiente.' };
  volver(res, cita.id_cita);
}));

// Reseña: solo con el vehículo Entregado, una por cita
router.post('/seguimiento/:id/resena', ah(async (req, res) => {
  const cita = await miCita(entero(req.params.id), req.session.user.id);
  if (!cita) return res.redirect('/cliente/seguimiento');
  const cal = entero(req.body.calificacion);
  const comentario = t(req.body.comentario);
  const [ya] = await db.query('SELECT 1 FROM resenas WHERE id_cita = ?', [cita.id_cita]);
  let flash;
  if (cita.id_estatus_vehiculo !== 6) flash = { tipo: 'warning', msg: 'Podrás calificar cuando tu vehículo sea entregado.' };
  else if (ya.length) flash = { tipo: 'warning', msg: 'Ya calificaste este servicio.' };
  else if (Number.isNaN(cal) || cal < 1 || cal > 5) flash = { tipo: 'danger', msg: 'La calificación debe ser de 1 a 5 estrellas.' };
  else if (comentario.length > 255) flash = { tipo: 'danger', msg: 'El comentario no puede pasar de 255 caracteres.' };
  else {
    await db.query('INSERT INTO resenas (id_cita, calificacion, comentario) VALUES (?, ?, ?)', [cita.id_cita, cal, comentario || null]);
    flash = { tipo: 'success', msg: '¡Gracias por tu reseña!' };
  }
  req.session.flash = flash;
  volver(res, cita.id_cita);
}));

module.exports = router;
