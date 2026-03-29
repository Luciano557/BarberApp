

## Correcciones para empleados con cargo "Otros"

### Problemas identificados

1. **Empleados "otros" aparecen como barberos en Cobrar**: En `PaymentRegistration.tsx`, se muestran todos los `barbers` sin filtrar por tipo. Agus Community (cargo "otros") no debería aparecer como opción para asignarle un corte.

2. **PIN e Invitar disponibles para "otros"**: En `EquipoUnificado.tsx`, los botones "Configurar PIN" e "Invitar" se muestran para todos los empleados, incluyendo los de cargo "otros", que no tienen acceso a nada en la app.

3. **SueldosPanel no muestra a Agus**: Probablemente porque `barbers` se filtra solo por `active` pero el problema real es que el empleado con cargo "otros" no tiene cierres (ingresos) ni pagos, y puede no estar apareciendo en la lista del selector.

### Plan de cambios

**1. Filtrar empleados "otros" del flujo de cobro (`PaymentRegistration.tsx`)**
- En `Index.tsx`, al pasar `barbers` a `PaymentRegistration`, filtrar para excluir empleados cuyo `compensationType === 'fijo'` que tengan rol "otros". O mejor: no pasar empleados que no sean barberos.
- Enfoque más limpio: agregar una propiedad al tipo `Barber` que indique si es "operativo" (puede recibir cortes) o no. Pero dado que el cargo se guarda en `user_roles` y no en `barberos`, necesitamos filtrar desde donde se tiene esa info.
- **Solución pragmática**: Filtrar en `PaymentRegistration.tsx` — solo mostrar barberos que NO tengan `compensationType === 'fijo'` como criterio. Pero esto no es correcto porque alguien con sueldo fijo podría ser barbero.
- **Mejor solución**: Necesitamos saber el "cargo" del empleado. El cargo se define en `user_roles` pero no todos los empleados tienen usuario vinculado. Agregar un campo `cargo` o `rol_equipo` a la tabla `barberos` para diferenciar sin depender de `user_roles`.

**Solución elegida**: Agregar columna `rol_equipo` (text, default `'barbero'`) a la tabla `barberos` con valores posibles: `barbero`, `otros`. Esto permite filtrar directamente.

**Archivos a modificar:**

1. **Migración SQL**: `ALTER TABLE barberos ADD COLUMN rol_equipo text NOT NULL DEFAULT 'barbero'`
2. **`src/types/barbershop.ts`**: Agregar `teamRole: 'barbero' | 'otros'` al tipo `Barber`
3. **`src/hooks/useSupabaseData.ts`**: Mapear `rol_equipo` ↔ `teamRole`
4. **`src/components/MiNegocioPanel.tsx`**: Mapear `rol_equipo` en add/update
5. **`src/components/config/EquipoUnificado.tsx`**:
   - Al crear/editar un empleado, sincronizar el cargo seleccionado con `rol_equipo`
   - Ocultar botones "Configurar PIN" e "Invitar" para empleados con `rol_equipo === 'otros'`
6. **`src/pages/Index.tsx`**: Filtrar `barbers` pasados a `PaymentRegistration` para excluir `teamRole === 'otros'`
7. **`src/components/SueldosPanel.tsx`**: Asegurar que todos los empleados activos aparezcan en el selector (incluidos los "otros" para poder registrarles pagos)

### Resultado
- Empleados con cargo "Otros" no aparecerán en el flujo de cobro
- No se les podrá configurar PIN ni invitarlos al sistema
- Sí aparecerán en Sueldos para poder registrar pagos
