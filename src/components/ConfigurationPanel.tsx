import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Save, X, Scissors, Sparkles, Users, Tag, Power, PowerOff, Trash2, ChevronDown, Building2, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Service, Extra, Barber, Discount, Line } from '@/types/barbershop';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { OrganizationSettings } from './OrganizationSettings';
import { InviteUserDialog } from './InviteUserDialog';
import { StaffPinDialog } from './StaffPinDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ConfigurationPanelProps {
  services: Service[];
  extras: Extra[];
  barbers: Barber[];
  discounts: Discount[];
  lines: Line[];
  onAddService: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onAddExtra: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdateExtra: (id: string, updates: Partial<Extra>) => void;
  onAddBarber: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdateBarber: (id: string, updates: Partial<Barber>) => void;
  onAddDiscount: (discount: Omit<Discount, 'id'>) => void;
  onUpdateDiscount: (id: string, updates: Partial<Discount>) => void;
  onDeleteDiscount: (id: string) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
}

export function ConfigurationPanel({
  services,
  extras,
  barbers,
  discounts,
  lines,
  onAddService,
  onUpdateService,
  onAddExtra,
  onUpdateExtra,
  onAddBarber,
  onUpdateBarber,
  onAddDiscount,
  onUpdateDiscount,
  onDeleteDiscount,
  onAddLine,
  onUpdateLine,
}: ConfigurationPanelProps) {
  const { isOwner } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Administra tu negocio, servicios, extras, staff y descuentos</p>
      </div>

      <Tabs defaultValue={isOwner ? "business" : "services"} className="w-full">
        <TabsList className="w-full h-11 bg-muted p-1 rounded-lg">
          {isOwner && (
            <TabsTrigger value="business" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Negocio</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="services" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Scissors className="h-4 w-4" />
            <span className="hidden sm:inline">Servicios</span>
          </TabsTrigger>
          <TabsTrigger value="extras" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Extras</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex-1 flex items-center justify-center gap-2 data-[state=active]:bg-card rounded-md text-xs sm:text-sm">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Descuentos</span>
          </TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="business" className="mt-6">
            <OrganizationSettings />
          </TabsContent>
        )}

        <TabsContent value="services" className="mt-6">
          <ServicesList
            services={services}
            lines={lines}
            onAdd={onAddService}
            onUpdate={onUpdateService}
            onAddLine={onAddLine}
          />
        </TabsContent>

        <TabsContent value="extras" className="mt-6">
          <ExtrasList
            extras={extras}
            onAdd={onAddExtra}
            onUpdate={onUpdateExtra}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-6">
          <StaffList
            barbers={barbers}
            onAdd={onAddBarber}
            onUpdate={onUpdateBarber}
          />
        </TabsContent>

        <TabsContent value="discounts" className="mt-6">
          <DiscountsList
            discounts={discounts}
            onAdd={onAddDiscount}
            onUpdate={onUpdateDiscount}
            onDelete={onDeleteDiscount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServicesList({
  services,
  lines,
  onAdd,
  onUpdate,
  onAddLine,
}: {
  services: Service[];
  lines: Line[];
  onAdd: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newLineId, setNewLineId] = useState<string>('');
  const [editLineId, setEditLineId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  
  // Dialog for adding new line
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [addLineContext, setAddLineContext] = useState<'add' | 'edit'>('add');

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);
  const activeLines = lines.filter(l => l.active);

  const handleAdd = () => {
    if (newName && newPrice) {
      onAdd({ 
        name: newName, 
        price: parseFloat(newPrice), 
        active: true,
        lineId: newLineId && newLineId !== 'none' ? newLineId : undefined,
        lineName: activeLines.find(l => l.id === newLineId)?.name,
      });
      setNewName('');
      setNewPrice('');
      setNewLineId('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName && newPrice) {
      onUpdate(id, { 
        name: newName, 
        price: parseFloat(newPrice),
        lineId: editLineId && editLineId !== 'none' ? editLineId : undefined,
        lineName: activeLines.find(l => l.id === editLineId)?.name,
      });
      setEditingId(null);
      setNewName('');
      setNewPrice('');
      setEditLineId('');
    }
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setNewName(service.name);
    setNewPrice(service.price.toString());
    setEditLineId(service.lineId || '');
  };

  const handleAddNewLine = async () => {
    if (newLineName.trim()) {
      const newLine = await onAddLine({ name: newLineName.trim(), active: true });
      if (newLine) {
        if (addLineContext === 'add') {
          setNewLineId(newLine.id);
        } else {
          setEditLineId(newLine.id);
        }
      }
      setNewLineName('');
      setShowAddLineDialog(false);
    }
  };

  const openAddLineDialog = (context: 'add' | 'edit') => {
    setAddLineContext(context);
    setShowAddLineDialog(true);
  };

  const renderServiceItem = (service: Service) => (
    <div
      key={service.id}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
    >
      {editingId === service.id ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/80 px-2 py-1 rounded">
            <span className="font-medium">UID:</span>
            <span className="font-mono">{service.uid}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              className="flex-1 min-w-[120px]"
            />
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Precio"
              className="w-28"
            />
            <div className="flex items-center gap-1">
              <Select value={editLineId} onValueChange={setEditLineId}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Línea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin línea</SelectItem>
                  {activeLines.map(line => (
                    <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('edit')} title="Nueva línea">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button size="icon" onClick={() => handleUpdate(service.id)} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <span className="font-medium text-foreground">{service.name}</span>
            {service.lineName && (
              <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {service.lineName}
              </span>
            )}
          </div>
          <span className="text-muted-foreground">${service.price.toLocaleString()}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => startEdit(service)}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onUpdate(service.id, { active: !service.active })}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            title={service.active ? 'Desactivar' : 'Activar'}
          >
            {service.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Servicios</CardTitle>
          {!isAdding && activeSubTab === 'active' && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">
                Activos ({activeServices.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">
                Inactivos ({inactiveServices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 space-y-2">
              {isAdding && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg animate-scale-in">
                  <Input
                    placeholder="Nombre"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 min-w-[120px]"
                  />
                  <Input
                    type="number"
                    placeholder="Precio"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-28"
                  />
                  <div className="flex items-center gap-1">
                    <Select value={newLineId} onValueChange={setNewLineId}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Línea" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin línea</SelectItem>
                        {activeLines.map(line => (
                          <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('add')} title="Nueva línea">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {activeServices.map(renderServiceItem)}
              {activeServices.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay servicios activos</p>
              )}
            </TabsContent>

            <TabsContent value="inactive" className="mt-4 space-y-2">
              {inactiveServices.map(renderServiceItem)}
              {inactiveServices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay servicios inactivos</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog para agregar nueva línea */}
      <Dialog open={showAddLineDialog} onOpenChange={setShowAddLineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Línea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nombre de la línea (ej: Essencial, Deluxe)"
              value={newLineName}
              onChange={(e) => setNewLineName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNewLine()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLineDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNewLine} disabled={!newLineName.trim()}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExtrasList({
  extras,
  onAdd,
  onUpdate,
}: {
  extras: Extra[];
  onAdd: (extra: Omit<Extra, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Extra>) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');

  const activeExtras = extras.filter(e => e.active);
  const inactiveExtras = extras.filter(e => !e.active);

  const handleAdd = () => {
    if (newName && newPrice) {
      onAdd({ name: newName, price: parseFloat(newPrice), active: true });
      setNewName('');
      setNewPrice('');
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName && newPrice) {
      onUpdate(id, { name: newName, price: parseFloat(newPrice) });
      setEditingId(null);
      setNewName('');
      setNewPrice('');
    }
  };

  const startEdit = (extra: Extra) => {
    setEditingId(extra.id);
    setNewName(extra.name);
    setNewPrice(extra.price.toString());
  };

  const renderExtraItem = (extra: Extra) => (
    <div
      key={extra.id}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
    >
      {editingId === extra.id ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/80 px-2 py-1 rounded">
            <span className="font-medium">UID:</span>
            <span className="font-mono">{extra.uid}</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-28"
            />
            <Button size="icon" onClick={() => handleUpdate(extra.id)} className="bg-success hover:bg-success/90">
              <Save className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span className="flex-1 font-medium text-foreground">{extra.name}</span>
          <span className="text-muted-foreground">${extra.price.toLocaleString()}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => startEdit(extra)}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onUpdate(extra.id, { active: !extra.active })}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            title={extra.active ? 'Desactivar' : 'Activar'}
          >
            {extra.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Extras</CardTitle>
        {!isAdding && activeSubTab === 'active' && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
          <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
            <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">
              Activos ({activeExtras.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">
              Inactivos ({inactiveExtras.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-2">
            {isAdding && (
              <div className="flex gap-2 p-3 bg-muted rounded-lg animate-scale-in">
                <Input
                  placeholder="Nombre"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Precio"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-28"
                />
                <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {activeExtras.map(renderExtraItem)}
            {activeExtras.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay extras activos</p>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="mt-4 space-y-2">
            {inactiveExtras.map(renderExtraItem)}
            {inactiveExtras.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay extras inactivos</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StaffList({
  barbers,
  onAdd,
  onUpdate,
}: {
  barbers: Barber[];
  onAdd: (barber: Omit<Barber, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Barber>) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [inviteBarber, setInviteBarber] = useState<Barber | null>(null);
  const [pinDialogBarber, setPinDialogBarber] = useState<Barber | null>(null);
  const [barberPinStatus, setBarberPinStatus] = useState<Record<string, boolean>>({});
  
  // Fetch PIN status for all barbers
  const fetchPinStatus = useCallback(async () => {
    if (barbers.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('barberos')
        .select('id, pin_hash')
        .in('id', barbers.map(b => b.id));
      
      if (error) throw error;
      
      const status: Record<string, boolean> = {};
      data?.forEach(b => {
        status[b.id] = !!b.pin_hash;
      });
      setBarberPinStatus(status);
    } catch (error) {
      console.error('Error fetching PIN status:', error);
    }
  }, [barbers]);

  useEffect(() => {
    fetchPinStatus();
  }, [fetchPinStatus]);
  
  // Form state - commission as string for free editing
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    commission: '40',
    address: '',
    dni: '',
  });
  const [commissionError, setCommissionError] = useState('');

  const activeBarbers = barbers.filter(b => b.active);
  const inactiveBarbers = barbers.filter(b => !b.active);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      commission: '40',
      address: '',
      dni: '',
    });
    setCommissionError('');
  };

  const validateCommission = (value: string): boolean => {
    const num = Number(value);
    if (value === '' || isNaN(num)) {
      setCommissionError('Ingresa un número válido');
      return false;
    }
    if (num < 0 || num > 100) {
      setCommissionError('Debe estar entre 0 y 100');
      return false;
    }
    setCommissionError('');
    return true;
  };

  const handleAdd = () => {
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      return;
    }
    if (!validateCommission(formData.commission)) {
      return;
    }
    onAdd({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      commission: Number(formData.commission),
      address: formData.address || undefined,
      dni: formData.dni || undefined,
      active: true,
    });
    resetForm();
    setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      return;
    }
    if (!validateCommission(formData.commission)) {
      return;
    }
    onUpdate(id, {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      commission: Number(formData.commission),
      address: formData.address || undefined,
      dni: formData.dni || undefined,
    });
    setEditingId(null);
    resetForm();
  };

  const startEdit = (barber: Barber) => {
    setEditingId(barber.id);
    setFormData({
      firstName: barber.firstName,
      lastName: barber.lastName,
      phone: barber.phone,
      commission: String(barber.commission),
      address: barber.address || '',
      dni: barber.dni || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const StaffForm = React.memo(({ 
    isEdit, 
    barberId,
    initialData,
    onSave,
    onCancel 
  }: { 
    isEdit: boolean; 
    barberId?: string;
    initialData: typeof formData;
    onSave: (data: typeof formData) => void;
    onCancel: () => void;
  }) => {
    // Local state to prevent parent re-renders on every keystroke
    const [localData, setLocalData] = useState(initialData);
    const [localCommissionError, setLocalCommissionError] = useState('');

    const validateLocalCommission = (value: string): boolean => {
      const num = Number(value);
      if (value === '' || isNaN(num)) {
        setLocalCommissionError('Ingresa un número válido');
        return false;
      }
      if (num < 0 || num > 100) {
        setLocalCommissionError('Debe estar entre 0 y 100');
        return false;
      }
      setLocalCommissionError('');
      return true;
    };

    const handleSubmit = () => {
      if (!localData.firstName || !localData.lastName || !localData.phone) {
        return;
      }
      if (!validateLocalCommission(localData.commission)) {
        return;
      }
      onSave(localData);
    };

    return (
      <div className="space-y-3 p-4 bg-muted rounded-lg animate-scale-in">
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Nombre *"
            value={localData.firstName}
            onChange={(e) => setLocalData(prev => ({ ...prev, firstName: e.target.value }))}
            autoComplete="off"
          />
          <Input
            placeholder="Apellido *"
            value={localData.lastName}
            onChange={(e) => setLocalData(prev => ({ ...prev, lastName: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Teléfono *"
            value={localData.phone}
            onChange={(e) => setLocalData(prev => ({ ...prev, phone: e.target.value }))}
            autoComplete="off"
          />
          <div>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Comisión % *"
              value={localData.commission}
              onChange={(e) => {
                const value = e.target.value;
                setLocalData(prev => ({ ...prev, commission: value }));
                if (value) validateLocalCommission(value);
              }}
              onBlur={() => validateLocalCommission(localData.commission)}
              className={localCommissionError ? 'border-destructive' : ''}
              autoComplete="off"
            />
            {localCommissionError && (
              <p className="text-xs text-destructive mt-1">{localCommissionError}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Dirección (opcional)"
            value={localData.address}
            onChange={(e) => setLocalData(prev => ({ ...prev, address: e.target.value }))}
            autoComplete="off"
            name="staff-address-field"
          />
          <Input
            placeholder="DNI (opcional)"
            value={localData.dni}
            onChange={(e) => setLocalData(prev => ({ ...prev, dni: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button 
            size="sm" 
            onClick={handleSubmit}
            className="bg-success hover:bg-success/90"
            disabled={!localData.firstName || !localData.lastName || !localData.phone || !!localCommissionError}
          >
            <Save className="h-4 w-4 mr-1" />
            {isEdit ? 'Guardar' : 'Agregar'}
          </Button>
        </div>
      </div>
    );
  });

  const handleFormSave = (data: typeof formData, barberId?: string) => {
    if (barberId) {
      onUpdate(barberId, {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        commission: Number(data.commission),
        address: data.address || undefined,
        dni: data.dni || undefined,
      });
      setEditingId(null);
    } else {
      onAdd({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        commission: Number(data.commission),
        address: data.address || undefined,
        dni: data.dni || undefined,
        active: true,
      });
      setIsAdding(false);
    }
    resetForm();
  };

  const renderBarberItem = (barber: Barber) => (
    <div key={barber.id}>
      {editingId === barber.id ? (
        <StaffForm 
          isEdit={true} 
          barberId={barber.id}
          initialData={{
            firstName: barber.firstName,
            lastName: barber.lastName,
            phone: barber.phone,
            commission: String(barber.commission),
            address: barber.address || '',
            dni: barber.dni || '',
          }}
          onSave={(data) => handleFormSave(data, barber.id)}
          onCancel={cancelEdit}
        />
      ) : (
        <div className="p-4 rounded-lg bg-muted/50 group hover:bg-muted transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">
                {barber.firstName} {barber.lastName}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                {barber.commission}% comisión
              </span>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPinDialogBarber(barber)}
                className={`h-8 w-8 ${barberPinStatus[barber.id] ? 'text-primary' : ''}`}
                title={barberPinStatus[barber.id] ? 'PIN configurado - Clic para editar' : 'Configurar PIN de acceso'}
              >
                <Lock className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setInviteBarber(barber)}
                className="h-8 w-8"
                title="Invitar a usar el sistema"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => startEdit(barber)}
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onUpdate(barber.id, { active: !barber.active })}
                className="h-8 w-8"
                title={barber.active ? 'Desactivar' : 'Activar'}
              >
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
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
          <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
            <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">
              Activos ({activeBarbers.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">
              Inactivos ({inactiveBarbers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {isAdding && (
              <StaffForm 
                isEdit={false}
                initialData={formData}
                onSave={(data) => handleFormSave(data)}
                onCancel={cancelEdit}
              />
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

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={!!inviteBarber}
        onOpenChange={(open) => !open && setInviteBarber(null)}
        barber={inviteBarber || undefined}
      />

      {/* Staff PIN Dialog */}
      <StaffPinDialog
        open={!!pinDialogBarber}
        onOpenChange={(open) => !open && setPinDialogBarber(null)}
        barberId={pinDialogBarber?.id || ''}
        barberName={pinDialogBarber ? `${pinDialogBarber.firstName} ${pinDialogBarber.lastName}` : ''}
        hasPin={pinDialogBarber ? !!barberPinStatus[pinDialogBarber.id] : false}
        onPinUpdated={fetchPinStatus}
      />
    </Card>
  );
}

function DiscountsList({
  discounts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  discounts: Discount[];
  onAdd: (discount: Omit<Discount, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Discount>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed'>('percentage');
  const [newRounding, setNewRounding] = useState<'cliente' | 'negocio'>('cliente');
  const [newPaymentMethod, setNewPaymentMethod] = useState<'todos' | 'efectivo' | 'mercado_pago'>('todos');

  const resetForm = () => {
    setNewLabel('');
    setNewValue('');
    setNewType('percentage');
    setNewRounding('cliente');
    setNewPaymentMethod('todos');
  };

  const handleAdd = () => {
    if (newLabel && newValue) {
      onAdd({ 
        label: newLabel, 
        value: parseFloat(newValue), 
        type: newType,
        rounding: newRounding,
        paymentMethod: newPaymentMethod,
      });
      resetForm();
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newLabel && newValue) {
      onUpdate(id, { 
        label: newLabel, 
        value: parseFloat(newValue), 
        type: newType,
        rounding: newRounding,
        paymentMethod: newPaymentMethod,
      });
      setEditingId(null);
      resetForm();
    }
  };

  const startEdit = (discount: Discount) => {
    setEditingId(discount.id);
    setNewLabel(discount.label);
    setNewValue(discount.value.toString());
    setNewType(discount.type || 'percentage');
    setNewRounding(discount.rounding || 'cliente');
    setNewPaymentMethod(discount.paymentMethod || 'todos');
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'efectivo': return 'Solo Efectivo';
      case 'mercado_pago': return 'Solo MP';
      default: return 'Todos';
    }
  };

  const getRoundingLabel = (rounding: string) => {
    return rounding === 'cliente' ? '↓ Cliente' : '↑ Negocio';
  };

  const DiscountForm = ({ isEdit = false, discountId = '' }: { isEdit?: boolean; discountId?: string }) => (
    <div className="space-y-4 p-4 bg-muted rounded-lg animate-scale-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nombre</label>
          <Input
            placeholder="Ej: Promo Amigo"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={newType} onValueChange={(v) => setNewType(v as 'percentage' | 'fixed')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentaje (%)</SelectItem>
              <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {newType === 'percentage' ? 'Porcentaje' : 'Monto'}
          </label>
          <Input
            type="number"
            placeholder={newType === 'percentage' ? '% (ej: 15)' : '$ (ej: 1000)'}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            min="0"
            max={newType === 'percentage' ? 100 : undefined}
          />
        </div>
        {newType === 'percentage' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Redondeo</label>
            <Select value={newRounding} onValueChange={(v) => setNewRounding(v as 'cliente' | 'negocio')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">↓ Favor Cliente (redondea hacia abajo)</SelectItem>
                <SelectItem value="negocio">↑ Favor Negocio (redondea hacia arriba)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Aplica con método de pago</label>
          <Select value={newPaymentMethod} onValueChange={(v) => setNewPaymentMethod(v as 'todos' | 'efectivo' | 'mercado_pago')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los métodos</SelectItem>
              <SelectItem value="efectivo">Solo Efectivo</SelectItem>
              <SelectItem value="mercado_pago">Solo Mercado Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            if (isEdit) setEditingId(null);
            else setIsAdding(false);
            resetForm();
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button 
          size="sm"
          onClick={() => isEdit ? handleUpdate(discountId) : handleAdd()}
          className="bg-success hover:bg-success/90"
        >
          <Save className="h-4 w-4 mr-1" />
          {isEdit ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Descuentos Predefinidos</CardTitle>
        {!isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Configura descuentos por porcentaje o monto fijo, con opciones de redondeo y restricción por método de pago.
        </p>

        {isAdding && <DiscountForm />}

        {discounts.map((discount) => (
          <div key={discount.id}>
            {editingId === discount.id ? (
              <DiscountForm isEdit discountId={discount.id} />
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{discount.label}</span>
                    <span className="text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {discount.type === 'fixed' ? `$${discount.value.toLocaleString()}` : `${discount.value}%`}
                    </span>
                    {discount.type === 'percentage' && discount.id !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {getRoundingLabel(discount.rounding)}
                      </span>
                    )}
                    {discount.paymentMethod !== 'todos' && discount.id !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                        {getPaymentMethodLabel(discount.paymentMethod)}
                      </span>
                    )}
                  </div>
                </div>
                {discount.id !== 'none' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(discount)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(discount.id)}
                      className="text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
