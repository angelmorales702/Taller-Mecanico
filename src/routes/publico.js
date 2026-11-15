// Pantallas públicas (1-4): Inicio, Horarios, Servicios, Contacto. Todo viene de la BD excepto el texto de Inicio.
const router = require('express').Router();
const db = require('../db');
const { ah, DIAS } = require('../helpers');

router.get('/', ah(async (req, res) => {
  // Reseñas que el administrador dejó visibles
  const [resenas] = await db.query(
    `SELECT r.calificacion, r.comentario, r.fecha, u.nombre
     FROM resenas r JOIN citas c ON c.id_cita = r.id_cita JOIN usuarios u ON u.id_usuario = c.id_cliente
     WHERE r.visible = 1 ORDER BY r.fecha DESC LIMIT 6`);
  res.render('inicio', { titulo: 'Inicio', resenas });
}));

router.get('/horarios', ah(async (req, res) => {
  const [filas] = await db.query('SELECT * FROM horarios WHERE dia_semana IS NOT NULL');
  // Los 7 días en orden; un día sin registro se muestra como Cerrado
  const semana = DIAS.slice(1).map((nombre, i) => {
    const f = filas.find((x) => x.dia_semana === i + 1);
    return { nombre, abierto: !!f && !f.cerrado && f.hora_apertura && f.hora_cierre, apertura: f?.hora_apertura, cierre: f?.hora_cierre };
  });
  const [festivos] = await db.query('SELECT fecha_especial, descripcion FROM horarios WHERE fecha_especial >= CURDATE() ORDER BY fecha_especial');
  res.render('horarios', { titulo: 'Horarios', semana, festivos });
}));

router.get('/servicios', ah(async (req, res) => {
  const [filas] = await db.query(
    `SELECT c.nombre AS categoria, s.nombre, s.descripcion, s.precio, s.duracion_min
     FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
     WHERE s.activo = 1 ORDER BY c.nombre, s.nombre`);
  // Agrupa por categoría; una categoría sin servicios activos no aparece
  const categorias = {};
  filas.forEach((f) => (categorias[f.categoria] ||= []).push(f));
  res.render('servicios', { titulo: 'Servicios', categorias });
}));

router.get('/contacto', (req, res) => res.render('contacto', { titulo: 'Contacto' }));

module.exports = router;
