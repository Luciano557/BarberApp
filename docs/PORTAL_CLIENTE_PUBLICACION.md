# Portal cliente — validación y publicación

Solicitud del usuario: completar la segunda etapa y publicar ambas en producción.
Fecha: 2026-11-05. Estado: publicado en producción y verificado en el portal real.

## Alcance

Etapa visual cerrada en `7b97748e`: composición de servicios/horarios, resumen,
formulario y Mis turnos. Segundo build: conservación de datos al volver,
progreso efectivo, teléfono antes del registro, lecturas con recuperación y
descarte de respuestas fuera de contexto, confirmación/reprogramación/cancelación
con manejo de errores HTTP, un intento por acción y hora correcta en calendario.

No se modificaron funciones remotas ni esquema/RLS. No se crearon turnos reales
durante el QA. Los archivos locales de skills y `supabase/.temp/cli-latest`
preexistentes no forman parte de esta publicación.

## Validación

- `tsc --noEmit -p tsconfig.app.json`: correcto.
- ESLint de los archivos modificados: correcto. No equivale a lint global;
  `BookingLanding.tsx` y `lib/portalTheme.ts` conservan hallazgos previos.
- `vite build`: correcto; conserva los avisos generales de tamaño de bundle,
  importación mixta del cliente Supabase y Browserslist antiguo.
- 38 Vitest dirigidos correctos: `portalBehavior.test.tsx` (15),
  `portalRequests.test.ts` (4) y `dateUtils.test.ts` (19). Son 25 pruebas nuevas.
  Incluyen el SDK Supabase real con transporte simulado: HTTP 503/retry,
  403 sin retry, payload inválido y códigos de conflicto HTTP en mutaciones.
- Suite global: 344 correctos y 8 fallidos de 352, en 42 archivos. Los ocho
  fallos se reprodujeron sin nuestros cambios en un worktree limpio del
  original `87a647b4726297f235852f6149aacd042e0b1499`: `AuthContext.test.tsx`
  (5), `OrganizationContext.test.tsx` (2) y `TenantDataIsolation.test.tsx` (1).
  No se alteraron esos tests ni su código para ocultarlos.
- Navegador local sobre los componentes reales y respuestas sintéticas:
  progreso 1–5, teléfono como primera tarea, identidad conservada al retroceder,
  cambio de horario, reserva simulada, reprogramación simulada y calendario
  `10:30` Buenos Aires → `13:30Z`, sin errores de consola. El primer build
  también verificó 320/360/390/768/1280px, nombres largos, importes de ocho
  dígitos, calendario angosto, teclado y acciones deshabilitadas.

Logs locales: `%TEMP%/vittro-portal-tests.log`,
`%TEMP%/vittro-portal-baseline-tests.log`, `%TEMP%/vittro-portal-build.log`.
Arnés descartable: `%TEMP%/vittro-portal-visual-6d3844726a8d440d8252409e214dd40d/`.
Este QA simulado no prueba persistencia, notificaciones ni backend productivo.

## Publicación

Proyecto confirmado por el conector Vercel: `barber-app`,
`prj_CblhmBmUESl59YiSMqSAEG1nQtNc`, equipo
`team_3NDu8RHsDVTGSIS0kdtkPfc8`. Producción consume `main` de
`Luciano557/BarberApp`; dominio `www.vittro.com.ar`.

Antes de publicar, el original estaba en `87a647b4` y el fork en `d12c2066`;
el fork es ancestro del original (11 commits detrás), sin divergencia.
La sincronización conserva esos commits existentes y no ejecuta migraciones.
Se verificó cada SHA remoto en el orden de `docs/FLUJO_PUBLICACION.md`.

## Resultado comprobado

- Código publicado primero en el original y luego en el fork:
  `42e71a8e3867733fe8dac2893f9b45425e16db24`. Ambos `ls-remote` coincidieron.
- Vercel `dpl_4Tgamdttds1trms6ybUxchdbn6bw`: Ready / Production, desde `main`
  de `Luciano557/BarberApp`, con ese mismo SHA. El alias `www.vittro.com.ar`
  apuntó a ese deployment, sin error de asignación.
- [Portal real de Scissors](https://www.vittro.com.ar/scissors/reservar):
  entrada → servicio → profesional → fecha/horario → datos. Se verificaron
  progreso 1/5, opciones de servicio con precio/duración, 17 horarios en grilla,
  fecha seleccionada y teléfono como primera tarea del formulario. A 390px,
  `scrollWidth === clientWidth` (375px útiles con scrollbar), sin errores de
  consola. No se ingresaron teléfonos ni se confirmó ninguna reserva real.
- El cierre documental posterior mantiene el mismo código de aplicación y se
  sincroniza también original → fork; la verificación final de SHA y Ready
  corresponde al commit documental más reciente.

El servidor sintético fue detenido. El worktree limpio de baseline permanece en
`%TEMP%/vittro-portal-baseline-e55a07d5b2074cc3be47931c1964dcb0/`: la revisión
automática bloqueó por política el borrado de su junction `node_modules`.
Se dejó intacto; no forma parte de los repositorios publicados.
