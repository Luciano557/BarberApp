

# Registro de Gastos (Egresos)

## Resumen

Crear la seccion "Gastos" para registrar y consultar egresos del negocio, usando la tabla `Egresos` que ya existe en Supabase con soporte multi-tenant (`organization_id`) y RLS configurado.

**No se requieren cambios en la base de datos.** La tabla ya tiene todo lo necesario.

## Que se va a construir

### 1. Hook de datos: `useGastos.ts`
- Obtiene `organization.id` del `OrganizationContext` (mismo patron que los demas hooks)
- Funciones: cargar gastos por rango de fecha, agregar gasto (con `organization_id`), eliminar gasto
- Todas las inserciones incluyen `organization_id` para garantizar aislamiento multi-tenant
- Feedback con toasts de sonner

### 2. Componente: `GastosPanel.tsx`
- **Formulario de registro** con:
  - Categoria (selector: Alquiler, Servicios, Insumos, Impuestos, Sueldos fijos, Marketing, Mantenimiento, Otros)
  - Monto (input numerico)
  - Descripcion (textarea opcional)
  - Fecha (date picker, default hoy)
- **Historial** con:
  - Tabla: Fecha, Categoria, Descripcion, Monto, boton eliminar
  - Filtro por mes/anio
  - Total del periodo al pie

### 3. Navegacion e integracion
- Agregar item "Gastos" en el sidebar (icono Receipt, visible solo para owner/manager)
- Agregar tab en Index.tsx envuelto en PinProtectedSection

## Archivos involucrados

| Archivo | Accion |
|---------|--------|
| `src/hooks/useGastos.ts` | Crear (nuevo) |
| `src/components/GastosPanel.tsx` | Crear (nuevo) |
| `src/components/AppSidebar.tsx` | Modificar: agregar 1 item en navItems |
| `src/pages/Index.tsx` | Modificar: agregar bloque de renderizado del tab |

## Seguridad
- RLS ya activo: solo owner y manager tienen acceso a la tabla Egresos
- PIN protection via PinProtectedSection
- `organization_id` incluido en todas las operaciones de escritura

## Detalle tecnico

El hook `useGastos` seguira el mismo patron que `SueldosPanel` usa internamente: importar `useOrganization()` para obtener el ID de la organizacion, y pasarlo en cada insert:

```text
const { organization } = useOrganization();

// Insert
await supabase.from('Egresos').insert({
  Categoria: categoria,
  Monto: monto,
  Descripcion: descripcion,
  Fecha: fecha,
  organization_id: organization.id
});

// Query
await supabase.from('Egresos')
  .select('*')
  .eq('organization_id', organization.id)
  .gte('Fecha', startDate)
  .lte('Fecha', endDate)
  .order('Fecha', { ascending: false });
```

En el sidebar, se agrega entre "Sueldos" y "Configuracion":

```text
...(canManageConfig ? [{ id: 'gastos', label: 'Gastos', icon: Receipt }] : []),
```

En Index.tsx:

```text
{activeTab === 'gastos' && canManageConfig && (
  <PinProtectedSection sectionName="Gastos">
    <GastosPanel />
  </PinProtectedSection>
)}
```

