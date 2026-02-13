
## Corrección: Mover cierre de Tomas al 12 de febrero

### Qué se hará

Una migración SQL para actualizar el registro 606 (cierre de Tomas Bazante):
- Cambiar `created_at` de `2026-02-13` a `2026-02-12T23:59:59` (fecha comercial del 12)
- Mantener `closed_at` como está (registro de auditoría de cuándo se hizo realmente)

```sql
UPDATE public.ingresos 
SET created_at = '2026-02-12T23:59:59' 
WHERE id = 606;
```

Esto libera el día 13 para que puedas seguir anotando los servicios de hoy y cerrar normalmente.

### Después: solución permanente

Una vez resuelto esto, agregaremos el botón "Cambiar fecha" en el Historial de Cierres para que puedas hacer este tipo de correcciones directamente desde la app sin necesidad de intervención técnica.

### Archivo modificado
- Nueva migración SQL (solo UPDATE de datos)
