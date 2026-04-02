import { useState } from 'react';
import { Plus, Edit2, Save, X, PowerOff, Power, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Service, Line } from '@/types/barbershop';

interface ServicesConfigProps {
  services: Service[];
  lines: Line[];
  onAdd: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
}

interface ToggleConfirm {
  service: Service;
  action: 'activate' | 'deactivate';
}

export function ServicesConfig({ services, lines, onAdd, onUpdate, onAddLine }: ServicesConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newLineId, setNewLineId] = useState<string>('');
  const [editLineId, setEditLineId] = useState<string>('');
  const [editDuration, setEditDuration] = useState('30');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [newLineColor, setNewLineColor] = useState('');
  const [addLineContext, setAddLineContext] = useState<'add' | 'edit'>('add');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);

  const LINE_COLORS = [
    { label: 'Azul', value: '#3B82F6' },
    { label: 'Verde', value: '#22C55E' },
    { label: 'Dorado', value: '#EAB308' },
    { label: 'Rojo', value: '#EF4444' },
    { label: 'Violeta', value: '#8B5CF6' },
    { label: 'Naranja', value: '#F97316' },
    { label: 'Rosa', value: '#EC4899' },
    { label: 'Gris', value: '#6B7280' },
  ];

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);
  const activeLines = lines.filter(l => l.active);

  const handleAdd = () => {
    const dur = parseInt(newDuration) || 30;
    if (newName && newPrice && dur >= 5) {
      onAdd({
        name: newName, price: parseFloat(newPrice), durationMin: dur, active: true,
        lineId: newLineId && newLineId !== 'none' ? newLineId : undefined,
        lineName: activeLines.find(l => l.id === newLineId)?.name,
      });
      setNewName(''); setNewPrice(''); setNewDuration('30'); setNewLineId(''); setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    const dur = parseInt(editDuration) || 30;
    if (newName && newPrice && dur >= 5) {
      onUpdate(id, {
        name: newName, price: parseFloat(newPrice), durationMin: dur,
        lineId: editLineId && editLineId !== 'none' ? editLineId : undefined,
        lineName: activeLines.find(l => l.id === editLineId)?.name,
      });
      setEditingId(null); setNewName(''); setNewPrice(''); setEditLineId(''); setEditDuration('30');
    }
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setNewName(service.name);
    setNewPrice(service.price.toString());
    setEditDuration((service.durationMin || 30).toString());
    setEditLineId(service.lineId || '');
  };

  const handleAddNewLine = async () => {
    if (newLineName.trim()) {
      const newLine = await onAddLine({ name: newLineName.trim(), active: true, color: newLineColor || undefined });
      if (newLine) {
        if (addLineContext === 'add') setNewLineId(newLine.id);
        else setEditLineId(newLine.id);
      }
      setNewLineName(''); setNewLineColor(''); setShowAddLineDialog(false);
    }
  };

  const openAddLineDialog = (context: 'add' | 'edit') => {
    setAddLineContext(context);
    setShowAddLineDialog(true);
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.service.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const renderServiceItem = (service: Service) => (
    <div key={service.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      {editingId === service.id ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-wrap gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[120px]" />
            <CurrencyInput value={newPrice} onChange={setNewPrice} placeholder="Precio" className="w-28" />
            <div className="flex items-center gap-1">
              <Input type="number" min={5} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="Tiempo" className="w-20" />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1">
              <Select value={editLineId} onValueChange={setEditLineId}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Línea" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin línea</SelectItem>
                  {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('edit')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
            </div>
            <Button size="icon" onClick={() => handleUpdate(service.id)} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <span className="font-medium text-foreground">{service.name}</span>
            {service.lineName && (
              <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{service.lineName}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />{service.durationMin || 30} min
          </span>
          <span className="text-muted-foreground">${service.price.toLocaleString()}</span>
          <Button size="icon" variant="ghost" onClick={() => startEdit(service)} className="h-8 w-8">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setToggleConfirm({ service, action: service.active ? 'deactivate' : 'activate' })} className="h-8 w-8" title={service.active ? 'Desactivar' : 'Activar'}>
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
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">Activos ({activeServices.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">Inactivos ({inactiveServices.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-2">
              {isAdding && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 border border-border rounded-lg animate-scale-in">
                  <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 min-w-[120px]" />
                  <CurrencyInput placeholder="Precio" value={newPrice} onChange={setNewPrice} className="w-28" />
                  <div className="flex items-center gap-1">
                    <Input type="number" min={5} placeholder="Min" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className="w-20" />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={newLineId} onValueChange={setNewLineId}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="Línea" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin línea</SelectItem>
                        {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('add')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
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

      {/* Toggle confirmation dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar servicio' : 'Activar servicio'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.service.name}"?`
                : `¿Querés volver a activar "${toggleConfirm?.service.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle}>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddLineDialog} onOpenChange={setShowAddLineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Línea</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nombre de la línea (ej: Essencial, Deluxe)" value={newLineName} onChange={(e) => setNewLineName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddNewLine()} />
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Color (opcional)</label>
              <div className="flex flex-wrap gap-2">
                {LINE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewLineColor(newLineColor === c.value ? '' : c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${newLineColor === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLineDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddNewLine} disabled={!newLineName.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
