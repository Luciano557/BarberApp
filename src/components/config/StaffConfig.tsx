import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Save, X, PowerOff, Power, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Barber } from '@/types/barbershop';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { StaffPinDialog } from '@/components/StaffPinDialog';
import { supabase } from '@/integrations/supabase/client';

interface StaffConfigProps {
  barbers: Barber[];
  onAdd: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Barber>) => void;
}

export function StaffConfig({ barbers, onAdd, onUpdate }: StaffConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [inviteBarber, setInviteBarber] = useState<Barber | null>(null);
  const [pinDialogBarber, setPinDialogBarber] = useState<Barber | null>(null);
  const [barberPinStatus, setBarberPinStatus] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '',
  });

  const activeBarbers = barbers.filter(b => b.active);
  const inactiveBarbers = barbers.filter(b => !b.active);

  const fetchPinStatus = useCallback(async () => {
    if (barbers.length === 0) return;
    try {
      const { data, error } = await supabase.from('barberos').select('id, pin_hash').in('id', barbers.map(b => b.id));
      if (error) throw error;
      const status: Record<string, boolean> = {};
      data?.forEach(b => { status[b.id] = !!b.pin_hash; });
      setBarberPinStatus(status);
    } catch (error) {
      console.error('Error fetching PIN status:', error);
    }
  }, [barbers]);

  useEffect(() => { fetchPinStatus(); }, [fetchPinStatus]);

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', phone: '', commission: '40', address: '', dni: '' });
  };

  const cancelEdit = () => { setEditingId(null); setIsAdding(false); resetForm(); };

  const handleFormSave = (data: typeof formData, barberId?: string) => {
    if (barberId) {
      onUpdate(barberId, {
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined,
      });
      setEditingId(null);
    } else {
      onAdd({
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        commission: Number(data.commission), address: data.address || undefined, dni: data.dni || undefined, active: true,
      });
      setIsAdding(false);
    }
    resetForm();
  };

  const StaffForm = React.memo(({ isEdit, barberId, initialData, onSave, onCancel }: {
    isEdit: boolean; barberId?: string;
    initialData: typeof formData;
    onSave: (data: typeof formData) => void;
    onCancel: () => void;
  }) => {
    const [localData, setLocalData] = useState(initialData);
    const [localCommissionError, setLocalCommissionError] = useState('');

    const validateLocalCommission = (value: string): boolean => {
      const num = Number(value);
      if (value === '' || isNaN(num)) { setLocalCommissionError('Ingresa un número válido'); return false; }
      if (num < 0 || num > 100) { setLocalCommissionError('Debe estar entre 0 y 100'); return false; }
      setLocalCommissionError(''); return true;
    };

    const handleSubmit = () => {
      if (!localData.firstName || !localData.lastName || !localData.phone) return;
      if (!validateLocalCommission(localData.commission)) return;
      onSave(localData);
    };

    return (
      <div className="space-y-3 p-4 bg-muted rounded-lg animate-scale-in">
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Nombre *" value={localData.firstName} onChange={(e) => setLocalData(prev => ({ ...prev, firstName: e.target.value }))} autoComplete="off" />
          <Input placeholder="Apellido *" value={localData.lastName} onChange={(e) => setLocalData(prev => ({ ...prev, lastName: e.target.value }))} autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Teléfono *" value={localData.phone} onChange={(e) => setLocalData(prev => ({ ...prev, phone: e.target.value }))} autoComplete="off" />
          <div>
            <Input type="text" inputMode="numeric" placeholder="Comisión % *" value={localData.commission}
              onChange={(e) => { setLocalData(prev => ({ ...prev, commission: e.target.value })); if (e.target.value) validateLocalCommission(e.target.value); }}
              onBlur={() => validateLocalCommission(localData.commission)}
              className={localCommissionError ? 'border-destructive' : ''} autoComplete="off" />
            {localCommissionError && <p className="text-xs text-destructive mt-1">{localCommissionError}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Dirección (opcional)" value={localData.address} onChange={(e) => setLocalData(prev => ({ ...prev, address: e.target.value }))} autoComplete="off" name="staff-address-field" />
          <Input placeholder="DNI (opcional)" value={localData.dni} onChange={(e) => setLocalData(prev => ({ ...prev, dni: e.target.value }))} autoComplete="off" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} className="bg-success hover:bg-success/90"
            disabled={!localData.firstName || !localData.lastName || !localData.phone || !!localCommissionError}>
            <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Guardar' : 'Agregar'}
          </Button>
        </div>
      </div>
    );
  });

  const renderBarberItem = (barber: Barber) => (
    <div key={barber.id}>
      {editingId === barber.id ? (
        <StaffForm isEdit={true} barberId={barber.id}
          initialData={{ firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone, commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '' }}
          onSave={(data) => handleFormSave(data, barber.id)} onCancel={cancelEdit} />
      ) : (
        <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">{barber.firstName} {barber.lastName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{barber.commission}% comisión</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setPinDialogBarber(barber)}
                className={`h-8 w-8 ${barberPinStatus[barber.id] ? 'text-primary' : ''}`}
                title={barberPinStatus[barber.id] ? 'PIN configurado - Clic para editar' : 'Configurar PIN de acceso'}>
                <Lock className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setInviteBarber(barber)} className="h-8 w-8" title="Invitar a usar el sistema">
                <Mail className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => {
                setEditingId(barber.id);
                setFormData({ firstName: barber.firstName, lastName: barber.lastName, phone: barber.phone, commission: String(barber.commission), address: barber.address || '', dni: barber.dni || '' });
              }} className="h-8 w-8">
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onUpdate(barber.id, { active: !barber.active })} className="h-8 w-8" title={barber.active ? 'Desactivar' : 'Activar'}>
                {barber.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-mono text-[10px] opacity-60">UID: {barber.uid}</p>
            <p>📞 {barber.phone}</p>
            {barber.address && <p>📍 {barber.address}</p>}
            {barber.dni && <p>🪪 DNI: {barber.dni}</p>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Staff</CardTitle>
        {!isAdding && !editingId && activeSubTab === 'active' && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
          <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
            <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">Activos ({activeBarbers.length})</TabsTrigger>
            <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">Inactivos ({inactiveBarbers.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4 space-y-3">
            {isAdding && (
              <StaffForm isEdit={false} initialData={formData} onSave={(data) => handleFormSave(data)} onCancel={cancelEdit} />
            )}
            {activeBarbers.map(renderBarberItem)}
            {activeBarbers.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay staff activo</p>
            )}
          </TabsContent>
          <TabsContent value="inactive" className="mt-4 space-y-3">
            {inactiveBarbers.map(renderBarberItem)}
            {inactiveBarbers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay staff inactivo</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <InviteUserDialog open={!!inviteBarber} onOpenChange={(open) => !open && setInviteBarber(null)} barber={inviteBarber || undefined} />
      <StaffPinDialog open={!!pinDialogBarber} onOpenChange={(open) => !open && setPinDialogBarber(null)}
        barberId={pinDialogBarber?.id || ''} barberName={pinDialogBarber ? `${pinDialogBarber.firstName} ${pinDialogBarber.lastName}` : ''}
        hasPin={pinDialogBarber ? !!barberPinStatus[pinDialogBarber.id] : false} onPinUpdated={fetchPinStatus} />
    </Card>
  );
}
