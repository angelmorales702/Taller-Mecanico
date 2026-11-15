-- Ajustes al modelo de la Fase 2 (equivalente manual de `npm run setup`; no hace falta correrlo si ya usaste el setup).
-- Motivo: el registro y el login usan un campo "Usuario" que no existía en la tabla usuarios.
USE taller_mecanico;

ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(30) NULL AFTER apellidos;
UPDATE usuarios SET usuario = 'ana'     WHERE email = 'ana.demo@example.com';
UPDATE usuarios SET usuario = 'carlos'  WHERE email = 'carlos@example.com';
UPDATE usuarios SET usuario = 'luis'    WHERE email = 'luis.demo@example.com';
UPDATE usuarios SET usuario = 'roberto' WHERE email = 'roberto.mec@example.com';
UPDATE usuarios SET usuario = 'admin'   WHERE email = 'admin.demo@example.com';
ALTER TABLE usuarios MODIFY usuario VARCHAR(30) NOT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY uq_usuarios_usuario (usuario);
-- Las contraseñas se cifran con bcrypt desde Node (npm run setup).
