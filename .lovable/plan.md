# Plan: Campo "ID de píxel de Meta" en Portal público

## Archivos a modificar (confirmados)

1. `src/hooks/usePortalConfig.ts`
2. `src/components/config/PortalPublicoSection.tsx`

No hay otros archivos involucrados. El gate de permisos (`canManagePortal` en `AgendaManagement.tsx`) ya cubre toda la sección y no se toca; el nuevo campo hereda esa restricción por vivir dentro de la misma sección.

## Dónde ubica el campo

Sección **nueva** "Integraciones" después de "Compartir tu portal" (sección 4), con su propia entrada en la barra de accesos rápida de desktop (`scrollTo('portal-integraciones')`). No va dentro de "Compartir tu portal" porque el píxel no es compartir, es tracking de marketing; una sección propia deja lugar para futuros campos de integración sin mezclar conceptos. Mantiene el mismo encabezado visual de las otras tres (cuadrado `bg-primary/10` + ícono + h2).

Ícono del encabezado: `BarChart` (lucide-react) — tracking/analítica, sobrio y coherente con el resto.

## 1. `src/hooks/usePortalConfig.ts`

### `PortalConfig` interface (línea 12)
Agregar:
```ts
meta_pixel_id: string | null;
```

### `fetch()` — mapeo cuando hay data (línea ~69)
Agregar al objeto `setConfig`:
```ts
meta_pixel_id: d.meta_pixel_id ?? null,
```

### `fetch()` — valores por defecto cuando no hay data (línea ~81)
Agregar a la rama `else`:
```ts
meta_pixel_id: null,
```

### `save()` — payload (línea ~101)
El payload se arma campo por campo (no spread). Hay que agregar la línea de `meta_pixel_id` siguiendo el mismo patrón `updates.X !== undefined ? X : config?.X ?? null`:
```ts
meta_pixel_id: updates.meta_pixel_id !== undefined ? updates.meta_pixel_id : config?.meta_pixel_id ?? null,
```

**Friction con el patrón de guardado actual:** el `upsert` reescribe TODA la fila con el payload completo. Eso significa que al guardar solo el píxel, el payload también lleva los demás campos con su valor actual de `config` (ya cargado). No hay riesgo de pisar datos, pero sí una observación: el campo `meta_pixel_id` hoy NO viaja en el payload, así que cualquier `save()` previo a este cambio enviaría `meta_pixel_id: null` implícitamente (la columna existe pero no se setea en el payload → upsert la deja como está, porque el payload define solo las columnas listadas). En la práctica, como el payload no incluye la columna, el upsert no la toca. Tras el cambio, el payload sí la incluye, con lo cual siempre viaja (null o valor). Eso es lo que queremos.

No hace falta normalizar a null acá: la validación de formato y el trim→null los hace el trigger de DB. Para mantener consistencia y que el `isDirty`/`reset` funcionen prolijamente, la normalización del input (vacío → null, trim) se hace en el `onSubmit` del componente antes de llamar a `save`.

## 2. `src/components/config/PortalPublicoSection.tsx`

### `portalFormSchema` (línea 48)
Agregar campo:
```ts
metaPixelId: z.string()
  .trim()
  .max(20, 'El ID no puede superar los 20 dígitos.')
  .refine((v) => !v || /^\d{10,20}$/.test(v), 'Debe tener entre 10 y 20 dígitos numéricos.')
  .optional()
  .default(''),
```
Espeja la regla de DB (10-20 dígitos). Opcional: vacío es válido.

### `PortalFormValues` (línea 61)
Agregar:
```ts
metaPixelId: string;
```

### `emptyValues` (línea 69)
Agregar:
```ts
metaPixelId: '',
```

### `watch` (línea ~138)
Agregar:
```ts
const watchedMetaPixelId = watch('metaPixelId');
```

### `reset` inicial — seed (línea 125)
Agregar al `reset(...)`:
```ts
metaPixelId: config.meta_pixel_id ?? '',
```

### `onSubmit` — llamada a `save` (línea 278)
Agregar al payload de `save`:
```ts
meta_pixel_id: values.metaPixelId.trim() || null,
```
(el trim→null corre acá para que el stored value quede limpio e `isDirty` se resuelva).

### `reset` post-guardado (línea 297)
Agregar al `reset(...)`:
```ts
metaPixelId: values.metaPixelId,
```

### Barra de accesos (línea ~342)
Agregar cuarto botón `scrollTo('portal-integraciones')` con label "Integraciones".

### Nueva sección UI (después de la sección "Compartir", línea ~651, antes del bloque "Guardado")

Estructura siguiendo el patrón de las otras secciones:

- Encabezado: cuadrado `bg-primary/10` + `BarChart` + h2 "Integraciones".
- Bloque de campo: h4 con ícono (`BarChart`) + label "ID de píxel de Meta (opcional)", texto de ayuda corto debajo, `FormField` con `FormControl` > `Input` (maxLength 20, inputMode numeric, placeholder "1234567890123456789"), y `FormMessage`.
- Cuadro de ayuda contextual (patrón Info existente) arriba o abajo del campo.

### Copy propuesto

Texto de ayuda corto bajo el h4:
```
Conectá el píxel de Meta (Facebook Ads) para medir las visitas y conversiones de tu portal.
```

Cuadro de ayuda contextual (patrón `div.rounded-lg.border.border-border.bg-muted/30.p-3.flex.gap-2.text-xs.text-muted-foreground` con ícono `Info`):
```
El píxel de Meta es un código de seguimiento que te permite ver cuántas personas visitan tu portal y reservan turnos, para después medir tus campañas de publicidad.

Para conseguir el ID:
1. Entrá a Meta Business Manager (business.facebook.com).
2. Abrí Events Manager (Administrador de eventos).
3. Seleccioná un píxel existente o creá uno nuevo.
4. Copiá el ID numérico que aparece en la configuración del píxel.
```

### Input: detalle de accesibilidad/UX
- `inputMode="numeric"` para teclado numérico en mobile (regla del proyecto).
- `maxLength={20}`.
- `placeholder="1234567890123456789"` (ejemplo de 19 dígitos, dentro del rango).
- `disabled={savingAll}`.
- Clase `text-base md:text-sm` (16px en mobile para evitar zoom iOS — ya aplicado en `input.tsx` base, pero por consistencia con el resto de la sección).

## Validación: frontend vs DB (coherencia)

| Regla | Frontend (zod) | DB (trigger `trg_validate_portal_meta_pixel_id`) |
|---|---|---|
| Vacío permitido | sí → `''` | sí → NULL |
| Solo dígitos | `^\d{10,20}$` | `^[0-9]{10,20}$` |
| Trim de espacios | `.trim()` en zod + trim en onSubmit | trigger aplica `trim()` |
| 10-20 caracteres | sí | sí |

Quedan alineadas. El trigger de DB queda como red de seguridad; el frontend da el feedback inmediato.

## Fuera de alcance

- RLS: no se toca (plan aparte, ya corregido en build previo).
- No se valida contra la API real de Meta.
- No se inyecta el píxel en el portal público desde acá (eso es trabajo de frontend del portal de reservas, no de Configuración).
- No se toca `get-org-public` (ya devuelve `meta_pixel_id`).
