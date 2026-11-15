# Proyecto Final – Programación Web (UANL FIME)
Sistema web de reservación de servicios para un **taller mecánico**. Equipo de 4 alumnos ITS. Todo el código y textos de la UI en **español**.

## Stack (ya definido en Fase 1)
- Front-end: HTML5, CSS3, **Bootstrap 5** (CDN), JavaScript vanilla (fetch para filtros/estatus sin recargar). Gráficas: Chart.js (CDN).
- Back-end: **Node.js + Express**, vistas con **EJS**, `express-session`, `bcrypt`, `mysql2` (pool, consultas parametrizadas), `dotenv`.
- BD: **MySQL**, base `taller_mecanico` (15 tablas, ya creada; ver `db/schema.sql`).
- Git obligatorio: commits frecuentes, ramas por pantalla/módulo, `.gitignore` con `node_modules` y `.env`.

## Restricciones del profesor (NO violar)
- Prohibido: plantillas web, constructores WYSIWYG, CMS. Todo el HTML/CSS/JS se escribe a mano (Bootstrap como librería sí está permitido).
- Mínimo 8 pantallas, 2 roles, 2 CRUD completos, conexión a BD, Git. El proyecto debe correr y ser entendible por todos los integrantes (se evalúa código/BD en la presentación), así que **código simple, comentado y organizado**.

## Estructura sugerida
```
/db            schema.sql, seed.sql, views.sql
/src
  app.js
  config/db.js
  middleware/auth.js      (requireLogin, requireRole)
  routes/                 publico.js, auth.js, cliente.js, mecanico.js, admin.js
  controllers/ models/
/views                    (EJS) partials/navbar por rol, footer
/public                   css/, js/, img/
.env.example  README.md (documentación técnica)  docs/ (manual de usuario)
```

## Roles y acceso
- **Visitante**: Inicio, Horarios, Servicios, Contacto, Registro, Login.
- **Cliente (id_rol=1)**: cuenta, vehículos, agendar cita, seguimiento/presupuesto/reseña.
- **Mecánico (id_rol=2)**: cuenta, sus citas asignadas, orden de trabajo, refacciones.
- **Administrador (id_rol=3)**: cuenta, CRUDs, reportes.
- Login con **usuario o correo** + contraseña (bcrypt). Error genérico: "Usuario o contraseña incorrectos". Cuenta debe estar `activo=1`. Tras login redirige al panel según rol. Middleware protege cada ruta por rol. Logout destruye la sesión.

## Modelo de BD (resumen; fuente de verdad = `db/schema.sql`)
roles(id_rol, nombre) · usuarios(id_usuario, nombre, apellidos, email UNIQUE, password_hash, telefono CHAR(10), id_rol FK, activo, fecha_registro, especialidad NULL, fecha_contratacion NULL) · vehiculos(id_vehiculo, id_usuario FK, marca, modelo, anio, placas UNIQUE, color, activo) · estatus_cita(Pendiente/Confirmada/Cancelada) · estatus_vehiculo(Recibido, En diagnóstico, Esperando refacción, En reparación, Listo para entrega, Entregado) · citas(id_cita, id_cliente FK, id_vehiculo FK, id_mecanico FK NULL, id_estatus_cita FK, id_estatus_vehiculo FK NULL, fecha_hora, observaciones, llamada_solicitada, fecha_creacion) · seguimiento_vehiculo(id_seguimiento, id_cita, id_estatus_vehiculo, id_usuario, comentario, fecha_hora) · resenas(id_resena, id_cita UNIQUE, calificacion 1-5, comentario, visible, fecha) · categorias_servicio · servicios(id_servicio, id_categoria, nombre, descripcion, precio, duracion_min, activo) · cita_servicios(id_cita+id_servicio PK, precio_aplicado) · inventario(id_producto, nombre UNIQUE, cantidad, stock_minimo, costo, activo) · refacciones(id_refaccion, id_cita, id_producto NULL=externa, descripcion, cantidad, costo, aprobada NULL=pendiente) · horarios(id_horario, dia_semana 1-7, fecha_especial, hora_apertura, hora_cierre, cerrado, capacidad, descripcion) · contacto_taller(id_contacto, telefono, correo, direccion, facebook_url, maps_url).

**Fuente de verdad de la BD: `db/schema.sql`** (script completo de Workbench: DROP/CREATE de las 15 tablas, datos semilla, vistas `v_pantalla_*`, `v_estado_inventario`, reportes `v_pantalla_14/15` y procedimientos `sp_agendar_cita`, `sp_actualizar_estatus_vehiculo`, `sp_responder_refaccion`). No recrear lo que ya existe; la app puede consultar esas vistas y llamar esos SP.

**Pendientes / diferencias a resolver (en este orden):**
1. Falta la columna `usuario` (el registro/login usa Usuario o Correo). Agregar con ALTER en un archivo `db/ajustes.sql`: `usuario VARCHAR(30) UNIQUE NOT NULL`, rellenando los usuarios demo (ej. `ana`, `carlos`, `luis`, `roberto`, `admin`).
2. El seed guarda contraseñas en texto plano (`123456`). Crear `db/hash_passwords.js` que las convierta a bcrypt. La app SOLO compara con bcrypt.
3. Roles: id 1=Cliente, 2=Mecanico, 3=Administrador.
4. `sp_agendar_cita` recibe UN servicio y limita 3 citas por bloque; para varios servicios, llamar el SP con el primero y luego insertar el resto en `cita_servicios` (o hacer la lógica en la app dentro de una transacción).
5. Stock de refacciones internas: `sp_responder_refaccion` lo descuenta cuando el cliente aprueba (`aprobada=1`). Seguir esa regla (no descontar dos veces).

## Pantallas (19) y reglas clave
**Públicas (datos desde BD, solo lectura)**
1. Inicio: logo, nombre, eslogan, misión/visión (contenido fijo) + opiniones de clientes (reseñas con `visible=1`).
2. Horarios: tabla de `horarios`, 7 días en orden, sin registro = "Cerrado".
3. Servicios: una tabla por categoría; solo `activo=1`; categoría sin servicios activos no se muestra; en "Cambio de refacciones" mostrar "$X + Refacción".
4. Contacto: `contacto_taller`; omitir líneas vacías. Footer con los mismos datos.
5. Registro (solo Cliente): correo, teléfono (10 dígitos), usuario, contraseña (mín. 8). Validar únicos, hash, rol Cliente, mensaje de confirmación.
6. Login.

**Cliente**
7. Mi Cuenta: editar nombre/teléfono/correo, cambiar contraseña (actual + nueva distinta y confirmada), logout.
8. Mis Vehículos y Citas: CRUD de sus vehículos (baja lógica, historial de servicios por auto, placas únicas, año 1950–2100) + agendar cita (vehículo propio, ≥1 servicio, fecha y bloque disponible según `horarios`/capacidad, subtotal estimado, observaciones).
9. Seguimiento, Presupuesto y Reseñas: selector de cita propia; línea de tiempo de los 6 estatus + bitácora; presupuesto (servicios + refacciones, total); aprobar cargos extra (`aprobada=1`); solicitar llamada (`llamada_solicitada=1`); cancelar solo si Pendiente; reseña solo si Entregado (1–5, una por cita).

**Mecánico**
10. Mi Cuenta (igual que 7).
11. Mis Citas: solo `id_mecanico = sesión`; filtros Hoy/Semana; ver historial del auto; abrir orden.
12. Orden de trabajo + consumo de refacciones (una página con scroll): cambiar estatus (inserta en `seguimiento_vehiculo`, comentario obligatorio, no regresar desde Entregado); usar refacción del inventario (descuenta stock en transacción, cantidad ≤ stock, aviso si queda en mínimo); refacción externa (`id_producto=NULL`, `aprobada=NULL`); quitar refacción (devuelve stock si era interna).

**Administrador**
13. Mi Cuenta (igual que 7).
14. **CRUD Usuarios** (Create/Read/Update/baja lógica): filtros por rol, búsqueda, alta de Mecánicos (especialidad + fecha contratación obligatorias) y Admins, contraseña inicial con hash, no desactivar al último admin activo.
15. **CRUD Citas y Vehículos**: pestaña A (agendar cita presencial/telefónica, asignar mecánico activo, cambiar estatus de cita, eliminar solo si no está en proceso, validar capacidad) y pestaña B (padrón de vehículos: alta, editar, historial, baja lógica).
16. **CRUD Servicios, Categorías y Horarios**: no eliminar con citas asociadas (desactivar); precio y duración > 0; cierre > apertura.
17. Contacto y Reseñas: editar `contacto_taller` (validar teléfono, correo, URLs); moderar `resenas.visible` (no editar texto ni calificación).
18. **CRUD Inventario**: filtros por estado (vista), búsqueda, alta, editar, entrada rápida (suma positiva), desactivar; nombre único, costo > 0.
19. Reportes: selector mes/año; KPIs (ingresos, total citas, promedio calificación, alertas de stock), gráfica de barras ingresos/citas, pastel de estatus de inventario, tabla de rendimiento por mecánico. Solo citas Entregadas cuentan como ingreso.

## Reglas generales de código
- Validar en cliente (Bootstrap/JS) **y** en servidor. Consultas siempre parametrizadas. Nunca guardar ni mostrar `password_hash`.
- Cada usuario solo accede a sus propios datos (verificar pertenencia en cada query).
- Navbar distinto por rol (parciales EJS). Diseño responsivo, consistente, colores azul del boceto.
- Mensajes de éxito/error visibles (flash/alerts de Bootstrap).
- Comentar controladores y consultas importantes (todos los integrantes deben poder explicarlos).

## Orden de trabajo — PLAZO: lunes 16-nov-2026 (prioridad por niveles)
Regla: terminar un nivel completo y funcionando antes de pasar al siguiente. Hacer commit por paso. Si algo no cabe, se deja simple (sin extras), nunca roto.

**NIVEL 1 – Mínimo para aprobar (sábado)**
1. Proyecto base: Express+EJS, `.env`, conexión BD, layout y navbars por rol.
2. Ajustes de BD (columna `usuario`, vista `v_estado_inventario`) + seed con hashes bcrypt (cliente, mecánico, admin demo).
3. Públicas: 1 Inicio, 2 Horarios, 3 Servicios, 4 Contacto.
4. Auth: 5 Registro, 6 Login, sesiones, middleware de roles, logout.
5. Admin: 13 Mi Cuenta, **14 CRUD Usuarios**, **18 CRUD Inventario**, 16 CRUD Servicios y Horarios. (Con esto ya se cumplen 8+ pantallas, 2 roles y 2 CRUD.)

**NIVEL 2 – Flujo principal del taller (domingo)**
6. Cliente: 7 Mi Cuenta, 8 Vehículos y agendar cita, 9 Seguimiento (versión simple: línea de tiempo, presupuesto, cancelar, reseña).
7. Mecánico: 11 Mis Citas, 12 Orden de trabajo (cambiar estatus + refacciones).
8. Admin: 15 Citas (asignar mecánico, cambiar estatus).

**NIVEL 3 – Si sobra tiempo (domingo noche)**
9. 17 Contacto y Reseñas, 19 Reportes (KPIs + una gráfica), 10 Mi Cuenta mecánico.
10. README técnico + manual de usuario con capturas.

**Reparto sugerido para 4 integrantes (cada quien en su rama, merge a `main` por PR):**
A: pasos 1–2 y auth (4) primero, porque los demás dependen de eso · B: públicas (3) + Admin 16/17 · C: Admin 14/18/15/19 · D: Cliente y Mecánico (6–7). Documentación entre todos al final.

Al terminar cada paso: correr la app, probar con los usuarios demo y hacer commit.

## Entregables finales
- Documentación técnica (`README.md`): instalación (`npm install`, crear BD con `db/schema.sql` + `seed.js`, `.env`, `npm start`), tecnologías, estructura.
- Documentación de usuario: capturas de pantallas finales, funcionalidades, cómo crear cuenta/cita, requisitos previos (el admin crea mecánicos).
- Repositorio Git con commits de **todos** los integrantes (quien no participe no tiene calificación).
