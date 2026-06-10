import { useState } from 'react';
import { Plus, Edit2, Power, PowerOff, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Marca, MARCA_COLORS } from './types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  marcas: Marca[];
  onClose: () => void;
  onChanged: () => void;
}

export function MarcasManagerDialog({ open, marcas, onClose, onChanged }: Props) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draftNombre, setDraftNombre] = useState('');
  const [draftColor, setDraftColor] = useState(MARCA_COLORS[0].value);
  const [toggleConfirm, setToggleConfirm] = useState<{ marca: Marca; next: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const active = marcas.filter(m => m.activo);
  const inactive = marcas.filter(m => !m.activo);

  const reset = () => {
    setIsAdding(false);
    setEditingId(null);
    setDraftNombre('');
    setDraftColor(MARCA_COLORS[0].value);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setDraftNombre('');
    setDraftColor(MARCA_COLORS[0].value);
    setIsAdding(true);
  };

  const handleStartEdit = (m: Marca) => {
    setIsAdding(false);
    setEditingId(m.id);
    setDraftNombre(m.nombre);
    setDraftColor(m.color);
  };

  const handleSave = async () => {
    if (!orgId || !draftNombre.trim()) return;
    setSaving(true);
    try {
      const nombre = draftNombre.replace(/\s+/g, ' ').trim();
      if (editingId) {
        const { error } = await supabase
          .from('marcas_producto')
          .update({ nombre, color: draftColor })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Marca actualizada');
      } else {
        const { error } = await supabase
          .from('marcas_producto')
          .insert({ organization_id: orgId, nombre, color: draftColor, activo: true });
        if (error) throw error;
        toast.success('Marca creada');
      }
      reset();
      onChanged();
    } catch (e: any) {
      const msg = e?.message?.includes('duplicate key') ? 'Ya existe una marca con ese nombre' : (e?.message || 'Error al guardar');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleConfirm) return;
    const { error } = await supabase
      .from('marcas_producto')
      .update({ activo: toggleConfirm.next })
      .eq('id', toggleConfirm.marca.id);
    if (error) {
      toast.error('No se pudo actualizar');
    } else {
      toast.success(toggleConfirm.next ? 'Marca activada' : 'Marca desactivada');
      onChanged();
    }
    setToggleConfirm(null);
  };

  const renderEditor = () => (
    <div className="p-3 bg-muted/30 border border-border rounded-lg space-y-3 animate-scale-in">
      <Input
        placeholder="Nombre de la marca"
        value={draftNombre}
        onChange={(e) => setDraftNombre(e.target.value)}
        maxLength={80}
        autoFocus
      />
      <div>
        <p className="text-xs text-muted-foreground mb-2">Color</p>
        <div className="flex flex-wrap gap-2">
          {MARCA_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setDraftColor(c.value)}
              title={c.name}
              className={cn(
                'w-7 h-7 rounded-full border-2 transition-all',
                draftColor === c.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-between">
        <Button variant="ghost" size="sm" onClick={reset}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !draftNombre.trim()}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );

  const renderItem = (m: Marca) => (
    <div key={m.id}>
      {editingId === m.id ? (
        renderEditor()
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
          <span
            className="w-5 h-5 rounded-full border border-border shrink-0"
            style={{ backgroundColor: m.color }}
          />
          <span className="flex-1 font-medium text-foreground truncate">{m.nombre}</span>
          <Button size="icon" variant="ghost" onClick={() => handleStartEdit(m)} className="h-8 w-8">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setToggleConfirm({ marca: m, next: !m.activo })}
            className="h-8 w-8"
            title={m.activo ? 'Desactivar' : 'Activar'}
          >
            {m.activo
              ? <PowerOff className="h-4 w-4 text-destructive" />
              : <Power className="h-4 w-4 text-success" />}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Marcas
            </DialogTitle>
            <DialogDescription>
              Las marcas son globales para toda la organización. El color ayuda a identificarlas en el catálogo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-end">
              {!isAdding && !editingId && tab === 'active' && (
                <Button size="sm" variant="outline" onClick={handleStartAdd}>
                  <Plus className="h-4 w-4 mr-1" /> Nueva marca
                </Button>
              )}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'inactive')}>
              <TabsList className="w-full h-9 bg-muted/50 p-1 rounded-md">
                <TabsTrigger value="active" className="flex-1 text-xs data-[state=active]:bg-card">
                  Activas ({active.length})
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex-1 text-xs data-[state=active]:bg-card">
                  Inactivas ({inactive.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-3 space-y-2">
                {isAdding && renderEditor()}
                {active.map(renderItem)}
                {active.length === 0 && !isAdding && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay marcas. Agregá la primera para empezar.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="inactive" className="mt-3 space-y-2">
                {inactive.map(renderItem)}
                {inactive.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay marcas inactivas.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleConfirm} onOpenChange={(o) => !o && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm?.next ? 'Activar marca' : 'Desactivar marca'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.next
                ? `¿Querés volver a activar "${toggleConfirm?.marca.nombre}"?`
                : `¿Desactivar "${toggleConfirm?.marca.nombre}"? Los productos asociados seguirán existiendo, pero no la verás al asignar marca a productos nuevos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>
              {toggleConfirm?.next ? 'Activar' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
