// Ajustes de BD que se corren UNA vez después de cargar el script SQL:  npm run setup
//  1) Agrega la columna `usuario` (el login/registro usa Usuario o Correo) y la llena para los usuarios demo.
//  2) Convierte las contraseñas en texto plano del seed a hashes bcrypt.
// Es idempotente: se puede correr varias veces sin dañar nada.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DEMO = {
  'ana.demo@example.com': 'ana',
  'carlos@example.com': 'carlos',
  'luis.demo@example.com': 'luis',
  'roberto.mec@example.com': 'roberto',
  'admin.demo@example.com': 'admin',
};

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taller_mecanico',
  });

  // 1) Columna usuario
  const [col] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'usuarios' AND column_name = 'usuario'`);
  if (col[0].n === 0) {
    await db.query('ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(30) NULL AFTER apellidos');
    console.log('Columna usuarios.usuario creada');
  }
  for (const [email, usuario] of Object.entries(DEMO)) {
    await db.query('UPDATE usuarios SET usuario = ? WHERE email = ? AND usuario IS NULL', [usuario, email]);
  }
  // Cualquier otro usuario sin nombre de usuario recibe uno basado en su id
  await db.query("UPDATE usuarios SET usuario = CONCAT('user', id_usuario) WHERE usuario IS NULL");
  const [idx] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'usuarios' AND column_name = 'usuario'`);
  if (idx[0].n === 0) await db.query('ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_usuario (usuario)');
  await db.query('ALTER TABLE usuarios MODIFY usuario VARCHAR(30) NOT NULL');

  // 2) Hashes bcrypt
  const [rows] = await db.query("SELECT id_usuario, password_hash FROM usuarios WHERE password_hash NOT LIKE '$2%'");
  for (const u of rows) {
    const hash = await bcrypt.hash(u.password_hash, 10);
    await db.query('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?', [hash, u.id_usuario]);
  }
  console.log(`Contraseñas cifradas: ${rows.length}`);
  console.log('Listo. Usuarios demo (contraseña 123456): ana, carlos (clientes), luis, roberto (mecánicos), admin');
  await db.end();
})().catch((e) => { console.error('Error en setup:', e.message); process.exit(1); });
