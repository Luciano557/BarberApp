

## Plan: Ribbon de fechas estilo Fresha + validación de slug

### 1. Slug ya es único (no requiere cambios)

La ruta `/:orgSlug/reservar` ya funciona correctamente. El campo `slug` en la tabla `organizations` tiene constraint `UNIQUE NOT NULL`. La Edge Function `get-org-public` busca por slug y devuelve 404 si no existe. No hay cambios necesarios aqui.

### 2. Rediseño de `FechaHorarioStep` con ribbon horizontal de dias

Reemplazar el calendario completo por un ribbon horizontal scrolleable de dias (como en la imagen de Fresha).

**Archivo**: `src/components/reservar/FechaHorarioStep.tsx`

**Nuevo layout**:
- Titulo: "Elegí fecha y horario"
- Mes/año actual como label (ej: "abril de 2026")
- Ribbon horizontal scrolleable con circulos para cada dia, mostrando ~7-14 dias a futuro
  - Cada circulo muestra el numero del dia
  - Debajo, la abreviatura del dia de la semana (lun, mar, mie...)
  - El dia seleccionado tiene fondo `primary` con texto blanco
  - Los demas tienen borde outline
  - Dias no laborables (domingo tipicamente) aparecen en gris/deshabilitados
- Debajo del ribbon, los slots de horario se muestran como lista vertical (no grilla 3 columnas) con botones full-width de h-12, estilo similar a la imagen de referencia
- Al cargar, se selecciona automaticamente el dia actual (o el proximo dia laboral si hoy no tiene disponibilidad)

**Logica**:
- Generar array de los proximos 14 dias desde hoy
- Al tocar un dia, actualizar `fecha` y re-fetch slots
- El ribbon es scrolleable horizontalmente con `overflow-x-auto` y `flex-nowrap`
- Mantener la misma llamada a `get-availability` que ya existe

**Estructura visual (ASCII)**:
```text
┌─────────────────────────────────┐
│  abril de 2026                  │
│                                 │
│  (3)   4    5    6    7    8    │ ← scroll horizontal
│  vie  sáb  dom  lun  mar  mié  │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 11:00                   │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 11:30                   │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 12:00                   │   │
│  └─────────────────────────┘   │
│  ...                           │
└─────────────────────────────────┘
```

### 3. Archivos a modificar

- **`src/components/reservar/FechaHorarioStep.tsx`** — reescribir completamente: quitar Calendar, implementar ribbon + lista vertical de slots
- **`src/components/reservar/FechaStep.tsx`** y **`src/components/reservar/HorarioStep.tsx`** — ya no se usan (eran los pasos separados previos), pueden dejarse sin cambios ya que no se importan en el flujo principal

### Detalles tecnicos

- El ribbon usa `date-fns/locale/es` para formatear dias de la semana en español
- Los circulos del ribbon son botones de ~48x48px con `rounded-full`
- `useRef` + scroll horizontal nativo (no libreria externa)
- La lista de slots usa botones `variant="outline"` full-width con texto alineado a la izquierda, estilo card

