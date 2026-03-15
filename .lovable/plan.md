

# Multi-Organización y Sucursales — Plan por Fases

Este cambio es la transformación arquitectónica más grande del proyecto. Toca base de datos, RLS, contextos, hooks, sidebar y prácticamente cada pantalla. Lo divido en **4 fases incrementales** para que cada una sea funcional por sí sola.

---

## Fase 1: Base de datos + Contexto de sucursal (esta iteración)

### 1.1 Nueva tabla `sucursales`

```text
sucursales
├── id              uuid PK
├── organization_id uuid FK → organizations
├── nombre          text NOT NULL
├── direccion       text
├── telefono        text
├── timezone        text (hereda de org por default)
├── activa          boolean DEFAULT true
├── created_at      timestamptz
```

RLS: owner full access filtrado por org. Manager SELECT solo su sucursal asignada.

### 1.2 Tabla `user_sucursales` (membresía por sucursal)

```text
user_sucursales
├── id              uuid PK
├── user_id         uuid FK → auth.users
├── sucursal_id     uuid FK → sucursales
├── organization_id uuid FK → organizations
├── UNIQUE(user_id, sucursal_id)
```

RLS: owner full access por org. Users can view own.

### 1.3 Agregar `sucursal_id` a tablas operativas

Columnas **nullable** (para no romper datos existentes):
- `barberos`, `venta`, `ingresos`, `ingresos_items`, `Egresos`, `pagos_sueldos`, `inversiones`, `deudas`, `tareas`, `ReportesMensuales`

Función helper:
```sql
CREATE FUNCTION get_user_sucursal_ids(_user_id uuid)
RETURNS SETOF uuid ...
-- Retorna todas las sucursales donde el user tiene membresía
```

### 1.4 Modificar `profiles` 

Agregar `default_sucursal_id uuid` nullable — para recordar la última sucursal seleccionada.

### 1.5 Auto-crear sucursal "Principal"

Trigger: al crear una organización (en `handle_new_user`), insertar automáticamente una sucursal "Casa Central" y asignar membresía al owner.

---

## Fase 2: Contexto frontend + Selector de sucursal

### 2.1 Nuevo `SucursalContext`

```typescript
interface SucursalContextType {
  sucursales: Sucursal[];
  currentSucursal: Sucursal | null;  // null = "Todas"
  setCurrentSucursal: (id: string | null) => void;
  isAllMode: boolean; // true cuando el dueño ve "Todas"
}
```

### 2.2 Selector persistente (barra de contexto)

Componente `SucursalSelector` que aparece debajo del header del sidebar o como barra superior:
- **Dueño**: puede elegir "Todas las sucursales" o una específica
- **Encargado**: fijado a su sucursal asignada (sin selector)
- **Barbero**: no ve selector

### 2.3 Actualizar todos los hooks

Cada hook que hoy filtra por `organization_id` agregará opcionalmente filtro por `sucursal_id` cuando `currentSucursal` no es null:
- `useSupabaseData` → servicios, barberos, extras por sucursal
- `useTransactions` → ventas filtradas
- `useCashClosing` → cierres por sucursal
- `useGastos`, `useInversiones`, `useDeudas` → filtrados
- `useTareas` → tareas por sucursal

---

## Fase 3: "Mi Negocio" como sección independiente

### 3.1 Nuevo tab en sidebar

```text
Sidebar items:
├── Cobrar
├── Resumen
├── Estadísticas
├── Sueldos
├── Finanzas
├── Tareas
├── Mi Negocio  ← NUEVO (solo dueño)
├── Configuración
```

### 3.2 Contenido de "Mi Negocio"

Panel con sub-secciones:
- **Información**: nombre, logo, teléfono, dirección de la organización (actual `OrganizationSettings`)
- **Sucursales**: CRUD de sucursales, asignación de encargados
- **Usuarios**: gestión de usuarios y roles (mover desde Config)
- **Plan**: info de suscripción

### 3.3 Simplificar Configuración

Config queda con:
- Cobrar (servicios, extras, descuentos)
- Staff (barberos de la sucursal actual)
- PIN de Seguridad
- Tareas

---

## Fase 4: Reporting consolidado

### 4.1 Vista "Todas las sucursales"

En Resumen/Estadísticas/Sueldos cuando el dueño está en modo "Todas":
- KPIs globales sumados
- Ranking de sucursales
- Comparativas entre sucursales

### 4.2 Vista "Sucursal X"

Detalle local idéntico al actual, pero filtrado por sucursal.

---

## Consideraciones técnicas

- **Datos existentes**: la migración asigna `sucursal_id = id_de_sucursal_principal` a todos los registros existentes mediante un script SQL que crea la sucursal default y actualiza las tablas.
- **RLS**: las políticas se actualizarán para incluir filtro por sucursal donde corresponda. Los encargados solo ven datos de su sucursal.
- **Multi-org para dueños**: requiere cambiar `profiles.organization_id` por una tabla `user_organizations` (membresía m:n). Esto es la parte más invasiva y se puede diferir si inicialmente cada dueño tiene solo 1 org.
- **Barberos rotativos**: un barbero puede tener membresía en múltiples sucursales via `user_sucursales`. Sus cobros/cierres llevan `sucursal_id` según dónde trabajó ese día.

## Propuesta de ejecución

Recomiendo implementar **Fase 1 + Fase 2** juntas (DB + contexto + selector) ya que una sin la otra no es funcional. La Fase 3 (Mi Negocio separado) y Fase 4 (reporting) pueden venir después.

¿Aprobás para arrancar con Fases 1+2?

