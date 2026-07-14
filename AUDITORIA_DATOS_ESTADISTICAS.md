# Auditoría de datos para Estadísticas

**Fecha:** 13 de julio de 2026
**Alcance:** relevamiento de datos de negocio disponibles en la base (Supabase, proyecto `Vittro` / `azqpyfoobpovqosbayvz`) y de cómo el código los consulta hoy. **No** se corrieron queries de análisis contra datos de producción: las fuentes son el schema vivo (catálogo, solo lectura), las 214+ migraciones del repo (`supabase/migrations/`) y el código de `src/`. Los conteos de filas son estimados del catálogo de Postgres y abarcan **toda la plataforma** (29 organizaciones, 31 sucursales) — no una sola barbería.

**Propósito:** insumo para la reestructuración del panel de Estadísticas. Este documento NO propone qué mostrar; solo inventaría qué hay.

---

## 0. El mapa en una mirada: dos modelos de venta conviviendo

Antes del inventario, la clave estructural de toda la base:

- **`venta`** (~1.692 filas) — el ticket individual, en tiempo real, con hora exacta, extras, pagos divididos y productos. Es el modelo actual de la pestaña Caja.
- **`ingresos`** (~535 filas) — el **cierre de caja por barbero por día**: un agregado que se calcula desde las ventas al momento de cerrar ([useCashClosing.ts](src/hooks/useCashClosing.ts)). Hereda del modelo original single-tenant ("barbería Scissors", pre-enero 2026) y es **la fuente que Estadísticas usa hoy para casi todo**.

Consecuencia: hay una doble fuente de verdad. `ingresos` solo existe si alguien cerró la caja; `venta` existe siempre. Los cierres diferidos (backfill) existen en `ingresos` sin tickets `venta` correspondientes. Cualquier métrica nueva tiene que elegir explícitamente de cuál de las dos fuentes sale.

---

## 1. Inventario de tablas relevantes para métricas de negocio

72 tablas en el schema `public`. Abajo, las ~35 relevantes para métricas, agrupadas por dominio. Formato: columnas clave, confiabilidad temporal, FKs reales (constraints verificados en el catálogo, no inferidos por nombre).

### 1.1 Ventas e ingresos

#### `venta` — ~1.692 filas — ticket individual
| Columna | Tipo | Nota |
|---|---|---|
| `barbero_id` / `barbero_nombre` | uuid null / text | FK real a `barberos` + snapshot del nombre |
| `servicio_id` / `servicio_nombre` / `precio_servicio` | uuid null / text / numeric | FK real a `servicios` + snapshot |
| `descuento_pct` | numeric, default 0 | descuento aplicado (solo %) |
| `metodo_pago` | text CHECK: efectivo, mercado_pago, transferencia, debito, credito | desde abr/2026 es el **método dominante** (el de mayor monto); el desglose real vive en `venta_pagos` |
| `total_final` | numeric NOT NULL | total BASE, **sin recargos** |
| `recargo_total` / `total_cobrado` | numeric | recargos por método y total real cobrado (desde ~17/abr/2026) |
| `fecha_hora` | timestamptz | hora exacta del cobro — única fuente de granularidad horaria |
| `estado` | text, default 'activo' | 'activo' / 'anulado' + `anulado_at/por/por_id` (auditoría) |
| `tipo_venta` | text CHECK: servicio / productos / mixta | desde 29/abr/2026 |
| `mp_payment_intent_id` / `mp_device_id` / `mp_status` | text null | integración MP Point (desde 11/jun/2026) |
| `organization_id` / `sucursal_id` | uuid | FKs reales |

**No tiene `cliente_id` ni `turno_id`.** Las ventas son anónimas y no se vinculan con la reserva que las originó. Es la limitación estructural más importante de la base (ver §5.1).

Hijas (FK real hacia `venta.id`): `venta_extra`, `venta_pagos`, `venta_producto`, `venta_descuentos_aplicados`.

- **Confiabilidad:** existe desde el 8/ene/2026. `sucursal_id` fue backfilleado en toda la historia (migración 15/mar/2026 + fixes 20/mar). `recargo_total`/`total_cobrado`/`tipo_venta` valen default hacia atrás.

#### `venta_pagos` — ~824 filas — desglose de pago por método
`venta_id` (FK real), `metodo_pago` (mismo CHECK de 5 valores), `monto`, `base_pago`, `recargo_pct`, `recargo_monto`, `orden`. Permite pagos mixtos (efectivo + tarjeta en una misma venta) y registra el recargo por método.
- **Confiabilidad: solo desde el 17/abr/2026.** Las ~870 ventas anteriores no tienen filas acá; para ellas el único dato de método es `venta.metodo_pago`. El código ya contempla el fallback ([useTransactions.ts:165](src/hooks/useTransactions.ts#L165)).

#### `venta_extra` — ~108 filas
`venta_id`, `extra_id` (FKs reales), `extra_nombre`, `precio_extra`, `cantidad` — snapshot de extras vendidos. Desde ene/2026.

#### `venta_producto` — ~22 filas — líneas de producto por ticket
`venta_id`, `producto_id`, `producto_sucursal_id` (FKs reales), `producto_nombre`, `marca_id/nombre` (snapshot), `precio_unitario`, `cantidad`, `subtotal`, **`barbero_id`** (quién vendió el producto — sin constraint FK, es uuid suelto). Desde 29/abr/2026.

#### `ingresos` — ~535 filas — cierre de caja por barbero/día (fuente actual de Estadísticas)
| Columna | Nota |
|---|---|
| `barbero` (text) / `barbero_id` (uuid, FK real) | el texto es legacy; `barbero_id` existe desde 14/ene/2026 con backfill por matching de nombre — **filas viejas sin match quedaron NULL** |
| `mp` / `efectivo` / `total_facturado` | montos BASE (sin recargos). **Ojo doble:** (a) `mp` incluye TODO lo digital (transferencia, débito, crédito), no solo Mercado Pago; (b) `total_facturado` incluye productos, no solo servicios |
| `total_sin_descuento` / `perdida` | lo que se habría cobrado sin descuentos y la diferencia |
| `cantidad_de_servicios`, `servicios_con/sin_descuento` | contadores del día |
| `cantidad_de_50_por` / `cantidad_de_20_por` / `deluxe` / `essencial` | **columnas muertas** del modelo Scissors original |
| `dia` | día de semana en texto español ('lunes'…'sábado') — Estadísticas lo usa para el chart por día |
| `sueldo` | comisión del barbero calculada y congelada al cierre (`serviciosBase × comision%`) |
| `servicios_por_linea` | jsonb con conteo por línea de servicio (matching por nombre, frágil) |
| `estado` | 'activo' / 'eliminado' (anulación de cierre, con auditoría en `anulaciones_cierre`) |
| `entry_mode` | 'normal' / **'diferido'** (backfill); los diferidos llevan `backfilled_at/by`, `backfill_reason/note` y son de menor fidelidad (sin descuentos, sin detalle por línea, `perdida=0`) |
| `closed_at` | timestamp real del cierre (backfilleado = `created_at` para filas anteriores a feb/2026) |
| `recargos_total`, `total_cobrado`, `efectivo_cobrado`, `digital_cobrado` | snapshot del cobrado real con recargos — desde ~abr/2026, 0/null hacia atrás |
| `productos_total/cantidad/efectivo/digital`, `comision_productos` | agregados de productos del día — desde ~may/2026, 0 hacia atrás |

- **Confiabilidad:** la tabla pre-data las migraciones del repo (creada vía dashboard en el proyecto original, oct-nov/2025). `organization_id` se agregó el 9/ene/2026 (filas viejas asignadas a una org placeholder); `sucursal_id` el 15/mar/2026 con backfill completo. Hubo limpiezas manuales de nombres y timestamps (ene-feb/2026).

#### `ingresos_items` — ~6 filas
Detalle opcional de cierres diferidos en modo detallado (servicio, línea, qty, unit_price, payment_method). FKs reales a ingresos/barberos/servicios/lineas. Volumen marginal.

#### `ingresos_items_productos` — ~16 filas
Snapshot por cierre de productos vendidos con `precio_costo_snap`, `comision_modo_snap`, `comision_pct_snap`, `comision_monto`. **Sin ningún FK constraint** (ni a ingresos ni a productos). Es la única tabla que congela el costo del producto al momento de la venta.

#### `anulaciones_cierre` — ~16 filas
Auditoría de cierres anulados: `ingreso_id` (integer, sin FK), quién, cuándo, motivo. Sin FKs reales.

#### `ReportesMensuales` — 0 filas — **legacy, vacía**
Irónicamente, es el esqueleto de un panel de estadísticas anterior: FacturacionTotal, TicketPromedio, MargenBruto, PuntoDeEquilibrioEnCortes, TasaDeOcupación, CrecimientoEnFacturación… por `Mes` (text). Nunca se pobló y ningún código la consulta. Columnas con tildes rotas en el nombre (encoding).

### 1.2 Agenda y turnos

#### `turnos` — ~288 filas — reservas
| Columna | Nota |
|---|---|
| `organization_id`, `sucursal_id`, `barbero_id`, `servicio_id` | todos NOT NULL, FKs reales |
| `cliente_nombre` / `cliente_telefono` / `cliente_email` | datos sueltos del cliente (teléfonos normalizados a +549 el 20/may/2026; los no convertibles se pusieron NULL) |
| `cliente_id` | uuid null — **sin constraint FK** a clientes, pero es el vínculo que usa el código ([useClientes.ts:266](src/hooks/useClientes.ts#L266)) |
| `fecha`, `hora_inicio`, `hora_fin`, `rango_horario` | granularidad completa de agenda |
| `estado` | CHECK permite: pendiente, confirmado, en_curso, completado, cancelado, no_asistio. **El código solo usa pendiente/confirmado/cancelado** — nada marca completado ni no_asistio (§5.2) |
| `eligio_barbero` | boolean — si el cliente eligió barbero específico al reservar |
| `cancelado_at` / `cancelado_motivo` | auditoría de cancelación |
| `created_at` | permite calcular anticipación de la reserva |

- **Confiabilidad:** desde 1/abr/2026 (módulo agenda). No hay vínculo turno→venta.

#### Soporte de agenda
- `horarios_trabajo` (~17): franjas por barbero/sucursal/día de semana (`dia_semana` 1-7, `hora_inicio/fin`, `activo`). Base para capacidad real de agenda. Cobertura incompleta (17 filas globales para 34 barberos).
- `bloqueos_agenda` (~14): vacaciones/franco por barbero o sucursal, con motivo.
- `agenda_config` (~3): duración base, buffers, límites de cancelación/modificación por sucursal.
- `sucursal_settings` (~1): `capacidad_diaria` (default 18) — el input manual de la Tasa de Ocupación actual.

### 1.3 Clientes

#### `clientes` — ~413 filas — desde 24/abr/2026
Identidad (`nombre`, `apellido`), contacto (`telefono` E.164 +549 post-migración 20/may/2026, `email`, `instagram`, `tiktok`, `otra_red_social`), perfil (`fecha_nacimiento`, `alergias`), consentimiento (`acepta_marketing`, default true), gestión (`bloqueado` + motivo, `nota_interna`, `eliminado` soft-delete), **origen** (`origen`: manual / importado / reserva; `fecha_cliente_desde`; `fecha_importacion`; `external_source` — hay import desde Fresha implementado; `external_customer_id`).

- **FKs:** solo `clientes_sucursales` apunta acá. Nada más en la base referencia a clientes con constraint (ni `venta`, ni `turnos` formalmente).
- `clientes_sucursales` (~413): vínculo N:M cliente↔sucursal con `origen_relacion`.

### 1.4 Catálogo (servicios, extras, descuentos, líneas)

- `servicios` (~21): `nombre`, `precio` (base global), **`duracion_min`** (default 30), `linea_id` (FK real), `activo`, `eliminado` (soft). FKs entrantes desde venta, turnos, ingresos_items, servicios_sucursales.
- `servicios_sucursales` (~53, desde 30/abr/2026): precio y activo **por sucursal** — el precio vigente real es este, el de `servicios` es el catálogo global.
- `lineas` (~2): agrupador de servicios con color y orden.
- `extras` (~1) + `extras_sucursales` (~22): mismo patrón catálogo global + config por sucursal.
- `descuentos` (~4) + `descuentos_sucursales` (~17): tipo porcentaje/monto, redondeo, restricción por método de pago.

### 1.5 Productos y stock (todo desde 29/abr/2026)

- `productos` (~8) + `marcas_producto` (~2): catálogo global.
- `productos_sucursal` (~16): por sucursal: **`precio_costo` (nullable — hueco §5.3)**, `precio_venta`, `margen_pct` (nullable), `stock_actual`, `stock_minimo`, `comision_modo` (barbero/ninguna/personalizada) + `comision_porcentaje`.
- `movimientos_stock` (~32): auditoría completa — `tipo` CHECK (stock_inicial, reposicion, ajuste_manual, venta), `cantidad`, **`stock_previo` y `stock_resultante`**, `venta_id`, `created_by`. Se escribe vía RPC `registrar_movimiento_stock` (atómico).

### 1.6 Equipo

- `barberos` (~34): `nombre/apellido`, `comision` (0-100), `tipo_compensacion` ('comision'/'fijo'), `sueldo_fijo`, `rol_equipo` + `roles_equipo[]`, `fecha_cobro_dia`, `activo`, **`fecha_baja` + `motivo_baja`**, `dni/telefono` (PII — hay vista `barberos_safe` que los excluye). Es la tabla más referenciada de la base (16 FKs entrantes).
- `barberos_sucursales` (~24, desde 7/jun/2026): disponibilidad por sucursal con `tipo` (principal/temporal/recurrente), `dias_semana[]`, vigencias.
- `barbero_historial` (~31, desde 8/jun/2026): altas y bajas con `fecha_inicio`, `fecha_fin`, `motivo_egreso` — permite reconstruir el equipo vigente en cualquier fecha pasada y calcular rotación/antigüedad.
- `sucursal_barberos_snapshot` (~13): foto de asignaciones al momento de desactivar una sucursal.
- `profiles` (~17) / `user_roles` (~17) / `user_sucursales` (~17): usuarios de la app (owner/manager/barber/sucursal account).

### 1.7 Compensaciones

- `pagos_sueldos` (~33): pagos efectuados (`barbero_id`, `monto`, `fecha`, `concepto`). Al registrar un pago se genera automáticamente un `Egresos` vinculado vía `Egresos.pago_sueldo_id` (FK real) con categoría "Sueldos fijos del personal" o "Comisiones del personal" ([SueldosPanel.tsx:867](src/components/SueldosPanel.tsx#L867)).
- `comision_equipo_config` (~2) + `comision_equipo_reglas` (~1): comisión de un encargado sobre la facturación de otros barberos, con `porcentaje` y vigencias (`vigencia_desde/hasta`). Se calcula al vuelo en Sueldos, nunca se persiste el monto.
- `comision_productos_config` (~1): % por barbero sobre la **ganancia** de productos vendidos (precio_venta − precio_costo), lógica en [comisionProductos.ts](src/lib/comisionProductos.ts). El monto sí se persiste en `ingresos.comision_productos` al cierre.
- `bono_fijo_config` / `bono_fijo_ocurrencias` — **0 filas**: feature de bonos recurrentes implementada pero sin uso.

### 1.8 Egresos y finanzas

#### `Egresos` — ~75 filas — gastos
`Fecha` (timestamptz), `Categoria` (**texto libre**, sin catálogo), `Monto`, `Descripcion`, `tipo_costo` ('fijo'/'variable'/'semivariable', default 'fijo'), `estado` ('activo'/'anulado' + auditoría de anulación con motivo y PIN). Vínculos: `pago_deuda_id` y `pago_sueldo_id` (FKs reales); `inversion_id` y `gasto_recurrente_id` (**uuid sueltos, sin constraint**). Naming legacy con mayúsculas; comment de la tabla aún dice "barberia Scissors".
- Pre-data las migraciones; `organization_id` desde 9/ene/2026, `sucursal_id` desde 15/mar/2026 (backfilleados).

#### Resto
- `gastos_recurrentes` (~1): plantillas (alquiler, etc.) con recurrencia; generan filas en `Egresos` automáticamente al abrir Gastos ([useGastosRecurrentes.ts](src/hooks/useGastosRecurrentes.ts)).
- `deudas` (~4): `acreedor`, `monto_total`, `monto_pagado`, `cuotas_totales/pagadas`, `monto_cuota`, `fecha_proximo_pago`, `estado`, `inversion_id` (FK real a inversiones).
- `pagos_deudas` — **0 filas** (tabla nueva, 27/jun/2026): pagos de deuda con vínculo bidireccional a `Egresos`. El flujo existe en código ([useDeudas.ts:136](src/hooks/useDeudas.ts#L136)) pero nadie lo usó aún.
- `inversiones` — **0 filas**: monto, `fecha_compra`, `meses_amortizacion`; la amortización mensual se calcula en el front ([useInversiones.ts:108](src/hooks/useInversiones.ts#L108)). Feature sin datos.

### 1.9 Plataforma (no son métricas del negocio del cliente, pero existen)
`organizations` (29; `timezone`, `plan`), `sucursales` (31; soft-delete + `fecha_desactivacion`), `subscription_plans/organization_subscriptions/subscription_plan_changes/subscription_payments` (billing de Vittro como SaaS; payments aún 0), `notifications` (~1.122) + `notification_deliveries` (~1.103), `access_logs` (~805: quién entró a qué sección — dato de uso interno), `tareas` (~25) + `tareas_recurrentes` (~5), `mp_connections/devices/webhook_log` (MP Point), `portal_config`, `user_onboarding`, `push_tokens` (0), `user_pins` (0), `plan_features` (0).

### 1.10 Línea de tiempo de confiabilidad (resumen)

| Fecha | Evento | Impacto en datos |
|---|---|---|
| oct-nov/2025 | Proyecto original single-tenant ("Scissors") | `ingresos`/`Egresos` existen desde antes de las migraciones del repo; historia más vieja con columnas legacy |
| 08/ene/2026 | Nace `venta` + `venta_extra` | granularidad de ticket desde acá |
| 09/ene/2026 | Multi-tenant (`organization_id` + backfill) | filas viejas asignadas a org placeholder |
| 14/ene/2026 | `ingresos.barbero_id` + backfill por nombre | filas sin match quedaron con barbero_id NULL |
| 11/feb/2026 | `closed_at` backfilleado = `created_at` | closed_at viejo no es hora real de cierre |
| 15/mar/2026 | Multi-sucursal (`sucursal_id` + backfill completo) | el filtro por sucursal funciona sobre TODA la historia |
| 01/abr/2026 | Módulo agenda (`turnos`, `horarios_trabajo`, …) | métricas de reservas solo desde acá |
| 17/abr/2026 | `venta_pagos` (pagos mixtos + recargos) | desglose real por método solo desde acá; `venta.metodo_pago` pasa a ser "método dominante" |
| 24/abr/2026 | `clientes` + `clientes_sucursales` | CRM desde acá; import externo (Fresha) con `fecha_cliente_desde` |
| 29-30/abr/2026 | Productos + stock + `tipo_venta` + precios por sucursal | métricas de productos solo desde acá |
| ~09/may/2026 | `comision_productos_config` + agregados de productos en `ingresos` | `ingresos.productos_*` y `comision_productos` = 0 hacia atrás |
| 20/may/2026 | **Migración de teléfonos** → +549 E.164 | en `turnos`/`barberos` los no convertibles quedaron NULL; en `clientes` se preservaron. Quedaron vistas `_phone_migration_report` y `_phone_dups_report` y backup `_backup_phones_20260520` |
| 07-08/jun/2026 | `barberos_sucursales` + `barbero_historial` | historia de equipo confiable solo desde acá |
| 11/jun/2026 | MP Point | `venta.mp_*` |
| 24-27/jun/2026 | Billing SaaS + `pagos_deudas` | — |

---

## 2. Línea de base: qué muestra Estadísticas hoy

Fuente: [EstadisticasPanel.tsx](src/components/EstadisticasPanel.tsx) (~1.100 líneas). Vive como pestaña de [FinanzasPanel.tsx](src/components/FinanzasPanel.tsx), gated por plan (`finance.statistics`).

**Tablas que consulta:** `ingresos` (facturación y casi todo), `Egresos` (costos), `barberos` (conteo de activos), `venta` (solo `fecha_hora`, para distribución horaria), `sucursal_settings` (capacidad diaria; único write del panel: upsert de `capacidad_diaria`).

**Agregación:** mensual, últimos 3/6/12 meses (selector), filtro por organización + sucursal opcional. Excluye `ingresos.estado='eliminado'`, `Egresos.estado≠'activo'`, `venta.estado≠'activo'`. Todo el agrupado por mes se hace **en el cliente** (fetch del rango completo y reduce en JS).

**Las 12 métricas con serie mensual** (cards con gráfico barra+línea, dialog de detalle con tabla, variación % m/m; el mes en curso se compara contra los mismos N días del mes anterior):

| # | Métrica | Cálculo | Fuente |
|---|---|---|---|
| 1 | Servicios | Σ `cantidad_de_servicios` | ingresos |
| 2 | Facturación | Σ `total_facturado` (BASE, sin recargos, **incluye productos**) | ingresos |
| 3 | Ticket Promedio | facturación ÷ servicios | derivada |
| 4 | Efectivo | Σ `efectivo` (BASE) | ingresos |
| 5 | "Mercado Pago" | Σ `mp` (BASE) — **en realidad es todo lo digital**: MP + transferencia + débito + crédito | ingresos |
| 6 | Costos Fijos | Σ `Monto` con `tipo_costo='fijo'` | Egresos |
| 7 | Costo Fijo por Servicio | costos fijos ÷ servicios | derivada |
| 8 | Costo Variable por Servicio | costos variables ÷ servicios | derivada |
| 9 | Ganancia por Servicio | ticket − costo fijo/serv − costo variable/serv | derivada |
| 10 | Rentabilidad % | (facturación − totalEgresos) ÷ facturación (totalEgresos = fijos+variables+semivariables) | derivada |
| 11 | Punto de Equilibrio | ceil(costos fijos ÷ ganancia por servicio), en clientes | derivada |
| 12 | Tasa de Ocupación | servicios ÷ (capacidad_diaria × barberos del mes × días lun-sáb) | ingresos + sucursal_settings |

**Sección "Comportamiento del Cliente"** (3 visualizaciones):
- Ventas por día de semana: promedio de `cantidad_de_servicios` por `ingresos.dia`, normalizado por ocurrencias reales de cada día en el rango.
- Ventas por hora: conteo de tickets `venta.fecha_hora` convertidos al timezone de la org, promedio diario.
- Horarios pico: top 3 combinaciones día+hora por cantidad de tickets `venta`.

**Características de la línea de base a tener presentes al comparar:**
- Nada se muestra **por barbero**, **por servicio/línea**, **por sucursal comparada**, ni **por cliente**.
- Los "servicios" y la "facturación" dependen de que exista cierre de caja; un día sin cierre = día invisible.
- "Semivariables" se cargan en Gastos pero no tienen card propia (solo entran en Rentabilidad).
- La etiqueta "Mercado Pago" y el "Ticket Promedio" tienen los sesgos señalados arriba (digital agrupado; productos dentro de facturación pero no del denominador).
- Los recargos cobrados y los montos "reales cobrados" (`total_cobrado`) existen en la base desde abr/2026 pero Estadísticas no los usa: muestra solo BASE.

---

## 3. Métricas ya calculadas en otros paneles, no expuestas en Estadísticas

| Métrica | Dónde vive | Fuente | Nota |
|---|---|---|---|
| Totales del día por barbero (efectivo/digital, servicios, productos) | [DailySummary.tsx](src/components/DailySummary.tsx) | venta + venta_pagos | la vista "por barbero" que Estadísticas no tiene, pero solo del día |
| Comisión devengada del día por barbero | DailySummary | venta × barberos.comision | `serviciosBase × %` |
| Comisión por productos (sobre ganancia) | DailySummary / useCashClosing / [comisionProductos.ts](src/lib/comisionProductos.ts) | venta_producto + productos_sucursal + comision_productos_config | persiste en `ingresos.comision_productos` |
| Arqueo real: cobrado con recargos vs base, por método | DailySummary / useTransactions.getDailySummary | venta_pagos | Estadísticas ignora recargos |
| Resumen por rango por barbero (efectivo, mp, facturado, comisión, servicios) | [MultiDayClosingSummary.tsx](src/components/MultiDayClosingSummary.tsx) | ingresos | es literalmente una tabla "estadística por barbero" escondida atrás de un botón + PIN en Caja |
| Devengado / pagado / saldo histórico por barbero (comisiones + sueldo fijo prorrateado + comisión de equipo + comisión productos + bonos) | [SueldosPanel.tsx](src/components/SueldosPanel.tsx) | ingresos + pagos_sueldos + comision_equipo_reglas + bono_fijo_ocurrencias + barberos | el costo laboral real del negocio; Estadísticas solo ve la parte que ya se pagó (vía Egresos) |
| Comisión de encargado sobre facturación del equipo | SueldosPanel (calculada al vuelo, nunca persistida) | comision_equipo_config/reglas × ingresos.total_facturado | con vigencias por fecha |
| Gastos del mes por categoría y tipo de costo, con recurrentes autogenerados | [GastosPanel.tsx](src/components/GastosPanel.tsx) / useGastos | Egresos + gastos_recurrentes | Estadísticas solo agrupa por tipo_costo, no por categoría |
| Saldo de deudas, cuotas pagadas/restantes, próximo vencimiento | [DeudasPanel.tsx](src/components/DeudasPanel.tsx) / useDeudas | deudas | pasivo del negocio, invisible en Estadísticas |
| Amortización mensual de inversiones y meses transcurridos | [InversionesPanel.tsx](src/components/InversionesPanel.tsx) / useInversiones | inversiones | tabla vacía hoy, pero la lógica existe |
| Historial de reservas por cliente (turnos con barbero/servicio/sucursal) | [ClienteDetailDialog.tsx](src/components/clientes/ClienteDetailDialog.tsx) | turnos.cliente_id | única métrica per-cliente de toda la app |
| Ocupación real de agenda (turnos del día por barbero, bloqueos, horarios) | [useAgendaData.ts](src/components/agenda/hooks/useAgendaData.ts) / AgendaPanel | turnos + bloqueos_agenda + horarios_trabajo | contrasta con la Tasa de Ocupación teórica de Estadísticas |
| Historial de cierres y anulaciones con motivo | CashClosingHistory / AnulacionesCierreHistory | ingresos + anulaciones_cierre | auditoría |
| Stock actual vs mínimo, historial de movimientos | ProductosConfig / StockHistoryDialog | productos_sucursal + movimientos_stock | alertas de reposición implícitas |

---

## 4. Relaciones que habilitarían métricas nuevas (derivables hoy, no calculadas en ningún lado)

Ordenadas por solidez del dato subyacente. **Esto es un inventario de posibilidades, no una propuesta de qué mostrar.**

### Con datos sólidos ya hoy

1. **Serie mensual por barbero** (facturación, servicios, ticket, % del total, comisión devengada): `ingresos.barbero_id` + `total_facturado`/`sueldo`. La agregación diaria ya existe; nadie la pivotea por mes. Ranking y evolución de cada barbero.
2. **Ventas de productos por barbero**: `venta_producto.barbero_id` (o `ingresos_items_productos`). Quién vende productos además de cortar. Dato desde abr-may/2026.
3. **Mix de servicios y de líneas**: `venta.servicio_id/servicio_nombre` + `servicios.linea_id`, o `ingresos.servicios_por_linea` (jsonb ya agregado por cierre). Distribución de qué se vende, evolución de cada servicio.
4. **Facturación por hora-silla**: `servicios.duracion_min` × ventas por servicio → $/minuto por tipo de servicio; qué servicio rinde más por tiempo de sillón (condicionado a que `duracion_min` esté bien cargada, ver §5.13).
5. **Desglose real por método de pago**: `venta_pagos.metodo_pago` separa MP / transferencia / débito / crédito / efectivo (Estadísticas hoy colapsa todo en "mp"). Además **recargos cobrados** (`recargo_monto`) como línea de ingreso propia. Solo desde 17/abr/2026.
6. **Costo real de los descuentos**: `ingresos.perdida` / `total_sin_descuento` (histórico completo) o `venta.descuento_pct` (por ticket). Cuánta plata se regala por mes y en qué ventas.
7. **Extras como negocio**: `venta_extra` → ingreso por extras, tasa de attach (extras ÷ servicios). Dato desde ene/2026.
8. **Estacionalidad fina**: ya hay día-de-semana y hora; falta cruzarlas con barbero y servicio (`venta.fecha_hora` + `barbero_id` + `servicio_id`): picos por barbero, servicios de fin de semana vs semana, etc.
9. **Costo laboral como % de facturación**: `ingresos.sueldo` + `comision_productos` (devengado por cierre) o `pagos_sueldos` (pagado) contra `total_facturado`. La serie mensual no existe en ningún panel.
10. **Rotación y antigüedad del equipo**: `barbero_historial` (fecha_inicio/fin, motivo_egreso) + `barberos.fecha_baja`. Desde jun/2026 hacia adelante.
11. **Anulaciones como señal operativa**: `venta.estado='anulado'` + `anulaciones_cierre` — frecuencia, montos y motivos.

### Con datos parciales (ventana corta o cobertura incompleta)

12. **Métricas de reservas** (desde abr/2026, ~288 turnos globales): reservas por día/hora, anticipación (`created_at` vs `fecha`), tasa de cancelación + motivos, % que eligió barbero (`eligio_barbero`), demanda por barbero en agenda. Cobertura: solo lo que entra por agenda — las ventas walk-in no tienen turno, y no hay vínculo turno→venta para medir conversión.
13. **Ocupación real** en lugar de la teórica: `horarios_trabajo` (oferta de horas reales por barbero) vs `turnos`/`venta` (demanda). Hoy la Tasa de Ocupación usa un número manual (`capacidad_diaria`, default 18) × lun-sáb fijo. Cobertura de `horarios_trabajo` incompleta (17 filas).
14. **Clientes nuevos por mes y origen**: `clientes.created_at` + `origen` (manual/importado/reserva) + `fecha_cliente_desde` (para importados). Frecuencia de visita/recurrencia **solo para clientes con reservas** (`turnos.cliente_id`); cumpleaños del mes (`fecha_nacimiento`); base contactable (`acepta_marketing` + telefono E.164). Desde abr/2026.
15. **Rentabilidad por producto/marca**: `venta_producto.precio_unitario` − `productos_sucursal.precio_costo` (o el snapshot congelado `ingresos_items_productos.precio_costo_snap`, que es más correcto históricamente). Condicionado al hueco §5.3.
16. **Rotación de stock / quiebres**: `movimientos_stock` con `stock_previo/resultante` permite días sin stock, velocidad de venta por producto, frecuencia de reposición. Volumen aún chico (32 movimientos).
17. **Flujo de caja proyectado**: ingresos reales (`ingresos.total_cobrado`) − egresos + vencimientos futuros (`deudas.fecha_proximo_pago`, `gastos_recurrentes.proxima_fecha`, sueldos por `barberos.fecha_cobro_dia`). Las piezas existen; nadie las junta.

### Hoy NO derivables (para dejar explícito qué falta capturar)

- **Gasto promedio por cliente / LTV / frecuencia real de visita**: `venta` no tiene `cliente_id`. Solo un proxy débil vía turnos (§5.1).
- **Tasa de no-show y conversión reserva→venta**: los turnos nunca se marcan `completado`/`no_asistio` y no se vinculan a la venta (§5.2).
- **Rentabilidad por servicio con costo de insumos**: no existe concepto de "costo de insumo por servicio" en ninguna tabla (los productos son ítems de venta, no insumos).

---

## 5. Huecos y limitaciones de calidad de dato

Señalados, no arreglados, como pide el alcance. Orden aproximado de impacto para un rediseño de Estadísticas.

1. **`venta` sin `cliente_id`** — la venta es anónima. Toda la familia de métricas de cliente (ticket por cliente, frecuencia, retención, LTV, top clientes) está estructuralmente bloqueada. El único puente cliente↔actividad es `turnos.cliente_id` (288 turnos vs 1.692 ventas: cubre una fracción, y sin FK constraint).
2. **Estados de turno nunca finalizados** — el CHECK permite `completado`/`en_curso`/`no_asistio` pero ningún código los setea (verificado por grep en `src/`): los turnos pasados quedan `pendiente`/`confirmado` para siempre. No-show rate y asistencia no son calculables; cualquier métrica por estado debe filtrar por fecha para no contar futuros como pendientes reales.
3. **`productos_sucursal.precio_costo` nullable y tratado como opcional** — [comisionProductos.ts:66](src/lib/comisionProductos.ts#L66) tiene el caso "Producto sin precio de costo: comisión = 0" como warning esperado. Toda métrica de margen/rentabilidad de productos es sospechosa hasta verificar cuántos productos tienen costo cargado (verificación pendiente: requiere query a datos). `margen_pct` también nullable.
4. **Doble fuente venta/ingresos sin reconciliación** — Estadísticas depende de cierres (`ingresos`): día sin cierre = facturación invisible; ventas post-cierre ("stale", detectadas en DailySummary) quedan fuera salvo regularización manual. A la inversa, cierres diferidos (`entry_mode='diferido'`) no tienen tickets `venta`: la distribución horaria y cualquier métrica basada en `venta` no los ve. Las dos fuentes no suman igual por construcción.
5. **Ventanas de nacimiento de columnas en `ingresos`** — `recargos_total`/`total_cobrado`/`efectivo_cobrado`/`digital_cobrado` (~abr/2026) y `productos_*`/`comision_productos` (~may/2026) valen 0/NULL hacia atrás. Una serie histórica de "cobrado real" o de productos que arranque antes de esas fechas mostraría ceros falsos.
6. **`venta_pagos` solo desde 17/abr/2026** — antes, el único dato de método es `venta.metodo_pago`. Y desde esa fecha `venta.metodo_pago` degrada a "método dominante": **sumar montos por `venta.metodo_pago` es incorrecto** para ventas con pago mixto; siempre desglosar desde `venta_pagos` con fallback legacy (patrón que el código ya aplica).
7. **`ingresos` legacy con `barbero_id` NULL posible** — el backfill de ene/2026 matcheó por nombre; lo no matcheado quedó NULL y los agrupados actuales (Sueldos, Estadísticas parciales) lo descartan en silencio. Columnas muertas que confunden: `deluxe`, `essencial`, `cantidad_de_50_por/20_por`, `Usuario` (mezcla nombres y UUIDs en texto). `servicios_por_linea` se arma matcheando el nombre del servicio contra el nombre de la línea (frágil a renombres).
8. **`ingresos.mp` y "Mercado Pago" en la UI** — la columna agrupa todo lo digital desde que existen 5 métodos (abr/2026). La card de Estadísticas etiqueta eso como "Mercado Pago": impreciso desde entonces. Igual con `total_facturado`: incluye productos desde may/2026, pero el denominador del Ticket Promedio sigue siendo solo servicios.
9. **`Egresos.Categoria` texto libre** — sin catálogo ni normalización: "Alquiler" vs "alquiler" vs "Alquiler local" cuentan distinto. Los egresos automáticos (sueldos, deudas, recurrentes) sí usan categorías consistentes generadas por código. `inversion_id`/`gasto_recurrente_id` sin FK real → huérfanos posibles si se borra el padre (y `inversiones` permite hard delete).
10. **Teléfonos post-migración 20/may/2026** — `clientes.telefono` no convertible se **preservó** sin normalizar (mezcla de formatos posible); en `turnos`/`barberos` se **limpió a NULL** (pérdida deliberada). Duplicados de cliente por teléfono detectables vía la vista `_phone_dups_report` que dejó la migración.
11. **Diez tablas en cero** — features sin datos que un rediseño no debería asumir pobladas: `inversiones`, `pagos_deudas`, `bono_fijo_config/ocurrencias`, `venta_descuentos_aplicados` (creada 30/abr/2026 y **ningún código la escribe** — tabla muerta), `ReportesMensuales` (legacy), `subscription_payments`, `plan_features`, `push_tokens`, `user_pins`.
12. **Escala multi-tenant** — los conteos de este documento son de la plataforma entera (29 orgs). Por organización/sucursal individual el volumen es mucho menor; los gráficos nuevos deben diseñarse asumiendo pocos datos por tenant (estados vacíos, rangos cortos).
13. **`servicios.duracion_min` default 30** — si no se personalizó por servicio, cualquier métrica de $/hora o de capacidad basada en duración hereda el default (verificación pendiente contra datos).
14. **`ingresos.dia` en texto español** — con tildes ('miércoles', 'sábado'); el mapping actual de Estadísticas lo maneja con lowercase, pero es un dato derivable de la fecha que se guarda como texto y podría divergir (locale del cliente al momento del cierre).
15. **Tasa de Ocupación manual** — `capacidad_diaria` es un número que el usuario tipea (default 18) y la fórmula asume lun-sáb para todos: no considera `horarios_trabajo`, `bloqueos_agenda` ni francos reales. Es la métrica actual con menor respaldo en datos.

---

## Apéndice: RPCs y vistas relevantes

- **Vistas:** `barberos_safe` (barberos sin PII, para rol barber), `_phone_migration_report` y `_phone_dups_report` (diagnóstico de la migración de teléfonos).
- **RPCs que tocan datos de negocio:** `registrar_movimiento_stock` (stock atómico + auditoría), `create_cliente_with_sucursal`, `import_clientes_with_sucursal`, `soft_delete_cliente`, `sucursal_tiene_historial`, `get_organization_subscription_access`, `notif_emit_view_event`.
- **Edge functions:** `lookup-cliente-by-phone` (portal de reservas), `set-pin`/`validate-pin`, gestión de cuentas de sucursal.

---

## Estadísticas — Exploración técnica previa a Fase 4

**Fecha:** 14 de julio de 2026. **Alcance:** factibilidad técnica y arquitectura para la reestructuración en 4 secciones (Resumen, Plata real, Equipo, Servicios y clientes). Solo lectura: código de `src/`, schema vivo y conteos reales por query directa (esta vez sí se consultaron datos, a diferencia del relevamiento original). No se modificó código.

**Nota de alcance:** la lista canónica de las ~20 métricas no está escrita en ningún documento del repo; la lista de abajo se armó mapeando las 4 secciones acordadas contra los derivables del §4. Vale como lista de trabajo para validar viabilidad; la selección final se cierra en el plan de build.

### 1. Arquitectura actual

**Chart library.** Recharts, envuelto en el wrapper shadcn [chart.tsx](src/components/ui/chart.tsx) (`ChartContainer`/`ChartTooltip`/`ChartTooltipContent`, que inyecta la config de colores por CSS vars). Solo dos archivos importan Recharts en toda la app: `ui/chart.tsx` y `EstadisticasPanel.tsx`. Tipos en uso: **únicamente `ComposedChart` + `Bar` + `Line`** (más ejes/grid). **No existe ningún `PieChart`, `Pie`, `RadialBar` ni donut en ninguna parte de la app** — el donut es pieza 100% nueva, aunque el costo es bajo: la librería ya está instalada y el wrapper `ChartContainer` (tooltips, colores por token) le sirve igual. Tampoco existe ninguna barra horizontal Recharts (`layout="vertical"`: 0 usos).

**Card de métrica.** Patrón intermedio: no es copy-paste puro pero tampoco es componente reutilizable. Dentro de `EstadisticasPanel.tsx` hay un tipo `MetricCardDef` (title, dataKey, icon, colores, formatters, description) y tres piezas locales que lo consumen: `renderMetricCard()` (la card con valor grande + badge de variación + mini-chart), `MetricChart` (el barra+línea de 40px de alto) y `MetricDetailDialog` (chart grande + tabla mensual al click). Diez de las 12 cards pasan por `renderMetricCard`; dos (Servicios y Tasa de Ocupación) duplican el JSX inline con variantes. **Nada de esto vive en `ui/` ni es importable desde otro panel.** Para el build: extraer estas tres piezas a componentes compartidos es el paso previo natural; el "donut card" y el "ranking card" nuevos pueden calzar en el mismo shell de card (header con título+descripción+icono, valor grande, chart abajo) cambiando solo el cuerpo.

**Fetching/agregación.** Confirmado: fetch-completo-y-reduce-en-cliente, sin cambios respecto del relevamiento. `useEffect` + `useState` + `Promise.all` de 4 queries planas (`ingresos`, `Egresos`, `barberos`, `venta` solo `fecha_hora`) filtradas por org/sucursal/rango, y todo el agrupado mensual en JS. No usa react-query (que sí existe en el proyecto, pero solo en hooks de tareas/notificaciones). No hay RPC ni vista de agregación para estadísticas.

**¿Hasta dónde aguanta ese patrón?** Volúmenes reales por query directa (org más grande de la plataforma, historia completa): `venta` 1.591 filas, `venta_pagos` 728, `ingresos` 511, `clientes` 396, `turnos` 252, `Egresos` 72. Un fetch de 12 meses de la org más activa anda hoy en ~1.500 filas por tabla; el patrón es cómodo hasta ~10-20k filas por query (unos pocos cientos de KB). Al ritmo actual (~250 ventas/mes en la org top) eso da **3-5 años de margen**. Conclusión: **ninguna métrica nueva necesita RPC/vista**, incluidas las por barbero (salen del mismo fetch de `ingresos` que ya se hace, ampliando el `select` a las columnas que faltan) y clientes nuevos por origen (una query de ~400 filas). La única mejora de fetching que vale la pena en el build es de higiene, no de escala: mover la data a un hook (`useEstadisticasData` o uno por sección) y considerar react-query para cache entre cambios de período.

### 2. Viabilidad de cada métrica nueva contra el schema real

Verificado contra las tablas vivas (columnas + conteos reales), no contra el documento de arriba. Formato: métrica → fuente → costo de query → veredicto.

**Sección 1 — Resumen.** Reagrupa existentes (facturación, servicios, ticket, rentabilidad, ocupación). Sin métricas nuevas que validar; si se suma comparación entre sucursales, es el mismo fetch sin el filtro de sucursal + `group by sucursal_id` en cliente. ✅ Viable, costo cero de queries nuevas.

**Sección 2 — Plata real.** Las 6 candidatas salen de **un solo fetch ampliado de `ingresos`** (el que ya existe, agregando columnas al select) más el par `venta`+`venta_pagos`:

| Métrica | Fuente (columnas verificadas) | Veredicto |
|---|---|---|
| Total cobrado real (con recargos) | `ingresos.total_cobrado` | ✅ 1 query (la existente). Ventana: 0/NULL antes de abr/2026 |
| Recargos cobrados | `ingresos.recargos_total` | ✅ misma query |
| Efectivo vs digital real | `ingresos.efectivo_cobrado` / `digital_cobrado` | ✅ misma query |
| Descuentos regalados | `ingresos.perdida` / `total_sin_descuento` | ✅ misma query, historia completa |
| Costo laboral % de facturación | `ingresos.sueldo` + `comision_productos` vs `total_facturado` | ✅ misma query |
| Desglose real por método (donut 5 métodos) | `venta_pagos.metodo_pago`+`monto` con fallback `venta.metodo_pago`+`total_final` | ✅ 2 queries chicas. **Dato real: 882 de 1.692 ventas no tienen filas en `venta_pagos`** (pre 17/abr/2026) — el fallback no es opcional, es la mitad de la historia. El patrón ya existe en `useTransactions.ts` |

**Sección 3 — Equipo.** La buena noticia verificada: **`ingresos.barbero_id` tiene 0 NULLs sobre 535 filas** — el temor del §5.7 (legacy sin match) no se materializa en los datos actuales. Todo el bloque por barbero sale del fetch de `ingresos` ya existente + el de `barberos` ya existente (para nombres):

| Métrica | Fuente | Veredicto |
|---|---|---|
| Ranking facturación por barbero | `ingresos.barbero_id` + `total_facturado` | ✅ 0 queries nuevas |
| Servicios por barbero | `ingresos.cantidad_de_servicios` | ✅ ídem |
| Ticket promedio por barbero | derivada de las dos anteriores | ✅ |
| Comisión devengada por barbero | `ingresos.sueldo` (+ `comision_productos`) | ✅ ídem |
| Evolución mensual por barbero (multilínea) | misma data pivoteada mes×barbero | ✅ solo trabajo de UI |
| Venta de productos por barbero | `venta_producto.barbero_id` + `subtotal` | ✅ 1 query nueva. ⚠️ 22 filas en toda la plataforma: diseñar el estado vacío primero |
| Rotación / antigüedad del equipo | `barbero_historial` (fecha_inicio/fin, motivo_egreso) | ✅ 1 query nueva. ⚠️ solo desde jun/2026, 31 filas |

**Sección 4 — Servicios y clientes:**

| Métrica | Fuente | Veredicto |
|---|---|---|
| Mix de servicios (donut/ranking) | `venta.servicio_nombre` + `total_final` | ✅ 0 queries nuevas: ampliar el select de la query de `venta` que hoy solo trae `fecha_hora`. Sesgo conocido: cierres diferidos no tienen tickets |
| Mix por línea | `venta.servicio_id` → `servicios.linea_id` → `lineas` (catálogos de 21 y 2 filas) | ✅ 2 queries de catálogo chicas, join en cliente. Más sólido que el jsonb `servicios_por_linea` (matching por nombre, frágil) |
| Extras: ingreso + tasa de attach | `venta_extra` — sin `organization_id` propio, pero con FK real a `venta` → embed PostgREST `venta_extra(precio_extra,cantidad)` en la misma query de venta | ✅ 1 query (embebida) |
| Clientes nuevos por mes y origen | `clientes.created_at` + `origen` (+ `fecha_cliente_desde` para importados) | ✅ 1 query de ~400 filas. ⚠️ **dato real: 393 'importado', 20 'manual', 0 'reserva'** — hoy el gráfico sería una sola barra gigante de import Fresha; diseñar para que el origen 'reserva' aparezca cuando exista |
| Reservas: tasa de cancelación, anticipación (`created_at` vs `fecha`), % eligió barbero | `turnos` (columnas verificadas: `estado`, `cancelado_motivo`, `eligio_barbero`, `created_at`) | ✅ 1 query. ⚠️ ~288 turnos globales, ventana corta |
| Cumpleaños del mes / base contactable | `clientes.fecha_nacimiento` / `acepta_marketing`+`telefono` | ✅ misma query de clientes. ⚠️ solo 54/413 con fecha de nacimiento |

**NO viables con query razonable** (reconfirmado contra datos vivos, no forzar):
- **LTV / frecuencia / gasto por cliente** — `venta` sigue sin `cliente_id` (verificado en schema). Bloqueado estructuralmente.
- **No-show y conversión reserva→venta** — verificado en datos: los 288 turnos están en `pendiente` (253) o `cancelado` (35); **cero** `completado`/`no_asistio`/`confirmado`. La tasa de cancelación sí es calculable; la de asistencia no.
- **$/hora-silla débil** — solo 3 de 21 servicios tienen `duracion_min` distinta del default 30. Si entra, marcarla como estimativa o dejarla para cuando el catálogo esté curado.
- **Margen de productos, a medias** — 5 de 16 `productos_sucursal` sin `precio_costo`. Ingreso por productos ✅; margen/rentabilidad ⚠️ parcial.

### 3. Componentes de UI: crear vs reusar

| Pieza | Estado | Acción |
|---|---|---|
| Shell de card de métrica (header + valor + variación + chart) | Existe como funciones locales de EstadisticasPanel (`MetricCardDef`/`renderMetricCard`) | **Extraer** a `estadisticas/MetricCard.tsx` (o `ui/` si se quiere generalizar) |
| Chart barra+línea mensual | Existe (`MetricChart` local) | **Extraer** junto con la card |
| Dialog de detalle (chart grande + tabla) | Existe (`MetricDetailDialog` local) | **Extraer**; sirve tal cual para las métricas nuevas de serie mensual |
| Donut chart card | **No existe en ninguna parte de la app** | **Crear** (`DonutCard.tsx`): `Pie` de Recharts dentro del `ChartContainer` existente; tokens `--chart-*` ya definidos y en uso |
| Barra horizontal de ranking | **No existe** (0 usos de `layout="vertical"`) | **Crear** (`RankingBarCard.tsx`). Alternativa sin Recharts: filas con [progress.tsx](src/components/ui/progress.tsx) (ya en `ui/`) + nombre + valor — más simple, mejor para 3-8 barberos con labels largos. Decidir en el plan; recomendación: progress-rows |
| Wrapper de charts (`ChartContainer`/tooltip/config de colores) | Existe ([chart.tsx](src/components/ui/chart.tsx)) | **Reusar** para todo |
| Tokens de color de charts | Existen (`--chart-cash/mp/cost/orange/amber/purple/indigo` + `--primary`) | **Reusar**; el donut de 5 métodos de pago necesita paleta categórica — verificar en el plan si alcanzan o falta 1-2 tokens |

### 4. Estimación de archivos y partición del build

**Archivos tocados/creados (build completo): ~12-14.**
- 1 existente reescrito: `EstadisticasPanel.tsx` (pasa de ~1.100 líneas monolíticas a orquestador de 4 secciones).
- ~10-12 nuevos en `src/components/estadisticas/`: `MetricCard.tsx`, `MetricChart.tsx`, `MetricDetailDialog.tsx`, `DonutCard.tsx`, `RankingBarCard.tsx`, `SeccionResumen.tsx`, `SeccionPlataReal.tsx`, `SeccionEquipo.tsx`, `SeccionServiciosClientes.tsx`, `useEstadisticasData.ts` (+ posibles `types.ts`/`formatters.ts`).
- 0 migraciones de base, 0 RPCs, 0 vistas. `FinanzasPanel.tsx` sin cambios (solo monta la pestaña). Posible ajuste menor en `index.css` si faltan tokens categóricos para el donut.

**Recomendación: partir en 5 builds, no 4 ni 1.**

| Build | Contenido | Por qué en ese orden |
|---|---|---|
| 0 — Infraestructura | Extraer MetricCard/MetricChart/DetailDialog, crear DonutCard + RankingBarCard, hook de datos. Panel actual sigue funcionando igual (refactor sin cambio visual) | Deja el terreno listo y es verificable por comparación 1:1 con lo actual |
| 1 — Resumen | Reagrupar existentes | Valida la infra con métricas conocidas, riesgo mínimo |
| 2 — Plata real | 6 métricas, casi todas del fetch de `ingresos` ampliado | Una sola fuente nueva de complejidad: el fallback venta_pagos/venta |
| 3 — Equipo | Ranking + multilínea por barbero | Primera UI nueva de verdad (ranking); data ya validada sin NULLs |
| 4 — Servicios y clientes | Mix, extras, clientes por origen, reservas | La de más queries nuevas y más estados vacíos por diseñar; conviene llegar con todo lo demás estable |

El monolito actual de 1.100 líneas es el argumento más fuerte contra un build único: cada sección nueva agregaría ~200-300 líneas a un archivo ya difícil de revisar, y un error de agregación en una sección bloquearía el review de las otras. Con el build 0 hecho, cada sección es un PR chico, autocontenido y verificable contra datos reales de una org.

---

## Estadísticas — Build 0 (Infraestructura)

**Fecha:** 14 de julio de 2026. Refactor puro — sin cambio de métricas, cálculos ni panel visible. `EstadisticasPanel.tsx` pasa de monolito (~1.100 líneas con 3 piezas de UI definidas localmente) a orquestador que consume `src/components/estadisticas/`.

### Archivos creados

| Archivo | Contenido |
|---|---|
| `estadisticas/types.ts` | `DerivedMonthlyMetrics`, `MetricCardDef`, `varKeyMap` — compartidos por las 3 piezas de card y el panel |
| `estadisticas/dateHelpers.ts` | `getWorkDaysInMonth`, `getWorkDaysUpTo`, `calcVariation` — extraídos tal cual |
| `estadisticas/MetricChart.tsx` | El barra+línea de 40px, extraído. Ganó 2 props opcionales (default = comportamiento actual): `size` ('sm'\|'lg') y `tooltipFormatFn` — ver hallazgo Servicios abajo |
| `estadisticas/MetricDetailDialog.tsx` | El dialog de detalle (chart grande + tabla), extraído sin cambios |
| `estadisticas/MetricCard.tsx` | La card (valor + badge de variación + mini-chart), extraída de `renderMetricCard`/`renderVariationBadge`. Props nuevas para las 2 variantes reales (ver abajo): `className`, `chartSize`, `tooltipFormatFn`, `children` |
| `estadisticas/DonutCard.tsx` | **Nuevo, sin consumidor todavía.** Shell de card + `Pie` de Recharts dentro del `ChartContainer` existente + leyenda con color/label/%. Props genéricas: `title`, `description?`, `icon?`, `data: {label,value,color}[]`, `total?`, `formatValue?` |
| `estadisticas/RankingBarCard.tsx` | **Nuevo, sin consumidor todavía.** Filas con `ui/progress.tsx` (nombre + barra + valor), ordenadas de mayor a menor. Props genéricas: `title`, `description?`, `icon?`, `data: {label,value,formattedValue?}[]` |
| `estadisticas/useEstadisticasData.ts` | El `Promise.all` de las 4 queries (ingresos/Egresos/barberos/venta) + la agregación mensual (incluida la lógica de "parcial" para comparación mismo-día), extraído tal cual. Mismos filtros org/sucursal/rango, mismo resultado. **No** se tocó el patrón de fetching ni se agregó react-query |

`EstadisticasPanel.tsx` (modificado): ahora importa las 3 piezas + el hook en vez de definirlas localmente. Sin cambios de JSX en `behaviorSection` (Comportamiento del Cliente) ni en la lógica de `derivedMetrics` — se movieron literal las funciones de fecha usadas ahí, no se reescribieron.

### Confirmación: el panel se ve y funciona igual

Sí. Verificado por comparación 1:1 contra el código previo (no hay entorno visual corrido en esta sesión, la validación es de lectura de diff + tipos):
- Las 10 cards que ya usaban `renderMetricCard` (Facturación, Ticket Promedio, Efectivo, Mercado Pago, Costos Fijos, Costo Fijo/Servicio, Costo Variable/Servicio, Ganancia/Servicio, Rentabilidad, Punto de Equilibrio) pasan a `<MetricCard>` sin ningún prop nuevo — comportamiento idéntico.
- `behaviorSection`, `fetchCapacidad`/`saveCapacidadDiaria`, y el estado de loading (skeleton) no se tocaron.
- `npx tsc --noEmit` pasa limpio (exit 0).

### Servicios y Tasa de Ocupación — sí migraron, con 2 variantes reales documentadas (no forzadas)

Ambas migraron a `MetricCard`, pero cada una tenía una diferencia real de comportamiento frente al shell común. En vez de forzarlas a verse igual que las demás (lo que hubiera sido un cambio visual encubierto) o abortar el build, se resolvieron con props aditivas opcionales que no alteran ninguna de las 10 cards existentes:

1. **Servicios** — el chart inline usaba `h-52` y `fontSize 11` (más grande que el `h-40`/`fontSize 10` estándar), y su tooltip mostraba el formateador **largo** (`"42 servicios"`) en vez del corto que usan las demás cards (`"42"`). Esto último es una inconsistencia real preexistente que no estaba documentada. Resuelto con `chartSize="lg"` + `tooltipFormatFn={serviciosCard.formatFn}` en el único consumidor; el default de ambas props preserva el comportamiento de las otras 10 cards sin cambios.
2. **Tasa de Ocupación** — ya usaba `MetricChart` (no duplicaba el chart), pero el `CardContent` tenía contenido extra debajo (input de capacidad diaria + `Collapsible` de explicación) que no existe en ninguna otra card. Resuelto agregando un slot `children` opcional a `MetricCard`, renderizado después del chart; el panel sigue armando ese JSX (con sus `stopPropagation` intactos) y solo lo pasa como children.

**Criterio para los próximos builds:** este patrón (props opcionales con default = comportamiento actual, nunca forzar una card a la apariencia de otra) es el que hay que seguir si una métrica nueva de las Secciones 1-4 necesita algo que el shell de `MetricCard` no contempla — extender antes de bifurcar.

---

## Estadísticas — Build 1 (Resumen)

**Fecha:** 14 de julio de 2026 (con una revisión posterior, mismo día, que reemplaza la fórmula de Ocupación por una versión más simple confirmada por el dueño — ver más abajo). Primera sección real de la reestructuración: Resumen (Facturación, Servicios, Ticket Promedio, Rentabilidad %, Punto de Equilibrio, Tasa de Ocupación), con el tooltip de Servicios igualado al resto. Secciones 2-4 no tocadas.

### Archivos creados

| Archivo | Contenido |
|---|---|
| `estadisticas/useOcupacionResumen.ts` | **Vigente.** Fetch de `barberos` (id + `roles_equipo`), `horarios_trabajo` general (`barbero_id IS NULL`) y `servicios.duracion_min` (activos) para el rango de meses; devuelve horas operativas por mes (completas y parciales para el mes anterior, para la comparación mismo-día) + duración promedio + flag de cobertura |
| ~~`estadisticas/ocupacionHelpers.ts`~~ | **Huérfano de Estadísticas desde la revisión de este mismo día.** Funciones puras de resolución de horario efectivo por barbero/día con intersección override↔general y resta de `bloqueos_agenda`. No se borró: la lógica de horario-por-barbero-individual es exactamente lo que necesitará Agenda si en algún momento muestra disponibilidad real por barbero. Sigue en el repo, sin ningún import activo. |
| ~~`estadisticas/useOcupacionData.ts`~~ | **Huérfano de Estadísticas, mismo motivo.** Hook que consumía `ocupacionHelpers.ts` para la versión "por barbero" de la Tasa de Ocupación. Reemplazado en `EstadisticasPanel.tsx` por `useOcupacionResumen.ts`. Sigue en el repo, sin ningún import activo. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `EstadisticasPanel.tsx` | Nueva Sección 1 "Resumen" (header `text-xs uppercase tracking-wide text-muted-foreground`, patrón ya usado en `NotificationsConfig.tsx`) con las 6 métricas pedidas. Tooltip de Servicios sin `tooltipFormatFn` (usa el corto, igual que las demás). `tasaOcupacion` calculada con la fórmula plana (ver abajo). Se sacó el `Collapsible` "¿Cómo se calcula?" de la card de Ocupación — la card muestra el número y el banner de cobertura si corresponde, nada más (`Info`/`ChevronDown`/`Collapsible*`/`ocupacionOpen` quedaron sin uso y se retiraron). Grupos "📈 Ingresos y Ventas" y "💰 Costos y Rentabilidad" se achican a las 6 métricas que Build 2 todavía no reubica; el grupo "⚡ Capacidad y Eficiencia" desaparece |
| `estadisticas/MetricCard.tsx` | Prop opcional `banner?: ReactNode`, renderizada antes del valor (no después del chart como `children`) — se usa para el aviso de cobertura, antepuesto al número en vez de solo acompañarlo |

### Fórmula real de Tasa de Ocupación (versión vigente)

Reemplaza la versión "por barbero" de la iteración anterior de este mismo build. Fórmula plana confirmada por el dueño del negocio:

> Ocupación = horas vendidas ÷ (barberos activos con rol barbero × horas que abre el local ese día) × 100

- **Numerador — horas vendidas:** `ingresos.cantidad_de_servicios` del mes × duración promedio de los servicios activos del catálogo (`servicios.duracion_min`, `activo=true, eliminado=false`, con fallback a 30 min si algún valor viniera nulo o ≤0) ÷ 60. Sigue siendo un promedio del catálogo, no un cruce por servicio puntual vendido (confirmado otra vez: `ingresos` no guarda qué servicio fue cada uno) — la card lo deja explícito con "(estimado)" en su descripción, visible siempre, sin desplegable.
- **Denominador — horas operativas:** para cada día del rango, horas del horario **general** de la sucursal para ese día de semana (`horarios_trabajo` con `barbero_id IS NULL`, sumando todas las ventanas de ese día por si hay turno partido) × cantidad de **barberos activos con rol `barber`** (mismo filtro `roles_equipo.includes('barber')` que ya usa el fix de encargados en `DailySummary.tsx` — no el conteo genérico de "barberos activos" que mezclaba roles). **No mira horario individual de ningún barbero.** **No resta bloqueos ni vacaciones puntuales** — decisión explícita: la capacidad instalada es la del equipo activo completo, sin importar quién trabajó cada día en particular.
- **Tasa:** (horas vendidas ÷ horas operativas) × 100.
- **Mes en curso:** igual que el resto del panel, ambos lados se cortan en el día de hoy, y la variación % contra el mes anterior compara los mismos primeros N días de ambos lados.
- **Cantidad de barberos — sin reconstrucción histórica, tal como se pidió:** se usa la cantidad ACTUAL de barberos activos con rol barbero para calcular TODOS los meses del rango (incluidos los más viejos), no la que había en cada mes vía `barbero_historial`. **Se marca la distorsión que esto puede introducir, sin resolverla:** si el equipo creció o se achicó durante el período mostrado (3/6/12 meses), los meses viejos quedan divididos por un número de barberos que no es el que realmente trabajaba entonces — la ocupación de esos meses puede leerse artificialmente alta o baja según para qué lado cambió el equipo. Queda para una decisión aparte si vale la pena resolverlo con `barbero_historial` en un build futuro.

### Aviso de cobertura — redefinido, con una ambigüedad marcada

Ya no depende de horarios por barbero. Se implementó como: **el banner aparece si la sucursal tiene CERO filas de horario general cargadas en total** (`horarios_trabajo` con `barbero_id IS NULL, activo=true` — ninguna fila, de ningún día). Mensaje: "El horario general de la sucursal no está configurado — el número puede no ser preciso."

**Ambigüedad marcada, no resuelta unilateralmente:** la consigna decía "si, para algún día de semana relevante en el rango, NO existe ningún horario general cargado", lo que también admite una lectura día-por-día (¿falta el lunes específicamente?). Se descartó esa lectura literal porque, contra cualquier rango real de 3/6/12 meses, los 7 días de la semana ISO ocurren siempre — así que un negocio con un franco semanal legítimo y bien configurado (ej. cerrado los domingos, sin fila de horario general para ese día) dispararía el aviso permanentemente, todo el año, por una ausencia de horario que es intencional, no un dato faltante. La interpretación implementada ("nunca configuró SU horario general", cero filas en total) evita ese falso positivo casi universal y calza con la frase de la propia consigna ("o sea, si el local nunca configuró su horario general"). Si la intención real era la lectura día-por-día, avisar para ajustarlo.

### Tooltip de Servicios — confirmado igualado

`tooltipFormatFn` se sacó del único consumidor (`EstadisticasPanel.tsx`); `MetricChart` cae a su default (`formatValue`, el mismo corto que usan las otras 10 cards). `chartSize="lg"` se mantiene sin cambios.

### `sucursal_settings.capacidad_diaria` — sigue huérfano, sin resolver todavía

Sin cambios respecto de la nota anterior: el input y el fetch/save de `capacidad_diaria` se dejaron intactos (con su leyenda de "ya no se usa"), no forman parte de este fix. Decisión de quitarlo o reutilizarlo sigue pendiente para una sesión aparte.

### Transitorio conocido (no es un hallazgo nuevo, es el costo esperado de partir el build en 5)

"📈 Ingresos y Ventas" y "💰 Costos y Rentabilidad" quedan con headers en el estilo emoji viejo (`text-lg`) conviviendo con el header nuevo de "Resumen" (`text-xs uppercase tracking-wide`) hasta que Build 2 los reemplace. Ambos grupos legacy quedan con menos cards de las que tenían (2 y 4 respectivamente, contra 4 y 6 antes) porque las 4 que se mudaron a Resumen se sacaron de ahí — no se dejaron duplicadas.

### Hallazgo incidental — código muerto retirado (sin impacto visual)

Al reescribir el archivo se encontraron y no se re-trasladaron 4 elementos sin ningún consumidor en todo el archivo (confirmado por grep antes de tocar nada): el const `chartConfig` (líneas 77-90 del original), el import `CardDescription`, el import `differenceInWeeks`, el import `eachDayOfInterval`, y la función `formatPercent`. Ninguno se usaba en ningún render ni cálculo — no son parte del candado de alcance de este build (no son ninguna de las 3 piezas a extraer ni las 2 a crear), y su remoción no cambia nada observable. Se documentan acá por transparencia, no como una limpieza adicional buscada.

### Decisiones de esta sesión — criterio para Builds 2-4

- **RankingBarCard = progress-rows, no Recharts.** Confirmado en la implementación: no importa nada de `recharts`, solo `ui/progress.tsx`. Coherente con la recomendación de la exploración técnica.
- **Clientes nuevos por origen = detalle secundario, no protagonista** en la Sección 4 (Servicios y clientes): con 393 'importado' vs 20 'manual' vs 0 'reserva' (dato real relevado), un donut o ranking de origen sería una sola barra dominante sin valor analítico hoy. Mostrar como dato de contexto (ej. una línea de texto o card chica), no como gráfico principal de la sección.
- **% eligió barbero sí entra a Sección 4; cancelación y anticipación no.** `turnos.eligio_barbero` es un booleano simple con dato completo y significado estable. La tasa de cancelación y la anticipación (`created_at` vs `fecha`) quedan fuera del build inicial: son válidas como dato pero de menor prioridad frente a las ~20 métricas ya acordadas, y compiten por espacio en una sección que ya tiene mix de servicios + líneas + extras + clientes por origen. Quedan anotadas como candidatas para una iteración posterior de la Sección 4, no descartadas.
