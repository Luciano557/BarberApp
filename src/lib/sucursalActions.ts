/**
 * Acciones de Cuenta de sucursal protegibles por PIN.
 * Coinciden con los keys aceptados por sucursal_action_requires_pin
 * y por el modo estricto de validate-pin.
 */
export type SucursalActionKey =
  | 'cerrar_caja'
  | 'anular_transaccion'
  | 'anular_cierre_caja'
  | 'regularizar_cierre_caja'
  | 'ver_gastos'
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
  cerrar_caja: 'Cierre de caja',
  anular_transaccion: 'Anulación de transacciones',
  anular_cierre_caja: 'Anular cierre de caja',
  regularizar_cierre_caja: 'Regularizar cierre de caja',
  ver_gastos: 'Ver gastos',
  registrar_gasto: 'Registrar gastos',
  editar_gasto: 'Editar gastos',
  anular_gasto: 'Anular gastos',
  ver_sueldos: 'Ver sueldos',
  registrar_pago_sueldo: 'Registrar pago de sueldo',
  crear_tarea: 'Crear tareas',
  editar_tarea: 'Editar tareas',
  completar_tarea: 'Completar tareas',
  bloquear_cliente: 'Bloquear clientes',
  ver_historial_caja: 'Ver historial de caja',
};

/**
 * Defaults espejo de la función SQL `sucursal_action_requires_pin`.
 * Si una acción no tiene fila en `sucursal_action_pin_config`, se usa este valor.
 */
export const SUCURSAL_ACTION_DEFAULT_REQUIRES_PIN: Record<SucursalActionKey, boolean> = {
  cerrar_caja: true,
  anular_transaccion: true,
  anular_cierre_caja: true,
  regularizar_cierre_caja: true,
  ver_gastos: true,
  registrar_gasto: false,
  editar_gasto: true,
  anular_gasto: true,
  ver_sueldos: true,
  registrar_pago_sueldo: true,
  crear_tarea: false,
  editar_tarea: true,
  completar_tarea: false,
  bloquear_cliente: true,
  ver_historial_caja: true,
};

export const SUCURSAL_ACTION_DESCRIPTIONS: Record<SucursalActionKey, string> = {
  cerrar_caja: 'Solicita autorización antes de cerrar la caja del día.',
  anular_transaccion: 'Solicita autorización antes de anular un cobro.',
  anular_cierre_caja: 'Solicita autorización antes de anular un cierre de caja existente.',
  regularizar_cierre_caja: 'Solicita autorización antes de regularizar un cierre de caja.',
  ver_gastos: 'Solicita PIN para ver el listado y resumen de gastos de la sucursal.',
  registrar_gasto: 'Solicita autorización antes de cargar un gasto nuevo.',
  editar_gasto: 'Solicita autorización antes de editar un gasto existente.',
  anular_gasto: 'Solicita autorización antes de anular un gasto.',
  ver_sueldos: 'Solicita autorización para abrir el detalle de sueldos.',
  registrar_pago_sueldo: 'Solicita autorización antes de registrar un pago al equipo.',
  crear_tarea: 'Solicita autorización antes de crear una tarea.',
  editar_tarea: 'Solicita autorización antes de editar una tarea.',
  completar_tarea: 'Solicita autorización antes de marcar una tarea como completada.',
  bloquear_cliente: 'Solicita autorización antes de bloquear un cliente.',
  ver_historial_caja: 'Solicita autorización para ver cierres de caja anteriores.',
};

export interface SucursalActionGroup {
  key: string;
  title: string;
  actions: SucursalActionKey[];
}

export const SUCURSAL_ACTION_GROUPS: SucursalActionGroup[] = [
  { key: 'caja', title: 'Caja', actions: ['cerrar_caja', 'anular_transaccion', 'anular_cierre_caja', 'regularizar_cierre_caja', 'ver_historial_caja'] },
  { key: 'gastos', title: 'Gastos', actions: ['ver_gastos', 'registrar_gasto', 'editar_gasto', 'anular_gasto'] },
  { key: 'sueldos', title: 'Sueldos', actions: ['ver_sueldos', 'registrar_pago_sueldo'] },
  { key: 'tareas', title: 'Tareas', actions: ['crear_tarea', 'editar_tarea', 'completar_tarea'] },
  { key: 'clientes', title: 'Clientes', actions: ['bloquear_cliente'] },
];
