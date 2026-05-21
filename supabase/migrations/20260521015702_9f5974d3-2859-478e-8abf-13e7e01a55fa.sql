UPDATE public.clientes
SET telefono = '+54' || substring(telefono from 5)
WHERE telefono LIKE '+549%';

UPDATE public.turnos
SET cliente_telefono = '+54' || substring(cliente_telefono from 5)
WHERE cliente_telefono LIKE '+549%';