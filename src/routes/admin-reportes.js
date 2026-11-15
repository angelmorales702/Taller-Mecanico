// Pantalla 19 (administrador): Reportes estadísticos.
// Solo cuentan para ingresos las citas en estado Entregado (id_estatus_vehiculo = 6).
const router = require('express').Router();
const db = require('../db');
const { entero, ah } = require('../helpers');

const TOTAL_CITA = `(SELECT COALESCE(SUM(precio_aplicado), 0) FROM cita_servicios WHERE id_cita = c.id_cita)
  + (SELECT COALESCE(SUM(costo * cantidad), 0) FROM refacciones WHERE id_cita = c.id_cita AND aprobada = 1)`;
const promedio = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

router.get('/', ah(async (req, res) => {
  const hoy = new Date();
  let mes = entero(req.query.mes), anio = entero(req.query.anio);
  if (Number.isNaN(mes) || mes < 1 || mes > 12) mes = hoy.getMonth() + 1;
  if (Number.isNaN(anio) || anio < 2000 || anio > 2100) anio = hoy.getFullYear();

  const [anios] = await db.query('SELECT DISTINCT YEAR(fecha_hora) AS a FROM citas ORDER BY a DESC');
  const listaAnios = [...new Set([hoy.getFullYear(), anio, ...anios.map((x) => x.a)])].sort((a, b) => b - a);

  // Citas del año con su total (las canceladas no cuentan)
  const [citas] = await db.query(
    `SELECT c.id_cita, MONTH(c.fecha_hora) AS mes, c.id_mecanico, c.id_estatus_vehiculo, ${TOTAL_CITA} AS total
     FROM citas c WHERE YEAR(c.fecha_hora) = ? AND c.id_estatus_cita <> 3`, [anio]);
  const [resenas] = await db.query(
    `SELECT r.calificacion, MONTH(c.fecha_hora) AS mes, c.id_mecanico
     FROM resenas r JOIN citas c ON c.id_cita = r.id_cita WHERE YEAR(c.fecha_hora) = ?`, [anio]);

  // Serie por mes (para la gráfica)
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const delMes = citas.filter((c) => c.mes === i + 1);
    return { mes: i + 1, citas: delMes.length, ingresos: delMes.filter((c) => c.id_estatus_vehiculo === 6).reduce((a, c) => a + Number(c.total), 0) };
  });

  // Tarjetas del mes elegido
  const delMes = citas.filter((c) => c.mes === mes);
  const entregadas = delMes.filter((c) => c.id_estatus_vehiculo === 6);
  const resMes = resenas.filter((r) => r.mes === mes);
  const tarjetas = {
    ingresos: entregadas.reduce((a, c) => a + Number(c.total), 0),
    citas: delMes.length, entregadas: entregadas.length,
    calificacion: promedio(resMes.map((r) => r.calificacion)), resenas: resMes.length,
  };

  // Inventario: misma regla que la pantalla de inventario
  const [inv] = await db.query('SELECT cantidad, stock_minimo FROM inventario WHERE activo = 1');
  const stock = { Disponible: 0, 'Stock Bajo': 0, Agotado: 0 };
  inv.forEach((p) => { stock[p.cantidad === 0 ? 'Agotado' : (p.cantidad <= p.stock_minimo ? 'Stock Bajo' : 'Disponible')] += 1; });

  // Rendimiento por mecánico en el mes elegido
  const [mecs] = await db.query("SELECT id_usuario, CONCAT(nombre, ' ', apellidos) AS nombre, especialidad FROM usuarios WHERE id_rol = 2 ORDER BY nombre");
  const mecanicos = mecs.map((m) => ({
    ...m,
    asignadas: delMes.filter((c) => c.id_mecanico === m.id_usuario).length,
    concluidas: entregadas.filter((c) => c.id_mecanico === m.id_usuario).length,
    ingresos: entregadas.filter((c) => c.id_mecanico === m.id_usuario).reduce((a, c) => a + Number(c.total), 0),
    calificacion: promedio(resMes.filter((r) => r.id_mecanico === m.id_usuario).map((r) => r.calificacion)),
  }));

  res.render('admin/reportes', {
    titulo: 'Reportes estadísticos', mes, anio, listaAnios, tarjetas, porMes, stock, totalInv: inv.length, alertas: stock['Stock Bajo'] + stock.Agotado,
    mecanicos, maxIngresos: Math.max(...porMes.map((m) => m.ingresos), 1), maxCitas: Math.max(...porMes.map((m) => m.citas), 1),
  });
}));

module.exports = router;
