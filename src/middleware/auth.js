// Control de acceso: requireLogin (sesión válida) y requireRole (rol permitido).
const db = require('../db');

async function requireLogin(req, res, next) {
  try {
    const s = req.session.user;
    if (!s) {
      req.session.flash = { tipo: 'warning', msg: 'Inicia sesión para continuar.' };
      return res.redirect('/login');
    }
    // Revalida contra la BD: si el admin desactivó o cambió de rol al usuario, se refleja de inmediato
    const [rows] = await db.query('SELECT activo, id_rol, nombre FROM usuarios WHERE id_usuario = ?', [s.id]);
    if (!rows.length || !rows[0].activo) {
      return req.session.regenerate(() => {
        req.session.flash = { tipo: 'danger', msg: 'Tu cuenta no está activa.' };
        res.redirect('/login');
      });
    }
    s.rol = rows[0].id_rol;
    s.nombre = rows[0].nombre;
    res.locals.user = s;
    next();
  } catch (e) { next(e); }
}

// Uso: app.use('/admin', requireRole(3), router)   (1 = Cliente, 2 = Mecánico, 3 = Administrador)
function requireRole(...roles) {
  return [requireLogin, (req, res, next) => {
    if (!roles.includes(req.session.user.rol)) {
      return res.status(403).render('error', { titulo: 'Acceso denegado', codigo: 403, mensaje: 'No tienes permiso para ver esta página.' });
    }
    next();
  }];
}

module.exports = { requireLogin, requireRole };
