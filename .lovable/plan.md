

# Mover Usuarios y Roles dentro de Sucursales

## Concepto

Eliminar "Usuarios y Roles" como sección separada en Mi Negocio. En su lugar, al hacer clic en el botón de usuarios de cada sucursal, se abre un panel/dialog enriquecido que muestra:

1. **Usuarios asignados** a esa sucursal con sus roles y barbero vinculado
2. **Asignar usuarios** con selector de rol (Enc. General, Enc. Local, Barbero)
3. **Vincular barbero** a cada usuario directamente desde ese contexto

## Cambios

### 1. `SucursalesConfig.tsx` — Dialog de usuarios enriquecido

Reemplazar el dialog simple de asignación actual con uno que incluya:
- Lista de usuarios asignados mostrando: nombre, email, rol(es), barbero vinculado
- Botones para agregar/quitar roles por usuario
- Selector para vincular barbero al usuario
- Selector para agregar nuevo usuario a la sucursal con rol inicial

Se reutiliza la lógica existente de `UserManagement.tsx` (fetch roles, assign/remove role, link barber) pero contextualizada por sucursal.

### 2. `MiNegocioPanel.tsx` — Eliminar sección "Usuarios y Roles"

- Quitar el item `usuarios` del menú
- Quitar el import de `UserManagement`
- La sección de sucursales ahora cubre toda la gestión de usuarios per-sucursal

### 3. `config/NegocioConfig.tsx` — Limpiar tab "Usuarios"

Quitar el tab "Usuarios" que también referencia `UserManagement`.

### 4. `UserManagement.tsx` — Mantener como componente reutilizable (opcional) o eliminar

Si toda la lógica se mueve al dialog de sucursales, se puede eliminar. Si se prefiere mantener una vista global, se conserva pero se accede solo desde sucursales.

## Flujo resultante

```text
Mi Negocio
  ├── Información del Negocio
  ├── Sucursales
  │     ├── Sucursal A  → [Usuarios] → Dialog con roles, barberos, asignaciones
  │     └── Sucursal B  → [Usuarios] → Dialog con roles, barberos, asignaciones
  └── Plan y Suscripción
```

## Archivos a modificar
- `src/components/config/SucursalesConfig.tsx` — enriquecer dialog de usuarios con roles y barberos
- `src/components/MiNegocioPanel.tsx` — quitar sección "usuarios"
- `src/components/config/NegocioConfig.tsx` — quitar tab "Usuarios"

