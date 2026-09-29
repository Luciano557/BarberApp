# Decisiones de arquitectura y criterio — Vittro

Registro del "por qué", no del "qué". Para el estado actual de cada módulo,
ver `ESTADO_ACTUAL.md`. Para la especificación normativa vigente del sistema
visual, ver `DESIGN.md` — este archivo no repite esa especificación, solo el
contexto y el razonamiento detrás de cada decisión.

## Por qué existe la regla de color de chip

La especificación vigente (`bg-primary/10` = se edita acá, `bg-muted` = atajo
o solo lectura) vive en `DESIGN.md` → Colors → Named Rules. Acá solo el
porqué: surgió de una auditoría sobre Configuración de reservas, donde 3
tratamientos de chip convivían sin regla escrita. Se declaró explícitamente
y ya se aplicó retroactivamente en Portal público ("Compartir tu portal"
corregido de primary a muted, porque no edita nada).

## Portal público no está migrado al canon de formularios

A diferencia de Configuración de reservas (RHF+Zod completo, modo
lectura/edición por card), Portal público sigue siendo un formulario
siempre-editable con guardado mixto (instantáneo para logo/portada,
diferido con botón para el resto). Es una divergencia temporal conocida,
no un error — migrarlo del todo requiere decidir primero cuál de los dos
modelos de guardado se adopta (Fase 5, pendiente).

## La vista previa de Portal público es el portal real

`PortalPreview.tsx` no es una maqueta — renderiza el mismo componente
(`BookingLanding`) que ve el cliente final en `Reservar.tsx`. Decisión
correcta (la preview nunca puede mentir), pero implica que no se puede
rediseñar visualmente sin tocar el portal público real.

## Horarios: editor único, múltiples puertas de entrada

Se descartó duplicar el editor de horarios en Mi Negocio y en Turnos.
El editor vive en un solo lugar (Mi Negocio → ficha de Sucursal) y Turnos
tiene un acceso directo. Motivo: el editor de horario del barbero necesita
ver el horario de la sucursal al mismo tiempo (para copiar como base o
comparar contra el override) — separarlo en dos pantallas hubiera roto esa
referencia cruzada.

## Admin es un plano de control, no un tenant privilegiado

Se descartó modelar al administrador de Vittro como `owner`, agregarlo a
`app_role` o darle membresía en todas las organizaciones. Esos mecanismos son
delegables dentro de un tenant y mezclarían dos fronteras de confianza. Admin
vive en `/admin`, fuera de los providers de organización/sucursal, y se autoriza
únicamente con `app_metadata.platform_role = "platform_admin"`. Su cliente Auth,
sesión, caché y cierre por inactividad son independientes para que pueda convivir
con una sesión tenant sin contaminarla.

El alias compartido `admin` es una decisión consciente de v1: simplifica el
acceso pedido, pero la auditoría solo puede atribuir una acción a esa identidad,
no a una persona concreta. También se acepta temporalmente no exigir MFA. El
email técnico y la credencial se provisionan fuera del repositorio; el frontend
solo conoce el email público de resolución del alias. Administradores nominales
y MFA son la evolución recomendada antes de ampliar las capacidades de escritura.

## El guard del frontend nunca concede privilegios de plataforma

Ocultar rutas o comprobar claims en React solo evita estados de UX incoherentes.
Cada Edge Function global vuelve a verificar el bearer JWT contra Supabase Auth,
que el usuario siga vigente y que su `app_metadata` actual conserve el rol de
plataforma. Recién después usa `service_role`; esa clave nunca sale del servidor.
Las tablas de control tienen RLS activa, no ofrecen policies a `anon` o
`authenticated` y reservan privilegios a `service_role`.

## Un precio tiene una fuente, una versión y una propagación durable

Se eliminó el modelo de precios duplicados en componentes y
`plan_features.price_monthly`. `subscription_plans.amount_ars` es la fuente
única para Homepage, Registro, Facturación y `SubscriptionGate`, y
`price_version` identifica la revisión exacta. Cada checkout y suscripción
persiste el importe y la versión que contrató: así un enlace viejo no puede
reaparecer silenciosamente después de un cambio de catálogo.

Actualizar un plan no se resuelve con una sucesión de requests desde React. Una
RPC `SECURITY INVOKER`, ejecutable solo por `service_role`, bloquea el plan,
comprueba importe/versión/fecha esperados, cambia el catálogo y materializa un
lote inmutable en la misma transacción. El worker actualiza cada `preapproval`
por separado, con claims acotados, revalidación, idempotencia y reintentos. No hay
rollback automático ante éxito parcial: revertir el catálogo no podría deshacer
de forma atómica las renovaciones externas ya actualizadas y produciría una
segunda divergencia. El estado parcial queda visible para intervención y retry.

Cada ítem persiste, antes del efecto externo, el `preapproval`, la operación y la
revisión exacta de la suscripción. Si esa revisión cambia, no se declara éxito a
partir de una lectura tardía: se reconcilia Mercado Pago con la intención más
reciente y se confirma con otro CAS. Si el plan/preapproval todavía son el
objetivo del lote, la reconciliación termina de aplicar el precio nuevo; solo una
intención realmente reemplazada se compensa y queda excluida.

## Las métricas globales usan vigencia efectiva, no etiquetas ambiguas

“Barbería con acceso” significa organización habilitada con trial o período de
suscripción vigente. “Usuario activo” significa una cuenta tenant cuyo último
ingreso ocurrió en los últimos 30 días; nunca se presenta como presencia online
y excluye identidades de plataforma. Los pagos aprobados se agrupan por fecha
efectiva (`paid_at` cuando existe) y no solo por creación. Esta semántica evita
que métricas comercialmente distintas compartan la misma etiqueta y permite
separar trial, activa, vencida, cancelada y legacy.

## Los eventos de Mercado Pago no son autoridad suficiente por sí solos

Firma válida, idempotencia y un estado `approved` son necesarios pero no bastan
para otorgar acceso. Antes de mutar la suscripción, el webhook compara moneda,
importe, plan, referencia, período y vínculo local; usa una actualización CAS
para impedir que eventos concurrentes o fuera de orden retrocedan el estado. Si
falta el secret de firma, falla cerrado salvo un opt-in explícito y limitado a
sandbox. La intención local de checkout se conserva frente a rechazos
recuperables. Al promover uno nuevo, primero se confirma el estado local por CAS
y se persiste un marcador del vínculo reemplazado; después se cancela ese vínculo
de forma idempotente. Así una carrera no puede cancelar la suscripción que aún
figura vigente y un retry puede terminar la limpieza.

## La excepción de provisioning requiere Lovable

Las funciones SQL nuevas del módulo Admin son `SECURITY INVOKER`. La única
excepción involucrada es `handle_new_user`, una función `SECURITY DEFINER` que ya
existía: necesita un early return para que una identidad de plataforma no cree
organización, sucursal, perfil owner ni trial. Por la política del repositorio,
esa sustitución quedó preparada en una migración pero no se aplica desde una
sesión local o automatizada; debe revisarse y ejecutarse mediante Lovable antes de
crear la cuenta técnica.

## El viewport gobierna el shell; el componente gobierna su propio espacio

La auditoría responsive de C7 midió una contradicción concreta: el shell
usaba `useIsMobile` (JS, corte en 768px) mientras el layout general corta
en `sm:` (CSS, 640px), y entre 640 y 768px el botón de hamburguesa y el
tile de `PageHeader` se solapaban entre 28 y 36px en la medición real. La
causa no era un bug puntual — eran dos sistemas contestando la misma
pregunta ("¿esto es mobile?") con números distintos.

C7.1 fija la regla que resuelve la causa, no todavía el síntoma: separa
tres preguntas que se venían mezclando bajo un solo "ancho de pantalla" —
qué modo de ventana es esto (CSS, tres modos: Compact/Medium/Expanded),
si el contenido entra en su propio contenedor (medición vía
`ResizeObserver`, no un breakpoint), y si hace falta una container query
(solo cuando las dos anteriores no alcanzan). Los breakpoints técnicos de
Tailwind se centralizan en `src/lib/breakpoints.ts` para que CSS y JS
lean el mismo número en vez de declararlo cada uno por su cuenta.

La migración real de `useIsMobile` en el shell (`AppSidebar`, `PageHeader`)
pertenece a C7.2 — acá solo queda escrita la regla que esa migración va a
seguir, para no tener que decidirla de nuevo pantalla por pantalla. La
especificación completa vive en `DESIGN.md` → Layout; este archivo no la
repite.

## Medium tiene navegación persistente porque tablet es mostrador, no un desktop chico

La tablet de mostrador es un dispositivo operativo prioritario (PRODUCT.md →
Operating Context), no una ventana de desktop que quedó angosta. Colapsar el
shell a un drawer temporal ahí —como hacía `useIsMobile` hasta 768px— le
pide al barbero abrir un menú para cada cambio de módulo en el dispositivo
que más rota de mano durante el día. Un riel persistente de 64px resuelve
eso: conserva acceso frecuente a los 8 destinos sin consumir el ancho de un
sidebar completo, y no depende de un toggle que Medium no tiene espacio
conceptual para ofrecer (Expanded sí, porque ahí competir por ancho con el
contenido es una decisión real del usuario).

El riel de Medium no reutiliza tal cual el riel colapsado de Expanded: ese
depende de `title`/hover para identificar cada ítem, algo que no existe en
touch. Medium necesita una etiqueta compacta siempre visible — se resolvió
extendiendo el rol tipográfico `Micro` ya existente (badges, contadores,
section labels) en vez de crear un cuarto tamaño de texto para un solo caso.
La especificación completa vive en `DESIGN.md` → Components → Navigation →
Sidebar; este archivo no la repite.

## La protección física de un overlay vive en la primitiva, no en cada consumidor

La auditoría de C7.3 encontró el mismo patrón repetido en `Dialog` y
`AlertDialog`: `w-full` sin gutter y sin `max-h`, y varios consumidores
(`DailySummary`, `DonutDetailDialog`, `MetricDetailDialog`,
`StockHistoryDialog`, `PortalCoverPositionDialog`) ya habían descubierto el
problema por su cuenta y lo parchaban cada uno a mano, con valores parecidos
pero no iguales (`max-h-[85vh]`, `max-h-[90vh]`, `w-[calc(100vw-2rem)]`). Ese
patrón — la misma protección reinventada archivo por archivo — es exactamente
lo que `DrawerForm` ya evitaba con su propio ancho fijo por tamaño, hasta que
esa misma fórmula (`sm:w-[680px]` sin techo) resultó insuficiente en la banda
640–679px y produjo el defecto que midió la auditoría (`left: -30px`).

La decisión no es agregar más protecciones locales, es mover la garantía al
único lugar donde no se puede olvidar: la primitiva. Si `Dialog` garantiza por
sí solo que nunca excede el viewport, ningún consumidor nuevo necesita
recordar agregar `max-h`/gutter — y los que ya lo hacían pueden seguir
haciéndolo (sus clases ganan por `tailwind-merge`, la base no los contradice).
Es la misma razón por la que `Popover`/`DropdownMenu` pasan a leer la altura
real que expone Radix (`--radix-*-content-available-height`) en vez de asumir
un máximo fijo: el espacio disponible ya lo sabe la librería, no hace falta
que cada consumidor lo vuelva a calcular ni lo ignore.

No se restructuró el DOM de `Dialog`/`AlertDialog` en header/body/footer fijo
— eso hubiera sido una ruptura de API sobre ~90 consumidores para un
problema que la garantía exterior (ancho, alto, scroll) ya resuelve. Un
consumidor que necesita header fijo y body scrolleable propio
(`ProductoPickerDialog`) ya lo arma con `flex flex-col` + su propio scroll
interno, sin que la primitiva se lo exija ni se lo impida. La especificación
completa vive en `DESIGN.md` → Components → Overlays — contrato físico; este
archivo no la repite.

## Por qué Caja fue el piloto de los patrones de datos, y no Finanzas

C7.5 necesitaba un lugar real donde probar `MetricGroup`, `RecordRow` y el
contrato de tabla comparativa antes de propagarlos a Sueldos, Gastos,
Inversiones, Deudas y Estadísticas (C7.6) — cinco superficies con lógica
financiera más sensible (comisiones, cierres, anulaciones con auditoría). Caja
(`DailySummary.tsx`, `CashClosingHistory.tsx`) ya tenía, en el código
existente, el anti-patrón exacto que motivó el build (`grid-cols-3
md:grid-cols-4` en el resumen general) *y* dos instancias más del mismo
problema en el mismo archivo (el diálogo de cierre, el historial de cierres) —
suficiente duplicación real para justificar un componente, sin todavía tocar
la superficie de mayor riesgo. Validar el patrón contra un problema que ya
existía en producción, antes de tocar Sueldos o Gastos, es más seguro que
migrar por uniformidad.

## Por qué el historial de cierres de caja quedó como Registro, no como tabla

La auditoría de C7.5 esperaba encontrar en `CashClosingHistory.tsx` una tabla
comparativa (fechas × efectivo × Mercado Pago × totales) — el nombre "historial
de cierres" invita a pensarlo así. El código real es otra cosa: cada cierre es
un evento auditable con su propia acción destructiva (anular), vive dentro de
un `DrawerForm` de 680px máximo, y hoy ya funciona como una lista de cards. Eso
es la definición de Tipo A (Registro), no Tipo B (Tabla comparativa) — la
decisión es semántica, no un conteo de columnas. Convertirlo en una tabla de
~8 columnas dentro de un contenedor angosto hubiera sido peor UX que lo que ya
había, solo para que el build pudiera decir que "usó" el patrón de tabla. El
contrato de tabla comparativa se construyó y probó igual (con datos
financieros realistas, en un harness temporal, nunca en producción) para que
C7.6 lo tenga listo el día que aparezca un consumidor real.

## Por qué `MetricGroup` es flexbox y no CSS Grid `auto-fit`

El Shape original pedía `repeat(auto-fit, minmax(var(--metric-min), 1fr))`.
Probado con el baseline financiero real (`$99.999.999` y una sonda de
`$1.234.567.890`), ese `1fr` reparte el espacio en partes iguales *sin mirar
el contenido*: si una cifra necesita más ancho que la porción que le tocó, el
texto se sale de su columna y se superpone con la columna vecina — exactamente
la clase de defecto que el baseline financiero existe para atrapar. CSS Grid
tiene una forma de evitarlo (que el mínimo de la pista sea `min-content` en
vez de un largo fijo), pero combinado con `auto-fit` el conteo de columnas se
vuelve indefinido y el navegador cae a una sola columna aun con espacio de
sobra — probado y descartado también. Flexbox con `flex-wrap` resuelve esto
por construcción: un flex item nunca encoge por debajo del ancho de su propio
contenido a menos que se le ponga `min-width: 0` explícitamente, y acá nunca
se pone. El wrap a la fila siguiente ocurre solo, sin necesidad de calcular
nada. Es la misma garantía que pedía el Shape (sin breakpoints, sin JS,
reacciona al espacio real), lograda con la herramienta que efectivamente la
cumple.

## La navegación horizontal conserva una única línea y hace explícita su continuidad

La auditoría de C7.4 encontró la causa exacta de los tres síntomas que motivaron
el build: `FinanzasPanel` y `MiNegocioPanel` le agregaban `flex-wrap` a su
`TabsList` (las pestañas se partían en dos filas en vez de quedarse en una);
`MiNegocioPanel` además envolvía sus tabs de sucursal en un `overflow-x-auto
scrollbar-hide` interno — dos estrategias contradictorias apiladas para la
misma fila, y la que sí scrolleaba lo hacía sin ninguna señal de que había más
sucursales fuera de vista. Y las tres páginas largas de Mi Negocio/Portal
tenían su navegación interna envuelta en `hidden md:block`: por debajo de
768px, la navegación no se ocultaba ni se adaptaba, directamente dejaba de
existir en el DOM interactivo.

La decisión, igual que en overlays (C7.3), es que la garantía viva en la
primitiva: `TabsList variant="underline"` nunca envuelve por construcción
(`flex-nowrap`), se vuelve scrolleable cuando no entra, y siempre expone la
misma señal — un fade de 24px, visible solo del lado donde efectivamente hay
contenido oculto — para que ningún consumidor tenga que inventar su propia
afordancia ni, peor, quedarse sin ninguna. `SectionNav` nace como componente
nuevo (no un parche por página) precisamente porque las tres páginas
duplicaban carácter por carácter la misma responsabilidad — mismo mecanismo
físico que Tabs, pero semántica distinta: Tabs cambia qué contenido está
montado, `SectionNav` desplaza a una sección que ya está montada. Confundir
ambas hubiera sido usar la primitiva equivocada para la pregunta equivocada.

`SectionNav` inicialmente no resaltaba una "sección activa": ninguno de los
tres consumidores tenía esa noción antes de C7.4, y el build original pedía no
reinventar observación de scroll sin necesidad. El ajuste de cierre de C7.4
corrigió esto — resulta que sí formaba parte del Shape aprobado, no era una
decisión de producto nueva por tomar. La resolvimos con `IntersectionObserver`
en vez de, por ejemplo, comparar `scrollY` contra offsets fijos, porque es la
única de las dos que no rompe apenas cambia el contenido de arriba (una
sucursal con más o menos campos, un Collapsible que se abre) — mide el DOM
real, no una posición de scroll asumida. El único número que necesitaba (cuánto
"tapa" el `<nav>` sticky al medir qué sección entró) sale de
`getBoundingClientRect().height` sobre el propio `<nav>`, no de una constante
copiada a mano — si el alto de la tira cambia algún día, el cálculo se ajusta
solo. La sección activa se define como la última, en orden de documento, que
sigue dentro de la franja de lectura (bajo la tira sticky, sin llegar al
tercio inferior del viewport) — el mismo criterio que usa cualquier scroll-spy
convencional, elegido por ser predecible y no por ser el único posible.

## Por qué la continuidad de la navegación horizontal pasó de señal a mecanismo

C7.4 resolvió "una navegación que no entra" con una tira de una sola línea,
scrollbar oculta y un fade como única pista. El QA manual posterior al cierre
lo desmintió: con mouse no había forma de llegar a Inversiones y Deudas en
Finanzas — el fade tapaba justo el tab cortado (quedaba un fragmento de ícono
sin texto), no existía scrollbar ni arrastre, y con `Tabs` no controlado ni
siquiera el tab activo se traía a la vista. Una señal de que hay más contenido
no equivale a un camino para llegar a él; en una navegación, donde ocultar un
destino es inaceptable, hace falta el camino.

La decisión es que la primitiva ofrezca controles direccionales explícitos
(chevrons), no que cada consumidor invente los suyos. Se descartó envolver la
fila (rompe la jerarquía de un solo nivel), un menú "Más" o un Select
(reemplazan la navegación visible por otra), drag con mouse como mecanismo
principal (no descubrible) y scrollbar nativa visible (rompe el lenguaje
visual del resto de la app). Los chevrons solo desplazan la tira y nunca
activan un destino: si activaran, dejarían de ser una forma de mirar y se
volverían una segunda forma de navegar.

Cada toque **pagina alineando un destino completo** (el primero no visible hacia
la derecha, el último no visible hacia la izquierda) en lugar de un ancho
fijo: un salto en píxeles deja cortes arbitrarios contra el borde — la misma
media palabra que el fade original mostraba — y hace impredecible qué apareció.
Un destino por toque hubiera necesitado cuatro toques para recorrer Mi Negocio
→ Sucursal a 320px. Van superpuestos y no reservan ancho para que aparecer o
desaparecer no corra los labels ni cree un bucle de medición, y el degradé
quedó reducido a su fondo — no es una segunda señal. El orden DOM es el orden de
foco (flecha izquierda → tira → flecha derecha, sin `tabindex` positivo) y ambas
flechas viven fuera del `role="tablist"` para no entrar en el roving focus de
Radix.

El auto-scroll del activo se movió de `TabsTrigger` a `TabsList`: dependía de que
el wrapper React del trigger se re-renderizara, y Radix cambia el `data-state`
sin pasar por él. Un `MutationObserver` filtrado a "un tab pasó a `active`" (más
un tab que se agrega ya activo, para sucursales que cargan tarde) es lo que hace
que no pelee con el scroll manual: no escucha scroll ni resize, así que sin
cambio de tab no hay movimiento. Todo se resuelve moviendo únicamente
`scrollLeft`, nunca con `scrollIntoView`, que puede arrastrar la página.

`useScrollAffordance` ganó `observeContent` como opt-in: las tablas comparativas
comparten el hook y no debían cambiar de comportamiento. La regla de motion
global tampoco cubre el scroll suave, así que el desplazamiento decide él mismo
entre suave e instantáneo según `prefers-reduced-motion`; la coreografía de
motion sigue siendo de C11.

Un hallazgo del mismo QA se resolvió aparte, sin chevrons: la fila de
Agenda → Configuración nunca tuvo un scroller interno porque `w-fit` + `w-auto` +
un wrapper sin `min-w-0` hacían que midiera su propio contenido; el shell (D41) lo
recortaba. Se corrigió su geometría local, no la primitiva.

## Por qué `Table.comparative` pasó a ser opt-in

C7.5 dejó la afordancia de fade de `ui/table.tsx` activa para las ~9 tablas
existentes, con el razonamiento de que era "inerte" salvo que una tabla
realmente desbordara. Antes de cerrar C7.5 se verificó ese supuesto y resultó
falso: `SueldosPanel.tsx` (4 tablas, hasta 6 columnas, sin `min-width`) y
`GastosPanel.tsx` (2 tablas de 6 columnas, una de texto libre) son consumidores
reales sin ninguna protección de ancho — plausiblemente ya desbordaban en
viewports angostos por razones ajenas a ser comparativos, lo que hubiera hecho
aparecer la afordancia nueva sobre Finanzas sin que el build la hubiera tocado
ni revisado. El mecanismo no tenía forma de distinguir "tabla Tipo B genuina"
de "tabla Tipo A que resulta angosta" — solo medía si desbordaba. Se convirtió
en opt-in (`comparative?: boolean`, default `false`) con la rama por defecto
byte-idéntica a la primitiva anterior a C7.5, para que activar la afordancia
fuera siempre una decisión explícita del consumidor, nunca un efecto lateral
de su propio contenido.

## Por qué Cierres de Caja de Sueldos es Tabla comparativa y el resto de Sueldos/Gastos es Registro

C7.6 migró cinco estructuras tabulares de Finanzas y solo una terminó en
`Table comparative`. La pregunta no es cuántas columnas tiene cada una — las
seis que descartó (Resumen por Empleado, Historial de Pagos ×2, Historial de
Gastos, Gastos Recurrentes) tienen entre 3 y 6. La pregunta es qué compara el
usuario: en Cierres de Caja (dentro de la fila expandida de un empleado en
`SueldosPanel.tsx`) no hay ninguna acción por fila — es un historial de
lectura donde el valor está en comparar efectivo/MP/facturado/comisión *entre*
cierres, la definición exacta de Tipo B. Las otras cinco son listas de
entidades independientes (un pago, un gasto, una regla de recurrencia) que se
leen una por una, no en comparación de columnas — Tipo A, aunque el código
anterior las mostrara en una tabla. Coincide con el precedente de C7.5
(`CashClosingHistory.tsx`, Tipo A pese a tener columnas comparables) y lo
completa: ahí faltaba el consumidor Tipo B real que D44 pedía, y apareció acá.

## Por qué Inversiones y Deudas no migraron

`InversionesPanel.tsx` y `DeudasPanel.tsx` ya eran, antes de C7.6, listas de
cards con `flex-wrap`, `min-w-0` en la identidad y `whitespace-nowrap` en las
cifras junto a la barra de progreso — el mismo resultado visual que
`RecordRow`/`MetricGroup` imponen, llegado por otro camino antes de que esos
patrones existieran. No se encontró un caso real de información que
desapareciera o se solapara a 320–375px (auditoría de código; ambas pantallas
dependen de Supabase con sesión real y no se replicaron con el harness de este
build). Migrarlas de todos modos hubiera sido cambiar una estructura que ya
cumple la regla del dinero por otra visualmente distinta sin corregir ningún
defecto real — exactamente lo que C7.6 pide no hacer ("no migrar por
uniformidad si una estructura ya funciona bien").

## Por qué el hover-only de MpDevicesConfig se resolvió con un arbitrary variant de Tailwind, no con un plugin

El botón de renombrar terminal usaba `sm:opacity-0 sm:group-hover:opacity-100`
— invisible por defecto a partir de 640px, revelado solo por `:hover`. En una
tablet táctil ≥640px eso es una acción sin ningún mecanismo real que la
revele: el ancho no es una señal válida de "este dispositivo tiene mouse"
(regla ya vigente en DESIGN.md → Do's, esto es su primer caso real de
aplicación). La corrección necesitaba la media feature `hover`, no un
breakpoint — sin agregar una dependencia nueva: Tailwind 3.4 (ya instalado)
soporta variants arbitrarios de media query (`[@media(hover:hover)]:`) de
fábrica, verificado en el stylesheet generado (`@media (hover: hover) { ... }`
correctamente scoped). Se descartó instalar un plugin de `pointer`/`hover` o
tocar `tailwind.config.ts` — no había necesidad real, la sintaxis nativa ya
alcanzaba. Verificado con dos cargas frescas del harness (nunca con resize
sobre una página ya montada, que en este mismo proyecto ya dio falsos
negativos con `ResizeObserver` en C7.7): `hover:hover` real → oculto hasta
hover; `hover:none` emulado (touch) → siempre visible.

## Por qué el bloque de Reservas de ClienteDetailDialog pasó a MetricGroup

`grid grid-cols-3` (Total/Última/Próxima) dentro de un `DrawerForm size="lg"`
(680px, pero clamped a `viewport - 48px` en Compact — a 320px de dispositivo
quedan ~224px de contenido real) es exactamente el caso que `MetricGroup`
(C7.5) ya resuelve: N métricas etiqueta+valor cuya cantidad de columnas debe
responder al espacio real, no a un grid fijo. No se creó una solución nueva
— se consumió el primitivo ya existente y estable, igual que lo hizo C7.6
para Sueldos. No es "reabrir" `MetricGroup.tsx` (no se tocó su archivo);
es el mismo tipo de consumo nuevo que ya está documentado como uso previsto
del componente.

## Por qué MIN_COL de 3 días/Semana es 128px y no 160px (el de Día)

El Shape dejó la decisión abierta entre ~112px y ~128px, a elegir con
evidencia. Se midió con el componente real (`AgendaMultiDayTurnoCard`) en un
harness temporal: a 96px y 112px un nombre de barbero realista pero no
extremo ("Francisco Rodríguez", 20 caracteres) ya se trunca en el detalle
terciario de la card; a 128px entra completo. Un nombre de cliente
genuinamente largo ("Bartolomé Etcheverry Insúa") se trunca en las tres
medidas probadas, 96 a 160px — eso es esperado (la card ya trunca por
diseño, C7.7 no la rediseña) y no es lo que la decisión debía resolver. Se
descartó copiar el `MIN_COL_WIDTH = 160` de Día: esa columna representa un
barbero (típicamente 1–8 por sucursal); en 3 días/Semana la columna
representa un día, y Semana necesita 7 en simultáneo — con 160px, 7 columnas
ya piden 1120px solo de grilla antes del riel horario, forzando scroll
horizontal incluso en desktops medianos donde hoy no hace falta. 128px es
además uno de los dos valores que el propio Shape proponía, ahora con
evidencia detrás en vez de elegido por intuición.

## Por qué la altura de Agenda pasó a medirse, no a adivinar un segundo número fijo

`clamp(600px, calc(100vh - 180px), 1100px)` tenía dos supuestos que dejaron
de sostenerse: que "100vh - 180px" casi siempre superaría 600px (falso en
375×667 y 320×568, donde da 487px y 388px — el piso ganaba igual y forzaba
un alto mayor al real, generando el scroll vertical anidado reportado), y
que 180px seguiría representando fielmente "todo lo que va arriba de la
grilla" — un supuesto que este mismo build debilitó más, al hacer que el
toolbar de `AgendaPanel` pueda partirse en dos líneas en viewports angostos
(cambia cuánto mide "arriba"). En vez de afinar la constante, se midió: el
offset real (borde superior del componente + alto de su propio header
sticky + un gutter chico) sale de `getBoundingClientRect()` en runtime, y
la altura máxima queda `clamp(240px, calc(100svh - offsetMedido), 1100px)`
— `svh` en vez de `vh` por la misma razón que el resto de C7 (estable
frente al chrome móvil dinámico durante el scroll), 240px como piso de
seguridad genuino (una grilla de 0px no tiene sentido) en vez de un piso
que en la práctica siempre ganaba. La propiedad del scroll no se movió: la
grilla conserva su propio `overflow-y-auto` (mantiene el header sticky
dentro de su cuerpo, y sobre todo no toca el auto-scroll-a-la-hora-actual
de `AgendaDayView.tsx`, que opera sobre esa misma referencia) — se
consideró y se descartó eliminarlo para que `<main>` fuera el único
scroller, porque hubiera exigido reescribir el auto-scroll-a-hora-actual
para operar contra un contenedor ajeno, un riesgo real sobre lógica que el
build tenía instrucción explícita de preservar, a cambio de una ganancia
arquitectónica que la fórmula medida ya resuelve por su cuenta.

## C7.8B — por qué el total reduce tipografía en el ancho mínimo

**Ubicación en la app:** Cobrar → resumen del pago → Total a cobrar.
**Archivo técnico:** `src/components/PaymentRegistration.tsx:1731`.

La implementación existente conserva la composición del resumen y usa
`text-2xl sm:text-3xl tabular-nums whitespace-nowrap` para el total. El reporte
del build documentó que `$99.999.999` ya entraba, pero `$1.234.567.890`
desbordaba a 320px con 30px incluso sin permitir saltos de línea. El tamaño
de 24px en el tramo angosto resolvió ese caso; 30px se conserva desde el
breakpoint compartido `sm`. Es una decisión local de presentación del importe,
no una nueva política de grillas, un máximo de dinero soportado ni un cambio
de cálculo o formato.

La verificación original debió hacerse cambiando el viewport real: limitar
solo el ancho de una sonda dentro de una ventana grande no desactiva `sm:`.
La continuación en Codex confirmó las clases y la ausencia de cambios
funcionales, sin repetir esa medición visual. La regla normativa del dinero
ya existe en **Ubicación en la app:** transversal → sistema visual;
**Archivo técnico:** `DESIGN.md`; aquí se registra únicamente el porqué de
esta elección concreta. El estado del chequeo global y el QA pendiente viven
en **Ubicación en la app:** transversal → estado del proyecto;
**Archivo técnico:** `docs/ESTADO_ACTUAL.md`.

## Por qué el ribbon de fechas del Portal se resolvió con ancho fluido, no con scroll local

El ribbon de 5 días de `FechaHorarioStep.tsx` tenía dos salidas válidas según
el propio contrato de C7 (layout intrínseco primero, scroll local cuando
corresponde semánticamente). Se eligió ancho fluido (`flex-1 min-w-0` en
vez de `shrink-0 w-12` + `overflow-x-auto`) porque la cantidad de items es
fija y chica (siempre 5, nunca más) — a diferencia de Tabs o de la grilla
semanal de Agenda, acá no hay nada que el usuario podría necesitar "seguir
scrolleando para ver": los 5 días completos siempre caben mostrándose enteros,
solo necesitan poder angostarse. Agregar scroll local a un set fijo de 5
ítems habría sido resolver con la herramienta equivocada — el problema real
era que el ancho pedido (fijo) no respondía al espacio real, no que hubiera
contenido genuinamente más ancho que su contenedor.
