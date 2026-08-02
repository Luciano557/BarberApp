# Portal público: restringir al manager

El rol **manager** deja de ver y de poder editar la configuración del Portal público. Mantiene intacto su acceso a "Configuración de reservas" (horarios, disponibilidad, bloqueos) y a la Agenda.

## Qué cambia para el usuario

- Un manager que entra a Turnos → Configuración ve únicamente "Configuración de reservas". La pestaña "Portal público" desaparece.
- Owner y encargado general siguen viendo ambas pestañas, sin cambios.
- La restricción también se aplica en la base de datos: aunque un manager intente editar el portal fuera de la interfaz, el sistema lo rechaza.

## Cambio de interfaz

En `src/components/config/AgendaManagement.tsx`:

- Agregar una constante local `canManagePortalPublico = isOwner || isGeneralManager` (mismo patrón que `showGeneralTab` en `MiNegocioPanel.tsx:102`; no se crea un flag nuevo en AuthContext).
- Renderizar el `TabsTrigger` y el `TabsContent` de `portal` solo cuando esa constante sea true.
- El `defaultValue` del `Tabs` pasa a ser `portal` cuando puede verlo y `reservas` cuando no, para que el manager no caiga en una pestaña inexistente.
- Cuando solo queda una pestaña visible, ocultar el `TabsList` (mismo criterio que ya usa `TurnosAgendaPanel` con las sucursales) y renderizar directamente el contenido de reservas.

Sin cambios en `PortalPublicoSection.tsx` ni en `usePortalConfig.ts`.

## Cambio en la base de datos

Una migración que quita `manager` de las políticas de escritura del portal, dejando owner y general_manager:

- `portal_config`: recrear `portal_config_insert_admins` y `portal_config_update_admins` sin `has_role(..., 'manager')`. `portal_config_delete_admins` ya está limitado a owner/general_manager. La política de lectura `portal_config_select_org_members` se deja como está: la necesitan el portal público y las previsualizaciones.
- Storage, bucket `portal-logos`: recrear `portal_logos_admins_insert`, `portal_logos_admins_update` y `portal_logos_admins_delete` sin `manager`, conservando el resto de las condiciones actuales (carpeta por organización y extensiones permitidas).

## Verificación

- Confirmar con una consulta a `pg_policies` que ninguna política de `portal_config` ni del bucket `portal-logos` menciona `manager`, salvo la de lectura.
- Revisar en el preview que owner ve las dos pestañas y que con rol manager solo aparece "Configuración de reservas", con el contenido de reservas cargando correctamente.
