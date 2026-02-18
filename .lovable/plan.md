
# Separar Tareas y Peticiones

## Resumen

Dividir la seccion actual "Tareas y Peticiones" en dos tabs claras dentro del panel, donde cada una tiene su propio titulo, boton de accion y logica de permisos. Las peticiones podran ser creadas por cualquier persona (incluidos barberos) usando su PIN para identificarse.

## Cambios principales

### 1. Titulo y tabs dinamicos

- El titulo principal cambia segun la tab activa: "Tareas" o "Peticiones"
- El boton de accion cambia: "Nueva tarea" (solo owners/managers) o "Nueva peticion" (cualquiera)
- El mensaje vacio tambien cambia: "No hay tareas" / "No hay peticiones"

### 2. Flujo de nueva peticion con PIN

Cuando alguien toca "Nueva peticion":
1. Se abre el dialogo de PIN (reutilizando `PinGateDialog` existente)
2. La persona ingresa su PIN
3. El sistema identifica quien es (via `validate-pin` que ya devuelve `barbero_id` y `user_name`)
4. Se abre el formulario de peticion con el campo "Creado por" ya completado con el nombre del barbero
5. El formulario de peticion es mas simple: solo titulo y descripcion (sin asignar a, sin fecha, sin repetir)

### 3. Formulario de peticion simplificado

El `TareaFormDialog` recibira un prop `tipo` para adaptar su contenido:
- Tipo `tarea`: formulario completo (como esta ahora) - titulo, descripcion, asignar a, fecha, hora, repetir
- Tipo `peticion`: formulario simple - solo titulo y descripcion. El `creado_por` se setea automaticamente con los datos del PIN

### 4. Columnas de la tabla adaptadas

La tabla de peticiones mostrara columnas relevantes:
- Titulo (con descripcion)
- Creado por (quien hizo la peticion)
- Estado
- Fecha de creacion
- Acciones

La tabla de tareas mantiene las columnas actuales.

## Detalle tecnico

### Archivos modificados

**`src/components/TareasPanel.tsx`**
- Cambiar el titulo de "Tareas y Peticiones" a que sea dinamico segun la tab activa
- Mover el boton "Nueva tarea"/"Nueva peticion" para que cambie segun la tab
- En la tab "Peticiones", mostrar el boton "Nueva peticion" a todos (sin restriccion de `canManageConfig`)
- Agregar estado para manejar el flujo de PIN antes de abrir el formulario de peticion
- Integrar `PinGateDialog` para identificar al creador de la peticion
- Adaptar `renderTable` para que las peticiones muestren "Creado por" en vez de "Asignado a"

**`src/components/tareas/TareaFormDialog.tsx`**
- Agregar prop `tipo: 'tarea' | 'peticion'`
- Agregar prop `creadorNombre?: string` (viene del PIN)
- Cuando `tipo === 'peticion'`: ocultar los campos de "Asignar a", "Fecha", "Hora" y "Repetir"
- Cambiar el titulo del header a "Nueva tarea" o "Nueva peticion" segun el tipo
- Al confirmar, setear `tipo: 'peticion'` y `creado_por_nombre` con el nombre del barbero identificado

**`src/hooks/useTareas.ts`**
- Actualizar `TareaInsert` para aceptar `creado_por_nombre` opcional
- En el `addTarea` mutation, permitir que venga `creado_por_nombre` desde fuera (para peticiones creadas por barberos via PIN)

### Flujo de datos para peticiones

```text
Usuario toca "Nueva peticion"
    |
    v
PinGateDialog se abre
    |
    v
Ingresa PIN -> validate-pin devuelve { barbero_id, user_name }
    |
    v
Se guarda barbero_id y user_name en estado local
    |
    v
Se abre TareaFormDialog con tipo='peticion' y creadorNombre=user_name
    |
    v
Usuario llena titulo y descripcion
    |
    v
Se crea la tarea con tipo='peticion', creado_por_nombre=user_name
```

### Permisos

- "Nueva tarea": solo visible para owners y managers (como ahora)
- "Nueva peticion": visible para todos, pero requiere PIN para identificarse
- Eliminar/gestionar tareas y peticiones: sigue restringido a owners y managers (las RLS policies ya lo manejan)
