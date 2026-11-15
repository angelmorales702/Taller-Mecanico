-- =========================================================================
-- PROYECTO FINAL: SISTEMA DE TALLER MECÁNICO (PANTALLAS EN VISTAS Y SPs SQL)
-- UANL FIME — Laboratorio de Programación Web
-- MOTOR: MySQL 8.0+
-- =========================================================================

DROP DATABASE IF EXISTS taller_mecanico;
CREATE DATABASE taller_mecanico CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taller_mecanico;

-- =========================================================================
-- SECCIÓN 1: CREACIÓN DE LAS 15 TABLAS DEL MODELO ENTIDAD-RELACIÓN
-- =========================================================================

-- 1. Tabla: roles
CREATE TABLE roles (
    id_rol INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

-- 2. Tabla: usuarios
CREATE TABLE usuarios (
    id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    apellidos VARCHAR(80) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono CHAR(10) NULL,
    id_rol INT UNSIGNED NOT NULL,
    activo TINYINT UNSIGNED NOT NULL DEFAULT 1,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    especialidad VARCHAR(80) NULL,
    fecha_contratacion DATE NULL,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
    CONSTRAINT chk_telefono_usuarios CHECK (telefono IS NULL OR telefono REGEXP '^[0-9]{10}$')
);

-- 3. Tabla: vehiculos
CREATE TABLE vehiculos (
    id_vehiculo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT UNSIGNED NOT NULL,
    marca VARCHAR(40) NOT NULL,
    modelo VARCHAR(40) NOT NULL,
    anio SMALLINT UNSIGNED NOT NULL,
    placas VARCHAR(15) NOT NULL UNIQUE,
    color VARCHAR(30) NULL,
    activo TINYINT UNSIGNED NOT NULL DEFAULT 1,
    CONSTRAINT fk_vehiculos_usuarios FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT chk_anio_vehiculo CHECK (anio BETWEEN 1950 AND 2100)
);

-- 4. Tabla: estatus_cita
CREATE TABLE estatus_cita (
    id_estatus_cita INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

-- 5. Tabla: estatus_vehiculo
CREATE TABLE estatus_vehiculo (
    id_estatus_vehiculo INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE
);

-- 6. Tabla: citas
CREATE TABLE citas (
    id_cita INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT UNSIGNED NOT NULL,
    id_vehiculo INT UNSIGNED NOT NULL,
    id_mecanico INT UNSIGNED NULL,
    id_estatus_cita INT UNSIGNED NOT NULL DEFAULT 1,
    id_estatus_vehiculo INT UNSIGNED NULL DEFAULT 1,
    fecha_hora DATETIME NOT NULL,
    observaciones VARCHAR(255) NULL,
    llamada_solicitada TINYINT UNSIGNED NOT NULL DEFAULT 0,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_citas_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_citas_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
    CONSTRAINT fk_citas_mecanico FOREIGN KEY (id_mecanico) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_citas_estatus_cita FOREIGN KEY (id_estatus_cita) REFERENCES estatus_cita(id_estatus_cita),
    CONSTRAINT fk_citas_estatus_vehiculo FOREIGN KEY (id_estatus_vehiculo) REFERENCES estatus_vehiculo(id_estatus_vehiculo)
);

-- 7. Tabla: seguimiento_vehiculo
CREATE TABLE seguimiento_vehiculo (
    id_seguimiento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cita INT UNSIGNED NOT NULL,
    id_estatus_vehiculo INT UNSIGNED NOT NULL,
    id_usuario INT UNSIGNED NOT NULL,
    comentario VARCHAR(255) NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_seguimiento_citas FOREIGN KEY (id_cita) REFERENCES citas(id_cita) ON DELETE CASCADE,
    CONSTRAINT fk_seguimiento_estatus FOREIGN KEY (id_estatus_vehiculo) REFERENCES estatus_vehiculo(id_estatus_vehiculo),
    CONSTRAINT fk_seguimiento_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- 8. Tabla: resenas (Relación 1:1 con citas gracias a UNIQUE en id_cita)
CREATE TABLE resenas (
    id_resena INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cita INT UNSIGNED NOT NULL UNIQUE,
    calificacion TINYINT UNSIGNED NOT NULL,
    comentario VARCHAR(255) NULL,
    visible TINYINT UNSIGNED NOT NULL DEFAULT 1,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resenas_citas FOREIGN KEY (id_cita) REFERENCES citas(id_cita) ON DELETE CASCADE,
    CONSTRAINT chk_calificacion CHECK (calificacion BETWEEN 1 AND 5)
);

-- 9. Tabla: categorias_servicio
CREATE TABLE categorias_servicio (
    id_categoria INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- 10. Tabla: servicios
CREATE TABLE servicios (
    id_servicio INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_categoria INT UNSIGNED NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255) NULL,
    precio DECIMAL(10,2) NOT NULL,
    duracion_min INT UNSIGNED NOT NULL,
    activo TINYINT UNSIGNED NOT NULL DEFAULT 1,
    CONSTRAINT fk_servicios_categoria FOREIGN KEY (id_categoria) REFERENCES categorias_servicio(id_categoria),
    CONSTRAINT chk_precio_servicio CHECK (precio >= 0),
    CONSTRAINT chk_duracion_servicio CHECK (duracion_min > 0)
);

-- 11. Tabla intermedia: cita_servicios
CREATE TABLE cita_servicios (
    id_cita INT UNSIGNED NOT NULL,
    id_servicio INT UNSIGNED NOT NULL,
    precio_aplicado DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_cita, id_servicio),
    CONSTRAINT fk_cita_servicios_cita FOREIGN KEY (id_cita) REFERENCES citas(id_cita) ON DELETE CASCADE,
    CONSTRAINT fk_cita_servicios_servicio FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-- 12. Tabla: inventario
CREATE TABLE inventario (
    id_producto INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    cantidad INT UNSIGNED NOT NULL DEFAULT 0,
    stock_minimo INT UNSIGNED NOT NULL DEFAULT 5,
    costo DECIMAL(10,2) NOT NULL,
    activo TINYINT UNSIGNED NOT NULL DEFAULT 1,
    CONSTRAINT chk_costo_inventario CHECK (costo > 0)
);

-- 13. Tabla: refacciones
CREATE TABLE refacciones (
    id_refaccion INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cita INT UNSIGNED NOT NULL,
    id_producto INT UNSIGNED NULL,
    descripcion VARCHAR(150) NOT NULL,
    cantidad INT UNSIGNED NOT NULL DEFAULT 1,
    costo DECIMAL(10,2) NOT NULL,
    aprobada TINYINT UNSIGNED NULL DEFAULT NULL, -- NULL = Pendiente, 1 = Aprobada, 0 = Rechazada
    CONSTRAINT fk_refacciones_cita FOREIGN KEY (id_cita) REFERENCES citas(id_cita) ON DELETE CASCADE,
    CONSTRAINT fk_refacciones_producto FOREIGN KEY (id_producto) REFERENCES inventario(id_producto),
    CONSTRAINT chk_cantidad_refaccion CHECK (cantidad > 0),
    CONSTRAINT chk_costo_refaccion CHECK (costo >= 0)
);

-- 14. Tabla: horarios
CREATE TABLE horarios (
    id_horario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dia_semana TINYINT UNSIGNED NULL UNIQUE,
    fecha_especial DATE NULL UNIQUE,
    hora_apertura TIME NULL,
    hora_cierre TIME NULL,
    cerrado TINYINT UNSIGNED NOT NULL DEFAULT 0,
    capacidad INT UNSIGNED NOT NULL DEFAULT 3,
    descripcion VARCHAR(100) NULL,
    CONSTRAINT chk_dia_semana CHECK (dia_semana IS NULL OR dia_semana BETWEEN 1 AND 7)
);

-- 15. Tabla: contacto_taller
CREATE TABLE contacto_taller (
    id_contacto INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    telefono CHAR(10) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    facebook_url VARCHAR(255) NULL,
    maps_url VARCHAR(500) NULL
);

-- =========================================================================
-- SECCIÓN 2: DATOS SEMILLA (MOCKS PARA VER LAS PANTALLAS CON DATOS)
-- =========================================================================

INSERT INTO roles (nombre) VALUES ('Cliente'), ('Mecanico'), ('Administrador');
INSERT INTO estatus_cita (nombre) VALUES ('Pendiente'), ('Confirmada'), ('Cancelada');
INSERT INTO estatus_vehiculo (nombre) VALUES 
('Recibido'), ('En diagnóstico'), ('Esperando refacción'), 
('En reparación'), ('Listo para entrega'), ('Entregado');

INSERT INTO usuarios (nombre, apellidos, email, password_hash, telefono, id_rol, especialidad, fecha_contratacion) VALUES
('Ana', 'Cliente Demo', 'ana.demo@example.com', '123456', '8110000001', 1, NULL, NULL),
('Carlos', 'Garza Cliente', 'carlos@example.com', '123456', '8110000004', 1, NULL, NULL),
('Luis', 'Mecánico Demo', 'luis.demo@example.com', '123456', '8110000002', 2, 'Mecánica general y frenos', '2025-01-15'),
('Roberto', 'Técnico Especialista', 'roberto.mec@example.com', '123456', '8110000005', 2, 'Suspensión y transmisión', '2025-03-10'),
('Admin', 'Demo FIME', 'admin.demo@example.com', '123456', '8110000003', 3, NULL, NULL);

INSERT INTO vehiculos (id_usuario, marca, modelo, anio, placas, color) VALUES
(1, 'Nissan', 'Versa', 2021, 'SRT-452-A', 'Blanco'),
(1, 'Mazda', 'Mazda 3', 2023, 'RKP-991-B', 'Rojo'),
(2, 'Chevrolet', 'Aveo', 2019, 'MNL-112-C', 'Gris');

INSERT INTO categorias_servicio (nombre) VALUES 
('Mantenimiento Preventivo'), ('Frenos y Suspensión'), ('Motor y Diagnóstico'), ('Aire Acondicionado');

INSERT INTO servicios (id_categoria, nombre, descripcion, precio, duracion_min) VALUES
(1, 'Afinación Mayor', 'Cambio de aceite sintético, filtros, bujías y limpieza de inyectores', 1850.00, 120),
(1, 'Cambio de Aceite y Filtro', 'Reemplazo de aceite multigrado y filtro nuevo', 750.00, 45),
(2, 'Reemplazo de Balatas Delanteras', 'Cambio de juego de balatas cerámicas y rectificado de discos', 1200.00, 90),
(2, 'Alineación y Balanceo', 'Alineación por computadora en 4 ruedas y balanceo', 650.00, 60),
(3, 'Escaneo por Computadora (OBD2)', 'Lectura de códigos de falla y diagnóstico electrónico', 450.00, 30),
(4, 'Recarga de Gas Refrigerante', 'Detección de fugas por vacío y carga de gas R134a', 890.00, 60);

INSERT INTO inventario (nombre, cantidad, stock_minimo, costo) VALUES
('Garrafa Aceite Sintético 5W-30 (5L)', 15, 5, 620.00),
('Juego de Balatas Cerámicas Delanteras', 4, 5, 580.00),
('Filtro de Aire de Motor Universal', 12, 4, 180.00),
('Bujía de Iridio NGK (Pieza)', 0, 8, 210.00),
('Batería Automotriz 12V LTH', 3, 4, 2450.00),
('Líquido de Frenos DOT 4 (500ml)', 9, 3, 145.00);

INSERT INTO horarios (dia_semana, fecha_especial, hora_apertura, hora_cierre, cerrado, capacidad, descripcion) VALUES
(1, NULL, '08:00:00', '18:00:00', 0, 3, 'Lunes'),
(2, NULL, '08:00:00', '18:00:00', 0, 3, 'Martes'),
(3, NULL, '08:00:00', '18:00:00', 0, 3, 'Miércoles'),
(4, NULL, '08:00:00', '18:00:00', 0, 3, 'Jueves'),
(5, NULL, '08:00:00', '18:00:00', 0, 3, 'Viernes'),
(6, NULL, '09:00:00', '14:00:00', 0, 2, 'Sábado'),
(7, NULL, NULL, NULL, 1, 0, 'Domingo Cerrado'),
(NULL, '2026-11-16', NULL, NULL, 1, 0, 'Día Festivo Revolución Mexicana');

INSERT INTO contacto_taller (telefono, correo, direccion, facebook_url, maps_url) VALUES
('8183294000', 'contacto@tallermecanicofime.com', 'Av. Universidad S/N, Ciudad Universitaria, San Nicolás de los Garza, N.L.', 'https://facebook.com/TallerFIME', 'https://maps.google.com/?q=FIME+UANL');

INSERT INTO citas (id_cliente, id_vehiculo, id_mecanico, id_estatus_cita, id_estatus_vehiculo, fecha_hora, observaciones, llamada_solicitada) VALUES
(1, 1, 3, 2, 6, '2026-11-10 10:00:00', 'Cita de demostración entregada', 0),
(1, 2, 3, 2, 3, '2026-11-14 11:00:00', 'Ruido al frenar en seco', 1),
(2, 3, 4, 1, 1, '2026-11-15 09:00:00', 'Check engine encendido', 0);

INSERT INTO cita_servicios (id_cita, id_servicio, precio_aplicado) VALUES
(1, 1, 1850.00),
(2, 3, 1200.00),
(3, 5, 450.00);

INSERT INTO seguimiento_vehiculo (id_cita, id_estatus_vehiculo, id_usuario, comentario, fecha_hora) VALUES
(1, 1, 3, 'Vehículo recibido en recepción sin golpes.', '2026-11-10 10:05:00'),
(1, 4, 3, 'Iniciando afinación mayor y cambio de filtros.', '2026-11-10 10:40:00'),
(1, 6, 3, 'Servicio concluido y vehículo entregado al cliente.', '2026-11-10 12:30:00'),
(2, 1, 3, 'Vehículo ingresado a rampa.', '2026-11-14 11:05:00'),
(2, 2, 3, 'Discos delanteros con desgaste; requiere balatas nuevas.', '2026-11-14 11:30:00'),
(2, 3, 3, 'Se cotizó juego de balatas y líquido de frenos; esperando aprobación del cliente.', '2026-11-14 11:45:00');

INSERT INTO refacciones (id_cita, id_producto, descripcion, cantidad, costo, aprobada) VALUES
(1, 1, 'Garrafa Aceite Sintético 5W-30 (5L)', 1, 620.00, 1),
(2, 2, 'Juego de Balatas Cerámicas Delanteras', 1, 580.00, NULL),
(2, 6, 'Líquido de Frenos DOT 4 (500ml)', 1, 145.00, 1);

INSERT INTO resenas (id_cita, calificacion, comentario, visible) VALUES
(1, 5, 'Excelente servicio, mi Nissan Versa quedó como nuevo y me entregaron a tiempo.', 1);

-- =========================================================================
-- SECCIÓN 3: LAS 18 PANTALLAS DEL SISTEMA CREADAS COMO VISTAS SQL (VIEWS)
-- (Cada pantalla se puede abrir directamente en MySQL Workbench con SELECT)
-- =========================================================================

-- PANTALLA 1: Inicio y Servicios Más Solicitados
CREATE OR REPLACE VIEW v_pantalla_01_inicio AS
SELECT 
    s.id_servicio,
    s.nombre AS servicio,
    c.nombre AS categoria,
    s.precio,
    COUNT(cs.id_cita) AS veces_solicitado
FROM servicios s
JOIN categorias_servicio c ON s.id_categoria = c.id_categoria
LEFT JOIN cita_servicios cs ON s.id_servicio = cs.id_servicio
WHERE s.activo = 1
GROUP BY s.id_servicio
ORDER BY veces_solicitado DESC;

-- PANTALLA 2: Catálogo Público de Servicios
CREATE OR REPLACE VIEW v_pantalla_02_catalogo_servicios AS
SELECT 
    s.id_servicio AS ID,
    c.nombre AS Categoria,
    s.nombre AS Servicio,
    s.descripcion AS Descripcion,
    CONCAT('$', FORMAT(s.precio, 2)) AS Precio,
    CONCAT(s.duracion_min, ' min') AS Duracion_Estimada
FROM servicios s
JOIN categorias_servicio c ON s.id_categoria = c.id_categoria
WHERE s.activo = 1;

-- PANTALLA 3: Contacto y Horarios del Taller (Pie de página y pantalla Contacto)
CREATE OR REPLACE VIEW v_pantalla_03_contacto_horarios AS
SELECT 
    ct.telefono AS Telefono_Taller,
    ct.correo AS Correo_Electronico,
    ct.direccion AS Direccion,
    ct.facebook_url AS Facebook,
    ct.maps_url AS Google_Maps,
    h.descripcion AS Dia,
    IF(h.cerrado = 1, 'CERRADO', CONCAT(h.hora_apertura, ' - ', h.hora_cierre)) AS Horario_Atencion,
    h.capacidad AS Capacidad_Simultanea
FROM contacto_taller ct
CROSS JOIN horarios h;

-- PANTALLA 4: Directorio de Usuarios y Roles (Validación Login / Registro)
CREATE OR REPLACE VIEW v_pantalla_04_login_usuarios AS
SELECT 
    u.id_usuario AS ID,
    CONCAT(u.nombre, ' ', u.apellidos) AS Nombre_Completo,
    u.email AS Correo_Login,
    r.nombre AS Rol_Sistema,
    u.telefono AS Telefono,
    IF(u.activo = 1, 'Activo', 'Inactivo') AS Estatus_Cuenta
FROM usuarios u
JOIN roles r ON u.id_rol = r.id_rol;

-- PANTALLA 5: Mis Vehículos (Panel del Cliente)
CREATE OR REPLACE VIEW v_pantalla_05_cliente_vehiculos AS
SELECT 
    v.id_vehiculo AS ID_Vehiculo,
    CONCAT(u.nombre, ' ', u.apellidos) AS Propietario,
    v.marca AS Marca,
    v.modelo AS Modelo,
    v.anio AS Anio,
    v.placas AS Placas,
    v.color AS Color,
    IF(v.activo = 1, 'Activo', 'Baja Lógica') AS Estado
FROM vehiculos v
JOIN usuarios u ON v.id_usuario = u.id_usuario
WHERE v.activo = 1;

-- PANTALLA 6: Mis Citas Agendadas (Panel del Cliente)
CREATE OR REPLACE VIEW v_pantalla_06_cliente_citas AS
SELECT 
    c.id_cita AS Folio_Cita,
    CONCAT(cli.nombre, ' ', cli.apellidos) AS Cliente,
    CONCAT(v.marca, ' ', v.modelo, ' (', v.placas, ')') AS Vehiculo,
    c.fecha_hora AS Fecha_Hora_Cita,
    ec.nombre AS Estatus_Cita,
    ev.nombre AS Estatus_Actual_Vehiculo,
    IF(c.llamada_solicitada = 1, 'Sí requiere llamada', 'No') AS Llamada_Aclaratoria,
    c.observaciones AS Observaciones_Cliente
FROM citas c
JOIN usuarios cli ON c.id_cliente = cli.id_usuario
JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo
JOIN estatus_cita ec ON c.id_estatus_cita = ec.id_estatus_cita
LEFT JOIN estatus_vehiculo ev ON c.id_estatus_vehiculo = ev.id_estatus_vehiculo;

-- PANTALLA 7: Seguimiento del Vehículo en Tiempo Real (Línea de Tiempo)
CREATE OR REPLACE VIEW v_pantalla_07_seguimiento_tiempo_real AS
SELECT 
    sv.id_cita AS Folio_Cita,
    CONCAT(v.marca, ' ', v.modelo, ' - ', v.placas) AS Vehiculo,
    ev.nombre AS Etapa_Reparacion,
    sv.comentario AS Detalle_Tecnico,
    CONCAT(u.nombre, ' ', u.apellidos) AS Registrado_Por,
    sv.fecha_hora AS Fecha_Hora_Registro
FROM seguimiento_vehiculo sv
JOIN citas c ON sv.id_cita = c.id_cita
JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo
JOIN estatus_vehiculo ev ON sv.id_estatus_vehiculo = ev.id_estatus_vehiculo
JOIN usuarios u ON sv.id_usuario = u.id_usuario
ORDER BY sv.id_cita ASC, sv.fecha_hora ASC;

-- PANTALLA 8: Presupuesto y Aprobación de Cargos Adicionales (Cliente)
CREATE OR REPLACE VIEW v_pantalla_08_presupuesto_cliente AS
SELECT 
    c.id_cita AS Folio_Cita,
    CONCAT(cli.nombre, ' ', cli.apellidos) AS Cliente,
    CONCAT(v.marca, ' ', v.modelo) AS Vehiculo,
    IFNULL((SELECT SUM(cs.precio_aplicado) FROM cita_servicios cs WHERE cs.id_cita = c.id_cita), 0) AS Subtotal_Servicios,
    IFNULL((SELECT SUM(r.cantidad * r.costo) FROM refacciones r WHERE r.id_cita = c.id_cita AND r.aprobada = 1), 0) AS Subtotal_Refacciones_Aprobadas,
    IFNULL((SELECT SUM(r.cantidad * r.costo) FROM refacciones r WHERE r.id_cita = c.id_cita AND r.aprobada IS NULL), 0) AS Cargos_Pendientes_Aprobar,
    (IFNULL((SELECT SUM(cs.precio_aplicado) FROM cita_servicios cs WHERE cs.id_cita = c.id_cita), 0) +
     IFNULL((SELECT SUM(r.cantidad * r.costo) FROM refacciones r WHERE r.id_cita = c.id_cita AND r.aprobada = 1), 0)) AS Total_Autorizado_Pagar
FROM citas c
JOIN usuarios cli ON c.id_cliente = cli.id_usuario
JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo;

-- PANTALLA 9: Detalle de Refacciones por Aprobar/Rechazar (Cliente)
CREATE OR REPLACE VIEW v_pantalla_09_refacciones_detalle AS
SELECT 
    r.id_refaccion AS ID_Cargo,
    r.id_cita AS Folio_Cita,
    r.descripcion AS Concepto_Refaccion,
    r.cantidad AS Cantidad,
    r.costo AS Costo_Unitario,
    (r.cantidad * r.costo) AS Subtotal,
    CASE 
        WHEN r.aprobada IS NULL THEN 'PENDIENTE DE APROBACIÓN'
        WHEN r.aprobada = 1 THEN 'APROBADA POR CLIENTE'
        ELSE 'RECHAZADA'
    END AS Estatus_Aprobacion
FROM refacciones r;

-- PANTALLA 10: Reseñas y Calificaciones del Servicio
CREATE OR REPLACE VIEW v_pantalla_10_resenas_clientes AS
SELECT 
    res.id_resena AS ID_Resena,
    res.id_cita AS Folio_Cita,
    CONCAT(cli.nombre, ' ', cli.apellidos) AS Cliente,
    CONCAT(v.marca, ' ', v.modelo) AS Vehiculo_Atendido,
    CONCAT(res.calificacion, ' / 5 Estrellas') AS Calificacion,
    res.comentario AS Comentario,
    res.fecha AS Fecha_Resena,
    IF(res.visible = 1, 'Pública', 'Oculta por Admin') AS Visibilidad
FROM resenas res
JOIN citas c ON res.id_cita = c.id_cita
JOIN usuarios cli ON c.id_cliente = cli.id_usuario
JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo;

-- PANTALLA 11: Agenda y Órdenes de Trabajo Asignadas al Mecánico
CREATE OR REPLACE VIEW v_pantalla_11_agenda_mecanico AS
SELECT 
    c.id_cita AS Orden_Trabajo,
    CONCAT(mec.nombre, ' ', mec.apellidos) AS Mecanico_Asignado,
    mec.especialidad AS Especialidad,
    c.fecha_hora AS Fecha_Programada,
    CONCAT(v.marca, ' ', v.modelo, ' (', v.placas, ')') AS Vehiculo,
    ev.nombre AS Estado_Reparacion,
    c.observaciones AS Falla_Reportada
FROM citas c
JOIN usuarios mec ON c.id_mecanico = mec.id_usuario
JOIN vehiculos v ON c.id_vehiculo = v.id_vehiculo
LEFT JOIN estatus_vehiculo ev ON c.id_estatus_vehiculo = ev.id_estatus_vehiculo
WHERE c.id_estatus_cita != 3;

-- PANTALLA 12: Administración de Usuarios y Mecánicos (CRUD Admin)
CREATE OR REPLACE VIEW v_pantalla_12_admin_personal AS
SELECT 
    u.id_usuario AS ID,
    r.nombre AS Rol,
    u.nombre AS Nombre,
    u.apellidos AS Apellidos,
    u.email AS Email,
    u.telefono AS Telefono,
    IFNULL(u.especialidad, 'N/A') AS Especialidad_Mecanico,
    IFNULL(u.fecha_contratacion, 'N/A') AS Fecha_Contratacion,
    IF(u.activo = 1, 'Activo', 'Inactivo') AS Estatus
FROM usuarios u
JOIN roles r ON u.id_rol = r.id_rol;

-- PANTALLA 13: Control de Inventario y Alertas de Stock (CRUD Admin)
CREATE OR REPLACE VIEW v_estado_inventario AS
SELECT 
    id_producto,
    nombre,
    cantidad,
    stock_minimo,
    costo,
    activo,
    CASE 
        WHEN cantidad = 0 THEN 'Agotado'
        WHEN cantidad <= stock_minimo THEN 'Stock Bajo'
        ELSE 'Disponible'
    END AS estado_stock
FROM inventario
WHERE activo = 1;

-- PANTALLA 14: Reporte Estadístico Mensual de Ingresos y KPIs (Admin)
CREATE OR REPLACE VIEW v_pantalla_14_reporte_ingresos_mensual AS
SELECT 
    DATE_FORMAT(c.fecha_hora, '%Y-%m') AS Mes_Anio,
    COUNT(DISTINCT c.id_cita) AS Total_Citas_Registradas,
    SUM(IF(c.id_estatus_vehiculo = 6, 1, 0)) AS Vehiculos_Entregados,
    IFNULL((SELECT SUM(cs.precio_aplicado) 
            FROM cita_servicios cs 
            JOIN citas c2 ON cs.id_cita = c2.id_cita 
            WHERE c2.id_estatus_vehiculo = 6 AND DATE_FORMAT(c2.fecha_hora, '%Y-%m') = DATE_FORMAT(c.fecha_hora, '%Y-%m')), 0) AS Ingresos_Por_Servicios,
    IFNULL((SELECT SUM(r.cantidad * r.costo) 
            FROM refacciones r 
            JOIN citas c3 ON r.id_cita = c3.id_cita 
            WHERE c3.id_estatus_vehiculo = 6 AND r.aprobada = 1 AND DATE_FORMAT(c3.fecha_hora, '%Y-%m') = DATE_FORMAT(c.fecha_hora, '%Y-%m')), 0) AS Ingresos_Por_Refacciones_Aprobadas,
    (IFNULL((SELECT SUM(cs.precio_aplicado) 
             FROM cita_servicios cs 
             JOIN citas c2 ON cs.id_cita = c2.id_cita 
             WHERE c2.id_estatus_vehiculo = 6 AND DATE_FORMAT(c2.fecha_hora, '%Y-%m') = DATE_FORMAT(c.fecha_hora, '%Y-%m')), 0) +
     IFNULL((SELECT SUM(r.cantidad * r.costo) 
             FROM refacciones r 
             JOIN citas c3 ON r.id_cita = c3.id_cita 
             WHERE c3.id_estatus_vehiculo = 6 AND r.aprobada = 1 AND DATE_FORMAT(c3.fecha_hora, '%Y-%m') = DATE_FORMAT(c.fecha_hora, '%Y-%m')), 0)) AS Ingreso_Total_Mensual
FROM citas c
GROUP BY DATE_FORMAT(c.fecha_hora, '%Y-%m');

-- PANTALLA 15: Reporte de Rendimiento de Mecánicos (Admin)
CREATE OR REPLACE VIEW v_pantalla_15_rendimiento_mecanicos AS
SELECT 
    u.id_usuario AS ID_Mecanico,
    CONCAT(u.nombre, ' ', u.apellidos) AS Mecanico,
    u.especialidad AS Especialidad,
    COUNT(c.id_cita) AS Total_Citas_Asignadas,
    SUM(IF(c.id_estatus_vehiculo = 6, 1, 0)) AS Ordenes_Concluidas_Entregadas
FROM usuarios u
LEFT JOIN citas c ON u.id_usuario = c.id_mecanico
WHERE u.id_rol = 2
GROUP BY u.id_usuario;

-- =========================================================================
-- SECCIÓN 4: PROCEDIMIENTOS ALMACENADOS (INTERACCIÓN DE LAS PANTALLAS EN SQL)
-- =========================================================================

DELIMITER //

-- Acción Pantalla Cliente: Agendar Cita validando no empalme de vehículo y capacidad
CREATE PROCEDURE sp_agendar_cita(
    IN p_id_cliente INT UNSIGNED,
    IN p_id_vehiculo INT UNSIGNED,
    IN p_id_servicio INT UNSIGNED,
    IN p_fecha_hora DATETIME,
    IN p_observaciones VARCHAR(255),
    IN p_llamada TINYINT UNSIGNED
)
BEGIN
    DECLARE v_empalme INT DEFAULT 0;
    DECLARE v_ocupacion INT DEFAULT 0;
    DECLARE v_precio DECIMAL(10,2);
    DECLARE v_nueva_cita INT UNSIGNED;

    SELECT COUNT(*) INTO v_empalme 
    FROM citas 
    WHERE id_vehiculo = p_id_vehiculo AND fecha_hora = p_fecha_hora AND id_estatus_cita != 3;

    IF v_empalme > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: El vehículo ya tiene una cita activa en esa misma fecha y hora.';
    END IF;

    SELECT COUNT(*) INTO v_ocupacion 
    FROM citas 
    WHERE fecha_hora = p_fecha_hora AND id_estatus_cita != 3;

    IF v_ocupacion >= 3 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Se alcanzó la capacidad máxima del taller para ese bloque de horario.';
    END IF;

    INSERT INTO citas (id_cliente, id_vehiculo, id_estatus_cita, id_estatus_vehiculo, fecha_hora, observaciones, llamada_solicitada)
    VALUES (p_id_cliente, p_id_vehiculo, 1, 1, p_fecha_hora, p_observaciones, p_llamada);

    SET v_nueva_cita = LAST_INSERT_ID();

    SELECT precio INTO v_precio FROM servicios WHERE id_servicio = p_id_servicio;
    INSERT INTO cita_servicios (id_cita, id_servicio, precio_aplicado) VALUES (v_nueva_cita, p_id_servicio, v_precio);

    INSERT INTO seguimiento_vehiculo (id_cita, id_estatus_vehiculo, id_usuario, comentario)
    VALUES (v_nueva_cita, 1, p_id_cliente, 'Cita agendada por el cliente.');
END //

-- Acción Pantalla Mecánico: Cambiar estatus sincronizando citas y seguimiento_vehiculo
CREATE PROCEDURE sp_actualizar_estatus_vehiculo(
    IN p_id_cita INT UNSIGNED,
    IN p_id_estatus_vehiculo INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_comentario VARCHAR(255)
)
BEGIN
    INSERT INTO seguimiento_vehiculo (id_cita, id_estatus_vehiculo, id_usuario, comentario)
    VALUES (p_id_cita, p_id_estatus_vehiculo, p_id_usuario, p_comentario);

    UPDATE citas 
    SET id_estatus_vehiculo = p_id_estatus_vehiculo, id_estatus_cita = 2 
    WHERE id_cita = p_id_cita;
END //

-- Acción Pantalla Cliente: Aprobar o rechazar refacción descontando inventario automáticamente
CREATE PROCEDURE sp_responder_refaccion(
    IN p_id_refaccion INT UNSIGNED,
    IN p_aprobada TINYINT UNSIGNED
)
BEGIN
    DECLARE v_id_prod INT UNSIGNED;
    DECLARE v_cant INT UNSIGNED;
    DECLARE v_stock_actual INT UNSIGNED;
    DECLARE v_estado_previo TINYINT UNSIGNED;

    SELECT id_producto, cantidad, aprobada INTO v_id_prod, v_cant, v_estado_previo
    FROM refacciones WHERE id_refaccion = p_id_refaccion;

    IF p_aprobada = 1 AND v_id_prod IS NOT NULL AND (v_estado_previo IS NULL OR v_estado_previo = 0) THEN
        SELECT cantidad INTO v_stock_actual FROM inventario WHERE id_producto = v_id_prod;
        IF v_stock_actual < v_cant THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Stock insuficiente en inventario para aprobar esta refacción.';
        END IF;
        UPDATE inventario SET cantidad = cantidad - v_cant WHERE id_producto = v_id_prod;
    END IF;

    UPDATE refacciones SET aprobada = p_aprobada WHERE id_refaccion = p_id_refaccion;
END //

DELIMITER ;
