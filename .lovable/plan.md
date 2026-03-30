## Resumen simple

El número "7,1 ventas los martes" significa: **en promedio, cada martes entraron 7,1 clientes**. No está corregido por ningún otro valor.

**El problema que encontraste es real.** La discrepancia (212 vs 260) viene de cómo se calcula el denominador. Hoy se divide por `totalWeeks` (semanas totales del período usando `differenceInWeeks`), que redondea hacia abajo y no distingue cuántos martes, miércoles, etc. realmente hubo en el período. Además, como el período incluye hasta fin de marzo (31) pero hy un día oy es 30, ha"futuro" inflando el denominador.

**Ejemplo concreto**: en 3 meses (enero-marzo) hay 13 martes, 13 miércoles, pero quizás 14 jueves. Dividir todo por el mismo `totalWeeks` (12 o 13) introduce error.

---

## Plan de corrección

### Archivo: `src/components/EstadisticasPanel.tsx`

**Cambio 1 — Denominador preciso por día de semana**

En vez de dividir por `totalWeeks` (que es un número genérico), contar cuántas veces aparece cada día de la semana en el rango real (`startDate` hasta `hoy` o `endDate`, lo que sea menor). Así, si hubo 13 martes, se divide por 13; si hubo 14 jueves, se divide por 14.

Se reemplaza:

```
ventas: dayCounts[d] / totalWeeks
```

por:

```
ventas: dayCounts[d] / actualOccurrences[d]
```

donde `actualOccurrences` es un array de 7 posiciones que cuenta cuántas veces cae cada día de la semana entre `startDate` y `min(hoy, endDate)`.

**Cambio 2 — Corregir endDate para no incluir días futuros**

Usar `min(endOfMonth(today), today)` como fecha final real, para que no se cuenten días que todavía no pasaron.

**Cambio 3 — Corregir ventas por hora**

Aplicar la misma lógica: dividir por `totalDays` real (días transcurridos, no semanas × 7) para que el promedio horario sea correcto.