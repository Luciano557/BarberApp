## verdict

1. **resolved — Motion/contrato:** las recapturas confirm-mobile.png y success-mobile.png conservan el contenido legible y el sello/check final. El wrapper de confirmación ahora se monta al activar el paso 5; Datos sigue montado. motion-evidence.json registra portal-step-forward durante 0.22s en confirmación y portal-check durante 0.36s sobre el nodo path real; el CSS de movimiento reducido cubre ese mismo path.
2. **resolved — Persistencia/integración:** portal.css consume screen(lg)/screen(sm) de Tailwind. Las capturas válidas breakpoint-1023.png y breakpoint-1024.png muestran contexto compacto debajo del corte y comprobante lateral al alcanzarlo, sin pérdida visible de contenido; la evidencia DOM confirma scrollWidth igual al viewport en ambos. El diff real de DESIGN.md ya documenta composición editorial, escala tipográfica, radios, foco, breakpoint compartido y motion del portal, con alcance explícito a esta superficie.

Regresiones materiales introducidas por este batch: ninguna observable en las cinco recapturas aportadas. La aprobación corresponde a los fixes evaluados, no constituye una nueva revisión completa de la superficie.

## remaining

clear

disposition: ship
