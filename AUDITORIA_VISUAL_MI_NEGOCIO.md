# Auditoría Visual — Mi Negocio + Configuración

> **Modo:** Exploración / solo lectura. Generado el 2026-06-12.
> **Reglas contrastadas:**
> 1. **DrawerForm unificado** — ghost "Cancelar" izquierda, "Guardar" derecha; destructivos `variant="destructive"`; formularios 8+ campos condicionales → Dialog centrado.
> 2. **TabBadge + kebab (⋮)** — aplicado en DiscountsConfig, ExtrasConfig, LinesConfig, ServicesConfig, ProductosConfig, ProductosGlobalConfig. Footer drawer con botones grises neutros, solo el texto cambia color para destructivos/de estado.
> 3. **Paleta** — `--primary` unificado a `224 43% 20%` (#1E2A4A navy) en `src/index.css`.
>
> **Tags:** ✅ CUMPLE · ⚠️ PARCIAL · ❌ NO_APLICA (debería seguir el patrón y no lo hace) · 🆕 NO_CUBIERTO (caso que las reglas no contemplan)

---

## 0. Baseline — Componentes compartidos y tokens

### DrawerForm — `src/components/ui/drawer-form.tsx`
**Estructura:** Sheet lateral derecho (Radix Dialog). Header fijo (título + X), body scrolleable, footer fijo con `border-t px-6 py-4`. Tamaños `sm` (380px) / `md` (520px); mobile `calc(100%-48px)`. **El footer es un slot libre: el componente NO impone orden ni variantes de botones** — cada caller lo arma. El ejemplo comentado en el propio archivo (líneas 60-75) muestra el patrón canónico: `justify-between` con ghost "Cancelar" izquierda + "Guardar" derecha.
**Estética:** 100% tokens (`bg-card`, `border-l`). Animación slide 500ms in / 300ms out.
**Microcopy:** "Cerrar" (sr-only del botón X). Comentario `// EJEMPLO DE USO (borrar después de validar)` quedó en producción.
**Tag:** ✅ — es la base del patrón. **DUDA:** el cumplimiento de la regla 1 depende de cada caller; se verifica componente por componente abajo. 🆕 el comentario de ejemplo "borrar después de validar" sigue presente.

### TabBadge — `src/components/ui/TabBadge.tsx`
**Estructura:** span contador para tabs. Activo: `bg-primary text-primary-foreground`; inactivo: borde + `text-muted-foreground` (via `group-data-[state]`).
**Estética:** 100% tokens. `text-[10px] font-semibold tabular-nums`, `h-4 min-w-[1rem]`.
**Tag:** ✅ — patrón canónico de regla 2.

### StatusPill — `src/components/ui/StatusPill.tsx`
**Estructura:** pill de estado con 5 variantes (`success/neutral/info/warning/error`). Dot para success/neutral/info; ícono Lucide (Clock/AlertTriangle) para warning/error, suprimible con `icon={false}`.
**Estética:** 100% tokens `--status-*` (+ `bg-secondary` para neutral). `text-xs font-semibold px-2.5 py-0.5 rounded-full`.
**Tag:** 🆕 — componente nuevo (migración reciente), no cubierto por las 3 reglas documentadas. Es de facto la 4ª regla del sistema.

### TagPill — `src/components/ui/TagPill.tsx`
**Estructura:** pill categórica de un solo tono (celeste/azul), solo texto.
**Estética:** 100% tokens `--status-info-*`. `text-[10px] px-2 py-0.5`.
**Tag:** 🆕 — ídem StatusPill; reemplazo de `variant="category"` con color dinámico.

### Badge — `src/components/ui/badge.tsx`
**Estructura:** CVA con variantes `default/secondary/destructive/outline/category`. `category` usa objeto `categoryColors` (hoy solo `default: bg-secondary...`) + tamaños `sm`/`md`.
**Estética:** tokens en todas las variantes.
**Tag:** ✅ — DUDA: convive con StatusPill/TagPill; las reglas no documentan cuándo usar cada uno.

### EntityColorBar — `src/components/ui/EntityColorBar.tsx`
**Estructura:** barrita lateral de color de entidad (línea/marca). Color por `style` inline (hex dinámico de DB), fallback `hsl(var(--muted-foreground))`.
**Tag:** 🆕 — color dinámico inline es intencional (color elegido por el usuario); las reglas no contemplan este caso.

### ShowMoreDivider — `src/components/ui/ShowMoreDivider.tsx`
**Estructura:** divisor expandible "+N miembros más" / "Ver menos" con ChevronDown rotante.
**Estética:** 100% tokens. **Microcopy:** label default `'miembros más'` — acoplado a Equipo aunque se usa en otras listas.
**Tag:** 🆕 — patrón de paginación visual no documentado.

### Tokens — `src/index.css`, `src/lib/theme.ts`, `tailwind.config.ts`
- `--primary: 224 43% 20%` confirmado en light (índex.css:32). **Dark mode usa `234 50% 65%`** (línea 93) — la regla 3 solo menciona el valor light.
- Tokens de estado completos: `--status-{success,warning,error,info,purple,indigo}` con `-foreground` y `-bg` (definidos en `theme.ts` como preset "Navy" y aplicados runtime via `setTheme()`).
- No hay token "neutral" de estado: StatusPill neutral usa `bg-secondary`.
- index.css no tiene hex hardcodeados (todo HSL vars).
**Tag:** ✅ regla 3 cumplida en light. **DUDA:** ¿el valor dark `234 50% 65%` es parte de la regla o quedó fuera de la unificación?

---

## 1. Mi Negocio — Entry points + Cuentas de sucursal

#### MiNegocioPanel — `src/components/MiNegocioPanel.tsx`
**Estructura:** Página contenedora. Header con título h1 + botón primario "Nueva sucursal" arriba a la derecha. Tabs custom (NO usa TabsList/TabsTrigger — son `<button>` manuales con estilos propios): tab "General" activa usa `bg-foreground text-background`, tabs de sucursal activas usan `bg-background border-foreground/40 shadow-sm` — **dos estilos de "tab activa" distintos en la misma barra**. Dialog centrado para crear sucursal (3 campos): footer `DialogFooter` con ghost "Cancelar" + primario "Crear". Empty state con borde dashed.
**Estética:** 100% tokens. Iconos Lucide h-4 w-4 (Plus, Building2, Settings). Separador vertical `h-5 w-px bg-border` entre General y sucursales.
**Microcopy:** "Nueva sucursal" (botón, ×2: header y empty state), "Cancelar" / "Crear" / "Guardando..." (Dialog), "Sucursal creada", "Error al crear", "Barbero agregado", "Error al agregar barbero", "Error al actualizar barbero" (toasts). Placeholders: "Ej: Sucursal Centro", "Av. Corrientes 1234". Empty: "No tenés sucursales todavía" / "No tenés sucursales asignadas." (inconsistencia: una con punto final, otra sin).
**Tag:** ⚠️ PARCIAL — Dialog de creación cumple regla 1 (ghost Cancelar izq + primario der, formulario simple = Dialog OK). Pero: (a) el primario dice "Crear", no "Guardar"; (b) tabs custom con dos estilos de activo distintos — 🆕 patrón de "tab de navegación de página" no documentado.

#### MiNegocioGeneralTabContent — `src/components/MiNegocioGeneralTabContent.tsx`
**Estructura:** Layout de secciones ancladas con nav sticky (solo desktop) de anchor-links. Banner informativo superior (`bg-secondary text-primary` + ícono Info). Banner de carga colapsable animado. Secciones con `border-t pt-6 mt-8`. Collapsible para Cuentas de sucursal. Tabs internas (Servicios/Categorías/Extras) usando TabsList estándar `data-[state=active]:bg-card`.
**Estética:** 100% tokens. **Inconsistencia de jerarquía tipográfica:** h2 `text-xl font-semibold`, luego h3 "Equipo" y "Métodos de pago" usan `text-base font-medium` pero h3 "Servicios"/"Productos"/"Descuentos" usan `text-sm font-semibold` — dos estilos de h3 al mismo nivel jerárquico.
**Microcopy:** Toast guard "Sincronizando vista general… probá de nuevo en un instante." Banner: "Acá definís la base de tu negocio…". "Cargando configuración…".
**Tag:** ⚠️ PARCIAL — usa los componentes del patrón pero la jerarquía tipográfica de headings de sección es inconsistente (text-base/medium vs text-sm/semibold). 🆕 el nav de anchors sticky y el banner Info no están cubiertos por las reglas.

#### CuentasSucursalConfig — `src/components/config/CuentasSucursalConfig.tsx`
**Estructura:** Card con header ícono-en-caja-muted + CardTitle/CardDescription (patrón repetido en todas las Config cards). 3 InfoRows con ícono. Collapsible "Configuración avanzada" → PinActionsToggleList. Sin footer, sin kebab, sin tabs (no es CRUD de lista).
**Estética:** 100% tokens. Iconos Lucide h-3.5/h-5 en cajas `rounded-md bg-muted p-2`.
**Microcopy:** "Acceso operativo", "Configuración avanzada", bullets descriptivos largos.
**Tag:** ✅ — componente informativo/settings; no le aplican reglas 1-2 (no tiene formularios ni listas CRUD). Tokens OK.

#### CuentaSucursalBlock — `src/components/config/CuentaSucursalBlock.tsx`
**Estructura:** Dos Cards (Credenciales + Config PIN). Ícono de header en caja `bg-primary/10` con ícono `text-primary` — **distinto del patrón `bg-muted` + `text-muted-foreground`** de CuentasSucursalConfig/ServicesConfig. Botones outline con ícono ("Regenerar contraseña", "Copiar"). Switch con confirmación vía AlertDialog (footer: Cancel "Cancelar" + Action "Confirmar"/"Aplicando…"). Estados con `Badge` genérico (`<Badge>Activa</Badge>`, `<Badge variant="secondary">Contraseña temporal pendiente</Badge>`).
**Estética:** tokens OK. La función `getEstadoBadge` (variantes default/outline/secondary) quedó definida pero su retorno `estado` se calcula y **no se usa en el render** (dead code aparente — DUDA: verificar).
**Microcopy:** "Regenerar contraseña", "Reintentar"/"Reintentando…", "Email copiado", "Cuenta generada", "No se pudo generar la cuenta", "Usar configuración general", "Personalizada" (badge), "Confirmar"/"Aplicando…"/"Cancelar".
**Tag:** ⚠️ PARCIAL — ❌ en badges de estado: usa `Badge default/secondary` para Activa/Pendiente donde el resto del sistema migró a StatusPill (success/neutral). Header con `bg-primary/10` se desvía del patrón ícono-muted. AlertDialog OK.

#### PinActionsToggleList — `src/components/config/PinActionsToggleList.tsx`
**Estructura:** Lista de grupos con título h4 + filas `divide-y` con Label + descripción + Switch a la derecha. Skeletons al cargar.
**Estética:** 100% tokens. h4 `text-sm font-medium`.
**Microcopy:** "{Acción} requiere PIN" (labels generados desde `SUCURSAL_ACTION_LABELS`).
**Tag:** ✅ — patrón fila-con-switch limpio. 🆕 el patrón "lista de toggles agrupados" no está documentado pero es consistente internamente.

#### RegenerarPasswordDialog — `src/components/config/RegenerarPasswordDialog.tsx`
**Estructura:** Dialog centrado de dos fases (confirmar → mostrar password). Fase 1 footer: ghost "Cancelar" + **`variant="destructive"` "Regenerar contraseña"** — correcto para acción destructiva. Fase 2 footer: solo botón primario "Listo".
**Estética:** ⚠️ caja de advertencia con **colores Tailwind hardcodeados**: `border-amber-500/30 bg-amber-500/5` + `text-amber-500` (AlertTriangle) en vez de tokens `--status-warning-*`.
**Microcopy:** "Regenerar contraseña" / "Regenerando…" / "Cancelar" / "Listo". Toasts: "Contraseña regenerada", "Contraseña copiada", "No se pudo regenerar la contraseña".
**Tag:** ⚠️ PARCIAL — estructura de footer cumple regla 1 (ghost izq + acción der, destructive correcto). ❌ estética: amber hardcodeado debería ser `--status-warning`.

---

## 2. Mi Negocio — Equipo

#### EquipoGeneralConfig — `src/components/config/EquipoGeneralConfig.tsx`
**Estructura:** wrapper puro de 45 líneas — delega a EquipoUnificado `mode="general"`. Sin UI propia.
**Tag:** ✅ — sin criterios visuales propios.

#### EquipoUnificado — `src/components/config/EquipoUnificado.tsx` (1743 líneas)
**Estructura:** Card con header ícono-en-caja-muted (patrón estándar) + botón outline "Agregar" arriba derecha. Tabs Activos/Historial con TabBadge ✅. **NO usa kebab (⋮):** las acciones por fila (Editar / Configurar PIN / Finalizar actividad / Reincorporar) son botones ghost inline visibles — desviación del patrón TabBadge+kebab de la regla 2. DrawerForm "Agregar/Editar integrante" size md: footer `justify-between` ghost "Cancelar" + primario "Guardar"/"Guardando..." ✅. 5 AlertDialogs (regenerar acceso con countdown, finalizar actividad con Textarea de motivo, reemplazar encargado, corregir inconsistencia). ShowMoreDivider para colapsar lista. RoleCards seleccionables (`border-primary bg-primary/5` cuando selected).
**Estética:** mayormente tokens. ⚠️ warnings con **amber hardcodeado**: `border-amber-500/40 bg-amber-500/10` + `text-amber-500` (AlertTriangle, ×3 ubicaciones: finalizar actividad, regenerar acceso, reemplazar encargado) en vez de `--status-warning-*`. Pills ad-hoc de compensación: `bg-accent/50 text-accent-foreground` (sueldo fijo) vs `bg-primary/10 text-primary` (comisión) — no usan Badge ni TagPill. Estados de acceso con `text-success`/`text-primary` directos. Badges de rol con variant default/secondary/outline + ícono (sistema propio de 3 niveles).
**Microcopy:** "Agregar" / "Agregar integrante" / "Editar integrante" / "Agregar miembro" (3 variantes para la misma acción). "Cancelar"/"Guardar"/"Guardando...". "Finalizar actividad"/"Finalizando…", "Reincorporar", "Confirmar"/"Confirmar (Ns)"/"Confirmar cambio"/"Corregir y continuar". Toasts: "Cargo actualizado", "Integrante actualizado", "Acceso generado", "Encargado reemplazado", "Copiado", "Email de acceso guardado". Placeholders: "Nombre *", "Apellido *", "DNI (opcional)", "Ej: 40", "Ej: 350.000", "email@ejemplo.com". Tab "Historial" (no "Inactivos" como en los demás Config — inconsistencia con ServicesConfig/ProductosConfig que usan "Activos/Inactivos").
**Tag:** ⚠️ PARCIAL — DrawerForm footer ✅ regla 1; TabBadge ✅; ❌ sin kebab (acciones inline); ❌ amber hardcodeado ×3; microcopy de tab inconsistente ("Historial" vs "Inactivos"). 🆕 RoleCards seleccionables y countdown en botón de confirmación no documentados.

#### BarberSucursalesGeneralSection — `src/components/config/BarberSucursalesGeneralSection.tsx`
**Estructura:** sección embebida en card de barbero. Badge secondary "Principal", Badge outline con ícono Repeat por recurrente. Botón ghost icon Trash2 `text-destructive` por fila. DrawerForm interno "Sucursal secundaria recurrente" size sm: footer `justify-between` ghost "Cancelar" + "Guardar"/"Guardando..." ✅. AlertDialog eliminar: Cancel "Cancelar" + Action "Eliminar" (sin className destructive — **botón de acción primario navy para acción destructiva**).
**Estética:** tokens OK. Links "Ver config →" con `text-primary hover:underline`.
**Microcopy:** "Sucursales secundarias " (con espacio final sobrante en el Label, línea 168), "Sin asignaciones", "Agregar", "Eliminar asignación recurrente", "Asignación recurrente creada", "No se pudo crear".
**Tag:** ⚠️ PARCIAL — DrawerForm ✅; ❌ AlertDialogAction "Eliminar" sin estilo destructive (inconsistente con ComisionProductosConfig que sí lo tiene).

#### WeekdayPicker — `src/components/config/WeekdayPicker.tsx`
**Estructura:** 7 botones toggle L-M-M-J-V-S-D, `aria-pressed`. Seleccionado: `bg-primary text-primary-foreground`.
**Estética:** 100% tokens.
**Tag:** ✅ — 🆕 patrón "toggle group de días" no documentado pero consistente.

#### InviteUserDialog — `src/components/InviteUserDialog.tsx`
**Estructura:** DrawerForm "Invitar usuario" size md. Footer 2 fases: normal = ghost "Cancelar" + primario "Enviar invitación"/"Enviando..." (`justify-between`) ✅; post-creación = solo "Cerrar" (`justify-end`).
**Estética:** tokens (verificado por grep; botones ghost para copiar credenciales).
**Microcopy:** "Invitar usuario", "Enviar invitación", "¡Usuario creado!", "¡Invitación enviada!", "Error al enviar invitación", "Email copiado", "Contraseña copiada". Placeholders: "barbero@email.com", "Juan Pérez", "Seleccionar rol", "Seleccionar sucursal" (infinitivo "Seleccionar" vs imperativo "Elegí" usado en EquipoUnificado/BarberSucursales — inconsistencia de voseo).
**Tag:** ✅ regla 1 — DUDA: el primario dice "Enviar invitación" (correcto semánticamente, pero no es "Guardar").

#### StaffPinDialog — `src/components/StaffPinDialog.tsx`
**Estructura:** DrawerForm "Configurar PIN"/"Cambiar PIN" size sm. Footer de 3 botones: **`variant="destructive"` relleno "Eliminar PIN" a la izquierda** + grupo derecha (ghost "Cancelar" + primario "Guardar"). AlertDialog para confirmar eliminación.
**Estética:** tokens OK.
**Microcopy:** "Eliminar PIN"/"Eliminando...", "Cancelar", "Guardar"/"Guardando...". Toasts: "PIN configurado correctamente", "PIN eliminado correctamente", "Ingresá el PIN actual", "Los PINs no coinciden", "El PIN debe tener entre 4 y 6 dígitos". Placeholders: "Ingresá el PIN actual", "4-6 dígitos", "Repite el PIN" (← "Repite" es tuteo; el resto del sistema usa voseo "Repetí" — inconsistencia).
**Tag:** ⚠️ PARCIAL — estructura general ✅, pero **DUDA sobre regla 1 vs 2**: el botón destructivo es `variant="destructive"` relleno (regla 1 dice mantenerlo) mientras la regla 2 dice "botones grises neutros, solo el texto cambia color para destructivos". Las dos reglas se contradicen acá; este footer sigue la regla 1.

#### ExtrasCompensacion — `src/components/config/ExtrasCompensacion.tsx`
**Estructura:** sección con DropdownMenu "Agregar extra" (botón ghost + Plus). 2 items deshabilitados ("Ajuste manual", "Otro adicional") — features futuras visibles en el menú.
**Estética:** tokens OK.
**Tag:** ✅ — 🆕 menú con opciones disabled como roadmap visible no documentado.

#### ComisionEquipoConfig / BonoFijoConfig / ComisionProductosConfig — `src/components/config/`
**Estructura:** los 3 son formularios **inline** (cajas `border bg-muted/20` dentro de la card del barbero) — NO usan DrawerForm ni Dialog para editar; solo AlertDialog para eliminar. **Botonera inline con orden invertido al patrón:** primario "Guardar"/"Actualizar" (flex-1, izquierda) + **outline** "Cancelar" (derecha) — opuesto a regla 1 (ghost Cancelar izq / Guardar der). Eliminar via botón ghost icon Trash2 + AlertDialog: ComisionProductos y BonoFijo con Action `bg-destructive` ✅; ComisionEquipo DUDA (verificar className).
**Estética:** tokens OK. Botones compactos `h-7 text-xs` / `h-8` (escala propia, menor que el resto).
**Microcopy:** "Guardar" vs "Actualizar" (BonoFijo usa ambos según contexto), "Editar bono", "Agregar extra". Toasts: "Bono fijo configurado/actualizado/desactivado", "Comisión extra por equipo activada", "Comisión activada/desactivada", "Regla agregada", "N barberos agregados", "Porcentaje actualizado", "Barbero removido de la comisión", "Extra eliminado", "Comisión por productos configurada".
**Tag:** ❌ NO_APLICA — son formularios de edición que deberían seguir el patrón de footer (orden ghost-Cancelar-izquierda / Guardar-derecha) y no lo hacen: orden invertido y Cancelar es outline, no ghost. 🆕 el patrón "formulario inline embebido en card" no está contemplado por las reglas (que solo hablan de Drawer/Dialog).

---

## 3. Servicios / Líneas / Extras / Descuentos (los 4 CRUD canónicos de la regla 2)

> Estos 4 comparten un patrón idéntico y son la implementación de referencia de la regla 2. Se describen juntos y luego las diferencias.

**Patrón común (los 4):**
- **Estructura:** Card + header ícono-en-caja-muted + botón outline "Agregar" (sólo visible en tab activos). Tabs con TabBadge ✅. Kebab (⋮ MoreVertical) por fila como botón `h-7 w-7 border-[0.5px]` ✅. DrawerForm size sm para alta/edición.
- **Footer ALTA:** `justify-between` → ghost "Cancelar" + primario "Guardar" ✅ regla 1.
- **Footer EDICIÓN:** patrón distinto — primario "Guardar cambios" **a la izquierda** + divider `w-px h-5 bg-border` + botones de estado ghost con **fondos tintados hardcodeados**: `bg-amber-50 text-amber-600` (Desactivar), `bg-green-50 text-green-600` (Activar), `bg-red-50 text-red-600` (Eliminar), todos con variantes dark `dark:bg-*-950/30`. **Sin botón "Cancelar"** en modo edición (se cierra con la X).
- **AlertDialogs:** toggle (Action default "Desactivar"/"Activar") + eliminar (Action `bg-destructive` ✅ "Eliminar").
- **Tag común:** ⚠️ PARCIAL — TabBadge+kebab ✅ regla 2; footer de alta ✅ regla 1; pero el footer de edición contradice ambas lecturas de la regla 2: los botones NO son "grises neutros con solo el texto coloreado" — tienen fondos tintados amber/green/red hardcodeados (Tailwind palette, no tokens). **DUDA:** ¿el footer de edición con fondos tintados ES el patrón "gris neutro" documentado, o la regla pedía `bg-[#f9fafb]` gris real como en ProductoListItem? Hay dos implementaciones distintas conviviendo (ver Lote D).

#### ServicesConfig — `src/components/config/ServicesConfig.tsx`
**Diferencias:** tab labels "Activos/Inactivos". TagPill para línea vinculada (migrado, tokens ✅). EntityColorBar por fila. Dialog centrado secundario "Nueva línea" (footer ghost Cancelar + "Agregar" ✅). `LINE_COLORS` con **8 hex hardcodeados** (`#3B82F6`, `#22C55E`, `#EAB308`, `#EF4444`, `#8B5CF6`, `#F97316`, `#EC4899`, `#6B7280`) — paleta de selección de color de entidad (uso legítimo como picker, pero duplicada ×3 archivos).
**Microcopy:** "Agregar" / "Agregar servicio" / "Guardar" / "Guardar cambios" / "Desactivar" / "Activar" / "Eliminar". Empty: "No hay servicios activos". Placeholder "Ej: Corte clásico". Confirmaciones: "¿Estás seguro de que querés desactivar…?" / "¿Querés volver a activar…?". Delete copy largo estándar: "Este elemento dejará de aparecer en el sistema…".
**Tag:** ⚠️ (patrón común) + ❌ paleta LINE_COLORS duplicada.

#### LinesConfig — `src/components/config/LinesConfig.tsx`
**Diferencias:** tab labels "Activas/Inactivas" (género femenino — pero el empty state dice "No hay **líneas** inactivas" mientras el título de drawer dice "Agregar **categoría**": mezcla líneas/categorías en el mismo archivo). TabsList usa layout `flex-1` en vez del `grid grid-cols-2` de los otros — visualmente igual, código distinto. Misma `LINE_COLORS` duplicada.
**Microcopy:** "Agrupación de servicios" (CardTitle), "Agregar categoría", "Editar categoría", "No hay categorías activas", "No hay líneas inactivas", "Eliminar línea", "Desactivar línea", "Línea activada". **Inconsistencia terminológica interna: "categoría" y "línea" para el mismo concepto.** Placeholder "Ej: Essencial, Deluxe" (con doble s — DUDA: ¿typo intencional de marca o error?).
**Tag:** ⚠️ (patrón común) + inconsistencia categoría/línea.

#### ExtrasConfig — `src/components/config/ExtrasConfig.tsx`
**Diferencias:** ninguna estructural — copia fiel del patrón. Placeholder "Ej: Barba".
**Microcopy:** "Agregar extra", "Editar extra", "Extra activado".
**Tag:** ⚠️ (patrón común).

#### DiscountsConfig — `src/components/config/DiscountsConfig.tsx`
**Diferencias:** filtro extra por tipo (Select Servicios/Productos/Todos). TagPill para categoría (migrado ✅) + Badge category para valor $/%. **AlertDialogAction de "Desactivar descuento" con `bg-amber-500 text-white hover:bg-amber-600` hardcodeado** — único de los 4 que colorea el Action del toggle (los otros lo dejan default navy).
**Microcopy:** "Agregar descuento", "Editar descuento", "Descuento desactivado/activado". Placeholders: "Ej: Promo Amigo", "% (ej: 15)" / "$ (ej: 1000)".
**Tag:** ⚠️ (patrón común) + ❌ amber-500 en AlertDialogAction.

#### LineQuickEditPopover — `src/components/config/LineQuickEditPopover.tsx`
**Estructura:** Popover de edición rápida (no Drawer) disparado por botón ghost icon Pencil con Tooltip. Toggle Activa/Inactiva como par de botones default/outline. "Eliminar línea" como botón ghost full-width `text-muted-foreground hover:text-destructive` — habilitado sólo si la línea ya está inactiva, con explicación. Footer propio: **`justify-end` con outline "Cancelar" + primario "Guardar cambios"** — orden agrupado a la derecha y Cancelar outline (≠ regla 1 que pide ghost izquierda).
**Estética:** misma `LINE_COLORS` hardcodeada (3ª copia).
**Microcopy:** "Editar línea", "Guardar cambios", "Cancelar", "Eliminar línea", "Para eliminar esta línea, primero debes desactivarla." (← "debes" = tuteo; resto del sistema vosea), "Selecciona una línea para editarla." (← tuteo también).
**Tag:** 🆕 NO_CUBIERTO — el patrón "popover de edición rápida" no está contemplado en las reglas; su footer no sigue la regla 1 pero al no ser Drawer/Dialog queda formalmente fuera. Tuteo en 2 strings.

---

## 4. Productos

#### ProductosGlobalConfig — `src/components/productos/ProductosGlobalConfig.tsx`
**Estructura:** patrón de los 4 CRUD: Card + ícono-muted + Tabs Activos/Inactivos + TabBadge ✅ + kebab por fila ✅. Búsqueda por Input. Botones header: outline "Marcas" + outline "Agregar"/"Nuevo producto". DrawerForm sm: alta = ghost "Cancelar" + "Guardar" ✅; **edición = "Guardar cambios" izquierda + divider + botones de estado con la SEGUNDA implementación de footer gris**: `bg-[#f9fafb] border-[#e5e7eb]` (gris hardcodeado real) con texto `text-[#92400e]` (Desactivar) / `text-[#166534]` (Activar) — **esta sí coincide con la letra de la regla 2** ("botones grises neutros, solo el texto cambia color") pero con hex hardcodeados en vez de tokens. TagPill para marca (migrado ✅). AlertDialog toggle.
**Estética:** ❌ hex hardcodeados en footer (`#f9fafb`, `#e5e7eb`, `#92400e`, `#166534`).
**Microcopy:** "Nuevo producto" / "Editar producto", "Guardar"/"Guardar cambios"/"Guardando…" (con ellipsis Unicode … mientras MiNegocioPanel usa "Guardando..." con 3 puntos ASCII — inconsistencia tipográfica). "Producto agregado/actualizado/activado/desactivado". Placeholders: "Ej: Cera mate 100ml", "Buscar por nombre o marca", "Sin marca", "Detalles internos (opcional)".
**Tag:** ⚠️ PARCIAL — estructura ✅ regla 2; footer de edición sigue la intención de la regla 2 pero con hex hardcodeados, y **es una implementación DISTINTA del footer de edición de ServicesConfig/LinesConfig/etc. (tintes amber/green/red)** — las dos conviven y la regla no dice cuál es la canónica.

#### ProductosConfig — `src/components/productos/ProductosConfig.tsx`
**Estructura:** orquestador por sucursal: Card + búsqueda + Tabs/TabBadge ✅ + lista de ProductoListItem. Botón **primario** "Agregar"/"Nuevo" (los demás Config usan outline para Agregar — DUDA: ¿intencional por ser la acción principal de la pantalla?). Delega todos los formularios a los 4 dialogs hijos.
**Microcopy:** "Producto activado en sucursal. Configurá precios y stock.", "Configuración de sucursal eliminada".
**Tag:** ✅ regla 2 en estructura — DUDA en la variante del botón Agregar (primario vs outline del resto).

#### ProductoDialog — `src/components/productos/ProductoDialog.tsx`
**Estructura:** **Dialog centrado** (max-w-lg) con Tabs internas (Datos/Precio/Comisión) — formulario complejo de 8+ campos condicionales → **cumple exactamente la excepción de la regla 1** (Dialog centrado para formularios complejos). DialogFooter: ghost "Cancelar" + primario Guardar ✅.
**Estética:** tokens OK (verificado por grep, sin hex).
**Microcopy:** "Producto creado"/"Producto actualizado", validaciones: "Completá el nombre del producto.", "Completá el precio de venta.", "Revisá la configuración de comisión.". Placeholder "Ej: Cera matte 100ml" (← ProductosGlobalConfig dice "Cera **mate**", acá "Cera **matte**" — inconsistencia).
**Tag:** ✅ CUMPLE — es el ejemplo correcto de la excepción "formulario complejo → Dialog centrado".

#### ProductoListItem — `src/components/productos/ProductoListItem.tsx`
**Estructura:** fila con EntityColorBar + StatusPill (neutral/error/warning, migrado ✅) + TagPill marca ✅ + kebab. El kebab NO abre dropdown: abre **DrawerForm como menú de acciones** (footer = pila vertical de botones ghost full-width). Botones de acciones con **footer gris hardcodeado** `bg-[#f9fafb] border-[#e5e7eb] text-[#374151]` (neutras) y `text-[#92400e]` (Desactivar); pero "Activar en sucursal" usa `bg-green-50 text-green-600` y "Eliminar" `bg-red-50 text-red-600` (tintados) — **mezcla las DOS implementaciones de footer en el mismo componente**. 2 AlertDialogs (desactivar con Action `bg-amber-500 text-white` hardcodeado; eliminar con `bg-destructive` ✅).
**Estética:** ❌ hex hardcodeados (`#f9fafb`, `#e5e7eb`, `#374151`, `#92400e`) + tintes green-50/red-50 + `bg-amber-500` en AlertDialogAction. `text-amber-600 dark:text-amber-400` en "Bajo el mínimo".
**Microcopy:** "Agregar stock", "Ajustar stock", "Historial de movimientos", "Editar producto", "Desactivar en sucursal", "Activar en sucursal", "Eliminar".
**Tag:** ⚠️ PARCIAL — pills migradas ✅; 🆕 patrón "drawer como menú de acciones del kebab" no documentado; ❌ mezcla de dos sistemas de color de botones + amber-500 hardcodeado.

#### StockMovementDialog — `src/components/productos/StockMovementDialog.tsx`
**Estructura:** DrawerForm con título dinámico por tipo de movimiento. Footer ghost "Cancelar" + primario ✅ regla 1. Caja de advertencia para ajuste manual.
**Estética:** ❌ advertencia con `border-amber-500/30 bg-amber-500/10` hardcodeado (mismo patrón amber repetido).
**Microcopy:** "Movimiento registrado", placeholders "Ej: -3 o 5" / "Ej: 10", "Ej: rotura, recuento físico, error de carga...".
**Tag:** ⚠️ PARCIAL — estructura ✅; amber hardcodeado.

#### StockHistoryDialog — `src/components/productos/StockHistoryDialog.tsx`
**Estructura:** Dialog centrado de solo lectura (historial). Badges de tipo de movimiento con className custom sobre `variant="outline"`.
**Estética:** ⚠️ mezcla: "Reposición" usa tokens (`bg-success/15 text-success`), "Venta" tokens (`bg-primary/15`), pero "Ajuste manual" usa `bg-amber-500/15 text-amber-700 dark:text-amber-400` hardcodeado — **misma fila de badges, dos sistemas de color**.
**Tag:** ⚠️ PARCIAL — candidato natural a StatusPill/TagPill; amber hardcodeado en uno de 4 badges.

#### MarcasManagerDialog — `src/components/productos/MarcasManagerDialog.tsx`
**Estructura:** Dialog centrado (max-w-md) con lista inline editable: filas con botones ghost icon (Pencil, toggle), form inline con ghost "Cancelar" + primario "Guardar" (sin DrawerForm — formulario simple de 2 campos dentro del Dialog). AlertDialog para toggle. Picker de color de marca.
**Estética:** usa `MARCA_COLORS` de `productos/types.ts` — **12 hex hardcodeados** (`#475569`, `#1f2937`, `#2563eb`, `#4f46e5`, `#7c3aed`, `#db2777`, `#dc2626`, `#ea580c`, `#d97706`, `#16a34a`, `#059669`, `#0891b2`); el comentario del archivo dice "Paleta sobria de colores para marcas (HSL tokens-friendly)" pero son hex, no tokens. Es un picker de color de entidad (uso análogo a LINE_COLORS — legítimo pero es una TERCERA paleta distinta de la de líneas).
**Microcopy:** "Marca creada/actualizada/activada/desactivada", placeholder "Nombre de la marca".
**Tag:** ⚠️ PARCIAL — 🆕 dos paletas de entidad distintas (LINE_COLORS 8 colores vs MARCA_COLORS 12 colores) sin regla que las unifique.

---
