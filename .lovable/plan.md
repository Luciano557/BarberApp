

## Soporte para tipo de pago (comisión vs. fijo) y cargo "Otros"

### Implementado

1. **Migración DB**: Agregados `tipo_compensacion` (text, default 'comision') y `sueldo_fijo` (numeric) a tabla `barberos`. Agregado valor `otros` al enum `app_role`.

2. **Tipo `Barber`**: Nuevos campos `compensationType: 'comision' | 'fijo'` y `fixedSalary?: number`.

3. **Formulario de equipo (EquipoUnificado)**: Selector de tipo de compensación (comisión % o sueldo fijo $). Muestra campo dinámico según selección. Badge de display actualizado.

4. **Cargo "Otros"**: Nuevo rol sin permisos, disponible para asignar en el selector de cargos.

5. **Labels renombrados**: "Barbero" → "Empleado" en SueldosPanel (selector de pago, tabla resumen, historial).

6. **Persistencia**: `useSupabaseData`, `MiNegocioPanel` actualizados para leer/escribir los nuevos campos.

### Pendiente (futuras iteraciones)
- Lógica de devengado proporcional para empleados con sueldo fijo en SueldosPanel
- Clasificación automática de sueldos fijos vs comisiones en GastosPanel
- Tabla separada de "empleados generales" no-barberos
