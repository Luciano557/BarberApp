import { useState } from 'react';
import { Plus, MoreVertical, Clock, Scissors } from 'lucide-react';
import { useShowMore } from '@/hooks/useShowMore';
import { ShowMoreDivider } from '@/components/ui/ShowMoreDivider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Service, Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { LineQuickEditPopover } from './LineQuickEditPopover';
import { DrawerForm } from '@/components/ui/drawer-form';
import { TagPill } from '@/components/ui/TagPill';
import { EntityColorBar } from '@/components/ui/EntityColorBar';
import { CatalogSectionCard } from '@/components/ui/CatalogSectionCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

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

export function ServicesConfig({ services, lines, onAdd, onUpdate, onAddLine, onUpdateLine, onDeleteLine, onDelete, mode = 'sucursal', canCreate = true, canEditStructure = true }: ServicesConfigProps) {
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
  const activeLines = lines.filter(l => l.active);
  const activeServices = services.filter(s => flagFor(s)).sort((a, b) => {
    const lineA = activeLines.find(l => l.id === a.lineId)?.name ?? null;
    const lineB = activeLines.find(l => l.id === b.lineId)?.name ?? null;
    if (lineA === null && lineB !== null) return 1;
    if (lineA !== null && lineB === null) return -1;
    if (lineA !== null && lineB !== null) {
      const cmp = lineA.localeCompare(lineB, 'es');
      if (cmp !== 0) return cmp;
    }
    if (!isGlobal) return (b.price ?? 0) - (a.price ?? 0);
    return a.name.localeCompare(b.name, 'es');
  });
  const inactiveServices = services.filter(s => !flagFor(s));
  const editingService = editingId ? (services.find(s => s.id === editingId) ?? null) : null;
  const editingIsActive = editingService ? flagFor(editingService) : false;

  const { visible, expanded, toggle, showDivider, hiddenCount, threshold } =
    useShowMore(activeServices, { isDefaultView: activeSubTab === 'active' });

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
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <EntityColorBar color={linkedLine?.color} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-medium text-foreground sm:truncate">{service.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:justify-end">
          {linkedLine && (
            <TagPill label={linkedLine.name} />
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{service.durationMin || 30} min
          </span>
          {!isGlobal && (
            <span className="text-muted-foreground tabular-nums">${service.price.toLocaleString('es-AR')}</span>
          )}
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={() => startEdit(service)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-muted transition-colors border-[0.5px] border-border"
            title="Opciones"
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <>
      <CatalogSectionCard
        icon={Scissors}
        title={isGlobal ? 'Catálogo de servicios' : 'Servicios de esta sucursal'}
        description={isGlobal
          ? 'Nombre, duración y categoría. Los precios se configuran en cada sucursal.'
          : 'Activá los servicios disponibles y configurá el precio.'}
        actions={
          !isAdding && !editingId && activeSubTab === 'active' && canCreate ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          ) : undefined
        }
        tabs={
          <SegmentedControl
            options={[
              { value: 'active', label: 'Activos', count: activeServices.length },
              { value: 'inactive', label: 'Inactivos', count: inactiveServices.length },
            ]}
            value={activeSubTab}
            onChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}
          />
        }
      >
        {activeSubTab === 'active' && (
          <div className="space-y-2" role="tabpanel">
            {visible.map((s, idx) => {
              const item = renderServiceItem(s);
              if (expanded && idx >= threshold) {
                return <div key={`sm-${s.id}`} className="animate-item-in">{item}</div>;
              }
              return item;
            })}
            {showDivider && (
              <ShowMoreDivider
                count={hiddenCount}
                onClick={toggle}
                expanded={expanded}
                label="servicios más"
              />
            )}
            {activeServices.length === 0 && !isAdding && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                <Scissors className="h-8 w-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No hay servicios activos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agregá el primer servicio para que aparezca en el cobro.
                  </p>
                </div>
                {canCreate && (
                  <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                    Agregar servicio
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {activeSubTab === 'inactive' && (
          <div className="space-y-2" role="tabpanel">
            {inactiveServices.map(renderServiceItem)}
            {inactiveServices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay servicios inactivos</p>
            )}
          </div>
        )}
      </CatalogSectionCard>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setIsAdding(false);
            setEditingId(null);
            setNewName('');
            setNewPrice('');
            setNewDuration('30');
            setNewLineId('');
            setEditDuration('30');
            setEditLineId('');
          }
        }}
        title={isAdding ? 'Agregar servicio' : 'Editar servicio'}
        size="sm"
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); setNewPrice(''); setNewDuration('30'); setNewLineId(''); }}>Cancelar</Button>
              <Button onClick={handleAdd}>Guardar</Button>
            </div>
          ) : editingService ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={() => handleUpdate(editingService.id)}>
                Guardar cambios
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ service: editingService, action: 'deactivate' });
                    setEditingId(null); setNewName(''); setNewPrice(''); setEditDuration('30'); setEditLineId('');
                  }}
                  className="bg-status-warning text-white hover:bg-status-warning/90"
                >
                  Desactivar
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onUpdate(editingService.id, { active: true });
                      toast.success('Servicio activado');
                      setEditingId(null); setNewName(''); setNewPrice(''); setEditDuration('30'); setEditLineId('');
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirm(editingService);
                        setEditingId(null); setNewName(''); setNewPrice(''); setEditDuration('30'); setEditLineId('');
                      }}
                    >
                      Eliminar
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : null
        }
      >
        {isAdding ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Ej: Corte clásico" />
            </div>
            {!isGlobal && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio</label>
                <CurrencyInput value={newPrice} onChange={setNewPrice} placeholder="0" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Duración</label>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" min={5} value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
                <span className="text-sm text-muted-foreground whitespace-nowrap">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Línea</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={newLineId || 'none'} onValueChange={setNewLineId}>
                  <SelectTrigger><SelectValue placeholder="Sin línea" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin línea</SelectItem>
                    {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                {onUpdateLine && (
                  <LineQuickEditPopover
                    line={lines.find(l => l.id === newLineId) || null}
                    onUpdate={onUpdateLine}
                    onDelete={onDeleteLine}
                    disabled={!newLineId || newLineId === 'none' || !lines.find(l => l.id === newLineId)}
                  />
                )}
                <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('add')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} disabled={structureLocked} />
            </div>
            {!isGlobal && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Precio</label>
                <CurrencyInput value={newPrice} onChange={setNewPrice} />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Duración</label>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" min={5} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} disabled={structureLocked} />
                <span className="text-sm text-muted-foreground whitespace-nowrap">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Línea</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={editLineId || 'none'} onValueChange={setEditLineId} disabled={structureLocked}>
                  <SelectTrigger><SelectValue placeholder="Sin línea" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin línea</SelectItem>
                    {activeLines.map(line => (<SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                {onUpdateLine && !structureLocked && (
                  <LineQuickEditPopover
                    line={lines.find(l => l.id === editLineId) || null}
                    onUpdate={onUpdateLine}
                    onDelete={onDeleteLine}
                    disabled={!editLineId || editLineId === 'none' || !lines.find(l => l.id === editLineId)}
                  />
                )}
                {!structureLocked && (
                  <Button size="icon" variant="ghost" onClick={() => openAddLineDialog('edit')} title="Nueva línea"><Plus className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DrawerForm>

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
            <AlertDialogAction
              onClick={handleConfirmToggle}
              className={toggleConfirm?.action === 'deactivate' ? 'bg-status-warning text-white hover:bg-status-warning/90' : undefined}
            >
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
              <label className="text-sm font-medium mb-2 block">Color (opcional)</label>
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
            <Button variant="ghost" onClick={() => setShowAddLineDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddNewLine} disabled={!newLineName.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
