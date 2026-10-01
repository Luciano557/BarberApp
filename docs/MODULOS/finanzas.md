# Finanzas — modo ficticio para grabación

## Estado

2026-10-01: ambos builds implementados y validados localmente. Sin despliegue ni cambios de DB/RLS.

## Uso

Al final de Estadísticas aparece **Mostrar datos ficticios**, incluso si el panel está cargando, vacío o con error. La entrada conserva los permisos y el requisito de plan de Estadísticas. Una vez activo, el botón cambia a **Desactivar datos ficticios** y Finanzas muestra **Datos ficticios · Solo lectura** en cualquiera de sus cinco pestañas.

Se pueden cambiar períodos y sucursales ficticias, abrir gráficos, rankings, cierres de sueldo e historiales de pagos. Registrar, pagar, editar, eliminar y pausar recurrencias queda deshabilitado. Al desactivar o navegar a otro módulo se confirma **Se volverán a mostrar datos reales**: **Seguir con datos ficticios** conserva la pantalla; **Salir y continuar** limpia el modo y después ejecuta la navegación pendiente.

La barra lateral presenta Usuario Demo, iniciales UD, Barbería Demo y las sucursales Centro/Norte; también reemplaza tooltips y nombres accesibles. No monta la campana real de notificaciones ni el Toaster global, para evitar avisos tardíos de otras operaciones durante la grabación. Onboarding y resumen mensual automático quedan suspendidos, se cierran solicitudes de PIN anteriores y se pausa el registro de push del shell. Si aparece el bloqueo de suscripción, conserva la identidad ficticia y pide salir antes de abrir checkout.

## Modelo y límites

`FinanceDemoProvider` comparte un escenario independiente de datos reales entre Estadísticas, Sueldos, Gastos, Inversiones y Deudas. Tiene dos sucursales ficticias, cuatro empleados, doce meses hasta la fecha de activación, cierres y pagos detallados. La fecha del escenario queda guardada para que una recarga no regenere los ejemplos. Los totales, importes, fechas e identificadores de detalle coinciden entre vistas y filtros de sucursal. Los pagos están redondeados a centavos; el devengado ficticio del empleado fijo completa su sueldo mensual exacto. Los filtros fuera del escenario devuelven vacíos ficticios.

La selección de sucursal ficticia nunca cambia `SucursalContext`. La identidad real se conserva únicamente para permisos y acceso; el modo no amplía roles ni planes. Solo owner/general_manager conserva el selector de varias sucursales. La entrada `vittro:finance-demo:v1` de `sessionStorage` se asocia a usuario/organización y se borra al cambiar esa identidad o cerrar sesión. Al recargar se entra directamente a Finanzas protegido; las tareas de onboarding quedan detenidas también mientras se valida la identidad guardada. No toca Supabase, SQL, RLS ni Storage.

Los hooks de lectura necesarios aceptan `enabled` (default true), suspenden lecturas y descartan respuestas pendientes. Los adaptadores devuelven el contrato existente con datos sintéticos. `useSueldosData` separa la carga/cálculo real del panel, conservando sus fórmulas. Las escrituras y sincronizaciones automáticas de bonos/gastos tienen guardas; no se activa una grabación mientras una escritura financiera real está en curso. Los paneles se remontan al cambiar la fuente o sucursal ficticia para limpiar detalles y formularios anteriores.

La protección cubre la presentación del contenido de Vittro. La URL conserva el slug real de la organización y debe quedar fuera del encuadre de grabación, según la decisión aprobada. Los contextos de autenticación, sucursal real y suscripción siguen funcionando para aplicar el acceso vigente.

## Evidencia build 1

`git diff --check` limpio, build de Vite exitoso y 54 pruebas pasan, incluidas pruebas de restauración, bloqueo de lecturas/escrituras, salida explícita, cambio de identidad y conciliación de datos sintéticos. El chequeo TypeScript global tiene errores preexistentes en los contextos de acceso y pruebas de retry; no se modificaron esas áreas.

## Evidencia build 2 y cierre

- `npm test -- --silent`: **72 pruebas pasan en 17 archivos**, 24 específicas de este modo. Cubren los hooks financieros y los montados por Index, ausencia de consultas/RPC/realtime, bloqueo de escrituras automáticas y manuales, conciliación, sucursales estables, persistencia, almacenamiento rechazado, respuestas tardías abortadas, restauración real, logout/cambio de identidad, PIN, planes, avisos globales y salida cancelada.
- `npm run build`: exitoso. Conserva los avisos existentes de Browserslist, importación estática/dinámica de Supabase y tamaño del bundle.
- ESLint sobre archivos nuevos y el guard de suscripción: cero errores; advertencia de Fast Refresh por exportar el hook junto al contexto. `git diff --check` limpio.
- QA de navegador con los componentes reales en una superficie local aislada: cinco pestañas a **375, 834 y 1280 px**, sin desborde del documento/panel ni identidades de la cuenta de prueba en HTML/atributos. Se revisaron gráficos y detalle de ranking, sueldo/cierres, recurrencias, inversiones, cuotas, selector de sucursal, período anual, recarga, cancelación y confirmación de salida. Captura móvil guardada como evidencia. No se usó una sesión autenticada de producción; autenticación, permisos y cliente Supabase fueron simulados en la superficie de QA.
- `npx tsc --noEmit -p tsconfig.app.json` conserva **cinco errores preexistentes**: AuthContext:80, OrganizationContext:86/106, useSubscriptionAccess:65 y readRetry.test:21. Esos archivos permanecen idénticos a HEAD; no aparecen errores nuevos del modo ficticio.
