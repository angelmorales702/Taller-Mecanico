# Taller Mecánico FIME — Proyecto final de Programación Web (UANL FIME)

Sistema web para reservar servicios de un taller mecánico, con tres roles (Cliente, Mecánico, Administrador).

## Tecnologías
| Capa | Tecnología |
|---|---|
| Front-end | HTML5, CSS3, Bootstrap 5 (CDN), JavaScript, plantillas EJS |
| Back-end | Node.js + Express, express-session (sesiones), bcryptjs (contraseñas cifradas) |
| Base de datos | MySQL 8 (`taller_mecanico`, 15 tablas) con el driver mysql2 |
| Control de versiones | Git |

## Cómo se monta
1. Instalar **Node.js** (LTS), **MySQL** y **Git**.
2. Cargar la base de datos: ejecutar `db/schema.sql` (script de la Fase 2: tablas, datos de ejemplo, vistas y procedimientos) en MySQL Workbench.
3. En la carpeta del proyecto:
   ```
   npm install
   copy .env.example .env      (Windows)   |   cp .env.example .env   (Linux/Mac)
   ```
   Editar `.env` con el usuario y contraseña de MySQL (`DB_PASSWORD`).
4. Ajustes de BD, una sola vez: `npm run setup`
   - Agrega la columna `usuarios.usuario` (el login acepta usuario o correo). Equivale a `db/ajustes.sql`.
   - Cifra con bcrypt las contraseñas de los usuarios demo.

## Cómo se ejecuta
```
npm start
```
Abrir http://localhost:3000

### Usuarios demo (contraseña `123456`)
| Rol | Usuario | Correo |
|---|---|---|
| Administrador | `admin` | admin.demo@example.com |
| Mecánico | `luis`, `roberto` | luis.demo@example.com, roberto.mec@example.com |
| Cliente | `ana`, `carlos` | ana.demo@example.com, carlos@example.com |

## Estructura
```
db/            schema.sql (Fase 2), ajustes.sql, setup.js
src/app.js     servidor Express, sesiones y manejo de errores
src/db.js      pool de conexiones MySQL
src/helpers.js validaciones y formato (teléfono, correo, horas, dinero)
src/middleware/auth.js   requireLogin / requireRole
src/routes/    publico.js · auth.js · cuenta.js · cliente.js · admin.js
src/views/     plantillas EJS (partials/ = navbar y footer, cliente/ = pantallas 8 y 9, admin/ = CRUD)
src/public/    CSS
```

## Pantallas implementadas (número de la Fase 1)
- Públicas: 1 Inicio, 2 Horarios, 3 Servicios, 4 Contacto (datos desde la BD)
- 5 Registro (solo clientes) · 6 Iniciar sesión (usuario o correo)
- 7 / 10 / 13 Mi cuenta (cliente, mecánico y administrador)
- 8 Mis vehículos y citas (cliente): alta, edición, baja lógica e historial de vehículos; agendar cita con varios servicios, bloques de horario según la tabla `horarios` y capacidad
- 9 Seguimiento, presupuesto y reseñas (cliente): línea de tiempo de estatus, bitácora, presupuesto con aprobación de cargos extras (`sp_responder_refaccion`), llamada aclaratoria, cancelar cita Pendiente y reseña al ser Entregado
- 14 **CRUD Usuarios** · 18 **CRUD Inventario** · 16 **CRUD Servicios, Categorías y Horarios**

Pendientes: 11 y 12 (mecánico), 15 (citas y vehículos), 17 (contacto y reseñas), 19 (reportes).

## Seguridad implementada
- Contraseñas con bcrypt; mensaje de error genérico en el login; sesión regenerada al iniciar.
- Consultas parametrizadas (sin SQL injection) y salida escapada en EJS (sin XSS).
- Cada ruta valida el rol; el rol y el estado activo se revalidan contra la BD en cada petición.
- Baja lógica de usuarios, servicios e inventario; no se puede desactivar al último administrador ni a uno mismo.
