// Funciones de validación y formato compartidas por rutas y vistas.
const t = (v) => (v ?? '').toString().trim(); // texto limpio

const esEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 100;
const esTel = (s) => /^[0-9]{10}$/.test(s);
const esUsuario = (s) => /^[A-Za-z0-9_.-]{3,30}$/.test(s);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));
const esHora = (s) => /^\d{2}:\d{2}(:\d{2})?$/.test(s);
const entero = (v) => (/^\d+$/.test(t(v)) ? Number(t(v)) : NaN);
const decimal = (v) => (/^\d+(\.\d{1,2})?$/.test(t(v)) ? Number(t(v)) : NaN);

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ROLES = { 1: 'Cliente', 2: 'Mecánico', 3: 'Administrador' };

// '08:00:00' -> '8:00 AM'
function hora12(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}
const dinero = (n) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
// Envuelve rutas async para mandar los errores al manejador general
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { t, esEmail, esTel, esUsuario, esFecha, esHora, entero, decimal, DIAS, ROLES, hora12, dinero, ah };
