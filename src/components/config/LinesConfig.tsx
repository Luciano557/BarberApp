import { useState } from 'react';
import { Plus, MoreVertical, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Line } from '@/types/barbershop';
import { toast } from 'sonner';
import { DrawerForm } from '@/components/ui/drawer-form';
import { TabBadge } from '@/components/ui/TabBadge';
import { EntityColorBar } from '@/components/ui/EntityColorBar';

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

interface LinesConfigProps {
  lines: Line[];
  onAdd: (line: Omit<Line, 'id'>) => Promise<Line | null>;
  onUpdate: (id: string, updates: Partial<Line>) => void;
  onDelete?: (id: string) => void;
}

interface ToggleConfirm {
  line: Line;
  action: 'activate' | 'deactivate';
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'El nombre no puede estar vacío.';
  if (trimmed.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  return null;
}

export function LinesConfig({ lines, onAdd, onUpdate, onDelete }: LinesConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'inactive'>('active');
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Line | null>(null);

  const active = lines.filter(l => l.active);
  const inactive = lines.filter(l => !l.active);
  const editingLine = editingId ? (lines.find(l => l.id === editingId) ?? null) : null;
  const editingIsActive = editingLine?.active ?? false;

  const resetForm = () => { setName(''); setColor(''); };

  const handleAdd = async () => {
    const err = validateName(name);
    if (err) { toast.error(err); return; }
    setIsSaving(true);
    try {
      await onAdd({ name: name.trim(), active: true, color: color || undefined });
      resetForm();
      setIsAdding(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = (id: string) => {
    const err = validateName(name);
    if (err) { toast.error(err); return; }
    onUpdate(id, { name: name.trim(), color: color || undefined });
    setEditingId(null);
    resetForm();
  };

  const startEdit = (line: Line) => {
    setEditingId(line.id);
    setName(line.name);
    setColor(line.color || '');
  };

  const handleConfirmToggle = () => {
    if (!toggleConfirm) return;
    onUpdate(toggleConfirm.line.id, { active: toggleConfirm.action === 'activate' });
    setToggleConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !onDelete) return;
    onDelete(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const ColorPicker = (
    <div className="flex flex-wrap gap-2">
      {LINE_COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => setColor(color === c.value ? '' : c.value)}
          className={`w-7 h-7 rounded-full border-2 transition-colors ${color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: c.value }}
          title={c.label}
        />
      ))}
    </div>
  );

  const renderLine = (line: Line) => {
    return (
      <div key={line.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <EntityColorBar color={line.color} />
          <div className="flex flex-1 items-center gap-3">
            <span className="flex-1 font-medium text-foreground">{line.name}</span>
            <button
              onClick={() => startEdit(line)}
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
      <Card className="border border-border bg-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Tag className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Agrupación de servicios</CardTitle>
                <CardDescription>Organizan el menú de cobro y facilitan la búsqueda de servicios.</CardDescription>
              </div>
            </div>
            {!isAdding && !editingId && activeSubTab === 'active' && (
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setIsAdding(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'active' | 'inactive')}>
            <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
              <TabsTrigger value="active" className="group flex-1 text-xs data-[state=active]:bg-card">Activas<TabBadge count={active.length} /></TabsTrigger>
              <TabsTrigger value="inactive" className="group flex-1 text-xs data-[state=active]:bg-card">Inactivas<TabBadge count={inactive.length} /></TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4 space-y-2">
              {active.map(renderLine)}
              {active.length === 0 && !isAdding && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium">No hay categorías activas</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Las categorías agrupan tus servicios en la pantalla de cobro.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { resetForm(); setIsAdding(true); }}>
                    Agregar categoría
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4 space-y-2">
              {inactive.map(renderLine)}
              {inactive.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay líneas inactivas</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <DrawerForm
        open={isAdding || editingId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setIsAdding(false);
            setEditingId(null);
            resetForm();
          }
        }}
        title={isAdding ? 'Agregar categoría' : 'Editar categoría'}
        size="sm"
        footer={
          isAdding ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => { setIsAdding(false); resetForm(); }}>Cancelar</Button>
              <Button disabled={isSaving} onClick={handleAdd}>
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          ) : editingLine ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button onClick={() => handleUpdate(editingLine.id)}>
                Guardar cambios
              </Button>
              <div className="w-px h-5 bg-border" />
              {editingIsActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setToggleConfirm({ line: editingLine, action: 'deactivate' });
                    setEditingId(null); resetForm();
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
                      onUpdate(editingLine.id, { active: true });
                      toast.success('Línea activada');
                      setEditingId(null); resetForm();
                    }}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
                  >
                    Activar
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDeleteConfirm(editingLine);
                        setEditingId(null); resetForm();
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
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Essencial, Deluxe"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color (opcional)</label>
            {ColorPicker}
          </div>
        </div>
      </DrawerForm>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(open) => !open && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.action === 'deactivate' ? 'Desactivar línea' : 'Activar línea'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.action === 'deactivate'
                ? `¿Estás seguro de que querés desactivar "${toggleConfirm?.line.name}"? Los servicios asociados seguirán existiendo, pero la línea no aparecerá como opción.`
                : `¿Querés volver a activar "${toggleConfirm?.line.name}"?`}
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar línea</AlertDialogTitle>
            <AlertDialogDescription>
              Esta línea dejará de aparecer en el sistema. Los servicios que la usaban seguirán existiendo y quedarán sin línea. No se modificarán los registros históricos. Esta acción no se podrá deshacer desde la interfaz.
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
    </>
  );
}
