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
    lineId: row.linea_id || undefined,
    lineName: line?.name,
    active: row.activo,
  };
}

function dbToExtra(row: any): Extra {
  return {
    id: row.id,
    uid: row.id,
    name: row.nombre,
    price: Number(row.precio),
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
      
      // Add "Sin descuento" option and map database discounts
      const dbDiscounts = discountsRes.data.map(dbToDiscount);
      setDiscounts([
        { id: 'none', label: 'Sin descuento', value: 0, type: 'percentage', rounding: 'cliente', roundingUnit: 100, paymentMethod: 'todos' },
        ...dbDiscounts,
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      // Normalize name to avoid spacing issues
      const normalizedName = service.name.replace(/\s+/g, ' ').trim();
      
      const { data, error } = await supabase
        .from('servicios')
        .insert({ 
          nombre: normalizedName, 
          precio: service.price, 
          activo: service.active,
          linea_id: service.lineId || null,
          organization_id: organization.id,
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
      if (updates.active !== undefined) dbUpdates.activo = updates.active;
      if (updates.lineId !== undefined) dbUpdates.linea_id = updates.lineId || null;

      const { error } = await supabase
        .from('servicios')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update lineName if lineId changed
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
      // Normalize name to avoid spacing issues
      const normalizedName = extra.name.replace(/\s+/g, ' ').trim();
      
      const { data, error } = await supabase
        .from('extras')
        .insert({ 
          nombre: normalizedName, 
          precio: extra.price, 
          activo: extra.active,
          organization_id: organization.id,
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
      // Normalize names to avoid spacing issues
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
      const { data, error } = await supabase
        .from('descuentos')
        .insert({
          nombre: discount.label,
          valor: discount.value,
          tipo: discount.type === 'fixed' ? 'monto' : 'porcentaje',
          redondeo: discount.rounding || 'cliente',
          redondeo_unidad: discount.roundingUnit || 100,
          metodo_pago: discount.paymentMethod || 'todos',
          activo: true,
          organization_id: organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      const newDiscount = dbToDiscount(data);
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
    if (id === 'none') return; // Don't update the "Sin descuento" option
    try {
      const dbUpdates: any = {};
      if (updates.label !== undefined) dbUpdates.nombre = updates.label;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.type !== undefined) dbUpdates.tipo = updates.type === 'fixed' ? 'monto' : 'porcentaje';
      if (updates.rounding !== undefined) dbUpdates.redondeo = updates.rounding;
      if (updates.roundingUnit !== undefined) dbUpdates.redondeo_unidad = updates.roundingUnit;
      if (updates.paymentMethod !== undefined) dbUpdates.metodo_pago = updates.paymentMethod;

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

  const deleteDiscount = useCallback(async (id: string) => {
    if (id === 'none') return;
    try {
      const { error } = await supabase
        .from('descuentos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setDiscounts(prev => prev.filter(d => d.id !== id));
      toast.success('Descuento eliminado');
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast.error('Error al eliminar descuento');
    }
  }, []);

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

      const { error } = await supabase
        .from('lineas')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      
      // Also update lineName in services that reference this line
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

  return {
    // Loading state
    isLoading,
    // Data - active items only for operations
    services: services.filter(s => s.active),
    allServices: services,
    extras: extras.filter(e => e.active),
    allExtras: extras,
    barbers: barbers.filter(b => b.active),
    allBarbers: barbers,
    discounts,
    lines: lines.filter(l => l.active),
    allLines: lines,
    // Services
    addService,
    updateService,
    // Extras
    addExtra,
    updateExtra,
    // Barbers
    addBarber,
    updateBarber,
    // Discounts
    addDiscount,
    updateDiscount,
    deleteDiscount,
    // Lines
    addLine,
    updateLine,
    // Refresh
    refreshData: fetchData,
  };
}
