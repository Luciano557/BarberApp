

## Actualizar datos de Agus Community para reflejar saldo real

### Situación actual
- **Empleada**: Agus Community (ID: `959a39c0-f4be-45f1-8f53-909d00d1d8df`)
- **Sueldo fijo**: $150.000/mes → $5.000/día
- **created_at actual**: 29 de marzo 2026 (ayer, cuando se cargó)
- **fecha_cobro_dia actual**: 1
- **Pagos registrados**: $0

### Problema
El sistema calcula el devengado desde `created_at`, que es ayer. Pero Agustina trabaja desde antes y se le debe $225.000.

### Solución
Una migración SQL que actualice:

1. **`fecha_cobro_dia`** → **15** (cobra el 15 de cada mes)
2. **`created_at`** → **15 de febrero 2026** (para que el cálculo proporcional dé 45 días × $5.000 = $225.000)

### Verificación
Después de la migración, en el panel de Sueldos debería aparecer:
- Devengado: ~$225.000
- Pagado: $0
- Saldo pendiente: ~$225.000

### Archivo
- Migración SQL: `UPDATE barberos SET fecha_cobro_dia = 15, created_at = '2026-02-15'::timestamptz WHERE id = '959a39c0-...'`

