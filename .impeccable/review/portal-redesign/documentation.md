# Portal cliente — registro documental

Merge acotado en `DESIGN.md` y `.impeccable/design.json`, derivado del código
final. Se conserva el sistema de Operate; la composición, escala, radios y foco
del portal quedan como excepciones nombradas de esta superficie pública.

## Evidencia de código

- `src/components/reservar/portal.css:8`: contenedor de 1120px; portada y flujo
  amplios. Líneas 17, 43, 99 y 112: Inter 40–68px, tareas 25–32px, nombre de
  42px en Medium y 36px en Compact. Líneas 10, 20 y 54: portada de 16px,
  acciones de 10px/54px, comprobante de 12px con padding de 24px.
- `src/components/reservar/portal.css:92`: composición de una columna debajo
  de `lg`; líneas 111–112 consumen `lg`/`sm` de Tailwind, cuyo origen es
  `src/lib/breakpoints.ts`. No se documenta el corte anterior de 900px.
- `src/components/reservar/lib/portalTheme.ts:34`: luminancia sRGB lineal;
  líneas 56–62: blanco/negro para el texto del primario e Ink para tinta/foco
  de marcas claras. El color de cada barbería sigue siendo dato.
- `src/components/reservar/PortalIdentity.tsx` y `VittroSignature.tsx`:
  identidad real, iniciales como fallback y firma vectorial subordinada.
  `BookingLanding.tsx` y `config/PortalPreview.tsx` comparten la composición.
- `src/components/reservar/BookingStepper.tsx:214`: navegación con dirección;
  línea 271 mantiene Datos montado y línea 281 monta confirmación al activarse.
  `portal.css:71–72` anima sello de 420ms y `path` de check de 360ms;
  líneas 123–126 suprimen movimiento. El paso dura 220ms.

## Verificación documental

Se inspeccionaron las capturas locales `user-1280.png`, `mobile.png` y
`fallback-320.png`. `motion-evidence.json` registra confirmación de 0.22s,
check sobre `path` de 0.36s y el cambio de una a dos columnas entre 1023/1024px
sin overflow. La validación funcional y las 50 pruebas fueron ejecutadas por
el agente principal; este registro no las presenta como una ejecución propia.

El sidecar se parseó como JSON y el merge comprobó por igualdad que todas las
entradas previas de colores, tipografía, sombras, motion, breakpoints,
componentes y narrativa se conservan. Agrega únicamente roles, motion,
primitivas y reglas del portal; mantiene la fecha y el esquema existentes.

No se canoniza el marco simulado de teléfono de la vista previa ni su portada
al ras como formas del portal público: pertenecen al contenedor de preview.
