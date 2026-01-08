-- Insertar barberos de ejemplo
INSERT INTO public.barberos (nombre, apellido, telefono, dni, comision, activo) VALUES
('Carlos', 'González', '1155667788', '30123456', 40, true),
('Miguel', 'Rodríguez', '1144556677', '31234567', 35, true),
('Juan', 'Pérez', '1133445566', '32345678', 45, true);

-- Insertar servicios de ejemplo
INSERT INTO public.servicios (nombre, precio, activo) VALUES
('Corte Clásico', 5000, true),
('Corte + Barba', 7500, true),
('Barba', 3000, true),
('Corte Degradé', 6000, true),
('Afeitado Navaja', 4000, true);

-- Insertar extras de ejemplo
INSERT INTO public.extras (nombre, precio, activo) VALUES
('Cejas', 1000, true),
('Lavado', 1500, true),
('Producto Styling', 2000, true),
('Tratamiento Capilar', 3000, true);