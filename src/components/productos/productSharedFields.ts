import { z } from 'zod';

/**
 * Los 3 campos que ProductoDialog (por sucursal) y ProductosGlobalConfig
 * (catálogo global) comparten — misma validación, mismo copy de error,
 * para no mantener dos implementaciones ligeramente distintas de lo mismo
 * (F3.11). Cada formulario extiende esto con sus propios campos exclusivos.
 */
export const productSharedFieldsSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(80, 'El nombre no puede superar los 80 caracteres.'),
  /** Sentinel 'none' = sin marca (mismo patrón que el resto del catálogo). */
  marcaId: z.string(),
  descripcion: z.string().max(240, 'La descripción no puede superar los 240 caracteres.').optional(),
});

export type ProductSharedFieldsValues = z.infer<typeof productSharedFieldsSchema>;

export const NO_BRAND = 'none';
