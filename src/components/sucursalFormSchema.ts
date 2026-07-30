import { z } from 'zod';
import type { PhoneInputChange } from '@/components/ui/phone-input';

/**
 * Campos compartidos entre alta (MiNegocioPanel) y edición (SucursalTabContent)
 * de sucursal — mismo schema para que no vuelvan a divergir, como pasó con el
 * tratamiento de teléfono (alta con PhoneInput, edición con Input plano).
 */
export const sucursalFieldsSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  direccion: z.string().max(120, 'La dirección no puede superar los 120 caracteres.').optional(),
  telefono: z.custom<PhoneInputChange | null>().nullable().refine(
    (t) => !t || t.isValid,
    { message: 'Revisá el teléfono antes de guardar.' },
  ),
});

export type SucursalFieldsValues = z.infer<typeof sucursalFieldsSchema>;

export function emptySucursalDefaults(): SucursalFieldsValues {
  return { nombre: '', direccion: '', telefono: null };
}

export function sucursalDefaultsFromExisting(s: { nombre: string; direccion: string | null; telefono: string | null }): SucursalFieldsValues {
  return {
    nombre: s.nombre,
    direccion: s.direccion || '',
    telefono: s.telefono ? { e164: s.telefono, isValid: true, country: null, display: '' } : null,
  };
}
