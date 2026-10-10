import { addDays, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Barber } from '@/types/barbershop';
import type { Sucursal } from '@/contexts/SucursalContext';
import type { MonthlyData } from '@/components/estadisticas/useEstadisticasData';
import type { BarberoMonthStats, BarberoRankingRow, ProductoRankingRow } from '@/components/estadisticas/useEquipoData';
import type { MonthlyServiciosClientesData, VentasAgregadasMes } from '@/components/estadisticas/useServiciosClientesData';
import type { OcupacionMonthData } from '@/components/estadisticas/useOcupacionResumen';
import type { MontoPorMetodo } from '@/components/estadisticas/usePagoMetodoData';
import type { Gasto } from '@/hooks/useGastos';
import type { GastoRecurrente } from '@/hooks/useGastosRecurrentes';
import type { Inversion } from '@/hooks/useInversiones';
import type { Deuda, PagoDeuda } from '@/hooks/useDeudas';
import type { BarberSalaryData, PagoSueldo } from '@/hooks/useSueldosData';

const ORG = 'demo-organization';
export const DEMO_IDENTITY = { organization: 'Barbería Demo', user: 'Usuario Demo', initials: 'UD' };
export const DEMO_BRANCHES: Sucursal[] = ['Centro', 'Norte'].map(nombre => ({
  id: `demo-${nombre.toLowerCase()}`, organization_id: ORG, nombre: `Sucursal ${nombre}`,
  direccion: null, telefono: null, timezone: 'America/Argentina/Buenos_Aires', activa: true,
}));
const EMPLOYEES: Barber[] = [
  ['Lucas', 'Méndez'], ['Mateo', 'Ruiz'], ['Tomás', 'Vega'], ['Martín', 'Sosa'],
].map(([firstName, lastName], index) => ({
  id: `demo-employee-${index}`, uid: `demo-employee-${index}`, firstName, lastName, phone: '',
  commission: 45, compensationType: index === 3 ? 'fijo' : 'comision',
  fixedSalary: index === 3 ? 720000 : undefined, teamRole: 'barbero', rolesEquipo: ['barber'],
  sucursalId: index < 2 ? 'demo-centro' : 'demo-norte', active: true,
}));
const money = (amount: number) => Math.round(amount * 100) / 100;
const sum = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
const byMethod = (amount: number): MontoPorMetodo => ({ efectivo: amount * .45, mercado_pago: amount * .35, transferencia: amount * .1, debito: amount * .06, credito: amount * .04 });

/** Pure example scenario. It takes only a date and a synthetic scope; never tenant data. */
export function createFinanceDemoData(referenceDate: Date, branch: string | null) {
  const barbers = EMPLOYEES.filter(employee => branch === null || employee.sucursalId === branch);
  const scopes = DEMO_BRANCHES.filter(sucursal => branch === null || sucursal.id === branch);
  const monthlyData: MonthlyData[] = [];
  const ocupacionPorMes: OcupacionMonthData[] = [];
  const monthlyStats: MonthlyServiciosClientesData[] = [];
  const ventasAgregadas: VentasAgregadasMes[] = [];
  const ingresosRaw: { created_at: string; cantidad_de_servicios: number; dia: string }[] = [];
  const gastos: Gasto[] = [];
  const salaryPayments: PagoSueldo[] = [];
  const salaries: BarberSalaryData[] = barbers.map(employee => ({ barberId: employee.id,
    barberName: `${employee.firstName} ${employee.lastName}`, compensationType: employee.compensationType,
    totalDevengado: 0, totalPagado: 0, saldo: 0, detalleIngresos: [], detallePagos: [],
    fixedSalaryInfo: employee.fixedSalary ? { sueldoFijo: employee.fixedSalary, dias: 0, devengado: 0 } : undefined,
  }));
  const historialPorBarbero = new Map<string, BarberoMonthStats[]>(barbers.map(employee => [employee.id, []]));
  let rankingActual: BarberoRankingRow[] = [];
  let productosRanking: ProductoRankingRow[] = [];

  for (let offset = 11; offset >= 0; offset--) {
    const first = startOfMonth(subMonths(referenceDate, offset));
    const month = format(first, 'yyyy-MM');
    const monthLabel = format(first, 'MMM yy', { locale: es });
    const days = offset === 0 ? referenceDate.getDate() : endOfMonth(first).getDate();
    const employeeStats: BarberoRankingRow[] = [];
    for (const employee of barbers) {
      const salary = salaries.find(row => row.barberId === employee.id)!;
      const index = EMPLOYEES.findIndex(row => row.id === employee.id);
      let facturacion = 0;
      let servicios = 0;
      let comisionDevengada = 0;
      for (let day = 0; day < days; day++) {
        const date = addDays(first, day);
        const count = 5 + index + ((11 - offset + day) % 3);
        const amount = count * 8500;
        const monthDays = endOfMonth(first).getDate();
        const earned = employee.fixedSalary
          ? money((day + 1) * employee.fixedSalary / monthDays) - money(day * employee.fixedSalary / monthDays)
          : amount * .45;
        const timestamp = `${format(date, 'yyyy-MM-dd')}T12:00:00`;
        const rowId = (11 - offset) * 10000 + index * 100 + day * 3;
        facturacion += amount; servicios += count; comisionDevengada += earned;
        ingresosRaw.push({ created_at: timestamp, cantidad_de_servicios: count, dia: format(date, 'EEEE', { locale: es }) });
        salary.detalleIngresos.push({ id: rowId + 1, fecha: timestamp, dia: format(date, 'EEEE', { locale: es }),
          totalFacturado: amount, sueldo: earned, efectivo: amount * .45, mp: amount * .55 });
        const paid = money(earned * .8);
        const payment: PagoSueldo = { id: `demo-salary-payment-${rowId + 2}`, barbero_id: employee.id,
          barbero_nombre: salary.barberName, monto: paid, fecha: timestamp, created_at: timestamp,
          concepto: employee.fixedSalary ? 'Pago de sueldo' : 'Pago de comisiones' };
        salaryPayments.push(payment);
        salary.detallePagos.push({ id: payment.id, fecha: timestamp, monto: paid, concepto: payment.concepto });
        gastos.push({ id: rowId + 3, organization_id: ORG, Categoria: employee.fixedSalary ? 'Sueldos fijos del personal' : 'Comisiones del personal',
          Monto: paid, Descripcion: `${payment.concepto} — ${salary.barberName}`, Fecha: timestamp,
          tipo_costo: employee.fixedSalary ? 'fijo' : 'variable', inversion_id: null, pago_sueldo_id: payment.id });
      }
      employeeStats.push({ id: employee.id, nombre: salary.barberName, facturacion, servicios, comisionDevengada, ticketPromedio: 8500 });
      historialPorBarbero.get(employee.id)!.push({ month, monthLabel, facturacion, servicios, comisionDevengada });
    }
    // Values below describe the example scenario, not production financial formulas.
    for (const scope of scopes) {
      const timestamp = `${format(first, 'yyyy-MM-dd')}T09:00:00`;
      for (const [categoryIndex, [category, amount, cost, description]] of ([
        ['Alquiler', 180000, 'fijo', 'Alquiler del local'],
        ['Servicios', 35000, 'semivariable', 'Electricidad y conexión'],
        ['Insumos', 28000, 'variable', 'Materiales de trabajo'],
      ] as const).entries()) gastos.push({ id: (11 - offset) * 10000 + 5000 + DEMO_BRANCHES.indexOf(scope) * 10 + categoryIndex, organization_id: ORG, Categoria: category, Monto: amount,
        Descripcion: `${description} — ${scope.nombre}`, Fecha: timestamp, tipo_costo: cost, inversion_id: null });
    }
    const periodExpenses = gastos.filter(row => row.Fecha?.startsWith(month));
    const facturacion = sum(employeeStats, row => row.facturacion);
    const servicios = sum(employeeStats, row => row.servicios);
    const costosFijos = sum(periodExpenses.filter(row => row.tipo_costo === 'fijo'), row => row.Monto ?? 0);
    const costosVariables = sum(periodExpenses.filter(row => row.tipo_costo === 'variable'), row => row.Monto ?? 0);
    const costosSemivariables = sum(periodExpenses.filter(row => row.tipo_costo === 'semivariable'), row => row.Monto ?? 0);
    const totalEgresos = costosFijos + costosVariables + costosSemivariables;
    monthlyData.push({ month, monthLabel, facturacion, servicios, efectivo: facturacion * .45, mp: facturacion * .55,
      costosFijos, costosVariables, costosSemivariables, totalEgresos, barberosDelMes: barbers.length,
      recargosTotal: 0, perdida: 0, sueldoTotal: sum(employeeStats, row => row.comisionDevengada), comisionProductos: 0,
      ticketPromedio: 8500, rentabilidad: facturacion ? (facturacion - totalEgresos) / facturacion * 100 : 0,
      costoFijoPorServicio: servicios ? costosFijos / servicios : 0,
      costoVariablePorServicio: servicios ? (costosVariables + costosSemivariables) / servicios : 0,
      gananciaPorServicio: servicios ? (facturacion - totalEgresos) / servicios : 0,
      puntoEquilibrio: Math.ceil(costosFijos / 4500), costoLaboralPct: facturacion ? sum(employeeStats, row => row.comisionDevengada) / facturacion * 100 : 0,
    });
    ocupacionPorMes.push({ month, tasaOcupacion: 58 + (11 - offset) * 2, tasaOcupacionParcial: null, coberturaIncompleta: false, duracionPromedioMin: 30 });
    const nuevos = Math.floor(servicios * .12);
    const manual = Math.floor(nuevos * .3);
    const importado = Math.floor(nuevos * .1);
    monthlyStats.push({ month, monthLabel, tasaAttachExtras: 18 + (11 - offset), ingresoExtras: 0,
      clientesNuevos: nuevos, clientesManual: manual, clientesImportado: importado, clientesReserva: nuevos - manual - importado, pctEligioBarbero: 65 + (offset % 4) });
    const mix = [['Corte clásico', .6], ['Corte y barba', .3], ['Perfilado', .1]] as const;
    const ticketsFirst = Math.floor(servicios * .6), ticketsSecond = Math.floor(servicios * .3);
    ventasAgregadas.push({ month, tickets: servicios,
      mix: mix.map(([servicio, share], index) => ({ servicio, facturacion: facturacion * share,
        tickets: index === 0 ? ticketsFirst : index === 1 ? ticketsSecond : servicios - ticketsFirst - ticketsSecond })),
      porHora: [{ hora: 10, tickets: Math.floor(servicios * .3) }, { hora: 15, tickets: Math.floor(servicios * .3) }, { hora: 18, tickets: servicios - 2 * Math.floor(servicios * .3) }],
      porDiaHora: [{ dia: 5, hora: 18, tickets: Math.floor(servicios * .4) }, { dia: 6, hora: 10, tickets: Math.floor(servicios * .35) }, { dia: 3, hora: 15, tickets: servicios - Math.floor(servicios * .4) - Math.floor(servicios * .35) }],
    });
    if (offset === 0) { rankingActual = employeeStats; productosRanking = []; }
  }
  // Same-first-days comparison is calculated only from synthetic closures/expenses.
  const previous = monthlyData[10];
  const partialIncomes = salaries.flatMap(employee => employee.detalleIngresos).filter(row => row.fecha.startsWith(previous.month) && Number(row.fecha.slice(8, 10)) <= referenceDate.getDate());
  const partialRevenue = sum(partialIncomes, row => row.totalFacturado);
  Object.assign(previous, { parcialFacturacion: partialRevenue, parcialServicios: partialRevenue / 8500,
    parcialEfectivo: partialRevenue * .45, parcialMp: partialRevenue * .55,
    parcialCostosFijos: sum(gastos.filter(row => row.Fecha?.startsWith(previous.month) && Number(row.Fecha.slice(8, 10)) <= referenceDate.getDate() && row.tipo_costo === 'fijo'), row => row.Monto ?? 0),
    parcialRecargosTotal: 0, parcialPerdida: 0 });
  monthlyStats[10].parcialClientesNuevos = Math.floor(partialRevenue / 8500 * .12);
  ocupacionPorMes[10].tasaOcupacionParcial = ocupacionPorMes[10].tasaOcupacion;
  salaries.forEach(employee => {
    employee.totalDevengado = sum(employee.detalleIngresos, row => row.sueldo);
    employee.totalPagado = sum(employee.detallePagos, row => row.monto);
    employee.saldo = employee.totalDevengado - employee.totalPagado;
  });
  const inversiones: Inversion[] = scopes.flatMap(scope => {
    const index = DEMO_BRANCHES.findIndex(branch => branch.id === scope.id);
    return [{ id: `demo-investment-${scope.id}`, organization_id: ORG,
    sucursal_id: scope.id, nombre: `Sillones de trabajo — ${scope.nombre}`, monto_total: 1200000 + index * 240000,
    fecha_compra: format(subMonths(referenceDate, 4 + index), 'yyyy-MM-dd'), meses_amortizacion: 24, categoria: 'Equipamiento', descripcion: 'Renovación del equipamiento', activa: true, created_at: firstTimestamp(referenceDate) }];
  });
  const deudas: Deuda[] = scopes.map((scope, index) => ({ id: `demo-debt-${scope.id}`, organization_id: ORG,
    sucursal_id: scope.id, inversion_id: inversiones[index].id, acreedor: 'Equipamientos del Sur', monto_total: inversiones[index].monto_total,
    monto_pagado: inversiones[index].monto_total / 2, cuotas_totales: 12, cuotas_pagadas: 6, monto_cuota: inversiones[index].monto_total / 12,
    fecha_inicio: format(subMonths(referenceDate, 6), 'yyyy-MM-dd'), fecha_proximo_pago: format(addDays(referenceDate, 10 + DEMO_BRANCHES.indexOf(scope)), 'yyyy-MM-dd'),
    descripcion: `Financiación de sillones — ${scope.nombre}`, estado: 'activa', created_at: firstTimestamp(referenceDate) }));
  const debtPayments: PagoDeuda[] = deudas.flatMap(debt => Array.from({ length: 6 }, (_, index) => ({
    id: `demo-debt-payment-${debt.id}-${index}`, deuda_id: debt.id, monto: debt.monto_cuota!, numero_cuota: index + 1,
    fecha_pago: format(subMonths(referenceDate, 6 - index), 'yyyy-MM-dd'), observacion: 'Pago de cuota', created_at: firstTimestamp(subMonths(referenceDate, 6 - index)),
  })));
  const recurrentes: GastoRecurrente[] = scopes.map(scope => ({ id: `demo-recurring-${scope.id}`, organization_id: ORG, sucursal_id: scope.id,
    categoria: 'Alquiler', tipo_costo: 'fijo', monto: 180000, descripcion: `Alquiler del local — ${scope.nombre}`, repeat_preset: 'monthly',
    repeat_frequency: null, repeat_interval: 1, repeat_byweekday: null, fecha_inicio: format(subMonths(referenceDate, 11), 'yyyy-MM-dd'),
    proxima_fecha: format(addDays(endOfMonth(referenceDate), 1), 'yyyy-MM-dd'), activo: true, created_at: firstTimestamp(referenceDate) }));
  const latest = monthlyData[monthlyData.length - 1];
  return { barbers, monthlyData, ingresosRaw, ocupacionPorMes, monthlyStats, ventasAgregadas,
    rankingActual, productosRanking, historialPorBarbero, gastos, recurrentes, inversiones, deudas, debtPayments, salaries, salaryPayments,
    montosMesActual: byMethod(latest.facturacion), montosMesAnterior: byMethod(previous.facturacion),
    saldoPendiente: sum(deudas, row => row.monto_total - row.monto_pagado),
    proximaCuota: deudas.length ? { monto: deudas[0].monto_cuota!, fecha: deudas[0].fecha_proximo_pago! } : null,
  };
}
function firstTimestamp(date: Date) { return `${format(date, 'yyyy-MM-dd')}T12:00:00`; }
