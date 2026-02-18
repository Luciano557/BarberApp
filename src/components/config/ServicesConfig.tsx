import { useState } from 'react';
import { Plus, Edit2, Save, X, PowerOff, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Service, Line } from '@/types/barbershop';

interface ServicesConfigProps {
  services: Service[];
  lines: Line[];
  onAdd: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
}

export function ServicesConfig({ services, lines, onAdd, onUpdate, onAddLine }: ServicesConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newLineId, setNewLineId] = useState<string>('');
  const [editLineId, setEditLineId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [addLineContext, setAddLineContext] = useState<'add' | 'edit'>('add');

  const activeServices = services.filter(s => s.active);
  const inactiveServices = services.filter(s => !s.active);
  const activeLines = lines.filter(l => l.active);

  const handleAdd = () => {
    if (newName && newPrice) {
      onAdd({
        name: newName, price: parseFloat(newPrice), active: true,
        lineId: newLineId && newLineId !== 'none' ? newLineId : undefined,
        lineName: activeLines.find(l => l.id === newLineId)?.name,
      });
      setNewName(''); setNewPrice(''); setNewLineId(''); setIsAdding(false);
    }
  };

  const handleUpdate = (id: string) => {
    if (newName && newPrice) {
      onUpdate(id, {
        name: newName, price: parseFloat(newPrice),
        lineId: editLineId && editLineId !== 'none' ? editLineId : undefined,
        lineName: activeLines.find(l => l.id === editLineId)?.name,
      });
      setEditingId(null); setNewName(''); setNewPrice(''); setEditLineId('');
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
        if (addLineContext === 'add') setNewLineId(newLine.id);
        else setEditLineId(newLine.id);
      }
      setNewLineName(''); setShowAddLineDialog(false);
    }
  };

  const openAddLineDialog = (context: 'add' | 'edit') => {
    setAddLineContext(context);
    setShowAddLineDialog(true);
  };

  const renderServiceItem = (service: Service) => (
    <div key={service.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      {editingId === service.id ? (
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/80 px-2 py-1 rounded">
            <span className="font-medium">UID:</span>
            <span className="font-mono">{service.uid}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[120px]" />
            <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Precio" className="w-28" />
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
          <span className="text-muted-foreground">${service.price.toLocaleString()}</span>
          <Button size="icon" variant="ghost" onClick={() => startEdit(service)} className="h-8 w-8">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onUpdate(service.id, { active: !service.active })} className="h-8 w-8" title={service.active ? 'Desactivar' : 'Activar'}>
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
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg animate-scale-in">
                  <Input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 min-w-[120px]" />
                  <Input type="number" placeholder="Precio" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-28" />
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

      <Dialog open={showAddLineDialog} onOpenChange={setShowAddLineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Línea</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nombre de la línea (ej: Essencial, Deluxe)" value={newLineName} onChange={(e) => setNewLineName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddNewLine()} />
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
