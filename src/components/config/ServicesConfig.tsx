import { useState } from 'react';
import { Plus, Edit2, Save, X, PowerOff, Power, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Service, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { LineQuickEditPopover } from './LineQuickEditPopover';

interface ServicesConfigProps {
  services: Service[];
  lines: Line[];
  onAdd: (service: Omit<Service, 'id' | 'uid'>) => void;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onAddLine: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  /** Si se provee, habilita edición rápida de la línea seleccionada. */
  onUpdateLine?: (id: string, updates: Partial<Line>) => void | Promise<void>;
  /** Si se provee, habilita eliminación de líneas inactivas desde el popover. */
  onDeleteLine?: (id: string) => void | Promise<void>;
  /** Opcional: si se provee, habilita botón "Eliminar" para servicios inactivos. */
  onDelete?: (id: string) => void;
  /**
   * 'global' = edita catálogo global (sin precio); usa globalActive para Activos/Inactivos.
   * 'sucursal' (default) = comportamiento histórico por sucursal.
   */
  mode?: 'global' | 'sucursal';
  /** Permite crear nuevos servicios. Default true. */
  canCreate?: boolean;
  /** Permite editar nombre, duración y línea. Si es false, solo precio y activo se pueden modificar. Default true. */
  canEditStructure?: boolean;
}

interface ToggleConfirm {
  service: Service;
  action: 'activate' | 'deactivate';
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'El nombre no puede estar vacío.';
  if (trimmed.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  return null;
}

function validatePrice(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = (raw || '').toString().trim();
  if (!cleaned) return { ok: false, error: 'El precio debe ser un número igual o mayor a 0.' };
  const value = parseFloat(cleaned);
  if (Number.isNaN(value) || value < 0) {
    return { ok: false, error: 'El precio debe ser un número igual o mayor a 0.' };
  }
  return { ok: true, value };
}

function validateDuration(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const value = parseInt(raw, 10);
  if (Number.isNaN(value) || value < 5) {
    return { ok: false, error: 'La duración debe ser de al menos 5 minutos.' };
  }
  return { ok: true, value };
}

export function ServicesConfig({ services, lines, onAdd, onUpdate, onAddLine, onDelete, mode = 'sucursal', canCreate = true, canEditStructure = true }: ServicesConfigProps) {
  const isGlobal = mode === 'global';
  const structureLocked = !canEditStructure;
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
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);

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

  const flagFor = (s: Service) => isGlobal ? (s.globalActive ?? s.active) : s.active;
  const activeServices = services.filter(s => flagFor(s));
  const inactiveServices = services.filter(s => !flagFor(s));
  const activeLines = lines.filter(l => l.active);

  const handleAdd = () => {
    const nameErr = validateName(newName);
    if (nameErr) { toast.error(nameErr); return; }
    const dur = validateDuration(newDuration);
    if (dur.ok === false) { toast.error(dur.error); return; }
    let price = 0;
    if (!isGlobal) {
      const v = validatePrice(newPrice);
      if (v.ok === false) { toast.error(v.error); return; }
      price = v.value;
    }
    onAdd({
      name: newName.trim(),
      price,
      durationMin: dur.value,
      active: true,
      lineId: newLineId && newLineId !== 'none' ? newLineId : undefined,
      lineName: activeLines.find(l => l.id === newLineId)?.name,
    });
    setNewName(''); setNewPrice(''); setNewDuration('30'); setNewLineId(''); setIsAdding(false);
  };

  const handleUpdate = (id: string) => {
    const updates: Partial<Service> = {};
    if (!structureLocked) {
      const nameErr = validateName(newName);
      if (nameErr) { toast.error(nameErr); return; }
      const dur = validateDuration(editDuration);
      if (dur.ok === false) { toast.error(dur.error); return; }
      updates.name = newName.trim();
      updates.durationMin = dur.value;
      updates.lineId = editLineId && editLineId !== 'none' ? editLineId : undefined;
      updates.lineName = activeLines.find(l => l.id === editLineId)?.name;
    }
    if (!isGlobal) {
      const v = validatePrice(newPrice);
      if (v.ok === false) { toast.error(v.error); return; }
      updates.price = v.value;
    }
    onUpdate(id, updates);
    setEditingId(null); setNewName(''); setNewPrice(''); setEditLineId(''); setEditDuration('30');
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setNewName(service.name);
    setNewPrice(service.price ? String(service.price) : '');
    setEditDuration((service.durationMin || 30).toString());
    setEditLineId(service.lineId || '');
  };

  const handleAddNewLine = async () => {
    const nameErr = validateName(newLineName);
    if (nameErr) { toast.error(nameErr); return; }
    const newLine = await onAddLine({ name: newLineName.trim(), active: true, color: newLineColor || undefined });
    if (newLine) {
      if (addLineContext === 'add') setNewLineId(newLine.id);
      else setEditLineId(newLine.id);
    }
    setNewLineName(''); setNewLineColor(''); setShowAddLineDialog(false);
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

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !onDelete) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const isItemActive = (service: Service) =>
    isGlobal ? (service.globalActive ?? service.active) : service.active;

  const renderServiceItem = (service: Service) => {
    const itemActive = isItemActive(service);
    const linkedLine = lines.find(l => l.id === service.lineId && l.active);
    return (
    <div key={service.id} className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
      {editingId === service.id ? (
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="space-y-1.5 sm:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} disabled={structureLocked} />
            </div>
            {!isGlobal && (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Precio</label>
                <CurrencyInput value={newPrice} onChange={setNewPrice} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Duración</label>
              <div className="flex items-center gap-1">
                <Input type="number" inputMode="numeric" min={5} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} disabled={structureLocked} />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <div className={`space-y-1.5 ${isGlobal ? 'sm:col-span-4' : 'sm:col-span-3'}`}>
              <label className="text-xs font-medium text-muted-foreground">Línea</label>
              <div className="flex items-center gap-1">
                <Select value={editLineId || 'none'} onValueChange={setEditLineId} disabled={structureLocked}>
                  <SelectTrigger><SelectValue placeholder="Sin línea" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin línea</SelectItem>
                    {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                {!structureLocked && (
                  <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('edit')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:col-span-1 justify-end">
              <Button size="icon" onClick={() => handleUpdate(service.id)} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {linkedLine?.color && (
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: linkedLine.color }} />
            )}
            <span className="font-medium text-foreground truncate">{service.name}</span>
            {linkedLine && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={linkedLine.color
                  ? { backgroundColor: `${linkedLine.color}1A`, color: linkedLine.color }
                  : undefined}
              >
                {linkedLine.name}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />{service.durationMin || 30} min
          </span>
          {!isGlobal && (
            <span className="text-muted-foreground tabular-nums">${service.price.toLocaleString('es-AR')}</span>
          )}
          <Button size="icon" variant="ghost" onClick={() => startEdit(service)} className="h-8 w-8" title="Editar">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setToggleConfirm({ service, action: itemActive ? 'deactivate' : 'activate' })} className="h-8 w-8" title={itemActive ? 'Desactivar' : 'Activar'}>
            {itemActive ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-success" />}
          </Button>
          {onDelete && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={itemActive}
                      onClick={() => !itemActive && setDeleteConfirm(service)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-40"
                      title={itemActive ? undefined : 'Eliminar'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {itemActive && (
                  <TooltipContent>Para eliminar este elemento, primero debes desactivarlo.</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
    );
  };

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Servicios</CardTitle>
          {!isAdding && activeSubTab === 'active' && canCreate && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isGlobal && (
            <p className="text-xs text-muted-foreground">
              Los precios de los servicios se configuran por sucursal.
            </p>
          )}
          {structureLocked && (
            <p className="text-xs text-muted-foreground">
              Como encargado de sucursal, podés ajustar el precio y activar o desactivar servicios para tu sucursal. Para crear servicios o cambiar nombre, duración o línea, contactá al dueño o gerente general.
            </p>
          )}
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">Activos ({activeServices.length})</TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">Inactivos ({inactiveServices.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-2">
              {isAdding && (
                <div className="p-3 bg-muted/30 border border-border rounded-lg animate-scale-in">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="space-y-1.5 sm:col-span-4">
                      <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Ej: Corte clásico" />
                    </div>
                    {!isGlobal && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Precio</label>
                        <CurrencyInput value={newPrice} onChange={setNewPrice} placeholder="0" />
                      </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Duración</label>
                      <div className="flex items-center gap-1">
                        <Input type="number" inputMode="numeric" min={5} value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <div className={`space-y-1.5 ${isGlobal ? 'sm:col-span-4' : 'sm:col-span-3'}`}>
                      <label className="text-xs font-medium text-muted-foreground">Línea</label>
                      <div className="flex items-center gap-1">
                        <Select value={newLineId || 'none'} onValueChange={setNewLineId}>
                          <SelectTrigger><SelectValue placeholder="Sin línea" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin línea</SelectItem>
                            {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('add')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-1 justify-end">
                      <Button size="icon" onClick={handleAdd} className="bg-success hover:bg-success/90"><Save className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription>
              Este elemento dejará de aparecer en el sistema. No se modificarán los registros históricos donde ya haya sido utilizado. Esta acción no se podrá deshacer desde la interfaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAddLineDialog} onOpenChange={setShowAddLineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva línea</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nombre de la línea (ej: Essencial, Deluxe)" value={newLineName} onChange={(e) => setNewLineName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddNewLine()} maxLength={80} />
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Color (opcional)</label>
              <div className="flex flex-wrap gap-2">
                {LINE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewLineColor(newLineColor === c.value ? '' : c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-colors ${newLineColor === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
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
