// Pure helpers para calcular la comisión por productos vendidos.
// La comisión se calcula sobre la GANANCIA por línea (precio_venta - precio_costo)
// y solo aplica al barbero que vendió. Si el barbero no tiene configuración activa,
// no genera comisión, pero la línea visual de "Comisión productos" puede mostrarse
// igual con $0 si en el cierre/día algún otro barbero sí generó comisión.

export type ComisionModo = 'barbero' | 'ninguna' | 'personalizada';

export interface ProductoCfg {
  comision_modo: ComisionModo;
  comision_porcentaje: number | null;
  precio_costo: number | null;
}

export interface BarberoComisionCfg {
  porcentaje: number; // 0-100
  activa: boolean;
}

export interface ProductoLineaInput {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export interface ComisionLineaResult {
  ganancia: number;
  pct: number;
  modo: ComisionModo;
  precio_costo_snap: number | null;
  monto: number;
  warning?: string;
}

/**
 * Calcula la comisión por productos vendidos para un barbero.
 * Regla: solo se genera comisión si el barbero tiene configuración activa.
 * - modo "barbero": ganancia * porcentaje del barbero
 * - modo "personalizada": ganancia * porcentaje del producto
 * - modo "ninguna": 0
 * Si el producto no tiene precio_costo válido, la línea suma 0 y registra warning.
 */
export function calcComisionProductos(
  productos: ProductoLineaInput[],
  barberoCfg: BarberoComisionCfg | null,
  prodCfgMap: Record<string, ProductoCfg | undefined>,
): { total: number; lineas: Map<string, ComisionLineaResult> } {
  const lineas = new Map<string, ComisionLineaResult>();
  let total = 0;

  for (const p of productos) {
    const cfg = prodCfgMap[p.producto_id];
    const modo: ComisionModo = (cfg?.comision_modo ?? 'barbero');
    const precioCosto = cfg?.precio_costo ?? null;

    let pct = 0;
    let monto = 0;
    let warning: string | undefined;
    let ganancia = 0;

    const barberoActivo = !!barberoCfg && barberoCfg.activa;

    if (modo === 'ninguna') {
      pct = 0;
    } else if (precioCosto == null || isNaN(Number(precioCosto))) {
      warning = 'Producto sin precio de costo: comisión = 0';
      pct = 0;
    } else if (!barberoActivo) {
      pct = 0;
    } else if (modo === 'barbero') {
      pct = Number(barberoCfg!.porcentaje) || 0;
    } else if (modo === 'personalizada') {
      pct = Number(cfg?.comision_porcentaje) || 0;
    }

    if (pct > 0 && precioCosto != null) {
      ganancia = Math.max(0, Number(p.precio_unitario) - Number(precioCosto)) * Number(p.cantidad);
      monto = Math.round(ganancia * (pct / 100));
    }

    lineas.set(p.producto_id, {
      ganancia,
      pct,
      modo,
      precio_costo_snap: precioCosto,
      monto,
      warning,
    });
    total += monto;
  }

  return { total, lineas };
}
