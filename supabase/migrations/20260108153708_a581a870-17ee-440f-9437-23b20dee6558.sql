
-- Insertar ventas simuladas de hace 3 días
INSERT INTO venta (barbero_id, barbero_nombre, servicio_id, servicio_nombre, precio_servicio, descuento_pct, metodo_pago, total_final, fecha_hora) VALUES
-- Carlos González - 4 servicios
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'efectivo', 5000, NOW() - INTERVAL '3 days' + INTERVAL '9 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'mercado_pago', 7500, NOW() - INTERVAL '3 days' + INTERVAL '11 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 20, 'efectivo', 4800, NOW() - INTERVAL '3 days' + INTERVAL '14 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 0, 'mercado_pago', 3000, NOW() - INTERVAL '3 days' + INTERVAL '16 hours'),
-- Miguel Rodríguez - 3 servicios
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'efectivo', 5000, NOW() - INTERVAL '3 days' + INTERVAL '10 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'b84110c3-3844-4bb3-92fc-750b73d73a98', 'Afeitado Navaja', 4000, 0, 'efectivo', 4000, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'mercado_pago', 7500, NOW() - INTERVAL '3 days' + INTERVAL '15 hours'),
-- Juan Pérez - 3 servicios
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 0, 'mercado_pago', 6000, NOW() - INTERVAL '3 days' + INTERVAL '10 hours' + INTERVAL '30 minutes'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 50, 'efectivo', 2500, NOW() - INTERVAL '3 days' + INTERVAL '13 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 0, 'efectivo', 3000, NOW() - INTERVAL '3 days' + INTERVAL '17 hours');

-- Insertar ventas simuladas de hace 2 días
INSERT INTO venta (barbero_id, barbero_nombre, servicio_id, servicio_nombre, precio_servicio, descuento_pct, metodo_pago, total_final, fecha_hora) VALUES
-- Carlos González - 5 servicios
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'efectivo', 7500, NOW() - INTERVAL '2 days' + INTERVAL '9 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'mercado_pago', 5000, NOW() - INTERVAL '2 days' + INTERVAL '10 hours' + INTERVAL '30 minutes'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 0, 'efectivo', 6000, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'b84110c3-3844-4bb3-92fc-750b73d73a98', 'Afeitado Navaja', 4000, 20, 'mercado_pago', 3200, NOW() - INTERVAL '2 days' + INTERVAL '14 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 0, 'efectivo', 3000, NOW() - INTERVAL '2 days' + INTERVAL '16 hours'),
-- Miguel Rodríguez - 4 servicios
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 0, 'efectivo', 6000, NOW() - INTERVAL '2 days' + INTERVAL '9 hours' + INTERVAL '30 minutes'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'mercado_pago', 7500, NOW() - INTERVAL '2 days' + INTERVAL '11 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'efectivo', 5000, NOW() - INTERVAL '2 days' + INTERVAL '13 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 50, 'mercado_pago', 1500, NOW() - INTERVAL '2 days' + INTERVAL '15 hours'),
-- Juan Pérez - 4 servicios
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'efectivo', 5000, NOW() - INTERVAL '2 days' + INTERVAL '10 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'b84110c3-3844-4bb3-92fc-750b73d73a98', 'Afeitado Navaja', 4000, 0, 'mercado_pago', 4000, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'efectivo', 7500, NOW() - INTERVAL '2 days' + INTERVAL '14 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 20, 'mercado_pago', 4800, NOW() - INTERVAL '2 days' + INTERVAL '17 hours');

-- Insertar ventas simuladas de ayer
INSERT INTO venta (barbero_id, barbero_nombre, servicio_id, servicio_nombre, precio_servicio, descuento_pct, metodo_pago, total_final, fecha_hora) VALUES
-- Carlos González - 3 servicios
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'mercado_pago', 5000, NOW() - INTERVAL '1 day' + INTERVAL '10 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 0, 'efectivo', 6000, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
('5883955a-591b-4c18-9a6c-5f2bd6a86ac9', 'Carlos González', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'mercado_pago', 7500, NOW() - INTERVAL '1 day' + INTERVAL '15 hours'),
-- Miguel Rodríguez - 5 servicios
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 0, 'efectivo', 7500, NOW() - INTERVAL '1 day' + INTERVAL '9 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 20, 'mercado_pago', 4000, NOW() - INTERVAL '1 day' + INTERVAL '11 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 0, 'efectivo', 3000, NOW() - INTERVAL '1 day' + INTERVAL '13 hours'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', 'b84110c3-3844-4bb3-92fc-750b73d73a98', 'Afeitado Navaja', 4000, 0, 'mercado_pago', 4000, NOW() - INTERVAL '1 day' + INTERVAL '14 hours' + INTERVAL '30 minutes'),
('238ea34e-779c-42b4-b812-64d8cbfd4520', 'Miguel Rodríguez', '0cd1ee0c-e83c-44fb-9c93-e0d140d73d96', 'Corte Degradé', 6000, 0, 'efectivo', 6000, NOW() - INTERVAL '1 day' + INTERVAL '17 hours'),
-- Juan Pérez - 4 servicios
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'fc5d6bfd-a83f-44a7-a488-fe948f7f450e', 'Barba', 3000, 0, 'efectivo', 3000, NOW() - INTERVAL '1 day' + INTERVAL '9 hours' + INTERVAL '30 minutes'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', '37557400-09a4-48df-8a47-d00ac90cab65', 'Corte + Barba', 7500, 50, 'mercado_pago', 3750, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'ba493af6-8cc9-460d-96b9-54d1b99e8b6f', 'Corte Clásico', 5000, 0, 'efectivo', 5000, NOW() - INTERVAL '1 day' + INTERVAL '14 hours'),
('d371a1cb-a28a-4b58-8609-e1c3a0f231da', 'Juan Pérez', 'b84110c3-3844-4bb3-92fc-750b73d73a98', 'Afeitado Navaja', 4000, 0, 'mercado_pago', 4000, NOW() - INTERVAL '1 day' + INTERVAL '16 hours');

-- Ahora agregar extras a algunas ventas (usando subqueries para obtener los IDs de las ventas recién insertadas)
-- Esto lo haremos con un enfoque diferente: primero obtenemos algunos venta_id y luego insertamos extras

-- Insertar extras para ventas de hace 3 días (aproximadamente 30% de las ventas tienen extras)
INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, 'c167aeab-31fc-40c0-abb9-b11cd38f502c', 'Cejas', 1000, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '3 days' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW() - INTERVAL '2 days'
  AND v.servicio_nombre IN ('Corte Clásico', 'Corte Degradé')
LIMIT 3;

INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, '94ca2023-2ba4-4f65-bb44-239ac156f5c3', 'Lavado', 1500, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '3 days' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW() - INTERVAL '2 days'
  AND v.servicio_nombre = 'Corte + Barba'
LIMIT 2;

-- Insertar extras para ventas de hace 2 días
INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, '733a14fd-e0f6-452c-bba5-15753b7a12d6', 'Producto Styling', 2000, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '2 days' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW() - INTERVAL '1 day'
  AND v.servicio_nombre IN ('Corte Clásico', 'Corte Degradé', 'Corte + Barba')
LIMIT 4;

INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, '58101ea7-5536-40ee-85b3-cb69e05222ab', 'Tratamiento Capilar', 3000, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '2 days' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW() - INTERVAL '1 day'
  AND v.servicio_nombre = 'Corte + Barba'
LIMIT 2;

-- Insertar extras para ventas de ayer
INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, 'c167aeab-31fc-40c0-abb9-b11cd38f502c', 'Cejas', 1000, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '1 day' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW()
  AND v.servicio_nombre IN ('Corte Clásico', 'Barba')
LIMIT 3;

INSERT INTO venta_extra (venta_id, extra_id, extra_nombre, precio_extra, cantidad)
SELECT v.id, '94ca2023-2ba4-4f65-bb44-239ac156f5c3', 'Lavado', 1500, 1
FROM venta v
WHERE v.fecha_hora >= NOW() - INTERVAL '1 day' - INTERVAL '1 hour'
  AND v.fecha_hora < NOW()
  AND v.servicio_nombre LIKE 'Corte%'
LIMIT 3;
