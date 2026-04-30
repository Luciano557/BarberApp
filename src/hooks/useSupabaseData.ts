import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service, Extra, Barber, Discount, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSucursal } from '@/contexts/SucursalContext';

// Transform database rows to app types
function dbToLine(row: any): Line {
  return {
    id: row.id,
    name: row.nombre,
    color: row.color || undefined,
    active: row.activo,
  };
}

function dbToService(row: any, lines: Line[]): Service {
  const line = lines.find(l => l.id === row.linea_id);
  return {
    id: row.id,
    uid: row.id,
    name: row.nombre,
    price: Number(row.precio),
    durationMin: row.duracion_min ?? 30,
    lineId: row.linea_id || undefined,
    lineName: line?.name,
    sucursalId: row.sucursal_id || undefined,
    active: row.activo,
  };
}

function dbToExtra(row: any): Extra {
  return {
    id: row.id,
    uid: row.id,
    name: row.nombre,
    price: Number(row.precio),
    sucursalId: row.sucursal_id || undefined,
    active: row.activo,
  };
}

function dbToBarber(row: any): Barber {
  return {
    id: row.id,
    uid: row.id,
    firstName: row.nombre,
    lastName: row.apellido,
    phone: row.telefono || '',
    commission: Number(row.comision) || 0,
    compensationType: row.tipo_compensacion || 'comision',
    fixedSalary: row.sueldo_fijo != null ? Number(row.sueldo_fijo) : undefined,
    teamRole: row.rol_equipo || 'barbero',
    payDay: row.fecha_cobro_dia || 1,
    address: undefined,
    dni: row.dni || undefined,
    active: row.activo,
  };
}

function dbToDiscount(row: any): Discount {
  return {
    id: row.id,
    label: row.nombre,
    value: Number(row.valor),
    type: row.tipo === 'monto' ? 'fixed' : 'percentage',
    rounding: row.redondeo || 'cliente',
    roundingUnit: Number(row.redondeo_unidad) || 100,
    paymentMethod: row.metodo_pago || 'todos',
    sucursalId: row.sucursal_id || undefined,
    appliesTo: row.aplica_a === 'productos' ? 'productos' : 'servicios',
    active: row.activo !== false,
  };
}

export function useSupabaseData() {
  const { organization } = useOrganization();
  const { currentSucursal } = useSucursal();
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch lines first since services depend on them
      const linesRes = await supabase.from('lineas').select('*').order('nombre');
      if (linesRes.error) throw linesRes.error;
      const fetchedLines = linesRes.data.map(dbToLine);
      setLines(fetchedLines);

      // Build barberos query — filter by sucursal when one is selected
      let barbersQuery = supabase.from('barberos').select('*').order('nombre');
      if (currentSucursal?.id) {
        barbersQuery = barbersQuery.eq('sucursal_id', currentSucursal.id);
      }

      const [servicesRes, extrasRes, barbersRes, discountsRes] = await Promise.all([
        supabase.from('servicios').select('*').order('nombre'),
        supabase.from('extras').select('*').order('nombre'),
        barbersQuery,
        supabase.from('descuentos').select('*').order('valor'),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (extrasRes.error) throw extrasRes.error;
      if (barbersRes.error) throw barbersRes.error;
      if (discountsRes.error) throw discountsRes.error;

      setServices(servicesRes.data.map(row => dbToService(row, fetchedLines)));
      setExtras(extrasRes.data.map(dbToExtra));
      setBarbers(barbersRes.data.map(dbToBarber));

      const dbDiscounts = discountsRes.data.map(dbToDiscount);
      setDiscounts(dbDiscounts);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, [currentSucursal?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Services CRUD
  const addService = useCallback(async (service: Omit<Service, 'id' | 'uid'>) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return null;
    }
    try {
      const normalizedName = service.name.replace(/\s+/g, ' ').trim();
      
      const { data, error } = await supabase
        .from('servicios')
        .insert({ 
          nombre: normalizedName, 
          precio: service.price, 
          duracion_min: service.durationMin || 30,
          activo: service.active,
          linea_id: service.lineId || null,
          organization_id: organization.id,
          sucursal_id: service.sucursalId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      const newService = dbToService(data, lines);
      setServices(prev => [...prev, newService]);
      toast.success('Servicio agregado');
      return newService;
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Error al agregar servicio');
      return null;
    }
  }, [lines, organization]);

  const updateService = useCallback(async (id: string, updates: Partial<Service>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.nombre = updates.name.replace(/\s+/g, ' ').trim();
      if (updates.price !== undefined) dbUpdates.precio = updates.price;
      if (updates.durationMin !== undefined) dbUpdates.duracion_min = updates.durationMin;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;
      if (updates.lineId !== undefined) dbUpdates.linea_id = updates.lineId || null;

      const { error } = await supabase
        .from('servicios')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      
      const updatedLine = updates.lineId ? lines.find(l => l.id === updates.lineId) : undefined;
      const finalUpdates = updates.lineId !== undefined 
        ? { ...updates, lineName: updatedLine?.name } 
        : updates;
      
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...finalUpdates } : s));
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Error al actualizar servicio');
    }
  }, [lines]);

  // Extras CRUD
  const addExtra = useCallback(async (extra: Omit<Extra, 'id' | 'uid'>) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return null;
    }
    try {
      const normalizedName = extra.name.replace(/\s+/g, ' ').trim();
      
      const { data, error } = await supabase
        .from('extras')
        .insert({ 
          nombre: normalizedName, 
          precio: extra.price, 
          activo: extra.active,
          organization_id: organization.id,
          sucursal_id: extra.sucursalId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      const newExtra = dbToExtra(data);
      setExtras(prev => [...prev, newExtra]);
      toast.success('Extra agregado');
      return newExtra;
    } catch (error) {
      console.error('Error adding extra:', error);
      toast.error('Error al agregar extra');
      return null;
    }
  }, [organization]);

  const updateExtra = useCallback(async (id: string, updates: Partial<Extra>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.nombre = updates.name.replace(/\s+/g, ' ').trim();
      if (updates.price !== undefined) dbUpdates.precio = updates.price;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;

      const { error } = await supabase
        .from('extras')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      setExtras(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    } catch (error) {
      console.error('Error updating extra:', error);
      toast.error('Error al actualizar extra');
    }
  }, []);

  // Barbers CRUD
  const addBarber = useCallback(async (barber: Omit<Barber, 'id' | 'uid'>) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return null;
    }
    try {
      const normalizedFirstName = barber.firstName.replace(/\s+/g, ' ').trim();
      const normalizedLastName = barber.lastName.replace(/\s+/g, ' ').trim();
      
      const { data, error } = await supabase
        .from('barberos')
        .insert({
          nombre: normalizedFirstName,
          apellido: normalizedLastName,
          telefono: barber.phone || null,
          dni: barber.dni || null,
          comision: barber.commission,
          activo: barber.active,
          organization_id: organization.id,
          sucursal_id: currentSucursal?.id || null,
          tipo_compensacion: barber.compensationType || 'comision',
          sueldo_fijo: barber.fixedSalary || null,
          rol_equipo: barber.teamRole || 'barbero',
          fecha_cobro_dia: barber.payDay || 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      const newBarber = dbToBarber(data);
      setBarbers(prev => [...prev, newBarber]);
      toast.success('Barbero agregado');
      return newBarber;
    } catch (error) {
      console.error('Error adding barber:', error);
      toast.error('Error al agregar barbero');
      return null;
    }
  }, [organization]);

  const updateBarber = useCallback(async (id: string, updates: Partial<Barber>) => {
    try {
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.nombre = updates.firstName.replace(/\s+/g, ' ').trim();
      if (updates.lastName !== undefined) dbUpdates.apellido = updates.lastName.replace(/\s+/g, ' ').trim();
      if (updates.phone !== undefined) dbUpdates.telefono = updates.phone || null;
      if (updates.dni !== undefined) dbUpdates.dni = updates.dni || null;
      if (updates.commission !== undefined) dbUpdates.comision = updates.commission;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;
      if (updates.compensationType !== undefined) dbUpdates.tipo_compensacion = updates.compensationType;
      if (updates.fixedSalary !== undefined) dbUpdates.sueldo_fijo = updates.fixedSalary || null;
      if (updates.teamRole !== undefined) dbUpdates.rol_equipo = updates.teamRole;
      if (updates.payDay !== undefined) dbUpdates.fecha_cobro_dia = updates.payDay;

      const { error } = await supabase
        .from('barberos')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      setBarbers(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    } catch (error) {
      console.error('Error updating barber:', error);
      toast.error('Error al actualizar barbero');
    }
  }, []);

  // Discounts CRUD
  const addDiscount = useCallback(async (discount: Omit<Discount, 'id'>) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return null;
    }
    try {
      const appliesTo = discount.appliesTo || 'servicios';
      const { data, error } = await supabase
        .from('descuentos')
        .insert({
          nombre: discount.label.replace(/\s+/g, ' ').trim(),
          valor: discount.value,
          tipo: discount.type === 'fixed' ? 'monto' : 'porcentaje',
          redondeo: discount.rounding || 'cliente',
          redondeo_unidad: discount.roundingUnit || 100,
          metodo_pago: discount.paymentMethod || 'todos',
          activo: true,
          aplica_a: appliesTo,
          organization_id: organization.id,
          sucursal_id: discount.sucursalId || null,
        })
        .select()
        .single();

      if (error) throw error;
      const newDiscount = dbToDiscount(data);

      // Crear filas en descuentos_sucursales: una por cada sucursal de la org, todas activas.
      const { data: sucs, error: sucError } = await supabase
        .from('sucursales')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('activa', true);

      if (sucError) {
        console.error('Error fetching sucursales for descuento:', sucError);
      } else if (sucs && sucs.length > 0) {
        const rows = sucs.map((s: any) => ({
          organization_id: organization.id,
          descuento_id: newDiscount.id,
          sucursal_id: s.id,
          activo: true,
        }));
        const { error: dsError } = await supabase
          .from('descuentos_sucursales')
          .insert(rows);
        if (dsError) {
          console.error('Error inserting descuentos_sucursales:', dsError);
        } else {
          // Actualizar mapa local
          setDiscountsActivePerSucursal(prev => {
            const next = { ...prev };
            const set = new Set<string>();
            sucs.forEach((s: any) => set.add(s.id));
            next[newDiscount.id] = set;
            return next;
          });
        }
      }

      setDiscounts(prev => [...prev, newDiscount]);
      toast.success('Descuento agregado');
      return newDiscount;
    } catch (error) {
      console.error('Error adding discount:', error);
      toast.error('Error al agregar descuento');
      return null;
    }
  }, [organization]);

  const updateDiscount = useCallback(async (id: string, updates: Partial<Discount>) => {
    if (id === 'none') return;
    try {
      const dbUpdates: any = {};
      if (updates.label !== undefined) dbUpdates.nombre = updates.label.replace(/\s+/g, ' ').trim();
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.type !== undefined) dbUpdates.tipo = updates.type === 'fixed' ? 'monto' : 'porcentaje';
      if (updates.rounding !== undefined) dbUpdates.redondeo = updates.rounding;
      if (updates.roundingUnit !== undefined) dbUpdates.redondeo_unidad = updates.roundingUnit;
      if (updates.paymentMethod !== undefined) dbUpdates.metodo_pago = updates.paymentMethod;
      if (updates.appliesTo !== undefined) dbUpdates.aplica_a = updates.appliesTo;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;

      const { error } = await supabase
        .from('descuentos')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    } catch (error) {
      console.error('Error updating discount:', error);
      toast.error('Error al actualizar descuento');
    }
  }, []);

  // Toggle global activo/inactivo (reemplaza el borrado físico)
  const setDiscountActive = useCallback(async (id: string, activo: boolean) => {
    if (id === 'none') return;
    try {
      const { error } = await supabase
        .from('descuentos')
        .update({ activo })
        .eq('id', id);
      if (error) throw error;
      setDiscounts(prev => prev.map(d => d.id === id ? { ...d, active: activo } : d));
      toast.success(activo ? 'Descuento reactivado' : 'Descuento desactivado');
    } catch (error) {
      console.error('Error toggling discount:', error);
      toast.error('Error al actualizar descuento');
    }
  }, []);

  // Compatibilidad: deleteDiscount ahora desactiva (no borra)
  const deleteDiscount = useCallback(async (id: string) => {
    await setDiscountActive(id, false);
  }, [setDiscountActive]);

  // Activar/desactivar descuento en una sucursal específica
  const setDiscountSucursalActivo = useCallback(async (
    descuentoId: string,
    sucursalId: string,
    activo: boolean,
  ) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return;
    }
    if (descuentoId === 'none') return;
    try {
      // Upsert: si la fila no existe (sucursal nueva), crearla
      const { data: existing, error: selError } = await supabase
        .from('descuentos_sucursales')
        .select('id')
        .eq('descuento_id', descuentoId)
        .eq('sucursal_id', sucursalId)
        .maybeSingle();

      if (selError) throw selError;

      if (existing) {
        const { error } = await supabase
          .from('descuentos_sucursales')
          .update({ activo })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('descuentos_sucursales')
          .insert({
            organization_id: organization.id,
            descuento_id: descuentoId,
            sucursal_id: sucursalId,
            activo,
          });
        if (error) throw error;
      }

      setDiscountsActivePerSucursal(prev => {
        const next = { ...prev };
        const set = new Set(next[descuentoId] || []);
        if (activo) set.add(sucursalId);
        else set.delete(sucursalId);
        next[descuentoId] = set;
        return next;
      });
    } catch (error) {
      console.error('Error toggling descuento sucursal:', error);
      toast.error('Error al actualizar disponibilidad por sucursal');
    }
  }, [organization]);

  // Lines CRUD
  const addLine = useCallback(async (line: Omit<Line, 'id'>) => {
    if (!organization) {
      toast.error('No se pudo determinar la organización');
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('lineas')
        .insert({ 
          nombre: line.name, 
          activo: line.active,
          color: line.color || null,
          organization_id: organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      const newLine = dbToLine(data);
      setLines(prev => [...prev, newLine]);
      toast.success('Línea agregada');
      return newLine;
    } catch (error) {
      console.error('Error adding line:', error);
      toast.error('Error al agregar línea');
      return null;
    }
  }, [organization]);

  const updateLine = useCallback(async (id: string, updates: Partial<Line>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.nombre = updates.name;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;
      if (updates.color !== undefined) dbUpdates.color = updates.color || null;

      const { error } = await supabase
        .from('lineas')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      
      if (updates.name !== undefined) {
        setServices(prev => prev.map(s => 
          s.lineId === id ? { ...s, lineName: updates.name } : s
        ));
      }
    } catch (error) {
      console.error('Error updating line:', error);
      toast.error('Error al actualizar línea');
    }
  }, []);

  // Filtrar descuentos disponibles para Cobrar:
  // - global activo
  // - activo en la sucursal actual
  const cobrarDiscounts = (() => {
    if (!currentSucursal?.id) return [] as Discount[];
    return discounts.filter(d => {
      if (!d.active) return false;
      const set = discountsActivePerSucursal[d.id];
      return !!set && set.has(currentSucursal.id);
    });
  })();

  const serviceDiscounts = cobrarDiscounts.filter(d => d.appliesTo === 'servicios');
  const productDiscounts = cobrarDiscounts.filter(d => d.appliesTo === 'productos');

  return {
    isLoading,
    services: services.filter(s => s.active),
    allServices: services,
    extras: extras.filter(e => e.active),
    allExtras: extras,
    barbers: barbers.filter(b => b.active),
    allBarbers: barbers,
    // Lista completa (incluye inactivos) para Mi Negocio > Descuentos
    discounts,
    // Listas ya filtradas por sucursal y aplica_a para Cobrar
    serviceDiscounts,
    productDiscounts,
    discountsActivePerSucursal,
    lines: lines.filter(l => l.active),
    allLines: lines,
    addService,
    updateService,
    addExtra,
    updateExtra,
    addBarber,
    updateBarber,
    addDiscount,
    updateDiscount,
    deleteDiscount,
    setDiscountActive,
    setDiscountSucursalActivo,
    addLine,
    updateLine,
    refreshData: fetchData,
  };
}
