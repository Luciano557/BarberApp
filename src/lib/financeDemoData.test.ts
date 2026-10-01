import { describe, expect, it } from 'vitest';
import { createFinanceDemoData } from './financeDemoData';

describe('escenario ficticio de Finanzas', () => {
  const date = new Date(2026, 9, 20);
  it('es estable y concilia gráficos, gastos, sueldos, métodos y detalles', () => {
    const data = createFinanceDemoData(date, null);
    expect(createFinanceDemoData(date, null)).toEqual(data);
    expect(data.monthlyData).toHaveLength(12);
    expect(data.barbers).toHaveLength(4);
    for (const month of data.monthlyData) {
      const expenses = data.gastos.filter(row => row.Fecha.startsWith(month.month));
      expect(expenses.reduce((sum, row) => sum + row.Monto, 0)).toBeCloseTo(month.totalEgresos);
      const details = data.salaries.flatMap(row => row.detalleIngresos).filter(row => row.fecha.startsWith(month.month));
      expect(details.reduce((sum, row) => sum + row.totalFacturado, 0)).toBeCloseTo(month.facturacion);
      expect(details.reduce((sum, row) => sum + row.sueldo, 0)).toBeCloseTo(month.sueldoTotal);
      const sales = data.ventasAgregadas.find(row => row.month === month.month);
      expect(sales.mix.reduce((sum, row) => sum + row.facturacion, 0)).toBeCloseTo(month.facturacion);
      expect(sales.porHora.reduce((sum, row) => sum + row.tickets, 0)).toBe(month.servicios);
    }
    const fixedSalary = data.salaries.find(row => row.compensationType === 'fijo');
    expect(fixedSalary.detalleIngresos.filter(row => row.fecha.startsWith(data.monthlyData[10].month)).reduce((sum, row) => sum + row.sueldo, 0)).toBeCloseTo(720000);
    expect(data.salaryPayments.every(row => Math.abs(row.monto * 100 - Math.round(row.monto * 100)) < 1e-6)).toBe(true);
    expect(Object.values(data.montosMesActual).reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(data.monthlyData[11].facturacion);
    expect(data.rankingActual.reduce((sum, row) => sum + row.facturacion, 0)).toBeCloseTo(data.monthlyData[11].facturacion);
    for (const debt of data.deudas) expect(data.debtPayments.filter(row => row.deuda_id === debt.id).reduce((sum, row) => sum + row.monto, 0)).toBeCloseTo(debt.monto_pagado);
  });
  it('aísla las dos sucursales ficticias y no usa identificadores operativos', () => {
    const all = createFinanceDemoData(date, null);
    const centro = createFinanceDemoData(date, 'demo-centro');
    const norte = createFinanceDemoData(date, 'demo-norte');
    expect(centro.barbers).toHaveLength(2);
    expect(norte.barbers).toHaveLength(2);
    all.monthlyData.forEach((month, index) => expect(centro.monthlyData[index].facturacion + norte.monthlyData[index].facturacion).toBeCloseTo(month.facturacion));
    for (const branchData of [centro, norte]) {
      expect(branchData.inversiones).toEqual(all.inversiones.filter(row => branchData.inversiones.some(item => item.id === row.id)));
      expect(branchData.deudas).toEqual(all.deudas.filter(row => branchData.deudas.some(item => item.id === row.id)));
      expect(branchData.salaries).toEqual(all.salaries.filter(row => branchData.barbers.some(item => item.id === row.barberId)));
    }
    expect([...all.barbers, ...all.inversiones, ...all.deudas].every(row => row.id.startsWith('demo-'))).toBe(true);
    expect(JSON.stringify(all)).not.toContain('organization-real');
  });
});
