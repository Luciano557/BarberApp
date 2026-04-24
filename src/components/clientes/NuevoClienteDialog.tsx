import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSucursal } from '@/contexts/SucursalContext';
import { useClientes } from '@/hooks/useClientes';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface NuevoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NuevoClienteDialog({ open, onOpenChange, onCreated }: NuevoClienteDialogProps) {
  const { sucursales, currentSucursal, isAllMode } = useSucursal();
  const { createCliente } = useClientes();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [sucursalId, setSucursalId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setTelefono('');
      setEmail('');
      setSucursalId(currentSucursal?.id ?? '');
    }
  }, [open, currentSucursal?.id]);

  const needsSucursalPicker = isAllMode || !currentSucursal;
  const noBranchAvailable = needsSucursalPicker && sucursales.length === 0;

  const handleSubmit = async () => {
    const n = nombre.trim();
    const a = apellido.trim();
    const t = telefono.trim();
    const e = email.trim();

    if (!n) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!a) {
      toast.error('El apellido es obligatorio');
      return;
    }
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error('Email inválido');
      return;
    }
    const targetSucursalId = needsSucursalPicker ? sucursalId : currentSucursal!.id;
    if (!targetSucursalId) {
      toast.error('Seleccioná una sucursal antes de crear el cliente');
      return;
    }

    setSaving(true);
    const { id, error } = await createCliente({
      nombre: n,
      apellido: a,
      telefono: t || undefined,
      email: e || undefined,
      sucursalId: targetSucursalId,
    });
    setSaving(false);

    if (error || !id) {
      toast.error(error || 'No se pudo crear el cliente');
      return;
    }
    toast.success('Cliente creado');
    onCreated?.(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Cargá los datos básicos. Podés completar más información desde el perfil del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido *</Label>
              <Input
                id="apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="11 5555 5555"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>

          {needsSucursalPicker && (
            <div className="space-y-1.5">
              <Label htmlFor="sucursal">Sucursal *</Label>
              {noBranchAvailable ? (
                <p className="text-sm text-muted-foreground">
                  No hay sucursales disponibles. Creá una sucursal antes de cargar clientes.
                </p>
              ) : (
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger id="sucursal">
                    <SelectValue placeholder="Seleccioná una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || noBranchAvailable}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
