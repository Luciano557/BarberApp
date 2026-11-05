disposition: fix

Sin comp aprobada por tratarse de un build code-led. El quality bar es el bloque del brief. No existe seed del concept roll: se registra la limitación, sin inventarlo ni reabrir la dirección concreta que el usuario aprobó. DESIGN.md se leyó por las reglas relevantes a esta superficie; no se recorrieron módulos ajenos.

## persistence

Pass: PRODUCT.md existe y conserva el portal white-label como verdad de producto. Las 11 capturas requeridas existen, se abrieron y muestran estados válidos: portada desktop y user-1280, portada mobile, servicios desktop, fecha/hora, datos, confirmación, éxito, gestión y los dos casos de estrés a 320. Las anchuras útiles 1264/375/304 son consistentes con viewports 1280/390/320 y scrollbar; no se atribuye una captura final a 1440. La portada negra es textura real elegida por Scissors, no un área vacía ni un recurso faltante. DESIGN.md aún describe el layout anterior; su actualización y la excepción de escala editorial siguen pendientes para el cierre documental acordado tras esta revisión.

## fidelity

| Elemento/promesa | Estado | Evidencia |
| --- | --- | --- |
| TYPE | match | Inter, título dominante de Scissors, escalones claros entre nombre, tarea, cuerpo y metadata. La familia y la sobriedad vienen del brief y de DESIGN.md; no corresponde exigir otra fuente display. |
| MATERIAL | match | Portada negra texturada y logo auténticos visibles. El wordmark Vittro usa sus trazados vectoriales. No hay fotografía inventada ni material físico simulado con CSS. |
| GROUND | match | Blanco con apoyos fríos muy claros, según los neutros existentes nombrados por el brief. No deriva a crema ni a slate oscuro. |
| THESIS: barbería protagonista, Vittro como firma | match | Scissors domina el primer viewport; la firma Vittro ocupa una escala subordinada al pie. |
| OWN-WORLD: identidad real por barbería | match | Logo/portada reales, acento de la organización y fallback con sus iniciales; el amarillo de estrés conserva texto oscuro y foco legible. |
| STORY: entrar, elegir, revisar y confirmar | match | Acciones de reserva/gestión inmediatamente reconocibles, catálogo abierto, contexto compacto móvil y resumen lateral en desktop. |
| FIRST VIEWPORT: portada editorial y acción visible | match | Dos regiones en 1280; portada horizontal y logo superpuesto en 390. La acción primaria queda visible en la captura móvil. El recuerdo inmediato es Scissors y la reserva. |
| FORM: propuesta code-led aprobada | adaptation | Sin comp ni seed; evidencia: propuesta concreta aprobada por el usuario y confirmación del padre. La composición se juzga contra ese contrato real. |
| Flujo, comprobante y reflow | match | Precio, servicio y hora se leen sin competir; los servicios sin espacios y precio de ocho dígitos reflowean en la captura de estrés. Las cards de gestión contienen información real, sin card contenedora anidada. |
| Motion del contrato | contradicted | El sello de 420 ms está implementado. El dibujo de 360 ms selecciona polyline, pero el Check instalado usa path, según verificación primaria comunicada por el padre. La etapa de confirmación queda montada vacía con su animación ya consumida antes de activarse. |
| Integración responsive con DESIGN.md | contradicted | portal.css introduce cortes 899/900 px en lugar de consumir los breakpoints compartidos; el brief aprueba la composición, pero no autoriza esa segunda fuente de umbrales. |

Las capturas sostienen legibilidad, jerarquía, foco visible y ausencia de contenido recortado en los estados aportados. El muestreo de código mantiene geometría reservada para imágenes, CSS ligero, ausencia de nuevas dependencias y reducción explícita de movimiento. La medición real de performance y los checks finales pertenecen a la validación del padre; no se ejecutaron desde esta revisión.

## ceiling

Reached en el mundo aprobado: escala del nombre, contraste de portada auténtica, catálogo abierto y foco en fecha/hora. El límite pendiente es ejecutar por completo el momento de motion ya contratado. No se justifica añadir ornamento, fotografía de stock, claims ni efectos de material al portal operativo white-label. El Refuse list no arroja una infracción visual material en estas capturas; los 16 advisory reportados no se convierten por sí solos en un defecto observable.

## material_fixes

1. Motion/contrato: dirigir el dibujo del check al path real de Lucide y reiniciar la entrada de la etapa de confirmación cuando se activa; conservar el borrador de Datos montado y el comportamiento reducido sin transformaciones.
2. Persistencia/integración: reemplazar los cortes 899/900 de portal.css por el breakpoint compartido que rige la composición y registrar la nueva composición/escala del portal en DESIGN.md antes del cierre.

## keep

Mantener la portada y el logo auténticos de la barbería, la subordinación de Vittro, el catálogo sin cajas repetidas, la jerarquía de la hora y el reflow legible a 320 px.
