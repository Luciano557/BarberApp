

## Plan actualizado: Bono Fijo en Extras de Compensacion (V2)

Todo lo definido en el plan anterior se mantiene. Se agregan dos puntos.

---

### Ajuste 1: Indice unico parcial en base de datos

Agregar en la migracion de `bono_fijo_config` un indice unico parcial que impida mas de un bono activo por empleado:

```sql
CREATE UNIQUE INDEX uq_bono_fijo_activo_por_barbero
  ON bono_fijo_config (barbero_id)
  WHERE (activa = true);
```

Esto garantiza a nivel de base de datos que nunca puedan existir dos registros con `activa = true` para el mismo `barbero_id`, sin importar lo que haga el frontend. Las configuraciones historicas con `activa = false` no se ven afectadas.

El frontend sigue haciendo la validacion previa (query antes de insert) como cortesia UX, pero la proteccion real es el indice.

### Ajuste 2: Generacion retroactiva explicita de ocurrencias pendientes

La logica de generacion de ocurrencias en `SueldosPanel.tsx` debe contemplar explicitamente el caso de multiples ocurrencias atrasadas.

Comportamiento:

1. Al abrir Sueldos, se consultan todas las `bono_fijo_config` activas de la organizacion donde `proxima_fecha <= hoy`
2. Para cada config pendiente, se ejecuta un loop:
   - Mientras `proxima_fecha <= min(hoy, fecha_fin ?? '9999-12-31')`:
     - Insertar ocurrencia en `bono_fijo_ocurrencias` con `fecha = proxima_fecha` y `monto = config.monto`
     - Avanzar `proxima_fecha` usando `calcNextDate`
   - Actualizar `proxima_fecha` en la config
3. Despues del sync, se fetchean las ocurrencias para calcular saldos

Ejemplo: bono de $20.000 todos los lunes, no se abrio Sueldos por 3 semanas. Al abrir, el loop genera 3 ocurrencias (una por cada lunes pasado), cada una con su fecha real, y el saldo refleja +$60.000.

Proteccion contra duplicados: el indice unico `(config_id, fecha)` ya definido en el plan original previene que se inserten dos ocurrencias para la misma config y fecha. Se usa upsert o insert con `ON CONFLICT DO NOTHING`.

### Todo lo demas se mantiene sin cambios

- Tablas `bono_fijo_config` y `bono_fijo_ocurrencias` con RLS
- Recurrencia reutilizando `RepeatPicker`, `CustomRepeatSheet` y `calcNextDate`
- Un solo bono activo por empleado (ahora blindado por indice)
- Cambio de bono: cierra anterior (`activa = false`, `fecha_fin = hoy - 1`), crea nuevo
- Baja sin borrar historial
- Ocurrencias suman al saldo general unico
- Desglose individual en vista ampliada de Sueldos
- UI en perfil del empleado dentro de Extras de compensacion

### Archivos a crear/modificar

| Archivo | Accion |
|---|---|
| Migracion SQL | Crear tablas, indice unico parcial, indice de duplicados, RLS |
| `src/components/config/BonoFijoConfig.tsx` | Nuevo: UI config del bono por empleado |
| `src/components/config/ExtrasCompensacion.tsx` | Habilitar bono fijo en selector |
| `src/components/SueldosPanel.tsx` | Sync retroactivo de ocurrencias + fetch + calculo + desglose |

