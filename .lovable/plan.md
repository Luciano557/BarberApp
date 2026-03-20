

## Resumen del problema

Hoy el sistema hace esto: vos apretás "Confirmar cobro", e inmediatamente muestra "Cobro registrado" y limpia el formulario — **sin esperar** a que la base de datos confirme que lo guardó. Es como tirar una carta al buzón y asumir que llegó, sin recibir nunca el acuse de recibo.

Si en ese momento no hay Internet o la base de datos falla, el sistema igual te dice "Cobro registrado" y borra el formulario. Perdiste la información y no te enteraste.

Lo que vamos a hacer es que el sistema **espere la respuesta de la base de datos** antes de mostrar el resultado:
- Si se guardó bien → tilde verde con "Cobro guardado correctamente"
- Si falló → cruz roja con un mensaje claro del problema (sin Internet, error de base de datos, falta de sucursal, etc.)
- Mientras espera → el botón queda deshabilitado con un spinner para que no hagas doble click

---

## Detalle técnico

### Archivo: `src/components/PaymentRegistration.tsx`

1. **Cambiar el tipo de `onSubmit`** de `(...) => void` a `(...) => Promise<any | null>` para que devuelva la promesa de Supabase.

2. **Hacer `handleSubmit` async** y usar `await` en la llamada a `onSubmit`:
   - Si devuelve un resultado (no null) → mostrar toast de éxito con tilde verde
   - Si devuelve null → mostrar toast de error con cruz roja y mensaje descriptivo
   - Agregar un estado `isSubmitting` para deshabilitar el botón y mostrar spinner mientras se guarda

3. **Mover el `resetForm()`** para que solo se ejecute si el guardado fue exitoso.

### Archivo: `src/hooks/useTransactions.ts`

4. **Mejorar los mensajes de error** en `addTransaction` para que sean más descriptivos:
   - Sin Internet → "No hay conexión a Internet"
   - Error de base de datos → mostrar detalle del error
   - Sin sucursal → ya está cubierto con el mensaje actual

5. **Eliminar el `toast.success` de `addTransaction`** porque ahora la confirmación la maneja `PaymentRegistration` (evitar doble notificación).

### Archivos a modificar
- `src/components/PaymentRegistration.tsx` — async submit + feedback visual + spinner
- `src/hooks/useTransactions.ts` — quitar toast duplicado + mejorar mensajes de error

