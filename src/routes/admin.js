// Panel de administrador: CRUD Usuarios (14), CRUD Inventario (18) y CRUD Servicios, Categorías y Horarios (16).
// El acceso ya está protegido en app.js con requireRole(3).
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { t, esEmail, esTel, esUsuario, esFecha, esHora, entero, decimal, ah } = require('../helpers');

const flash = (req, tipo, msg) => { req.session.flash = { tipo, msg }; };
const dupMsg = (e) => (e.code === 'ER_DUP_ENTRY' ? 'Ya existe un registro con ese nombre.' : null);

/* ========================================================================
   CRUD USUARIOS
   ======================================================================== */
async function pintarUsuarios(req, res, { form = null, errores = [] } = {}) {
  const rol = [1, 2, 3].includes(Number(req.query.rol)) ? Number(req.query.rol) : 0;
  const q = t(req.query.q);
  const where = ['1=1'], params = [];
  if (rol) { where.push('u.id_rol = ?'); params.push(rol); }
  if (q) {
    where.push('(u.nombre LIKE ? OR u.apellidos LIKE ? OR u.usuario LIKE ? OR u.email LIKE ?)');
    params.push(...Array(4).fill(`%${q}%`));
  }
  const [usuarios] = await db.query(
    `SELECT u.id_usuario, u.nombre, u.apellidos, u.usuario, u.email, u.telefono, u.id_rol, u.activo, u.especialidad, u.fecha_contratacion
     FROM usuarios u WHERE ${where.join(' AND ')} ORDER BY u.id_usuario`, params);
  if (!form && req.query.editar) {
    const [r] = await db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [Number(req.query.editar)]);
    if (r[0]) form = { ...r[0], password: '' };
  }
  res.render('admin/usuarios', { titulo: 'CRUD Usuarios', usuarios, rol, q, form: form || { id_rol: 2 }, errores });
}

router.get('/', (req, res) => res.redirect('/admin/usuarios'));
router.get('/usuarios', ah((req, res) => pintarUsuarios(req, res)));

router.post('/usuarios', ah(async (req, res) => {
  const id = Number(req.body.id_usuario) || 0;
  const f = {
    id_usuario: id, nombre: t(req.body.nombre), apellidos: t(req.body.apellidos), usuario: t(req.body.usuario),
    email: t(req.body.email).toLowerCase(), telefono: t(req.body.telefono), id_rol: Number(req.body.id_rol),
    especialidad: t(req.body.especialidad), fecha_contratacion: t(req.body.fecha_contratacion),
  };
  const pass = req.body.password || '';
  const errores = [];

  let existente = null;
  if (id) {
    [[existente]] = await db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [id]);
    if (!existente) { flash(req, 'danger', 'El usuario no existe.'); return res.redirect('/admin/usuarios'); }
    if (existente.id_rol === 1) f.id_rol = 1; // los clientes solo se crean por el registro público y no cambian de rol
  }
  if (!f.nombre || f.nombre.length > 60) errores.push('El nombre es obligatorio (máx. 60 caracteres).');
  if (!f.apellidos || f.apellidos.length > 80) errores.push('Los apellidos son obligatorios (máx. 80 caracteres).');
  if (!esUsuario(f.usuario)) errores.push('El usuario debe tener 3 a 30 caracteres (letras, números, punto, guion o guion bajo).');
  if (!esEmail(f.email)) errores.push('Escribe un correo válido.');
  if (!esTel(f.telefono)) errores.push('El teléfono debe tener 10 dígitos.');
  if (!(id && existente.id_rol === 1) && ![2, 3].includes(f.id_rol)) errores.push('Elige el rol Mecánico o Administrador.');
  if (!id && pass.length < 8) errores.push('La contraseña inicial debe tener al menos 8 caracteres.');
  if (id && pass && pass.length < 8) errores.push('La nueva contraseña debe tener al menos 8 caracteres.');
  if (f.id_rol === 2) {
    if (!f.especialidad || f.especialidad.length > 80) errores.push('La especialidad es obligatoria para mecánicos (máx. 80 caracteres).');
    if (!esFecha(f.fecha_contratacion)) errores.push('La fecha de contratación es obligatoria para mecánicos.');
  } else { f.especialidad = null; f.fecha_contratacion = null; }
  if (!errores.length) {
    const [dup] = await db.query('SELECT usuario, email FROM usuarios WHERE (usuario = ? OR email = ?) AND id_usuario <> ?', [f.usuario, f.email, id]);
    if (dup.some((d) => d.usuario === f.usuario)) errores.push('Ese usuario ya existe.');
    if (dup.some((d) => d.email === f.email)) errores.push('Ese correo ya está registrado.');
  }
  // Nunca debe quedar el sistema sin administradores activos
  if (!errores.length && id && existente.id_rol === 3 && f.id_rol !== 3) {
    const [[o]] = await db.query('SELECT COUNT(*) AS n FROM usuarios WHERE id_rol = 3 AND activo = 1 AND id_usuario <> ?', [id]);
    if (!o.n) errores.push('No puedes quitar el rol al último administrador activo.');
  }
  if (errores.length) return pintarUsuarios(req, res, { form: { ...f, password: '' }, errores });

  if (id) {
    const campos = [f.nombre, f.apellidos, f.usuario, f.email, f.telefono, f.id_rol, f.especialidad, f.fecha_contratacion];
    let sql = 'UPDATE usuarios SET nombre=?, apellidos=?, usuario=?, email=?, telefono=?, id_rol=?, especialidad=?, fecha_contratacion=?';
    if (pass) { sql += ', password_hash=?'; campos.push(await bcrypt.hash(pass, 10)); }
    await db.query(`${sql} WHERE id_usuario=?`, [...campos, id]);
    flash(req, 'success', 'Usuario actualizado.');
  } else {
    await db.query(
      `INSERT INTO usuarios (nombre, apellidos, usuario, email, password_hash, telefono, id_rol, especialidad, fecha_contratacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.nombre, f.apellidos, f.usuario, f.email, await bcrypt.hash(pass, 10), f.telefono, f.id_rol, f.especialidad, f.fecha_contratacion]);
    flash(req, 'success', 'Usuario creado.');
  }
  res.redirect('/admin/usuarios');
}));

// Baja / alta lógica (no se borra el registro para conservar el historial de citas)
router.post('/usuarios/:id/estado', ah(async (req, res) => {
  const id = Number(req.params.id);
  const [[u]] = await db.query('SELECT id_rol, activo FROM usuarios WHERE id_usuario = ?', [id]);
  if (!u) flash(req, 'danger', 'El usuario no existe.');
  else if (u.activo && id === req.session.user.id) flash(req, 'danger', 'No puedes desactivar tu propia cuenta.');
  else {
    if (u.activo && u.id_rol === 3) {
      const [[o]] = await db.query('SELECT COUNT(*) AS n FROM usuarios WHERE id_rol = 3 AND activo = 1 AND id_usuario <> ?', [id]);
      if (!o.n) { flash(req, 'danger', 'No se puede desactivar al último administrador activo.'); return res.redirect('/admin/usuarios'); }
    }
    await db.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [u.activo ? 0 : 1, id]);
    flash(req, 'success', u.activo ? 'Usuario desactivado.' : 'Usuario activado.');
  }
  res.redirect('/admin/usuarios');
}));

/* ========================================================================
   CRUD INVENTARIO
   ======================================================================== */
const estadoStock = (p) => (p.cantidad === 0 ? 'Agotado' : p.cantidad <= p.stock_minimo ? 'Stock Bajo' : 'Disponible');

async function pintarInventario(req, res, { form = null, errores = [] } = {}) {
  const filtro = ['Disponible', 'Stock Bajo', 'Agotado'].includes(req.query.estado) ? req.query.estado : '';
  const q = t(req.query.q).toLowerCase();
  const [todos] = await db.query('SELECT * FROM inventario ORDER BY nombre');
  todos.forEach((p) => { p.estado = p.activo ? estadoStock(p) : 'Inactivo'; });
  const conteo = { Todos: todos.length };
  ['Disponible', 'Stock Bajo', 'Agotado'].forEach((e) => { conteo[e] = todos.filter((p) => p.estado === e).length; });
  const productos = todos.filter((p) => (!filtro || p.estado === filtro) && (!q || p.nombre.toLowerCase().includes(q)));
  if (!form && req.query.editar) form = todos.find((p) => p.id_producto === Number(req.query.editar));
  res.render('admin/inventario', { titulo: 'CRUD Inventario', productos, filtro, q, conteo, form: form || {}, errores });
}

router.get('/inventario', ah((req, res) => pintarInventario(req, res)));

router.post('/inventario', ah(async (req, res) => {
  const id = Number(req.body.id_producto) || 0;
  const f = { id_producto: id, nombre: t(req.body.nombre), cantidad: entero(req.body.cantidad), stock_minimo: entero(req.body.stock_minimo), costo: decimal(req.body.costo) };
  const errores = [];
  if (!f.nombre || f.nombre.length > 100) errores.push('El nombre es obligatorio (máx. 100 caracteres).');
  if (isNaN(f.cantidad)) errores.push('La cantidad debe ser un entero mayor o igual a 0.');
  if (isNaN(f.stock_minimo)) errores.push('El mínimo de alerta debe ser un entero mayor o igual a 0.');
  if (isNaN(f.costo) || f.costo <= 0) errores.push('El costo debe ser mayor a 0 (máximo 2 decimales).');
  if (!errores.length) {
    const [dup] = await db.query('SELECT 1 FROM inventario WHERE nombre = ? AND id_producto <> ?', [f.nombre, id]);
    if (dup.length) errores.push('Ya existe un producto con ese nombre.');
  }
  if (errores.length) return pintarInventario(req, res, { form: { ...f, cantidad: req.body.cantidad, stock_minimo: req.body.stock_minimo, costo: req.body.costo }, errores });

  if (id) {
    await db.query('UPDATE inventario SET nombre=?, cantidad=?, stock_minimo=?, costo=? WHERE id_producto=?', [f.nombre, f.cantidad, f.stock_minimo, f.costo, id]);
    flash(req, 'success', 'Producto actualizado.');
  } else {
    await db.query('INSERT INTO inventario (nombre, cantidad, stock_minimo, costo) VALUES (?, ?, ?, ?)', [f.nombre, f.cantidad, f.stock_minimo, f.costo]);
    flash(req, 'success', 'Producto registrado en el almacén.');
  }
  res.redirect('/admin/inventario');
}));

// Entrada rápida de mercancía: solo suma cantidades positivas
router.post('/inventario/:id/entrada', ah(async (req, res) => {
  const n = entero(req.body.cantidad);
  if (isNaN(n) || n <= 0) flash(req, 'danger', 'La entrada debe ser un entero mayor a 0.');
  else {
    const [r] = await db.query('UPDATE inventario SET cantidad = cantidad + ? WHERE id_producto = ?', [n, Number(req.params.id)]);
    flash(req, r.affectedRows ? 'success' : 'danger', r.affectedRows ? `Se sumaron ${n} piezas.` : 'El producto no existe.');
  }
  res.redirect('/admin/inventario');
}));

router.post('/inventario/:id/estado', ah(async (req, res) => {
  await db.query('UPDATE inventario SET activo = 1 - activo WHERE id_producto = ?', [Number(req.params.id)]);
  flash(req, 'success', 'Estado del producto actualizado.');
  res.redirect('/admin/inventario');
}));

/* ========================================================================
   CRUD SERVICIOS, CATEGORÍAS Y HORARIOS  (una pantalla con tres pestañas)
   ======================================================================== */
router.get('/servicios', ah(async (req, res) => {
  const tab = ['servicios', 'categorias', 'horarios'].includes(req.query.tab) ? req.query.tab : 'servicios';
  const editar = Number(req.query.editar) || 0;
  const [servicios] = await db.query(
    `SELECT s.*, c.nombre AS categoria, (SELECT COUNT(*) FROM cita_servicios cs WHERE cs.id_servicio = s.id_servicio) AS usos
     FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria ORDER BY c.nombre, s.nombre`);
  const [categorias] = await db.query(
    `SELECT c.*, (SELECT COUNT(*) FROM servicios s WHERE s.id_categoria = c.id_categoria) AS servicios
     FROM categorias_servicio c ORDER BY c.nombre`);
  const [horarios] = await db.query('SELECT * FROM horarios ORDER BY dia_semana IS NULL, dia_semana, fecha_especial');
  res.render('admin/servicios', {
    titulo: 'CRUD Servicios y Horarios', tab, servicios, categorias, horarios,
    editServicio: tab === 'servicios' ? servicios.find((s) => s.id_servicio === editar) : null,
    editCategoria: tab === 'categorias' ? categorias.find((c) => c.id_categoria === editar) : null,
    editHorario: tab === 'horarios' ? horarios.find((h) => h.id_horario === editar) : null,
  });
}));

const volver = (res, tab, editar) => res.redirect(`/admin/servicios?tab=${tab}${editar ? `&editar=${editar}` : ''}`);

// --- Servicios
router.post('/servicios/guardar', ah(async (req, res) => {
  const id = Number(req.body.id_servicio) || 0;
  const f = { cat: Number(req.body.id_categoria), nombre: t(req.body.nombre), descripcion: t(req.body.descripcion) || null,
    precio: decimal(req.body.precio), duracion: entero(req.body.duracion_min) };
  const errores = [];
  if (!f.nombre || f.nombre.length > 80) errores.push('El nombre es obligatorio (máx. 80 caracteres).');
  if (f.descripcion && f.descripcion.length > 255) errores.push('La descripción es muy larga (máx. 255).');
  if (isNaN(f.precio) || f.precio <= 0) errores.push('El precio debe ser mayor a 0.');
  if (isNaN(f.duracion) || f.duracion <= 0) errores.push('La duración debe ser un entero mayor a 0 (minutos).');
  const [cats] = await db.query('SELECT 1 FROM categorias_servicio WHERE id_categoria = ?', [f.cat]);
  if (!cats.length) errores.push('Elige una categoría válida.');
  if (errores.length) { flash(req, 'danger', errores.join(' ')); return volver(res, 'servicios', id); }

  if (id) {
    await db.query('UPDATE servicios SET id_categoria=?, nombre=?, descripcion=?, precio=?, duracion_min=? WHERE id_servicio=?', [f.cat, f.nombre, f.descripcion, f.precio, f.duracion, id]);
    flash(req, 'success', 'Servicio actualizado.');
  } else {
    await db.query('INSERT INTO servicios (id_categoria, nombre, descripcion, precio, duracion_min) VALUES (?, ?, ?, ?, ?)', [f.cat, f.nombre, f.descripcion, f.precio, f.duracion]);
    flash(req, 'success', 'Servicio creado.');
  }
  volver(res, 'servicios');
}));

router.post('/servicios/:id/estado', ah(async (req, res) => {
  await db.query('UPDATE servicios SET activo = 1 - activo WHERE id_servicio = ?', [Number(req.params.id)]);
  flash(req, 'success', 'Visibilidad del servicio actualizada.');
  volver(res, 'servicios');
}));

// Un servicio con citas asociadas no se borra: se desactiva para conservar el historial
router.post('/servicios/:id/eliminar', ah(async (req, res) => {
  const id = Number(req.params.id);
  const [[u]] = await db.query('SELECT COUNT(*) AS n FROM cita_servicios WHERE id_servicio = ?', [id]);
  if (u.n) {
    await db.query('UPDATE servicios SET activo = 0 WHERE id_servicio = ?', [id]);
    flash(req, 'warning', 'El servicio tiene citas asociadas, por eso se desactivó en lugar de eliminarse.');
  } else {
    await db.query('DELETE FROM servicios WHERE id_servicio = ?', [id]);
    flash(req, 'success', 'Servicio eliminado.');
  }
  volver(res, 'servicios');
}));

// --- Categorías
router.post('/categorias/guardar', ah(async (req, res) => {
  const id = Number(req.body.id_categoria) || 0;
  const nombre = t(req.body.nombre);
  if (!nombre || nombre.length > 50) { flash(req, 'danger', 'El nombre de la categoría es obligatorio (máx. 50 caracteres).'); return volver(res, 'categorias', id); }
  try {
    if (id) await db.query('UPDATE categorias_servicio SET nombre = ? WHERE id_categoria = ?', [nombre, id]);
    else await db.query('INSERT INTO categorias_servicio (nombre) VALUES (?)', [nombre]);
    flash(req, 'success', id ? 'Categoría actualizada.' : 'Categoría creada.');
  } catch (e) {
    if (!dupMsg(e)) throw e;
    flash(req, 'danger', 'Ya existe una categoría con ese nombre.');
    return volver(res, 'categorias', id);
  }
  volver(res, 'categorias');
}));

router.post('/categorias/:id/eliminar', ah(async (req, res) => {
  const id = Number(req.params.id);
  const [[u]] = await db.query('SELECT COUNT(*) AS n FROM servicios WHERE id_categoria = ?', [id]);
  if (u.n) flash(req, 'danger', 'No se puede eliminar: la categoría tiene servicios. Muévelos o desactívalos primero.');
  else { await db.query('DELETE FROM categorias_servicio WHERE id_categoria = ?', [id]); flash(req, 'success', 'Categoría eliminada.'); }
  volver(res, 'categorias');
}));

// --- Horarios (7 días fijos + días festivos)
router.post('/horarios/guardar', ah(async (req, res) => {
  const id = Number(req.body.id_horario) || 0;
  const cerrado = req.body.cerrado ? 1 : 0;
  const f = { apertura: t(req.body.hora_apertura), cierre: t(req.body.hora_cierre), capacidad: entero(req.body.capacidad),
    descripcion: t(req.body.descripcion) || null, fecha: t(req.body.fecha_especial) };
  const errores = [];
  if (isNaN(f.capacidad)) errores.push('La capacidad debe ser un entero mayor o igual a 0.');
  if (f.descripcion && f.descripcion.length > 100) errores.push('La descripción es muy larga (máx. 100).');
  if (!cerrado) {
    if (!esHora(f.apertura) || !esHora(f.cierre)) errores.push('Indica hora de apertura y de cierre.');
    else if (f.cierre <= f.apertura) errores.push('La hora de cierre debe ser posterior a la de apertura.');
  }
  if (!id && !esFecha(f.fecha)) errores.push('Indica la fecha del día festivo.');
  if (errores.length) { flash(req, 'danger', errores.join(' ')); return volver(res, 'horarios', id); }

  const ap = cerrado ? null : f.apertura, ci = cerrado ? null : f.cierre;
  try {
    if (id) await db.query('UPDATE horarios SET hora_apertura=?, hora_cierre=?, cerrado=?, capacidad=?, descripcion=? WHERE id_horario=?', [ap, ci, cerrado, f.capacidad, f.descripcion, id]);
    else await db.query('INSERT INTO horarios (fecha_especial, hora_apertura, hora_cierre, cerrado, capacidad, descripcion) VALUES (?, ?, ?, ?, ?, ?)', [f.fecha, ap, ci, cerrado, f.capacidad, f.descripcion]);
    flash(req, 'success', id ? 'Horario actualizado.' : 'Día festivo agregado.');
  } catch (e) {
    if (!dupMsg(e)) throw e;
    flash(req, 'danger', 'Ya existe un registro para esa fecha.');
    return volver(res, 'horarios');
  }
  volver(res, 'horarios');
}));

// Solo se pueden eliminar días festivos; los 7 días de la semana se editan, no se borran
router.post('/horarios/:id/eliminar', ah(async (req, res) => {
  const [r] = await db.query('DELETE FROM horarios WHERE id_horario = ? AND fecha_especial IS NOT NULL', [Number(req.params.id)]);
  flash(req, r.affectedRows ? 'success' : 'danger', r.affectedRows ? 'Día festivo eliminado.' : 'Solo se pueden eliminar días festivos.');
  volver(res, 'horarios');
}));

module.exports = router;
