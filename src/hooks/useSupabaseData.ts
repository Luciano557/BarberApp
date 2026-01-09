import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service, Extra, Barber, Discount } from '@/types/barbershop';
import { toast } from 'sonner';

// Transform database rows to app types
function dbToService(row: any): Service {
  return {
    id: row.id,
    uid: row.id, // Use the UUID as UID
    name: row.nombre,
    price: Number(row.precio),
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
  };
}

export function useSupabaseData() {
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [servicesRes, extrasRes, barbersRes, discountsRes] = await Promise.all([
        supabase.from('servicios').select('*').order('nombre'),
        supabase.from('extras').select('*').order('nombre'),
        supabase.from('barberos').select('*').order('nombre'),
        supabase.from('descuentos').select('*').order('valor'),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (extrasRes.error) throw extrasRes.error;
      if (barbersRes.error) throw barbersRes.error;
      if (discountsRes.error) throw discountsRes.error;

      setServices(servicesRes.data.map(dbToService));
      setExtras(extrasRes.data.map(dbToExtra));
      setBarbers(barbersRes.data.map(dbToBarber));
      
      // Add "Sin descuento" option and map database discounts
      const dbDiscounts = discountsRes.data.map(dbToDiscount);
      setDiscounts([
        { id: 'none', label: 'Sin descuento', value: 0 },
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
    try {
      const { data, error } = await supabase
        .from('servicios')
        .insert({ nombre: service.name, precio: service.price, activo: service.active })
        .select()
        .single();
      
      if (error) throw error;
      const newService = dbToService(data);
      setServices(prev => [...prev, newService]);
      toast.success('Servicio agregado');
      return newService;
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Error al agregar servicio');
      return null;
    }
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<Service>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.nombre = updates.name;
      if (updates.price !== undefined) dbUpdates.precio = updates.price;
      if (updates.active !== undefined) dbUpdates.activo = updates.active;

      const { error } = await supabase
        .from('servicios')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Error al actualizar servicio');
    }
  }, []);

  // Extras CRUD
  const addExtra = useCallback(async (extra: Omit<Extra, 'id' | 'uid'>) => {
    try {
      const { data, error } = await supabase
        .from('extras')
        .insert({ nombre: extra.name, precio: extra.price, activo: extra.active })
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
  }, []);

  const updateExtra = useCallback(async (id: string, updates: Partial<Extra>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.nombre = updates.name;
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
    try {
      const { data, error } = await supabase
        .from('barberos')
        .insert({
          nombre: barber.firstName,
          apellido: barber.lastName,
          telefono: barber.phone || null,
          dni: barber.dni || null,
          comision: barber.commission,
          activo: barber.active,
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
  }, []);

  const updateBarber = useCallback(async (id: string, updates: Partial<Barber>) => {
    try {
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.nombre = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.apellido = updates.lastName;
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
    try {
      const { data, error } = await supabase
        .from('descuentos')
        .insert({
          nombre: discount.label,
          valor: discount.value,
          tipo: 'porcentaje',
          activo: true,
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
  }, []);

  const updateDiscount = useCallback(async (id: string, updates: Partial<Discount>) => {
    if (id === 'none') return; // Don't update the "Sin descuento" option
    try {
      const dbUpdates: any = {};
      if (updates.label !== undefined) dbUpdates.nombre = updates.label;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;

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
    // Refresh
    refreshData: fetchData,
  };
}
