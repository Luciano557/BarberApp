/**
 * Acciones de Cuenta de sucursal protegibles por PIN.
 * Coinciden con los keys aceptados por sucursal_action_requires_pin
 * y por el modo estricto de validate-pin.
 */
export type SucursalActionKey =
  | 'cerrar_caja'
  | 'anular_transaccion'
  | 'registrar_gasto'
  | 'editar_gasto'
  | 'anular_gasto'
  | 'ver_sueldos'
  | 'registrar_pago_sueldo'
  | 'crear_tarea'
  | 'editar_tarea'
  | 'completar_tarea'
  | 'bloquear_cliente'
  | 'ver_historial_caja';

export const SUCURSAL_ACTION_LABELS: Record<SucursalActionKey, string> = {
  cerrar_caja: 'Cerrar caja',
  anular_transaccion: 'Anular transacción',
  registrar_gasto: 'Registrar gasto',
  editar_gasto: 'Editar gasto',
  anular_gasto: 'Anular gasto',
  ver_sueldos: 'Ver sueldos',
  registrar_pago_sueldo: 'Registrar pago de sueldo',
  crear_tarea: 'Crear tarea',
  editar_tarea: 'Editar tarea',
  completar_tarea: 'Completar tarea',
  bloquear_cliente: 'Bloquear cliente',
  ver_historial_caja: 'Ver historial de caja',
};
