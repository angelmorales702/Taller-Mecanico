// Pool de conexiones a MySQL. Todas las consultas del proyecto usan este pool con parámetros (?) para evitar SQL injection.
const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taller_mecanico',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // fechas como texto 'YYYY-MM-DD HH:MM:SS' (evita problemas de zona horaria)
  charset: 'utf8mb4',
});
