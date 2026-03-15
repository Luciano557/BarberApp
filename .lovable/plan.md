

# Renombrar "Gastos" a "Finanzas" con sub-secciones: Gastos, Inversiones y Deudas

## Resumen
Reemplazar el tab "Gastos" del sidebar por "Finanzas", que internamente tendrá un menú con 3 sub-secciones: Gastos (existente), Inversiones (nuevo) y Deudas (nuevo). Patrón similar al ConfigurationPanel con router interno.

## Base de datos (2 tablas nuevas)

### Tabla `inversiones`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid | FK organizations |
| nombre | text NOT NULL | Ej: "Sillón nuevo" |
| monto_total | numeric NOT NULL | Costo total |
| fecha_compra | date NOT NULL | |
| meses_amortizacion | integer NOT NULL | Ej: 12, 24, 36 |
| categoria | text | Ej: Mobiliario, Equipamiento, Reforma |
| descripcion | text | Opcional |
| activa | boolean DEFAULT true | |
| created_at | timestamptz DEFAULT now() | |

RLS: owner + manager full access, filtrado por `organization_id = get_user_organization_id(auth.uid())`

### Tabla `deudas`
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid | FK organizations |
| inversion_id | uuid NULLABLE | FK inversiones (si está vinculada) |
| acreedor | text NOT NULL | Ej: "Banco Nación", "Proveedor X" |
| monto_total | numeric NOT NULL | Deuda total original |
| monto_pagado | numeric DEFAULT 0 | Acumulado pagado |
| cuotas_totales | integer | Cantidad de cuotas |
| cuotas_pagadas | integer DEFAULT 0 | |
| monto_cuota | numeric | Monto de cada cuota |
| fecha_inicio | date NOT NULL | |
| fecha_proximo_pago | date | |
| descripcion | text | |
| estado | text DEFAULT 'activa' | activa / pagada |
| created_at | timestamptz DEFAULT now() | |

RLS: owner + manager full access, filtrado por `organization_id`

## Cambios en frontend

### 1. Sidebar (`AppSidebar.tsx`)
- Cambiar `{ id: 'gastos', label: 'Gastos', icon: Receipt }` → `{ id: 'finanzas', label: 'Finanzas', icon: Receipt }`

### 2. Index.tsx
- Cambiar el bloque `activeTab === 'gastos'` → `activeTab === 'finanzas'` y renderizar `<FinanzasPanel />` en vez de `<GastosPanel />`

### 3. Nuevo: `src/components/FinanzasPanel.tsx`
Panel con router interno (como ConfigurationPanel):
- Estado `activeSection`: `'menu' | 'gastos' | 'inversiones' | 'deudas'`
- **Menu**: 3 cards con icono, título y descripción
- **Gastos**: renderiza el `<GastosPanel />` existente
- **Inversiones**: formulario + listado de inversiones con amortización mensual calculada (`monto_total / meses_amortizacion`)
- **Deudas**: formulario + listado de deudas, con botón "Registrar pago" para incrementar cuotas pagadas y monto pagado
- Botón "Atrás" para volver al menú

### 4. Nuevo: `src/hooks/useInversiones.ts`
- CRUD contra tabla `inversiones`, filtrado por org y mes
- Cálculo de amortización mensual

### 5. Nuevo: `src/hooks/useDeudas.ts`
- CRUD contra tabla `deudas`, filtrado por org
- Función `registrarPago` que incrementa cuotas_pagadas y monto_pagado
- Al crear deuda con `inversion_id`, se vincula automáticamente

### 6. Nuevo: `src/components/InversionesPanel.tsx`
- Formulario: nombre, monto total, fecha compra, meses amortización, categoría, descripción
- Checkbox "¿Financiada?" → si sí, abre campos de deuda (acreedor, cuotas, monto cuota, fecha próximo pago) y crea ambos registros
- Listado con cards mostrando: nombre, monto, amortización mensual, meses restantes, barra de progreso

### 7. Nuevo: `src/components/DeudasPanel.tsx`
- Formulario: acreedor, monto total, cuotas, monto cuota, fecha inicio, fecha próximo pago, descripción
- Listado: cards con acreedor, progreso (cuotas pagadas/total), monto pendiente, botón "Registrar pago"
- Badge de estado (activa/pagada)

## Flujo de vinculación inversión-deuda
Al crear una inversión financiada, se insertan ambos registros en una transacción lógica (insert inversión → obtener id → insert deuda con inversion_id). La deuda muestra un badge "Vinculada a: [nombre inversión]".

