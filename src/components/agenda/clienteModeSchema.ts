import { z } from 'zod';
import type { PhoneInputChange } from '@/components/ui/phone-input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Campos compartidos por el sub-formulario "cliente" (existente o nuevo). */
export const clienteModeFieldsSchema = z.object({
  clienteId: z.string().optional().default(''),
  nombre: z.string().max(80).optional().default(''),
  apellido: z.string().max(80).optional().default(''),
  telefono: z.custom<PhoneInputChange | null>().nullable().default(null),
  email: z.string().max(120).optional().default(''),
});

export type ClienteModeFields = z.infer<typeof clienteModeFieldsSchema>;

/**
 * Validación cruzada por modo, compartida entre NewAppointmentDialog y
 * AppointmentDetailDialog: 'existing' requiere clienteId, 'new' requiere
 * nombre/apellido/teléfono válido + email opcional con regex.
 */
export function validateClienteMode(
  mode: 'existing' | 'new',
  data: ClienteModeFields,
  ctx: z.RefinementCtx,
) {
  if (mode === 'existing' && !data.clienteId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona un cliente', path: ['clienteId'] });
  }
  if (mode === 'new') {
    if (!data.nombre.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresa el nombre', path: ['nombre'] });
    if (!data.apellido.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresa el apellido', path: ['apellido'] });
    if (!data.telefono?.e164 || !data.telefono.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresa un telefono valido', path: ['telefono'] });
    }
    if (data.email.trim() && !EMAIL_RE.test(data.email.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email invalido', path: ['email'] });
    }
  }
}
