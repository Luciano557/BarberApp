

# Reestructurar "Mi Negocio" con tabs por sucursal

## Resumen

Transformar el panel "Mi Negocio" para mostrar directamente tabs por sucursal, donde cada tab contiene: información de la sucursal, equipo, y configuración de cobro. Mover "Plan y Suscripción" al panel de Configuración. Eliminar "Cobrar" y "Staff" del menú de Configuración (pasan a vivir dentro de cada sucursal).

## Cambios

### 1. `MiNegocioPanel.tsx` — Reescribir completamente

- Eliminar el menú de cards y la navegación por secciones.
- Título: **"Gestionar Mi Negocio"**.
- Subtítulo: **"Sucursales"** + **"Gestiona las sucursales de tu negocio"**.
- Botón "Nueva sucursal" en el header.
- Tabs con una tab por cada sucursal (usando `allSucursales` de la organización).
- Dentro de cada tab, 3 secciones verticales:
  1. **Información de la sucursal** — nombre, dirección, teléfono (inline editable).
  2. **Equipo** — lista de usuarios asignados con roles y gestión (reutilizar lógica de `SucursalesConfig`).
  3. **Cobrar** — servicios, extras, descuentos filtrados por esa sucursal (reutilizar `CobrarConfig`).

Se absorberá la lógica de `SucursalesConfig` directamente en este componente (o se refactorizará en sub-componentes).

### 2. `ConfigurationPanel.tsx` y `ConfigMenu.tsx` — Ajustar menú

- Eliminar la card **"Staff"** del menú de configuración (ahora vive en Mi Negocio → tab sucursal).
- Eliminar la card **"Cobrar"** del menú (ahora vive en Mi Negocio → tab sucursal).
- Agregar card **"Plan y Suscripción"** con icono Crown.
- Las secciones que quedan: **Plan y Suscripción**, **PIN de Seguridad**, **Tareas y Peticiones**.

### 3. `ConfigurationPanel.tsx` — Agregar sección Plan

- Importar `OrganizationSettings` (que ya muestra info del plan) o crear una vista dedicada de plan.
- Renderizar cuando `activeSection === 'plan'`.

### 4. `Index.tsx` — Actualizar props

- Ya no pasar props de servicios/barbers/cobrar a `ConfigurationPanel` (se simplifican).
- `MiNegocioPanel` necesitará recibir las props de servicios/extras/descuentos/lines/barbers o usar hooks directamente.

### 5. Archivos impactados

- `src/components/MiNegocioPanel.tsx` — reescritura completa
- `src/components/config/ConfigMenu.tsx` — quitar Staff y Cobrar, agregar Plan
- `src/components/ConfigurationPanel.tsx` — quitar Staff y Cobrar, agregar Plan
- `src/pages/Index.tsx` — ajustar props pasadas a ambos paneles

### Estructura visual resultante

```text
┌─────────────────────────────────────────┐
│ Gestionar Mi Negocio                    │
│ Sucursales                              │
│ Gestiona las sucursales de tu negocio   │
│                          [+ Nueva suc]  │
├─────────────────────────────────────────┤
│ [Casa Central] [SDAD] [Otra...]         │
├─────────────────────────────────────────┤
│ ▼ Información de la sucursal            │
│   Nombre: Casa Central                  │
│   Dirección: Av. Corrientes...          │
│   Teléfono: +54...            [Editar]  │
│                                         │
│ ▼ Equipo                                │
│   [Usuarios asignados + roles + gestión]│
│                                         │
│ ▼ Cobrar                                │
│   [Servicios] [Extras] [Descuentos]     │
│   (tabs internas de CobrarConfig)       │
└─────────────────────────────────────────┘
```

