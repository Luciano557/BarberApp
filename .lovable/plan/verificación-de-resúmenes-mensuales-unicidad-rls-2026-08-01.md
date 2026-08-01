# Verificación de resúmenes mensuales (unicidad + RLS)

Solo SQL. No se toca `src/`, ni la migración aplicada, ni se crean funciones. Al final se borra el dato de prueba.

## Datos elegidos (ya verificados en la base)

- Organización: `00000000-0000-0000-0000-000000000001`
- Sucursal: `ca6babf5-4d85-44c3-86b7-f8cd2c25a4da`
- Owner con esa sucursal asignada: `7f4295d6-86c6-4f00-a550-ba5b1aa9c82b`
- Barbero de la misma organización y sucursal: `99acebde-9971-46b3-9cc3-1763fa412916`

Nota: en la base no existe ningún usuario con cargo `manager`, así que la Prueba 2 se hace con el cargo `barber` (mismo resultado esperado: 0 filas).

## Política actual (leída de la base)

`resumenes_mensuales` solo tiene una política de lectura para `authenticated`: misma organización + cargo `owner` o `general_manager` + sucursal asignada al usuario. No hay política de escritura desde el cliente.

## Pruebas a ejecutar

1. **Unicidad**: insertar una fila ficticia (mes `2000-01-01`, valores en cero) y luego intentar una segunda fila con la misma organización + sucursal + mes. Se reporta el mensaje de error exacto.
2. **Sin permiso**: dentro de una transacción, fijar el rol `authenticated` y el usuario barbero, y hacer `SELECT` sobre la tabla. Esperado: 0 filas.
3. **Con permiso**: misma mecánica con el usuario owner. Esperado: 1 fila (la de prueba).

Las pruebas 2 y 3 se hacen simulando el contexto de autenticación con `set_config('request.jwt.claims', ...)` y `set local role authenticated` dentro de una transacción, sin crear usuarios nuevos.

## Limpieza

Borrado explícito de la fila de prueba (mes `2000-01-01`) y verificación de que la tabla queda con 0 filas de prueba.

## Reporte final

Resultado de cada prueba (pasó/falló con detalle), confirmación del borrado y cualquier hallazgo inesperado.
