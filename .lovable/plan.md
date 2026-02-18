

# Rediseno de Configuracion - Organizado por Secciones

## Idea principal

Reorganizar Configuracion para que refleje los apartados del sidebar. En vez de tabs genericos (Servicios, Extras, Staff, Descuentos), agrupar las configuraciones segun a que seccion del sistema pertenecen.

## Estructura propuesta

El menu principal de Configuracion mostrara tarjetas clickeables:

```text
+------------------------------------------+
|  Configuracion                           |
+------------------------------------------+
|                                          |
|  [Building2] Negocio                >    |
|  Info del negocio, staff, usuarios       |
|                                          |
|  [Scissors] Cobrar                  >    |
|  Servicios, extras, descuentos           |
|                                          |
|  [Shield] PIN de Seguridad          >    |
|  Acceso a secciones protegidas           |
|                                          |
+------------------------------------------+
```

Las secciones Resumen, Estadisticas, Sueldos, Gastos y Tareas no tienen configuraciones propias por ahora, asi que no aparecen en la lista. Si en el futuro se agregan, se van sumando dinamicamente.

### Dentro de "Negocio"

Tiene sub-pestanas:
- **Mi Negocio**: info de la organizacion y plan (lo que ya existe en OrganizationSettings)
- **Staff**: lista de barberos con sus comisiones, datos, PIN
- **Usuarios**: gestion de roles y permisos (solo visible para duenos)

### Dentro de "Cobrar"

Tiene sub-pestanas:
- **Servicios**: lista de servicios con lineas
- **Extras**: lista de extras
- **Descuentos**: lista de descuentos

### PIN de Seguridad

Se mantiene como seccion independiente ya que es transversal (no pertenece a un apartado especifico).

## Navegacion

Al tocar una tarjeta del menu, se muestra esa seccion con un boton "Volver" arriba para regresar al menu principal. Dentro de cada seccion, las sub-pestanas funcionan como tabs normales.

## Mejoras de usabilidad

- Botones de Editar/Desactivar siempre visibles (sin depender de hover)
- Formularios de agregar/editar en Dialogs en vez de inline
- Mejor formato tipo lista

## Detalle tecnico

### Archivos nuevos
- `src/components/config/ConfigMenu.tsx` - Menu principal con tarjetas (Negocio, Cobrar, PIN)
- `src/components/config/NegocioConfig.tsx` - Seccion Negocio con tabs: Mi Negocio, Staff, Usuarios
- `src/components/config/CobrarConfig.tsx` - Seccion Cobrar con tabs: Servicios, Extras, Descuentos
- `src/components/config/ServicesConfig.tsx` - Componente extraido para servicios
- `src/components/config/ExtrasConfig.tsx` - Componente extraido para extras
- `src/components/config/StaffConfig.tsx` - Componente extraido para staff
- `src/components/config/DiscountsConfig.tsx` - Componente extraido para descuentos

### Archivos modificados
- `src/components/ConfigurationPanel.tsx` - Refactorizado: maneja estado `activeSection` ('menu' | 'negocio' | 'cobrar' | 'pin') y renderiza el componente correspondiente
- `src/pages/Index.tsx` - Se mueve UserManagement y PinConfigSection dentro de ConfigurationPanel (ya no estan separados afuera)

### Patron de navegacion
`ConfigurationPanel` tendra un estado `activeSection`. Cuando es `'menu'` muestra las tarjetas. Al seleccionar una, cambia el estado y muestra la sub-seccion con boton "Volver".

### Acciones siempre visibles
Se elimina `opacity-0 group-hover:opacity-100` de todos los botones de accion en items de servicios, extras, staff y descuentos.

