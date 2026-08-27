/**
 * Salvaguarda de truncado silencioso (Paso 1 del build "Estadísticas agregadas en DB").
 *
 * PostgREST devuelve como máximo 1000 filas por consulta salvo que se pida otra cosa.
 * Cualquier hook de Estadísticas que todavía lea filas crudas y las agregue en el cliente
 * puede quedar corto sin ningún aviso. Mientras esos hooks no estén migrados a funciones
 * agregadas en la base, marcamos el resultado como incompleto en vez de mostrar un número
 * parcial como si fuera real.
 *
 * Cuando un hook se migra a una función agregada (estadisticas_mensuales /
 * estadisticas_ventas_agregadas) deja de necesitar esta salvaguarda: ya no trae filas.
 */
export const ESTADISTICAS_ROW_LIMIT = 1000;

export const DATOS_INCOMPLETOS_MSG =
  'Los datos de este período están incompletos por volumen. Elegí un período más corto.';

/** true si la consulta llegó al tope de filas: hay datos que no vinieron. */
export function alcanzoLimiteFilas(rows: { length: number } | null | undefined): boolean {
  return (rows?.length ?? 0) >= ESTADISTICAS_ROW_LIMIT;
}
